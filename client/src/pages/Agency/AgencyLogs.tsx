import React, { useState, useEffect } from 'react';
import { getUserInfo } from "@/lib/auth";
import {
  Calendar,
  Users,
  User,
  ChevronLeft,
  ChevronRight,
  Layers,
  ChevronDown,
  LogIn,
  UserPlus,
  UserCog,
  UserMinus,
  Ban,
  CheckCircle2,
  Trash2,
  Network,
  Pencil,
  ShieldCheck,
  Archive,
  RotateCcw,
  Palette,
  Wallet,
  Globe,
  Activity,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { getAvatarColor } from "@/lib/avatar-utils";

import { useTheme } from "@/contexts/ThemeContext";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { formatInWorkspaceTz, useAgencyTimezone } from "@/contexts/WorkspaceTimezoneContext";
import { useTranslation } from 'react-i18next';

// Maps each log event to a crisp, color-coded icon for the row badge.
const ACTION_ICONS: Record<string, { Icon: any; cls: string }> = {
  user_logged_in:          { Icon: LogIn,        cls: 'text-sky-500 bg-sky-500/10' },
  user_created:            { Icon: UserPlus,     cls: 'text-emerald-500 bg-emerald-500/10' },
  user_updated:            { Icon: UserCog,      cls: 'text-blue-500 bg-blue-500/10' },
  user_deleted:            { Icon: UserMinus,    cls: 'text-rose-500 bg-rose-500/10' },
  user_suspended:          { Icon: Ban,          cls: 'text-amber-500 bg-amber-500/10' },
  user_activated:          { Icon: CheckCircle2, cls: 'text-emerald-500 bg-emerald-500/10' },
  workspace_created:       { Icon: Network,      cls: 'text-violet-500 bg-violet-500/10' },
  workspace_updated:       { Icon: Pencil,       cls: 'text-blue-500 bg-blue-500/10' },
  workspace_suspended:     { Icon: Ban,          cls: 'text-amber-500 bg-amber-500/10' },
  workspace_activated:     { Icon: CheckCircle2, cls: 'text-emerald-500 bg-emerald-500/10' },
  workspace_deleted:       { Icon: Trash2,       cls: 'text-rose-500 bg-rose-500/10' },
  role_created:            { Icon: ShieldCheck,  cls: 'text-violet-500 bg-violet-500/10' },
  role_updated:            { Icon: ShieldCheck,  cls: 'text-blue-500 bg-blue-500/10' },
  role_archived:           { Icon: Archive,      cls: 'text-amber-500 bg-amber-500/10' },
  role_restored:           { Icon: RotateCcw,    cls: 'text-emerald-500 bg-emerald-500/10' },
  role_deleted:            { Icon: Trash2,       cls: 'text-rose-500 bg-rose-500/10' },
  branding_updated:        { Icon: Palette,      cls: 'text-fuchsia-500 bg-fuchsia-500/10' },
  billing_address_updated: { Icon: Wallet,       cls: 'text-teal-500 bg-teal-500/10' },
  agency_updated:          { Icon: Pencil,       cls: 'text-blue-500 bg-blue-500/10' },
  domain_added:            { Icon: Globe,        cls: 'text-indigo-500 bg-indigo-500/10' },
};

const LogIcon = ({ event }: { event?: string }) => {
  const { Icon, cls } = ACTION_ICONS[event ?? ''] ?? { Icon: Activity, cls: 'text-slate-400 bg-slate-400/10' };
  return (
    <div className={cn('w-7 h-7 rounded-lg flex items-center justify-center shrink-0', cls)}>
      <Icon size={14} />
    </div>
  );
};

const AgencyLogs = () => {
  const { t } = useTranslation();
  const { mode } = useTheme();
  const workspaceTz = useAgencyTimezone();
  const userInfo = getUserInfo();
  const agencyId = userInfo.modelable_id;

  const [selectedDate, setSelectedDate] = useState(t("agency.logs.filters.today"));
  const [selectedAgent, setSelectedAgent] = useState(t("agency.logs.filters.all_agents"));
  const [page, setPage] = useState(1);

  // Force hide all scrollbars for this page
  useEffect(() => {
    const targets: { el: HTMLElement; orig: string }[] = [];

    const hide = (el: HTMLElement | null) => {
      if (!el) return;
      targets.push({ el, orig: el.style.overflowY });
      el.style.overflowY = 'hidden';
    };

    hide(document.documentElement as HTMLElement);
    hide(document.body);

    let node = document.querySelector('main') as HTMLElement | null;
    while (node) {
      hide(node);
      node = node.parentElement as HTMLElement | null;
    }

    return () => {
      targets.forEach(({ el, orig }) => { el.style.overflowY = orig; });
    };
  }, []);

  const dateRanges = [
    t("agency.logs.filters.today"), 
    t("agency.logs.filters.yesterday"), 
    t("agency.logs.filters.last_7_days"), 
    t("agency.logs.filters.last_30_days")
  ];

  // Map selected date label → from/to query params for the API.
  const buildDateRange = (label: string): { from?: string; to?: string } => {
    const now = new Date();
    const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const endOfDay   = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
    if (label === t("agency.logs.filters.today")) {
      return { from: startOfDay(now).toISOString(), to: endOfDay(now).toISOString() };
    }
    if (label === t("agency.logs.filters.yesterday")) {
      const y = new Date(now); y.setDate(y.getDate() - 1);
      return { from: startOfDay(y).toISOString(), to: endOfDay(y).toISOString() };
    }
    if (label === t("agency.logs.filters.last_7_days")) {
      const s = new Date(now); s.setDate(s.getDate() - 7);
      return { from: startOfDay(s).toISOString(), to: endOfDay(now).toISOString() };
    }
    if (label === t("agency.logs.filters.last_30_days")) {
      const s = new Date(now); s.setDate(s.getDate() - 30);
      return { from: startOfDay(s).toISOString(), to: endOfDay(now).toISOString() };
    }
    return {};
  };

  // Members query is declared FIRST so resolveAgentUserId() inside the logs
  // queryFn can read it without temporal-dead-zone issues.
  const { data: membersResponse } = useQuery({
    queryKey: [`/api/organizations/${agencyId}/members`],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/organizations/${agencyId}/members`);
      return res.json();
    }
  });

  // Map selected agent email → user_id from the loaded members list.
  const resolveAgentUserId = (label: string): string | undefined => {
    if (label === t("agency.logs.filters.all_agents")) return undefined;
    const m = (membersResponse?.members || []).find((u: any) => u.email === label);
    return m?.id?.toString();
  };

  const { data: logsResponse, isLoading } = useQuery({
    queryKey: [`/api/organizations/${agencyId}/agency-logs`, selectedDate, selectedAgent, page],
    queryFn: async () => {
      const params = new URLSearchParams();
      const { from, to } = buildDateRange(selectedDate);
      if (from) params.set('from', from);
      if (to)   params.set('to', to);
      const userId = resolveAgentUserId(selectedAgent);
      if (userId) params.set('user_id', userId);
      params.set('page', String(page));
      const res = await apiRequest("GET", `/api/organizations/${agencyId}/agency-logs?${params.toString()}`);
      return res.json();
    },
    // Audit logs must reflect the latest activity every time the page is opened.
    // The global default is staleTime:Infinity, so force a refetch on mount.
    staleTime: 0,
    refetchOnMount: 'always',
  });

  const agents = [t("agency.logs.filters.all_agents"), ...(membersResponse?.members || []).map((m: any) => m.email)];
  const logs = logsResponse?.logs || [];
  const total = logsResponse?.total || 0;
  const perPage = logsResponse?.per_page || 20;
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const dark = mode === 'dark';

  const bg     = dark ? 'bg-[#0b1120]'  : 'bg-slate-50/80';
  const card   = dark ? 'bg-[#0f1829]'  : 'bg-white';
  const border = dark ? 'border-slate-800' : 'border-slate-200';
  const text   = dark ? 'text-white'    : 'text-slate-900';
  const sub    = dark ? 'text-slate-500' : 'text-slate-400';

  return (
    <div className={cn("h-screen overflow-hidden transition-colors flex flex-col font-sans", bg)}>
      
      {/* ── Header Card ── */}
      <div className={cn('px-8 py-5 border-b flex items-center justify-between', card, border)}>
        <div className="flex items-center gap-4">
          <div className={cn('p-2.5 rounded-xl shadow-sm', dark ? 'bg-primary/15' : 'bg-primary/10')}>
            <Layers className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className={cn('text-[15px] font-bold', text)}>{t("agency.logs.title")}</h1>
            <p className={cn('text-[11px] mt-0.5', sub)}>
              {total} total activities recorded
            </p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-hidden p-8">
        {/* Unified Main Card - Restricted height to match viewport and made compact */}
        <div className={cn("flex rounded-2xl border overflow-hidden shadow-sm h-full max-h-[calc(100vh-220px)]", card, border)}>
          
          {/* Right Section: Filters + Logs Table (full width — categories sidebar removed) */}
          <div className="flex-1 flex flex-col min-w-0">
            
            {/* Integrated Top Filters Bar */}
            <div className={cn("px-6 py-3 border-b flex items-center gap-8 transition-colors bg-slate-50/30 dark:bg-slate-900/10", border)}>
              {/* Date Filter */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <div className={cn("flex items-center gap-2 cursor-pointer hover:text-primary transition-colors", text)}>
                    <Calendar size={16} className="text-primary" />
                    <span className="text-[12px] font-bold">{selectedDate}</span>
                    <ChevronDown size={14} className="opacity-40" />
                  </div>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className={cn("w-48", dark ? "bg-[#1e293b] border-slate-700 text-white" : "")}>
                  {dateRanges.map((range) => (
                    <DropdownMenuItem key={range} onClick={() => { setSelectedDate(range); setPage(1); }} className="cursor-pointer text-[12px]">
                      {range}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Agent Filter */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <div className={cn("flex items-center gap-2 cursor-pointer hover:text-primary transition-colors", text)}>
                    <Users size={16} className="text-primary" />
                    <span className="text-[12px] font-bold">{selectedAgent}</span>
                    <ChevronDown size={14} className="opacity-40" />
                  </div>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className={cn("w-48", dark ? "bg-[#1e293b] border-slate-700 text-white" : "")}>
                  {agents.map((agent, idx) => (
                    <DropdownMenuItem key={agent} onClick={() => setSelectedAgent(agent)} className="cursor-pointer text-[12px] gap-2">
                      {idx === 0
                        ? <Users size={13} className="text-primary shrink-0" />
                        : <User size={13} className="text-slate-400 shrink-0" />}
                      {agent}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* Logs Table Area */}
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Table Headers */}
              <div className={cn("grid grid-cols-12 px-6 py-2.5 border-b transition-colors",
                dark ? "bg-slate-900/30 border-slate-800 text-slate-300" : "bg-slate-50/60 border-slate-100 text-slate-600")}>
                <div className="col-span-3 text-[10px] font-bold uppercase tracking-widest">{t("agency.logs.table.action_date")}</div>
                <div className="col-span-6 text-[10px] font-bold uppercase tracking-widest text-center">{t("agency.logs.table.action")}</div>
                <div className="col-span-3 text-[10px] font-bold uppercase tracking-widest text-right">{t("agency.logs.table.performed_by")}</div>
              </div>

              {/* Table Content */}
              <div className="flex-1 overflow-y-auto flex flex-col custom-scrollbar">
                {!isLoading && logs.length > 0 && (
                  <div className={cn("divide-y transition-colors", dark ? "divide-slate-800/50" : "divide-slate-50")}>
                    {logs.map((log: any, i: number) => {
                      const performer = log.user?.name || log.user?.email || "System";
                      return (
                      <div key={i} className={cn("group grid grid-cols-12 px-6 py-3.5 border-b last:border-0 transition-colors items-center",
                        dark ? "border-slate-800 hover:bg-slate-800/25" : "border-slate-100 hover:bg-slate-50/70")}>

                        <div className="col-span-3 flex items-center gap-3">
                          <LogIcon event={log.event} />
                          <div className={cn("text-[13px] font-medium truncate", dark ? "text-slate-300" : "text-slate-600")}>
                            {log.created_at ? formatInWorkspaceTz(log.created_at, "yyyy-MM-dd hh:mm a", workspaceTz) : "N/A"}
                          </div>
                        </div>

                        <div className={cn("col-span-6 text-[13px] text-center font-bold px-4", text)}>
                          {log.action || log.message}
                        </div>

                        <div className="col-span-3 text-right flex items-center justify-end gap-2 pr-1">
                          <div className={cn("text-[13px] font-bold truncate max-w-[140px]", dark ? "text-slate-400" : "text-slate-700")}>
                            {performer}
                          </div>
                          <Avatar className="w-7 h-7 shrink-0 border border-slate-100 dark:border-slate-800">
                            <AvatarFallback className={`${getAvatarColor(performer)} text-[10px] font-black`}>
                              {performer.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                        </div>
                      </div>
                      );
                    })}
                  </div>
                )}
                
                {!isLoading && logs.length === 0 && (
                  <div className="flex-1 flex flex-col items-center justify-center py-20 text-center">
                    <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center mb-3", dark ? "bg-slate-800" : "bg-slate-50")}>
                      <Layers className="w-6 h-6 text-slate-300" />
                    </div>
                    <p className={cn("text-[13px] font-bold", text)}>{t("agency.logs.table.empty")}</p>
                  </div>
                )}

                {isLoading && (
                  <div className="flex-1 flex items-center justify-center py-10">
                    <div className="flex items-center gap-2 text-slate-400 text-[13px] font-medium">
                      <div className="w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                      {t("agency.logs.table.loading")}
                    </div>
                  </div>
                )}
              </div>

              {/* Pagination Footer */}
              <div className={cn("flex items-center justify-between px-6 py-4 border-t transition-colors mt-auto", 
                dark ? "bg-slate-900/20 border-slate-800" : "bg-slate-50/30 border-slate-100")}>
                <span className={cn("text-[11px] font-medium", sub)}>
                  {t("agency.logs.pagination.showing", { start: logs.length === 0 ? 0 : 1, end: logs.length, total: total })}
                </span>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className={cn("p-1.5 transition-colors border rounded-lg", 
                      page === 1 ? "text-slate-300 border-slate-100 dark:border-slate-800" : "text-slate-500 border-slate-200 hover:text-primary hover:border-primary dark:border-slate-700")}>
                    <ChevronLeft size={14} />
                  </button>
                  <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary text-white text-[12px] font-bold shadow-sm">
                    {page}
                  </div>
                  <button 
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page >= totalPages}
                    className={cn("p-1.5 transition-colors border rounded-lg", 
                      page >= totalPages ? "text-slate-300 border-slate-100 dark:border-slate-800" : "text-slate-500 border-slate-200 hover:text-primary hover:border-primary dark:border-slate-700")}>
                    <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AgencyLogs;
