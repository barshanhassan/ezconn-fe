import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Users2, Users, Pencil, Trash2, Plus, Check, ChevronLeft, Shuffle,
  UserMinus, TriangleAlert, Search, Target, Zap, Activity,
  ShieldCheck, Loader2,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useTheme } from "@/contexts/ThemeContext";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

const ROW_ACCENTS = [
  "bg-violet-500", "bg-blue-500", "bg-emerald-500",
  "bg-amber-500",  "bg-rose-500", "bg-cyan-500",
  "bg-indigo-500", "bg-teal-500",
];

const AVATAR_COLORS = [
  { bg: "bg-violet-500/15",  text: "text-violet-600 dark:text-violet-400" },
  { bg: "bg-blue-500/15",    text: "text-blue-600 dark:text-blue-400" },
  { bg: "bg-emerald-500/15", text: "text-emerald-600 dark:text-emerald-400" },
  { bg: "bg-amber-500/15",   text: "text-amber-600 dark:text-amber-400" },
  { bg: "bg-rose-500/15",    text: "text-rose-600 dark:text-rose-400" },
  { bg: "bg-cyan-500/15",    text: "text-cyan-600 dark:text-cyan-400" },
];

function nameHash(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h << 5) - h + name.charCodeAt(i);
  return Math.abs(h) % AVATAR_COLORS.length;
}

function MemberAvatar({ name, size = "sm" }: { name: string; size?: "sm" | "md" }) {
  const idx = nameHash(name);
  const { bg, text } = AVATAR_COLORS[idx];
  const dim = size === "sm" ? "w-8 h-8 text-[11px]" : "w-10 h-10 text-[13px]";
  return (
    <div className={cn("rounded-xl flex items-center justify-center font-black flex-shrink-0", dim, bg, text)}>
      {name.charAt(0).toUpperCase()}
    </div>
  );
}

