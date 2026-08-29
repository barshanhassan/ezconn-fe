import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import {
  Shield, ShieldCheck, Plus, ChevronLeft, Loader2, Archive, RotateCcw,
  Pencil, Settings, Share2, UserCog, Sparkles, Lock,
  Search, CheckCircle2, Zap, User, Users, Scale, Bot,
  ChevronDown, Info, Link2, Calendar,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useTheme } from "@/contexts/ThemeContext";

// Icon options for workspace role icon picker (Lucide-based)
const ICONS = [
  { name: "agent",    icon: UserCog },
  { name: "user",     icon: User },
  { name: "team",     icon: Users },
  { name: "shield",   icon: Shield },
  { name: "scale",    icon: Scale },
  { name: "sparkles", icon: Sparkles },
  { name: "lock",     icon: Lock },
  { name: "info",     icon: Bot },
];

// Lucide icons for permission group category tabs — keyed by acl_permissions slug
const WORKSPACE_GROUP_ICONS: Record<string, React.ElementType> = {
  'workspace.settings.*':    Settings,
  'workspace.collaborate.*': Share2,
  'workspace.customize.*':   UserCog,
  'workspace.pipeline.*':    Zap,
  'workspace.inbox.*':       Bot,
  'workspace.company.*':     Users,
  'workspace.broadcast.*':   Sparkles,
  'workspace.legal.*':       Scale,
  'workspace.settings.connect': Link2,
  'workspace.ai.*':          Bot,
  'workspace.booking.*':     Calendar,
};

