import { useEffect, useMemo, useState } from "react";
import {
  Plug,
  Plus,
  Trash2,
  RefreshCcw,
  Settings as SettingsIcon,
  ChevronLeft,
  Copy,
  ArrowRight,
  MoreHorizontal,
  Pencil,
  ListChecks,
  Info,
  Search,
  X,
  Webhook,
  CircleAlert,
} from "lucide-react";
import { format } from "date-fns";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useTheme } from "@/contexts/ThemeContext";
import { formatInWorkspaceTz, useWorkspaceTimezone } from "@/contexts/WorkspaceTimezoneContext";

/**
 * Visual APIs — 1:1 mirror of replyagent's `VisualApis.vue`
 * (`gateway-frontend/src/views/Workspaces/Settings/VisualApis.vue`).
 *
 * Three views: LIST / MANAGE / LOGS. LIST is just a table + 3-dot menu;
 * MANAGE is the field-mapping screen (system + custom field groups, prefix /
 * key picker / postfix per row, tags-on-create + tags-on-update, duplicate
 * action radios, Test / Live switch); LOGS shows per-request status with
 * pagination.
 *
 * Backend: `/api/integrations/api-triggers` (controller in
 * `integrations.controller.ts`) — mirrors `ApiTriggersController.php`.
 */

// Replyagent's `state.data.contact_fields` minus source / created_at / avatar
// (those are excluded in VisualApis.vue line 1273). Labels match en-US.json.
const SYSTEM_FIELDS: Array<{
  value: string;
  label: string;
  isIndexable?: boolean;
  primary?: boolean;
}> = [
  { value: "id", label: "Contact ID" },
  { value: "first_name", label: "First name" },
  { value: "last_name", label: "Last name" },
  { value: "title", label: "Title" },
  { value: "primary_mobile", label: "Mobile number", primary: true, isIndexable: true },
  { value: "primary_whatsapp", label: "WhatsApp number", primary: true, isIndexable: true },
  { value: "primary_email", label: "Email address", primary: true, isIndexable: true },
  { value: "instagram_handler", label: "Instagram handler" },
];

function safeParseJSON<T = any>(raw: any, fallback: T): T {
  if (raw == null) return fallback;
  if (typeof raw === "object") return raw as T;
  try {
    return JSON.parse(String(raw));
  } catch {
    return fallback;
  }
}

