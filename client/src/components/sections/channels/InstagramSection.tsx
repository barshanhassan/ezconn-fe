import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ChevronLeft,
  MoreVertical,
  Plus,
  Instagram,
  RefreshCw,
  RotateCw,
  Bot,
  Trash2,
  AlertCircle,
  Users,
  Sparkles,
  History,
  Reply,
  MessageSquare,
  BookOpen,
  Image as ImageIcon,
  UserCog,
  Copy,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Switch } from "@/components/ui/switch";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { cn } from "@/lib/utils";
import { useTheme } from "@/contexts/ThemeContext";
import InstagramDefaultReplyDialog from "./InstagramDefaultReplyDialog";
import InstagramIceBreakersDialog from "./InstagramIceBreakersDialog";
import InstagramMainMenuDialog from "./InstagramMainMenuDialog";
import InstagramStoryMentionDialog from "./InstagramStoryMentionDialog";
import InstagramPageUsersDialog from "./InstagramPageUsersDialog";

type View = "list" | "preferred" | "old";

const IG_SCOPES = [
  "instagram_business_basic",
  "instagram_business_manage_messages",
  "instagram_business_manage_comments",
  "instagram_business_content_publish",
  "instagram_business_manage_insights",
].join(",");

const FB_SCOPES = [
  "pages_show_list",
  "instagram_basic",
  "instagram_manage_messages",
  "pages_read_engagement",
].join(",");

function buildIgAuthUrl(appId: string): string {
  const redirectUri = encodeURIComponent(`${window.location.origin}/instagram-callback`);
  return `https://www.instagram.com/oauth/authorize?client_id=${appId}&redirect_uri=${redirectUri}&scope=${encodeURIComponent(IG_SCOPES)}&response_type=code`;
}

// Reconnect variant: carries the existing page id in OAuth `state` so the
// callback refreshes that account's token in place (replyagent "Refresh").
function buildIgReconnectAuthUrl(appId: string, pageId: string | number): string {
  return `${buildIgAuthUrl(appId)}&state=${encodeURIComponent(String(pageId))}`;
}

function buildFbAuthUrl(appId: string, version: string): string {
  const redirectUri = encodeURIComponent(`${window.location.origin}/instagram-pages`);
  return `https://www.facebook.com/${version}/dialog/oauth?client_id=${appId}&redirect_uri=${redirectUri}&scope=${encodeURIComponent(FB_SCOPES)}&response_type=token`;
}

function statusBadge(status: string, t: (key: string) => string) {
  const map: Record<string, { label: string; color: string }> = {
    ACTIVE:       { label: t("instagram_section.status_active"),        color: "text-emerald-600 dark:text-emerald-400" },
    PENDING:      { label: t("instagram_section.status_pending"),       color: "text-amber-600 dark:text-amber-400" },
    FAILED:       { label: t("instagram_section.status_failed"),        color: "text-rose-600 dark:text-rose-400" },
    DISCONNECTED: { label: t("instagram_section.status_disconnected"),  color: "text-slate-500" },
    ERROR:        { label: t("instagram_section.status_error"),         color: "text-rose-600 dark:text-rose-400" },
    NOT_CONNECTED:{ label: t("instagram_section.status_not_connected"), color: "text-slate-500" },
    DELETING:     { label: t("instagram_section.status_deleting"),      color: "text-slate-400" },
    DELETED:      { label: t("instagram_section.status_deleted"),       color: "text-slate-400" },
  };
  const info = map[status] ?? { label: status, color: "text-slate-500" };
  const dot: Record<string, string> = {
    ACTIVE:       "bg-emerald-500",
    PENDING:      "bg-amber-500",
    FAILED:       "bg-rose-500",
    DISCONNECTED: "bg-slate-400",
    ERROR:        "bg-rose-500",
  };
  return (
    <span className={cn("flex items-center gap-1 text-[11px] font-semibold", info.color)}>
      <div className={cn("w-1.5 h-1.5 rounded-full", dot[status] ?? "bg-slate-400")} />
      {info.label}
    </span>
  );
}

