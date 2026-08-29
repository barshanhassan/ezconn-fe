import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import {
  ChevronLeft,
  ChevronRight,
  MoreVertical,
  Trash2,
  Plus,
  Phone,
  Bot,
  AlertCircle,
  Smartphone,
  Zap,
  ExternalLink,
  QrCode,
  Check,
  RotateCw,
  ReplyAll,
  Sparkles,
  Eye,
  EyeOff,
  Copy as CopyIcon,
  BadgeCheck,
  KeyRound,
  ShieldAlert,
  ShieldCheck,
  Building2,
  Gauge,
  RefreshCcw,
  Repeat,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { cn } from "@/lib/utils";
import { useTheme } from "@/contexts/ThemeContext";
import { useLocation } from "wouter";
import { useSocket } from "@/hooks/use-socket";

import DeleteAccountDialog from "./whatsapp/DeleteAccountDialog";
import DeleteNumberDialog from "./whatsapp/DeleteNumberDialog";
import ReconnectNumberDialog from "./whatsapp/ReconnectNumberDialog";
import DefaultReplyDialog from "./whatsapp/DefaultReplyDialog";
import LimitReachedDialog from "./whatsapp/LimitReachedDialog";
import QrCodeManageView from "./whatsapp/QrCodeManageView";

type ViewMode = "list" | "coex_manage" | "api_manage" | "qr_manage";

// Meta Embedded Signup FB.login helpers live in `@/lib/metaEmbeddedSignup` and
// run inside the self-hosted launcher page (`WhatsAppSignupLauncherPage`).
// This section only *redirects* to that launcher (replyagent metaconnect flow).

/**
 * WhatsApp channel management — replyagent parity rewrite.
 *
 * Layout mirrors the EZCONN "3 cards + Manage panel" structure (Coex /
 * Business API / QR Code) but the copy, the per-card prerequisites box,
 * the setup-difficulty indicator, and every per-account/per-number action
 * are wired to the new backend endpoints:
 *
 *   GET    /api/whatsapp/accounts?with=phoneNumbers,capi&onboard_platform=…
 *   POST   /api/whatsapp/profiles
 *   POST   /api/whatsapp/onboard          (Embed Signup return)
 *   POST   /api/whatsapp/onboard-manual   (manual credentials)
 *   POST   /api/whatsapp/delete/:id       (with delete_folder + delete_templates)
 *   POST   /api/whatsapp/delete-number/:id
 *   POST   /api/whatsapp/reconnect/:id
 *   POST   /api/whatsapp/autoreply/:id    (default reply automation)
 *   PUT    /api/whatsapp/toggle-feeder/:id
 *   GET    /api/whatsapp/capi/:account_id (CAPI dataset bound to account)
 *
 * Coex variant → `onboard_platform=whatsapp_business_app`; API variant →
 * `onboard_platform=whatsapp_business` (default). The Meta Embed Signup
 * popup redirects to `/settings/whatsapp-onboard` (a dedicated page that
 * parses Meta's hash response and dispatches the right backend call).
 */
export default function WhatsAppSection() {
  const { t } = useTranslation();
  const { mode } = useTheme();
  const dark = mode === "dark";
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  const [view, setView] = useState<ViewMode>(() => {
    const params = new URLSearchParams(window.location.search);
    const v = params.get("view");
    if (v === "coex") return "coex_manage";
    if (v === "api") return "api_manage";
    if (v === "qr") return "qr_manage";
    return "list";
  });

  const card = dark ? "bg-[#0f1829]" : "bg-white";
  const border = dark ? "border-slate-800" : "border-slate-200";
  const text = dark ? "text-white" : "text-slate-900";
  const sub = dark ? "text-slate-500" : "text-slate-400";
  const softBg = dark ? "bg-slate-950/40" : "bg-slate-50/50";
  const softBorder = dark ? "border-slate-800" : "border-slate-100";

  const inputCls = cn(
    "h-11 rounded-xl text-[13px] font-bold transition-all px-4",
    "focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:border-primary/50",
    dark ? "bg-slate-950/50 border-slate-800 text-white" : "bg-white border-slate-200 text-slate-900",
  );

  const outlineBtn = cn(
    "h-11 px-6 rounded-xl border text-[11px] font-semibold transition-all flex items-center gap-2",
    dark ? "border-slate-800 text-slate-300 hover:border-primary/40 hover:text-primary" : "border-slate-200 text-slate-700 hover:border-primary/40 hover:text-primary",
  );

  // ─── Account data ────────────────────────────────────────────────

  // replyagent-compatible endpoint returning `{ wa: [{ ...account, phone_numbers, capi }] }`.
  // Platform scoping happens SERVER-side, mirroring replyagent: its Coexistence
  // page requests `?onboard_platform=whatsapp_business_app` while its Business
  // API page relies on the endpoint's `whatsapp_business` default. We name the
  // platform explicitly either way so the request is self-describing, and so a
  // `qr_code` account can never surface under a Cloud API tab.
  const platformParam =
    view === "coex_manage" ? "whatsapp_business_app" : "whatsapp_business";

  const { data: accountsData, isLoading } = useQuery({
    queryKey: ["/api/whatsapp/accounts", "phoneNumbers,capi", platformParam],
    queryFn: async () => {
      const res = await apiRequest(
        "GET",
        `/api/whatsapp/accounts?with=phoneNumbers,capi&onboard_platform=${platformParam}`,
      );
      return res.json();
    },
    refetchInterval: 30_000,
  });

  const allAccounts: any[] = useMemo(() => accountsData?.wa ?? [], [accountsData]);
  // Belt-and-braces: the server already scoped the list, but keep the split
  // positive (=== whatsapp_business) rather than negated — a negated filter let
  // `qr_code` rows fall through into the Business API tab.
  const coexAccounts = useMemo(
    () => allAccounts.filter((a) => a.onboard_platform === "whatsapp_business_app"),
    [allAccounts],
  );
  const apiAccounts = useMemo(
    () => allAccounts.filter((a) => a.onboard_platform === "whatsapp_business"),
    [allAccounts],
  );

  // Workspace WhatsApp channel limit — backend returns { limit, used, can_add }.
  // We pre-check this before launching the Meta Embedded Signup popup so the
  // user sees an in-app limit-reached prompt instead of having Meta reject
  // the registration. Falls back to 4 if the endpoint hasn't responded yet.
  const { data: limitsData } = useQuery({
    queryKey: ["/api/whatsapp/limits"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/whatsapp/limits");
      return res.json();
    },
  });
  const channelsLimit: number = limitsData?.limit ?? 4;
  const hasReachedLimit: boolean = limitsData ? !limitsData.can_add : false;

  // Approved-template count per WhatsApp account — powers the "N approved"
  // line on each phone-number card. Templates come back as a flat list (each
  // item carries wa_account_id + status); we group + count APPROVED client-side.
  const { data: templatesData } = useQuery({
    queryKey: ["/api/waba/templates"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/waba/templates");
      return res.json();
    },
  });
  const approvedTemplatesByAccount: Record<string, number> = useMemo(() => {
    const list: any[] = Array.isArray(templatesData) ? templatesData : [];
    const counts: Record<string, number> = {};
    for (const tpl of list) {
      if (String(tpl.status).toUpperCase() !== "APPROVED") continue;
      const key = String(tpl.wa_account_id);
      counts[key] = (counts[key] ?? 0) + 1;
    }
    return counts;
  }, [templatesData]);

  // ─── Dialog state ────────────────────────────────────────────────

  const [showManualConnectDialog, setShowManualConnectDialog] = useState(false);
  const [showLimitDialog, setShowLimitDialog] = useState(false);

  const [accountToDelete, setAccountToDelete] = useState<any>(null);
  const [numberToDelete, setNumberToDelete] = useState<any>(null);
  const [numberToReconnect, setNumberToReconnect] = useState<any>(null);
  const [numberForDefaultReply, setNumberForDefaultReply] = useState<any>(null);
  const [accountForCapi, setAccountForCapi] = useState<any>(null);
  const [numberToRegister, setNumberToRegister] = useState<any>(null);

  // Manual onboarding form
  const emptyManualForm = {
    waba_id: "",
    name: "",
    access_token: "",
    phone_number_id: "",
    display_phone_number: "",
    verified_name: "",
  };
  const [manualForm, setManualForm] = useState(emptyManualForm);
  const [manualErrors, setManualErrors] = useState<Record<string, string>>({});

  // ─── Realtime: refresh on whatsapp.account_updated / number_updated ──

  const workspaceId = useMemo(() => {
    try {
      const raw = localStorage.getItem("user_info");
      if (!raw) return 1;
      const parsed = JSON.parse(raw);
      const wsId = parsed?.workspace_id ?? parsed?.modelable_id ?? 1;
      return Number(wsId) || 1;
    } catch {
      return 1;
    }
  }, []);
  const socket = useSocket(workspaceId);

  useEffect(() => {
    if (!socket) return;
    // When the backend emits "whatsapp.account_updated" /
    // "whatsapp.number_updated" to the workspace room, refetch the channels
    // list so the UI reflects the latest status (PENDING→ACTIVE flips, name
    // approval changes, AI Feeder toggles from another tab, etc.).
    const refetch = () =>
      queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/accounts", "phoneNumbers,capi"] });
    // Generic channel.* broadcast (replyagent ChannelUpdated) — cross-feature
    // refresh: re-pull the channels list, the integrations list (automation
    // consumers), and the live total-channels counter.
    const onChannel = () => {
      refetch();
      queryClient.invalidateQueries({ queryKey: ["/api/integrations/channels"] });
      queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/total-channels"] });
      // A channel add/delete changes the used-slot count; without this the
      // cached /limits response goes stale the moment the change happens in
      // ANY tab (not just the one that triggered it via the mutation above).
      queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/limits"] });
    };
    socket.on("whatsapp.account_updated", refetch);
    socket.on("whatsapp.number_updated", refetch);
    socket.on("channel.updated", onChannel);
    socket.on("channel.created", onChannel);
    socket.on("channel.deleted", onChannel);
    return () => {
      socket.off("whatsapp.account_updated", refetch);
      socket.off("whatsapp.number_updated", refetch);
      socket.off("channel.updated", onChannel);
      socket.off("channel.created", onChannel);
      socket.off("channel.deleted", onChannel);
    };
  }, [socket, queryClient]);

  // ─── Connect handlers ────────────────────────────────────────────

  const [isConnecting, setIsConnecting] = useState(false);

  /**
   * "Add New" → Meta WhatsApp Embedded Signup via FB JavaScript SDK.
   *
   * Replyagent used to redirect to its own `fb.replyagent.com` proxy page
   * which loaded the FB SDK on a whitelisted domain. We now load the SDK
   * inline because EZCONN's frontend origin (`http://localhost:5173` in dev,
   * `https://<prod-domain>` later) can be added to the Meta app's "Allowed
   * Domains for the JavaScript SDK" list directly.
   *
   * Flow:
   *   1. Lazy-load Meta FB SDK (script tag) and `FB.init` with our App ID.
   *   2. Attach a `message` listener for `WA_EMBEDDED_SIGNUP` events — this
   *      is how Meta hands back the `phone_number_id` + `waba_id` +
   *      `business_id` (these are NOT in the OAuth response).
   *   3. Call `FB.login(..., { config_id, response_type: 'code',
   *      override_default_response_type: true, extras })`. The user picks
   *      their WABA in the popup.
   *   4. On the callback fire, combine `authResponse.code` with the values
   *      captured from the message listener, then POST to
   *      `/api/whatsapp/onboard` with the replyagent contract
   *      (`_c`/`_w`/`_p`/`_u`/`_b`/`_s`) the backend already expects.
   *   5. Refetch the accounts list so the new WABA appears in the manage
   *      panel without a hard reload.
   *
   * `source = 'aka'` → backend sets `onboard_platform=whatsapp_business_app`
   * (Coexistence). `'api'` → standard Cloud API onboarding.
   */
  /**
   * Launch WhatsApp Embedded Signup — replyagent redirect-flow parity.
   *
   * replyagent redirects the browser to an external "metaconnect" service
   * (`VITE_FB_DOMAIN`) at `/coexistence?r=…` (Coex) or `/whatsapp?r=…`
   * (Business API); that service runs the Meta dialog and redirects back to
   * `/settings/whatsapp-onboard#c=…&w=…&p=…&s=…`. EZCONN self-hosts that
   * launcher on its own origin (`WhatsAppSignupLauncherPage`, routes
   * `/coexistence` + `/whatsapp`) so no external service is required — set
   * `VITE_FB_DOMAIN` to a real metaconnect domain to match replyagent exactly.
   *
   * `source = 'aka'` → `/coexistence` (WhatsApp Business App / Coexistence);
   * `'api'` → `/whatsapp` (standard Cloud API).
   */
  const openEmbeddedSignup = (source?: "aka" | "api") => {
    if (hasReachedLimit) {
      setShowLimitDialog(true);
      return;
    }

    // Direct `import.meta.env.VITE_*` accesses so Vite's static replacement
    // kicks in at build time (a dynamic `(import.meta as any).env` lookup is
    // skipped by the transformer and yields undefined at runtime).
    const appId: string | undefined = import.meta.env.VITE_META_APP_ID as string | undefined;
    const configId: string | undefined = import.meta.env.VITE_META_ES_CONFIG_ID as string | undefined;

    if (!appId || !configId) {
      toast({
        title: t("whatsapp_section.toast.embedded_not_configured_title"),
        description: t("whatsapp_section.toast.embedded_not_configured_desc"),
        variant: "destructive",
      });
      return;
    }

    // Metaconnect launcher domain — defaults to EZCONN's own origin (self-hosted
    // launcher). The onboard return page reads the result hash and POSTs to the
    // backend (`WhatsAppOnboardPage`).
    const fbDomain = (import.meta.env.VITE_FB_DOMAIN as string | undefined) || window.location.origin;
    const returnUrl = `${window.location.origin}/settings/whatsapp-onboard`;
    const path = source === "aka" ? "coexistence" : "whatsapp";
    setIsConnecting(true);
    window.location.href = `${fbDomain}/${path}?r=${returnUrl}`;
  };

  // ─── Manual onboard ──────────────────────────────────────────────

  const validateManualForm = () => {
    const errs: Record<string, string> = {};
    if (!manualForm.waba_id.trim()) errs.waba_id = t("whatsapp_section.validation.waba_id_required");
    if (!manualForm.name.trim()) errs.name = t("whatsapp_section.validation.name_required");
    if (!manualForm.access_token.trim()) errs.access_token = t("whatsapp_section.validation.access_token_required");
    if (!manualForm.phone_number_id.trim()) errs.phone_number_id = t("whatsapp_section.validation.phone_number_id_required");
    if (!manualForm.display_phone_number.trim()) errs.display_phone_number = t("whatsapp_section.validation.display_phone_number_required");
    setManualErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const manualOnboardMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/whatsapp/onboard-manual", {
        waba_id: manualForm.waba_id.trim(),
        name: manualForm.name.trim(),
        access_token: manualForm.access_token.trim(),
        phone_number_id: manualForm.phone_number_id.trim(),
        display_phone_number: manualForm.display_phone_number.trim(),
        ...(manualForm.verified_name.trim() ? { verified_name: manualForm.verified_name.trim() } : {}),
      });
      return res.json();
    },
    onSuccess: (data: any) => {
      toast({
        title: t("whatsapp_section.toast.account_saved_title"),
        description: data?.message ?? t("whatsapp_section.toast.account_saved_desc_fallback"),
      });
      setShowManualConnectDialog(false);
      setManualForm(emptyManualForm);
      setManualErrors({});
      queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/accounts", "phoneNumbers,capi"] });
      queryClient.invalidateQueries({ queryKey: ["/api/integrations/channels"] });
      // Adding an account consumes a channel slot — refresh so a workspace at
      // its limit immediately shows "Channel limit reached" without a reload.
      queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/limits"] });
    },
  });

  const submitManualOnboard = () => {
    if (!validateManualForm()) return;
    manualOnboardMutation.mutate();
  };

  // ─── AI feeder toggle (real call) ────────────────────────────────

  const feederMutation = useMutation({
    mutationFn: async (numberId: string) => {
      const res = await apiRequest("PUT", `/api/whatsapp/toggle-feeder/${numberId}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/accounts", "phoneNumbers,capi"] });
    },
  });

  // ─── Account verify (re-check Meta review/verification state) ─────

  const verifyAccountMutation = useMutation({
    mutationFn: async (accountId: string) => {
      const res = await apiRequest("POST", `/api/whatsapp/verify-account/${accountId}`);
      return res.json();
    },
    onSuccess: (data: any) => {
      toast({
        title: data?.success ? t("whatsapp_section.toast.account_refreshed_title") : t("whatsapp_section.toast.verify_failed_title"),
        description: data?.success ? t("whatsapp_section.toast.account_refreshed_desc") : data?.message ?? "",
        variant: data?.success ? undefined : "destructive",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/accounts", "phoneNumbers,capi"] });
    },
  });

  // ─── Webhook re-subscribe (manual trigger; cron handles it every 6h) ──

  const resubscribeMutation = useMutation({
    mutationFn: async (accountId: string) => {
      const res = await apiRequest("POST", `/api/whatsapp/resubscribe/${accountId}`);
      return res.json();
    },
    onSuccess: (data: any) => {
      toast({
        title: data?.success ? t("whatsapp_section.toast.webhook_resubscribed_title") : t("whatsapp_section.toast.resubscribe_failed_title"),
        description: data?.message ?? "",
        variant: data?.success ? undefined : "destructive",
      });
    },
  });

  // ─── CAPI fetch when an account is opened ────────────────────────

  const { data: capiData } = useQuery({
    queryKey: ["/api/whatsapp/capi", accountForCapi?.id],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/whatsapp/capi/${accountForCapi.id}`);
      return res.json();
    },
    enabled: !!accountForCapi,
  });

  // ─── Rendering helpers ───────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  const activeAccounts = view === "coex_manage" ? coexAccounts : apiAccounts;

  return (
    <>
      <Card className={cn("rounded-[2rem] border overflow-hidden shadow-sm transition-all duration-300", card, border)}>
        <CardContent className="p-0">
          {/* ── Header — dynamic per view ── */}
          <div className={cn("px-8 py-5 border-b flex items-center justify-between", border)}>
            <div className="flex items-center gap-4">
              <div className={cn("p-2.5 rounded-xl shadow-sm bg-emerald-500/10")}>
                <img src="/images/automations/whatsapp.svg" alt="WhatsApp" className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className={cn("text-[16px] font-bold tracking-tight", text)}>
                    {view === "list" && t("whatsapp_section.header.title_list")}
                    {view === "coex_manage" && t("whatsapp_section.header.title_coex")}
                    {view === "api_manage" && t("whatsapp_section.header.title_api")}
                    {view === "qr_manage" && t("whatsapp_section.header.title_qr")}
                  </h1>
                  {view === "coex_manage" && (
                    <Badge variant="outline" className="h-5 px-2 rounded-md border-emerald-500/20 bg-emerald-500/5 text-emerald-600 dark:text-emerald-400 text-[10px] font-semibold">
                      {t("whatsapp_section.header.badge_coexistence")}
                    </Badge>
                  )}
                </div>
                <p className={cn("text-[11px] font-bold mt-0.5 opacity-60 max-w-2xl", sub)}>
                  {view === "list" && t("whatsapp_section.header.desc_list")}
                  {view === "coex_manage" && t("whatsapp_section.header.desc_coex")}
                  {view === "api_manage" && t("whatsapp_section.header.desc_api")}
                  {view === "qr_manage" && t("whatsapp_section.header.desc_qr")}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {view === "api_manage" && (
                <button
                  onClick={() => setShowManualConnectDialog(true)}
                  className={outlineBtn}
                >
                  <Plus size={12} /> {t("whatsapp_section.header.connect_manually")}
                </button>
              )}
              {/* "Add new" launches Embedded Signup straight from the header —
                  replyagent puts it there on the Business API page (and only
                  there; Coexistence adds numbers from inside an account panel,
                  which is the dashed add-card further down). openEmbeddedSignup
                  already short-circuits into the limit-reached prompt when the
                  workspace is out of channel allowance. */}
              {view === "api_manage" && (
                <button
                  onClick={() => openEmbeddedSignup("api")}
                  className="h-11 px-5 rounded-xl bg-primary text-white text-[11px] font-semibold flex items-center gap-2 hover:bg-primary/90 transition-all"
                >
                  <Plus size={12} /> {t("whatsapp_section.header.add_new")}
                </button>
              )}
              {view !== "list" && (
                <button onClick={() => setView("list")} className={outlineBtn}>
                  <ChevronLeft size={12} /> {t("whatsapp_section.header.back")}
                </button>
              )}
            </div>
          </div>

          {/* ── LIST VIEW — 3 cards selector ── */}
          {view === "list" && (
            <div className="p-8 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
              {/* ─── Coex card ─── */}
              <div className={cn("group p-6 rounded-[1.5rem] border transition-all hover:shadow-md hover:border-primary/40 flex flex-col relative overflow-hidden", softBg, softBorder)}>
                <div className="flex items-center justify-between mb-5">
                  <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-500">
                    <Smartphone size={20} />
                  </div>
                  <Badge variant="outline" className="h-6 px-2.5 rounded-md border-emerald-500/20 bg-emerald-500/5 text-emerald-600 dark:text-emerald-400 text-[10px] font-semibold">
                    {t("whatsapp_section.cards.popular")}
                  </Badge>
                </div>

                <div className="space-y-2 mb-5 flex-1">
                  <h3 className={cn("text-[14px] font-black tracking-tight", text)}>{t("whatsapp_section.cards.coex.title")}</h3>
                  <p className={cn("text-[11px] font-medium opacity-70 leading-relaxed", sub)}>
                    {t("whatsapp_section.cards.coex.desc")}
                  </p>

                  {/* Feature checklist — 4 items */}
                  <ul className="space-y-1.5 pt-3 mt-3 border-t border-current/10">
                    {[
                      t("whatsapp_section.cards.coex.feature_1"),
                      t("whatsapp_section.cards.coex.feature_2"),
                      t("whatsapp_section.cards.coex.feature_3"),
                      t("whatsapp_section.cards.coex.feature_4"),
                    ].map((feat) => (
                      <li key={feat} className={cn("text-[11px] font-medium opacity-70 leading-relaxed flex gap-2", sub)}>
                        <Check size={13} className="text-emerald-500 mt-0.5 shrink-0" />
                        <span>{feat}</span>
                      </li>
                    ))}
                  </ul>

                  {/* Prerequisites box — orange warning */}
                  <div className="mt-4 rounded-lg p-3 text-[11px] leading-relaxed bg-amber-50 dark:bg-amber-950/30 border border-amber-200/60 dark:border-amber-800/50 text-amber-800 dark:text-amber-300">
                    <div className="font-semibold text-[10px] mb-1.5 flex items-center gap-1.5">
                      <AlertCircle size={11} /> {t("whatsapp_section.cards.prerequisites_label")}
                    </div>
                    <ul className="space-y-1">
                      <li>• {t("whatsapp_section.cards.coex.prereq_1")}</li>
                      <li>• {t("whatsapp_section.cards.coex.prereq_2")}</li>
                      <li>• {t("whatsapp_section.cards.coex.prereq_3")}</li>
                      <li>• {t("whatsapp_section.cards.coex.prereq_4")}</li>
                    </ul>
                  </div>
                </div>

                <div className="mt-auto space-y-3">
                  <button
                    onClick={() => setView("coex_manage")}
                    className="w-full h-10 px-6 rounded-xl border text-[11px] font-semibold transition-all flex items-center justify-center gap-2 border-primary text-primary hover:bg-primary hover:text-white"
                  >
                    {t("whatsapp_section.cards.manage")}
                  </button>
                  {/* Difficulty indicator */}
                  <div className={cn("flex items-center gap-1.5 text-[10px] font-bold opacity-60", sub)}>
                    <span>{t("whatsapp_section.cards.setup_difficulty")}</span>
                    {[1, 2, 3].map((n) => (
                      <span
                        key={n}
                        className={cn("w-2 h-2 rounded-full", n <= 2 ? "bg-emerald-500" : "bg-slate-300 dark:bg-slate-600")}
                      />
                    ))}
                    <span>{t("whatsapp_section.cards.difficulty_moderate")}</span>
                  </div>
                </div>
              </div>

              {/* ─── API card ─── */}
              <div className={cn("group p-6 rounded-[1.5rem] border transition-all hover:shadow-md hover:border-primary/40 flex flex-col relative overflow-hidden", softBg, softBorder)}>
                <div className="flex items-center justify-between mb-5">
                  <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-500">
                    <Zap size={20} />
                  </div>
                  <a
                    href="https://business.whatsapp.com/products/business-platform"
                    target="_blank"
                    rel="noopener noreferrer"
                    className={cn(
                      "w-8 h-8 rounded-lg flex items-center justify-center transition-all",
                      dark ? "hover:bg-slate-800 text-slate-400 hover:text-primary" : "hover:bg-slate-100 text-slate-500 hover:text-primary",
                    )}
                  >
                    <ExternalLink size={14} />
                  </a>
                </div>

                <div className="space-y-2 mb-5 flex-1">
                  <h3 className={cn("text-[14px] font-black tracking-tight", text)}>{t("whatsapp_section.cards.api.title")}</h3>
                  <p className={cn("text-[11px] font-medium opacity-70 leading-relaxed", sub)}>
                    {t("whatsapp_section.cards.api.desc")}
                  </p>

                  <ul className="space-y-1.5 pt-3 mt-3 border-t border-current/10">
                    {[
                      t("whatsapp_section.cards.api.feature_1"),
                      t("whatsapp_section.cards.api.feature_2"),
                      t("whatsapp_section.cards.api.feature_3"),
                      t("whatsapp_section.cards.api.feature_4"),
                    ].map((feat) => (
                      <li key={feat} className={cn("text-[11px] font-medium opacity-70 leading-relaxed flex gap-2", sub)}>
                        <Check size={13} className="text-emerald-500 mt-0.5 shrink-0" />
                        <span>{feat}</span>
                      </li>
                    ))}
                  </ul>

                  <div className="mt-4 rounded-lg p-3 text-[11px] leading-relaxed bg-amber-50 dark:bg-amber-950/30 border border-amber-200/60 dark:border-amber-800/50 text-amber-800 dark:text-amber-300">
                    <div className="font-semibold text-[10px] mb-1.5 flex items-center gap-1.5">
                      <AlertCircle size={11} /> {t("whatsapp_section.cards.prerequisites_label")}
                    </div>
                    <ul className="space-y-1">
                      <li>• {t("whatsapp_section.cards.api.prereq_1")}</li>
                    </ul>
                  </div>
                </div>

                <div className="mt-auto space-y-3">
                  <button
                    onClick={() => setView("api_manage")}
                    className="w-full h-10 px-6 rounded-xl border text-[11px] font-semibold transition-all flex items-center justify-center gap-2 border-primary text-primary hover:bg-primary hover:text-white"
                  >
                    {t("whatsapp_section.cards.manage")}
                  </button>
                  <div className={cn("flex items-center gap-1.5 text-[10px] font-bold opacity-60", sub)}>
                    <span>{t("whatsapp_section.cards.setup_difficulty")}</span>
                    {[1, 2, 3].map((n) => (
                      <span
                        key={n}
                        className={cn("w-2 h-2 rounded-full", n <= 2 ? "bg-emerald-500" : "bg-slate-300 dark:bg-slate-600")}
                      />
                    ))}
                    <span>{t("whatsapp_section.cards.difficulty_moderate")}</span>
                  </div>
                </div>
              </div>

              {/* ─── QR Code card ─── */}
              <div className={cn("group p-6 rounded-[1.5rem] border transition-all hover:shadow-md hover:border-primary/40 flex flex-col relative overflow-hidden", softBg, softBorder)}>
                <div className="flex items-center justify-between mb-5">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                    <QrCode size={20} />
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Badge variant="outline" className="h-6 px-2.5 rounded-md border-emerald-500/20 bg-emerald-500/5 text-emerald-600 dark:text-emerald-400 text-[10px] font-semibold">
                      {t("whatsapp_section.cards.popular")}
                    </Badge>
                    <Badge variant="outline" className="h-6 px-2.5 rounded-md border-blue-500/20 bg-blue-500/5 text-blue-600 dark:text-blue-400 text-[10px] font-semibold">
                      {t("whatsapp_section.cards.quickest")}
                    </Badge>
                  </div>
                </div>

                <div className="space-y-2 mb-5 flex-1">
                  <h3 className={cn("text-[14px] font-black tracking-tight", text)}>{t("whatsapp_section.cards.qr.title")}</h3>
                  <p className={cn("text-[11px] font-medium opacity-70 leading-relaxed", sub)}>
                    {t("whatsapp_section.cards.qr.desc")}
                  </p>

                  <ul className="space-y-1.5 pt-3 mt-3 border-t border-current/10">
                    {[
                      t("whatsapp_section.cards.qr.feature_1"),
                      t("whatsapp_section.cards.qr.feature_2"),
                      t("whatsapp_section.cards.qr.feature_3"),
                    ].map((feat) => (
                      <li key={feat} className={cn("text-[11px] font-medium opacity-70 leading-relaxed flex gap-2", sub)}>
                        <Check size={13} className="text-emerald-500 mt-0.5 shrink-0" />
                        <span>{feat}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="mt-auto space-y-3">
                  <button
                    onClick={() => setView("qr_manage")}
                    className="w-full h-10 px-6 rounded-xl border text-[11px] font-semibold transition-all flex items-center justify-center gap-2 border-primary text-primary hover:bg-primary hover:text-white"
                  >
                    {t("whatsapp_section.cards.manage")}
                  </button>
                  <div className={cn("flex items-center gap-1.5 text-[10px] font-bold opacity-60", sub)}>
                    <span>{t("whatsapp_section.cards.setup_difficulty")}</span>
                    {[1, 2, 3].map((n) => (
                      <span
                        key={n}
                        className={cn("w-2 h-2 rounded-full", n <= 1 ? "bg-emerald-500" : "bg-slate-300 dark:bg-slate-600")}
                      />
                    ))}
                    <span>{t("whatsapp_section.cards.difficulty_easy")}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── COEX / API MANAGE VIEW ── */}
          {(view === "coex_manage" || view === "api_manage") && (
            <div className="p-8 space-y-5">
              {activeAccounts.length === 0 ? (
                <EmptyIntegrationState
                  dark={dark}
                  text={text}
                  sub={sub}
                  softBg={softBg}
                  softBorder={softBorder}
                  onConnect={() => openEmbeddedSignup(view === "coex_manage" ? "aka" : "api")}
                />
              ) : (
                <div className="space-y-4">
                  {activeAccounts.map((account: any) => (
                    <AccountCard
                      key={account.id}
                      account={account}
                      dark={dark}
                      text={text}
                      sub={sub}
                      card={card}
                      border={border}
                      softBg={softBg}
                      softBorder={softBorder}
                      outlineBtn={outlineBtn}
                      onDeleteAccount={() => setAccountToDelete(account)}
                      onDeleteNumber={(n: any) => setNumberToDelete(n)}
                      onReconnect={(n: any) => setNumberToReconnect(n)}
                      onDefaultReply={(n: any) => setNumberForDefaultReply(n)}
                      onToggleFeeder={(n: any) => feederMutation.mutate(n.id)}
                      onSetupCapi={() => setAccountForCapi(account)}
                      onVerifyAccount={() => verifyAccountMutation.mutate(account.id)}
                      isVerifying={verifyAccountMutation.isPending}
                      onResubscribe={() => resubscribeMutation.mutate(account.id)}
                      onRegisterNumber={(n: any) => setNumberToRegister(n)}
                      onOpenTemplates={() => setLocation(`/templates?wa_account_id=${account.id}`)}
                      coex={view === "coex_manage"}
                      approvedTemplateCount={approvedTemplatesByAccount[String(account.id)] ?? 0}
                      onAddNumber={() => openEmbeddedSignup(view === "coex_manage" ? "aka" : "api")}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── QR MANAGE VIEW (full Z-API replyagent mirror) ── */}
          {view === "qr_manage" && (
            <QrCodeManageView
              card={card}
              border={border}
              text={text}
              sub={sub}
              softBg={softBg}
              softBorder={softBorder}
              outlineBtn={outlineBtn}
              inputCls={inputCls}
              dark={dark}
            />
          )}
        </CardContent>
      </Card>

      {/* An "Add Phone Number" dialog used to live here. It was unreachable —
          nothing ever opened it — and its submit button only raised a "Coming
          soon" toast pointing at Embedded Signup. Adding a number to an existing
          WABA genuinely goes through Embedded Signup (replyagent re-launches the
          same flow and its backend reuses the matching wa_accounts row), which is
          what the header "Add new" button and the dashed add-card already do. */}

      {/* ── Manual Connect Dialog (kept from existing UI) ── */}
      <Dialog
        open={showManualConnectDialog}
        onOpenChange={(open) => {
          setShowManualConnectDialog(open);
          if (!open) setManualErrors({});
        }}
      >
        <DialogContent className={cn("rounded-[2rem] border p-0 max-w-xl overflow-hidden", card, border)}>
          <div className="p-6 space-y-5 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-500">
                <Phone size={16} />
              </div>
              <div>
                <h2 className={cn("text-[14px] font-semibold", text)}>{t("whatsapp_section.manual.title")}</h2>
                <p className={cn("text-[11px] font-medium opacity-60 mt-0.5", sub)}>
                  {t("whatsapp_section.manual.desc")}
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <label className={cn("text-[11px] font-semibold pl-1 block", sub)}>
                  {t("whatsapp_section.manual.account_name_label")} <span className="text-rose-500">*</span>
                </label>
                <Input
                  placeholder={t("whatsapp_section.manual.account_name_placeholder")}
                  value={manualForm.name}
                  onChange={(e) => setManualForm({ ...manualForm, name: e.target.value })}
                  className={inputCls}
                  disabled={manualOnboardMutation.isPending}
                />
                {manualErrors.name && <p className="text-[10px] font-bold text-rose-500 pl-1">{manualErrors.name}</p>}
              </div>

              <div className="space-y-2">
                <label className={cn("text-[11px] font-semibold pl-1 block", sub)}>
                  {t("whatsapp_section.manual.waba_id_label")} <span className="text-rose-500">*</span>
                </label>
                <Input
                  placeholder={t("whatsapp_section.manual.waba_id_placeholder")}
                  value={manualForm.waba_id}
                  onChange={(e) => setManualForm({ ...manualForm, waba_id: e.target.value })}
                  className={inputCls}
                  disabled={manualOnboardMutation.isPending}
                />
                <p className={cn("text-[10px] font-medium opacity-50 pl-1", sub)}>
                  {t("whatsapp_section.manual.waba_id_hint")}
                </p>
                {manualErrors.waba_id && <p className="text-[10px] font-bold text-rose-500 pl-1">{manualErrors.waba_id}</p>}
              </div>

              <div className="space-y-2">
                <label className={cn("text-[11px] font-semibold pl-1 block", sub)}>
                  {t("whatsapp_section.manual.phone_number_id_label")} <span className="text-rose-500">*</span>
                </label>
                <Input
                  placeholder={t("whatsapp_section.manual.phone_number_id_placeholder")}
                  value={manualForm.phone_number_id}
                  onChange={(e) => setManualForm({ ...manualForm, phone_number_id: e.target.value })}
                  className={inputCls}
                  disabled={manualOnboardMutation.isPending}
                />
                <p className={cn("text-[10px] font-medium opacity-50 pl-1", sub)}>
                  {t("whatsapp_section.manual.phone_number_id_hint")}
                </p>
                {manualErrors.phone_number_id && (
                  <p className="text-[10px] font-bold text-rose-500 pl-1">{manualErrors.phone_number_id}</p>
                )}
              </div>

              <div className="space-y-2">
                <label className={cn("text-[11px] font-semibold pl-1 block", sub)}>
                  {t("whatsapp_section.manual.display_phone_label")} <span className="text-rose-500">*</span>
                </label>
                <Input
                  placeholder={t("whatsapp_section.manual.display_phone_placeholder")}
                  value={manualForm.display_phone_number}
                  onChange={(e) => setManualForm({ ...manualForm, display_phone_number: e.target.value })}
                  className={inputCls}
                  disabled={manualOnboardMutation.isPending}
                />
                {manualErrors.display_phone_number && (
                  <p className="text-[10px] font-bold text-rose-500 pl-1">{manualErrors.display_phone_number}</p>
                )}
              </div>

              <div className="space-y-2">
                <label className={cn("text-[11px] font-semibold pl-1 block", sub)}>
                  {t("whatsapp_section.manual.verified_name_label")} <span className="opacity-60 normal-case font-bold">{t("whatsapp_section.manual.optional")}</span>
                </label>
                <Input
                  placeholder={t("whatsapp_section.manual.verified_name_placeholder")}
                  value={manualForm.verified_name}
                  onChange={(e) => setManualForm({ ...manualForm, verified_name: e.target.value })}
                  className={inputCls}
                  disabled={manualOnboardMutation.isPending}
                />
              </div>

              <div className="space-y-2">
                <label className={cn("text-[11px] font-semibold pl-1 block", sub)}>
                  {t("whatsapp_section.manual.access_token_label")} <span className="text-rose-500">*</span>
                </label>
                <Textarea
                  placeholder={t("whatsapp_section.manual.access_token_placeholder")}
                  value={manualForm.access_token}
                  onChange={(e) => setManualForm({ ...manualForm, access_token: e.target.value })}
                  className={cn(inputCls, "h-24 py-3 font-mono text-[11px] resize-none")}
                  disabled={manualOnboardMutation.isPending}
                />
                <p className={cn("text-[10px] font-medium opacity-50 pl-1", sub)}>
                  {t("whatsapp_section.manual.access_token_hint")}
                </p>
                {manualErrors.access_token && (
                  <p className="text-[10px] font-bold text-rose-500 pl-1">{manualErrors.access_token}</p>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setShowManualConnectDialog(false)}
                disabled={manualOnboardMutation.isPending}
                className={cn(outlineBtn, "disabled:opacity-50 disabled:cursor-not-allowed")}
              >
                {t("whatsapp_section.manual.cancel")}
              </button>
              <button
                onClick={submitManualOnboard}
                disabled={manualOnboardMutation.isPending}
                className="h-11 px-7 rounded-xl bg-emerald-500 hover:bg-emerald-600 disabled:bg-emerald-500/50 disabled:cursor-not-allowed text-white text-[11px] font-semibold transition-all shadow-lg shadow-emerald-500/20 flex items-center gap-2"
              >
                {manualOnboardMutation.isPending ? (
                  <>
                    <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></div>
                    {t("whatsapp_section.manual.registering")}
                  </>
                ) : (
                  <>
                    <Plus size={12} /> {t("whatsapp_section.manual.connect_account")}
                  </>
                )}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Reusable dialogs (replyagent-parity safety flows) ── */}
      <DeleteAccountDialog
        open={!!accountToDelete}
        account={accountToDelete}
        onClose={() => setAccountToDelete(null)}
      />
      <DeleteNumberDialog
        open={!!numberToDelete}
        number={numberToDelete}
        onClose={() => setNumberToDelete(null)}
      />
      <ReconnectNumberDialog
        open={!!numberToReconnect}
        number={numberToReconnect}
        onClose={() => setNumberToReconnect(null)}
      />
      <DefaultReplyDialog
        open={!!numberForDefaultReply}
        number={numberForDefaultReply}
        onClose={() => setNumberForDefaultReply(null)}
      />
      <LimitReachedDialog
        open={showLimitDialog}
        limit={channelsLimit}
        onClose={() => setShowLimitDialog(false)}
      />

      {/* ── CAPI quick-setup dialog ── */}
      <CapiSetupDialog
        open={!!accountForCapi}
        account={accountForCapi}
        existing={capiData}
        onClose={() => setAccountForCapi(null)}
      />

      {/* ── Register / 2-step PIN dialog ── */}
      <RegisterPinDialog
        open={!!numberToRegister}
        number={numberToRegister}
        onClose={() => setNumberToRegister(null)}
      />
    </>
  );
}

// ─── Per-account card (replyagent-parity table layout) ────────────────

function AccountCard(props: {
  account: any;
  dark: boolean;
  text: string;
  sub: string;
  card: string;
  border: string;
  softBg: string;
  softBorder: string;
  outlineBtn: string;
  onDeleteAccount: () => void;
  onDeleteNumber: (n: any) => void;
  onReconnect: (n: any) => void;
  onDefaultReply: (n: any) => void;
  onToggleFeeder: (n: any) => void;
  onSetupCapi: () => void;
  onVerifyAccount: () => void;
  isVerifying: boolean;
  onResubscribe: () => void;
  onRegisterNumber: (n: any) => void;
  onOpenTemplates: () => void;
  onAddNumber: () => void;
  coex: boolean;
  approvedTemplateCount: number;
}) {
  const { t } = useTranslation();
  const { account, dark, text, sub, card, border, softBg, softBorder, outlineBtn } = props;

  const accountBadgeTone = account.status === "ACTIVE" ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20" : account.status === "PENDING" ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20" : "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20";

  // ── Gap 9: parse on-behalf-of business info (JSON string from Meta) ──
  const onBehalfOf = (() => {
    if (!account.on_behalf_of_business_info) return null;
    try {
      const parsed =
        typeof account.on_behalf_of_business_info === "string"
          ? JSON.parse(account.on_behalf_of_business_info)
          : account.on_behalf_of_business_info;
      return parsed?.name ?? parsed?.business_name ?? null;
    } catch {
      return null;
    }
  })();

  // ── Gap 4: humanise account review + ownership status into badges ──
  const reviewStatus: string | null = account.account_review_status ?? null;
  const reviewTone =
    reviewStatus === "APPROVED"
      ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
      : reviewStatus === "REJECTED"
        ? "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20"
        : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20";
  const ownershipType: string | null = account.ownership_type ?? null;

  // ── Gap 8: health — surface any account/number error_code ──
  const numbers: any[] = account.phone_numbers ?? [];
  const healthError: string | null =
    account.error_code || numbers.find((n) => n.error_code)?.error_code || null;

  return (
    <div className={cn("rounded-[1.5rem] border overflow-hidden", softBorder, softBg)}>
      {/* Account Header */}
      <div className={cn("px-6 py-4 border-b flex items-center justify-between gap-4 flex-wrap", softBorder, dark ? "bg-slate-900/40" : "bg-white/60")}>
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center shrink-0">
            <img src="/images/automations/whatsapp.svg" alt="WA" className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className={cn("text-[13px] font-black truncate", text)}>{account.name}</p>
              {props.coex && (
                <Badge variant="outline" className="h-5 px-2 rounded-md border-emerald-500/20 bg-emerald-500/5 text-emerald-600 dark:text-emerald-400 text-[10px] font-semibold">
                  {t("whatsapp_section.account.badge_coex")}
                </Badge>
              )}
              <Badge variant="outline" className={cn("h-5 px-2 rounded-md text-[10px] font-semibold", accountBadgeTone)}>
                {account.status}
              </Badge>
              {account.business_verification_status === "verified" && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="inline-flex items-center text-emerald-500">
                        <BadgeCheck size={14} />
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>{t("whatsapp_section.account.verified_tooltip")}</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
              {/* Gap 4 — Meta account review status */}
              {reviewStatus && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Badge variant="outline" className={cn("h-5 px-2 rounded-md text-[10px] font-semibold", reviewTone)}>
                        {t("whatsapp_section.account.review_label", { status: reviewStatus })}
                      </Badge>
                    </TooltipTrigger>
                    <TooltipContent>{t("whatsapp_section.account.review_tooltip")}</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
              {/* Gap 4 — ownership type (CLIENT_OWNED / SHARED / SELF) */}
              {ownershipType && (
                <Badge variant="outline" className={cn("h-5 px-2 rounded-md text-[10px] font-semibold", dark ? "border-slate-700 text-slate-300" : "border-slate-200 text-slate-600")}>
                  {ownershipType.replace(/_/g, " ")}
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2 mt-1 text-[10px] font-bold opacity-70 flex-wrap">
              <span className={sub}>{t("whatsapp_section.account.business_manager")}</span>
              <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-md border", dark ? "border-slate-700 text-slate-300" : "border-slate-200 text-slate-600")}>
                {t("whatsapp_section.account.bm_label", { id: account.waba_id })}
              </span>
              <span className={sub}>
                {t("whatsapp_section.account.numbers_count", { count: numbers.length })}
              </span>
              {account.currency && <span className={sub}>• {account.currency}</span>}
              {/* Gap 9 — on-behalf-of business (partner-managed accounts) */}
              {onBehalfOf && (
                <span className={cn("inline-flex items-center gap-1", sub)}>
                  • <Building2 size={10} /> {t("whatsapp_section.account.on_behalf_of", { name: onBehalfOf })}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          {/* Templates — replyagent gives Business API a dedicated, prominent
              "Manage Templates" action in the account row, while Coexistence
              buries it in the kebab. Templates are the only way a Business API
              number can open a conversation, so the emphasis is deliberate. */}
          {!props.coex && (
            <NeutralButton onClick={props.onOpenTemplates} className={outlineBtn}>
              <CopyIcon size={12} /> {t("whatsapp_section.account.manage_templates")}
            </NeutralButton>
          )}
          {/* Pricing — the two platforms are billed against different published
              rate cards, so replyagent points them at different pages. */}
          <a
            href={
              props.coex
                ? "https://developers.facebook.com/docs/whatsapp/pricing/"
                : `https://business.whatsapp.com/products/platform-pricing?lang=${(navigator.language || "en-US").replace("-", "_")}`
            }
            target="_blank"
            rel="noopener noreferrer"
            className={outlineBtn}
          >
            <Gauge size={12} /> {t("whatsapp_section.account.pricing")} <ExternalLink size={12} />
          </a>
          <a
            href="https://business.facebook.com/settings/whatsapp-business-accounts/"
            target="_blank"
            rel="noopener noreferrer"
            className="h-11 px-5 rounded-xl bg-primary text-white text-[11px] font-semibold flex items-center gap-2 hover:bg-primary/90 transition-all"
          >
            <ExternalLink size={12} /> {props.coex ? t("whatsapp_section.account.access_bm") : t("whatsapp_section.account.manage")}
          </a>

          {/* Secondary actions collapsed into a ⋮ menu (mirrors replyagent header) */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <div role="button" tabIndex={0} className={cn("w-11 h-11 rounded-xl border flex items-center justify-center transition-colors cursor-pointer", dark ? "border-slate-800 hover:bg-slate-800 text-slate-400" : "border-slate-200 hover:bg-slate-100 text-slate-500")}>
                <MoreVertical size={16} />
              </div>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className={cn("rounded-xl p-1.5 min-w-[210px]", dark ? "bg-[#0f1829] border-slate-800" : "")}>
              <DropdownMenuItem onClick={props.onOpenTemplates} className="rounded-lg py-2 cursor-pointer gap-2 font-bold text-[11px]">
                <CopyIcon size={12} /> {t("whatsapp_section.account.menu_templates")}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={props.onSetupCapi} className="rounded-lg py-2 cursor-pointer gap-2 font-bold text-[11px]">
                <Sparkles size={12} /> {account.capi ? t("whatsapp_section.account.menu_capi_configured") : t("whatsapp_section.account.menu_setup_capi")}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={props.onVerifyAccount} disabled={props.isVerifying} className="rounded-lg py-2 cursor-pointer gap-2 font-bold text-[11px]">
                <RefreshCcw size={12} className={props.isVerifying ? "animate-spin" : ""} /> {t("whatsapp_section.account.menu_verify")}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={props.onResubscribe} className="rounded-lg py-2 cursor-pointer gap-2 font-bold text-[11px]">
                <Repeat size={12} /> {t("whatsapp_section.account.menu_resubscribe")}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={props.onDeleteAccount} className="rounded-lg py-2 cursor-pointer gap-2 font-bold text-[11px] text-rose-500">
                <Trash2 size={12} /> {t("whatsapp_section.account.menu_delete_account")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Gap 8 — health alert banner when Meta flags an account/number error */}
      {healthError && (
        <div className="mx-5 mt-4 rounded-xl border border-rose-500/30 bg-rose-500/5 px-4 py-3 flex items-start gap-3">
          <ShieldAlert size={15} className="text-rose-500 mt-0.5 shrink-0" />
          <div className="min-w-0">
            <p className="text-[12px] font-semibold text-rose-600 dark:text-rose-400">
              {t("whatsapp_section.health.action_needed")}
            </p>
            <p className={cn("text-[11px] font-medium opacity-80 mt-0.5", sub)}>
              {t("whatsapp_section.health.desc_prefix")}{" "}
              <span className="font-mono font-bold">{String(healthError)}</span>{t("whatsapp_section.health.desc_middle")}{" "}
              <a
                href="https://developers.facebook.com/docs/whatsapp/cloud-api/support/error-codes"
                target="_blank"
                rel="noopener noreferrer"
                className="underline text-rose-600 dark:text-rose-400"
              >
                {t("whatsapp_section.health.desc_link")}
              </a>
              .
            </p>
          </div>
        </div>
      )}

      {/* Phone Numbers */}
      <div className="p-5">
        <h4 className={cn("text-[11px] font-semibold ml-1 mb-3", sub)}>{t("whatsapp_section.phone.section_title")}</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {(account.phone_numbers ?? []).map((number: any) => (
            <PhoneNumberCard
              key={number.id}
              number={number}
              isCoex={account.onboard_platform === "whatsapp_business_app"}
              dark={dark}
              text={text}
              sub={sub}
              card={card}
              border={border}
              approvedTemplateCount={props.approvedTemplateCount}
              onDelete={() => props.onDeleteNumber(number)}
              onReconnect={() => props.onReconnect(number)}
              onDefaultReply={() => props.onDefaultReply(number)}
              onToggleFeeder={() => props.onToggleFeeder(number)}
              onRegister={() => props.onRegisterNumber(number)}
              onTemplates={props.onOpenTemplates}
              onSetupCapi={props.onSetupCapi}
            />
          ))}

          {/* Dashed "add" card — launches the same onboarding flow as "Add new".
              Rendered as a div (not <button>) so the global `.settings-pane
              button:hover` primary-fill rule can't turn it blue on hover. */}
          <div
            role="button"
            tabIndex={0}
            onClick={props.onAddNumber}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                props.onAddNumber();
              }
            }}
            className={cn(
              "h-full min-h-[180px] rounded-[1rem] border-2 border-dashed flex flex-col items-center justify-center gap-2 text-center cursor-pointer transition-colors",
              dark ? "border-slate-800 bg-slate-900/20 hover:bg-slate-900/40" : "border-slate-200 bg-slate-50 hover:bg-slate-100",
            )}
          >
            <div className={cn("w-10 h-10 rounded-full flex items-center justify-center", dark ? "bg-slate-800 text-slate-400" : "bg-slate-100 text-slate-500")}>
              <Plus size={18} />
            </div>
            <span className={cn("text-[12px] font-bold", text)}>{t("whatsapp_section.phone.add_title")}</span>
            <span className={cn("text-[10px] font-medium opacity-60 max-w-[200px]", sub)}>
              {t("whatsapp_section.phone.add_desc")}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Neutral clickable rendered as a <div> (not <button>) so it opts out of the
 * global `.settings-pane button:hover { background: primary !important }` rule
 * — that rule is !important + high-specificity and can't be beaten by a class,
 * so any real <button> in the settings pane turns blue on hover.
 */
function NeutralButton({
  onClick,
  className,
  children,
}: {
  onClick: () => void;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      }}
      className={className}
    >
      {children}
    </div>
  );
}

function PhoneNumberCard(props: {
  number: any;
  dark: boolean;
  text: string;
  sub: string;
  card: string;
  border: string;
  approvedTemplateCount: number;
  isCoex?: boolean;
  onDelete: () => void;
  onReconnect: () => void;
  onDefaultReply: () => void;
  onToggleFeeder: () => void;
  onRegister: () => void;
  onTemplates: () => void;
  onSetupCapi: () => void;
}) {
  const { t } = useTranslation();
  const { number, dark, text, sub, card, border, approvedTemplateCount, isCoex } = props;
  const { toast } = useToast();

  const isActive = number.status === "ACTIVE";
  const isPending = number.status === "PENDING";
  const isDisconnected = number.status === "DISCONNECTED";
  const isBlocked = number.status === "LOCKED" || number.status === "FAILED";

  // Connection state (left dot) — mirrors replyagent's "• Connected" label.
  const connectedTone = isActive ? "bg-emerald-500" : isPending ? "bg-amber-500" : "bg-rose-500";
  const connectedLabel = isActive
    ? t("whatsapp_section.phone.connected")
    : isPending
      ? t("whatsapp_section.phone.pending")
      : isDisconnected
        ? t("whatsapp_section.phone.disconnected")
        : t("whatsapp_section.phone.blocked");

  // ── Blocked-number detail, mirroring replyagent's status cell ──
  // A LOCKED/FAILED number is unusable until someone acts, and *what* to do
  // depends entirely on the Meta error: a billing failure is fixed in Business
  // Manager, everything else needs the error-code reference. Showing a bare
  // "Blocked" chip (what we had) tells the user nothing actionable, so surface
  // the code and link out the same way replyagent does.
  const errorCode: string | null = number.error_code ? String(number.error_code) : null;
  const isPaymentFailure = errorCode === "PAYMENT_FAILED";
  const blockedTooltip = isPaymentFailure
    ? t("whatsapp_section.phone.payment_failed_tooltip")
    : errorCode
      ? t("whatsapp_section.phone.error_code_tooltip", { code: errorCode })
      : isCoex
        ? t("whatsapp_section.phone.coex_error_tooltip")
        : t("whatsapp_section.phone.api_error_tooltip");
  const blockedLabel = isPaymentFailure ? t("whatsapp_section.phone.blocked") : errorCode ? t("whatsapp_section.phone.blocked") : t("whatsapp_section.phone.error");

  // Meta quality_rating: GREEN = high, YELLOW = medium, RED = low.
  const quality = String(number.quality_rating ?? "").toUpperCase();
  const qualityLabel =
    quality === "GREEN"
      ? t("whatsapp_section.phone.quality_high")
      : quality === "YELLOW"
        ? t("whatsapp_section.phone.quality_medium")
        : quality === "RED"
          ? t("whatsapp_section.phone.quality_low")
          : null;
  const qualityTone = quality === "GREEN" ? "bg-emerald-500" : quality === "YELLOW" ? "bg-amber-500" : quality === "RED" ? "bg-rose-500" : "bg-slate-400";

  const hasAutoReply = !!number.auto_reply_automation_id;
  const rowBorder = dark ? "border-slate-800" : "border-slate-100";
  const shadedRow = dark ? "bg-slate-900/40 border-slate-800" : "bg-slate-50 border-slate-100";
  const manageBtn = cn(
    "h-8 px-3 rounded-lg border text-[11px] font-semibold flex items-center gap-1 shrink-0 transition-all",
    dark ? "border-slate-800 hover:bg-slate-800 text-slate-300" : "border-slate-200 hover:bg-slate-100 text-slate-600",
  );

  const copyNumber = () => {
    try {
      navigator.clipboard?.writeText(number.display_phone_number ?? "");
      toast({ title: t("whatsapp_section.phone.copied_title"), description: number.display_phone_number });
    } catch {
      /* clipboard unavailable — ignore */
    }
  };

  return (
    <div className={cn("rounded-[1rem] border overflow-hidden", card, border, isActive ? "ring-1 ring-emerald-500/30" : "")}>
      {/* Header — icon, name, status dots, ⋮ menu */}
      <div className="p-3 flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-9 h-9 rounded-lg bg-emerald-500/10 text-emerald-500 flex items-center justify-center shrink-0">
            <img src="/images/automations/whatsapp.svg" alt="WA" className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1">
              <p className={cn("text-[13px] font-black truncate", text)}>{number.verified_name || number.display_phone_number}</p>
              {["AVAILABLE_WITHOUT_REVIEW", "APPROVED"].includes(number.name_status) && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="text-emerald-500 shrink-0"><BadgeCheck size={11} /></span>
                    </TooltipTrigger>
                    <TooltipContent>{t("whatsapp_section.phone.name_approved_tooltip")}</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>
            <div className="flex items-center gap-3 mt-1 flex-wrap">
              {isBlocked ? (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      {errorCode && !isPaymentFailure ? (
                        <a
                          href="https://developers.facebook.com/docs/whatsapp/cloud-api/support/error-codes"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-[10px] font-semibold text-rose-500 underline decoration-dotted"
                        >
                          <ShieldAlert size={11} /> {blockedLabel}
                        </a>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-rose-500">
                          <ShieldAlert size={11} /> {blockedLabel}
                        </span>
                      )}
                    </TooltipTrigger>
                    <TooltipContent className="max-w-[260px]">{blockedTooltip}</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              ) : (
                <span className={cn("inline-flex items-center gap-1 text-[10px] font-semibold", sub)}>
                  <span className={cn("w-1.5 h-1.5 rounded-full", connectedTone)} /> {connectedLabel}
                </span>
              )}
              {qualityLabel && (
                <span className={cn("inline-flex items-center gap-1 text-[10px] font-semibold", sub)}>
                  <span className={cn("w-1.5 h-1.5 rounded-full", qualityTone)} /> {qualityLabel}
                </span>
              )}
            </div>
          </div>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <div role="button" tabIndex={0} className={cn("w-8 h-8 rounded-lg flex items-center justify-center transition-colors shrink-0 cursor-pointer", dark ? "hover:bg-slate-800 text-slate-400" : "hover:bg-slate-100 text-slate-500")}>
              <MoreVertical size={14} />
            </div>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className={cn("rounded-xl p-1.5 min-w-[190px]", dark ? "bg-[#0f1829] border-slate-800" : "")}>
            <DropdownMenuItem onClick={props.onDefaultReply} className="rounded-lg py-2 cursor-pointer gap-2 font-bold text-[11px]">
              <ReplyAll size={12} /> {t("whatsapp_section.phone.menu_default_reply")}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={props.onTemplates} className="rounded-lg py-2 cursor-pointer gap-2 font-bold text-[11px]">
              <CopyIcon size={12} /> {t("whatsapp_section.phone.menu_manage_templates")}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={props.onReconnect} className="rounded-lg py-2 cursor-pointer gap-2 font-bold text-[11px]">
              <RotateCw size={12} /> {t("whatsapp_section.phone.menu_refresh_status")}
            </DropdownMenuItem>
            {/* Register / 2-step PIN is Business-API only — replyagent has no
                register flow on Coexistence numbers (they're already registered
                via the WhatsApp Business app), so hide it for the Coex variant. */}
            {!isCoex && (
              <DropdownMenuItem onClick={props.onRegister} className="rounded-lg py-2 cursor-pointer gap-2 font-bold text-[11px]">
                <KeyRound size={12} /> {t("whatsapp_section.phone.menu_register_pin")}
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={props.onDelete} className="rounded-lg py-2 cursor-pointer gap-2 font-bold text-[11px] text-rose-500">
              <Trash2 size={12} /> {t("whatsapp_section.phone.menu_delete_number")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Phone number + copy */}
      <div className="px-3 pb-2 -mt-1">
        <p className={cn("text-[9px] font-bold uppercase tracking-wide opacity-50", sub)}>{t("whatsapp_section.phone.number_label")}</p>
        <div className="flex items-center gap-2 mt-0.5">
          <p className={cn("text-[13px] font-black", text)}>{number.display_phone_number}</p>
          <NeutralButton onClick={copyNumber} className={cn("w-6 h-6 rounded-md flex items-center justify-center cursor-pointer transition-colors", dark ? "hover:bg-slate-800 text-slate-400" : "hover:bg-slate-100 text-slate-500")}>
            <CopyIcon size={12} />
          </NeutralButton>
        </div>
      </div>

      {/* Auto Reply */}
      <div className={cn("px-3 py-2 border-t flex items-center justify-between gap-3", rowBorder)}>
        <div className="flex items-center gap-2 min-w-0">
          <ReplyAll size={15} className="text-emerald-500 shrink-0" />
          <div className="min-w-0">
            <p className={cn("text-[12px] font-bold", text)}>{t("whatsapp_section.phone.auto_reply")}</p>
            <p className={cn("text-[10px] font-medium opacity-60", sub)}>{hasAutoReply ? t("whatsapp_section.phone.configured") : t("whatsapp_section.phone.not_configured")}</p>
          </div>
        </div>
        <NeutralButton onClick={props.onDefaultReply} className={manageBtn}>
          {t("whatsapp_section.phone.set_up")} <ChevronRight size={12} />
        </NeutralButton>
      </div>

      {/* AI item (feeder) */}
      <div className={cn("px-3 py-2 border-t flex items-center justify-between gap-3", rowBorder)}>
        <div className="flex items-center gap-2 min-w-0">
          <Bot size={15} className={cn("shrink-0", number.allow_in_feeder ? "text-emerald-500" : "opacity-50")} />
          <div className="min-w-0">
            <p className={cn("text-[12px] font-bold", text)}>{t("whatsapp_section.phone.ai_item")}</p>
            <p className={cn("text-[10px] font-medium opacity-60", sub)}>{number.allow_in_feeder ? t("whatsapp_section.phone.enabled") : t("whatsapp_section.phone.disabled")}</p>
          </div>
        </div>
        <Switch checked={!!number.allow_in_feeder} onCheckedChange={() => props.onToggleFeeder()} className="data-[state=checked]:bg-emerald-500 shrink-0" />
      </div>

      {/* WhatsApp Templates */}
      <div className={cn("px-3 py-2 border-t flex items-center justify-between gap-3", shadedRow)}>
        <div className="flex items-center gap-2 min-w-0">
          <CopyIcon size={15} className="text-primary shrink-0" />
          <div className="min-w-0">
            <p className={cn("text-[11px] font-bold uppercase tracking-wide", text)}>{t("whatsapp_section.phone.templates_title")}</p>
            <p className={cn("text-[10px] font-medium opacity-60", sub)}>{t("whatsapp_section.phone.approved_count", { count: approvedTemplateCount })}</p>
          </div>
        </div>
        <NeutralButton onClick={props.onTemplates} className={manageBtn}>
          {t("whatsapp_section.phone.manage_btn")} <ChevronRight size={12} />
        </NeutralButton>
      </div>

      {/* Conversions API */}
      <div className={cn("px-3 py-2 border-t flex items-center justify-between gap-3", shadedRow)}>
        <div className="flex items-center gap-2 min-w-0">
          <Sparkles size={15} className="text-primary shrink-0" />
          <p className={cn("text-[11px] font-bold uppercase tracking-wide truncate", text)}>{t("whatsapp_section.phone.conversions_api")}</p>
        </div>
        <NeutralButton onClick={props.onSetupCapi} className={manageBtn}>
          {t("whatsapp_section.phone.manage_btn")} <ChevronRight size={12} />
        </NeutralButton>
      </div>
    </div>
  );
}

// ─── CAPI quick-setup dialog ──────────────────────────────────────────

function CapiSetupDialog({
  open,
  account,
  existing,
  onClose,
}: {
  open: boolean;
  account: any;
  existing: any;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const { mode } = useTheme();
  const dark = mode === "dark";
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [datasetId, setDatasetId] = useState("");
  const [name, setName] = useState("");
  const [token, setToken] = useState("");
  const [showToken, setShowToken] = useState(false);

  useEffect(() => {
    if (open) {
      setDatasetId(existing?.dataset_id ?? "");
      setName(existing?.name ?? account?.name ?? "");
      setToken("");
      setShowToken(false);
    }
  }, [open, existing, account]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/whatsapp/capi/${account?.id}`, {
        dataset_id: datasetId.trim(),
        name: name.trim(),
        token: token.trim(),
      });
      return res.json();
    },
    onSuccess: (data: any) => {
      if (data?.success) {
        toast({ title: t("whatsapp_section.capi.toast_configured") });
        queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/accounts", "phoneNumbers,capi"] });
        queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/capi", account?.id] });
        onClose();
      } else if (data?.error_code === "capi_exists") {
        toast({
          title: t("whatsapp_section.capi.toast_already_configured"),
          description: t("whatsapp_section.capi.toast_delete_existing_first"),
          variant: "destructive",
        });
      } else {
        toast({ title: t("whatsapp_section.capi.toast_could_not_configure"), description: data?.message ?? "", variant: "destructive" });
      }
    },
  });

  // Auto-provision: mint the dataset from Meta server-side (no user input).
  // Mirrors replyagent's single-click setupCapi(wa) → GET /capi/whatsapp/{id}.
  const provisionMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/whatsapp/capi/${account?.id}/provision`, {});
      return res.json();
    },
    onSuccess: (data: any) => {
      if (data?.success) {
        toast({ title: t("whatsapp_section.capi.toast_configured"), description: t("whatsapp_section.capi.toast_provisioned_desc") });
        queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/accounts", "phoneNumbers,capi"] });
        queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/capi", account?.id] });
        onClose();
      } else if (data?.error_code === "capi_exists") {
        toast({ title: t("whatsapp_section.capi.toast_already_configured"), description: t("whatsapp_section.capi.toast_delete_existing_first"), variant: "destructive" });
      } else {
        toast({ title: t("whatsapp_section.capi.toast_could_not_provision"), description: data?.message ?? "", variant: "destructive" });
      }
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("DELETE", `/api/whatsapp/capi/${account?.id}`);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: t("whatsapp_section.capi.toast_removed") });
      queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/accounts", "phoneNumbers,capi"] });
      queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/capi", account?.id] });
      onClose();
    },
  });

  if (!account) return null;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className={cn("rounded-[2rem] border p-0 max-w-xl overflow-hidden", dark ? "bg-[#0f1829] border-slate-800" : "bg-white border-slate-200")}>
        <div className="p-7 space-y-5">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
              <Sparkles size={20} />
            </div>
            <div className="flex-1 min-w-0">
              <div className={cn("text-[14px] font-semibold", dark ? "text-white" : "text-slate-900")}>{t("whatsapp_section.capi.title")}</div>
              <p className={cn("text-[11px] font-medium opacity-60 mt-1 leading-relaxed", dark ? "text-slate-400" : "text-slate-600")}>
                {t("whatsapp_section.capi.desc")}
              </p>
            </div>
          </div>

          {existing ? (
            <div className={cn("p-4 rounded-xl border", dark ? "bg-slate-950/40 border-slate-800" : "bg-slate-50 border-slate-200")}>
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className={cn("text-[12px] font-semibold opacity-60", dark ? "text-slate-400" : "text-slate-600")}>
                    {t("whatsapp_section.capi.dataset_id_label")}
                  </div>
                  <div className={cn("text-[13px] font-bold font-mono truncate", dark ? "text-white" : "text-slate-900")}>{existing.dataset_id}</div>
                  <div className={cn("text-[11px] opacity-60 mt-1", dark ? "text-slate-400" : "text-slate-600")}>{existing.name}</div>
                </div>
                <button
                  onClick={() => deleteMutation.mutate()}
                  disabled={deleteMutation.isPending}
                  className="h-9 px-4 rounded-lg border text-[11px] font-semibold border-rose-500/30 text-rose-500 hover:bg-rose-500 hover:text-white hover:border-rose-500 transition-all"
                >
                  {t("whatsapp_section.capi.remove")}
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Primary path — one click, dataset minted from Meta server-side. */}
              <button
                onClick={() => provisionMutation.mutate()}
                disabled={provisionMutation.isPending}
                className="w-full h-11 rounded-xl text-[12px] font-semibold transition-all flex items-center justify-center gap-2 bg-primary text-white hover:bg-primary/90 disabled:opacity-50"
              >
                <Sparkles size={14} /> {provisionMutation.isPending ? t("whatsapp_section.capi.provisioning") : t("whatsapp_section.capi.auto_provision")}
              </button>
              <div className="flex items-center gap-3">
                <div className={cn("flex-1 h-px", dark ? "bg-slate-800" : "bg-slate-200")} />
                <span className={cn("text-[10px] font-semibold uppercase tracking-wider opacity-50", dark ? "text-slate-400" : "text-slate-500")}>{t("whatsapp_section.capi.or_manual")}</span>
                <div className={cn("flex-1 h-px", dark ? "bg-slate-800" : "bg-slate-200")} />
              </div>
              <div className="space-y-2">
                <label className={cn("text-[11px] font-semibold", dark ? "text-slate-400" : "text-slate-600")}>
                  {t("whatsapp_section.capi.dataset_id_label")} <span className="text-rose-500">*</span>
                </label>
                <Input
                  value={datasetId}
                  onChange={(e) => setDatasetId(e.target.value)}
                  placeholder={t("whatsapp_section.capi.dataset_placeholder")}
                  className={cn("h-11 rounded-xl text-[13px] font-bold", dark ? "bg-slate-950/50 border-slate-800 text-white" : "bg-white border-slate-200 text-slate-900")}
                />
              </div>
              <div className="space-y-2">
                <label className={cn("text-[11px] font-semibold", dark ? "text-slate-400" : "text-slate-600")}>{t("whatsapp_section.capi.name_label")}</label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t("whatsapp_section.capi.name_placeholder")}
                  className={cn("h-11 rounded-xl text-[13px] font-bold", dark ? "bg-slate-950/50 border-slate-800 text-white" : "bg-white border-slate-200 text-slate-900")}
                />
              </div>
              <div className="space-y-2">
                <label className={cn("text-[11px] font-semibold", dark ? "text-slate-400" : "text-slate-600")}>
                  {t("whatsapp_section.capi.access_token_label")} <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <Textarea
                    value={token}
                    onChange={(e) => setToken(e.target.value)}
                    placeholder="EAA..."
                    className={cn("h-24 rounded-xl py-3 font-mono text-[11px] resize-none", dark ? "bg-slate-950/50 border-slate-800 text-white" : "bg-white border-slate-200 text-slate-900", showToken ? "" : "text-security-disc")}
                  />
                  <button
                    onClick={() => setShowToken((s) => !s)}
                    className={cn("absolute top-2 right-2 w-7 h-7 rounded-md flex items-center justify-center transition-all", dark ? "hover:bg-slate-800 text-slate-400" : "hover:bg-slate-100 text-slate-500")}
                    type="button"
                  >
                    {showToken ? <EyeOff size={12} /> : <Eye size={12} />}
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button
              onClick={onClose}
              className={cn("h-10 px-5 rounded-xl border text-[11px] font-semibold transition-all", dark ? "border-slate-700 text-slate-300 hover:border-slate-500" : "border-slate-200 text-slate-700 hover:border-slate-400")}
            >
              {t("whatsapp_section.capi.close")}
            </button>
            {!existing && (
              <button
                onClick={() => saveMutation.mutate()}
                disabled={!datasetId.trim() || !token.trim() || saveMutation.isPending}
                className="h-10 px-5 rounded-xl text-[11px] font-semibold transition-all bg-primary text-white hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {saveMutation.isPending ? t("whatsapp_section.capi.saving") : t("whatsapp_section.capi.save")}
              </button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Register / 2-step PIN dialog (Gap 3) ─────────────────────────────

function RegisterPinDialog({
  open,
  number,
  onClose,
}: {
  open: boolean;
  number: any;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const { mode } = useTheme();
  const dark = mode === "dark";
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [pin, setPin] = useState("");
  const [autoGenerate, setAutoGenerate] = useState(true);
  const [issuedPin, setIssuedPin] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setPin("");
      setAutoGenerate(true);
      setIssuedPin(null);
    }
  }, [open]);

  const registerMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/whatsapp/register/${number?.id}`, {
        ...(autoGenerate ? {} : { pin: pin.trim() }),
      });
      return res.json();
    },
    onSuccess: (data: any) => {
      if (data?.success) {
        setIssuedPin(data?.pin ?? null);
        toast({ title: t("whatsapp_section.register.toast_registered_title"), description: t("whatsapp_section.register.toast_registered_desc") });
        queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/accounts", "phoneNumbers,capi"] });
      } else {
        toast({ title: t("whatsapp_section.register.toast_failed_title"), description: data?.message ?? "", variant: "destructive" });
      }
    },
  });

  if (!number) return null;

  const pinValid = autoGenerate || /^\d{6}$/.test(pin.trim());

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className={cn("rounded-[2rem] border p-0 max-w-md overflow-hidden", dark ? "bg-[#0f1829] border-slate-800" : "bg-white border-slate-200")}>
        <div className="p-7 space-y-5">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-500">
              <ShieldCheck size={20} />
            </div>
            <div className="flex-1 min-w-0">
              <div className={cn("text-[14px] font-semibold", dark ? "text-white" : "text-slate-900")}>
                {t("whatsapp_section.register.title")}
              </div>
              <p className={cn("text-[11px] font-medium opacity-60 mt-1 leading-relaxed", dark ? "text-slate-400" : "text-slate-600")}>
                {t("whatsapp_section.register.desc_prefix")} <span className="font-bold">{number.display_phone_number}</span> {t("whatsapp_section.register.desc_suffix")}
              </p>
            </div>
          </div>

          {issuedPin ? (
            <div className={cn("p-4 rounded-xl border text-center", dark ? "bg-slate-950/40 border-slate-800" : "bg-slate-50 border-slate-200")}>
              <div className={cn("text-[11px] font-semibold opacity-60", dark ? "text-slate-400" : "text-slate-600")}>{t("whatsapp_section.register.pin_label")}</div>
              <div className={cn("text-[28px] font-black tracking-[0.3em] font-mono mt-1", dark ? "text-white" : "text-slate-900")}>{issuedPin}</div>
              <p className="text-[10px] font-bold text-amber-600 dark:text-amber-400 mt-2">{t("whatsapp_section.register.save_now")}</p>
            </div>
          ) : (
            <div className="space-y-3">
              <label className={cn("flex items-center gap-2 cursor-pointer text-[11px] font-bold", dark ? "text-slate-300" : "text-slate-700")}>
                <input type="checkbox" checked={autoGenerate} onChange={(e) => setAutoGenerate(e.target.checked)} className="accent-emerald-500" />
                {t("whatsapp_section.register.auto_generate")}
              </label>
              {!autoGenerate && (
                <div className="space-y-2">
                  <label className={cn("text-[11px] font-semibold", dark ? "text-slate-400" : "text-slate-600")}>
                    {t("whatsapp_section.register.pin_digit_label")} <span className="text-rose-500">*</span>
                  </label>
                  <Input
                    value={pin}
                    onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    placeholder="••••••"
                    inputMode="numeric"
                    className={cn("h-11 rounded-xl text-[15px] font-black tracking-[0.3em] text-center font-mono", dark ? "bg-slate-950/50 border-slate-800 text-white" : "bg-white border-slate-200 text-slate-900")}
                  />
                </div>
              )}
            </div>
          )}

          <div className="flex justify-end gap-3 pt-1">
            <button
              onClick={onClose}
              className={cn("h-10 px-5 rounded-xl border text-[11px] font-semibold transition-all", dark ? "border-slate-700 text-slate-300 hover:border-slate-500" : "border-slate-200 text-slate-700 hover:border-slate-400")}
            >
              {issuedPin ? t("whatsapp_section.register.done") : t("whatsapp_section.register.cancel")}
            </button>
            {!issuedPin && (
              <button
                onClick={() => registerMutation.mutate()}
                disabled={!pinValid || registerMutation.isPending}
                className="h-10 px-5 rounded-xl text-[11px] font-semibold transition-all bg-emerald-500 text-white hover:bg-emerald-600 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {registerMutation.isPending ? t("whatsapp_section.register.registering") : t("whatsapp_section.register.register_btn")}
              </button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Empty integration state ──────────────────────────────────────────

function EmptyIntegrationState({
  dark,
  text,
  sub,
  softBg,
  softBorder,
  onConnect,
}: {
  dark: boolean;
  text: string;
  sub: string;
  softBg: string;
  softBorder: string;
  onConnect: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div className={cn("rounded-[1.5rem] border py-16 px-8 flex flex-col items-center justify-center text-center space-y-5", softBg, softBorder)}>
      <div className="w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center">
        <img src="/images/automations/whatsapp.svg" alt="WhatsApp" className="w-8 h-8" />
      </div>
      <div className="space-y-1.5 max-w-sm">
        <h3 className={cn("text-[14px] font-black tracking-tight", text)}>{t("whatsapp_section.empty.title")}</h3>
        <p className={cn("text-[11px] font-medium opacity-60 leading-relaxed", sub)}>
          {t("whatsapp_section.empty.desc")}
        </p>
      </div>
      <button
        onClick={onConnect}
        className="h-10 px-6 rounded-xl border text-[11px] font-semibold transition-all flex items-center gap-2 border-primary text-primary hover:bg-primary hover:text-white"
      >
        {t("whatsapp_section.empty.connect_now")}
      </button>
    </div>
  );
}