export default function VisualAPISection() {
  const { mode } = useTheme();
  const dark = mode === "dark";
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const workspaceTz = useWorkspaceTimezone();

  const [viewMode, setViewMode] = useState<"LIST" | "MANAGE" | "LOGS">("LIST");
  const [activeTriggerId, setActiveTriggerId] = useState<string | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [renameTarget, setRenameTarget] = useState<any | null>(null);
  const [renameInput, setRenameInput] = useState("");
  const [deleteConfirmation, setDeleteConfirmation] = useState<any | null>(null);
  const [newTriggerName, setNewTriggerName] = useState("");
  const [nameError, setNameError] = useState<string | null>(null);
  const [logsPage, setLogsPage] = useState(1);

  // Mapping picker modal state — replyagent shows this when the user clicks
  // the "Select a key to map" box; lets them pick a flattened payload key.
  const [pickerForFieldSlug, setPickerForFieldSlug] = useState<string | null>(null);
  const [pickerSearch, setPickerSearch] = useState("");

  // Local working copy of the trigger being managed (form state). Hydrates
  // from the GET /api-triggers/:id call. Saves are individual fields the
  // user actually changes.
  const [managed, setManaged] = useState<any | null>(null);

  // ── Design tokens (preserved from existing EZCONN card design) ─────
  const card = dark ? "bg-[#0f1829]" : "bg-white";
  const border = dark ? "border-slate-800" : "border-slate-200";
  const text = dark ? "text-white" : "text-slate-900";
  const sub = dark ? "text-slate-500" : "text-slate-400";
  const softBg = dark ? "bg-slate-950/40" : "bg-slate-50/50";
  const softBorder = dark ? "border-slate-800" : "border-slate-100";

  const inputCls = cn(
    "w-full h-11 rounded-xl text-[13px] font-bold transition-all px-4 border outline-none",
    "focus:ring-2 focus:ring-primary/30 focus:border-primary/50",
    dark ? "bg-slate-950/50 border-slate-800 text-white" : "bg-white border-slate-200 text-slate-900",
  );

  const outlineBtn = cn(
    "h-11 px-6 rounded-xl border text-[11px] font-semibold transition-all flex items-center gap-2",
    dark
      ? "border-slate-800 text-slate-300 hover:border-primary/40 hover:text-primary"
      : "border-slate-200 text-slate-700 hover:border-primary/40 hover:text-primary",
  );

  const primaryOutlineBtn = cn(
    "h-10 px-6 rounded-xl border text-[11px] font-semibold transition-all flex items-center gap-2",
    "border-primary text-primary hover:bg-primary hover:text-white",
  );

  const primaryBtn =
    "h-11 px-7 rounded-xl bg-primary hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed text-white text-[11px] font-semibold transition-all shadow-lg shadow-primary/20 flex items-center gap-2";

  const labelCls = cn("block text-[11px] font-semibold", sub);

  // ── Data fetchers ────────────────────────────────────────────────
  const { data: triggers } = useQuery<any[]>({
    queryKey: ["/api/integrations/api-triggers"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/integrations/api-triggers");
      return res.json();
    },
  });

  // Single trigger (Manage view) — includes mapping / mapped_keys / new_keys
  // / created_tags / updated_tags.
  const { data: managedRaw } = useQuery<any>({
    queryKey: ["/api/integrations/api-triggers", activeTriggerId],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/integrations/api-triggers/${activeTriggerId}`);
      return res.json();
    },
    enabled: !!activeTriggerId && viewMode === "MANAGE",
  });

  // Hydrate local form when the server payload arrives. useEffect (not
  // useMemo) because this is a side-effect — useMemo's contract is "return
  // a memoised value", not "run effects".
  useEffect(() => {
    if (!managedRaw) return;
    setManaged({
      ...managedRaw,
      mapping: safeParseJSON(managedRaw.mapping, [] as any[]),
      mapped_keys: safeParseJSON(managedRaw.mapped_keys, null) as Record<string, any> | null,
      new_keys: safeParseJSON(managedRaw.new_keys, null) as Record<string, any> | null,
      created_tags: safeParseJSON(managedRaw.created_tags, [] as any[]),
      updated_tags: safeParseJSON(managedRaw.updated_tags, [] as any[]),
    });
  }, [managedRaw]);

  // Tags + custom fields for the Manage view pickers.
  const { data: tags } = useQuery<any[]>({
    queryKey: ["/api/tags/data", "workspace"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/tags/data?for=workspace");
      return res.json();
    },
  });
  const { data: customFields } = useQuery<any[]>({
    queryKey: ["/api/custom-fields"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/custom-fields");
      const json = await res.json();
      return Array.isArray(json) ? json : json?.custom_fields ?? [];
    },
  });

  // Logs (LOGS view).
  const {
    data: logs,
    refetch: refetchLogs,
    isLoading: logsLoading,
  } = useQuery<any>({
    queryKey: ["/api/integrations/api-triggers", activeTriggerId, "logs", logsPage],
    queryFn: async () => {
      if (!activeTriggerId) return null;
      const res = await apiRequest(
        "GET",
        `/api/integrations/api-triggers/${activeTriggerId}/logs?page=${logsPage}&limit=20`,
      );
      return res.json();
    },
    enabled: !!activeTriggerId && viewMode === "LOGS",
  });

  // ── Mutations ────────────────────────────────────────────────────
  const createMutation = useMutation({
    mutationFn: async (name: string) => {
      const res = await apiRequest("POST", "/api/integrations/api-triggers", { name });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/integrations/api-triggers"] });
      toast({ title: "Successfully created", description: "Visual API is ready to receive data." });
      setIsCreateModalOpen(false);
      setNewTriggerName("");
      setNameError(null);
    },
    onError: (err: any) => {
      toast({
        title: "Error",
        description: err?.message ?? "Could not create trigger.",
        variant: "destructive",
      });
    },
  });

  const renameMutation = useMutation({
    mutationFn: async (payload: { id: string; name: string }) => {
      const res = await apiRequest("PATCH", `/api/integrations/api-triggers/${payload.id}`, {
        name: payload.name,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/integrations/api-triggers"] });
      toast({ title: "Successfully updated" });
      setRenameTarget(null);
      setRenameInput("");
    },
  });

  const saveManageMutation = useMutation({
    mutationFn: async () => {
      if (!managed) return null;
      // First-name guard mirrors replyagent's `isFirstNameMapped` check —
      // refuse to save if the first_name row has no prefix/key/postfix.
      const firstNameRow = managed.mapping.find((m: any) => m.slug === "first_name");
      const firstNameOk =
        firstNameRow &&
        ((firstNameRow.prefix && firstNameRow.prefix !== "") ||
          (firstNameRow.key && firstNameRow.key !== "") ||
          (firstNameRow.postfix && firstNameRow.postfix !== ""));
      if (!firstNameOk) {
        throw new Error("You must map First Name field");
      }
      const payload: any = {
        mapping: managed.mapping,
        update_duplicates: !!managed.update_duplicates,
        created_tags: managed.created_tags ?? [],
        updated_tags: managed.updated_tags ?? [],
        index_field: managed.index_field ?? "primary_mobile",
        live: !!managed.live,
      };
      const res = await apiRequest(
        "PATCH",
        `/api/integrations/api-triggers/${managed.id}`,
        payload,
      );
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/integrations/api-triggers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/integrations/api-triggers", activeTriggerId] });
      toast({ title: "Successfully updated" });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err?.message, variant: "destructive" });
    },
  });

  // "Update Mapping" banner — swaps new_keys → mapped_keys server-side.
  const updateKeysMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("PATCH", `/api/integrations/api-triggers/${managed.id}`, {
        update_keys: true,
        mapping: null,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/integrations/api-triggers", activeTriggerId] });
      toast({ title: "Mapping updated" });
    },
  });

  // Live / Test switch — replyagent only flips this independently; we send
  // just `live` so the back-end keeps the rest of the row untouched.
  const liveToggleMutation = useMutation({
    mutationFn: async (live: boolean) => {
      const res = await apiRequest("PATCH", `/api/integrations/api-triggers/${managed.id}`, { live });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/integrations/api-triggers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/integrations/api-triggers", activeTriggerId] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number | string) => {
      await apiRequest("DELETE", `/api/integrations/api-triggers/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/integrations/api-triggers"] });
      toast({ title: "Deleted" });
      setDeleteConfirmation(null);
    },
  });

  // ── Helpers ──────────────────────────────────────────────────────
  const handleCreateTrigger = () => {
    setNameError(null);
    if (!newTriggerName.trim()) {
      setNameError("API name is required");
      return;
    }
    createMutation.mutate(newTriggerName.trim());
  };

  const copyToClipboard = (val: string) => {
    navigator.clipboard.writeText(val);
    toast({ title: "Link copied" });
  };

  const getWebhookUrl = (slug: string) =>
    `${window.location.origin}/api/integrations/api-triggers/webhook/${slug}`;

  // Open Manage: navigate, then the query fetches the full row.
  const openManage = (trigger: any) => {
    setActiveTriggerId(String(trigger.id));
    setManaged(null);
    setViewMode("MANAGE");
  };

  const openLogs = (trigger: any) => {
    setActiveTriggerId(String(trigger.id));
    setLogsPage(1);
    setViewMode("LOGS");
  };

  const goBack = () => {
    setViewMode("LIST");
    setActiveTriggerId(null);
    setManaged(null);
  };

  // Pull/initialise a mapping row by slug — the form state holds an array
  // (matches what we POST to the server) but the UI works by-slug.
  const getMappingRow = (slug: string) => {
    if (!managed) return { slug, key: null, prefix: null, postfix: null };
    return managed.mapping.find((m: any) => m.slug === slug) ?? { slug, key: null, prefix: null, postfix: null };
  };

  const updateMappingRow = (slug: string, patch: Partial<{ key: string | null; prefix: string | null; postfix: string | null }>) => {
    setManaged((prev: any) => {
      if (!prev) return prev;
      const existing = prev.mapping.find((m: any) => m.slug === slug);
      const next = existing
        ? prev.mapping.map((m: any) => (m.slug === slug ? { ...m, ...patch } : m))
        : [...prev.mapping, { slug, key: null, prefix: null, postfix: null, ...patch }];
      return { ...prev, mapping: next };
    });
  };

  const removeMappingKey = (slug: string) => updateMappingRow(slug, { key: null });

  // Filter the available payload keys against the search box. Backed by
  // `managed.mapped_keys` — the dict the public webhook populated.
  const filteredKeys = useMemo(() => {
    if (!managed?.mapped_keys) return {} as Record<string, any>;
    const q = pickerSearch.trim().toLowerCase();
    if (!q) return managed.mapped_keys as Record<string, any>;
    const filtered: Record<string, any> = {};
    for (const [k, v] of Object.entries(managed.mapped_keys)) {
      if (k.toLowerCase().includes(q) || (v != null && String(v).toLowerCase().includes(q))) {
        filtered[k] = v;
      }
    }
    return filtered;
  }, [managed?.mapped_keys, pickerSearch]);

  // Header content per view (matches replyagent — title + subtitle never
  // change between views, only the right-side actions do).
  const headerTitle = "Visual APIs";
  const headerSub = "Receive data from external platforms.";

  // ── Render ────────────────────────────────────────────────────────
  return (
    <>
      <Card className={cn("rounded-[2rem] border overflow-hidden shadow-sm transition-all duration-300", card, border)}>
        <CardContent className="p-0">
          {/* Header — same icon/title/subtitle across LIST/MANAGE/LOGS, only
              right-side controls change. Mirrors replyagent's `panel_heading`. */}
          <div className={cn("px-8 py-5 border-b flex items-center justify-between", border)}>
            <div className="flex items-center gap-4">
              <div className={cn("p-2.5 rounded-xl shadow-sm", "bg-primary/10")}>
                <Plug className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h1 className={cn("text-[16px] font-bold tracking-tight", text)}>{headerTitle}</h1>
                <p className={cn("text-[11px] font-bold mt-0.5 opacity-60 max-w-2xl", sub)}>{headerSub}</p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {viewMode === "LIST" && (
                <button onClick={() => setIsCreateModalOpen(true)} className={primaryOutlineBtn}>
                  <Plus size={12} /> Add
                </button>
              )}
              {viewMode === "MANAGE" && (
                <button onClick={goBack} className={primaryOutlineBtn}>
                  <ChevronLeft size={12} /> Go back
                </button>
              )}
              {viewMode === "LOGS" && (
                <>
                  <button onClick={() => refetchLogs()} className={primaryOutlineBtn}>
                    <RefreshCcw size={12} className={cn(logsLoading && "animate-spin")} /> Refresh Logs
                  </button>
                  <button onClick={goBack} className={outlineBtn}>
                    <ChevronLeft size={12} /> Go back
                  </button>
                </>
              )}
            </div>
          </div>

          {/* ───────────────────── LIST VIEW ───────────────────── */}
          {viewMode === "LIST" && (
            <div className="p-8">
              {!triggers || triggers.length === 0 ? (
                <div className={cn("rounded-[1.5rem] border py-16 px-8 flex flex-col items-center justify-center text-center space-y-5", softBg, softBorder)}>
                  <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                    <Webhook className="w-8 h-8 text-primary" />
                  </div>
                  <div className="space-y-1.5 max-w-sm">
                    <h3 className={cn("text-[14px] font-black tracking-tight", text)}>Visual APIs</h3>
                    <p className={cn("text-[11px] font-medium opacity-60 leading-relaxed", sub)}>
                      Create your first Visual API
                    </p>
                  </div>
                  <button onClick={() => setIsCreateModalOpen(true)} className={primaryOutlineBtn}>
                    <Plus size={12} /> Add
                  </button>
                </div>
              ) : (
                <div className={cn("rounded-[1.5rem] border overflow-hidden", softBorder, softBg)}>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className={cn("border-b", softBorder, dark ? "bg-slate-900/40" : "bg-white/60")}>
                          <th className={cn("px-6 py-4 text-left text-[11px] font-semibold", sub)}>Name</th>
                          <th className={cn("px-6 py-4 text-left text-[11px] font-semibold", sub)}>URL</th>
                          <th className={cn("px-6 py-4 text-left text-[11px] font-semibold", sub)}>Status</th>
                          <th className={cn("px-6 py-4 text-left text-[11px] font-semibold", sub)}>Created at</th>
                          <th className={cn("px-6 py-4 text-right text-[11px] font-semibold", sub)}>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {triggers.map((trigger: any) => (
                          <tr
                            key={trigger.id}
                            className={cn(
                              "border-b transition-colors group",
                              softBorder,
                              dark ? "hover:bg-slate-900/40" : "hover:bg-white/80",
                            )}
                          >
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                                  <Plug size={14} className="text-primary" />
                                </div>
                                <span className={cn("text-[13px] font-black", text)}>{trigger.name}</span>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-2">
                                <code className={cn("px-2.5 py-1 rounded-md text-[10px] font-bold border max-w-[240px] truncate", softBorder, dark ? "bg-slate-900/50" : "bg-slate-50")}>
                                  {getWebhookUrl(trigger.slug)}
                                </code>
                                <button
                                  onClick={() => copyToClipboard(getWebhookUrl(trigger.slug))}
                                  className={cn("w-7 h-7 rounded-md flex items-center justify-center transition-all", dark ? "hover:bg-slate-800 text-primary" : "hover:bg-slate-100 text-primary")}
                                  title="Copy"
                                >
                                  <Copy size={11} />
                                </button>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              {trigger.live ? (
                                <Badge variant="outline" className="h-5 px-2 rounded-md border-emerald-500/30 bg-emerald-500/5 text-emerald-600 dark:text-emerald-400 text-[10px] font-semibold">
                                  Live
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="h-5 px-2 rounded-md border-rose-500/30 bg-rose-500/5 text-rose-600 dark:text-rose-400 text-[10px] font-semibold">
                                  Test
                                </Badge>
                              )}
                            </td>
                            <td className={cn("px-6 py-4 text-[11px] font-bold", sub)}>
                              {trigger.created_at ? formatInWorkspaceTz(trigger.created_at, "PP p", workspaceTz) : "—"}
                            </td>
                            <td className="px-6 py-4 text-right">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <button
                                    className={cn("w-9 h-9 rounded-lg border flex items-center justify-center transition-all ml-auto", dark ? "border-slate-800 hover:border-primary/40 hover:text-primary text-slate-400" : "border-slate-200 hover:border-primary/40 hover:text-primary text-slate-500")}
                                  >
                                    <MoreHorizontal size={14} />
                                  </button>
                                </DropdownMenuTrigger>
                                {/* Action menu mirrors replyagent's 4-item list:
                                    Manage / Rename / Delete / Logs. */}
                                <DropdownMenuContent align="end" className={cn("rounded-xl border p-1.5 w-48", card, border)}>
                                  <DropdownMenuItem
                                    className="rounded-lg text-[12px] font-bold py-2 px-3 flex gap-2 cursor-pointer"
                                    onClick={() => openManage(trigger)}
                                  >
                                    <SettingsIcon size={13} className="opacity-60" /> Manage
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    className="rounded-lg text-[12px] font-bold py-2 px-3 flex gap-2 cursor-pointer text-blue-500 focus:text-blue-500 focus:bg-blue-500/10"
                                    onClick={() => {
                                      setRenameTarget(trigger);
                                      setRenameInput(trigger.name);
                                    }}
                                  >
                                    <Pencil size={13} /> Rename
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    className="rounded-lg text-[12px] font-bold py-2 px-3 flex gap-2 cursor-pointer text-rose-500 focus:text-rose-500 focus:bg-rose-500/10"
                                    onClick={() => setDeleteConfirmation(trigger)}
                                  >
                                    <Trash2 size={13} /> Delete
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator className="my-1" />
                                  <DropdownMenuItem
                                    className="rounded-lg text-[12px] font-bold py-2 px-3 flex gap-2 cursor-pointer"
                                    onClick={() => openLogs(trigger)}
                                  >
                                    <ListChecks size={13} className="opacity-60" /> Logs
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className={cn("px-6 py-3 border-t text-[11px] font-semibold", softBorder, sub, dark ? "bg-slate-900/40" : "bg-white/60")}>
                    Showing {triggers.length} of {triggers.length} triggers
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ──────────────────── MANAGE VIEW ──────────────────── */}
          {viewMode === "MANAGE" && managed && (
            <div className="p-8 space-y-6">
              {/* Top row — name + endpoint URL on the left, Test/Live switch
                  on the right (replyagent panel_body). */}
              <div className={cn("rounded-[1.5rem] border p-6 flex flex-col md:flex-row md:items-center gap-4 md:gap-6", softBg, softBorder)}>
                <div className="flex-1 min-w-0">
                  <p className={cn("text-[14px] font-black mb-2", text)}>{managed.name}</p>
                  <div className="flex items-center gap-2 min-w-0">
                    <code className={cn("px-2.5 py-1 rounded-md text-[11px] font-bold border truncate min-w-0 flex-1", softBorder, dark ? "bg-slate-900/50" : "bg-slate-50")}>
                      {getWebhookUrl(managed.slug)}
                    </code>
                    <button
                      onClick={() => copyToClipboard(getWebhookUrl(managed.slug))}
                      className={cn("w-7 h-7 rounded-md flex items-center justify-center shrink-0", dark ? "hover:bg-slate-800 text-primary" : "hover:bg-slate-100 text-primary")}
                    >
                      <Copy size={11} />
                    </button>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className={cn("text-[11px] font-semibold", !managed.live ? "text-rose-500" : "opacity-40")}>
                    Test
                  </span>
                  <Switch
                    checked={!!managed.live}
                    onCheckedChange={(checked) => {
                      // Replyagent's `toggleMode` refuses to flip Live=true
                      // until first_name is mapped (matches the "first_name
                      // required" guard in saveManageMutation). Block the
                      // toggle here so the user can't bypass it.
                      if (checked) {
                        const fn = (managed.mapping ?? []).find((m: any) => m.slug === "first_name");
                        const fnMapped =
                          fn &&
                          ((fn.prefix && fn.prefix !== "") ||
                            (fn.key && fn.key !== "") ||
                            (fn.postfix && fn.postfix !== ""));
                        if (!fnMapped) {
                          toast({
                            title: "Error",
                            description: "You must map First Name field",
                            variant: "destructive",
                          });
                          return;
                        }
                      }
                      setManaged((p: any) => ({ ...p, live: checked }));
                      liveToggleMutation.mutate(checked);
                    }}
                    className="data-[state=checked]:bg-primary"
                  />
                  <span className={cn("text-[11px] font-semibold", managed.live ? "text-emerald-500" : "opacity-40")}>
                    Live
                  </span>
                </div>
              </div>

              {/* Mapping body — title + always-on first_name info banner +
                  conditional new_keys "Update Mapping" prompt + per-group
                  rows. Falls back to a yellow waiting banner when no
                  payload has been received yet. */}
              <div className={cn("rounded-[1.5rem] border p-6 space-y-4", softBg, softBorder)}>
                <p className={cn("text-[14px] font-black", text)}>Map incoming field with the fields of the system</p>

                <div className={cn("rounded-xl border p-4 flex items-center gap-3 text-[12px] font-medium", "border-sky-500/30 bg-sky-500/5 text-sky-600 dark:text-sky-400")}>
                  <Info size={14} /> Please note that you must map First Name system field.
                </div>

                {managed.new_keys && (
                  <div className={cn("rounded-xl border p-4 flex items-center justify-between gap-3", "border-sky-500/30 bg-sky-500/5")}>
                    <p className="text-[12px] font-medium text-sky-700 dark:text-sky-300">
                      We have received a new request. Would you like to update current mapping?
                    </p>
                    <button onClick={() => updateKeysMutation.mutate()} className={primaryOutlineBtn}>
                      Update Mapping
                    </button>
                  </div>
                )}

                {!managed.mapped_keys ? (
                  <div className={cn("rounded-xl border p-4 flex items-center gap-3 text-[12px] font-medium", "border-amber-500/30 bg-amber-500/5 text-amber-600 dark:text-amber-400")}>
                    <CircleAlert size={14} /> Send JSON data as a POST request to above URL to start mapping.
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* System fields group */}
                    <div className="space-y-2">
                      <p className={cn("text-[12px] font-black", text)}>System fields</p>
                      <div className={cn("divide-y border-b", softBorder)}>
                        {SYSTEM_FIELDS.map((field) => (
                          <MappingRow
                            key={field.value}
                            label={field.label}
                            slug={field.value}
                            primary={field.primary}
                            isIndexable={field.isIndexable}
                            isFirstName={field.value === "first_name"}
                            currentIndexField={managed.index_field}
                            onIndexFieldChange={(val) => setManaged((p: any) => ({ ...p, index_field: val }))}
                            mappingRow={getMappingRow(field.value)}
                            updateRow={(patch) => updateMappingRow(field.value, patch)}
                            removeKey={() => removeMappingKey(field.value)}
                            openPicker={() => {
                              setPickerForFieldSlug(field.value);
                              setPickerSearch("");
                            }}
                            inputCls={inputCls}
                            softBorder={softBorder}
                            sub={sub}
                            text={text}
                            dark={dark}
                          />
                        ))}
                      </div>
                    </div>

                    {/* Custom fields group */}
                    {customFields && customFields.length > 0 && (
                      <div className="space-y-2">
                        <p className={cn("text-[12px] font-black", text)}>Custom fields</p>
                        <div className={cn("divide-y border-b", softBorder)}>
                          {customFields.map((cf: any) => (
                            <MappingRow
                              key={cf.slug ?? cf.id}
                              label={cf.label ?? cf.name}
                              slug={cf.slug}
                              mappingRow={getMappingRow(cf.slug)}
                              updateRow={(patch) => updateMappingRow(cf.slug, patch)}
                              removeKey={() => removeMappingKey(cf.slug)}
                              openPicker={() => {
                                setPickerForFieldSlug(cf.slug);
                                setPickerSearch("");
                              }}
                              inputCls={inputCls}
                              softBorder={softBorder}
                              sub={sub}
                              text={text}
                              dark={dark}
                            />
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Tags */}
                    <div className="space-y-4">
                      <p className={cn("text-[12px] font-black", text)}>Tags</p>
                      <TagsRow
                        label="Select tags to apply when a contact is triggered"
                        tags={tags ?? []}
                        selected={managed.created_tags ?? []}
                        onChange={(ids) => setManaged((p: any) => ({ ...p, created_tags: ids }))}
                        labelCls={labelCls}
                        softBorder={softBorder}
                        dark={dark}
                        sub={sub}
                        text={text}
                      />
                      <TagsRow
                        label="Select tags to apply when an existing contact is updated"
                        tags={tags ?? []}
                        selected={managed.updated_tags ?? []}
                        onChange={(ids) => setManaged((p: any) => ({ ...p, updated_tags: ids }))}
                        labelCls={labelCls}
                        softBorder={softBorder}
                        dark={dark}
                        sub={sub}
                        text={text}
                      />
                    </div>

                    {/* Duplicates radios */}
                    <div className="border-t pt-6 space-y-4">
                      <p className={cn("text-[12px] font-black", text)}>
                        What action would you like to take in case of duplicates found against non indexed field.
                      </p>
                      <label className="flex items-start gap-3 cursor-pointer">
                        <input
                          type="radio"
                          name="dup-action"
                          checked={!!managed.update_duplicates}
                          onChange={() => setManaged((p: any) => ({ ...p, update_duplicates: true }))}
                          className="mt-1 accent-[hsl(var(--primary))]"
                        />
                        <div>
                          <p className={cn("text-[13px] font-black", text)}>Update duplicates</p>
                          <p className={cn("text-[11px] font-medium opacity-60", sub)}>
                            If a contact is found against the Index Field, that contact will be updated with the data of this API.
                          </p>
                        </div>
                      </label>
                      <label className="flex items-start gap-3 cursor-pointer">
                        <input
                          type="radio"
                          name="dup-action"
                          checked={!managed.update_duplicates}
                          onChange={() => setManaged((p: any) => ({ ...p, update_duplicates: false }))}
                          className="mt-1 accent-[hsl(var(--primary))]"
                        />
                        <div>
                          <p className={cn("text-[13px] font-black", text)}>Skip duplicates</p>
                          <p className={cn("text-[11px] font-medium opacity-60", sub)}>
                            If a contact is found against the Index Field, that contact will not be updated with the data of this API.
                          </p>
                        </div>
                      </label>
                    </div>

                    {/* Footer Cancel + Save */}
                    <div className={cn("flex justify-end gap-2 pt-6 border-t", softBorder)}>
                      <button onClick={goBack} className={outlineBtn}>
                        Cancel
                      </button>
                      <button
                        onClick={() => saveManageMutation.mutate()}
                        disabled={saveManageMutation.isPending}
                        className={primaryBtn}
                      >
                        {saveManageMutation.isPending ? "Saving..." : "Save"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ────────────────────── LOGS VIEW ──────────────────────── */}
          {viewMode === "LOGS" && (
            <div className="p-8">
              <div className={cn("rounded-[1.5rem] border overflow-hidden", softBorder, softBg)}>
                {logs && logs.data && logs.data.length > 0 ? (
                  <>
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className={cn("border-b", softBorder, dark ? "bg-slate-900/40" : "bg-white/60")}>
                            <th className={cn("px-6 py-4 text-left text-[11px] font-semibold", sub)}>Created at</th>
                            <th className={cn("px-6 py-4 text-left text-[11px] font-semibold", sub)}>Status</th>
                            <th className={cn("px-6 py-4 text-left text-[11px] font-semibold", sub)}>Error Code</th>
                            <th className={cn("px-6 py-4 text-left text-[11px] font-semibold", sub)}>Error</th>
                          </tr>
                        </thead>
                        <tbody>
                          {logs.data.map((log: any) => {
                            const statusLower = String(log.status ?? "").toLowerCase();
                            const success = statusLower === "success";
                            return (
                              <tr key={log.id} className={cn("border-b transition-colors", softBorder, dark ? "hover:bg-slate-900/40" : "hover:bg-white/80")}>
                                <td className={cn("px-6 py-4 font-mono text-[11px] font-bold", sub)}>
                                  {log.created_at ? formatInWorkspaceTz(log.created_at, "PP p", workspaceTz) : "—"}
                                </td>
                                <td className="px-6 py-4">
                                  {success ? (
                                    <Badge variant="outline" className="h-5 px-2 rounded-md border-emerald-500/30 bg-emerald-500/5 text-emerald-600 dark:text-emerald-400 text-[10px] font-semibold">
                                      Success
                                    </Badge>
                                  ) : (
                                    <Badge variant="outline" className="h-5 px-2 rounded-md border-rose-500/30 bg-rose-500/5 text-rose-600 dark:text-rose-400 text-[10px] font-semibold">
                                      Failed
                                    </Badge>
                                  )}
                                </td>
                                <td className={cn("px-6 py-4 font-mono text-[11px] font-black", log.error_code ? "text-rose-500" : sub)}>
                                  {log.error_code || "—"}
                                </td>
                                <td className={cn("px-6 py-4 text-[12px] font-medium", text)}>
                                  {log.error || "—"}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                    {logs.last_page > 1 && (
                      <div className={cn("flex items-center justify-between gap-3 px-6 py-3 border-t", softBorder, dark ? "bg-slate-900/40" : "bg-white/60")}>
                        <span className={cn("text-[11px] font-semibold", sub)}>
                          Showing {logs.from} – {logs.to} of {logs.total}
                        </span>
                        <div className="flex items-center gap-1">
                          <button
                            disabled={logsPage <= 1}
                            onClick={() => setLogsPage((p) => Math.max(1, p - 1))}
                            className={cn(outlineBtn, "h-8 px-3 disabled:opacity-40")}
                          >
                            <ChevronLeft size={11} /> Previous
                          </button>
                          <button
                            disabled={logsPage >= logs.last_page}
                            onClick={() => setLogsPage((p) => p + 1)}
                            className={cn(outlineBtn, "h-8 px-3 disabled:opacity-40")}
                          >
                            Next <ChevronLeft size={11} className="rotate-180" />
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="py-20 px-8 flex flex-col items-center justify-center text-center space-y-4">
                    <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                      <Plug className="w-8 h-8 text-primary" />
                    </div>
                    <div className="space-y-1">
                      <h3 className={cn("text-[14px] font-black tracking-tight", text)}>No Logs</h3>
                      <p className={cn("text-[11px] font-medium opacity-60", sub)}>No logs found</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ─────────────────── Create modal ─────────────────── */}
      {/* Replyagent's add modal: just a Name field + Save. index_field +
          mapping + tags are configured later in the Manage view. */}
      <Dialog open={isCreateModalOpen} onOpenChange={(open) => { if (!open) { setIsCreateModalOpen(false); setNameError(null); setNewTriggerName(""); } }}>
        <DialogContent className={cn("border p-0 overflow-hidden rounded-[2rem] max-w-md", card, border)}>
          <div className="p-6 space-y-5">
            <DialogHeader>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
                  <Plug size={18} />
                </div>
                <div className="text-left">
                  <DialogTitle className={cn("text-[14px] font-semibold", text)}>Add</DialogTitle>
                  <DialogDescription className={cn("text-[11px] font-medium opacity-60 mt-0.5", sub)}>
                    Create a new Visual API trigger.
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>

            <div className="space-y-2">
              <label className={labelCls}>Name</label>
              <input
                placeholder="e.g. Lead Capture"
                value={newTriggerName}
                onChange={(e) => {
                  setNewTriggerName(e.target.value.slice(0, 100));
                  setNameError(null);
                }}
                onKeyDown={(e) => e.key === "Enter" && handleCreateTrigger()}
                maxLength={100}
                className={inputCls}
              />
              {nameError && (
                <p className="text-rose-500 text-[11px] font-bold mt-1">{nameError}</p>
              )}
            </div>

            <div className={cn("flex justify-end gap-2 pt-4 border-t", softBorder)}>
              <button onClick={() => { setIsCreateModalOpen(false); setNewTriggerName(""); setNameError(null); }} className={outlineBtn}>
                Cancel
              </button>
              <button onClick={handleCreateTrigger} disabled={createMutation.isPending} className={primaryBtn}>
                {createMutation.isPending ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ─────────────────── Rename modal ─────────────────── */}
      <Dialog open={!!renameTarget} onOpenChange={(open) => { if (!open) setRenameTarget(null); }}>
        <DialogContent className={cn("border p-0 overflow-hidden rounded-[2rem] max-w-md", card, border)}>
          <div className="p-6 space-y-5">
            <DialogHeader>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-500 shrink-0">
                  <Pencil size={18} />
                </div>
                <div className="text-left">
                  <DialogTitle className={cn("text-[14px] font-semibold", text)}>Rename</DialogTitle>
                  <DialogDescription className={cn("text-[11px] font-medium opacity-60 mt-0.5", sub)}>
                    Update the trigger name.
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>

            <div className="space-y-2">
              <label className={labelCls}>Name</label>
              <input
                value={renameInput}
                onChange={(e) => setRenameInput(e.target.value.slice(0, 100))}
                maxLength={100}
                className={inputCls}
              />
            </div>

            <div className={cn("flex justify-end gap-2 pt-4 border-t", softBorder)}>
              <button onClick={() => setRenameTarget(null)} className={outlineBtn}>
                Cancel
              </button>
              <button
                onClick={() => renameMutation.mutate({ id: String(renameTarget.id), name: renameInput.trim() })}
                disabled={!renameInput.trim() || renameMutation.isPending}
                className={primaryBtn}
              >
                {renameMutation.isPending ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ─────────────────── Delete confirmation ─────────────────── */}
      <AlertDialog open={!!deleteConfirmation} onOpenChange={(open) => !open && setDeleteConfirmation(null)}>
        <AlertDialogContent className={cn("rounded-[2rem] border p-0 max-w-md overflow-hidden", card, border)}>
          <div className="p-6 space-y-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-500/10 flex items-center justify-center text-rose-500">
                <CircleAlert size={18} />
              </div>
              <div>
                <h2 className={cn("text-[14px] font-semibold", text)}>Are you sure?</h2>
                <p className={cn("text-[11px] font-medium opacity-60 mt-0.5 leading-relaxed", sub)}>
                  This action can not be undone. Do you want to proceed?
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <AlertDialogCancel className={cn(outlineBtn, "m-0")}>No</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => deleteMutation.mutate(deleteConfirmation.id)}
                className="h-11 px-7 rounded-xl bg-rose-500 hover:bg-rose-600 text-white text-[11px] font-semibold transition-all shadow-lg shadow-rose-500/20 flex items-center gap-2"
              >
                <Trash2 size={12} /> Yes
              </AlertDialogAction>
            </div>
          </div>
        </AlertDialogContent>
      </AlertDialog>

      {/* ─────────────────── Mapping picker modal ─────────────────── */}
      {/* Replyagent's "Select a key to map" — search input + list of
          payload keys (with value preview underneath). */}
      <Dialog open={!!pickerForFieldSlug} onOpenChange={(open) => { if (!open) { setPickerForFieldSlug(null); setPickerSearch(""); } }}>
        <DialogContent className={cn("border p-0 overflow-hidden rounded-[2rem] max-w-2xl", card, border)}>
          <div className="p-0">
            <div className={cn("px-4 py-3 border-b flex items-center gap-2", softBorder)}>
              <Search size={14} className={sub} />
              <input
                value={pickerSearch}
                onChange={(e) => setPickerSearch(e.target.value)}
                placeholder="Search"
                className={cn("flex-1 bg-transparent outline-none text-[13px] font-bold", text)}
              />
            </div>
            <div className="max-h-80 overflow-y-auto">
              {Object.keys(filteredKeys).length > 0 ? (
                <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                  {Object.entries(filteredKeys).map(([key, value]) => {
                    const current = pickerForFieldSlug ? getMappingRow(pickerForFieldSlug).key : null;
                    const selected = current === key;
                    return (
                      <li
                        key={key}
                        onClick={() => {
                          if (pickerForFieldSlug) {
                            updateMappingRow(pickerForFieldSlug, { key });
                          }
                          setPickerForFieldSlug(null);
                          setPickerSearch("");
                        }}
                        className={cn("px-4 py-2 cursor-pointer", selected ? "bg-primary/5" : dark ? "hover:bg-slate-900/40" : "hover:bg-slate-50")}
                      >
                        <p className={cn("text-[12px] font-black", selected ? "text-primary" : text)}>{key}</p>
                        <p className={cn("mt-0.5 text-[11px] font-medium opacity-60 truncate", sub)}>
                          {value == null ? "—" : String(value)}
                        </p>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <div className={cn("p-6 text-center text-[12px] font-medium", sub)}>No mapping found</div>
              )}
            </div>
            <div className={cn("border-t text-right p-4", softBorder)}>
              <button onClick={() => { setPickerForFieldSlug(null); setPickerSearch(""); }} className={outlineBtn}>
                Cancel
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

/**
 * Single mapping row (one for each system / custom field). Lays out
 * prefix input → arrow → clickable mapping-key box → postfix input,
 * mirroring replyagent's `grid grid-cols-2 gap-x-4 py-2 items-center`.
 */
function MappingRow(props: {
  label: string;
  slug: string;
  primary?: boolean;
  isIndexable?: boolean;
  isFirstName?: boolean;
  currentIndexField?: string;
  onIndexFieldChange?: (val: string) => void;
  mappingRow: { slug: string; key: string | null; prefix: string | null; postfix: string | null };
  updateRow: (patch: Partial<{ key: string | null; prefix: string | null; postfix: string | null }>) => void;
  removeKey: () => void;
  openPicker: () => void;
  inputCls: string;
  softBorder: string;
  sub: string;
  text: string;
  dark: boolean;
}) {
  const {
    label,
    primary,
    isIndexable,
    isFirstName,
    currentIndexField,
    onIndexFieldChange,
    mappingRow,
    updateRow,
    removeKey,
    openPicker,
    inputCls,
    softBorder,
    sub,
    text,
    dark,
    slug,
  } = props;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-2 py-3 items-start md:items-center">
      <div className="flex items-center gap-3">
        <div className="grow space-y-1">
          <div className="flex items-center gap-1">
            <span className={cn("text-[12px] font-bold", text)}>
              {label}{" "}
              {primary && (
                <span className={cn("text-[10px] font-semibold px-1.5 py-0.5 rounded ml-1", dark ? "bg-slate-800 text-slate-300" : "bg-slate-100 text-slate-600")}>
                  Primary
                </span>
              )}
            </span>
            {isFirstName && <span className="text-rose-500 text-[12px] font-black">*</span>}
          </div>
          {isIndexable && (
            <div className="flex items-center gap-2">
              <input
                type="radio"
                name="index_field"
                checked={currentIndexField === slug}
                onChange={() => onIndexFieldChange?.(slug)}
                className="accent-[hsl(var(--primary))]"
              />
              <span className={cn("text-[11px] font-medium", sub)}>Use as Index field</span>
              <span title="System will search the contact against the index field and update if exist." className={cn(sub)}>
                <Info size={11} />
              </span>
            </div>
          )}
        </div>
        <ArrowRight size={14} className={sub} />
      </div>
      <div className={cn("flex items-center gap-2 rounded-xl border px-2 overflow-x-auto", softBorder, dark ? "bg-slate-950/40" : "bg-white")}>
        <input
          type="text"
          placeholder="Prefix"
          value={mappingRow.prefix ?? ""}
          onChange={(e) => updateRow({ prefix: e.target.value })}
          className={cn("h-10 bg-transparent border-0 outline-none text-[12px] font-bold", "w-20 text-center")}
        />
        <div
          onClick={openPicker}
          className={cn("border rounded-md px-2 py-1 text-[11px] font-bold cursor-pointer min-w-[140px] flex items-center justify-between gap-2", softBorder, dark ? "bg-slate-900/50 hover:border-primary/40" : "bg-slate-50 hover:border-primary/40")}
        >
          {mappingRow.key ? (
            <>
              <span className={cn("truncate", text)}>{mappingRow.key}</span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  removeKey();
                }}
                className="text-rose-500 shrink-0"
                title="Clear"
              >
                <X size={11} />
              </button>
            </>
          ) : (
            <span className={cn("opacity-60", sub)}>Select a key to map</span>
          )}
        </div>
        <input
          type="text"
          placeholder="Postfix"
          value={mappingRow.postfix ?? ""}
          onChange={(e) => updateRow({ postfix: e.target.value })}
          className={cn("h-10 bg-transparent border-0 outline-none text-[12px] font-bold", "w-20 text-center")}
        />
      </div>
    </div>
  );
}

/** Multi-select tag chip picker — used for both the "tags on create" and
 *  "tags on update" rows. Replyagent uses its own `TagPicker.vue`; we
 *  reproduce its shape (toggle-on-click chips with a "Selected" highlight). */
function TagsRow(props: {
  label: string;
  tags: any[];
  selected: any[];
  onChange: (ids: any[]) => void;
  labelCls: string;
  softBorder: string;
  dark: boolean;
  sub: string;
  text: string;
}) {
  const { label, tags, selected, onChange, labelCls, softBorder, dark, sub, text } = props;
  const selectedIds = new Set(selected.map((s: any) => String(typeof s === "object" ? s.id : s)));
  const toggle = (tag: any) => {
    const id = String(tag.id);
    if (selectedIds.has(id)) {
      onChange(selected.filter((s: any) => String(typeof s === "object" ? s.id : s) !== id));
    } else {
      onChange([...selected, tag.id]);
    }
  };
  return (
    <div className="space-y-2">
      <label className={labelCls}>{label}</label>
      {tags.length === 0 ? (
        <p className={cn("text-[11px] font-medium opacity-60", sub)}>No tags created yet.</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {tags.map((tag: any) => {
            const active = selectedIds.has(String(tag.id));
            return (
              <button
                type="button"
                key={tag.id}
                onClick={() => toggle(tag)}
                className={cn(
                  "h-8 px-3 rounded-lg border text-[11px] font-bold transition-all",
                  active ? "border-primary bg-primary/10 text-primary" : cn(softBorder, dark ? "text-slate-300" : "text-slate-700"),
                )}
                style={
                  active
                    ? undefined
                    : tag.bg_color
                      ? { backgroundColor: tag.bg_color, color: tag.text_color }
                      : undefined
                }
              >
                {tag.name}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
