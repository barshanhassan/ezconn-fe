import React from 'react';
import { getUserInfo } from "@/lib/auth";
import {
  Network,
  Users,
  ShieldCheck,
  TrendingUp,
  CheckCircle2,
  Clock,
  Star,
  Building2,
  Activity,
  MessageSquare,
  MessagesSquare,
  PlusCircle,
  Timer,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useTheme } from "@/contexts/ThemeContext";
import { formatInWorkspaceTz, useAgencyTimezone } from "@/contexts/WorkspaceTimezoneContext";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useTranslation } from "react-i18next";

const AgencyDashboard = () => {
  const { mode } = useTheme();
  const [, setLocation] = useLocation();
  const dark = mode === "dark";
  const workspaceTz = useAgencyTimezone();
  const { t } = useTranslation();

  const userInfo = React.useMemo(() => {
    try { return getUserInfo(); } catch { return {}; }
  }, []);
  const agencyId = userInfo?.modelable_id;

  const { data: dashboardResponse, isLoading } = useQuery({
    queryKey: [`/api/organizations/${agencyId}/dashboard-stats`],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/organizations/${agencyId}/dashboard-stats`);
      return res.json();
    },
    retry: false,
  });

  const stats = dashboardResponse?.stats;
  const recentLogs = dashboardResponse?.recent_activity || [];

  const getGreeting = () => {
    const h = new Date().getHours();
    if (h < 12) return t("agency_dashboard.greeting_morning");
    if (h < 17) return t("agency_dashboard.greeting_afternoon");
    return t("agency_dashboard.greeting_evening");
  };

  const statCards = [
    {
      label: t("agency_dashboard.total_workspaces"),
      value: stats?.total_workspaces ?? 0,
      icon: <Network size={20} className="text-blue-500" />,
      bg: dark ? "bg-blue-500/10" : "bg-blue-50",
      color: "text-blue-600",
    },
    {
      label: t("agency_dashboard.team_members"),
      value: stats?.total_agents ?? 0,
      icon: <Users size={20} className="text-violet-500" />,
      bg: dark ? "bg-violet-500/10" : "bg-violet-50",
      color: "text-violet-600",
    },
    {
      label: t("agency_dashboard.support_seats"),
      value: stats?.premium_support_seats ?? "—",
      icon: <ShieldCheck size={20} className="text-emerald-500" />,
      bg: dark ? "bg-emerald-500/10" : "bg-emerald-50",
      color: "text-emerald-600",
    },
    {
      label: t("agency_dashboard.plan_status"),
      value: t("agency_dashboard.active"),
      icon: <TrendingUp size={20} className="text-orange-500" />,
      bg: dark ? "bg-orange-500/10" : "bg-orange-50",
      color: "text-orange-600",
    },
  ];

  // Format avg response time in minutes → "—", "Xm", or "Xh Ym".
  const formatResponseTime = (mins: number | undefined | null) => {
    if (!mins || mins <= 0) return "—";
    if (mins < 60) return `${mins}m`;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return m === 0 ? `${h}h` : `${h}h ${m}m`;
  };

  const metricCards = [
    {
      title: t("agency_dashboard.active_workspaces"),
      value: stats?.active_workspaces ?? 0,
      icon: <Activity size={20} className="text-emerald-500" />,
      bg: dark ? "bg-emerald-500/10" : "bg-emerald-50",
    },
    {
      title: t("agency_dashboard.total_users"),
      value: stats?.total_users ?? 0,
      icon: <Users size={20} className="text-violet-500" />,
      bg: dark ? "bg-violet-500/10" : "bg-violet-50",
    },
    {
      title: t("agency_dashboard.total_conversations"),
      value: stats?.total_conversations ?? 0,
      icon: <MessagesSquare size={20} className="text-indigo-500" />,
      bg: dark ? "bg-indigo-500/10" : "bg-indigo-50",
    },
    {
      title: t("agency_dashboard.open_conversations"),
      value: stats?.open_conversations ?? 0,
      icon: <MessageSquare size={20} className="text-orange-500" />,
      bg: dark ? "bg-orange-500/10" : "bg-orange-50",
    },
    {
      title: t("agency_dashboard.messages_sent_30d"),
      value: stats?.messages_sent_30d ?? 0,
      icon: <TrendingUp size={20} className="text-pink-500" />,
      bg: dark ? "bg-pink-500/10" : "bg-pink-50",
    },
    {
      title: t("agency_dashboard.new_workspaces_30d"),
      value: stats?.new_workspaces_30d ?? 0,
      icon: <PlusCircle size={20} className="text-teal-500" />,
      bg: dark ? "bg-teal-500/10" : "bg-teal-50",
    },
    {
      title: t("agency_dashboard.avg_response_time"),
      value: formatResponseTime(stats?.avg_response_time_minutes),
      icon: <Timer size={20} className="text-amber-500" />,
      bg: dark ? "bg-amber-500/10" : "bg-amber-50",
    },
  ];

  return (
    <div className={cn("min-h-screen p-6 transition-colors animate-in fade-in slide-in-from-bottom-4 duration-700 ease-out", dark ? "bg-[#0f172a] text-white" : "bg-slate-50 text-slate-900")}>

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold">
          {getGreeting()}, {userInfo?.first_name || t("agency_dashboard.user_fallback")}! 👋
        </h1>
        <p className={cn("text-sm mt-1", dark ? "text-slate-400" : "text-slate-500")}>
          {t("agency_dashboard.welcome_back")}
        </p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {statCards.map((card, i) => (
          <div key={i} className={cn(
            "rounded-xl p-5 border transition-all hover:shadow-md",
            dark ? "bg-[#1e293b] border-slate-800" : "bg-white border-slate-200"
          )}>
            <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center mb-3", card.bg)}>
              {card.icon}
            </div>
            <p className={cn("text-[12px] font-medium mb-1", dark ? "text-slate-400" : "text-slate-500")}>{card.label}</p>
            <p className={cn("text-2xl font-bold", dark ? "text-white" : "text-slate-900")}>
              {isLoading ? <span className="text-slate-300 text-base">{t("agency_dashboard.loading")}</span> : card.value}
            </p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

        {/* Left: Organization Metrics */}
        <div className="xl:col-span-2 space-y-6">
          <h2 className="text-base font-semibold">{t("agency_dashboard.organization_metrics")}</h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {metricCards.map((m, i) => (
              <div
                key={i}
                className={cn(
                  "rounded-xl p-5 border transition-all hover:shadow-md",
                  dark ? "bg-[#1e293b] border-slate-800" : "bg-white border-slate-200"
                )}
              >
                <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center mb-3", m.bg)}>
                  {m.icon}
                </div>
                <p className={cn("text-[12px] font-medium mb-1", dark ? "text-slate-400" : "text-slate-500")}>{m.title}</p>
                <p className={cn("text-2xl font-bold", dark ? "text-white" : "text-slate-900")}>
                  {isLoading ? <span className="text-slate-300 text-base">{t("agency_dashboard.loading")}</span> : m.value}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Right: Plan + Quick Actions + Activity */}
        <div className="space-y-5">

          {/* Plan Card */}
          <div className="rounded-xl p-6 bg-gradient-to-br from-blue-600 to-violet-600 text-white">
            <div className="flex items-center gap-1.5 mb-1">
              <Star size={13} className="fill-white/60 text-white/60" />
              <span className="text-[11px] font-bold uppercase tracking-widest text-white/60">{t("agency_dashboard.organization_plan")}</span>
            </div>
            <h3 className="text-xl font-bold mb-1">{t("agency_dashboard.professional")}</h3>
            <p className="text-[12px] text-white/60 mb-5">{t("agency_dashboard.next_billing", { date: "June 15, 2026" })}</p>

            <div className="space-y-2 mb-5">
              <div className="flex justify-between text-[12px]">
                <span className="text-white/70">{t("agency_dashboard.workspaces_label")}</span>
                <span className="font-semibold">{stats?.total_workspaces || 0} / 50</span>
              </div>
              <div className="h-1.5 bg-white/20 rounded-full overflow-hidden">
                <div
                  className="h-full bg-white rounded-full"
                  style={{ width: `${Math.min(((stats?.total_workspaces || 0) / 50) * 100, 100)}%` }}
                />
              </div>
              <div className="flex justify-between text-[12px]">
                <span className="text-white/70">{t("agency_dashboard.team_members")}</span>
                <span className="font-semibold">{stats?.total_agents || 0} / 100</span>
              </div>
              <div className="h-1.5 bg-white/20 rounded-full overflow-hidden">
                <div
                  className="h-full bg-white rounded-full"
                  style={{ width: `${Math.min(((stats?.total_agents || 0) / 100) * 100, 100)}%` }}
                />
              </div>
            </div>

            <button
              onClick={() => setLocation('/org/billing/plans')}
              className="w-full py-2 rounded-lg bg-white text-blue-600 text-[13px] font-bold hover:bg-blue-50 transition-colors"
            >
              {t("agency_dashboard.upgrade_enterprise")}
            </button>
          </div>

          {/* Recent Activity */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-semibold">{t("agency_dashboard.recent_activity")}</h2>
              <span className="flex items-center gap-1 text-[11px] text-emerald-500 font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                {t("agency_dashboard.live")}
              </span>
            </div>
            <div className={cn("rounded-xl border overflow-hidden", dark ? "bg-[#1e293b] border-slate-800" : "bg-white border-slate-200")}>
              {isLoading ? (
                <div className="p-4 space-y-3">
                  {[1,2,3].map(i => (
                    <div key={i} className="h-4 bg-slate-100 dark:bg-slate-800 rounded animate-pulse" />
                  ))}
                </div>
              ) : recentLogs.length === 0 ? (
                <div className="p-6 text-center text-sm text-slate-400">{t("agency_dashboard.no_recent_activity")}</div>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {recentLogs.slice(0, 5).map((log: any, i: number) => (
                    <div key={i} className="flex items-start gap-3 p-3">
                      <div className="w-7 h-7 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center shrink-0 mt-0.5">
                        <CheckCircle2 size={13} className="text-blue-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={cn("text-[12px] font-medium truncate", dark ? "text-slate-300" : "text-slate-700")}>
                          {log.action} <span className="font-semibold">{log.target}</span>
                        </p>
                        <p className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                          <Clock size={10} />
                          {log.time ? formatInWorkspaceTz(log.time, "M/d/yyyy", workspaceTz) : "—"}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default AgencyDashboard;