export default function RolesSection() {
  const { t } = useTranslation();
  const { mode } = useTheme();
  const dark = mode === "dark";
  const { toast } = useToast();

  const [view, setView] = useState<"list" | "add" | "edit">("list");
  const [activeTab, setActiveTab] = useState<"active" | "archived">("active");
  const [enableAll, setEnableAll] = useState(false);
  const [selectedIcon, setSelectedIcon] = useState(ICONS[0]);
  // Flat map of real permission slug → boolean (replaces the old nested fake-category state)
  const [permissions, setPermissions] = useState<Record<string, boolean>>({});
  const [roleName, setRoleName] = useState("");
  const [roleDescription, setRoleDescription] = useState("");
  const [editingRole, setEditingRole] = useState<any>(null);
  // expandedCategory is now the group slug from acl_permissions (e.g. 'workspace.inbox.*')
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
  // Accordion: which permission groups are expanded (replyagent Disclosure parity —
  // each group collapses/expands independently; all collapsed by default).
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set());
  // Confirm dialog before saving an EDIT (replyagent prompt: "changes will affect
  // all users assigned this role").
  const [confirmSaveOpen, setConfirmSaveOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

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

  const { data: rolesData, isLoading } = useQuery<any>({
    queryKey: ["/api/workspaces/all-roles"],
  });

  // Real workspace permission tree from acl_permissions
  const { data: permsTree, isLoading: loadingPerms } = useQuery<any[]>({
    queryKey: ["/api/workspaces/permissions"],
    select: (data) => data || [],
  });

  // Auto-select first permission group tab when tree loads
  useEffect(() => {
    if (permsTree?.length && !expandedCategory) {
      setExpandedCategory(permsTree[0].slug);
    }
  }, [permsTree]);

  // All leaf permissions from tree — used for enable-all and totalPerms
  const allLeafPerms: any[] = (permsTree || []).flatMap((g: any) => g.children || []);
  const totalPerms = allLeafPerms.length;

  // Build flat slug→boolean map from a slug array (used when loading role for edit)
  const buildSelected = (slugs: string[]): Record<string, boolean> =>
    Object.fromEntries((slugs || []).map((s: string) => [s, true]));

  // Collect all enabled slugs for save
  const collectSelectedSlugs = (): string[] =>
    Object.keys(permissions).filter((s) => permissions[s]);

  const roles = ((rolesData?.roles ?? rolesData) || []).map((r: any) => ({
    id: r.id.toString(),
    name: r.name,
    description: r.description,
    iconName: r.icon,
    isArchived: r.isArchived,
    isSystem: r.isSystem || false,
    permissions: Array.isArray(r.permissions) ? r.permissions : [],
  }));

  const activeRoles   = roles.filter((r: any) => !r.isArchived);
  const archivedRoles = roles.filter((r: any) => r.isArchived);
  const displayRoles  = activeTab === "active" ? activeRoles : archivedRoles;
  const filteredRoles = displayRoles.filter((r: any) =>
    r.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/workspaces/create-role", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/workspaces/all-roles"] });
      toast({ title: t("roles_section.toast_saved_title"), description: t("roles_section.toast_created_desc") });
      setView("list"); resetForm();
    },
    onError: (err: any) => toast({ title: t("roles_section.toast_error_title"), description: err.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const res = await apiRequest("PATCH", `/api/workspaces/roles/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/workspaces/all-roles"] });
      toast({ title: t("roles_section.toast_saved_title"), description: t("roles_section.toast_updated_desc") });
      setView("list"); resetForm();
    },
    onError: (err: any) => toast({ title: t("roles_section.toast_error_title"), description: err.message, variant: "destructive" }),
  });

  const togglePermission = (slug: string) => {
    if (roleLocked) return; // owner/system role permissions are not editable
    setPermissions((prev) => ({ ...prev, [slug]: !prev[slug] }));
  };

  // Accordion expand/collapse for a permission group (replyagent Disclosure).
  const toggleGroup = (slug: string) => {
    setOpenGroups((prev) => {
      const next = new Set(prev);
      next.has(slug) ? next.delete(slug) : next.add(slug);
      return next;
    });
  };

  const handleEnableAll = (checked: boolean) => {
    setEnableAll(checked);
    const all: Record<string, boolean> = {};
    allLeafPerms.forEach((p: any) => { all[p.slug] = checked; });
    setPermissions(all);
  };

  const handleManage = (role: any) => {
    setEditingRole(role);
    setRoleName(role.name);
    setRoleDescription(role.description || "");
    setPermissions(buildSelected(role.permissions || []));
    const icon = ICONS.find((i) => i.name === role.iconName) || ICONS[0];
    setSelectedIcon(icon);
    setExpandedCategory(permsTree?.[0]?.slug || null);
    setView("edit");
  };

  const resetForm = () => {
    setRoleName(""); setRoleDescription(""); setEditingRole(null);
    setSelectedIcon(ICONS[0]); setPermissions({}); setEnableAll(false);
    setExpandedCategory(permsTree?.[0]?.slug || null);
  };

  // Role being edited is a built-in/system role (e.g. owner) → permissions locked
  // (replyagent: role.slug === 'owner' → all switches ON + disabled).
  const roleLocked = !!editingRole?.isSystem;

  // Validation mirrors replyagent: name required (3–100), description ≤300,
  // at least one permission selected.
  const validateRole = (): string | null => {
    const name = roleName.trim();
    if (!name) return t("roles_section.error_name_required");
    if (name.length < 3 || name.length > 100) return t("roles_section.error_name_length");
    if (roleDescription.length > 300) return t("roles_section.error_description_length");
    if (collectSelectedSlugs().length === 0) return t("roles_section.error_permission_required");
    return null;
  };

  // Actually persist the role (called directly for create, or after the edit
  // confirmation prompt).
  const doSave = () => {
    const slugs = collectSelectedSlugs();
    if (editingRole) {
      updateMutation.mutate({ id: editingRole.id, data: { name: roleName, description: roleDescription, icon: selectedIcon.name, permissions: slugs } });
    } else {
      createMutation.mutate({ name: roleName, description: roleDescription, icon: selectedIcon.name, permissions: slugs });
    }
  };

  const handleSave = () => {
    const err = validateRole();
    if (err) {
      toast({ title: t("roles_section.toast_validation_title"), description: err, variant: "destructive" });
      return;
    }
    // Editing affects every user assigned this role → confirm first (replyagent prompt).
    if (editingRole) {
      setConfirmSaveOpen(true);
    } else {
      doSave();
    }
  };

  const enabledCount = Object.values(permissions).filter(Boolean).length;
  const pct = totalPerms > 0 ? Math.round((enabledCount / totalPerms) * 100) : 0;

  /* ── ADD / EDIT VIEW ─────────────────────────────────────────── */
  if (view === "add" || view === "edit") {
    return (
      <Card className={cn("rounded-[2rem] border overflow-hidden shadow-sm transition-all duration-300", card, border)}>
        <CardContent className="p-0">
          {/* Header */}
          <div className={cn("px-8 py-5 border-b flex flex-wrap items-center justify-between gap-3", border)}>
            <div className="flex items-center gap-4">
              <button
                onClick={() => { setView("list"); resetForm(); }}
                className={cn("w-10 h-10 rounded-xl border flex items-center justify-center transition-all", dark ? "border-slate-800 hover:border-primary/40 hover:text-primary" : "border-slate-200 hover:border-primary/40 hover:text-primary")}
              >
                <ChevronLeft size={16} />
              </button>
              <div className={cn("p-2.5 rounded-xl shadow-sm", dark ? "bg-primary/15" : "bg-primary/10")}>
                <Shield className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h1 className={cn("text-[16px] font-bold tracking-tight", text)}>
                  {editingRole ? t("roles_section.title_edit_role") : t("roles_section.title_create_role")}
                </h1>
                <p className={cn("text-[11px] font-bold mt-0.5 opacity-60", sub)}>
                  {t("roles_section.subtitle_edit")}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => { setView("list"); resetForm(); }} className={outlineBtn}>
                {t("roles_section.btn_cancel")}
              </button>
              <button
                onClick={handleSave}
                disabled={createMutation.isPending || updateMutation.isPending || !roleName.trim()}
                className={primaryBtn}
              >
                {createMutation.isPending || updateMutation.isPending ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : (
                  <ShieldCheck size={12} />
                )}
                {editingRole ? t("roles_section.btn_update") : t("roles_section.btn_save")}
              </button>
            </div>
          </div>

            <div className="flex flex-col md:flex-row">

              {/* Sidebar */}
              <div className={cn("w-full md:w-72 md:shrink-0 border-b md:border-r p-6 space-y-6", border, softBg)}>
                <div className="space-y-2">
                  <FieldLabel dark={dark}>{t("roles_section.label_role_name")}</FieldLabel>
                  <Input
                    placeholder={t("roles_section.placeholder_role_name")}
                    value={roleName}
                    onChange={(e) => setRoleName(e.target.value)}
                    className={inputCls}
                  />
                </div>

                <div className="space-y-2">
                  <FieldLabel dark={dark}>{t("roles_section.label_description")}</FieldLabel>
                  <Textarea
                    placeholder={t("roles_section.placeholder_description")}
                    value={roleDescription}
                    onChange={(e) => setRoleDescription(e.target.value)}
                    className={cn(
                      "min-h-[96px] rounded-xl text-[12px] font-medium leading-relaxed resize-none p-3 transition-all",
                      "focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:border-primary/50",
                      dark ? "bg-slate-950/50 border-slate-800 text-white" : "bg-white border-slate-200 text-slate-900"
                    )}
                  />
                </div>

                <div className="space-y-2">
                  <FieldLabel dark={dark}>{t("roles_section.label_icon")}</FieldLabel>
                  <div className="grid grid-cols-4 gap-2">
                    {ICONS.map((item) => {
                      const active = selectedIcon.name === item.name;
                      return (
                        <button
                          key={item.name}
                          onClick={() => setSelectedIcon(item)}
                          className={cn(
                            "aspect-square rounded-xl flex items-center justify-center border transition-all",
                            active
                              ? "bg-primary text-white shadow-lg shadow-primary/20 border-primary"
                              : dark
                                ? "border-slate-800 bg-slate-950/50 text-slate-400 hover:border-primary/30 hover:text-primary"
                                : "border-slate-200 bg-white text-slate-400 hover:border-primary/30 hover:text-primary"
                          )}
                        >
                          <item.icon size={16} />
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Stats */}
                <div className={cn("rounded-[1.25rem] border p-4 space-y-3", dark ? "bg-slate-950/50 border-slate-800" : "bg-white border-slate-200")}>
                  <div className="flex items-center justify-between">
                    <span className={cn("text-[11px] font-semibold", sub)}>{t("roles_section.label_capability")}</span>
                    <span className="text-[10px] font-black text-primary bg-primary/10 px-2 py-0.5 rounded-md">{pct}%</span>
                  </div>
                  <div className={cn("h-1.5 rounded-full overflow-hidden", dark ? "bg-slate-800" : "bg-slate-100")}>
                    <div className="h-full bg-primary rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
                  </div>
                  <div className="flex items-center justify-between pt-1">
                    <div className="flex items-center gap-1.5">
                      <Zap className="w-3 h-3 text-primary" />
                      <span className={cn("text-[11px] font-bold", text)}>{enabledCount} / {totalPerms}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={cn("text-[10px] font-semibold", sub)}>{t("roles_section.label_all")}</span>
                      <Switch checked={enableAll} onCheckedChange={handleEnableAll} className="data-[state=checked]:bg-primary scale-75" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Panel: Permissions — collapsible accordion (replyagent Disclosure parity) */}
              <div className="flex-1 flex flex-col min-w-0">
                <TooltipProvider delayDuration={200}>
                  <div className="flex-1 p-6 space-y-3 overflow-y-auto">
                    {loadingPerms ? (
                      <div className="flex items-center justify-center py-20">
                        <Loader2 size={20} className="animate-spin text-primary" />
                      </div>
                    ) : (permsTree || []).map((group: any) => {
                      const Icon = WORKSPACE_GROUP_ICONS[group.slug] || Shield;
                      const open = openGroups.has(group.slug);
                      const count = (group.children || []).filter((c: any) => permissions[c.slug]).length;
                      return (
                        <div key={group.slug} className={cn("rounded-[1.25rem] border overflow-hidden", dark ? "border-slate-800" : "border-slate-200")}>
                          {/* Group header — click to expand/collapse */}
                          <button
                            type="button"
                            onClick={() => toggleGroup(group.slug)}
                            className={cn(
                              "w-full flex items-center justify-between px-5 py-4 transition-all",
                              dark ? "bg-slate-950/40 hover:bg-slate-950/60" : "bg-slate-50/60 hover:bg-slate-100/60"
                            )}
                          >
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-primary/10 text-primary shrink-0">
                                <Icon size={14} />
                              </div>
                              <h2 className={cn("text-[13px] font-semibold", text)}>{group.name}</h2>
                              {count > 0 && (
                                <span className="px-1.5 py-0.5 rounded text-[9px] font-black bg-primary/10 text-primary">{count}</span>
                              )}
                            </div>
                            <ChevronDown size={16} className={cn("text-slate-400 transition-transform duration-200", open && "rotate-180")} />
                          </button>

                          {/* Group panel — permission rows */}
                          {open && (
                            <div className="px-5 pb-4 pt-1 space-y-3">
                              {(group.children || []).map((perm: any) => {
                                const checked = roleLocked ? true : !!permissions[perm.slug];
                                return (
                                  <div
                                    key={perm.slug}
                                    onClick={() => togglePermission(perm.slug)}
                                    className={cn(
                                      "flex items-center justify-between p-4 rounded-[1.25rem] border transition-all",
                                      roleLocked ? "cursor-not-allowed" : "cursor-pointer",
                                      checked
                                        ? "bg-primary/5 border-primary/30"
                                        : dark
                                          ? "bg-slate-950/40 border-slate-800 hover:border-primary/20"
                                          : "bg-slate-50/50 border-slate-100 hover:border-primary/20"
                                    )}
                                  >
                                    <div className="flex items-start gap-3 pr-4">
                                      <div className={cn(
                                        "w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-all",
                                        checked ? "bg-primary text-white" : "bg-primary/10 text-primary"
                                      )}>
                                        <CheckCircle2 size={14} />
                                      </div>
                                      <div>
                                        <p className={cn("text-[12px] font-black tracking-tight flex items-center gap-1.5", text)}>
                                          {perm.name}
                                          {perm.tooltip && (
                                            <Tooltip>
                                              <TooltipTrigger asChild>
                                                <span onClick={(e) => e.stopPropagation()} className="text-slate-400 hover:text-primary cursor-help">
                                                  <Info size={12} />
                                                </span>
                                              </TooltipTrigger>
                                              <TooltipContent side="right" className="max-w-xs text-[11px] leading-relaxed">
                                                {perm.tooltip}
                                              </TooltipContent>
                                            </Tooltip>
                                          )}
                                        </p>
                                        <p className={cn("text-[11px] font-medium opacity-60 mt-0.5 leading-relaxed", sub)}>{perm.description}</p>
                                      </div>
                                    </div>
                                    <Switch
                                      checked={checked}
                                      disabled={roleLocked}
                                      onCheckedChange={() => togglePermission(perm.slug)}
                                      onClick={(e) => e.stopPropagation()}
                                      className="data-[state=checked]:bg-primary shrink-0"
                                    />
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </TooltipProvider>
              </div>

            </div>
        </CardContent>

        {/* Confirm before saving an EDIT — replyagent prompt parity. */}
        <AlertDialog open={confirmSaveOpen} onOpenChange={setConfirmSaveOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t("roles_section.confirm_save_title")}</AlertDialogTitle>
              <AlertDialogDescription>
                {t("roles_section.confirm_save_desc")}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t("roles_section.btn_cancel")}</AlertDialogCancel>
              <AlertDialogAction onClick={() => { setConfirmSaveOpen(false); doSave(); }}>
                {t("roles_section.btn_yes_continue")}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </Card>
    );
  }

  /* ── LIST VIEW ─────────────────────────────────────────────── */
  return (
    <Card className={cn("rounded-[2rem] border overflow-hidden shadow-sm transition-all duration-300", card, border)}>
      <CardContent className="p-0">
        {/* Header */}
        <div className={cn("px-8 py-5 border-b flex items-center justify-between", border)}>
          <div className="flex items-center gap-4">
            <div className={cn("p-2.5 rounded-xl shadow-sm", dark ? "bg-primary/15" : "bg-primary/10")}>
              <Shield className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className={cn("text-[16px] font-bold tracking-tight", text)}>{t("roles_section.header_title")}</h1>
              <div className="flex items-center gap-2 mt-1">
                <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[11px] font-semibold flex items-center gap-1">
                  <ShieldCheck size={10} /> {t("roles_section.stat_active_count", { count: activeRoles.length })}
                </span>
                <span className={cn("px-2 py-0.5 rounded-md text-[11px] font-semibold flex items-center gap-1", dark ? "bg-slate-800 text-slate-400" : "bg-slate-100 text-slate-500")}>
                  <Archive size={10} /> {t("roles_section.stat_archived_count", { count: archivedRoles.length })}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs + Actions */}
        <div className={cn("px-6 border-b flex flex-wrap items-center justify-between gap-3", softBorder)}>
            <div className="flex gap-6">
              {[
                { key: "active",   label: t("roles_section.tab_active"),   icon: ShieldCheck, count: activeRoles.length },
                { key: "archived", label: t("roles_section.tab_archived"), icon: Archive,     count: archivedRoles.length },
              ].map((tab) => {
                const active = activeTab === tab.key;
                return (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key as any)}
                    className={cn(
                      "flex items-center gap-2 py-5 text-[12px] font-semibold border-b-2 transition-all",
                      active ? "border-primary text-primary" : cn("border-transparent hover:text-primary", sub)
                    )}
                  >
                    <tab.icon size={12} />
                    {tab.label}
                    <span className={cn(
                      "px-1.5 py-0.5 rounded-md text-[9px] font-black",
                      active ? "bg-primary/10 text-primary" : dark ? "bg-slate-800 text-slate-400" : "bg-slate-100 text-slate-500"
                    )}>
                      {tab.count}
                    </span>
                  </button>
                );
              })}
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                <Input
                  placeholder={t("roles_section.placeholder_search_roles")}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className={cn(inputCls, "h-10 pl-9 w-56")}
                />
              </div>
              <button onClick={() => { resetForm(); setView("add"); }} className={primaryBtn}>
                <Plus size={12} /> {t("roles_section.btn_add_role")}
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="p-6">
            {isLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className={cn("h-32 rounded-[1.5rem] animate-pulse", dark ? "bg-slate-900/60" : "bg-slate-100")} />
                ))}
              </div>
            ) : filteredRoles.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center space-y-4">
                <div className="w-14 h-14 bg-primary/10 rounded-2xl flex items-center justify-center">
                  <Shield className="w-6 h-6 text-primary" />
                </div>
                <div className="space-y-1">
                  <p className={cn("text-[14px] font-semibold", text)}>
                    {activeTab === "active" ? t("roles_section.empty_title_active") : t("roles_section.empty_title_archived")}
                  </p>
                  <p className={cn("text-[11px] font-medium opacity-60 max-w-xs", sub)}>
                    {activeTab === "active"
                      ? t("roles_section.empty_desc_active")
                      : t("roles_section.empty_desc_archived")}
                  </p>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredRoles.map((role: any) => {
                  const permCount = Array.isArray(role.permissions) ? role.permissions.length : 0;
                  const maxPerms = totalPerms || 15;
                  const rowPct = Math.min((permCount / maxPerms) * 100, 100);
                  const RoleIcon = ICONS.find((ic) => ic.name === role.iconName)?.icon || Shield;

                  return (
                    <div
                      key={role.id}
                      className={cn(
                        "group flex flex-col p-5 rounded-[1.5rem] border transition-all hover:shadow-md hover:border-primary/30",
                        softBg,
                        softBorder
                      )}
                    >
                      <div className="flex items-start justify-between mb-4">
                        <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center transition-all", "bg-primary/10 text-primary group-hover:bg-primary group-hover:text-white")}>
                          <RoleIcon size={18} />
                        </div>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          {/* System roles cannot be edited or archived */}
                          {!role.isSystem && activeTab === "active" && (
                            <button
                              onClick={() => handleManage(role)}
                              title={t("roles_section.tooltip_edit_role")}
                              className={cn(
                                "w-8 h-8 rounded-lg flex items-center justify-center transition-all",
                                dark ? "bg-slate-900 text-slate-400 hover:bg-primary hover:text-white" : "bg-white border border-slate-200 text-slate-500 hover:bg-primary hover:text-white hover:border-primary"
                              )}
                            >
                              <Pencil size={12} />
                            </button>
                          )}
                          {!role.isSystem && (
                            <button
                              onClick={() => updateMutation.mutate({ id: role.id, data: { isArchived: !role.isArchived } })}
                              title={activeTab === "active" ? t("roles_section.tooltip_archive") : t("roles_section.tooltip_restore")}
                              className={cn(
                                "w-8 h-8 rounded-lg flex items-center justify-center transition-all",
                                activeTab === "active"
                                  ? dark ? "bg-slate-900 text-slate-400 hover:bg-rose-500 hover:text-white" : "bg-white border border-slate-200 text-slate-500 hover:bg-rose-500 hover:text-white hover:border-rose-500"
                                  : "bg-emerald-500 text-white"
                              )}
                            >
                              {activeTab === "active" ? <Archive size={12} /> : <RotateCcw size={12} />}
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="flex-1 space-y-1 mb-4">
                        <h4 className={cn("text-[13px] font-black tracking-tight group-hover:text-primary transition-colors", text)}>
                          {role.name}
                        </h4>
                        <p className={cn("text-[11px] font-medium line-clamp-2 leading-relaxed opacity-60", sub)}>
                          {role.description || t("roles_section.no_description")}
                        </p>
                      </div>

                      <div className="space-y-2 pt-3 border-t" style={{ borderColor: dark ? "rgb(30 41 59)" : "rgb(241 245 249)" }}>
                        <div className="flex items-center justify-between">
                          <span className={cn("text-[10px] font-semibold", sub)}>{t("roles_section.label_permissions")}</span>
                          <span className={cn("text-[10px] font-black", text)}>{permCount}</span>
                        </div>
                        <div className={cn("h-1 rounded-full overflow-hidden", dark ? "bg-slate-800" : "bg-slate-100")}>
                          <div className="h-full bg-primary rounded-full transition-all duration-500" style={{ width: `${rowPct}%` }} />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
      </CardContent>
    </Card>
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
