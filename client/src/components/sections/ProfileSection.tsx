import React, { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { User, Lock, Bell, Camera, Loader2, ShieldCheck, EyeOff, Smile, Bot, FileText, Mail } from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { getAvatarColor } from "@/lib/avatar-utils";
import { useTranslation } from "react-i18next";
import ChangePasswordSection from "./ChangePasswordSection";

interface ProfileSectionProps {
  // "workspace" (default) shows the full preference set, including Live
  // Chat behavior toggles (CSAT, auto-hide, handoff, transcripts) — those
  // are workspace-scoped conversation settings and don't make sense for an
  // Agency account, which manages multiple workspaces rather than being
  // one. "agency" hides them and keeps only account-level toggles.
  context?: "workspace" | "agency";
}

const CHAT_PREFERENCE_ROWS = [
  { key: "autoHide", titleKey: "auto_hide_title", descKey: "auto_hide_desc", icon: EyeOff },
  { key: "disableCSAT", titleKey: "disable_csat_title", descKey: "disable_csat_desc", icon: Smile },
  { key: "manualHandoff", titleKey: "manual_handoff_title", descKey: "manual_handoff_desc", icon: Bot },
  { key: "enableTranscript", titleKey: "enable_transcript_title", descKey: "enable_transcript_desc", icon: FileText },
];

// Combined "My Profile" page — Account Details / Password / Notifications &
// Preferences tabs, mirroring ReplyAgent's single tabbed Profile page
// instead of the two separate (and previously fake) Profile/Preferences
// sections. All three tabs are wired to real backend endpoints.
export default function ProfileSection({ context = "workspace" }: ProfileSectionProps) {
  const { mode } = useTheme();
  const dark = mode === "dark";
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  const card = dark ? "bg-[#0f1829]" : "bg-white";
  const border = dark ? "border-slate-800" : "border-slate-200";
  const text = dark ? "text-white" : "text-slate-900";
  const sub = dark ? "text-slate-500" : "text-slate-400";

  const inputCls = cn(
    "h-11 rounded-xl text-[13px] font-medium transition-all px-4",
    "focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:border-primary/50",
    dark ? "bg-slate-950/50 border-slate-800 text-white" : "bg-white border-slate-200 text-slate-900"
  );

  const { data: me, isLoading } = useQuery<any>({
    queryKey: ["/api/users/me"],
    queryFn: async () => (await apiRequest("GET", "/api/users/me")).json(),
  });

  const { data: preferences } = useQuery<any>({
    queryKey: ["/api/users/preferences"],
    queryFn: async () => (await apiRequest("GET", "/api/users/preferences")).json(),
  });

  // ── Account Details ──────────────────────────────────────────────────
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");

  useEffect(() => {
    if (!me) return;
    setFirstName(me.first_name || "");
    setLastName(me.last_name || "");
    setEmail(me.email || "");
  }, [me]);

  const saveAccountMutation = useMutation({
    mutationFn: async () => {
      const name = [firstName, lastName].filter(Boolean).join(" ").trim();
      await apiRequest("POST", "/api/users/update", { name, email });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users/me"] });
      toast({ title: t("profile_page.saved_title"), description: t("profile_page.saved_desc") });
    },
    onError: (e: any) => {
      toast({ title: t("profile_page.error_title"), description: e.message || t("profile_page.error_update_desc"), variant: "destructive" });
    },
  });

  const uploadPhotoMutation = useMutation({
    mutationFn: async (file: File) => {
      const fd = new FormData();
      fd.append("file", file);
      await apiRequest("POST", "/api/users/logo", fd);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users/me"] });
      toast({ title: t("profile_page.photo_updated_title"), description: t("profile_page.photo_updated_desc") });
    },
    onError: (e: any) => {
      toast({ title: t("profile_page.error_title"), description: e.message || t("profile_page.error_photo_desc"), variant: "destructive" });
    },
  });

  // ── Notifications & Preferences ──────────────────────────────────────
  const [browserDenied, setBrowserDenied] = useState(
    typeof Notification !== "undefined" && Notification.permission === "denied"
  );
  const [desktopNotifs, setDesktopNotifs] = useState(false);
  const [prefs, setPrefs] = useState({
    twoFactorAuth: false,
    autoHide: false,
    disableCSAT: false,
    manualHandoff: false,
    enableTranscript: false,
    emailTranscript: false,
    transcriptEmails: "",
  });

  useEffect(() => {
    if (preferences) setPrefs((p) => ({ ...p, ...preferences }));
  }, [preferences]);

  const savePrefsMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/users/preferences", prefs);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users/preferences"] });
      toast({ title: t("profile_page.prefs_saved_title"), description: t("profile_page.prefs_saved_desc") });
    },
    onError: (e: any) => {
      toast({ title: t("profile_page.error_title"), description: e.message || t("profile_page.prefs_error_desc"), variant: "destructive" });
    },
  });

  const handleTestNotification = () => {
    if (!("Notification" in window)) {
      alert(t("profile_page.notif_unsupported"));
      return;
    }
    const notifTitle = t("profile_page.notif_test_title");
    const notifBody = t("profile_page.notif_test_body");
    if (Notification.permission === "granted") {
      new Notification(notifTitle, { body: notifBody });
    } else if (Notification.permission !== "denied") {
      Notification.requestPermission().then((permission) => {
        if (permission === "granted") {
          new Notification(notifTitle, { body: notifBody });
          setBrowserDenied(false);
        } else if (permission === "denied") {
          setBrowserDenied(true);
        }
      });
    }
  };

  const initials = [firstName?.[0], lastName?.[0]].filter(Boolean).join("").toUpperCase() || "?";

  return (
    <Tabs defaultValue="account" className="space-y-4">
      <div className={cn("border-b flex justify-start overflow-x-auto", dark ? "border-slate-800" : "border-slate-200")}>
        <TabsList className="h-auto p-0 gap-8 bg-transparent border-none flex justify-start rounded-none">
          {[
            { value: "account", icon: User, label: t("profile_page.tab_account") },
            { value: "password", icon: Lock, label: t("profile_page.tab_password") },
            { value: "preferences", icon: Bell, label: t("profile_page.tab_preferences") },
          ].map(({ value, icon: Icon, label }) => (
            <TabsTrigger
              key={value}
              value={value}
              className={cn(
                "flex items-center gap-2 px-1 py-4 rounded-none text-[12px] font-semibold whitespace-nowrap transition-all shadow-none bg-transparent border-b-2 border-transparent",
                "data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-primary data-[state=active]:text-primary",
                "hover:text-primary",
                dark ? "text-slate-500" : "text-slate-400"
              )}
            >
              <Icon size={14} /> {label}
            </TabsTrigger>
          ))}
        </TabsList>
      </div>

      {/* ── Account Details ── */}
      <TabsContent value="account">
        <Card className={cn("rounded-[2rem] border overflow-hidden shadow-sm", card, border)}>
          <CardContent className="p-8 space-y-6">
            {isLoading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : (
              <>
                <div className="flex items-center gap-5">
                  <div className="relative">
                    <Avatar className="h-20 w-20">
                      {me?.avatar_url ? (
                        <AvatarImage src={me.avatar_url} alt="Profile" />
                      ) : (
                        <AvatarFallback className={cn(getAvatarColor(email || "?"), "text-xl")}>
                          {initials}
                        </AvatarFallback>
                      )}
                    </Avatar>
                    <label
                      htmlFor="profile-photo-upload"
                      className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-primary text-white flex items-center justify-center cursor-pointer shadow-md hover:bg-primary/90 transition-colors"
                    >
                      {uploadPhotoMutation.isPending ? (
                        <Loader2 size={13} className="animate-spin" />
                      ) : (
                        <Camera size={13} />
                      )}
                    </label>
                    <input
                      id="profile-photo-upload"
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) uploadPhotoMutation.mutate(file);
                      }}
                    />
                  </div>
                  <div>
                    <p className={cn("text-[16px] font-bold", text)}>
                      {[firstName, lastName].filter(Boolean).join(" ") || "—"}
                    </p>
                    <p className={cn("text-[12px]", sub)}>{email}</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className={cn("text-[12px] font-semibold", text)}>{t("profile_page.first_name")}</label>
                    <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} className={inputCls} />
                  </div>
                  <div className="space-y-1.5">
                    <label className={cn("text-[12px] font-semibold", text)}>{t("profile_page.last_name")}</label>
                    <Input value={lastName} onChange={(e) => setLastName(e.target.value)} className={inputCls} />
                  </div>
                  <div className="space-y-1.5">
                    <label className={cn("text-[12px] font-semibold", text)}>{t("profile_page.email")}</label>
                    <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} />
                  </div>
                  <div className="space-y-1.5">
                    <label className={cn("text-[12px] font-semibold", text)}>{t("profile_page.role")}</label>
                    <Input readOnly value={me?.role_name || "—"} className={cn(inputCls, "cursor-default opacity-70")} />
                  </div>
                  {/* Team is a Workspace concept (team_members are scoped to
                      a single workspace) — meaningless for an Agency
                      account, which spans many workspaces, so it's excluded
                      there rather than always showing "No team assigned". */}
                  {context === "workspace" && (
                    <div className="space-y-1.5">
                      <label className={cn("text-[12px] font-semibold", text)}>{t("profile_page.team")}</label>
                      <Input readOnly value={me?.team_name || t("profile_page.no_team_assigned")} className={cn(inputCls, "cursor-default opacity-70")} />
                    </div>
                  )}
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    onClick={() => saveAccountMutation.mutate()}
                    disabled={saveAccountMutation.isPending}
                    className="h-11 px-8 rounded-xl bg-primary hover:bg-primary/90 disabled:opacity-50 text-white text-[12px] font-semibold transition-all"
                  >
                    {saveAccountMutation.isPending ? t("profile_page.saving") : t("profile_page.save_changes")}
                  </button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </TabsContent>

      {/* ── Password ── */}
      <TabsContent value="password">
        <ChangePasswordSection />
      </TabsContent>

      {/* ── Notifications & Preferences ── */}
      <TabsContent value="preferences">
        <Card className={cn("rounded-[2rem] border overflow-hidden shadow-sm", card, border)}>
          <CardContent className="p-8 space-y-6">
            {/* Desktop notifications */}
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-start gap-2">
                  <div className="p-1.5 rounded-lg bg-primary/10 text-primary shrink-0"><Bell size={14} /></div>
                  <div>
                    <h4 className={cn("font-semibold text-[13px]", text)}>{t("profile_page.desktop_notifications")}</h4>
                    <p className={cn("text-[11px]", sub)}>{t("profile_page.desktop_notifications_desc")}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    disabled={!desktopNotifs || browserDenied}
                    onClick={handleTestNotification}
                    className={cn(
                      "h-7 px-3 rounded-lg border text-[11px] font-semibold disabled:opacity-40",
                      dark ? "border-slate-800 text-slate-200" : "border-slate-200 text-slate-700"
                    )}
                  >
                    {t("profile_page.test_btn")}
                  </button>
                  <Switch checked={desktopNotifs} onCheckedChange={setDesktopNotifs} disabled={browserDenied} />
                </div>
              </div>
              {browserDenied && (
                <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-md text-xs">
                  {t("profile_page.browser_denied")}
                </div>
              )}
            </div>

            {[
              { key: "twoFactorAuth", titleKey: "two_factor_title", descKey: "two_factor_desc", icon: ShieldCheck },
              // Live Chat behavior toggles — workspace-scoped conversation
              // settings, meaningless for an Agency account, so they're
              // excluded there.
              ...(context === "workspace" ? CHAT_PREFERENCE_ROWS : []),
            ].map((row) => (
              <div key={row.key} className="space-y-2 pt-2 border-t border-dashed border-slate-200 dark:border-slate-800">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-start gap-2">
                    <div className="p-1.5 rounded-lg bg-primary/10 text-primary shrink-0"><row.icon size={14} /></div>
                    <div>
                      <h4 className={cn("font-semibold text-[13px]", text)}>{t(`profile_page.${row.titleKey}`)}</h4>
                      <p className={cn("text-[11px]", sub)}>{t(`profile_page.${row.descKey}`)}</p>
                    </div>
                  </div>
                  <Switch
                    checked={(prefs as any)[row.key]}
                    onCheckedChange={(checked) => setPrefs((p) => ({ ...p, [row.key]: checked }))}
                  />
                </div>
              </div>
            ))}

            {context === "workspace" && (
            <div className="space-y-2 pt-2 border-t border-dashed border-slate-200 dark:border-slate-800">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-start gap-2">
                  <div className="p-1.5 rounded-lg bg-primary/10 text-primary shrink-0"><Mail size={14} /></div>
                  <div>
                    <h4 className={cn("font-semibold text-[13px]", text)}>{t("profile_page.email_transcript_title")}</h4>
                    <p className={cn("text-[11px]", sub)}>{t("profile_page.email_transcript_desc")}</p>
                  </div>
                </div>
                <Switch
                  checked={prefs.emailTranscript}
                  onCheckedChange={(checked) => setPrefs((p) => ({ ...p, emailTranscript: checked }))}
                />
              </div>
              <Textarea
                placeholder={t("profile_page.email_placeholder")}
                rows={3}
                value={prefs.transcriptEmails}
                onChange={(e) => setPrefs((p) => ({ ...p, transcriptEmails: e.target.value }))}
                disabled={!prefs.emailTranscript}
              />
            </div>
            )}

            <div className="flex justify-end pt-2">
              <button
                onClick={() => savePrefsMutation.mutate()}
                disabled={savePrefsMutation.isPending}
                className="h-11 px-8 rounded-xl bg-primary hover:bg-primary/90 disabled:opacity-50 text-white text-[12px] font-semibold transition-all"
              >
                {savePrefsMutation.isPending ? t("profile_page.saving") : t("profile_page.save_changes")}
              </button>
            </div>
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}
