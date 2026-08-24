import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
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
      toast({ title: "Saved", description: "Your branding has been updated." });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to save",
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
      toast({ title: "Invalid file", description: "Please choose an image file.", variant: "destructive" });
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
      toast({ title: "Upload failed", description: err?.message || "Could not save image.", variant: "destructive" });
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
      if (vj && vj.available === false) throw new Error("That domain is already taken.");
      const res = await apiRequest("POST", "/api/domains/add-custom-domain", {
        sub_domain: slug.trim(),
        root_domain: customDomain.trim(),
      });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Domain connected", description: "Point the DNS record at your provider to finish." });
      setSlug("");
      setCustomDomain("");
      refetchDomain();
    },
    onError: (e: any) => toast({ title: "Could not connect", description: e?.message ?? "", variant: "destructive" }),
  });

  const deleteDomainMutation = useMutation({
    mutationFn: async () => (await apiRequest("DELETE", "/api/domains/delete-custom-domain")).json(),
    onSuccess: () => { toast({ title: "Domain removed" }); refetchDomain(); },
    onError: (e: any) => toast({ title: "Could not remove", description: e?.message ?? "", variant: "destructive" }),
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
        toast({ title: "Domain added", description: "Add the DNS records below, then Verify." });
        refetchEmail();
      }
    },
    onError: (e: any) => toast({ title: "Could not add", description: e?.message ?? "", variant: "destructive" }),
  });

  const verifyEmailMutation = useMutation({
    mutationFn: async (id: string) => (await apiRequest("GET", `/api/notification-email/verify/${id}`)).json(),
    onSuccess: (d: any) => {
      const verified = d?.notification_email?.status === "VERIFIED";
      toast({
        title: verified ? "Verified!" : "Not verified yet",
        description: verified
          ? "Your custom email domain is active."
          : "DNS records aren't visible to SMTP2GO yet — they can take time to propagate.",
        variant: verified ? undefined : "destructive",
      });
      refetchEmail();
    },
    onError: (e: any) => toast({ title: "Verification failed", description: e?.message ?? "", variant: "destructive" }),
  });

  const deleteEmailMutation = useMutation({
    mutationFn: async (id: string) => (await apiRequest("DELETE", `/api/notification-email/${id}`)).json(),
    onSuccess: () => { toast({ title: "Removed" }); setShowEmailForm(false); refetchEmail(); },
    onError: (e: any) => toast({ title: "Could not remove", description: e?.message ?? "", variant: "destructive" }),
  });

  const copyToClipboard = (val: string) => {
    if (!val) return;
    navigator.clipboard.writeText(val);
    toast({ title: "Copied" });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  const tabs = [
    { value: "logo", label: "Logo", icon: ImageIcon },
    { value: "favicon", label: "Favicon", icon: Zap },
    { value: "colors", label: "Colors", icon: Palette },
    { value: "email", label: "Notification E-mail", icon: Mail },
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
              <h1 className={cn("text-[16px] font-bold tracking-tight", text)}>Theme</h1>
              <p className={cn("text-[11px] font-medium mt-0.5 opacity-60", sub)}>
                Change color, logo and favicon of your workspace
              </p>
            </div>
          </div>
          <div className={cn("px-3 py-1.5 rounded-lg border text-[10px] font-semibold flex items-center gap-1.5", dark ? "border-slate-800 bg-slate-950/50 text-slate-300" : "border-slate-200 bg-slate-50 text-slate-600")}>
            <Sparkles size={11} className="text-primary" /> Premium Branding
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
                title="Brand Logo"
                description="Upload your logo for light and dark mode. Transparent PNG or SVG recommended (460×140px)."
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <LogoUpload
                  dark={dark}
                  themeLabel="Light Theme"
                  logoSrc={logoPreview.light || "/images/agentawk-logo-horizontal-ink.svg"}
                  zoneBg={dark ? "bg-white/95" : "bg-slate-50/80"}
                  zoneBorder={dark ? "border-slate-700" : "border-slate-200"}
                  onAction={(a) => handleLogoAction(a, "light")}
                />
                <LogoUpload
                  dark={dark}
                  themeLabel="Dark Theme"
                  logoSrc={logoPreview.dark || "/images/agentawk-logo-horizontal-white.svg"}
                  zoneBg="bg-[#020617]"
                  zoneBorder="border-slate-800"
                  onAction={(a) => handleLogoAction(a, "dark")}
                />
              </div>

              <InfoNote dark={dark}>
                Logo displays in the top-left of your workspace. Recommended dimensions: 460×140px.
              </InfoNote>
            </TabsContent>

            {/* ── FAVICON TAB ── */}
            <TabsContent value="favicon" className="p-6 outline-none space-y-5">
              <SectionHeading
                dark={dark}
                title="Browser Favicon"
                description="The small icon that appears in browser tabs. Square ICO or PNG (64×64px recommended)."
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Upload zone */}
                <div className="space-y-3">
                  <FieldLabel dark={dark}>Upload Favicon</FieldLabel>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <div className={cn(
                        "w-32 h-32 border-2 border-dashed rounded-[1.5rem] flex items-center justify-center cursor-pointer transition-all hover:border-primary/40 group",
                        dark ? "bg-slate-950/50 border-slate-800" : "bg-slate-50 border-slate-200"
                      )}>
                        <img src={logoPreview.favicon || "/images/agentawk-bot-green.svg"} alt="Favicon" className="w-12 h-12 object-contain group-hover:scale-110 transition-transform" />
                      </div>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className={cn("w-52 rounded-xl p-1.5", dark ? "bg-[#0f1829] border-slate-800" : "")}>
                      <DropdownMenuItem onClick={() => handleLogoAction("upload", "favicon")} className="rounded-lg py-2 cursor-pointer gap-2 font-bold text-[11px]">
                        <Upload size={13} /> Upload New
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleLogoAction("gallery", "favicon")} className="rounded-lg py-2 cursor-pointer gap-2 font-bold text-[11px]">
                        <ImageIcon size={13} /> From Gallery
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleLogoAction("remove", "favicon")} className="rounded-lg py-2 cursor-pointer gap-2 font-bold text-[11px] text-rose-500">
                        <Trash2 size={13} /> Remove
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                {/* Browser preview */}
                <div className="space-y-3">
                  <FieldLabel dark={dark}>Browser Tab Preview</FieldLabel>
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
                          <span className="text-[9px] font-bold text-slate-700 truncate">Workspace — Agentawk</span>
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
                title="Theme Colors"
                description="Customize the colors used across your workspace UI and chat bubbles."
              />

              <div>
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-1 h-4 bg-primary rounded-full" />
                  <h4 className={cn("text-[12px] font-semibold", text)}>Brand</h4>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <ColorPicker dark={dark} label="Main Theme" value={colors.mainTheme} onChange={(v) => handleColorChange("mainTheme", v)} />
                  <ColorPicker dark={dark} label="Links & Actions" value={colors.links} onChange={(v) => handleColorChange("links", v)} />
                </div>
              </div>

              <div>
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-1 h-4 bg-primary rounded-full" />
                  <h4 className={cn("text-[12px] font-semibold", text)}>Chat Bubbles</h4>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <ColorPicker dark={dark} label="Incoming Bubble" value={colors.incomingBubble} onChange={(v) => handleColorChange("incomingBubble", v)} />
                  <ColorPicker dark={dark} label="Incoming Text" value={colors.incomingText} onChange={(v) => handleColorChange("incomingText", v)} />
                  <ColorPicker dark={dark} label="Outgoing Bubble" value={colors.outgoingBubble} onChange={(v) => handleColorChange("outgoingBubble", v)} />
                  <ColorPicker dark={dark} label="Outgoing Text" value={colors.outgoingText} onChange={(v) => handleColorChange("outgoingText", v)} />
                </div>
              </div>

              <SaveFooter
                dark={dark}
                onClick={handleSaveColors}
                loading={updateBrandingMutation.isPending}
                primaryBtn={primaryBtn}
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
                        Your custom email domain is verified. Notifications will be sent from this address.
                      </p>
                    </div>
                    <div className={cn("p-5 rounded-[1.5rem] border flex items-center justify-between gap-4", softBg, softBorder)}>
                      <div className="min-w-0">
                        <FieldLabel dark={dark}>Verified email</FieldLabel>
                        <div className="flex items-center gap-2 mt-1">
                          <p className={cn("text-[13px] font-black truncate", text)}>{notificationEmail.email}</p>
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">Verified</span>
                        </div>
                      </div>
                      <button
                        onClick={() => deleteEmailMutation.mutate(String(notificationEmail.id))}
                        disabled={deleteEmailMutation.isPending}
                        className="h-10 px-5 rounded-xl border text-[11px] font-semibold transition-all flex items-center gap-2 border-rose-500/30 text-rose-500 hover:bg-rose-500 hover:text-white hover:border-rose-500 disabled:opacity-50 shrink-0"
                      >
                        <Trash2 size={12} /> Remove
                      </button>
                    </div>
                  </div>
                ) : (
                  /* ── Unverified: show DNS records to add, then Verify ── */
                  <div className="space-y-5 max-w-3xl">
                    <SectionHeading
                      dark={dark}
                      title="Verify your domain"
                      description={`Add these DNS records for ${notificationEmail.domain} at your DNS provider, then click Verify. Propagation can take a few minutes to hours.`}
                    />
                    <div className={cn("rounded-[1.5rem] border overflow-x-auto", softBorder)}>
                      <div className="min-w-[520px]">
                        <div className={cn("grid grid-cols-12 px-5 py-3 text-[10px] font-semibold", dark ? "bg-slate-900/40 text-slate-400" : "bg-slate-50 text-slate-500")}>
                          <div className="col-span-2">Type</div>
                          <div className="col-span-5">Hostname</div>
                          <div className="col-span-5">Value</div>
                        </div>
                        {notificationEmail.rpath_value && (
                          <DnsRecordRow dark={dark} text={text} sub={sub} type="CNAME" hostname={notificationEmail.rpath_selector} value={notificationEmail.rpath_value} verified={notificationEmail.rpath_verified} onCopy={copyToClipboard} />
                        )}
                        {notificationEmail.dkim_value && (
                          <DnsRecordRow dark={dark} text={text} sub={sub} type="CNAME" hostname={`${notificationEmail.dkim_selector}._domainkey`} value={notificationEmail.dkim_value} verified={notificationEmail.dkim_verified} onCopy={copyToClipboard} />
                        )}
                        {notificationEmail.cname_selector && (
                          <DnsRecordRow dark={dark} text={text} sub={sub} type="CNAME" hostname={notificationEmail.cname_selector} value={notificationEmail.cname_value || notificationEmail.cname_expected} verified={notificationEmail.cname_verified} onCopy={copyToClipboard} />
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => deleteEmailMutation.mutate(String(notificationEmail.id))}
                        disabled={deleteEmailMutation.isPending}
                        className={cn("h-11 px-6 rounded-xl border text-[11px] font-semibold transition-all border-rose-500/30 text-rose-500 hover:bg-rose-500/10 disabled:opacity-50")}
                      >
                        Remove
                      </button>
                      <button
                        onClick={() => verifyEmailMutation.mutate(String(notificationEmail.id))}
                        disabled={verifyEmailMutation.isPending}
                        className={primaryBtn}
                      >
                        {verifyEmailMutation.isPending ? "Verifying..." : "Verify"}
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
                    <h3 className={cn("text-[16px] font-bold tracking-tight", text)}>Notification E-mail</h3>
                    <p className={cn("text-[12px] font-medium leading-relaxed opacity-60", sub)}>
                      Integrate your e-mail to send branded agent invitation and forgot password emails.
                    </p>
                  </div>
                  <button onClick={() => setShowEmailForm(true)} className={primaryBtn}>
                    Connect now
                  </button>
                </div>
              ) : (
                /* ── Entry form ── */
                <div className="space-y-5 max-w-2xl">
                  <SectionHeading
                    dark={dark}
                    title="Notification E-mail"
                    description="Integrate your e-mail to send branded agent invitation and forgot password emails."
                  />

                  <div className="space-y-2">
                    <FieldLabel dark={dark}>Enter your domain</FieldLabel>
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
                        placeholder="your-domain.com"
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
                      Cancel
                    </button>
                    <button
                      onClick={() => addEmailMutation.mutate()}
                      disabled={addEmailMutation.isPending || !emailUser.trim() || !emailDomain.trim()}
                      className={primaryBtn}
                    >
                      {addEmailMutation.isPending ? "Adding..." : "Continue"}
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
}: {
  dark: boolean;
  onClick: () => void;
  loading: boolean;
  primaryBtn: string;
}) {
  const sub = dark ? "text-slate-500" : "text-slate-400";
  const border = dark ? "border-slate-800" : "border-slate-100";
  return (
    <div className={cn("flex items-center justify-end gap-3 pt-6 border-t", border)}>
      <p className={cn("text-[11px] font-bold opacity-50 mr-auto", sub)}>
        <Info size={12} className="inline-block mr-1.5 -mt-0.5" />
        Branding applies across the entire Workspace
      </p>
      <button onClick={onClick} disabled={loading} className={primaryBtn}>
        {loading ? "Saving..." : "Save Changes"}
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
}: {
  dark: boolean;
  text: string;
  sub: string;
  type: string;
  hostname: string;
  value: string;
  verified: boolean;
  onCopy: (v: string) => void;
}) {
  const border = dark ? "border-slate-800" : "border-slate-100";
  return (
    <div className={cn("grid grid-cols-12 items-center px-5 py-3 border-t gap-2", border)}>
      <div className="col-span-2 flex items-center gap-1.5">
        <span className={cn("px-2 py-0.5 rounded-md text-[10px] font-semibold", dark ? "bg-slate-800 text-slate-300" : "bg-slate-100 text-slate-600")}>{type}</span>
        {verified ? (
          <CheckCircle2 size={12} className="text-emerald-500" />
        ) : (
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500" title="Pending verification" />
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
}: {
  dark: boolean;
  themeLabel: string;
  logoSrc: string;
  zoneBg: string;
  zoneBorder: string;
  onAction: (action: string) => void;
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
            <Upload size={13} /> Upload New
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onAction("gallery")} className="rounded-lg py-2 cursor-pointer gap-2 font-bold text-[11px]">
            <ImageIcon size={13} /> From Gallery
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onAction("remove")} className="rounded-lg py-2 cursor-pointer gap-2 font-bold text-[11px] text-rose-500">
            <Trash2 size={13} /> Remove
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
