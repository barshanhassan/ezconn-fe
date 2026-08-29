import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip, AreaChart, Area } from "recharts";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { apiRequest } from "@/lib/queryClient";
import { Loader2, Users, UserPlus, BarChart2, Cpu } from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";
import { cn } from "@/lib/utils";

// Utility function to abbreviate large numbers
const abbreviateNumber = (num: number): string => {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + "M";
  if (num >= 1000) return (num / 1000).toFixed(1) + "K";
  return num.toString();
};

// Utility function to format percentage
const formatPercentage = (num: number): string => num.toFixed(1) + "%";

// Format the period-over-period delta with a leading sign so the badge's
// `startsWith('+')` color logic still distinguishes positive vs negative
// growth. Zero is shown as "0%" (neutral, treated as not green by the badge).
const formatDelta = (num: number): string => {
  if (num > 0) return `+${num.toFixed(1)}%`;
  if (num < 0) return `${num.toFixed(1)}%`;
  return "0%";
};

// Custom tooltip for charts
const CustomTooltip = ({ active, payload, label, isStickinessChart, dark }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className={cn(
        "px-2.5 py-1.5 rounded-lg border shadow-xl text-[10px] font-bold",
        dark ? "bg-[#0f1829] border-slate-700 text-white" : "bg-white border-slate-200 text-slate-800"
      )}>
        <p className="mb-0.5 opacity-60">{label}</p>
        <p className="text-blue-500">
          {isStickinessChart ? `${payload[0].value}%` : abbreviateNumber(payload[0].value)}
        </p>
      </div>
    );
  }
  return null;
};

