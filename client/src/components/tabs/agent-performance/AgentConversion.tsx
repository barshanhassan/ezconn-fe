import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useTheme } from "@/contexts/ThemeContext";
import { useDateRange } from "@/contexts/DateRangeContext";
import { cn } from "@/lib/utils";
import { TrendingUp, Phone, Activity } from "lucide-react";
import { useTranslation } from "react-i18next";

const abbreviateNumber = (num: number) => num >= 1000 ? (num / 1000).toFixed(1) + "K" : num.toString();

interface AgentConversionProps {
  teamIds?: string[];
  agentIds?: string[];
}

export default function AgentConversion({ teamIds = [], agentIds = [] }: AgentConversionProps) {
  const { t } = useTranslation();
  // Real conversion analytics — KPIs, volume trend, call engagement trend,
  // and top tags. Backend reads inbox + twilio_call_logs + tag_links.
  const { from, to } = useDateRange().rangeFor("performance");
  const params = new URLSearchParams();
  if (teamIds.length) params.set("teamIds", teamIds.join(","));
  if (agentIds.length) params.set("agentIds", agentIds.join(","));
  params.set("from", from);
  params.set("to", to);
  const qs = params.toString();

  const { data } = useQuery<any>({
    queryKey: ["/api/statistics/agent-conversion", qs],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/statistics/agent-conversion${qs ? `?${qs}` : ""}`);
      return res.json();
    },
    refetchInterval: 60_000,
  });

  const conversionVolumeTrendData: Array<{ date: string; queued: number; active: number; pending: number; resolved: number }> = data?.conversionVolumeTrend ?? [];
  const callEngagementTrendData: Array<{ date: string; inbound: number; outbound: number; messagesReceived: number; messagesSent: number }> = data?.callEngagementTrend ?? [];
  const tagsData: Array<{ name: string; count: number; cls: string }> = data?.tagsData ?? [];
  const k = data?.kpi ?? {};

  const { mode } = useTheme();
  const dark = mode === "dark";
  const card = dark ? "bg-[#0f1829] border-slate-800" : "bg-white border-slate-200";
  const text = dark ? "text-white" : "text-slate-900";
  const sub = dark ? "text-slate-400" : "text-slate-500";
  const grid = dark ? "#1e293b" : "#f1f5f9";
  const axis = dark ? "#64748b" : "#94a3b8";
  const tooltip = dark ? "bg-[#0f1829] border-slate-700 text-white" : "bg-white border-slate-200 text-slate-800";

  const BARS_CONV = [
    { key: "queued", name: t("agent_conversion.labels.queued"), fill: "#f87171" },
    { key: "active", name: t("agent_conversion.labels.active"), fill: "#fb923c" },
    { key: "pending", name: t("agent_conversion.labels.pending"), fill: "#c084fc" },
    { key: "resolved", name: t("agent_conversion.labels.resolved"), fill: "#60a5fa" },
  ];
  const BARS_CALL = [
    { key: "inbound", name: t("agent_conversion.labels.inbound_calls"), fill: "#f87171" },
    { key: "outbound", name: t("agent_conversion.labels.outbound_calls"), fill: "#fb923c" },
    { key: "messagesReceived", name: t("agent_conversion.labels.messages_received"), fill: "#c084fc" },
    { key: "messagesSent", name: t("agent_conversion.labels.messages_sent"), fill: "#60a5fa" },
  ];

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
      <div className={cn("px-3 py-2 rounded-xl border shadow-2xl text-[11px]", tooltip)}>
        <p className="font-semibold mb-1 opacity-60">{label}</p>
        {payload.map((e: any, i: number) => (
          <div key={i} className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full" style={{ background: e.fill }} />
            <span className="opacity-70">{e.name}:</span>
            <span className="font-bold">{e.value}</span>
          </div>
        ))}
      </div>
    );
  };

  const kpiCards = [
    {
      title: t("agent_conversion.conversion_status"), icon: <Activity size={14} className="text-primary" />,
      rows: [
        { l: t("agent_conversion.labels.queued"), v: String(k.conversionStatus?.queued ?? 0), c: "text-rose-400" },
        { l: t("agent_conversion.labels.active"), v: String(k.conversionStatus?.active ?? 0), c: "text-orange-400" },
        { l: t("agent_conversion.labels.pending"), v: String(k.conversionStatus?.pending ?? 0), c: "text-yellow-400" },
        { l: t("agent_conversion.labels.exited"), v: String(k.conversionStatus?.exited ?? 0), c: "text-slate-400" },
      ],
    },
    {
      title: t("agent_conversion.performance"), icon: <TrendingUp size={14} className="text-primary" />,
      rows: [
        { l: t("agent_conversion.labels.avg_response_time"), v: k.performance?.avgResponseTime ?? "—" },
        { l: t("agent_conversion.labels.resolution_rate"), v: k.performance?.resolutionRate ?? "—" },
        { l: t("agent_conversion.labels.customer_satisfaction"), v: k.performance?.customerSatisfaction ?? "—" },
      ],
    },
    {
      title: t("agent_conversion.call_statistics"), icon: <Phone size={14} className="text-primary" />,
      rows: [
        { l: t("agent_conversion.labels.total_calls"), v: String(k.callStatistics?.totalCalls ?? 0), c: "text-primary" },
        { l: t("agent_conversion.labels.inbound_calls"), v: String(k.callStatistics?.inboundCalls ?? 0), c: "text-blue-400" },
        { l: t("agent_conversion.labels.outbound_calls"), v: String(k.callStatistics?.outboundCalls ?? 0), c: "text-violet-400" },
      ],
    },
  ];

  return (
    <div className="space-y-5">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {kpiCards.map((kpi, i) => (
          <div key={i} className={cn("rounded-2xl border p-5 transition-all duration-300 hover:shadow-xl hover:-translate-y-1", card, dark ? "hover:border-primary/30" : "hover:border-primary/20")}>
            <div className="flex items-center gap-2.5 mb-4">
              <div className={cn("p-2 rounded-xl", dark ? "bg-primary/15" : "bg-primary/10")}>{kpi.icon}</div>
              <h3 className={cn("text-[13px] font-bold", text)}>{kpi.title}</h3>
            </div>
            <div className="space-y-2">
              {kpi.rows.map((r: any, ri: number) => (
                <div key={ri} className="flex justify-between items-center">
                  <span className={cn("text-[11px]", sub)}>{r.l}</span>
                  <span className={cn("text-[13px] font-bold tabular-nums", r.c || text)}>{r.v}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Conversion Volume Trend */}
      <div className={cn("rounded-2xl border p-5 transition-all duration-300 hover:shadow-xl", card)}>
        <h3 className={cn("text-[13px] font-bold mb-1", text)}>{t("agent_conversion.conversion_volume_trend")}</h3>
        <p className={cn("text-[11px] mb-4", sub)}>{t("agent_conversion.conversion_volume_trend_desc")}</p>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={conversionVolumeTrendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={grid} />
            <XAxis dataKey="date" tick={{ fontSize: 10, fill: axis }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 10, fill: axis }} axisLine={false} tickLine={false} />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: dark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.03)" }} />
            <Legend wrapperStyle={{ fontSize: "11px", paddingTop: "12px" }} iconType="circle" />
            {BARS_CONV.map(b => <Bar key={b.key} dataKey={b.key} stackId="a" fill={b.fill} name={b.name} radius={b.key === "resolved" ? [4, 4, 0, 0] : [0, 0, 0, 0]} />)}
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Call Engagement + Tags */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <div className={cn("lg:col-span-3 rounded-2xl border p-5 transition-all duration-300 hover:shadow-xl", card)}>
          <h3 className={cn("text-[13px] font-bold mb-1", text)}>{t("agent_conversion.call_engagement_trend")}</h3>
          <p className={cn("text-[11px] mb-4", sub)}>{t("agent_conversion.call_engagement_trend_desc")}</p>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={callEngagementTrendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={grid} />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: axis }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: axis }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: dark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.03)" }} />
              <Legend wrapperStyle={{ fontSize: "11px", paddingTop: "12px" }} iconType="circle" />
              {BARS_CALL.map(b => <Bar key={b.key} dataKey={b.key} stackId="a" fill={b.fill} name={b.name} radius={b.key === "messagesSent" ? [4, 4, 0, 0] : [0, 0, 0, 0]} />)}
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Tags */}
        <div className={cn("rounded-2xl border p-5 transition-all duration-300 hover:shadow-xl", card)}>
          <h3 className={cn("text-[13px] font-bold mb-4", text)}>{t("agent_conversion.tags")}</h3>
          <div className="flex flex-col gap-2.5">
            {tagsData.map((tag, i) => (
              <div key={i} className={cn("flex items-center justify-between px-3 py-2 rounded-xl text-[11px] font-semibold", tag.cls)}>
                <span>{tag.name}</span>
                <span className="font-black">{tag.count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
