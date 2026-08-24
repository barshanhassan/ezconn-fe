import React, { useState, useEffect } from 'react';
import { getUserInfo } from "@/lib/auth";
import { Card, CardContent } from "@/components/ui/card";
import {
  Network,
  Plus,
  Search,
  ExternalLink,
  MoreHorizontal,
  ChevronDown,
  Monitor,
  BarChart3,
  Wallet,
  Ban,
  Trash2,
  Filter,
  LogIn,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useTheme } from "@/contexts/ThemeContext";
import { formatInWorkspaceTz } from "@/contexts/WorkspaceTimezoneContext";
import { cn } from "@/lib/utils";
import CreateWorkspaceForm from "./CreateWorkspaceForm";
import WorkspaceUsageView from "./WorkspaceUsageView";
import AgencyVoiceWallet from "./AgencyVoiceWallet";

const AVATAR_COLORS = [
  "from-violet-500 to-purple-700",
  "from-blue-500 to-cyan-600",
  "from-emerald-500 to-teal-700",
  "from-orange-500 to-amber-600",
  "from-rose-500 to-pink-700",
  "from-indigo-500 to-blue-700",
  "from-fuchsia-500 to-violet-700",
  "from-teal-500 to-green-700",
  "from-yellow-500 to-orange-600",
  "from-sky-500 to-indigo-600",
];

const getAvatarColor = (id: string | number) => {
  const index = Number(id) % AVATAR_COLORS.length;
  return AVATAR_COLORS[index];
};

// How many workspace cards to reveal initially, and per "Show more" click.
const PAGE_SIZE = 8;

