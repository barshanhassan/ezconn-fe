import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Cpu,
  Plus,
  Trash2,
  Edit2,
  ChevronLeft,
  ChevronDown,
  AlertCircle,
  Loader2,
  Database,
  Copy as CopyIcon,
  MoreVertical,
  UserCog,
  Search,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useTheme } from "@/contexts/ThemeContext";
import { useTranslation } from "react-i18next";

interface AITheme {
  id: string;
  name: string;
  subtitle: string;
  type: string;
  automation_id: string | null;
  channel: any;
  payload: string | null;
  properties: any;
}

interface AIProduct {
  id?: string;
  name: string;
  external_id?: string | null;
  payload?: string | null;
  link_text?: string | null;
  trigger_url?: string | null;
  properties?: any;
  ai_theme_id?: string;
}

type ViewMode =
  | "list"
  | "manage_theme"
  | "edit_product"
  | "edit_theme"
  | "user_access";

/**
 * AI Products — replyagent parity for the `ai-products` settings module.
 *
 * Three workspace-level concepts wire together here:
 *  - **Themes**: row in `ai_themes` linking a Baserow / Supabase table
 *    (via `properties.spreadsheet_id`) to an automation + a channel.
 *  - **Products**: row in `ai_products` representing a single sellable
 *    item under a theme; each gets a unique `trigger_url` deep link.
 *  - **User access**: polymorphic pivot via `user_accesses` lets
 *    workspace owners pick which agents see which themes.
 *
 * Card design preserve — only inner controls / forms / dropdowns match
 * replyagent. Backend endpoints (see `ai-themes.controller.ts` and
 * `ai-products.controller.ts`):
 *
 *    GET    /api/ai-themes
 *    GET    /api/ai-themes/:id
 *    POST   /api/ai-themes
 *    PATCH  /api/ai-themes/:id
 *    DELETE /api/ai-themes/:id
 *    GET    /api/ai-themes/:id/users
 *    POST   /api/ai-themes/:id/users/:userId/toggle
 *    GET    /api/ai-themes/:id/fields                  (Baserow field proxy)
 *    GET    /api/ai-themes/:theme/ai-products
 *    POST   /api/ai-themes/:theme/ai-products
 *    PATCH  /api/ai-themes/:theme/ai-products/:product
 *    DELETE /api/ai-themes/:theme/ai-products/:product
 */