export default function OverviewTab() {
  const { t } = useTranslation();
  const { mode } = useTheme();
  const dark = mode === "dark";

  const card   = dark ? "bg-[#0f1829] border-slate-800" : "bg-white border-slate-200";
  const text   = dark ? "text-white" : "text-slate-900";
  const sub    = dark ? "text-slate-400" : "text-slate-500";
  const divider = dark ? "border-slate-800" : "border-slate-100";
  const gridColor = dark ? "#1e293b" : "#f1f5f9";
  const axisColor = dark ? "#64748b" : "#94a3b8";

  // KPIs refresh every 60s, charts every 5 min — matches replyagent's "Real-time"
  // label while keeping query load reasonable for fresh workspaces.
  const { data: statsData, isLoading } = useQuery({
    queryKey: ["/api/statistics/statistics-v1"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/statistics/statistics-v1");
      return res.json();
    },
    refetchInterval: 60_000,
  });

  // Workspace-scoped time-series (DAU/MAU/WAU/Stickiness). Backend filters
  // by workspace_id so a fresh workspace returns zero-valued buckets — which
  // is the correct empty state, not the mock hump it used to show.
  const { data: chartsData } = useQuery({
    queryKey: ["/api/statistics/dashboard-charts"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/statistics/dashboard-charts");
      return res.json();
    },
    refetchInterval: 300_000,
  });

  // Real New Users counts + period-over-period delta (replaces the hardcoded
  // +2.5% / -1.2% / +5.8% badges). Backend derives from contacts.created_at.
  const { data: newUsersData } = useQuery<any>({
    queryKey: ["/api/statistics/new-users"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/statistics/new-users");
      return res.json();
    },
    refetchInterval: 60_000,
  });

  // Real workspace info for the Agent Capacity card (replaces hardcoded mock).
  const { data: workspaceData } = useQuery<any>({
    queryKey: ["/api/workspaces/current"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/workspaces/current");
      return res.json();
    },
    refetchInterval: 60_000,
  });

  const { data: membersData } = useQuery<any>({
    queryKey: ["/api/workspaces/members"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/workspaces/members");
      return res.json();
    },
    refetchInterval: 60_000,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-16">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const stats = statsData || {};
  const contacts = stats.contacts || { by_status: {}, by_source: {}, total: 0 };
  const channels = stats.channels || {};

  // Agent Capacity (real workspace data, not mocks)
  // - activeAgents = current workspace member count (incl. owner)
  // - totalSeats   = workspace.agents_limit (0/null = unlimited)
  const activeAgentsCount = Array.isArray(membersData) ? membersData.length : 0;
  const agentsLimitRaw = Number(workspaceData?.agents_limit ?? 0);
  const totalSeatsCount = agentsLimitRaw > 0 ? agentsLimitRaw : activeAgentsCount;
  const isUnlimitedSeats = agentsLimitRaw <= 0;

  // Contacts limit (real workspace data — Plan Usage card)
  const contactsLimitRaw = Number(workspaceData?.maximum_contacts ?? 0);
  const contactsLimitActive = Boolean(workspaceData?.limited_contacts) && contactsLimitRaw > 0;

  // Stickiness: take last bucket from the time-series the backend computed.
  // Earlier this was hardcoded to 0; now it reflects DAU/MAU * 100.
  const stickinessFromSeries = Array.isArray(chartsData?.stickinessData) && chartsData.stickinessData.length > 0
    ? chartsData.stickinessData[chartsData.stickinessData.length - 1].ratio ?? 0
    : 0;

  const kpiData = {
    activeToday: contacts.by_status.active || 0,
    activeWeek: contacts.total || 0,
    activeMonth: contacts.total || 0,
    totalUsers: contacts.total || 0,
    stickiness: stickinessFromSeries,
    // ─── New Users — real values from /api/statistics/new-users ──────────
    dailyNewUsers: newUsersData?.daily ?? 0,
    dailyNewUsersChange: newUsersData?.dailyChange ?? 0,
    weeklyNewUsers: newUsersData?.weekly ?? 0,
    weeklyNewUsersChange: newUsersData?.weeklyChange ?? 0,
    monthlyNewUsers: newUsersData?.monthly ?? 0,
    monthlyNewUsersChange: newUsersData?.monthlyChange ?? 0,
    currentMAU: contacts.total || 0,
    mauLimit: contactsLimitActive ? contactsLimitRaw : 0,
    activeAgents: activeAgentsCount,
    totalSeats: totalSeatsCount,
  };

  const mauUsagePercentage = contactsLimitActive && kpiData.mauLimit > 0
    ? (kpiData.currentMAU / kpiData.mauLimit) * 100
    : 0;
  const agentUtilizationPercentage = kpiData.totalSeats > 0
    ? (kpiData.activeAgents / kpiData.totalSeats) * 100
    : 0;

  // All chart data now comes from the backend, scoped to the current
  // workspace via JWT. A brand-new workspace returns all-zero buckets.
  const dauData: Array<{ day: string; users: number }> = chartsData?.dauData ?? [];
  const mauData: Array<{ month: string; users: number }> = chartsData?.mauData ?? [];
  const wauData: Array<{ week: string; users: number }> = chartsData?.wauData ?? [];
  const stickinessData: Array<{ day: string; ratio: number }> = chartsData?.stickinessData ?? [];

  const kpiCards = [
    {
      title: t("overview_tab.user_activity"),
      icon: <Users size={15} className="text-primary" />,
      rows: [
        { label: t("overview_tab.active_today"), value: abbreviateNumber(kpiData.activeToday) },
        { label: t("overview_tab.active_week"),  value: abbreviateNumber(kpiData.activeWeek) },
        { label: t("overview_tab.active_month"), value: abbreviateNumber(kpiData.activeMonth) },
        { label: t("overview_tab.total_users"),  value: abbreviateNumber(kpiData.totalUsers) },
        { label: t("overview_tab.stickiness"),   value: formatPercentage(kpiData.stickiness), border: true },
      ],
    },
    {
      title: t("overview_tab.new_users"),
      icon: <UserPlus size={15} className="text-primary" />,
      rows: [
        // Sign + format the delta so the existing badge color logic still
        // works (badge.startsWith('+') for green vs red).
        { label: t("overview_tab.daily"),   badge: formatDelta(kpiData.dailyNewUsersChange),   value: abbreviateNumber(kpiData.dailyNewUsers) },
        { label: t("overview_tab.weekly"),  badge: formatDelta(kpiData.weeklyNewUsersChange),  value: abbreviateNumber(kpiData.weeklyNewUsers) },
        { label: t("overview_tab.monthly"), badge: formatDelta(kpiData.monthlyNewUsersChange), value: abbreviateNumber(kpiData.monthlyNewUsers) },
      ],
    },
    {
      title: t("overview_tab.plan_usage"),
      icon: <BarChart2 size={15} className="text-primary" />,
      rows: [
        { label: t("overview_tab.current_mau"), value: abbreviateNumber(kpiData.currentMAU) },
        { label: t("overview_tab.mau_limit"),   value: contactsLimitActive ? abbreviateNumber(kpiData.mauLimit) : t("overview_tab.unlimited") },
        { label: t("overview_tab.usage"),       value: contactsLimitActive ? formatPercentage(mauUsagePercentage) : "—" },
      ],
      progress: mauUsagePercentage,
    },
    {
      title: t("overview_tab.agent_capacity"),
      icon: <Cpu size={15} className="text-primary" />,
      rows: [
        { label: t("overview_tab.active_agents"), value: abbreviateNumber(kpiData.activeAgents) },
        { label: t("overview_tab.total_seats"),   value: isUnlimitedSeats ? t("overview_tab.unlimited") : abbreviateNumber(kpiData.totalSeats) },
        { label: t("overview_tab.utilization"),   value: isUnlimitedSeats ? "—" : formatPercentage(agentUtilizationPercentage) },
      ],
      progress: agentUtilizationPercentage,
    },
  ];

  return (
    <div className="space-y-4">
      {/* ── Row 1: KPI Cards (Restored Detailed Version) ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpiCards.map((kpi, idx) => (
          <div
            key={idx}
            className={cn(
              "rounded-xl border p-5 transition-all duration-300 hover:shadow-xl hover:-translate-y-1 animate-in fade-in slide-in-from-bottom-2",
              card
            )}
            style={{ animationDelay: `${idx * 80}ms`, animationFillMode: 'both' }}
          >
            {/* Card Header */}
            <div className="flex items-center gap-2.5 mb-4">
              <div className="p-2 rounded-xl bg-primary/10">
                {kpi.icon}
              </div>
              <h3 className={cn("text-[13px] font-bold tracking-tight", text)}>{kpi.title}</h3>
            </div>

            {/* Rows */}
            <div className="space-y-2">
              {kpi.rows.map((row: any, rIdx: number) => (
                <div
                  key={rIdx}
                  className={cn(
                    "flex items-center justify-between",
                    row.border && `pt-2 border-t ${divider}`
                  )}
                >
                  <div className="flex items-center gap-1.5">
                    <span className={cn("text-[11px] font-medium opacity-70", sub)}>{row.label}</span>
                    {row.badge && (
                      <span className={cn(
                        "text-[9px] font-bold px-1.5 py-0.5 rounded-full",
                        row.badge.startsWith('+') ? "text-emerald-500 bg-emerald-500/10" : "text-rose-500 bg-rose-500/10"
                      )}>
                        {row.badge}
                      </span>
                    )}
                  </div>
                  <span className={cn("text-[12px] font-bold tabular-nums", text)}>{row.value}</span>
                </div>
              ))}
            </div>

            {/* Progress Bar */}
            {kpi.progress !== undefined && (
              <div className="mt-4">
                <div className={cn("w-full rounded-full h-1.5", dark ? "bg-slate-800" : "bg-slate-100")}>
                  <div
                    className="bg-primary h-1.5 rounded-full transition-all shadow-sm shadow-primary/30"
                    style={{ width: `${Math.min(kpi.progress, 100)}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* ── Row 2: Main Charts ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {[
          { title: t("overview_tab.daily_active_users"), data: dauData, xKey: "day", yKey: "users", color: "#3b82f6" },
          { title: t("overview_tab.monthly_active_users"), data: mauData, xKey: "month", yKey: "users", color: "#8b5cf6" },
        ].map((chart, idx) => (
          <div key={idx} className={cn("rounded-xl border p-4 transition-all duration-300 hover:shadow-md animate-in fade-in slide-in-from-bottom-2", card)}>
            <div className="flex items-center justify-between mb-4">
              <h3 className={cn("text-[12px] font-bold tracking-tight", text)}>{chart.title}</h3>
              <div className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 opacity-60">{t("overview_tab.real_time")}</div>
            </div>
            <ResponsiveContainer width="100%" height={160}>
              <AreaChart data={chart.data} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
                <defs>
                  <linearGradient id={`grad-${idx}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={chart.color} stopOpacity={0.25}/>
                    <stop offset="95%" stopColor={chart.color} stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
                <XAxis dataKey={chart.xKey} tick={{ fontSize: 9, fill: axisColor }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 9, fill: axisColor }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip dark={dark} />} />
                <Area 
                  type="monotone" 
                  dataKey={chart.yKey} 
                  stroke={chart.color} 
                  strokeWidth={2.5} 
                  fillOpacity={1} 
                  fill={`url(#grad-${idx})`} 
                  isAnimationActive={true}
                  animationDuration={1500}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        ))}
      </div>

      {/* ── Row 3: Secondary Charts ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {[
          { title: t("overview_tab.weekly_growth"), data: wauData, xKey: "week", yKey: "users", color: "#10b981" },
          { title: t("overview_tab.stickiness_ratio"), data: stickinessData, xKey: "day", yKey: "ratio", color: "#f59e0b", isStickiness: true },
        ].map((chart, idx) => (
          <div key={idx} className={cn("rounded-xl border p-4 transition-all duration-300 hover:shadow-md animate-in fade-in slide-in-from-bottom-2", card)}>
            <div className="flex items-center justify-between mb-4">
              <h3 className={cn("text-[12px] font-bold tracking-tight", text)}>{chart.title}</h3>
              <div className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 opacity-60">{t("overview_tab.last_30_days")}</div>
            </div>
            <ResponsiveContainer width="100%" height={160}>
              <AreaChart data={chart.data} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
                <defs>
                  <linearGradient id={`grad-sec-${idx}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={chart.color} stopOpacity={0.25}/>
                    <stop offset="95%" stopColor={chart.color} stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
                <XAxis dataKey={chart.xKey} tick={{ fontSize: 9, fill: axisColor }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 9, fill: axisColor }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip dark={dark} isStickinessChart={chart.isStickiness} />} />
                <Area 
                  type="monotone" 
                  dataKey={chart.yKey} 
                  stroke={chart.color} 
                  strokeWidth={2.5} 
                  fillOpacity={1} 
                  fill={`url(#grad-sec-${idx})`} 
                  isAnimationActive={true}
                  animationDuration={1500}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        ))}
      </div>
    </div>
  );
}