const AgencyWorkspaces = () => {
  const { mode } = useTheme();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const dark = mode === "dark";
  const bg     = dark ? 'bg-[#0b1120]'  : 'bg-slate-50/80';
  const card   = dark ? 'bg-[#0f1829]'  : 'bg-white';
  const border = dark ? 'border-slate-800' : 'border-slate-200';
  const text   = dark ? 'text-white'    : 'text-slate-900';
  const sub    = dark ? 'text-slate-500' : 'text-slate-400';

  const [viewMode, setViewMode] = useState<'LIST' | 'CREATE' | 'EDIT' | 'USAGE' | 'VOICE_WALLET'>('LIST');
  const [selectedWorkspace, setSelectedWorkspace] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest');
  const [showInactive, setShowInactive] = useState(false);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');

  // Reset the "Show more" reveal whenever the filtered set changes, so the list
  // doesn't stay expanded after a new search/filter narrows the results.
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [searchQuery, showInactive, sortOrder]);

  const userInfo = React.useMemo(() => {
    try { return getUserInfo(); } catch { return {}; }
  }, []);
  const agencyId = userInfo.modelable_id;

  const { data: workspacesResponse, isLoading } = useQuery({
    queryKey: [`/api/organizations/${agencyId}/workspaces`],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/organizations/${agencyId}/workspaces`);
      return res.json();
    },
    enabled: !!agencyId
  });

  const workspaces = (workspacesResponse?.workspaces || []).map((ws: any) => ({
    ...ws, // keep all raw fields (agency_agent_id, timezone, limits, etc.) so the edit form can pre-fill
    id: ws.id,
    name: ws.name,
    createdAt: ws.created_at
      ? formatInWorkspaceTz(ws.created_at, "MMM dd, yyyy", ws.timezone || "UTC")
      : ws.updated_at
      ? formatInWorkspaceTz(ws.updated_at, "MMM dd, yyyy", ws.timezone || "UTC")
      : formatInWorkspaceTz(new Date(), "MMM dd, yyyy", ws.timezone || "UTC"),
    _ts: ws.created_at
      ? new Date(ws.created_at).getTime()
      : ws.updated_at
      ? new Date(ws.updated_at).getTime()
      : 0,
    status: (ws.status === 'active' || ws.status === 'ACTIVE') ? 'Active' : 'Suspended',
    hasLogin: true,
  }));

  const [localWorkspaces, setLocalWorkspaces] = useState<any[]>([]);
  useEffect(() => {
    if (workspaces.length > 0) setLocalWorkspaces(workspaces);
  }, [workspacesResponse]);

  const displayWorkspaces = localWorkspaces.length > 0 ? localWorkspaces : workspaces;
  const filteredWorkspaces = displayWorkspaces
    .filter((ws: any) =>
      ws.name.toLowerCase().includes(searchQuery.toLowerCase()) &&
      (showInactive ? ws.status !== 'Active' : ws.status === 'Active')
    )
    .sort((a: any, b: any) =>
      sortOrder === 'newest' ? b._ts - a._ts : a._ts - b._ts
    );

  // Only render up to visibleCount; "Show more" reveals the next PAGE_SIZE.
  const visibleWorkspaces = filteredWorkspaces.slice(0, visibleCount);
  const hasMore = filteredWorkspaces.length > visibleCount;

  const toggleStatusMutation = useMutation({
    mutationFn: async (workspace: any) => {
      const isActive = workspace.status === 'Active';
      const res = await apiRequest("POST", `/api/organizations/${agencyId}/workspaces/${workspace.id}/${isActive ? 'suspend' : 'activate'}`);
      return res.json();
    },
    onSuccess: (_, workspace) => {
      const newStatus = workspace.status === 'Active' ? 'Suspended' : 'Active';
      setLocalWorkspaces(prev => prev.map(ws => ws.id === workspace.id ? { ...ws, status: newStatus } : ws));
      toast({ title: `Workspace ${newStatus}` });
      queryClient.invalidateQueries({ queryKey: [`/api/organizations/${agencyId}/workspaces`] });
    },
  });

  const loginToWorkspaceMutation = useMutation({
    mutationFn: async (workspace: any) => {
      const res = await apiRequest("POST", `/auth/workspaces/${workspace.id}/login`);
      return res.json();
    },
    onSuccess: (data) => {
      // This workspace has its OWN assigned agent (not the caller) — don't
      // silently enter under the agency owner's identity, send them to that
      // workspace's real login page so the right person signs in.
      if (data.requires_login) {
        if (data.workspace_url) {
          window.open(`${data.workspace_url}/login`, '_blank', 'noopener');
        } else {
          toast({
            title: "This workspace has its own login",
            description: "It's assigned to a specific agent — ask them to log in, or use its login page directly.",
          });
        }
        return;
      }
      const next = data.redirect_to || '/workspace';
      if (data.workspace_url) {
        // The workspace has its own subdomain — open it in a NEW TAB and hand
        // the workspace-scoped token off via the URL fragment (SsoHandoffPage
        // reads it there). We intentionally do NOT overwrite this agency tab's
        // token, so the agency session stays intact here.
        const url = `${data.workspace_url}/sso#token=${encodeURIComponent(data.token)}&next=${encodeURIComponent(next)}`;
        window.open(url, '_blank', 'noopener');
      } else {
        // Legacy fallback (workspace has no subdomain yet): same-tab login.
        localStorage.setItem("auth_token", data.token);
        localStorage.setItem("user_info", JSON.stringify(data.user));
        window.location.href = next;
      }
    },
    onError: (error: any) => {
      toast({
        title: "Login failed",
        description: error?.message || "Could not log into this workspace",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (workspace: any) => {
      const res = await apiRequest("DELETE", `/api/organizations/${agencyId}/workspaces/${workspace.id}`);
      return res.json();
    },
    onSuccess: (_, workspace) => {
      setLocalWorkspaces(prev => prev.filter(ws => ws.id !== workspace.id));
      toast({ title: "Workspace permanently deleted" });
      queryClient.invalidateQueries({ queryKey: [`/api/organizations/${agencyId}/workspaces`] });
      setConfirmDeleteId(null);
    },
    onError: (error: any) => {
      toast({ title: "Delete failed", description: error.message || "Please try again.", variant: "destructive" });
      setConfirmDeleteId(null);
    },
  });

  if (viewMode === 'VOICE_WALLET') {
    return <AgencyVoiceWallet workspace={selectedWorkspace} onBack={() => { setViewMode('LIST'); setSelectedWorkspace(null); }} />;
  }
  if (viewMode === 'CREATE' || viewMode === 'EDIT') {
    return <CreateWorkspaceForm onCancel={() => { setViewMode('LIST'); setSelectedWorkspace(null); }} initialData={selectedWorkspace} />;
  }
  if (viewMode === 'USAGE') {
    return <WorkspaceUsageView workspace={selectedWorkspace} onBack={() => { setViewMode('LIST'); setSelectedWorkspace(null); }} />;
  }

  return (
    <div className={cn("min-h-screen flex flex-col font-sans transition-all duration-300", bg)}>
      
      {/* ── Header ── (Matched with Team) */}
      <div className={cn("px-8 py-5 border-b flex items-center justify-between transition-colors", card, border)}>
        <div className="flex items-center gap-4">
          <div className={cn("p-2.5 rounded-xl shadow-sm", dark ? "bg-primary/15" : "bg-primary/10")}>
            <Network className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className={cn("text-[15px] font-bold tracking-tight", text)}>Workspaces</h1>
            <p className={cn("text-[11px] mt-0.5", sub)}>
              {filteredWorkspaces.length} total · {filteredWorkspaces.filter((ws: any) => ws.status === 'Active').length} active
            </p>
          </div>
        </div>
        <button 
          onClick={() => setViewMode('CREATE')}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-[12px] font-semibold bg-primary hover:opacity-90 text-primary-foreground transition-colors shadow-sm"
        >
          <Plus size={14} /> Add Workspace
        </button>
      </div>

      {/* ── Search & Filter Bar ── (Matched with Team) */}
      <div className={cn("px-8 py-3 border-b flex items-center justify-between gap-4", card, border)}>
        <div className="relative w-full max-w-xs group">
          <Search className={cn("absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 transition-colors", sub)} />
          <input
            placeholder="Search workspaces..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={cn(
              "pl-9 pr-3 h-8 w-full text-[12px] rounded-lg border outline-none transition-colors",
              dark
                ? "bg-slate-900/60 border-slate-700 text-white placeholder:text-slate-500 focus:border-slate-600"
                : "bg-slate-50 border-slate-200 text-slate-900 placeholder:text-slate-400 focus:border-slate-300"
            )}
          />
        </div>

        <div className="flex items-center gap-4">
            <label className={cn("flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest cursor-pointer transition-opacity", dark ? "text-slate-400" : "text-slate-600")}>
              <Checkbox checked={showInactive} onCheckedChange={(v) => setShowInactive(v === true)} className="border-slate-300 w-3.5 h-3.5 data-[state=checked]:bg-primary data-[state=checked]:border-primary" />
              Show Inactive
            </label>
            <DropdownMenu>
              <DropdownMenuTrigger className={cn("flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest outline-none transition-opacity", dark ? "text-slate-400" : "text-slate-600")}>
                {sortOrder === 'newest' ? 'Newest first' : 'Oldest first'} <ChevronDown size={12} />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className={cn("w-40 rounded-xl border shadow-2xl p-1", dark ? "bg-[#0f1829] border-slate-800 text-white" : "")}>
                <DropdownMenuItem onClick={() => setSortOrder('newest')} className="rounded-lg py-2 font-bold text-[11px] cursor-pointer">Newest first</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSortOrder('oldest')} className="rounded-lg py-2 font-bold text-[11px] cursor-pointer">Oldest first</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-8 custom-scrollbar pb-24">
        <div className="max-w-[1400px] mx-auto">

          {/* ── Card Grid Area ── */}
          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className={cn("h-72 rounded-2xl border animate-pulse", card, border)}>
                  <div className="flex flex-col items-center p-8 space-y-4">
                    <div className={cn("w-16 h-16 rounded-full", dark ? "bg-slate-800" : "bg-slate-200")} />
                    <div className={cn("h-4 w-32 rounded", dark ? "bg-slate-800" : "bg-slate-200")} />
                    <div className={cn("h-3 w-24 rounded", dark ? "bg-slate-800/60" : "bg-slate-100")} />
                    <div className={cn("h-3 w-20 rounded", dark ? "bg-slate-800/60" : "bg-slate-100")} />
                  </div>
                </div>
              ))}
            </div>
          ) : filteredWorkspaces.length === 0 ? (
            <div className={cn("rounded-2xl border p-20 flex flex-col items-center justify-center", card, border)}>
              <div className={cn("w-16 h-16 rounded-2xl flex items-center justify-center mb-4", dark ? "bg-slate-800" : "bg-slate-100")}>
                <Network className="w-8 h-8 text-slate-400" />
              </div>
              <p className={cn("text-[15px] font-bold mb-1", text)}>No Workspaces Found</p>
              <p className={cn("text-[12px]", sub)}>Try adjusting your search query or add a new workspace</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {visibleWorkspaces.map((ws: any) => (
                <div
                  key={ws.id}
                  className={cn(
                    "group relative flex flex-col items-center p-6 rounded-2xl border transition-all duration-300 hover:shadow-xl hover:-translate-y-1",
                    card, border,
                    dark ? "hover:border-primary/30" : "hover:border-primary/20"
                  )}
                >
                  {/* Inline delete confirmation — overlays this card only */}
                  {confirmDeleteId === ws.id && (
                    <div className={cn(
                      "absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 rounded-2xl p-5 backdrop-blur-sm",
                      dark ? "bg-[#0f1829]/95" : "bg-white/95"
                    )}>
                      {deleteMutation.isPending && deleteMutation.variables?.id === ws.id ? (
                        <>
                          <div className="w-6 h-6 border-2 border-rose-300 border-t-rose-500 rounded-full animate-spin" />
                          <p className={cn("text-[12px] font-bold text-center leading-snug", text)}>
                            Deleting "{ws.name}"…
                          </p>
                          <p className={cn("text-[10.5px] text-center leading-snug px-2", sub)}>
                            This can take up to a minute for larger workspaces. Please don't close or refresh this page.
                          </p>
                        </>
                      ) : (
                        <>
                          <p className={cn("text-[12.5px] font-bold text-center leading-snug", text)}>
                            Permanently delete "{ws.name}"?
                          </p>
                          <p className={cn("text-[10.5px] text-center leading-snug px-2", sub)}>
                            This deletes all of this workspace's data — contacts, conversations, connected channels, AI agents — forever. This cannot be undone.
                          </p>
                          <input
                            autoFocus
                            value={deleteConfirmText}
                            onChange={(e) => setDeleteConfirmText(e.target.value)}
                            placeholder={`Type "${ws.name}" to confirm`}
                            className={cn(
                              "w-full max-w-[220px] px-3 py-1.5 rounded-lg border text-[11px] text-center outline-none",
                              dark ? "bg-slate-900/60 border-slate-700 text-white placeholder:text-slate-600" : "bg-slate-50 border-slate-200 text-slate-900 placeholder:text-slate-400"
                            )}
                          />
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => deleteMutation.mutate(ws)}
                              disabled={deleteConfirmText !== ws.name}
                              className="w-24 px-5 py-1.5 rounded-lg text-[12px] font-bold bg-rose-500 text-white hover:bg-rose-600 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                              Delete
                            </button>
                            <button
                              onClick={() => setConfirmDeleteId(null)}
                              className="w-24 px-5 py-1.5 rounded-lg text-[12px] font-bold border border-primary/40 text-primary hover:bg-primary/10 transition-all"
                            >
                              Cancel
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  )}

                  {/* Status Badge — top right */}
                  <div className="absolute top-4 right-4">
                    <span className={cn(
                      "inline-flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border",
                      ws.status === 'Active'
                        ? "text-emerald-500 bg-emerald-500/5 border-emerald-500/20"
                        : "text-rose-500 bg-rose-500/5 border-rose-500/20"
                    )}>
                      <span className={cn("w-1 h-1 rounded-full", ws.status === 'Active' ? "bg-emerald-500" : "bg-rose-500")} />
                      {ws.status}
                    </span>
                  </div>

                  {/* Circular Avatar */}
                  <div className={cn(
                    "w-16 h-16 rounded-full flex items-center justify-center text-white font-bold text-xl mb-4 shadow-lg transition-transform group-hover:scale-110 bg-gradient-to-br",
                    getAvatarColor(ws.id)
                  )}>
                    {ws.name.slice(0, 2).toUpperCase()}
                  </div>

                  {/* Info */}
                  <div className="text-center w-full mb-5">
                    <h3 className={cn("text-[15px] font-bold tracking-tight mb-2 truncate px-2", text)}>{ws.name}</h3>
                    <div className="flex flex-col items-center">
                      <span className={cn("text-[10px] font-bold uppercase tracking-widest opacity-40", sub)}>
                        ID: {ws.id}
                      </span>
                      <p className={cn("text-[11px] font-medium mt-0.5", sub)}>
                        Created on {ws.createdAt}
                      </p>
                    </div>
                  </div>

                  {/* Action Bar */}
                  <div className={cn("flex items-center gap-2 w-full pt-4 mt-auto border-t", dark ? "border-slate-800" : "border-slate-100")}>
                    <button
                      onClick={() => { setSelectedWorkspace(ws); setViewMode('EDIT'); }}
                      className={cn(
                        "flex-1 flex items-center justify-center gap-2 h-9 rounded-xl text-[11px] font-bold transition-all",
                        dark
                          ? "bg-slate-800 hover:bg-primary text-slate-300 hover:text-white"
                          : "bg-slate-100 hover:bg-primary text-slate-600 hover:text-white"
                      )}
                    >
                      <Monitor size={13} /> Manage
                    </button>

                    <button
                      onClick={() => loginToWorkspaceMutation.mutate(ws)}
                      disabled={loginToWorkspaceMutation.isPending}
                      className={cn(
                        "flex-1 flex items-center justify-center gap-2 h-9 rounded-xl text-[11px] font-bold transition-all disabled:opacity-50",
                        dark
                          ? "bg-slate-800 hover:bg-emerald-600 text-slate-300 hover:text-white"
                          : "bg-slate-100 hover:bg-emerald-600 text-slate-600 hover:text-white"
                      )}
                    >
                      <LogIn size={13} /> {loginToWorkspaceMutation.isPending ? 'Logging in…' : 'Login'}
                    </button>

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button className={cn(
                          "w-9 h-9 flex items-center justify-center rounded-xl border transition-all outline-none shrink-0",
                          dark
                            ? "border-slate-700 hover:bg-slate-800 text-slate-400 hover:text-white"
                            : "border-slate-200 hover:bg-white text-slate-400 hover:text-slate-900"
                        )}>
                          <MoreHorizontal size={15} />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className={cn("w-52 rounded-xl border shadow-2xl p-1", dark ? "bg-[#0f1829] border-slate-800 text-white" : "")}>
                        <DropdownMenuItem onClick={() => { setSelectedWorkspace(ws); setViewMode('USAGE'); }} className="rounded-lg py-2.5 font-bold text-[11px] cursor-pointer gap-2.5">
                          <BarChart3 size={14} className="text-primary" /> Usage Reports
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => { setSelectedWorkspace(ws); setViewMode('VOICE_WALLET'); }} className="rounded-lg py-2.5 font-bold text-[11px] cursor-pointer gap-2.5">
                          <Wallet size={14} className="text-primary" /> Voice Wallet
                        </DropdownMenuItem>
                        <div className={cn("my-1 h-px", dark ? "bg-slate-800" : "bg-slate-100")} />
                        <DropdownMenuItem onClick={() => toggleStatusMutation.mutate(ws)} className="rounded-lg py-2.5 font-bold text-[11px] cursor-pointer gap-2.5">
                          <Ban size={14} /> {ws.status === 'Active' ? 'Suspend Access' : 'Activate Access'}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => { setConfirmDeleteId(ws.id); setDeleteConfirmText(''); }}
                          className="rounded-lg py-2.5 font-bold text-[11px] cursor-pointer gap-2.5 text-rose-500 hover:text-rose-600 hover:bg-rose-500/10"
                        >
                          <Trash2 size={14} /> Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Show More — reveals the next PAGE_SIZE workspaces below */}
          {hasMore && (
            <div className="mt-10 flex justify-center">
              <button
                onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[12px] font-bold bg-primary text-primary-foreground hover:opacity-90 transition-all hover:scale-105 active:scale-95 shadow-sm"
              >
                <ChevronDown size={14} /> Show more
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AgencyWorkspaces;