export default function InstagramSection() {
  const { t } = useTranslation();
  const { mode } = useTheme();
  const dark = mode === "dark";
  const { toast } = useToast();
  const qc = useQueryClient();

  const card       = dark ? "bg-[#0f1829]"    : "bg-white";
  const border     = dark ? "border-slate-800" : "border-slate-200";
  const text       = dark ? "text-white"       : "text-slate-900";
  const sub        = dark ? "text-slate-500"   : "text-slate-400";
  const softBg     = dark ? "bg-slate-950/40"  : "bg-slate-50/50";
  const softBorder = dark ? "border-slate-800" : "border-slate-100";

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
  const igGradient = "bg-gradient-to-tr from-yellow-400 via-pink-500 to-purple-600";

  const [view, setView] = useState<View>("list");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [accountToDelete, setAccountToDelete] = useState<any>(null);
  // replyagent "delete_media": also purge this account's stored media on delete.
  const [deleteMedia, setDeleteMedia] = useState(false);
  const [showLimitReached, setShowLimitReached] = useState(false);
  // Per-account action modals (replyagent action-row → modal pattern).
  const [defaultReplyAccount, setDefaultReplyAccount] = useState<any>(null);
  const [iceBreakersAccount, setIceBreakersAccount] = useState<any>(null);
  const [mainMenuAccount, setMainMenuAccount] = useState<any>(null);
  const [storyMentionAccount, setStoryMentionAccount] = useState<any>(null);
  const [pageUsersAccount, setPageUsersAccount] = useState<any>(null);

  const { data: channels, isLoading } = useQuery({
    queryKey: ["/api/integrations/channels"],
    queryFn: async () => (await apiRequest("GET", "/api/integrations/channels")).json(),
  });

  // Workspace carries the per-channel cap (replyagent: instagram_channels_limit).
  const { data: workspaceData } = useQuery({
    queryKey: ["/api/workspaces/current"],
    queryFn: async () => (await apiRequest("GET", "/api/workspaces/current")).json(),
  });

  const allAccounts: any[] = channels?.instagram || [];
  const preferredAccounts = allAccounts.filter((a) => a.platform === "instagram" || !a.platform);
  const oldAccounts = allAccounts.filter((a) => a.platform === "facebook");
  const activeAccounts = view === "preferred" ? preferredAccounts : oldAccounts;

  // Limit gating (Preferred accounts). Pure-FE, mirrors replyagent's hasLimit.
  const igLimit = Number(workspaceData?.instagram_channels_limit ?? 1);
  const limitReached = preferredAccounts.length >= igLimit;

  const deleteMutation = useMutation({
    mutationFn: async ({ id, deleteMedia }: { id: string | number; deleteMedia: boolean }) => {
      await apiRequest("DELETE", `/api/integrations/channels/instagram/${id}`, { delete_media: deleteMedia });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/integrations/channels"] });
      toast({ title: t("instagram_section.toast_deleted_title"), description: t("instagram_section.toast_deleted_desc") });
    },
    onError: () => toast({ title: t("instagram_section.toast_error_title"), description: t("instagram_section.toast_delete_error_desc"), variant: "destructive" }),
  });

  const feederMutation = useMutation({
    mutationFn: async ({ id, enabled }: { id: string | number; enabled: boolean }) => {
      await apiRequest("POST", `/api/instagram/pages/${id}/toggle-feeder`, { enabled });
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["/api/integrations/channels"] });
      toast({
        title: t("instagram_section.toast_updated_title"),
        description: vars.enabled ? t("instagram_section.toast_feeder_enabled_desc") : t("instagram_section.toast_feeder_disabled_desc"),
      });
    },
    onError: () => toast({ title: t("instagram_section.toast_error_title"), description: t("instagram_section.toast_feeder_error_desc"), variant: "destructive" }),
  });

  const syncMutation = useMutation({
    mutationFn: async (id: string | number) => {
      await apiRequest("POST", `/api/instagram/pages/${id}/sync`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/integrations/channels"] });
      toast({ title: t("instagram_section.toast_synced_title"), description: t("instagram_section.toast_synced_desc") });
    },
    onError: () => toast({ title: t("instagram_section.toast_sync_failed_title"), description: t("instagram_section.toast_sync_failed_desc"), variant: "destructive" }),
  });

  function handleAddNew() {
    const igAppId = "996773679700787";
    const fbAppId = "979553311024998";
    const version = "v22.0";
    if (view === "preferred") {
      // Block OAuth once the workspace's Instagram cap is hit (replyagent).
      if (limitReached) {
        setShowLimitReached(true);
        return;
      }
      window.location.href = buildIgAuthUrl(igAppId);
    } else {
      window.location.href = buildFbAuthUrl(fbAppId, version);
    }
  }

  // Reconnect = re-run IG OAuth carrying this page's id so the existing row's
  // token is refreshed in place (replyagent "Refresh"). Preferred accounts only.
  function handleReconnect(account: any) {
    const igAppId = "996773679700787";
    window.location.href = buildIgReconnectAuthUrl(igAppId, account.id);
  }

  // Old (Facebook-managed) reconnect = re-run FB OAuth; the page-picker upserts
  // the existing row by ig_user_id/page_id so its token is refreshed in place
  // (replyagent OLD "Refresh" also re-auths through Facebook).
  function handleReconnectOld() {
    const fbAppId = "979553311024998";
    const version = "v22.0";
    window.location.href = buildFbAuthUrl(fbAppId, version);
  }

  function copyId(id: string | number) {
    navigator.clipboard?.writeText(String(id)).then(
      () => toast({ title: t("instagram_section.toast_copied_title"), description: t("instagram_section.toast_copied_desc") }),
      () => {},
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  // ── Manage view (preferred | old) ───────────────────────────────────
  if (view === "preferred" || view === "old") {
    const isPreferred = view === "preferred";
    return (
      <>
        <Card className={cn("rounded-[2rem] border overflow-hidden shadow-sm", card, border)}>
          <CardContent className="p-0">
            {/* Header */}
            <div className={cn("px-8 py-5 border-b flex items-center justify-between", border)}>
              <div className="flex items-center gap-4">
                <div className={cn("p-2.5 rounded-xl shadow-sm", dark ? "bg-pink-500/15" : "bg-pink-500/10")}>
                  <Instagram className="w-5 h-5 text-pink-500" />
                </div>
                <div>
                  <h1 className={cn("text-[16px] font-bold tracking-tight", text)}>
                    {isPreferred ? "Instagram" : t("instagram_section.title_facebook_managed")}
                  </h1>
                  <p className={cn("text-[11px] font-bold mt-0.5 opacity-60", sub)}>
                    {isPreferred
                      ? t("instagram_section.subtitle_preferred")
                      : t("instagram_section.subtitle_old")}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button onClick={handleAddNew} className={primaryOutlineBtn}>
                  <Plus size={12} /> {t("instagram_section.btn_add_new")}
                </button>
                <button onClick={() => setView("list")} className={outlineBtn}>
                  <ChevronLeft size={12} /> {t("instagram_section.btn_back")}
                </button>
              </div>
            </div>

            {/* Accounts */}
            <div className="p-8 space-y-5">
              {activeAccounts.length === 0 ? (
                <div className={cn("rounded-[1.5rem] border py-16 px-8 flex flex-col items-center justify-center text-center space-y-5", softBg, softBorder)}>
                  <div className={cn("w-16 h-16 rounded-full flex items-center justify-center", igGradient)}>
                    <Instagram className="w-8 h-8 text-white" />
                  </div>
                  <div className="space-y-1.5 max-w-sm">
                    <h3 className={cn("text-[14px] font-black tracking-tight", text)}>
                      {isPreferred ? t("instagram_section.empty_title_preferred") : t("instagram_section.empty_title_old")}
                    </h3>
                    <p className={cn("text-[11px] font-medium opacity-60 leading-relaxed", sub)}>
                      {isPreferred
                        ? t("instagram_section.empty_desc_preferred")
                        : t("instagram_section.empty_desc_old")}
                    </p>
                  </div>
                  <button onClick={handleAddNew} className={primaryOutlineBtn}>
                    {t("instagram_section.btn_connect_now")}
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {activeAccounts.map((account: any) => (
                    <div key={account.id} className={cn("rounded-[1.5rem] border overflow-hidden", softBorder, softBg)}>
                      {/* Account header */}
                      <div className={cn("px-6 py-4 border-b flex items-center justify-between gap-4", softBorder, dark ? "bg-slate-900/40" : "bg-white/60")}>
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="relative shrink-0">
                            {account.picture?.file_url ? (
                              <img src={account.picture.file_url} alt={account.name} className="w-12 h-12 rounded-full object-cover" />
                            ) : (
                              <div className={cn("w-12 h-12 rounded-full flex items-center justify-center", igGradient)}>
                                <Users className="w-5 h-5 text-white" />
                              </div>
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className={cn("text-[13px] font-black truncate", text)}>{account.name || t("instagram_section.default_account_name")}</p>
                            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                              {account.username && (
                                <Badge variant="outline" className="h-5 px-2 rounded-md border-pink-500/20 bg-pink-500/5 text-pink-600 dark:text-pink-400 text-[10px] font-semibold">
                                  @{account.username}
                                </Badge>
                              )}
                              {statusBadge(account.status ?? "ACTIVE", t)}
                              {account.fail_reason && (
                                <span className={cn("text-[9px] font-medium truncate max-w-[200px]", sub)}>{account.fail_reason}</span>
                              )}
                            </div>
                            {/* Instagram Page ID (replyagent: insta_page_id), show-if-present */}
                            {account.ig_user_id && (
                              <div className="flex items-center gap-1.5 mt-1">
                                <span className={cn("text-[9px] font-semibold opacity-40", sub)}>ID</span>
                                <span className={cn("text-[10px] font-mono truncate max-w-[180px] opacity-70", sub)}>{account.ig_user_id}</span>
                                <button
                                  onClick={() => copyId(account.ig_user_id)}
                                  className={cn("opacity-50 hover:opacity-100 transition-opacity", sub)}
                                  title={t("instagram_section.tooltip_copy_page_id")}
                                >
                                  <Copy size={10} />
                                </button>
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            onClick={() => (isPreferred ? handleReconnect(account) : handleReconnectOld())}
                            className={cn(outlineBtn, "h-9 px-4")}
                            title={t("instagram_section.tooltip_reconnect")}
                          >
                            <RotateCw size={11} /> {t("instagram_section.btn_reconnect")}
                          </button>
                          <button
                            onClick={() => syncMutation.mutate(account.id)}
                            disabled={syncMutation.isPending}
                            className={cn(outlineBtn, "h-9 px-4")}
                          >
                            <RefreshCw size={11} className={syncMutation.isPending ? "animate-spin" : ""} /> {t("instagram_section.btn_sync")}
                          </button>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button className={cn("w-9 h-9 rounded-xl border flex items-center justify-center transition-all", dark ? "border-slate-800 hover:border-primary/40 hover:text-primary" : "border-slate-200 hover:border-primary/40 hover:text-primary")}>
                                <MoreVertical size={13} />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className={cn("rounded-xl p-1.5 min-w-[200px]", dark ? "bg-[#0f1829] border-slate-800" : "")}>
                              <DropdownMenuItem
                                onSelect={(e) => e.preventDefault()}
                                className="rounded-lg py-2 cursor-pointer gap-2 font-bold text-[11px] flex justify-between"
                              >
                                <span className="flex items-center gap-2">
                                  <Bot size={12} className="text-primary" /> {t("instagram_section.label_ai_feeder")}
                                </span>
                                <Switch
                                  checked={!!account.allow_in_feeder}
                                  onCheckedChange={(v) => feederMutation.mutate({ id: account.id, enabled: v })}
                                  className="data-[state=checked]:bg-primary"
                                />
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => { setAccountToDelete(account); setDeleteMedia(false); setShowDeleteConfirm(true); }}
                                className="rounded-lg py-2 cursor-pointer gap-2 font-bold text-[11px] text-rose-500"
                              >
                                <Trash2 size={12} /> {t("instagram_section.btn_delete")}
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>

                      {/* Stats — only render those > 0 (replyagent show-if->0) */}
                      {(() => {
                        const visibleStats = [
                          { label: t("instagram_section.stat_posts"),     value: account.media_count },
                          { label: t("instagram_section.stat_followers"), value: account.followers_count },
                          { label: t("instagram_section.stat_following"), value: account.follows_count },
                        ].filter((s) => s.value != null && Number(s.value) > 0);
                        if (visibleStats.length === 0) return null;
                        return (
                      <div className="flex divide-x" style={{ borderColor: dark ? "rgb(30 41 59)" : "rgb(241 245 249)" }}>
                        {visibleStats.map((stat) => (
                          <div key={stat.label} className="flex-1 px-6 py-4 text-center" style={{ borderColor: dark ? "rgb(30 41 59)" : "rgb(241 245 249)" }}>
                            <p className={cn("text-[18px] font-black", text)}>{Number(stat.value).toLocaleString()}</p>
                            <p className={cn("text-[10px] font-semibold opacity-60 mt-0.5", sub)}>{stat.label}</p>
                          </div>
                        ))}
                      </div>
                        );
                      })()}

                      {/* Action row (replyagent: per-account feature buttons, ACTIVE only) */}
                      {(account.status ?? "ACTIVE") === "ACTIVE" && (
                        <div className={cn("px-6 py-4 border-t flex flex-wrap gap-2", softBorder)}>
                          <button onClick={() => setDefaultReplyAccount(account)} className={cn(outlineBtn, "h-9 px-4")}>
                            <Reply size={11} /> {t("instagram_section.btn_default_reply")}
                          </button>
                          <button onClick={() => setIceBreakersAccount(account)} className={cn(outlineBtn, "h-9 px-4")}>
                            <MessageSquare size={11} /> {t("instagram_section.btn_quick_starter")}
                          </button>
                          <button onClick={() => setMainMenuAccount(account)} className={cn(outlineBtn, "h-9 px-4")}>
                            <BookOpen size={11} /> {t("instagram_section.btn_main_menu")}
                          </button>
                          {account.platform !== "facebook" && (
                            <button onClick={() => setStoryMentionAccount(account)} className={cn(outlineBtn, "h-9 px-4")}>
                              <ImageIcon size={11} /> {t("instagram_section.btn_story_mention")}
                            </button>
                          )}
                          <button onClick={() => setPageUsersAccount(account)} className={cn(outlineBtn, "h-9 px-4")}>
                            <UserCog size={11} /> {t("instagram_section.btn_page_users")}
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Delete dialog */}
        <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
          <AlertDialogContent className={cn("rounded-[2rem] border p-0 max-w-md overflow-hidden", card, border)}>
            <div className="p-6 space-y-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-rose-500/10 flex items-center justify-center text-rose-500">
                  <AlertCircle size={18} />
                </div>
                <div>
                  <h2 className={cn("text-[14px] font-semibold", text)}>{t("instagram_section.delete_dialog_title")}</h2>
                  <p className={cn("text-[11px] font-medium opacity-60 mt-0.5 leading-relaxed", sub)}>
                    <span className="text-rose-500 font-black">{accountToDelete?.name}</span> {t("instagram_section.delete_dialog_desc_suffix")}
                  </p>
                </div>
              </div>
              <label className={cn("flex items-start gap-3 px-3 py-3 rounded-xl border cursor-pointer transition-all", deleteMedia ? "border-rose-500/40 bg-rose-500/5" : softBorder)}>
                <input
                  type="checkbox"
                  checked={deleteMedia}
                  onChange={(e) => setDeleteMedia(e.target.checked)}
                  className="mt-0.5 w-4 h-4 accent-rose-500 cursor-pointer"
                />
                <span className={cn("text-[11px] font-medium leading-relaxed", sub)}>
                  {t("instagram_section.delete_media_checkbox_label")}
                </span>
              </label>
              <div className="flex justify-end gap-2">
                <AlertDialogCancel className={cn(outlineBtn, "m-0")}>{t("instagram_section.btn_cancel")}</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => { deleteMutation.mutate({ id: accountToDelete.id, deleteMedia }); setShowDeleteConfirm(false); }}
                  className="h-11 px-7 rounded-xl bg-rose-500 hover:bg-rose-600 text-white text-[11px] font-semibold transition-all shadow-lg shadow-rose-500/20 flex items-center gap-2"
                >
                  <Trash2 size={12} /> {t("instagram_section.btn_delete")}
                </AlertDialogAction>
              </div>
            </div>
          </AlertDialogContent>
        </AlertDialog>

        <InstagramDefaultReplyDialog
          open={!!defaultReplyAccount}
          account={defaultReplyAccount}
          onClose={() => setDefaultReplyAccount(null)}
        />

        <InstagramIceBreakersDialog
          open={!!iceBreakersAccount}
          account={iceBreakersAccount}
          onClose={() => setIceBreakersAccount(null)}
        />

        <InstagramMainMenuDialog
          open={!!mainMenuAccount}
          account={mainMenuAccount}
          onClose={() => setMainMenuAccount(null)}
        />

        <InstagramStoryMentionDialog
          open={!!storyMentionAccount}
          account={storyMentionAccount}
          onClose={() => setStoryMentionAccount(null)}
        />

        <InstagramPageUsersDialog
          open={!!pageUsersAccount}
          account={pageUsersAccount}
          onClose={() => setPageUsersAccount(null)}
        />

        {/* Limit reached (replyagent: contact admin to raise the cap) */}
        <AlertDialog open={showLimitReached} onOpenChange={setShowLimitReached}>
          <AlertDialogContent className={cn("rounded-[2rem] border p-0 max-w-md overflow-hidden", card, border)}>
            <div className="p-6 space-y-5 text-center">
              <div className="flex flex-col items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-500">
                  <AlertCircle size={22} />
                </div>
                <div>
                  <h2 className={cn("text-[14px] font-semibold", text)}>{t("instagram_section.limit_reached_title")}</h2>
                  <p className={cn("text-[11px] font-medium opacity-60 mt-1.5 leading-relaxed", sub)}>
                    {t("instagram_section.limit_reached_desc_prefix")}{" "}
                    <span className="font-black text-amber-500">{igLimit}</span> {t("instagram_section.limit_reached_desc_suffix")}
                  </p>
                </div>
              </div>
              <div className="flex justify-center">
                <AlertDialogAction className="h-11 px-8 rounded-xl bg-primary hover:bg-primary/90 text-white text-[11px] font-semibold transition-all">
                  {t("instagram_section.btn_ok")}
                </AlertDialogAction>
              </div>
            </div>
          </AlertDialogContent>
        </AlertDialog>
      </>
    );
  }

  // ── List view: 2 cards (Preferred + Old) ────────────────────────────
  return (
    <Card className={cn("rounded-[2rem] border overflow-hidden shadow-sm transition-all duration-300", card, border)}>
      <CardContent className="p-0">
        {/* Header */}
        <div className={cn("px-8 py-5 border-b flex items-center gap-4", border)}>
          <div className={cn("p-2.5 rounded-xl shadow-sm", dark ? "bg-pink-500/15" : "bg-pink-500/10")}>
            <Instagram className="w-5 h-5 text-pink-500" />
          </div>
          <div>
            <h1 className={cn("text-[16px] font-bold tracking-tight", text)}>Instagram</h1>
            <p className={cn("text-[11px] font-bold mt-0.5 opacity-60", sub)}>
              {t("instagram_section.list_subtitle")}
            </p>
          </div>
        </div>

        {/* 2 cards */}
        <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Preferred card */}
          <div className={cn("p-6 rounded-[1.5rem] border transition-all hover:shadow-md hover:border-pink-500/30 flex flex-col", softBg, softBorder)}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-pink-500/10 flex items-center justify-center">
                  <Instagram size={18} className="text-pink-500" />
                </div>
                <div>
                  <h3 className={cn("text-[13px] font-black tracking-tight", text)}>Instagram</h3>
                  {preferredAccounts.length > 0 && (
                    <span className={cn("text-[10px] font-black", sub)}>{t("instagram_section.connected_count", { count: preferredAccounts.length })}</span>
                  )}
                </div>
              </div>
              <Badge className="h-5 px-2.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 text-[10px] font-semibold border">
                {t("instagram_section.badge_preferred")}
              </Badge>
            </div>
            <p className={cn("text-[11px] font-medium opacity-70 leading-relaxed mb-5 flex-1", sub)}>
              {t("instagram_section.preferred_card_desc")}
            </p>
            <button onClick={() => setView("preferred")} className={cn(primaryOutlineBtn, "self-end")}>
              {t("instagram_section.btn_manage")}
            </button>
          </div>

          {/* Old card */}
          <div className={cn("p-6 rounded-[1.5rem] border transition-all hover:shadow-md hover:border-slate-400/30 flex flex-col", softBg, softBorder)}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-pink-500/10 flex items-center justify-center">
                  <Instagram size={18} className="text-pink-500" />
                </div>
                <div>
                  <h3 className={cn("text-[13px] font-black tracking-tight", text)}>Instagram</h3>
                  {oldAccounts.length > 0 && (
                    <span className={cn("text-[10px] font-black", sub)}>{t("instagram_section.connected_count", { count: oldAccounts.length })}</span>
                  )}
                </div>
              </div>
              <span className={cn("text-[11px] font-black", sub)}>{t("instagram_section.badge_old")}</span>
            </div>
            <p className={cn("text-[11px] font-medium opacity-70 leading-relaxed mb-5 flex-1", sub)}>
              {t("instagram_section.old_card_desc")}
            </p>
            <button onClick={() => setView("old")} className={cn(primaryOutlineBtn, "self-end")}>
              {t("instagram_section.btn_manage")}
            </button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
