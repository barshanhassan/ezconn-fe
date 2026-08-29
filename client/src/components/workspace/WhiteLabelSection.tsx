import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import {
  BadgeCheck,
  Mail,
  Copy,
  Palette,
  Globe,
  Zap,
  Upload,
  Image as ImageIcon,
  Trash2,
  Info,
  ChevronsUpDown,
  Sparkles,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useTheme } from "@/contexts/ThemeContext";
import { cn } from "@/lib/utils";

export default function WhiteLabelSection() {
  const { t } = useTranslation();
  const { mode } = useTheme();
  const { toast } = useToast();
  const dark = mode === "dark";

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
    "h-11 px-8 rounded-xl bg-primary hover:bg-primary/90 disabled:opacity-50 text-white text-[11px] font-semibold transition-all shadow-lg shadow-primary/20";

  const { data: brandingData, isLoading } = useQuery<any>({
    queryKey: ["/api/workspaces/branding"],
  });

  const updateBrandingMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("PATCH", "/api/workspaces/branding", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/workspaces/branding"] });
      toast({ title: t("white_label_section.toast_saved_title"), description: t("white_label_section.toast_saved_description") });
    },
    onError: (error: any) => {
      toast({
        title: t("white_label_section.toast_error_title"),
        description: error.message || t("white_label_section.toast_failed_to_save"),
        variant: "destructive",
      });
    },
  });

  const [colors, setColors] = useState({
    mainTheme: "#25D366",
    links: "#5742F5",
    incomingBubble: "#705800",
    incomingText: "#FFFFFF",
    outgoingBubble: "#9C9C9C",
    outgoingText: "#FFFFFF",
  });

  useEffect(() => {
    if (brandingData) {
      setColors({
        mainTheme: brandingData.color || "#25D366",
        links: brandingData.link_color || "#5742F5",
        incomingBubble: brandingData.incoming_chat_color || "#705800",
        incomingText: brandingData.incoming_chat_text_color || "#FFFFFF",
        outgoingBubble: brandingData.outgoing_chat_color || "#9C9C9C",
        outgoingText: brandingData.outgoing_chat_text_color || "#FFFFFF",
      });
      // Hydrate persisted logos / favicon (backend returns signed URLs).
      setLogoPreview((prev) => ({
        ...prev,
        ...(brandingData.logo_light_url ? { light: brandingData.logo_light_url } : {}),
        ...(brandingData.logo_dark_url ? { dark: brandingData.logo_dark_url } : {}),
        ...(brandingData.favicon_url ? { favicon: brandingData.favicon_url } : {}),
      }));
    }
  }, [brandingData]);

  const handleColorChange = (key: keyof typeof colors, value: string) => {
    setColors((prev) => ({ ...prev, [key]: value.toUpperCase() }));
  };

  const handleSaveColors = () => {
    updateBrandingMutation.mutate(colors);
  };

  const [slug, setSlug] = useState("");
  const [customDomain, setCustomDomain] = useState("");
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [emailUser, setEmailUser] = useState("info");
  const [emailDomain, setEmailDomain] = useState("");

  const [, navigate] = useLocation();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const uploadTargetRef = useRef<string>("light");
  const [logoPreview, setLogoPreview] = useState<Record<string, string>>({});

  // Map UI target ("light" | "dark" | "favicon") to the backend payload key on /workspaces/branding.
  const brandingKeyFor = (target: string): "logoLight" | "logoDark" | "favicon" | null => {
    if (target === "light") return "logoLight";
    if (target === "dark") return "logoDark";
    if (target === "favicon") return "favicon";
    return null;
  };

  const handleLogoAction = (action: string, type: string) => {
    if (action === "upload") {
      uploadTargetRef.current = type;
      // Defer to next tick so the Radix Dropdown finishes closing before the
      // file picker opens — Radix's focus management can swallow the click otherwise.
      setTimeout(() => fileInputRef.current?.click(), 0);
      return;
    }
    if (action === "gallery") {
      navigate("/settings?tab=Media Gallery");
      return;
    }
    if (action === "remove") {
      const key = brandingKeyFor(type);
      if (key) {
        // Persist removal — backend clears the FK; refetch hydrates preview.
        updateBrandingMutation.mutate({ [key]: null });
      }
      setLogoPreview((p) => {
        const next = { ...p };
        delete next[type];
        return next;
      });
      return;
    }
  };

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast({ title: t("white_label_section.toast_invalid_file_title"), description: t("white_label_section.toast_invalid_file_description"), variant: "destructive" });
      return;
    }

    const target = uploadTargetRef.current;
    const brandingKey = brandingKeyFor(target);
    if (!brandingKey) return;

    // Optimistic local preview for responsiveness.
    const localUrl = URL.createObjectURL(file);
    setLogoPreview((p) => ({ ...p, [target]: localUrl }));

    try {
      // 1) Upload to Media Gallery (S3 — replyagent parity: logos live in gallery + branding references them).
      const fd = new FormData();
      fd.append("files", file);
      const uploadRes = await apiRequest("POST", "/api/gallery/upload", fd);
      const uploadJson = await uploadRes.json();
      const media = uploadJson?.media?.[0];
      if (!media?.id) throw new Error("Upload failed — no media returned");

      // 2) Save the media id on the branding row. Backend returns refreshed signed URLs.
      updateBrandingMutation.mutate({ [`${brandingKey}Id`]: String(media.id) });
    } catch (err: any) {
      toast({ title: t("white_label_section.toast_upload_failed_title"), description: err?.message || t("white_label_section.toast_could_not_save_image"), variant: "destructive" });
      setLogoPreview((p) => {
        const next = { ...p };
        delete next[target];
        return next;
      });
    }
  };

  // ─── Custom domain (Domain tab) ──────────────────────────────────
  const { data: domainData } = useQuery<any>({ queryKey: ["/api/domains/current"] });
  const currentDomain = domainData?.domain ?? null;
  const refetchDomain = () => queryClient.invalidateQueries({ queryKey: ["/api/domains/current"] });

  const connectDomainMutation = useMutation({
    mutationFn: async () => {
      // Availability check first (replyagent validates before adding).
      const v = await apiRequest(
        "GET",
        `/api/domains/validate-domain?sub_domain=${encodeURIComponent(slug.trim())}&root_domain=${encodeURIComponent(customDomain.trim())}`,
      );
      const vj = await v.json();
      if (vj && vj.available === false) throw new Error(t("white_label_section.domain_already_taken"));
      const res = await apiRequest("POST", "/api/domains/add-custom-domain", {
        sub_domain: slug.trim(),
        root_domain: customDomain.trim(),
      });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: t("white_label_section.toast_domain_connected_title"), description: t("white_label_section.toast_domain_connected_description") });
      setSlug("");
      setCustomDomain("");
      refetchDomain();
    },
    onError: (e: any) => toast({ title: t("white_label_section.toast_could_not_connect_title"), description: e?.message ?? "", variant: "destructive" }),
  });

  const deleteDomainMutation = useMutation({
    mutationFn: async () => (await apiRequest("DELETE", "/api/domains/delete-custom-domain")).json(),
    onSuccess: () => { toast({ title: t("white_label_section.toast_domain_removed_title") }); refetchDomain(); },
    onError: (e: any) => toast({ title: t("white_label_section.toast_could_not_remove_title"), description: e?.message ?? "", variant: "destructive" }),
  });

  // ─── Custom email domain (Email tab) ─────────────────────────────
  const { data: emailData } = useQuery<any>({ queryKey: ["/api/notification-email"] });
  const notificationEmail = emailData?.notification_email ?? null;
  const refetchEmail = () => queryClient.invalidateQueries({ queryKey: ["/api/notification-email"] });

  const addEmailMutation = useMutation({
    mutationFn: async () =>
      (await apiRequest("POST", "/api/notification-email", { prefix: emailUser.trim(), domain: emailDomain.trim() })).json(),
    onSuccess: (d: any) => {
      if (d?.notification_email) {
        toast({ title: t("white_label_section.toast_domain_added_title"), description: t("white_label_section.toast_domain_added_description") });
        refetchEmail();
      }
    },
    onError: (e: any) => toast({ title: t("white_label_section.toast_could_not_add_title"), description: e?.message ?? "", variant: "destructive" }),
  });

  const verifyEmailMutation = useMutation({
    mutationFn: async (id: string) => (await apiRequest("GET", `/api/notification-email/verify/${id}`)).json(),
    onSuccess: (d: any) => {
      const verified = d?.notification_email?.status === "VERIFIED";
      toast({
        title: verified ? t("white_label_section.toast_verified_title") : t("white_label_section.toast_not_verified_title"),
        description: verified
          ? t("white_label_section.toast_verified_description")
          : t("white_label_section.toast_not_verified_description"),
        variant: verified ? undefined : "destructive",
      });
      refetchEmail();
    },
    onError: (e: any) => toast({ title: t("white_label_section.toast_verification_failed_title"), description: e?.message ?? "", variant: "destructive" }),
  });

  const deleteEmailMutation = useMutation({
    mutationFn: async (id: string) => (await apiRequest("DELETE", `/api/notification-email/${id}`)).json(),
    onSuccess: () => { toast({ title: t("white_label_section.toast_removed_title") }); setShowEmailForm(false); refetchEmail(); },
    onError: (e: any) => toast({ title: t("white_label_section.toast_could_not_remove_title"), description: e?.message ?? "", variant: "destructive" }),
  });

  const copyToClipboard = (val: string) => {
    if (!val) return;
    navigator.clipboard.writeText(val);
    toast({ title: t("white_label_section.toast_copied_title") });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  const tabs = [
    { value: "logo", label: t("white_label_section.tab_logo"), icon: ImageIcon },
    { value: "favicon", label: t("white_label_section.tab_favicon"), icon: Zap },
    { value: "colors", label: t("white_label_section.tab_colors"), icon: Palette },
    { value: "email", label: t("white_label_section.tab_email"), icon: Mail },
  ];

  return (
    <Card className={cn("rounded-[2rem] border overflow-hidden shadow-sm transition-all duration-300", card, border)}>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileSelected}
      />
      <CardContent className="p-0">
        {/* ── Header ── */}
        <div className={cn("px-8 py-4 border-b flex items-center justify-between", border)}>
          <div className="flex items-center gap-4">
            <div className={cn("p-2.5 rounded-xl shadow-sm", dark ? "bg-primary/15" : "bg-primary/10")}>
              <BadgeCheck className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className={cn("text-[16px] font-bold tracking-tight", text)}>{t("white_label_section.header_title")}</h1>
              <p className={cn("text-[11px] font-medium mt-0.5 opacity-60", sub)}>
                {t("white_label_section.header_description")}
              </p>
            </div>
          </div>
          <div className={cn("px-3 py-1.5 rounded-lg border text-[10px] font-semibold flex items-center gap-1.5", dark ? "border-slate-800 bg-slate-950/50 text-slate-300" : "border-slate-200 bg-slate-50 text-slate-600")}>
            <Sparkles size={11} className="text-primary" /> {t("white_label_section.premium_branding")}
          </div>
        </div>

        <div>
          <Tabs defaultValue="colors" className="w-full">
            {/* Tabs Bar */}
            <div className={cn("px-8 border-b flex justify-start overflow-x-auto", softBorder)}>
              <TabsList className="h-auto p-0 gap-8 bg-transparent border-none flex justify-start rounded-none">
                {tabs.map((tab) => (
                  <TabsTrigger
                    key={tab.value}
                    value={tab.value}
                    className={cn(
                      "flex items-center gap-2 px-1 py-4 rounded-none text-[12px] font-semibold transition-all shadow-none bg-transparent border-b-2 border-transparent",
                      "data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-primary data-[state=active]:text-primary",
                      "hover:text-primary",
                      dark ? "text-slate-500" : "text-slate-400"
                    )}
                  >
                    <tab.icon className="w-3.5 h-3.5" />
                    {tab.label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>

            {/* ── LOGO TAB ── */}
            <TabsContent value="logo" className="p-6 outline-none space-y-5">
              <SectionHeading
                dark={dark}
                title={t("white_label_section.logo_section_title")}
                description={t("white_label_section.logo_section_description")}
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <LogoUpload
                  dark={dark}
                  themeLabel={t("white_label_section.light_theme")}
                  logoSrc={logoPreview.light || "/images/agentawk-logo-horizontal-ink.svg"}
                  zoneBg={dark ? "bg-white/95" : "bg-slate-50/80"}
                  zoneBorder={dark ? "border-slate-700" : "border-slate-200"}
                  onAction={(a) => handleLogoAction(a, "light")}
                  t={t}
                />
                <LogoUpload
                  dark={dark}
                  themeLabel={t("white_label_section.dark_theme")}
                  logoSrc={logoPreview.dark || "/images/agentawk-logo-horizontal-white.svg"}
                  zoneBg="bg-[#020617]"
                  zoneBorder="border-slate-800"
                  onAction={(a) => handleLogoAction(a, "dark")}
                  t={t}
                />
              </div>

              <InfoNote dark={dark}>
                {t("white_label_section.logo_info_note")}
              </InfoNote>
            </TabsContent>

            {/* ── FAVICON TAB ── */}
            <TabsContent value="favicon" className="p-6 outline-none space-y-5">
              <SectionHeading
                dark={dark}
                title={t("white_label_section.favicon_section_title")}
                description={t("white_label_section.favicon_section_description")}
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Upload zone */}
                <div className="space-y-3">
                  <FieldLabel dark={dark}>{t("white_label_section.upload_favicon")}</FieldLabel>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <div className={cn(
                        "w-32 h-32 border-2 border-dashed rounded-[1.5rem] flex items-center justify-center cursor-pointer transition-all hover:border-primary/40 group",
                        dark ? "bg-slate-950/50 border-slate-800" : "bg-slate-50 border-slate-200"
                      )}>
                        <img src={logoPreview.favicon || "/images/agentawk-bot-green.svg"} alt={t("white_label_section.favicon_alt")} className="w-12 h-12 object-contain group-hover:scale-110 transition-transform" />
                      </div>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className={cn("w-52 rounded-xl p-1.5", dark ? "bg-[#0f1829] border-slate-800" : "")}>
                      <DropdownMenuItem onClick={() => handleLogoAction("upload", "favicon")} className="rounded-lg py-2 cursor-pointer gap-2 font-bold text-[11px]">
                        <Upload size={13} /> {t("white_label_section.upload_new")}
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleLogoAction("gallery", "favicon")} className="rounded-lg py-2 cursor-pointer gap-2 font-bold text-[11px]">
                        <ImageIcon size={13} /> {t("white_label_section.from_gallery")}
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleLogoAction("remove", "favicon")} className="rounded-lg py-2 cursor-pointer gap-2 font-bold text-[11px] text-rose-500">
                        <Trash2 size={13} /> {t("white_label_section.remove")}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                {/* Browser preview */}
                <div className="space-y-3">
                  <FieldLabel dark={dark}>{t("white_label_section.browser_tab_preview_label")}</FieldLabel>
                  <div className={cn("p-4 rounded-[1.25rem] border", softBg, softBorder)}>
                    <div className="bg-white rounded-lg shadow-md overflow-hidden">
                      <div className="bg-slate-100 px-2 py-1.5 flex items-center gap-1.5">
                        <div className="flex gap-1">
                          <div className="w-2 h-2 rounded-full bg-red-400" />
                          <div className="w-2 h-2 rounded-full bg-yellow-400" />
                          <div className="w-2 h-2 rounded-full bg-green-400" />
                        </div>
                        <div className="flex-1 ml-2 bg-white rounded px-2 py-1 flex items-center gap-1.5 max-w-[200px]">
                          <img src={logoPreview.favicon || "/images/agentawk-bot-green.svg"} className="w-3 h-3 shrink-0" alt="" />
                          <span className="text-[9px] font-bold text-slate-700 truncate">{t("white_label_section.browser_tab_preview_title")}</span>
                        </div>
                      </div>
                      <div className="h-12 bg-white" />
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* ── COLORS TAB ── */}
            <TabsContent value="colors" className="p-6 outline-none space-y-4">
              <SectionHeading
                dark={dark}
                title={t("white_label_section.colors_section_title")}
                description={t("white_label_section.colors_section_description")}
              />

              <div>
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-1 h-4 bg-primary rounded-full" />
                  <h4 className={cn("text-[12px] font-semibold", text)}>{t("white_label_section.brand_heading")}</h4>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <ColorPicker dark={dark} label={t("white_label_section.main_theme_label")} value={colors.mainTheme} onChange={(v) => handleColorChange("mainTheme", v)} />
                  <ColorPicker dark={dark} label={t("white_label_section.links_actions_label")} value={colors.links} onChange={(v) => handleColorChange("links", v)} />
                </div>
              </div>

              <div>
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-1 h-4 bg-primary rounded-full" />
                  <h4 className={cn("text-[12px] font-semibold", text)}>{t("white_label_section.chat_bubbles_heading")}</h4>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <ColorPicker dark={dark} label={t("white_label_section.incoming_bubble_label")} value={colors.incomingBubble} onChange={(v) => handleColorChange("incomingBubble", v)} />
                  <ColorPicker dark={dark} label={t("white_label_section.incoming_text_label")} value={colors.incomingText} onChange={(v) => handleColorChange("incomingText", v)} />
                  <ColorPicker dark={dark} label={t("white_label_section.outgoing_bubble_label")} value={colors.outgoingBubble} onChange={(v) => handleColorChange("outgoingBubble", v)} />
                  <ColorPicker dark={dark} label={t("white_label_section.outgoing_text_label")} value={colors.outgoingText} onChange={(v) => handleColorChange("outgoingText", v)} />
                </div>
              </div>

              <SaveFooter
                dark={dark}
                onClick={handleSaveColors}
                loading={updateBrandingMutation.isPending}
                primaryBtn={primaryBtn}
                t={t}
              />
            </TabsContent>

            {/* ── EMAIL TAB ── */}
            <TabsContent value="email" className="p-6 outline-none">
              {notificationEmail ? (
                notificationEmail.status === "VERIFIED" ? (
                  /* ── Verified ── */
                  <div className="space-y-5 max-w-2xl">
                    <div className={cn("p-4 rounded-[1.25rem] border flex items-start gap-3 bg-emerald-500/10 border-emerald-500/20")}>
                      <div className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-500 shrink-0"><BadgeCheck size={14} /></div>
                      <p className="text-[11px] font-medium leading-relaxed text-emerald-700/90 dark:text-emerald-300/90">
                        {t("white_label_section.email_verified_banner")}
                      </p>
                    </div>
                    <div className={cn("p-5 rounded-[1.5rem] border flex items-center justify-between gap-4", softBg, softBorder)}>
                      <div className="min-w-0">
                        <FieldLabel dark={dark}>{t("white_label_section.verified_email_label")}</FieldLabel>
                        <div className="flex items-center gap-2 mt-1">
                          <p className={cn("text-[13px] font-black truncate", text)}>{notificationEmail.email}</p>
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">{t("white_label_section.verified_badge")}</span>
                        </div>
                      </div>
                      <button
                        onClick={() => deleteEmailMutation.mutate(String(notificationEmail.id))}
                        disabled={deleteEmailMutation.isPending}
                        className="h-10 px-5 rounded-xl border text-[11px] font-semibold transition-all flex items-center gap-2 border-rose-500/30 text-rose-500 hover:bg-rose-500 hover:text-white hover:border-rose-500 disabled:opacity-50 shrink-0"
                      >
                        <Trash2 size={12} /> {t("white_label_section.remove")}
                      </button>
                    </div>
                  </div>
                ) : (
                  /* ── Unverified: show DNS records to add, then Verify ── */
                  <div className="space-y-5 max-w-3xl">
                    <SectionHeading
                      dark={dark}
                      title={t("white_label_section.verify_your_domain_title")}
                      description={t("white_label_section.verify_your_domain_description", { domain: notificationEmail.domain })}
                    />
                    <div className={cn("rounded-[1.5rem] border overflow-x-auto", softBorder)}>
                      <div className="min-w-[520px]">
                        <div className={cn("grid grid-cols-12 px-5 py-3 text-[10px] font-semibold", dark ? "bg-slate-900/40 text-slate-400" : "bg-slate-50 text-slate-500")}>
                          <div className="col-span-2">{t("white_label_section.dns_type")}</div>
                          <div className="col-span-5">{t("white_label_section.dns_hostname")}</div>
                          <div className="col-span-5">{t("white_label_section.dns_value")}</div>
                        </div>
                        {notificationEmail.rpath_value && (
                          <DnsRecordRow dark={dark} text={text} sub={sub} type="CNAME" hostname={notificationEmail.rpath_selector} value={notificationEmail.rpath_value} verified={notificationEmail.rpath_verified} onCopy={copyToClipboard} t={t} />
                        )}
                        {notificationEmail.dkim_value && (
                          <DnsRecordRow dark={dark} text={text} sub={sub} type="CNAME" hostname={`${notificationEmail.dkim_selector}._domainkey`} value={notificationEmail.dkim_value} verified={notificationEmail.dkim_verified} onCopy={copyToClipboard} t={t} />
                        )}
                        {notificationEmail.cname_selector && (
                          <DnsRecordRow dark={dark} text={text} sub={sub} type="CNAME" hostname={notificationEmail.cname_selector} value={notificationEmail.cname_value || notificationEmail.cname_expected} verified={notificationEmail.cname_verified} onCopy={copyToClipboard} t={t} />
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => deleteEmailMutation.mutate(String(notificationEmail.id))}
                        disabled={deleteEmailMutation.isPending}
                        className={cn("h-11 px-6 rounded-xl border text-[11px] font-semibold transition-all border-rose-500/30 text-rose-500 hover:bg-rose-500/10 disabled:opacity-50")}
                      >
                        {t("white_label_section.remove")}
                      </button>
                      <button
                        onClick={() => verifyEmailMutation.mutate(String(notificationEmail.id))}
                        disabled={verifyEmailMutation.isPending}
                        className={primaryBtn}
                      >
                        {verifyEmailMutation.isPending ? t("white_label_section.verifying") : t("white_label_section.verify_button")}
                      </button>
                    </div>
                  </div>
                )
              ) : !showEmailForm ? (
                /* ── Empty state ── */
                <div className="flex flex-col items-center justify-center text-center space-y-5 min-h-[200px]">
                  <div className="w-16 h-16 bg-primary/10 rounded-[1.5rem] flex items-center justify-center shadow-inner group overflow-hidden">
                    <Mail className="w-8 h-8 text-primary transition-transform group-hover:scale-110" />
                  </div>
                  <div className="space-y-1.5 max-w-sm">
                    <h3 className={cn("text-[16px] font-bold tracking-tight", text)}>{t("white_label_section.notification_email_title")}</h3>
                    <p className={cn("text-[12px] font-medium leading-relaxed opacity-60", sub)}>
                      {t("white_label_section.notification_email_description")}
                    </p>
                  </div>
                  <button onClick={() => setShowEmailForm(true)} className={primaryBtn}>
                    {t("white_label_section.connect_now")}
                  </button>
                </div>
              ) : (
                /* ── Entry form ── */
                <div className="space-y-5 max-w-2xl">
                  <SectionHeading
                    dark={dark}
                    title={t("white_label_section.notification_email_title")}
                    description={t("white_label_section.notification_email_description")}
                  />

                  <div className="space-y-2">
                    <FieldLabel dark={dark}>{t("white_label_section.enter_domain_label")}</FieldLabel>
                    <div className={cn("flex border rounded-xl overflow-hidden h-11 items-center transition-all",
                      dark ? "bg-slate-950/50 border-slate-800 focus-within:border-primary/40" : "bg-white border-slate-200 focus-within:border-primary/40")}>
                      <input
                        value={emailUser}
                        onChange={(e) => setEmailUser(e.target.value)}
                        className={cn("w-28 h-full text-[12px] font-black outline-none px-3 border-r", dark ? "border-slate-800" : "border-slate-200", text)}
                      />
                      <div className={cn("h-full px-3 flex items-center text-slate-400 font-black text-base", dark ? "bg-slate-900/40" : "bg-slate-50")}>
                        @
                      </div>
                      <input
                        placeholder={t("white_label_section.domain_placeholder")}
                        value={emailDomain}
                        onChange={(e) => setEmailDomain(e.target.value)}
                        className={cn("flex-1 h-full text-[12px] font-black outline-none px-3 min-w-0", text)}
                      />
                    </div>
                  </div>

                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => setShowEmailForm(false)}
                      className={cn(
                        "h-11 px-6 rounded-xl border text-[11px] font-semibold transition-all",
                        dark ? "border-slate-800 text-slate-300 hover:border-slate-700" : "border-slate-200 text-slate-700 hover:border-slate-300"
                      )}
                    >
                      {t("white_label_section.cancel")}
                    </button>
                    <button
                      onClick={() => addEmailMutation.mutate()}
                      disabled={addEmailMutation.isPending || !emailUser.trim() || !emailDomain.trim()}
                      className={primaryBtn}
                    >
                      {addEmailMutation.isPending ? t("white_label_section.adding") : t("white_label_section.continue")}
                    </button>
                  </div>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </CardContent>
    </Card>
  );
}

/* ── Helpers ── */

function SectionHeading({ dark, title, description }: { dark: boolean; title: string; description?: string }) {
  const text = dark ? "text-white" : "text-slate-900";
  const sub  = dark ? "text-slate-500" : "text-slate-400";
  return (
    <div className="space-y-1.5">
      <h3 className={cn("text-[14px] font-semibold", text)}>{title}</h3>
      {description && (
        <p className={cn("text-[11px] font-medium leading-relaxed opacity-60 max-w-2xl", sub)}>{description}</p>
      )}
    </div>
  );
}

function FieldLabel({ dark, children }: { dark: boolean; children: React.ReactNode }) {
  const sub = dark ? "text-slate-400" : "text-slate-500";
  return (
    <label className={cn("text-[11px] font-semibold pl-1 block", sub)}>{children}</label>
  );
}

function SaveFooter({
  dark,
  onClick,
  loading,
  primaryBtn,
  t,
}: {
  dark: boolean;
  onClick: () => void;
  loading: boolean;
  primaryBtn: string;
  t: (key: string) => string;
}) {
  const sub = dark ? "text-slate-500" : "text-slate-400";
  const border = dark ? "border-slate-800" : "border-slate-100";
  return (
    <div className={cn("flex items-center justify-end gap-3 pt-6 border-t", border)}>
      <p className={cn("text-[11px] font-bold opacity-50 mr-auto", sub)}>
        <Info size={12} className="inline-block mr-1.5 -mt-0.5" />
        {t("white_label_section.save_footer_note")}
      </p>
      <button onClick={onClick} disabled={loading} className={primaryBtn}>
        {loading ? t("white_label_section.saving") : t("white_label_section.save_changes")}
      </button>
    </div>
  );
}

function DnsRecordRow({
  dark,
  text,
  sub,
  type,
  hostname,
  value,
  verified,
  onCopy,
  t,
}: {
  dark: boolean;
  text: string;
  sub: string;
  type: string;
  hostname: string;
  value: string;
  verified: boolean;
  onCopy: (v: string) => void;
  t: (key: string) => string;
}) {
  const border = dark ? "border-slate-800" : "border-slate-100";
  return (
    <div className={cn("grid grid-cols-12 items-center px-5 py-3 border-t gap-2", border)}>
      <div className="col-span-2 flex items-center gap-1.5">
        <span className={cn("px-2 py-0.5 rounded-md text-[10px] font-semibold", dark ? "bg-slate-800 text-slate-300" : "bg-slate-100 text-slate-600")}>{type}</span>
        {verified ? (
          <CheckCircle2 size={12} className="text-emerald-500" />
        ) : (
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500" title={t("white_label_section.pending_verification")} />
        )}
      </div>
      <button onClick={() => onCopy(hostname)} className="col-span-5 flex items-center gap-1.5 text-left min-w-0 group">
        <span className={cn("text-[11px] font-mono font-bold truncate", text)}>{hostname}</span>
        <Copy size={11} className="opacity-40 group-hover:opacity-80 shrink-0" />
      </button>
      <button onClick={() => onCopy(value)} className="col-span-5 flex items-center gap-1.5 text-left min-w-0 group">
        <span className={cn("text-[11px] font-mono font-bold truncate", sub)}>{value}</span>
        <Copy size={11} className="opacity-40 group-hover:opacity-80 shrink-0" />
      </button>
    </div>
  );
}

function InfoNote({ dark, children }: { dark: boolean; children: React.ReactNode }) {
  const sub = dark ? "text-slate-500" : "text-slate-400";
  const softBg = dark ? "bg-slate-950/40" : "bg-slate-50/50";
  const softBorder = dark ? "border-slate-800" : "border-slate-100";
  return (
    <div className={cn("p-4 rounded-[1.25rem] border flex gap-3 items-start", softBg, softBorder)}>
      <div className="p-1.5 rounded-lg bg-primary/10 text-primary shrink-0">
        <Info size={13} />
      </div>
      <p className={cn("text-[11px] font-medium leading-relaxed opacity-70", sub)}>{children}</p>
    </div>
  );
}

function ColorPicker({
  dark,
  label,
  value,
  onChange,
}: {
  dark: boolean;
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const text = dark ? "text-white" : "text-slate-900";
  return (
    <div className="space-y-2">
      <FieldLabel dark={dark}>{label}</FieldLabel>
      <div className="relative">
        <div className={cn(
          "flex items-center gap-3 px-4 h-11 border rounded-xl transition-all hover:border-primary/40",
          dark ? "bg-slate-950/50 border-slate-800" : "bg-white border-slate-200"
        )}>
          <div
            className="w-6 h-6 rounded-lg shadow-inner shrink-0 border"
            style={{ backgroundColor: value, borderColor: "rgba(0,0,0,0.1)" }}
          />
          <span className={cn("text-[12px] font-black tracking-tight flex-1", text)}>{value}</span>
          <div className="p-1 rounded-md bg-primary/10">
            <ChevronsUpDown className="w-3 h-3 text-primary" />
          </div>
        </div>
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        />
      </div>
    </div>
  );
}

function LogoUpload({
  dark,
  themeLabel,
  logoSrc,
  zoneBg,
  zoneBorder,
  onAction,
  t,
}: {
  dark: boolean;
  themeLabel: string;
  logoSrc: string;
  zoneBg: string;
  zoneBorder: string;
  onAction: (action: string) => void;
  t: (key: string) => string;
}) {
  return (
    <div className="space-y-3">
      <FieldLabel dark={dark}>{themeLabel}</FieldLabel>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <div className={cn(
            "relative group border-2 border-dashed rounded-[1.5rem] h-32 flex items-center justify-center cursor-pointer transition-all hover:border-primary/50",
            zoneBg,
            zoneBorder
          )}>
            <img src={logoSrc} alt={`${themeLabel} logo`} className="max-w-[180px] max-h-[64px] object-contain transition-transform group-hover:scale-105" />
            <div className="absolute inset-0 bg-primary/10 opacity-0 group-hover:opacity-100 transition-opacity rounded-[1.5rem] flex items-center justify-center">
              <div className="p-2.5 rounded-xl bg-white/90 shadow-lg">
                <Upload className="w-4 h-4 text-primary" />
              </div>
            </div>
          </div>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="center" className={cn("w-52 rounded-xl p-1.5", dark ? "bg-[#0f1829] border-slate-800" : "")}>
          <DropdownMenuItem onClick={() => onAction("upload")} className="rounded-lg py-2 cursor-pointer gap-2 font-bold text-[11px]">
            <Upload size={13} /> {t("white_label_section.upload_new")}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onAction("gallery")} className="rounded-lg py-2 cursor-pointer gap-2 font-bold text-[11px]">
            <ImageIcon size={13} /> {t("white_label_section.from_gallery")}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onAction("remove")} className="rounded-lg py-2 cursor-pointer gap-2 font-bold text-[11px] text-rose-500">
            <Trash2 size={13} /> {t("white_label_section.remove")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
