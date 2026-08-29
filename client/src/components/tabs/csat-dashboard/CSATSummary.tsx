import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useTheme } from "@/contexts/ThemeContext";
import { cn } from "@/lib/utils";
import { Star, Activity, BarChart3, Trophy } from "lucide-react";

interface CSATSummaryProps {
  teamIds?: string[];
  agentIds?: string[];
}

export default function CSATSummary({ teamIds = [], agentIds = [] }: CSATSummaryProps) {
  const { t } = useTranslation();
  const params = new URLSearchParams();
  if (teamIds.length) params.set("teamIds", teamIds.join(","));
  if (agentIds.length) params.set("agentIds", agentIds.join(","));
  const qs = params.toString();

  const { data } = useQuery<any>({
    queryKey: ["/api/statistics/csat-summary", qs],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/statistics/csat-summary${qs ? `?${qs}` : ""}`);
      return res.json();
    },
    refetchInterval: 300_000,
  });

  const { mode } = useTheme();
  const dark = mode === "dark";

  const card    = dark ? "bg-[#0f1829] border-slate-800" : "bg-white border-slate-200";
  const text    = dark ? "text-white"     : "text-slate-900";
  const sub     = dark ? "text-slate-400" : "text-slate-500";
  const grid    = dark ? "#1e293b" : "#f1f5f9";
  const axis    = dark ? "#64748b" : "#94a3b8";
  const tipCls  = dark ? "bg-[#0f1829] border-slate-700 text-white" : "bg-white border-slate-200 text-slate-800";

  // All values from backend. `totalConversations` mirrors completed inboxes
  // (real signal of how many CSAT prompts could have been sent) even though
  // satisfaction-score/feedbackRate stay at 0 until the collection layer ships.
  const satisfactionScore    = data?.satisfactionScore ?? 0;
  const totalResponses       = data?.totalResponses ?? 0;
  const basedOnConversations = data?.basedOnConversations ?? 0;
  const feedbackRate         = data?.feedbackRate ?? 0;
  const responded            = data?.responded ?? 0;
  const totalConversations   = data?.totalConversations ?? 0;
  const distMap              = data?.distribution ?? { great: 0, average: 0, poor: 0 };

  const distributionData = [
    { name: t("csat_dashboard.rating_great"),   percentage: distMap.great ?? 0, color: "bg-emerald-500", icon: "😊" },
    { name: t("csat_dashboard.rating_average"), percentage: distMap.average ?? 0, color: "bg-orange-500",  icon: "😐" },
    { name: t("csat_dashboard.rating_poor"),    percentage: distMap.poor ?? 0, color: "bg-rose-500",    icon: "😞" },
  ];

  const agentRankings: Array<{ name: string; count: number; label: string; positive: boolean }> = data?.agentRankings ?? [];
  const csatDistributionData: Array<{ date: string; great: number; average: number; poor: number }> = data?.csatDistributionData ?? [];

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
      <div className={cn("px-3 py-2 rounded-xl border shadow-2xl text-[11px]", tipCls)}>
        <p className="font-semibold mb-1 opacity-60">{label}</p>
        {payload.map((e: any, i: number) => (
          <div key={i} className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full" style={{ background: e.stroke || e.color }} />
            <span className="opacity-70 capitalize">{e.name}:</span>
            <span className="font-bold">{e.value}</span>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-5">
      {/* KPI Cards Row */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">

        {/* Satisfaction Score */}
        <div className={cn("rounded-2xl border p-5 transition-all duration-300 hover:shadow-xl hover:-translate-y-1", card, dark ? "hover:border-primary/30" : "hover:border-primary/20")}>
          <div className="flex items-center gap-2.5 mb-4">
            <div className={cn("p-2 rounded-xl", dark ? "bg-primary/15" : "bg-primary/10")}>
              <Star size={14} className="text-primary" />
            </div>
            <h3 className={cn("text-[12px] font-bold", sub)}>{t("csat_dashboard.satisfaction_score")}</h3>
          </div>
          <div className={cn("text-4xl font-black tabular-nums mb-3", text)}>{satisfactionScore}%</div>
          <div className="space-y-1">
            <div className="flex justify-between">
              <span className={cn("text-[11px]", sub)}>{t("csat_dashboard.total_responses")}</span>
              <span className={cn("text-[11px] font-bold", text)}>{totalResponses}</span>
            </div>
            <div className="flex justify-between">
              <span className={cn("text-[11px]", sub)}>{t("csat_dashboard.based_on")}</span>
              <span className={cn("text-[11px] font-bold", text)}>{t("csat_dashboard.conv_count", { count: basedOnConversations.toLocaleString() })}</span>
            </div>
          </div>
        </div>

        {/* Response Rate */}
        <div className={cn("rounded-2xl border p-5 transition-all duration-300 hover:shadow-xl hover:-translate-y-1", card, dark ? "hover:border-primary/30" : "hover:border-primary/20")}>
          <div className="flex items-center gap-2.5 mb-4">
            <div className={cn("p-2 rounded-xl", dark ? "bg-emerald-500/15" : "bg-emerald-50")}>
              <Activity size={14} className="text-emerald-500" />
            </div>
            <h3 className={cn("text-[12px] font-bold", sub)}>{t("csat_dashboard.response_rate")}</h3>
          </div>
          <div className={cn("text-4xl font-black tabular-nums mb-3 text-emerald-500")}>{feedbackRate}%</div>
          <div className="space-y-1">
            <div className="flex justify-between">
              <span className={cn("text-[11px]", sub)}>{t("csat_dashboard.responded")}</span>
              <span className={cn("text-[11px] font-bold", text)}>{responded}</span>
            </div>
            <div className="flex justify-between">
              <span className={cn("text-[11px]", sub)}>{t("csat_dashboard.total_conversations")}</span>
              <span className={cn("text-[11px] font-bold", text)}>{totalConversations.toLocaleString()}</span>
            </div>
          </div>
        </div>

        {/* Distribution */}
        <div className={cn("rounded-2xl border p-5 transition-all duration-300 hover:shadow-xl hover:-translate-y-1", card, dark ? "hover:border-primary/30" : "hover:border-primary/20")}>
          <div className="flex items-center gap-2.5 mb-5">
            <div className={cn("p-2 rounded-xl", dark ? "bg-violet-500/15" : "bg-violet-50")}>
              <BarChart3 size={14} className="text-violet-500" />
            </div>
            <h3 className={cn("text-[12px] font-bold", sub)}>{t("csat_dashboard.distribution")}</h3>
          </div>
          <div className="space-y-3">
            {distributionData.map((item) => (
              <div key={item.name} className="space-y-1">
                <div className="flex justify-between items-center">
                  <span className={cn("text-[11px] font-semibold", sub)}>{item.icon} {item.name}</span>
                  <span className={cn("text-[11px] font-black", text)}>{item.percentage}%</span>
                </div>
                <div className={cn("w-full h-1.5 rounded-full", dark ? "bg-slate-800" : "bg-slate-100")}>
                  <div className={cn("h-1.5 rounded-full transition-all duration-1000", item.color)} style={{ width: `${item.percentage}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Agent Rankings */}
        <div className={cn("rounded-2xl border p-5 transition-all duration-300 hover:shadow-xl hover:-translate-y-1", card, dark ? "hover:border-primary/30" : "hover:border-primary/20")}>
          <div className="flex items-center gap-2.5 mb-5">
            <div className={cn("p-2 rounded-xl", dark ? "bg-orange-500/15" : "bg-orange-50")}>
              <Trophy size={14} className="text-orange-500" />
            </div>
            <h3 className={cn("text-[12px] font-bold", sub)}>{t("csat_dashboard.agent_rankings")}</h3>
          </div>
          <div className="space-y-4">
            {agentRankings.map((agent, idx) => (
              <div key={idx} className={cn("rounded-xl p-3", dark ? "bg-slate-800/60" : "bg-slate-50")}>
                <div className="flex items-center justify-between mb-1">
                  <span className={cn("text-[11px] font-bold", sub)}>{agent.name}</span>
                  <span className={cn("text-[11px] font-black", agent.positive ? "text-emerald-500" : "text-rose-500")}>
                    +{agent.count}
                  </span>
                </div>
                <span className={cn("text-[12px] font-black", text)}>{agent.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* CSAT Distribution Chart */}
      <div className={cn("rounded-2xl border p-5 transition-all duration-300 hover:shadow-xl", card)}>
        <h3 className={cn("text-[13px] font-bold mb-1", text)}>{t("csat_dashboard.chart_title")}</h3>
        <p className={cn("text-[11px] mb-6", sub)}>{t("csat_dashboard.chart_subtitle")}</p>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={csatDistributionData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={grid} vertical={false} />
            <XAxis dataKey="date" tick={{ fontSize: 10, fill: axis }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 10, fill: axis }} axisLine={false} tickLine={false} />
            <Tooltip content={<CustomTooltip />} cursor={{ stroke: "#6366f1", strokeWidth: 1, strokeDasharray: "4 4" }} />
            <Legend wrapperStyle={{ fontSize: "11px", paddingTop: "12px" }} iconType="circle" />
            <Line type="monotone" dataKey="great"   stroke="#22c55e" strokeWidth={2.5} dot={false} name={t("csat_dashboard.rating_great")}   activeDot={{ r: 4, fill: "#22c55e", strokeWidth: 0 }} />
            <Line type="monotone" dataKey="average" stroke="#f97316" strokeWidth={2.5} dot={false} name={t("csat_dashboard.rating_average")} activeDot={{ r: 4, fill: "#f97316", strokeWidth: 0 }} />
            <Line type="monotone" dataKey="poor"    stroke="#ef4444" strokeWidth={2.5} dot={false} name={t("csat_dashboard.rating_poor")}    activeDot={{ r: 4, fill: "#ef4444", strokeWidth: 0 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