export default function TeamsSection() {
  const { t } = useTranslation();
  const { mode } = useTheme();
  const dark = mode === "dark";
  const { toast } = useToast();

  const [view, setView] = useState<"list" | "add" | "edit">("list");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [teamName, setTeamName] = useState("");
  const [distribution, setDistribution] = useState<"EQUAL" | "PRIORITY">("EQUAL");
  const [autoAssign, setAutoAssign] = useState(false);
  const [selectedAgents, setSelectedAgents] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState("");

  const [deleteTarget, setDeleteTarget] = useState<any>(null);
  const [deleteConfirm, setDeleteConfirm] = useState("");

  const card       = dark ? "bg-[#0f1829]"    : "bg-white";
  const border     = dark ? "border-slate-800" : "border-slate-200";
  const text       = dark ? "text-white"      : "text-slate-900";
  const sub        = dark ? "text-slate-500"  : "text-slate-400";
  const softBg     = dark ? "bg-slate-950/40" : "bg-slate-50/50";
  const softBorder = dark ? "border-slate-800" : "border-slate-100";

  const inputCls = cn(
    "h-11 rounded-xl text-[13px] font-bold transition-all px-4",
    "focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:border-primary/50",
    dark ? "bg-slate-950/50 border-slate-800 text-white" : "bg-white border-slate-200 text-slate-900"
  );

  const primaryBtn =
    "h-11 px-7 rounded-xl bg-primary hover:bg-primary/90 disabled:opacity-50 text-white text-[11px] font-semibold transition-all shadow-lg shadow-primary/20 flex items-center gap-2";

  const outlineBtn = cn(
    "h-11 px-6 rounded-xl border text-[11px] font-semibold transition-all flex items-center gap-2",
    dark ? "border-slate-800 text-slate-300 hover:border-primary/40 hover:text-primary" : "border-slate-200 text-slate-700 hover:border-primary/40 hover:text-primary"
  );

  const { data: teamsData, isLoading } = useQuery<any>({
    queryKey: ["/api/teams/get-all"],
  });

  const { data: membersData } = useQuery<any>({
    queryKey: ["/api/workspaces/members"],
  });

  const agents = membersData || [];
  const teams = Array.isArray(teamsData) ? teamsData : [];

  const filteredTeams = teams.filter((t: any) =>
    t.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const saveMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/teams/create", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/teams/get-all"] });
      toast({ title: t("teams_section.saved_title"), description: t("teams_section.saved_desc") });
      resetForm();
      setView("list");
    },
    onError: (err: any) => toast({ title: t("teams_section.error_title"), description: err.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string | number) => {
      await apiRequest("DELETE", `/api/teams/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/teams/get-all"] });
      toast({ title: t("teams_section.deleted_title"), description: t("teams_section.deleted_desc") });
      setDeleteTarget(null);
      setDeleteConfirm("");
    },
    onError: (err: any) => toast({ title: t("teams_section.error_title"), description: err.message, variant: "destructive" }),
  });

  const resetForm = () => {
    setTeamName("");
    setDistribution("EQUAL");
    setAutoAssign(false);
    setEditingId(null);
    setSelectedAgents([]);
  };

  const handleEdit = (team: any) => {
    setEditingId(team.id);
    setTeamName(team.name);
    setDistribution(team.distribution);
    setAutoAssign(team.auto_assign === 1);
    setSelectedAgents(team.team_members?.map((m: any) => ({ ...m.users, priority: m.priority })) || []);
    setView("edit");
  };

  const totalPriority = selectedAgents.reduce((sum, a) => sum + (parseInt(a.priority) || 0), 0);
  const isPriorityValid = distribution !== "PRIORITY" || totalPriority === 100;

  const handleSave = () => {
    if (!teamName.trim()) return;
    if (selectedAgents.length === 0) {
      toast({ title: t("teams_section.validation_title"), description: t("teams_section.validation_min_member"), variant: "destructive" });
      return;
    }
    if (!isPriorityValid) return;
    saveMutation.mutate({
      id: editingId,
      name: teamName,
      distribution,
      auto_assign: autoAssign,
      members: selectedAgents.map((a) => ({ id: a.id, priority: a.priority || 0 })),
    });
  };

  /* ── ADD / EDIT VIEW ─────────────────────────────────────────── */
  if (view === "add" || view === "edit") {
    const teamInitial = teamName.trim().charAt(0).toUpperCase() || "?";
    const accentIdx = teamName ? nameHash(teamName) % ROW_ACCENTS.length : 0;
    const accentCls = ROW_ACCENTS[accentIdx];

    return (
      <Card className={cn("rounded-[2rem] border overflow-hidden shadow-sm transition-all duration-300", card, border)}>
        <CardContent className="p-0">
          {/* Header */}
          <div className={cn("px-8 py-5 border-b flex flex-wrap items-center justify-between gap-3", border)}>
            <div className="flex items-center gap-4">
              <button
                onClick={() => { resetForm(); setView("list"); }}
                className={cn("w-10 h-10 rounded-xl border flex items-center justify-center transition-all", dark ? "border-slate-800 hover:border-primary/40 hover:text-primary" : "border-slate-200 hover:border-primary/40 hover:text-primary")}
              >
                <ChevronLeft size={16} />
              </button>
              <div className={cn("p-2.5 rounded-xl shadow-sm", dark ? "bg-primary/15" : "bg-primary/10")}>
                <Users2 className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h1 className={cn("text-[16px] font-bold tracking-tight", text)}>
                  {view === "add" ? t("teams_section.add_team_title") : t("teams_section.edit_team_title")}
                </h1>
                <p className={cn("text-[11px] font-bold mt-0.5 opacity-60", sub)}>
                  {t("teams_section.add_edit_subtitle")}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => { resetForm(); setView("list"); }} className={outlineBtn}>
                {t("teams_section.cancel")}
              </button>
              <button
                onClick={handleSave}
                disabled={!teamName.trim() || !isPriorityValid || saveMutation.isPending}
                className={primaryBtn}
              >
                {saveMutation.isPending ? <Loader2 size={12} className="animate-spin" /> : <ShieldCheck size={12} />}
                {t("teams_section.save")}
              </button>
            </div>
          </div>

            <div className="flex flex-col lg:flex-row">

              {/* Left — Form */}
              <div className={cn("flex-1 p-8 space-y-8 border-b lg:border-b-0 lg:border-r", border)}>

                {/* Team Name */}
                <div className="space-y-2">
                  <FieldLabel dark={dark}>{t("teams_section.team_name_label")}</FieldLabel>
                  <Input
                    value={teamName}
                    onChange={(e) => setTeamName(e.target.value)}
                    placeholder={t("teams_section.team_name_placeholder")}
                    maxLength={60}
                    className={inputCls}
                  />
                </div>

                {/* Distribution */}
                <div className="space-y-3">
                  <FieldLabel dark={dark}>{t("teams_section.distribution_method_label")}</FieldLabel>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {([
                      { key: "EQUAL",    label: t("teams_section.distribution_equal_label"), desc: t("teams_section.distribution_equal_desc"), icon: <Shuffle size={16} /> },
                      { key: "PRIORITY", label: t("teams_section.distribution_priority_label"), desc: t("teams_section.distribution_priority_desc"), icon: <Target size={16} /> },
                    ] as const).map((opt) => {
                      const active = distribution === opt.key;
                      return (
                        <button
                          key={opt.key}
                          onClick={() => setDistribution(opt.key)}
                          className={cn(
                            "flex flex-col text-left p-5 rounded-[1.5rem] border transition-all",
                            active
                              ? "border-primary/50 bg-primary/5 shadow-md shadow-primary/10"
                              : cn(softBorder, softBg, "hover:border-primary/30")
                          )}
                        >
                          <div className="flex items-center justify-between mb-3">
                            <div className={cn(
                              "w-9 h-9 rounded-xl flex items-center justify-center transition-all",
                              active ? "bg-primary text-white shadow-lg shadow-primary/30" : "bg-primary/10 text-primary"
                            )}>
                              {opt.icon}
                            </div>
                            {active && (
                              <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                                <Check size={10} className="text-white" strokeWidth={4} />
                              </div>
                            )}
                          </div>
                          <p className={cn("text-[13px] font-black tracking-tight", text)}>{opt.label}</p>
                          <p className={cn("text-[11px] font-medium opacity-60 mt-1 leading-relaxed", sub)}>{opt.desc}</p>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Auto-assign */}
                <div className={cn("p-5 rounded-[1.25rem] border flex items-center justify-between gap-4", softBg, softBorder)}>
                  <div className="flex items-center gap-4">
                    <div className={cn("p-2 rounded-xl transition-colors", autoAssign ? "bg-emerald-500/15 text-emerald-500" : "bg-primary/10 text-primary")}>
                      <Zap size={16} />
                    </div>
                    <div>
                      <p className={cn("text-[13px] font-black tracking-tight", text)}>{t("teams_section.auto_assign_title")}</p>
                      <p className={cn("text-[11px] font-medium opacity-60 mt-0.5", sub)}>
                        {t("teams_section.auto_assign_desc")}
                      </p>
                    </div>
                  </div>
                  <Switch
                    checked={autoAssign}
                    onCheckedChange={setAutoAssign}
                    className="data-[state=checked]:bg-emerald-500"
                  />
                </div>

                {/* Members */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <FieldLabel dark={dark}>{t("teams_section.members_label")}</FieldLabel>
                    <span className="px-2.5 py-1 rounded-md bg-primary/10 text-primary text-[11px] font-semibold">
                      {t("teams_section.members_added_count", { count: selectedAgents.length })}
                    </span>
                  </div>

                  <Select
                    onValueChange={(val) => {
                      const agent = agents.find((a: any) => a.id.toString() === val);
                      if (agent && !selectedAgents.find((sa) => sa.id === agent.id)) {
                        setSelectedAgents((prev) => [...prev, { ...agent, priority: 0 }]);
                      }
                    }}
                  >
                    <SelectTrigger className={inputCls}>
                      <div className="flex items-center gap-2 text-slate-400">
                        <Plus size={14} />
                        <SelectValue placeholder={t("teams_section.add_member_placeholder")} />
                      </div>
                    </SelectTrigger>
                    <SelectContent className={cn("rounded-xl border shadow-2xl", dark ? "bg-[#0f1829] border-slate-800 text-white" : "bg-white border-slate-200")}>
                      {agents
                        .filter((a: any) => !selectedAgents.find((sa) => sa.id === a.id))
                        .map((agent: any) => (
                          <SelectItem key={agent.id} value={agent.id.toString()} className="py-2 rounded-lg">
                            <div className="flex items-center gap-3">
                              <MemberAvatar name={agent.full_name || agent.first_name || "?"} />
                              <div className="flex flex-col">
                                <span className="font-bold text-[12px]">{agent.full_name || agent.first_name}</span>
                                <span className="text-[10px] opacity-60">{agent.email}</span>
                              </div>
                            </div>
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>

                  {distribution === "PRIORITY" && selectedAgents.length > 0 && (
                    <div className="flex items-center justify-between mt-1 px-1">
                      <span className="text-[10px] font-bold text-rose-500">
                        {totalPriority !== 100 ? t("teams_section.priority_sum_warning") : ""}
                      </span>
                      <span className={cn("text-[11px] font-semibold", totalPriority === 100 ? "text-emerald-500" : sub)}>
                        {t("teams_section.priority_total", { count: totalPriority })}
                      </span>
                    </div>
                  )}

                  {selectedAgents.length > 0 ? (
                    <div className="space-y-2 pt-1">
                      {selectedAgents.map((agent, idx) => {
                        const displayName = agent.full_name || agent.first_name || "?";
                        return (
                          <div
                            key={agent.id}
                            className={cn(
                              "group flex items-center justify-between p-3 rounded-[1rem] border transition-all",
                              softBg,
                              softBorder
                            )}
                          >
                            <div className="flex items-center gap-3">
                              <MemberAvatar name={displayName} size="md" />
                              <div className="min-w-0">
                                <p className={cn("text-[12px] font-black tracking-tight", text)}>{displayName}</p>
                                <p className={cn("text-[11px] font-medium opacity-60 truncate", sub)}>{agent.email}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              {distribution === "PRIORITY" && (
                                <div className={cn("flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg border", dark ? "border-slate-800 bg-slate-950/50" : "border-slate-200 bg-white")}>
                                  <span className={cn("text-[10px] font-semibold", sub)}>{t("teams_section.distribution_priority_label")}</span>
                                  {/* Range slider (replyagent) + number box — both clamped 0–100, synced. */}
                                  <input
                                    type="range"
                                    min={0}
                                    max={100}
                                    value={agent.priority || 0}
                                    onChange={(e) => {
                                      const v = Math.max(0, Math.min(100, parseInt(e.target.value) || 0));
                                      const updated = [...selectedAgents];
                                      updated[idx] = { ...updated[idx], priority: v };
                                      setSelectedAgents(updated);
                                    }}
                                    className="h-1.5 w-24 cursor-pointer accent-primary"
                                  />
                                  <Input
                                    type="number"
                                    min={0}
                                    max={100}
                                    value={agent.priority || 0}
                                    onChange={(e) => {
                                      const v = Math.max(0, Math.min(100, parseInt(e.target.value) || 0));
                                      const updated = [...selectedAgents];
                                      updated[idx] = { ...updated[idx], priority: v };
                                      setSelectedAgents(updated);
                                    }}
                                    className={cn("h-6 w-12 text-center text-[12px] font-black rounded border-none bg-transparent focus-visible:ring-0 p-0", text)}
                                  />
                                  <span className={cn("text-[11px] font-black", sub)}>%</span>
                                </div>
                              )}
                              <button
                                onClick={() => setSelectedAgents((prev) => prev.filter((sa) => sa.id !== agent.id))}
                                className={cn(
                                  "w-8 h-8 rounded-lg flex items-center justify-center transition-all opacity-0 group-hover:opacity-100",
                                  dark ? "bg-slate-900 text-slate-500 hover:bg-rose-500 hover:text-white" : "bg-white border border-slate-200 text-slate-400 hover:bg-rose-500 hover:text-white hover:border-rose-500"
                                )}
                              >
                                <UserMinus size={12} />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className={cn("flex flex-col items-center justify-center py-8 rounded-[1.25rem] border-2 border-dashed", softBorder, softBg)}>
                      <Users className="w-7 h-7 text-primary/40 mb-2" />
                      <p className={cn("text-[11px] font-medium opacity-60", sub)}>{t("teams_section.no_members_yet")}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Right — Preview */}
              <div className={cn("w-full lg:w-80 shrink-0 p-8 space-y-5", softBg)}>
                <div className="flex items-center gap-2">
                  <span className={cn("text-[11px] font-semibold", sub)}>{t("teams_section.preview_label")}</span>
                  <div className="h-px flex-1 bg-slate-500/10" />
                </div>

                {/* Team Hero */}
                <div className={cn("relative p-6 rounded-[1.5rem] border overflow-hidden text-center", card, border)}>
                  <div className={cn("absolute -top-10 -right-10 w-32 h-32 blur-[60px] opacity-30", accentCls)} />

                  <div className={cn("w-14 h-14 rounded-2xl flex items-center justify-center text-xl font-black mb-3 mx-auto shadow-lg", accentCls, "text-white")}>
                    {teamInitial}
                  </div>
                  <h3 className={cn("text-[14px] font-black tracking-tight", text)}>{teamName || t("teams_section.team_name_placeholder_fallback")}</h3>

                  <div className="flex justify-center gap-2 mt-3 flex-wrap">
                    <span className={cn(
                      "inline-flex items-center gap-1.5 text-[10px] font-semibold px-2 py-1 rounded-md",
                      distribution === "EQUAL" ? "bg-blue-500/10 text-blue-500" : "bg-violet-500/10 text-violet-500"
                    )}>
                      {distribution === "EQUAL" ? <Shuffle size={10} /> : <Target size={10} />}
                      {distribution === "EQUAL" ? t("teams_section.distribution_equal_label") : t("teams_section.distribution_priority_label")}
                    </span>
                    {autoAssign && (
                      <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold px-2 py-1 rounded-md bg-emerald-500/10 text-emerald-500">
                        <Zap size={10} /> {t("teams_section.auto_badge")}
                      </span>
                    )}
                  </div>
                </div>

                {/* Stats */}
                <div className="space-y-2">
                  {[
                    { label: t("teams_section.members_label"), value: t("teams_section.stat_members_active", { count: selectedAgents.length }), icon: <Users size={12} /> },
                    { label: t("teams_section.stat_method_label"), value: distribution === "EQUAL" ? t("teams_section.distribution_equal_label") : t("teams_section.distribution_priority_label"), icon: <Shuffle size={12} /> },
                    { label: t("teams_section.auto_badge"), value: autoAssign ? t("teams_section.auto_enabled") : t("teams_section.auto_disabled"), icon: <Zap size={12} /> },
                  ].map((row) => (
                    <div key={row.label} className={cn("flex items-center justify-between p-3 rounded-xl border", card, border)}>
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                          {row.icon}
                        </div>
                        <span className={cn("text-[11px] font-semibold", sub)}>{row.label}</span>
                      </div>
                      <span className={cn("text-[11px] font-black", text)}>{row.value}</span>
                    </div>
                  ))}
                </div>

                {selectedAgents.length > 0 && (
                  <div className="space-y-2">
                    <span className={cn("text-[11px] font-semibold", sub)}>{t("teams_section.members_label")}</span>
                    <div className="flex flex-wrap gap-2">
                      {selectedAgents.slice(0, 8).map((agent) => {
                        const n = agent.full_name || agent.first_name || "?";
                        return <MemberAvatar key={agent.id} name={n} />;
                      })}
                      {selectedAgents.length > 8 && (
                        <div className={cn("w-8 h-8 rounded-xl flex items-center justify-center text-[10px] font-black border", softBorder, dark ? "bg-slate-900 text-slate-400" : "bg-white text-slate-500")}>
                          +{selectedAgents.length - 8}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
        </CardContent>
      </Card>
    );
  }

  /* ── LIST VIEW ─────────────────────────────────────────────── */
  return (
    <>
    <Card className={cn("rounded-[2rem] border overflow-hidden shadow-sm transition-all duration-300", card, border)}>
      <CardContent className="p-0">
        {/* Header */}
        <div className={cn("px-8 py-5 border-b flex items-center justify-between", border)}>
          <div className="flex items-center gap-4">
            <div className={cn("p-2.5 rounded-xl shadow-sm", dark ? "bg-primary/15" : "bg-primary/10")}>
              <Users2 className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className={cn("text-[16px] font-bold tracking-tight", text)}>{t("teams_section.page_title")}</h1>
              <p className={cn("text-[11px] font-bold mt-0.5 opacity-60", sub)}>
                {t("teams_section.add_edit_subtitle")}
              </p>
            </div>
          </div>
          <span className="px-3 py-1.5 rounded-lg bg-primary/10 text-primary text-[11px] font-semibold flex items-center gap-1.5">
            <ShieldCheck size={11} /> {t("teams_section.teams_count", { count: teams.length })}
          </span>
        </div>

        {/* Toolbar */}
        <div className={cn("px-6 py-4 border-b flex items-center justify-between gap-3", softBorder)}>
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <Input
                placeholder={t("teams_section.search_placeholder")}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className={cn(inputCls, "pl-9 h-10")}
              />
            </div>
            <button onClick={() => { resetForm(); setView("add"); }} className={primaryBtn}>
              <Plus size={12} /> {t("teams_section.add_team_button")}
            </button>
          </div>

          {/* Body */}
          <div className="p-6">
            {isLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className={cn("h-44 rounded-[1.5rem] animate-pulse", dark ? "bg-slate-900/60" : "bg-slate-100")} />
                ))}
              </div>
            ) : filteredTeams.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center space-y-4">
                <div className="w-14 h-14 bg-primary/10 rounded-2xl flex items-center justify-center">
                  <Users2 className="w-6 h-6 text-primary" />
                </div>
                <div className="space-y-1">
                  <p className={cn("text-[14px] font-semibold", text)}>{t("teams_section.no_teams_title")}</p>
                  <p className={cn("text-[11px] font-medium opacity-60 max-w-xs", sub)}>
                    {t("teams_section.no_teams_desc")}
                  </p>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredTeams.map((team: any, i: number) => {
                  const accentCls = ROW_ACCENTS[i % ROW_ACCENTS.length];
                  const memberCount = team.team_members?.length || 0;
                  const members = (team.team_members || []).slice(0, 4);

                  return (
                    <div
                      key={team.id}
                      className={cn(
                        "group flex flex-col p-5 rounded-[1.5rem] border transition-all hover:shadow-md hover:border-primary/30",
                        softBg,
                        softBorder
                      )}
                    >
                      <div className="flex items-start justify-between mb-4">
                        <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center text-lg font-black shadow-md", accentCls, "text-white")}>
                          {team.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => handleEdit(team)}
                            title={t("teams_section.edit_team_title")}
                            className={cn(
                              "w-8 h-8 rounded-lg flex items-center justify-center transition-all",
                              dark ? "bg-slate-900 text-slate-400 hover:bg-primary hover:text-white" : "bg-white border border-slate-200 text-slate-500 hover:bg-primary hover:text-white hover:border-primary"
                            )}
                          >
                            <Pencil size={12} />
                          </button>
                          <button
                            onClick={() => { setDeleteTarget(team); setDeleteConfirm(""); }}
                            title={t("teams_section.delete_title")}
                            className={cn(
                              "w-8 h-8 rounded-lg flex items-center justify-center transition-all",
                              dark ? "bg-slate-900 text-slate-400 hover:bg-rose-500 hover:text-white" : "bg-white border border-slate-200 text-slate-500 hover:bg-rose-500 hover:text-white hover:border-rose-500"
                            )}
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>

                      <div className="flex-1 mb-4">
                        <h4 className={cn("text-[14px] font-black tracking-tight group-hover:text-primary transition-colors mb-2", text)}>
                          {team.name}
                        </h4>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={cn(
                            "inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-md",
                            team.distribution === "EQUAL"
                              ? "bg-blue-500/10 text-blue-500"
                              : "bg-violet-500/10 text-violet-500"
                          )}>
                            {team.distribution === "EQUAL" ? <Shuffle size={9} /> : <Target size={9} />}
                            {team.distribution === "EQUAL" ? t("teams_section.distribution_equal_label") : t("teams_section.distribution_priority_label")}
                          </span>
                          {team.auto_assign === 1 && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-500">
                              <Zap size={9} /> {t("teams_section.auto_badge")}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-3 border-t" style={{ borderColor: dark ? "rgb(30 41 59)" : "rgb(241 245 249)" }}>
                        <div className="flex -space-x-2">
                          {members.map((m: any, mi: number) => {
                            const n = m.users?.full_name || m.users?.first_name || "?";
                            return <MemberAvatar key={mi} name={n} />;
                          })}
                          {memberCount > 4 && (
                            <div className={cn("w-8 h-8 rounded-xl flex items-center justify-center text-[10px] font-black border-2 border-white dark:border-[#0f1829]", dark ? "bg-slate-900 text-slate-400" : "bg-slate-100 text-slate-500")}>
                              +{memberCount - 4}
                            </div>
                          )}
                        </div>
                        <span className={cn("text-[11px] font-semibold", sub)}>
                          {t("teams_section.member_count", { count: memberCount })}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Delete Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className={cn("w-full max-w-md rounded-[2rem] overflow-hidden shadow-2xl border", card, border)}>
            <div className="p-6 space-y-5">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-rose-500/15 flex items-center justify-center shrink-0">
                  <TriangleAlert size={20} className="text-rose-500" />
                </div>
                <div>
                  <h2 className={cn("text-[15px] font-semibold", text)}>{t("teams_section.delete_title")}</h2>
                  <p className={cn("text-[11px] font-medium opacity-60 mt-0.5", sub)}>
                    {t("teams_section.delete_desc", { name: deleteTarget.name })}
                  </p>
                </div>
              </div>

              <div className={cn("p-4 rounded-[1rem] border", "bg-rose-500/5 border-rose-500/20")}>
                <p className="text-[11px] font-bold text-rose-600 dark:text-rose-400 leading-relaxed">
                  {t("teams_section.delete_warning", { count: deleteTarget.team_members?.length || 0 })}
                </p>
              </div>

              <div className="space-y-2">
                <label className={cn("text-[11px] font-semibold pl-1 block", sub)}>
                  {t("teams_section.delete_confirm_prefix")} <span className="text-rose-500">{deleteTarget.name}</span> {t("teams_section.delete_confirm_suffix")}
                </label>
                <Input
                  value={deleteConfirm}
                  onChange={(e) => setDeleteConfirm(e.target.value)}
                  placeholder={t("teams_section.delete_confirm_placeholder")}
                  className={cn(inputCls, "border-rose-500/20 focus-visible:ring-rose-500/20")}
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={() => { setDeleteTarget(null); setDeleteConfirm(""); }}
                  className={outlineBtn}
                >
                  {t("teams_section.cancel")}
                </button>
                <button
                  disabled={deleteConfirm !== deleteTarget.name || deleteMutation.isPending}
                  onClick={() => deleteMutation.mutate(deleteTarget.id)}
                  className="h-11 px-7 rounded-xl bg-rose-500 hover:bg-rose-600 disabled:opacity-50 disabled:cursor-not-allowed text-white text-[11px] font-semibold transition-all shadow-lg shadow-rose-500/20 flex items-center gap-2"
                >
                  {deleteMutation.isPending ? <Activity className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                  {t("teams_section.delete_button")}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/* ── Helpers ── */
function FieldLabel({ dark, children }: { dark: boolean; children: React.ReactNode }) {
  const sub = dark ? "text-slate-400" : "text-slate-500";
  return (
    <label className={cn("text-[11px] font-semibold pl-1 block", sub)}>
      {children}
    </label>
  );
}
