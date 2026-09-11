import { useState, useRef, useEffect } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar } from "recharts";
import { ChevronDown, Check, Bot, MessageSquare, Send, BarChart3, Users, Clock } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import TimeHeatmap from "@/components/TimeHeatmap";
import { useTheme } from "@/contexts/ThemeContext";
import { useDateRange } from "@/contexts/DateRangeContext";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";

// Top Filter Dropdown Component
interface TopFilterDropdownProps {
  topFilter: string;
  setTopFilter: (value: string) => void;
}

const TopFilterDropdown: React.FC<TopFilterDropdownProps> = ({ topFilter, setTopFilter }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { mode } = useTheme();
  const dark = mode === "dark";

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) document.addEventListener('mousedown', handleClickOutside);
    else document.removeEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const options = ["Top 5", "Top 10", "All"];

  return (
    <div className="relative w-32" ref={dropdownRef}>
      <button
        type="button"
        className={cn(
          "w-full flex items-center justify-between px-3 py-1.5 text-left border rounded-xl shadow-sm transition-all outline-none text-xs font-semibold",
          dark 
            ? "bg-slate-900/60 border-slate-700 text-white hover:border-slate-600" 
            : "bg-slate-50 border-slate-200 text-slate-900 hover:border-slate-300"
        )}
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className="truncate">{topFilter}</span>
        <ChevronDown className={cn("h-3.5 w-3.5", dark ? "text-slate-500" : "text-slate-400")} />
      </button>
      {isOpen && (
        <div className={cn(
          "absolute z-10 w-full mt-2 rounded-xl border shadow-2xl overflow-hidden animate-in fade-in-80 zoom-in-95",
          dark ? "bg-[#0f1829] border-slate-800" : "bg-white border-slate-200"
        )}>
          <ul className="py-1">
            {options.map(option => (
              <li
                key={option}
                className={cn(
                  "flex items-center px-3 py-2 text-xs cursor-pointer select-none transition-colors",
                  dark ? "hover:bg-slate-800 text-slate-300 hover:text-white" : "hover:bg-slate-50 text-slate-600 hover:text-slate-900"
                )}
                onClick={() => {
                  setTopFilter(option);
                  setIsOpen(false);
                }}
              >
                <span className="flex items-center w-4 h-4 mr-2 justify-center flex-shrink-0">
                  {topFilter === option && <Check className="h-3.5 w-3.5 text-primary" />}
                </span>
                <span className="truncate">{option}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default function BotDashboardContent() {
  const { t } = useTranslation();
  const { mode } = useTheme();
  const dark = mode === "dark";
  const [topFilter, setTopFilter] = useState("Top 10");

  const card    = dark ? "bg-[#0f1829] border-slate-800" : "bg-white border-slate-200";
  const text    = dark ? "text-white"     : "text-slate-900";
  const sub     = dark ? "text-slate-400" : "text-slate-500";
  const grid    = dark ? "#1e293b" : "#f1f5f9";
  const axis    = dark ? "#64748b" : "#94a3b8";
  const tooltip = dark ? "bg-[#0f1829] border-slate-700 text-white" : "bg-white border-slate-200 text-slate-800";

  // Real Bot analytics — backend reads chatbot_chats/messages + automation_runs
  // + computes day-of-week × hour heatmap. The `topFilter` flows to the
  // backend so the popularity chart respects Top 5 / Top 10 / All.
  const { from, to } = useDateRange().rangeFor("bot");
  const { data } = useQuery<any>({
    queryKey: ["/api/statistics/bot-analytics", topFilter, from, to],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/statistics/bot-analytics?top=${encodeURIComponent(topFilter)}&from=${from}&to=${to}`);
      return res.json();
    },
    refetchInterval: 60_000,
  });

  const kpiData = data?.kpi ?? {
    botTriggered: 0,
    respondedByBot: 0,
    receivedByBot: 0,
    totalMessages: 0,
    escalatedToHuman: 0,
    avgSessionDuration: "0 hrs 0 mins",
  };

  const kpiCards = [
    { title: t("bot_dashboard_content.kpi_bot_triggered"), value: kpiData.botTriggered, unit: t("bot_dashboard_content.unit_sessions"), icon: <Bot size={14} />, color: "text-primary" },
    { title: t("bot_dashboard_content.kpi_responded_by_bot"), value: kpiData.respondedByBot, unit: t("bot_dashboard_content.unit_messages"), icon: <MessageSquare size={14} />, color: "text-emerald-500" },
    { title: t("bot_dashboard_content.kpi_received_by_bot"), value: kpiData.receivedByBot, unit: t("bot_dashboard_content.unit_messages"), icon: <Send size={14} />, color: "text-blue-500" },
    { title: t("bot_dashboard_content.kpi_total_messages"), value: kpiData.totalMessages, unit: t("bot_dashboard_content.unit_all_messages"), icon: <BarChart3 size={14} />, color: "text-violet-500" },
    { title: t("bot_dashboard_content.kpi_escalated_to_human"), value: kpiData.escalatedToHuman, unit: t("bot_dashboard_content.unit_escalations"), icon: <Users size={14} />, color: "text-rose-500" },
    { title: t("bot_dashboard_content.kpi_avg_session_duration"), value: kpiData.avgSessionDuration, unit: t("bot_dashboard_content.unit_per_session"), icon: <Clock size={14} />, color: "text-orange-500" },
  ];

  // Chart series sourced from the backend bot-analytics endpoint.
  const botVsHumanData: Array<{ date: string; triggered: number; escalated: number }> = data?.botVsHumanData ?? [];
  const popularityData: Array<{ name: string; sentiment: number }> = data?.popularityData ?? [];
  const busiestPeriodData: Array<{ time: string; [k: string]: number | string }> = data?.busiestPeriodData ?? [];

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
      <div className={cn("px-3 py-2 rounded-xl border shadow-2xl text-[11px]", tooltip)}>
        <p className="font-semibold mb-1 opacity-60">{label}</p>
        {payload.map((e: any, i: number) => (
          <div key={i} className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full" style={{ background: e.color || e.stroke || e.fill }} />
            <span className="opacity-70">{e.name}:</span>
            <span className="font-bold">{e.value}</span>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-5">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {kpiCards.map((kpi, i) => (
          <div key={i} className={cn("rounded-2xl border p-5 transition-all duration-300 hover:shadow-xl hover:-translate-y-1", card, dark ? "hover:border-primary/30" : "hover:border-primary/20")}>
            <div className="flex items-center gap-2.5 mb-3">
              <div className={cn("p-1.5 rounded-lg", dark ? "bg-slate-800" : "bg-slate-100", kpi.color)}>
                {kpi.icon}
              </div>
              <p className={cn("text-[11px] font-semibold truncate", sub)}>{kpi.title}</p>
            </div>
            <p className={cn("text-xl font-black tabular-nums", text)}>{kpi.value}</p>
            <p className={cn("text-[10px] font-medium opacity-60", sub)}>{kpi.unit}</p>
          </div>
        ))}
      </div>

      {/* Popularity of Interactions */}
      <div className={cn("rounded-2xl border p-5 transition-all duration-300 hover:shadow-xl", card)}>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className={cn("text-[13px] font-bold", text)}>{t("bot_dashboard_content.popularity_title")}</h3>
            <p className={cn("text-[11px]", sub)}>{t("bot_dashboard_content.popularity_subtitle")}</p>
          </div>
          <TopFilterDropdown topFilter={topFilter} setTopFilter={setTopFilter} />
        </div>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={popularityData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={grid} vertical={false} />
            <XAxis dataKey="name" tick={{ fontSize: 10, fill: axis }} axisLine={false} tickLine={false} angle={-45} textAnchor="end" height={60} />
            <YAxis tick={{ fontSize: 10, fill: axis }} axisLine={false} tickLine={false} />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: dark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.03)" }} />
            <Bar dataKey="sentiment" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name={t("bot_dashboard_content.legend_interactions")} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Bot vs Human Performance */}
        <div className={cn("rounded-2xl border p-5 transition-all duration-300 hover:shadow-xl", card)}>
          <h3 className={cn("text-[13px] font-bold mb-1", text)}>{t("bot_dashboard_content.bot_vs_human_title")}</h3>
          <p className={cn("text-[11px] mb-6", sub)}>{t("bot_dashboard_content.bot_vs_human_subtitle")}</p>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={botVsHumanData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={grid} />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: axis }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: axis }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} cursor={{ stroke: "#6366f1", strokeWidth: 1, strokeDasharray: "4 4" }} />
              <Legend wrapperStyle={{ fontSize: "11px", paddingTop: "12px" }} iconType="circle" />
              <Line type="monotone" dataKey="triggered" stroke="hsl(var(--primary))" strokeWidth={2.5} dot={false} name={t("bot_dashboard_content.legend_triggered")} activeDot={{ r: 4, fill: "hsl(var(--primary))", strokeWidth: 0 }} />
              <Line type="monotone" dataKey="escalated" stroke="#ef4444" strokeWidth={2.5} dot={false} name={t("bot_dashboard_content.legend_escalated_to_human")} activeDot={{ r: 4, fill: "#ef4444", strokeWidth: 0 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Busiest Period */}
        <div className={cn("rounded-2xl border p-5 transition-all duration-300 hover:shadow-xl", card)}>
          <h3 className={cn("text-[13px] font-bold mb-1", text)}>{t("bot_dashboard_content.busiest_period_title")}</h3>
          <p className={cn("text-[11px] mb-6", sub)}>{t("bot_dashboard_content.busiest_period_subtitle")}</p>
          <div className="h-[300px] overflow-hidden">
             <TimeHeatmap
                data={busiestPeriodData}
                days={["Thu", "Fri", "Sat", "Sun", "Mon", "Tue", "Wed"]}
                rowsPerTimeSlot={2}
                cellHeight={12}
                startDay={4}
                valueLabel={t("bot_dashboard_content.heatmap_value_label")}
              />
          </div>
        </div>
      </div>
    </div>
  );
}
