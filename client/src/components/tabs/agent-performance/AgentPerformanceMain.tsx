import { useState } from "react";
import { Search, MessageSquare, Zap, List, ThumbsUp } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useTheme } from "@/contexts/ThemeContext";
import { useDateRange } from "@/contexts/DateRangeContext";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";

const abbreviateNumber = (num: number) => num >= 1000000 ? (num/1000000).toFixed(1)+"M" : num >= 1000 ? (num/1000).toFixed(1)+"K" : num.toString();

interface AgentPerformanceMainProps {
  teamIds?: string[];
  agentIds?: string[];
}

export default function AgentPerformanceMain({ teamIds = [], agentIds = [] }: AgentPerformanceMainProps) {
  const { t } = useTranslation();
  const { mode } = useTheme();
  const dark = mode === "dark";
  const card    = dark ? "bg-[#0f1829] border-slate-800" : "bg-white border-slate-200";
  const text    = dark ? "text-white"     : "text-slate-900";
  const sub     = dark ? "text-slate-400" : "text-slate-500";
  const divider = dark ? "border-slate-800" : "border-slate-100";
  const rowHover = dark ? "hover:bg-slate-800/50" : "hover:bg-slate-50";
  const thCls   = dark ? "text-slate-500 border-slate-800" : "text-slate-400 border-slate-100";
  const inputCls = dark ? "bg-slate-900/60 border-slate-700 text-white placeholder:text-slate-500" : "bg-slate-50 border-slate-200 text-slate-900 placeholder:text-slate-400";

  const [availSearch, setAvailSearch] = useState("");
  const [perfSearch,  setPerfSearch]  = useState("");

  // Real agent performance metrics — backend computes KPIs + availability +
  // per-agent metrics from inbox/users tables. Polls every 60 s so a fresh
  // workspace populates as soon as the first conversation lands.
  const { from, to } = useDateRange().rangeFor("performance");
  const params = new URLSearchParams();
  if (teamIds.length) params.set("teamIds", teamIds.join(","));
  if (agentIds.length) params.set("agentIds", agentIds.join(","));
  params.set("from", from);
  params.set("to", to);
  const qs = params.toString();

  const { data: perfData } = useQuery<any>({
    queryKey: ["/api/statistics/agent-performance-main", qs],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/statistics/agent-performance-main${qs ? `?${qs}` : ""}`);
      return res.json();
    },
    refetchInterval: 60_000,
  });

  const agentAvailabilityData: Array<{ name: string; team: string; loginTime: string; status: string; dot: string }> = perfData?.availability?.agents ?? [];
  const agentMetricsData: Array<{ name: string; accepted: number; solved: number; date: string; avgResponse: string; avgResolution: string }> = perfData?.metrics ?? [];
  const totalAgents = perfData?.availability?.total ?? 0;
  const statusBars: { label: string; count: number; pct: number; color: string }[] =
    perfData?.availability?.statusBars ?? [
      { label: t("agent_performance_main.status_online"),  count: 0, pct: 0, color: "bg-emerald-500" },
      { label: t("agent_performance_main.status_busy"),    count: 0, pct: 0, color: "bg-orange-500"  },
      { label: t("agent_performance_main.status_away"),    count: 0, pct: 0, color: "bg-yellow-500"  },
      { label: t("agent_performance_main.status_offline"), count: 0, pct: 0, color: "bg-slate-400"   },
    ];

  const filteredAvail = agentAvailabilityData.filter(a =>
    a.name.toLowerCase().includes(availSearch.toLowerCase()) || a.team.toLowerCase().includes(availSearch.toLowerCase())
  );
  const filteredPerf = agentMetricsData.filter(a => a.name.toLowerCase().includes(perfSearch.toLowerCase()));

  // KPI values now flow from the backend's `kpi` block. Each fallback keeps
  // the original empty-state display ("0" / "—") if data is still loading.
  const k = perfData?.kpi ?? {};
  const kpiCards = [
    { title: t("agent_performance_main.kpi_conversations"), icon: <MessageSquare size={14} className="text-primary" />,
      rows: [
        { l: t("agent_performance_main.row_total_handled"), v: String(k.conversations?.total ?? 0) },
        { l: t("agent_performance_main.row_completed"), v: String(k.conversations?.completed ?? 0) },
        { l: t("agent_performance_main.row_in_progress"), v: String(k.conversations?.inProgress ?? 0) },
      ] },
    { title: t("agent_performance_main.kpi_performance"), icon: <Zap size={14} className="text-primary" />,
      rows: [
        { l: t("agent_performance_main.row_avg_response_time"), v: k.performance?.avgResponse ?? "—" },
        { l: t("agent_performance_main.row_avg_resolution_time"), v: k.performance?.avgResolution ?? "—" },
        { l: t("agent_performance_main.row_resolution_rate"), v: k.performance?.resolutionRate ?? "—" },
      ] },
    { title: t("agent_performance_main.kpi_queue"), icon: <List size={14} className="text-primary" />,
      rows: [
        { l: t("agent_performance_main.row_active_now"), v: String(k.queue?.active ?? 0) },
        { l: t("agent_performance_main.row_pending"), v: String(k.queue?.pending ?? 0) },
        { l: t("agent_performance_main.row_forwarded"), v: String(k.queue?.forwarded ?? 0) },
      ] },
    { title: t("agent_performance_main.kpi_feedback"), icon: <ThumbsUp size={14} className="text-primary" />,
      rows: [
        { l: t("agent_performance_main.row_great"), v: String(k.feedback?.great ?? 0), c: "text-emerald-500" },
        { l: t("agent_performance_main.row_average"), v: String(k.feedback?.average ?? 0), c: "text-yellow-500" },
        { l: t("agent_performance_main.row_poor"), v: String(k.feedback?.poor ?? 0), c: "text-rose-500" },
      ] },
  ];

  const tableHeaders = (cols: string[]) => (
    <tr className={cn("border-b text-left", divider)}>
      {cols.map(h => <th key={h} className={cn("pb-2 px-3 text-[10px] font-bold", thCls)}>{h}</th>)}
    </tr>
  );

  return (
    <div className="space-y-5">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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

      {/* Agent Availability Board */}
      <div className={cn("rounded-2xl border p-5 transition-all duration-300 hover:shadow-xl", card)}>
        <div className="flex items-center justify-between mb-5">
          <h3 className={cn("text-[13px] font-bold", text)}>{t("agent_performance_main.availability_board_title")}</h3>
          <div className="relative">
            <Search className={cn("absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5", sub)} />
            <input placeholder={t("agent_performance_main.search_agents_placeholder")} value={availSearch} onChange={e => setAvailSearch(e.target.value)}
              className={cn("pl-9 pr-3 h-8 w-44 text-[11px] rounded-lg border outline-none", inputCls)} />
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Status Bars */}
          <div className="space-y-3">
            <div className="flex justify-between mb-2">
              <span className={cn("text-[11px] font-bold", sub)}>{t("agent_performance_main.agent_status_label")}</span>
              <span className={cn("text-[11px] font-bold", sub)}>{t("agent_performance_main.total_label", { count: totalAgents })}</span>
            </div>
            {statusBars.map((s, i) => (
              <div key={i}>
                <div className="flex justify-between mb-1">
                  <span className={cn("text-[11px]", sub)}>{s.label}</span>
                  <span className={cn("text-[11px] font-bold", text)}>{s.count}</span>
                </div>
                <div className={cn("w-full rounded-full h-1.5", dark ? "bg-slate-800" : "bg-slate-100")}>
                  <div className={cn("h-1.5 rounded-full", s.color)} style={{ width: `${s.pct}%` }} />
                </div>
              </div>
            ))}
            <div className={cn("pt-3 grid grid-cols-2 gap-1.5 border-t", divider)}>
              {statusBars.map((s, i) => (
                <div key={i} className="flex items-center gap-1.5">
                  <div className={cn("w-1.5 h-1.5 rounded-full", s.color)} />
                  <span className={cn("text-[10px]", sub)}>{s.label} ({s.count})</span>
                </div>
              ))}
            </div>
          </div>
          {/* Agents Table */}
          <div className="lg:col-span-2 overflow-x-auto">
            <table className="w-full">
              <thead>{tableHeaders([
                t("agent_performance_main.table_header_agent"),
                t("agent_performance_main.table_header_team"),
                t("agent_performance_main.table_header_login_time"),
                t("agent_performance_main.table_header_status"),
              ])}</thead>
              <tbody>
                {filteredAvail.length > 0 ? filteredAvail.map((a, i) => (
                  <tr key={i} className={cn("border-b transition-colors", divider, rowHover)}>
                    <td className={cn("py-2.5 px-3 text-[12px] font-semibold", text)}>{a.name}</td>
                    <td className={cn("py-2.5 px-3 text-[11px]", sub)}>{a.team}</td>
                    <td className={cn("py-2.5 px-3 text-[11px] tabular-nums", sub)}>{a.loginTime}</td>
                    <td className="py-2.5 px-3">
                      <div className="flex items-center gap-1.5">
                        <div className={cn("w-1.5 h-1.5 rounded-full", a.dot)} />
                        <span className={cn("text-[11px] font-semibold", text)}>{a.status}</span>
                      </div>
                    </td>
                  </tr>
                )) : <tr><td colSpan={4} className={cn("py-6 text-center text-[11px]", sub)}>{t("agent_performance_main.no_agents_found")}</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Agent Performance Metrics */}
      <div className={cn("rounded-2xl border p-5 transition-all duration-300 hover:shadow-xl", card)}>
        <div className="flex items-center justify-between mb-5">
          <h3 className={cn("text-[13px] font-bold", text)}>{t("agent_performance_main.performance_metrics_title")}</h3>
          <div className="relative">
            <Search className={cn("absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5", sub)} />
            <input placeholder={t("agent_performance_main.search_by_agent_placeholder")} value={perfSearch} onChange={e => setPerfSearch(e.target.value)}
              className={cn("pl-9 pr-3 h-8 w-52 text-[11px] rounded-lg border outline-none", inputCls)} />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>{tableHeaders([
              t("agent_performance_main.table_header_agent"),
              t("agent_performance_main.table_header_accepted"),
              t("agent_performance_main.table_header_solved"),
              t("agent_performance_main.table_header_date"),
              t("agent_performance_main.table_header_avg_response"),
              t("agent_performance_main.table_header_avg_resolution"),
            ])}</thead>
            <tbody>
              {filteredPerf.length > 0 ? filteredPerf.map((a, i) => (
                <tr key={i} className={cn("border-b transition-colors", divider, rowHover)}>
                  <td className={cn("py-2.5 px-3 text-[12px] font-semibold", text)}>{a.name}</td>
                  <td className="py-2.5 px-3 text-[12px] font-bold text-primary">{a.accepted}</td>
                  <td className="py-2.5 px-3 text-[12px] font-bold text-emerald-500">{a.solved}</td>
                  <td className={cn("py-2.5 px-3 text-[11px]", sub)}>{a.date}</td>
                  <td className={cn("py-2.5 px-3 text-[11px] tabular-nums", text)}>{a.avgResponse}</td>
                  <td className={cn("py-2.5 px-3 text-[11px] tabular-nums", text)}>{a.avgResolution}</td>
                </tr>
              )) : <tr><td colSpan={6} className={cn("py-6 text-center text-[11px]", sub)}>{t("agent_performance_main.no_records_found")}</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
