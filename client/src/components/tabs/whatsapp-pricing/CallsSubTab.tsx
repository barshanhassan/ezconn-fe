import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useTheme } from "@/contexts/ThemeContext";
import { cn } from "@/lib/utils";
import { Phone, Clock, DollarSign } from "lucide-react";
import { useTranslation } from "react-i18next";

export default function CallsSubTab() {
  const { t } = useTranslation();
  // WhatsApp Business Calling API isn't yet wired in EZCONN, so the backend
  // returns honest zeros with zero-filled trends. Once Meta's Calling API is
  // integrated, the same endpoint will start returning real numbers without
  // any frontend changes.
  const { data } = useQuery<any>({
    queryKey: ["/api/statistics/whatsapp-calls"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/statistics/whatsapp-calls");
      return res.json();
    },
    refetchInterval: 300_000,
  });
  const k = data?.kpi ?? {};

  const { mode } = useTheme();
  const dark = mode === "dark";
  const card = dark ? "bg-[#0f1829] border-slate-800" : "bg-white border-slate-200";
  const text = dark ? "text-white" : "text-slate-900";
  const sub = dark ? "text-slate-400" : "text-slate-500";
  const grid = dark ? "#1e293b" : "#f1f5f9";
  const axis = dark ? "#64748b" : "#94a3b8";
  const tip = dark ? "bg-[#0f1829] border-slate-700 text-white" : "bg-white border-slate-200 text-slate-800";

  const ChartTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
      <div className={cn("px-3 py-2 rounded-xl border shadow-2xl text-[11px]", tip)}>
        <p className="font-semibold mb-1 opacity-60">{label}</p>
        {payload.map((e: any, i: number) => (
          <div key={i} className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full" style={{ background: e.stroke || e.color }} />
            <span className="opacity-70">{e.name}:</span>
            <span className="font-bold">{e.value}</span>
          </div>
        ))}
      </div>
    );
  };

  const kpiCards = [
    {
      title: t("calls_sub_tab.all_calls"), icon: <Phone size={14} className="text-primary" />,
      rows: [
        { l: t("calls_sub_tab.business_initiated"), v: k.allCalls?.businessInitiated ?? 0 },
        { l: t("calls_sub_tab.user_initiated"), v: k.allCalls?.userInitiated ?? 0 },
      ]
    },
    {
      title: t("calls_sub_tab.avg_billable_duration"), icon: <Clock size={14} className="text-primary" />,
      rows: [
        { l: t("calls_sub_tab.business_initiated"), v: k.avgDuration?.businessInitiated ?? 0 },
        { l: t("calls_sub_tab.user_initiated"), v: k.avgDuration?.userInitiated ?? 0 },
      ]
    },
    {
      title: t("calls_sub_tab.approx_total_charges"), icon: <DollarSign size={14} className="text-primary" />,
      rows: [
        { l: t("calls_sub_tab.business_initiated"), v: k.approxCharges?.businessInitiated ?? "$0" },
        { l: t("calls_sub_tab.user_initiated"), v: k.approxCharges?.userInitiated ?? "$0" },
      ]
    },
  ];

  // Backend returns zero-filled trends (7 days of zero data points) so the
  // chart axes/legend render even when the Calling API integration is dormant.
  const allCallsData: Array<{ date: string; businessInitiated: number; userInitiated: number }> = data?.allCallsTrend ?? [];
  const durationData: Array<{ date: string; businessInitiated: number; userInitiated: number }> = data?.durationTrend ?? [];
  const chargesData: Array<{ date: string; calls: number; charges: number }> = data?.chargesTrend ?? [];

  const CALL_LINES = [
    { key: "businessInitiated", name: t("calls_sub_tab.business_initiated"), stroke: "#22c55e" },
    { key: "userInitiated", name: t("calls_sub_tab.user_initiated"), stroke: "#3b82f6" },
  ];
  const CHARGE_LINES = [
    { key: "calls", name: t("calls_sub_tab.calls_label"), stroke: "#22c55e" },
    { key: "charges", name: t("calls_sub_tab.charges_label"), stroke: "#ec4899" },
  ];

  const charts = [
    { title: t("calls_sub_tab.all_calls"), sub: t("calls_sub_tab.call_volume_over_time"), data: allCallsData, lines: CALL_LINES },
    { title: t("calls_sub_tab.avg_billable_call_duration"), sub: t("calls_sub_tab.duration_trends"), data: durationData, lines: CALL_LINES },
    { title: t("calls_sub_tab.calls_and_approx_charges"), sub: t("calls_sub_tab.cost_analysis_over_time"), data: chargesData, lines: CHARGE_LINES },
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
                  <span className={cn("text-[13px] font-bold tabular-nums", text)}>{r.v}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Charts — paired 2-up, matching the Daily/Monthly Active Users layout. */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {charts.map((ch, i) => (
          <div key={i} className={cn(
            "rounded-2xl border p-5 transition-all duration-300 hover:shadow-xl",
            card,
            // Odd one out (no partner) spans the full row instead of leaving
            // the other half empty.
            i === charts.length - 1 && charts.length % 2 !== 0 && "md:col-span-2"
          )}>
            <h3 className={cn("text-[13px] font-bold mb-1", text)}>{ch.title}</h3>
            <p className={cn("text-[11px] mb-4", sub)}>{ch.sub}</p>
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={ch.data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={grid} />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: axis }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: axis }} axisLine={false} tickLine={false} />
                <Tooltip content={<ChartTooltip />} cursor={{ stroke: "#6366f1", strokeWidth: 1, strokeDasharray: "4 4" }} />
                <Legend wrapperStyle={{ fontSize: "11px", paddingTop: "12px" }} iconType="circle" />
                {ch.lines.map(l => <Line key={l.key} type="monotone" dataKey={l.key} stroke={l.stroke} strokeWidth={2.5} dot={false} name={l.name} activeDot={{ r: 4, fill: l.stroke, strokeWidth: 0 }} />)}
              </LineChart>
            </ResponsiveContainer>
          </div>
        ))}
      </div>
    </div>
  );
}