export default function AIProductsSection() {
  const { mode } = useTheme();
  const dark = mode === "dark";
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { t } = useTranslation();

  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [selectedTheme, setSelectedTheme] = useState<AITheme | null>(null);
  const [editingTheme, setEditingTheme] = useState<Partial<AITheme> & { type?: string }>({});
  const [payloadEnabled, setPayloadEnabled] = useState(false);
  const [editingProduct, setEditingProduct] = useState<AIProduct | null>(null);
  const [deleteThemeOpen, setDeleteThemeOpen] = useState(false);
  const [productToDelete, setProductToDelete] = useState<AIProduct | null>(null);
  const [userSearchQuery, setUserSearchQuery] = useState("");

  // ── Design tokens (card design preserved from existing EZCONN section) ───
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

  const textareaCls = cn(
    "w-full rounded-xl text-[13px] font-mono transition-all px-4 py-3 border outline-none",
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

  // ─── Data fetches ─────────────────────────────────────────────────
  const { data: themesData, isLoading: themesLoading } = useQuery<any>({
    queryKey: ["/api/ai-themes"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/ai-themes");
      return res.json();
    },
  });
  const themes: AITheme[] = useMemo(() => {
    if (!themesData) return [];
    if (Array.isArray(themesData)) return themesData;
    if (Array.isArray(themesData?.themes)) return themesData.themes;
    return [];
  }, [themesData]);

  // Integrations check — drives the Add-Theme dropdown options. We hit the
  // generic integrations list endpoint and filter for the two providers we
  // care about. Replyagent's `wsStore.getIntegrationByType` parity.
  const { data: integrationsData } = useQuery<any>({
    queryKey: ["/api/integrations"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/integrations");
      return res.json();
    },
  });
  const integrationsList: any[] = useMemo(() => {
    if (Array.isArray(integrationsData)) return integrationsData;
    if (Array.isArray(integrationsData?.integrations)) return integrationsData.integrations;
    return [];
  }, [integrationsData]);
  const hasBaserow = integrationsList.some(
    (i: any) => String(i.type ?? "").toUpperCase() === "BASEROW",
  );
  const hasSupabase = integrationsList.some(
    (i: any) => String(i.type ?? "").toUpperCase() === "SUPABASE",
  );

  // Permission check — owner / super_user / explicit manage_theme right.
  // EZCONN persists the authed user under `localStorage.user_info` (set on
  // login) so we don't need an extra round-trip; the rest of the app uses
  // the same source.
  const me = useMemo<any>(() => {
    try {
      const raw = localStorage.getItem("user_info");
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }, []);
  const isPrivileged = useMemo(() => {
    if (!me) return false;
    const role = me?.roleable?.role?.slug ?? me?.role?.slug ?? me?.role ?? "";
    if (me?.is_owner) return true;
    if (typeof role === "string" && (role === "owner" || role === "super_user")) return true;
    const perms: string[] = Array.isArray(me?.permissions) ? me.permissions : [];
    return perms.includes("workspace.ai.manage_theme") || perms.includes("workspace.*");
  }, [me]);

  // Automations list — populates the AutomationPicker dropdown in the
  // theme-edit form. Same source we use elsewhere (Visual API / Z-API).
  const { data: automationsData } = useQuery<any>({
    queryKey: ["/api/automations"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/automations");
      return res.json();
    },
    enabled: viewMode === "edit_theme",
  });
  const automations: any[] = useMemo(() => {
    if (Array.isArray(automationsData)) return automationsData;
    if (Array.isArray(automationsData?.automations)) return automationsData.automations;
    return [];
  }, [automationsData]);

  // Workspace members — User Access view. Backend returns
  // `{members: [{id, name, email, ...}]}`.
  const { data: membersData } = useQuery<any>({
    queryKey: ["/api/workspaces/members"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/workspaces/members");
      return res.json();
    },
    enabled: viewMode === "user_access",
  });
  const members: any[] = useMemo(() => {
    if (Array.isArray(membersData)) return membersData;
    if (Array.isArray(membersData?.members)) return membersData.members;
    if (Array.isArray(membersData?.users)) return membersData.users;
    return [];
  }, [membersData]);

  // User access — list of user ids that already have access to the current
  // theme. Toggling a row mutates this set.
  const { data: accessData, refetch: refetchAccess } = useQuery<any>({
    queryKey: ["/api/ai-themes", selectedTheme?.id, "users"],
    queryFn: async () => {
      if (!selectedTheme) return { user_ids: [] };
      const res = await apiRequest("GET", `/api/ai-themes/${selectedTheme.id}/users`);
      return res.json();
    },
    enabled: !!selectedTheme && viewMode === "user_access",
  });
  const accessUserIds: Set<string> = useMemo(() => {
    const ids = accessData?.user_ids ?? [];
    return new Set(ids.map((x: any) => String(x)));
  }, [accessData]);

  // Products list — manage-theme view.
  const { data: productsData, isLoading: productsLoading } = useQuery<any>({
    queryKey: ["/api/ai-themes", selectedTheme?.id, "products"],
    queryFn: async () => {
      if (!selectedTheme) return { products: [] };
      const res = await apiRequest(
        "GET",
        `/api/ai-themes/${selectedTheme.id}/ai-products`,
      );
      return res.json();
    },
    enabled: !!selectedTheme && viewMode === "manage_theme",
  });
  const products: AIProduct[] = useMemo(() => {
    if (Array.isArray(productsData)) return productsData;
    if (Array.isArray(productsData?.products)) return productsData.products;
    return [];
  }, [productsData]);

  // ─── Mutations ────────────────────────────────────────────────────
  const saveThemeMutation = useMutation({
    mutationFn: async (payload: any) => {
      const id = editingTheme?.id;
      const url = id ? `/api/ai-themes/${id}` : "/api/ai-themes";
      const method = id ? "PATCH" : "POST";
      const res = await apiRequest(method, url, payload);
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/ai-themes"] });
      toast({
        title: t("ai_products_section.saved_title"),
        description: t("ai_products_section.theme_saved_description"),
      });
      const saved = data?.theme ?? data;
      if (saved?.id) setSelectedTheme(saved);
      setViewMode(editingTheme?.id ? "manage_theme" : "list");
      setEditingTheme({});
      setPayloadEnabled(false);
    },
    onError: (err: any) => errorToast(err, t("ai_products_section.save_failed_title")),
  });

  const deleteThemeMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/ai-themes/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ai-themes"] });
      toast({
        title: t("ai_products_section.deleted_title"),
        description: t("ai_products_section.theme_deleted_description"),
      });
      setDeleteThemeOpen(false);
      setSelectedTheme(null);
      setViewMode("list");
    },
    onError: (err: any) => errorToast(err, t("ai_products_section.delete_failed_title")),
  });

  const saveProductMutation = useMutation({
    mutationFn: async (payload: any) => {
      if (!selectedTheme) throw new Error("No theme selected");
      const id = editingProduct?.id;
      const url = id
        ? `/api/ai-themes/${selectedTheme.id}/ai-products/${id}`
        : `/api/ai-themes/${selectedTheme.id}/ai-products`;
      const method = id ? "PATCH" : "POST";
      const res = await apiRequest(method, url, payload);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/ai-themes", selectedTheme?.id, "products"],
      });
      toast({
        title: t("ai_products_section.saved_title"),
        description: t("ai_products_section.product_saved_description"),
      });
      setViewMode("manage_theme");
      setEditingProduct(null);
    },
    onError: (err: any) => errorToast(err, t("ai_products_section.save_failed_title")),
  });

  const deleteProductMutation = useMutation({
    mutationFn: async (productId: string) => {
      if (!selectedTheme) throw new Error("No theme selected");
      await apiRequest(
        "DELETE",
        `/api/ai-themes/${selectedTheme.id}/ai-products/${productId}`,
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/ai-themes", selectedTheme?.id, "products"],
      });
      toast({
        title: t("ai_products_section.deleted_title"),
        description: t("ai_products_section.product_deleted_description"),
      });
      setProductToDelete(null);
    },
    onError: (err: any) => errorToast(err, t("ai_products_section.delete_failed_title")),
  });

  const toggleAccessMutation = useMutation({
    mutationFn: async (payload: { userId: string; access: boolean }) => {
      if (!selectedTheme) throw new Error("No theme selected");
      const res = await apiRequest(
        "POST",
        `/api/ai-themes/${selectedTheme.id}/users/${payload.userId}/toggle`,
        { access: payload.access },
      );
      return res.json();
    },
    onSuccess: () => {
      refetchAccess();
    },
    onError: (err: any) => errorToast(err, t("ai_products_section.access_update_failed_title")),
  });

  // ─── Helpers ──────────────────────────────────────────────────────
  function errorToast(err: any, fallbackTitle?: string) {
    const body = err?.body ?? null;
    const inner = body?.message && typeof body.message === "object" ? body.message : body;
    const msg = inner?.message ?? body?.message ?? err?.message ?? t("ai_products_section.something_went_wrong");
    const code = inner?.code ?? body?.code;
    const titleByCode: Record<string, string> = {
      NOT_FOUND: t("ai_products_section.error_title_not_found"),
      VALIDATION: t("ai_products_section.error_title_validation"),
    };
    toast({
      title: code && titleByCode[code] ? titleByCode[code] : (fallbackTitle ?? t("ai_products_section.error_title_default")),
      description: msg,
      variant: "destructive",
    });
  }

  function startCreateTheme(type: "baserow" | "supabase") {
    setEditingTheme({
      name: "",
      subtitle: "",
      type,
      automation_id: null,
      channel: "WHATSAPP",
      payload: null,
      properties: {},
    });
    setPayloadEnabled(false);
    setSelectedTheme(null);
    setViewMode("edit_theme");
  }

  function startEditTheme(theme: AITheme) {
    setEditingTheme({ ...theme });
    setPayloadEnabled(!!theme.payload);
    setSelectedTheme(theme);
    setViewMode("edit_theme");
  }

  function openManageTheme(theme: AITheme) {
    setSelectedTheme(theme);
    setViewMode("manage_theme");
  }

  function openUserAccess(theme: AITheme) {
    setSelectedTheme(theme);
    setUserSearchQuery("");
    setViewMode("user_access");
  }

  function backToList() {
    setSelectedTheme(null);
    setViewMode("list");
    setEditingTheme({});
    setPayloadEnabled(false);
  }

  function backToManage() {
    setViewMode("manage_theme");
    setEditingProduct(null);
  }

  function handleSaveTheme() {
    const theme = editingTheme;
    if (!theme?.name || !theme?.subtitle || !theme?.type || !theme?.channel || !theme?.automation_id) {
      toast({
        title: t("ai_products_section.missing_fields_title"),
        description: t("ai_products_section.missing_fields_theme_description"),
        variant: "destructive",
      });
      return;
    }
    saveThemeMutation.mutate({
      name: theme.name,
      subtitle: theme.subtitle,
      type: theme.type,
      automation_id: theme.automation_id,
      channel: theme.channel,
      payload: payloadEnabled ? (theme.payload ?? null) : null,
      payload_enabled: payloadEnabled,
      properties: theme.properties ?? {},
    });
  }

  function handleSaveProduct() {
    const p = editingProduct;
    if (!p?.name) {
      toast({
        title: t("ai_products_section.missing_fields_title"),
        description: t("ai_products_section.missing_fields_product_description"),
        variant: "destructive",
      });
      return;
    }
    saveProductMutation.mutate({
      name: p.name,
      external_id: p.external_id ?? null,
      payload: p.payload ?? null,
      link_text: p.link_text ?? null,
      properties: p.properties ?? {},
    });
  }

  function copyToClipboard(value: string | null | undefined, label?: string) {
    if (!value) return;
    navigator.clipboard.writeText(value);
    toast({
      title: t("ai_products_section.copied_title"),
      description: t("ai_products_section.copied_description", {
        label: label ?? t("ai_products_section.copy_label_default"),
      }),
    });
  }

  // Header copy per view.
  const headerTitle =
    viewMode === "edit_product"
      ? editingProduct?.id
        ? t("ai_products_section.header_title_edit_product")
        : t("ai_products_section.header_title_new_product")
      : viewMode === "edit_theme"
        ? editingTheme?.id
          ? t("ai_products_section.header_title_edit_theme")
          : t("ai_products_section.header_title_new_theme")
        : viewMode === "user_access"
          ? t("ai_products_section.header_title_theme_access")
          : viewMode === "manage_theme"
            ? selectedTheme?.name || t("ai_products_section.header_title_manage_theme")
            : t("ai_products_section.header_title_list");
  const headerSub =
    viewMode === "edit_product"
      ? selectedTheme?.name || t("ai_products_section.header_sub_configure_product")
      : viewMode === "edit_theme"
        ? t("ai_products_section.header_sub_edit_theme")
        : viewMode === "user_access"
          ? t("ai_products_section.header_sub_user_access", {
              theme: selectedTheme?.name ?? t("ai_products_section.this_theme"),
            })
          : viewMode === "manage_theme"
            ? selectedTheme?.subtitle || t("ai_products_section.header_sub_manage_theme")
            : t("ai_products_section.header_sub_list");

  // ─── Provider icon (Baserow has a logo asset; everything else falls
  //     back to the Cpu glyph). Memoised per type so img-load failures
  //     stick. ─────────────────────────────────────────────────────────
  const ProviderIcon = ({ type, className = "w-7 h-7" }: { type?: string; className?: string }) => {
    const [errored, setErrored] = useState(false);
    const providerType = (type ?? "").toLowerCase();
    if (!providerType || errored || !["baserow", "supabase"].includes(providerType)) {
      return <Database className={cn(className, "text-primary")} />;
    }
    return (
      <img
        src={`/images/integrations/${providerType}.png`}
        alt={providerType}
        className={cn(className, "object-contain")}
        onError={() => setErrored(true)}
      />
    );
  };

  // Reset payload-enabled when entering edit-theme so the switch reflects
  // the persisted state (already handled in startEditTheme but defensive).
  useEffect(() => {
    if (viewMode !== "edit_theme") return;
    setPayloadEnabled(!!editingTheme?.payload);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewMode]);

  // ─── Render ──────────────────────────────────────────────────────
  return (
    <>
      <Card className={cn("rounded-[2rem] border overflow-hidden shadow-sm transition-all duration-300", card, border)}>
        <CardContent className="p-0">
          {/* Header — dynamic per view, card design preserved */}
          <div className={cn("px-8 py-5 border-b flex items-center justify-between", border)}>
            <div className="flex items-center gap-4">
              <div className={cn("p-2.5 rounded-xl shadow-sm", "bg-primary/10")}>
                <Cpu className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h1 className={cn("text-[16px] font-bold tracking-tight", text)}>{headerTitle}</h1>
                <p className={cn("text-[11px] font-bold mt-0.5 opacity-60 max-w-2xl", sub)}>{headerSub}</p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {viewMode === "list" && isPrivileged && (hasBaserow || hasSupabase) && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className={primaryOutlineBtn}>
                      <Plus size={12} /> {t("ai_products_section.add_theme")} <ChevronDown size={12} className="opacity-60" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className={cn("rounded-xl border p-1.5 w-52", card, border)}>
                    {hasBaserow && (
                      <DropdownMenuItem
                        className="rounded-lg text-[12px] font-bold py-2 px-3 flex gap-2 cursor-pointer"
                        onClick={() => startCreateTheme("baserow")}
                      >
                        <ProviderIcon type="baserow" className="w-4 h-4" /> Baserow.io
                      </DropdownMenuItem>
                    )}
                    {hasSupabase && (
                      <DropdownMenuItem
                        className="rounded-lg text-[12px] font-bold py-2 px-3 flex gap-2 cursor-pointer"
                        onClick={() => startCreateTheme("supabase")}
                      >
                        <ProviderIcon type="supabase" className="w-4 h-4" /> Supabase
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
              {viewMode === "list" && isPrivileged && !hasBaserow && !hasSupabase && (
                <p className={cn("text-[10px] font-bold opacity-60", sub)}>
                  {t("ai_products_section.connect_integration_first")}
                </p>
              )}

              {viewMode === "manage_theme" && (
                <>
                  <button
                    onClick={() => {
                      setEditingProduct({
                        name: "",
                        external_id: "",
                        payload: "",
                        link_text: "",
                        properties: {},
                      });
                      setViewMode("edit_product");
                    }}
                    className={primaryOutlineBtn}
                  >
                    <Plus size={12} /> {t("ai_products_section.add_product")}
                  </button>
                  <button onClick={backToList} className={outlineBtn}>
                    <ChevronLeft size={12} /> {t("ai_products_section.back")}
                  </button>
                </>
              )}

              {viewMode === "edit_product" && (
                <button onClick={backToManage} className={outlineBtn}>
                  <ChevronLeft size={12} /> {t("ai_products_section.back")}
                </button>
              )}

              {viewMode === "edit_theme" && (
                <button
                  onClick={() => {
                    if (editingTheme?.id && selectedTheme) {
                      setViewMode("manage_theme");
                    } else {
                      backToList();
                    }
                    setEditingTheme({});
                  }}
                  className={outlineBtn}
                >
                  <ChevronLeft size={12} /> {t("ai_products_section.back")}
                </button>
              )}

              {viewMode === "user_access" && (
                <button
                  onClick={() => setViewMode("manage_theme")}
                  className={outlineBtn}
                >
                  <ChevronLeft size={12} /> {t("ai_products_section.back")}
                </button>
              )}
            </div>
          </div>

          {/* ─── LIST VIEW (Themes grid + stats) ─── */}
          {viewMode === "list" && (
            <div className="p-8 space-y-6">
              {/* Stats panel — a single counter, sourced from the actual list length. */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className={cn("rounded-[1.5rem] border p-5", softBg, softBorder)}>
                  <p className={cn("text-[11px] font-semibold", sub)}>{t("ai_products_section.total_databases")}</p>
                  <p className={cn("text-[28px] font-black mt-2", text)}>{themes.length}</p>
                </div>
              </div>

              {/* Themes grid */}
              {themesLoading ? (
                <div className="flex items-center justify-center h-48">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                </div>
              ) : themes.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                  {themes.map((theme) => (
                    <div
                      key={theme.id}
                      className={cn(
                        "p-6 rounded-[1.5rem] border transition-all hover:shadow-md hover:border-primary/40 flex flex-col",
                        softBg,
                        softBorder,
                      )}
                    >
                      <div className="flex items-start justify-between mb-4">
                        <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                          <ProviderIcon type={theme.type} />
                        </div>
                        {isPrivileged && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button
                                className={cn(
                                  "w-9 h-9 rounded-lg border flex items-center justify-center transition-all",
                                  dark
                                    ? "border-slate-800 hover:border-primary/40 hover:text-primary text-slate-400"
                                    : "border-slate-200 hover:border-primary/40 hover:text-primary text-slate-500",
                                )}
                              >
                                <MoreVertical size={14} />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className={cn("rounded-xl border p-1.5 w-44", card, border)}>
                              <DropdownMenuItem
                                className="rounded-lg text-[12px] font-bold py-2 px-3 flex gap-2 cursor-pointer"
                                onClick={() => openUserAccess(theme)}
                              >
                                <UserCog size={13} /> {t("ai_products_section.access")}
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="rounded-lg text-[12px] font-bold py-2 px-3 flex gap-2 cursor-pointer"
                                onClick={() => startEditTheme(theme)}
                              >
                                <Edit2 size={13} /> {t("ai_products_section.edit")}
                              </DropdownMenuItem>
                              <DropdownMenuSeparator className="my-1" />
                              <DropdownMenuItem
                                className="rounded-lg text-[12px] font-bold py-2 px-3 flex gap-2 cursor-pointer text-rose-500 focus:text-rose-500 focus:bg-rose-500/10"
                                onClick={() => {
                                  setSelectedTheme(theme);
                                  setDeleteThemeOpen(true);
                                }}
                              >
                                <Trash2 size={13} /> {t("ai_products_section.delete")}
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </div>
                      <h3 className={cn("text-[14px] font-black tracking-tight mb-1", text)}>{theme.name}</h3>
                      <p
                        className={cn(
                          "text-[11px] font-medium opacity-70 leading-relaxed mb-5 flex-1 line-clamp-2",
                          sub,
                        )}
                      >
                        {theme.subtitle}
                      </p>
                      <button onClick={() => openManageTheme(theme)} className={cn(primaryOutlineBtn, "self-end")}>
                        {t("ai_products_section.manage")}
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div
                  className={cn(
                    "rounded-[1.5rem] border py-16 px-8 flex flex-col items-center justify-center text-center space-y-5",
                    softBg,
                    softBorder,
                  )}
                >
                  <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                    <Database className="w-8 h-8 text-primary" />
                  </div>
                  <div className="space-y-1.5 max-w-sm">
                    <h3 className={cn("text-[14px] font-black tracking-tight", text)}>{t("ai_products_section.no_themes_yet")}</h3>
                    <p className={cn("text-[11px] font-medium opacity-60 leading-relaxed", sub)}>
                      {hasBaserow || hasSupabase
                        ? t("ai_products_section.no_themes_empty_can_create")
                        : t("ai_products_section.no_themes_empty_need_integration")}
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ─── MANAGE THEME (Products table) ─── */}
          {viewMode === "manage_theme" && selectedTheme && (
            <div className="p-8">
              {productsLoading ? (
                <div className="flex items-center justify-center h-48">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                </div>
              ) : products.length > 0 ? (
                <div className={cn("rounded-[1.5rem] border overflow-hidden", softBorder, softBg)}>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className={cn("border-b", softBorder, dark ? "bg-slate-900/40" : "bg-white/60")}>
                          <th className={cn("px-6 py-4 text-left text-[11px] font-semibold", sub)}>{t("ai_products_section.table_header_name")}</th>
                          <th className={cn("px-6 py-4 text-left text-[11px] font-semibold", sub)}>{t("ai_products_section.table_header_external_id")}</th>
                          <th className={cn("px-6 py-4 text-left text-[11px] font-semibold", sub)}>{t("ai_products_section.table_header_trigger_url")}</th>
                          <th className={cn("px-6 py-4 text-right text-[11px] font-semibold", sub)}>{t("ai_products_section.table_header_actions")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {products.map((product) => (
                          <tr
                            key={product.id}
                            className={cn(
                              "border-b transition-colors",
                              softBorder,
                              dark ? "hover:bg-slate-900/40" : "hover:bg-white/80",
                            )}
                          >
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                                  <Cpu size={14} className="text-primary" />
                                </div>
                                <div>
                                  <p className={cn("text-[13px] font-black", text)}>{product.name}</p>
                                  {product.link_text && (
                                    <p className={cn("text-[11px] font-medium opacity-60", sub)}>{product.link_text}</p>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td className={cn("px-6 py-4 text-[11px] font-bold", sub)}>{product.external_id || "—"}</td>
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-2 max-w-[280px]">
                                <code className={cn("px-2 py-1 rounded-md text-[10px] font-bold border truncate", softBorder, dark ? "bg-slate-900/50" : "bg-slate-50")}>{product.trigger_url || "—"}</code>
                                {product.trigger_url && (
                                  <button
                                    onClick={() => copyToClipboard(product.trigger_url!, t("ai_products_section.trigger_url_label"))}
                                    className={cn("w-7 h-7 rounded-md flex items-center justify-center", dark ? "hover:bg-slate-800 text-primary" : "hover:bg-slate-100 text-primary")}
                                    title={t("ai_products_section.copy_trigger_url_title")}
                                  >
                                    <CopyIcon size={11} />
                                  </button>
                                )}
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex items-center justify-end gap-2">
                                <button
                                  onClick={() => {
                                    setEditingProduct({ ...product });
                                    setViewMode("edit_product");
                                  }}
                                  className={cn(
                                    "w-9 h-9 rounded-lg border flex items-center justify-center transition-all",
                                    dark
                                      ? "border-slate-800 hover:border-primary/40 hover:text-primary text-slate-400"
                                      : "border-slate-200 hover:border-primary/40 hover:text-primary text-slate-500",
                                  )}
                                  title={t("ai_products_section.edit")}
                                >
                                  <Edit2 size={13} />
                                </button>
                                <button
                                  onClick={() => setProductToDelete(product)}
                                  className={cn(
                                    "w-9 h-9 rounded-lg border flex items-center justify-center transition-all",
                                    dark
                                      ? "border-slate-800 hover:border-rose-500/40 hover:text-rose-500 text-slate-400"
                                      : "border-slate-200 hover:border-rose-500/40 hover:text-rose-500 text-slate-500",
                                  )}
                                  title={t("ai_products_section.delete")}
                                >
                                  <Trash2 size={13} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div
                    className={cn(
                      "px-6 py-3 border-t text-[11px] font-semibold",
                      softBorder,
                      sub,
                      dark ? "bg-slate-900/40" : "bg-white/60",
                    )}
                  >
                    {t("ai_products_section.showing_products_count", {
                      count: products.length,
                      total: products.length,
                    })}
                  </div>
                </div>
              ) : (
                <div
                  className={cn(
                    "rounded-[1.5rem] border py-16 px-8 flex flex-col items-center justify-center text-center space-y-5",
                    softBg,
                    softBorder,
                  )}
                >
                  <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                    <Cpu className="w-8 h-8 text-primary" />
                  </div>
                  <div className="space-y-1.5 max-w-sm">
                    <h3 className={cn("text-[14px] font-black tracking-tight", text)}>{t("ai_products_section.no_products_yet")}</h3>
                    <p className={cn("text-[11px] font-medium opacity-60 leading-relaxed", sub)}>
                      {t("ai_products_section.no_products_empty_description")}
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setEditingProduct({
                        name: "",
                        external_id: "",
                        payload: "",
                        link_text: "",
                        properties: {},
                      });
                      setViewMode("edit_product");
                    }}
                    className={primaryOutlineBtn}
                  >
                    <Plus size={12} /> {t("ai_products_section.add_product")}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ─── EDIT THEME FORM ─── */}
          {viewMode === "edit_theme" && (
            <div className="p-8">
              <div className={cn("rounded-[1.5rem] border p-8 space-y-6", softBg, softBorder)}>
                <div className="max-w-3xl space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className={labelCls}>
                        {t("ai_products_section.field_name")} <span className="text-rose-500">*</span>
                      </label>
                      <input
                        value={editingTheme?.name ?? ""}
                        onChange={(e) =>
                          setEditingTheme((prev) => ({ ...prev, name: e.target.value.slice(0, 255) }))
                        }
                        maxLength={255}
                        placeholder={t("ai_products_section.theme_name_placeholder")}
                        className={inputCls}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className={labelCls}>
                        {t("ai_products_section.field_subtitle")} <span className="text-rose-500">*</span>
                      </label>
                      <input
                        value={editingTheme?.subtitle ?? ""}
                        onChange={(e) =>
                          setEditingTheme((prev) => ({ ...prev, subtitle: e.target.value.slice(0, 1024) }))
                        }
                        maxLength={1024}
                        placeholder={t("ai_products_section.short_description_placeholder")}
                        className={inputCls}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className={labelCls}>
                        {t("ai_products_section.field_smart_flow")} <span className="text-rose-500">*</span>
                      </label>
                      <select
                        value={editingTheme?.automation_id ?? ""}
                        onChange={(e) =>
                          setEditingTheme((prev) => ({
                            ...prev,
                            automation_id: e.target.value || null,
                          }))
                        }
                        className={inputCls}
                      >
                        <option value="">{t("ai_products_section.select_automation_option")}</option>
                        {automations.map((a: any) => (
                          <option key={a.id} value={String(a.id)}>
                            {a.name ?? t("ai_products_section.automation_fallback_label", { id: a.id })}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className={labelCls}>
                        {t("ai_products_section.field_channel")} <span className="text-rose-500">*</span>
                      </label>
                      <select
                        value={
                          typeof editingTheme?.channel === "string" ? editingTheme.channel : "WHATSAPP"
                        }
                        onChange={(e) =>
                          setEditingTheme((prev) => ({ ...prev, channel: e.target.value }))
                        }
                        className={inputCls}
                      >
                        <option value="WHATSAPP">WhatsApp</option>
                        <option value="TELEGRAM">Telegram</option>
                        <option value="INSTAGRAM">Instagram</option>
                        <option value="MESSENGER">Messenger</option>
                        <option value="WEBCHAT">{t("ai_products_section.channel_webchat")}</option>
                        <option value="ZAPI">Z-API</option>
                      </select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className={labelCls}>
                      {t("ai_products_section.field_type")} <span className="text-rose-500">*</span>
                    </label>
                    <input
                      value={editingTheme?.type ?? ""}
                      readOnly
                      className={cn(inputCls, "opacity-60 cursor-not-allowed")}
                    />
                    <p className={cn("text-[10px] font-medium opacity-60", sub)}>
                      {t("ai_products_section.provider_locked_hint")}
                    </p>
                  </div>

                  {/* Spreadsheet / table id — Baserow themes need this so we
                      can fetch column metadata. */}
                  {(editingTheme?.type ?? "").toLowerCase() === "baserow" && (
                    <div className="space-y-2">
                      <label className={labelCls}>{t("ai_products_section.field_baserow_table_id")}</label>
                      <input
                        value={editingTheme?.properties?.spreadsheet_id ?? ""}
                        onChange={(e) =>
                          setEditingTheme((prev) => ({
                            ...prev,
                            properties: {
                              ...(prev?.properties ?? {}),
                              spreadsheet_id: e.target.value,
                            },
                          }))
                        }
                        placeholder={t("ai_products_section.baserow_table_id_placeholder")}
                        className={inputCls}
                      />
                    </div>
                  )}

                  {/* Payload toggle + textarea. */}
                  <div className={cn("rounded-[1rem] border p-5 space-y-3", softBorder, dark ? "bg-slate-900/40" : "bg-white")}>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className={cn("text-[12px] font-black", text)}>{t("ai_products_section.static_payload_title")}</p>
                        <p className={cn("text-[11px] font-medium opacity-60 mt-0.5", sub)}>
                          {t("ai_products_section.static_payload_description")}
                        </p>
                      </div>
                      <Switch
                        checked={payloadEnabled}
                        onCheckedChange={(checked) => {
                          setPayloadEnabled(checked);
                          if (!checked) {
                            setEditingTheme((prev) => ({ ...prev, payload: null }));
                          }
                        }}
                      />
                    </div>
                    {payloadEnabled && (
                      <textarea
                        value={editingTheme?.payload ?? ""}
                        onChange={(e) => setEditingTheme((prev) => ({ ...prev, payload: e.target.value }))}
                        rows={6}
                        placeholder='{"reply_with": "{{product.name}}"}'
                        className={textareaCls}
                      />
                    )}
                  </div>
                </div>

                <div className={cn("flex justify-end gap-2 pt-6 border-t", softBorder)}>
                  <button
                    onClick={() => {
                      setEditingTheme({});
                      if (editingTheme?.id && selectedTheme) setViewMode("manage_theme");
                      else backToList();
                    }}
                    className={outlineBtn}
                  >
                    {t("ai_products_section.cancel")}
                  </button>
                  <button
                    onClick={handleSaveTheme}
                    disabled={saveThemeMutation.isPending}
                    className={primaryBtn}
                  >
                    {saveThemeMutation.isPending && <Loader2 size={12} className="animate-spin" />}
                    {editingTheme?.id ? t("ai_products_section.update_theme") : t("ai_products_section.create_theme")}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ─── EDIT PRODUCT FORM ─── */}
          {viewMode === "edit_product" && (
            <div className="p-8">
              <div className={cn("rounded-[1.5rem] border p-8 space-y-6", softBg, softBorder)}>
                <div className="max-w-2xl space-y-6">
                  <div className="space-y-2">
                    <label className={labelCls}>
                      {t("ai_products_section.field_name")} <span className="text-rose-500">*</span>
                    </label>
                    <input
                      value={editingProduct?.name ?? ""}
                      onChange={(e) =>
                        setEditingProduct((prev) => (prev ? { ...prev, name: e.target.value.slice(0, 255) } : null))
                      }
                      maxLength={255}
                      placeholder={t("ai_products_section.product_name_placeholder")}
                      className={inputCls}
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className={labelCls}>{t("ai_products_section.field_external_id")}</label>
                      <input
                        value={editingProduct?.external_id ?? ""}
                        onChange={(e) =>
                          setEditingProduct((prev) =>
                            prev ? { ...prev, external_id: e.target.value.slice(0, 255) } : null,
                          )
                        }
                        maxLength={255}
                        placeholder={t("ai_products_section.external_id_placeholder")}
                        className={inputCls}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className={labelCls}>{t("ai_products_section.field_link_text")}</label>
                      <input
                        value={editingProduct?.link_text ?? ""}
                        onChange={(e) =>
                          setEditingProduct((prev) =>
                            prev ? { ...prev, link_text: e.target.value.slice(0, 255) } : null,
                          )
                        }
                        maxLength={255}
                        placeholder={t("ai_products_section.link_text_placeholder")}
                        className={inputCls}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className={labelCls}>{t("ai_products_section.field_payload_optional")}</label>
                    <input
                      value={editingProduct?.payload ?? ""}
                      onChange={(e) =>
                        setEditingProduct((prev) => (prev ? { ...prev, payload: e.target.value } : null))
                      }
                      placeholder='{"sku": "ABC-123"}'
                      className={inputCls}
                    />
                  </div>

                  <div className="space-y-2">
                    <label className={labelCls}>{t("ai_products_section.field_trigger_url")}</label>
                    <input
                      readOnly
                      value={editingProduct?.trigger_url ?? t("ai_products_section.generated_after_save")}
                      className={cn(inputCls, "font-mono text-[12px] opacity-60")}
                    />
                    <p className={cn("text-[10px] font-medium opacity-60", sub)}>
                      {t("ai_products_section.trigger_url_hint")}
                    </p>
                  </div>
                </div>

                <div className={cn("flex justify-end gap-2 pt-6 border-t", softBorder)}>
                  <button onClick={backToManage} className={outlineBtn}>
                    {t("ai_products_section.cancel")}
                  </button>
                  <button
                    onClick={handleSaveProduct}
                    disabled={!editingProduct?.name || saveProductMutation.isPending}
                    className={primaryBtn}
                  >
                    {saveProductMutation.isPending && <Loader2 size={12} className="animate-spin" />}
                    {editingProduct?.id ? t("ai_products_section.update_product") : t("ai_products_section.create_product")}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ─── USER ACCESS VIEW ─── */}
          {viewMode === "user_access" && selectedTheme && (
            <div className="p-8 space-y-5">
              <div className={cn("rounded-[1.5rem] border p-6", softBg, softBorder)}>
                <p className={cn("text-[12px] font-medium leading-relaxed", sub)}>
                  {t("ai_products_section.access_toggle_prefix")}{" "}
                  <span className={cn("font-black", text)}>{selectedTheme.name}</span>
                  {t("ai_products_section.access_toggle_suffix")}
                </p>
              </div>

              {/* Search input */}
              <div className="relative">
                <Search size={14} className={cn("absolute left-4 top-1/2 -translate-y-1/2", sub)} />
                <input
                  value={userSearchQuery}
                  onChange={(e) => setUserSearchQuery(e.target.value)}
                  placeholder={t("ai_products_section.search_members_placeholder")}
                  className={cn(inputCls, "pl-10")}
                />
              </div>

              {/* Members list */}
              <div className={cn("rounded-[1.5rem] border overflow-hidden", softBorder, softBg)}>
                {members.length === 0 ? (
                  <div className="p-8 text-center">
                    <p className={cn("text-[12px] font-medium", sub)}>{t("ai_products_section.no_members_found")}</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className={cn("border-b", softBorder, dark ? "bg-slate-900/40" : "bg-white/60")}>
                          <th className={cn("px-6 py-4 text-left text-[11px] font-semibold", sub)}>{t("ai_products_section.table_header_member")}</th>
                          <th className={cn("px-6 py-4 text-left text-[11px] font-semibold", sub)}>{t("ai_products_section.table_header_role")}</th>
                          <th className={cn("px-6 py-4 text-right text-[11px] font-semibold", sub)}>{t("ai_products_section.table_header_access")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {members
                          .filter((m: any) => {
                            const q = userSearchQuery.trim().toLowerCase();
                            if (!q) return true;
                            const name = (m.name ?? m.full_name ?? "").toLowerCase();
                            const email = (m.email ?? "").toLowerCase();
                            return name.includes(q) || email.includes(q);
                          })
                          .map((member: any) => {
                            const userId = String(member.id);
                            const hasAccess = accessUserIds.has(userId);
                            const isAlwaysOn =
                              member.is_owner ||
                              member?.roleable?.role?.slug === "owner" ||
                              member?.roleable?.role?.slug === "super_user" ||
                              member?.role?.slug === "owner" ||
                              member?.role?.slug === "super_user";
                            const roleLabel =
                              member?.roleable?.role?.name ??
                              member?.role?.name ??
                              member?.role?.slug ??
                              t("ai_products_section.role_fallback_agent");
                            return (
                              <tr
                                key={member.id}
                                className={cn(
                                  "border-b transition-colors",
                                  softBorder,
                                  dark ? "hover:bg-slate-900/40" : "hover:bg-white/80",
                                )}
                              >
                                <td className="px-6 py-4">
                                  <div className="flex items-center gap-3">
                                    <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-black text-[12px]">
                                      {String(member.name ?? member.email ?? "?")
                                        .charAt(0)
                                        .toUpperCase()}
                                    </div>
                                    <div>
                                      <p className={cn("text-[13px] font-black", text)}>
                                        {member.name ?? member.full_name ?? member.email ?? t("ai_products_section.unknown_member")}
                                      </p>
                                      {member.email && (
                                        <p className={cn("text-[11px] font-medium opacity-60", sub)}>
                                          {member.email}
                                        </p>
                                      )}
                                    </div>
                                  </div>
                                </td>
                                <td className={cn("px-6 py-4 text-[11px] font-bold", sub)}>
                                  {roleLabel}
                                </td>
                                <td className="px-6 py-4 text-right">
                                  {isAlwaysOn ? (
                                    <span className={cn("text-[11px] font-semibold", "text-emerald-500")}>
                                      {t("ai_products_section.always_on")}
                                    </span>
                                  ) : (
                                    <Switch
                                      checked={hasAccess}
                                      onCheckedChange={(checked) =>
                                        toggleAccessMutation.mutate({ userId, access: checked })
                                      }
                                    />
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ─── Delete Theme Dialog ─── */}
      <AlertDialog open={deleteThemeOpen} onOpenChange={setDeleteThemeOpen}>
        <AlertDialogContent className={cn("rounded-[2rem] border p-0 max-w-md overflow-hidden", card, border)}>
          <div className="p-6 space-y-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-500/10 flex items-center justify-center text-rose-500">
                <AlertCircle size={18} />
              </div>
              <div>
                <h2 className={cn("text-[14px] font-semibold", text)}>{t("ai_products_section.delete_theme_title")}</h2>
                <p className={cn("text-[11px] font-medium opacity-60 mt-0.5 leading-relaxed", sub)}>
                  <span className="text-rose-500 font-black">{selectedTheme?.name ?? t("ai_products_section.this_theme")}</span>{" "}
                  {t("ai_products_section.delete_theme_description")}
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <AlertDialogCancel className={cn(outlineBtn, "m-0")}>{t("ai_products_section.cancel")}</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => selectedTheme && deleteThemeMutation.mutate(selectedTheme.id)}
                className="h-11 px-7 rounded-xl bg-rose-500 hover:bg-rose-600 text-white text-[11px] font-semibold transition-all shadow-lg shadow-rose-500/20 flex items-center gap-2"
              >
                <Trash2 size={12} /> {t("ai_products_section.delete")}
              </AlertDialogAction>
            </div>
          </div>
        </AlertDialogContent>
      </AlertDialog>

      {/* ─── Delete Product Dialog ─── */}
      <AlertDialog open={!!productToDelete} onOpenChange={(open) => !open && setProductToDelete(null)}>
        <AlertDialogContent className={cn("rounded-[2rem] border p-0 max-w-md overflow-hidden", card, border)}>
          <div className="p-6 space-y-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-500/10 flex items-center justify-center text-rose-500">
                <AlertCircle size={18} />
              </div>
              <div>
                <h2 className={cn("text-[14px] font-semibold", text)}>{t("ai_products_section.delete_product_title")}</h2>
                <p className={cn("text-[11px] font-medium opacity-60 mt-0.5 leading-relaxed", sub)}>
                  <span className="text-rose-500 font-black">{productToDelete?.name ?? t("ai_products_section.this_product")}</span>{" "}
                  {t("ai_products_section.delete_product_description")}
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <AlertDialogCancel className={cn(outlineBtn, "m-0")}>{t("ai_products_section.cancel")}</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => productToDelete?.id && deleteProductMutation.mutate(productToDelete.id)}
                className="h-11 px-7 rounded-xl bg-rose-500 hover:bg-rose-600 text-white text-[11px] font-semibold transition-all shadow-lg shadow-rose-500/20 flex items-center gap-2"
              >
                <Trash2 size={12} /> {t("ai_products_section.delete")}
              </AlertDialogAction>
            </div>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
