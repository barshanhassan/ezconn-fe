import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Plug,
  ExternalLink,
  Loader2,
  ShieldCheck,
  Plus,
  ArrowRight,
  Check,
  Info,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useTheme } from "@/contexts/ThemeContext";
import { getUserInfo, hasAnyPerm } from "@/lib/auth";

// Each integration card is gated by its own Connect permission (replyagent
// Integrations.vue $can per integration). Cards with no entry here (Cal.com,
// Baserow) have no EZCONN permission and are hidden entirely.
const INTEGRATION_PERMS: Record<string, string> = {
  MICROSOFT: "workspace.settings.ms_tts",
  CLOUDINARY: "workspace.settings.cloudinary",
  ACTIVECAMPAIGN: "workspace.settings.active_campaign",
  CHATGPT: "workspace.settings.open_ai",
  MAKE: "workspace.settings.make_dot_com",
  ELEVENLABS: "workspace.settings.eleven_labs",
};

export default function IntegrationsSection() {
  const { t } = useTranslation();
  const { mode } = useTheme();
  const dark = mode === "dark";
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const _intPerms = getUserInfo().permissions ?? [];
  const [connectingId, setConnectingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<any>({});

  // ── Design tokens ─────────────────────────────────────────
  const card       = dark ? "bg-[#0f1829]"    : "bg-white";
  const border     = dark ? "border-slate-800" : "border-slate-200";
  const text       = dark ? "text-white"      : "text-slate-900";
  const sub        = dark ? "text-slate-500"  : "text-slate-400";
  const softBg     = dark ? "bg-slate-950/40" : "bg-slate-50/50";
  const softBorder = dark ? "border-slate-800" : "border-slate-100";

  const inputCls = cn(
    "w-full h-11 rounded-xl text-[13px] font-bold transition-all px-4 pl-11 border outline-none",
    "focus:ring-2 focus:ring-primary/30 focus:border-primary/50",
    dark ? "bg-slate-950/50 border-slate-800 text-white" : "bg-white border-slate-200 text-slate-900"
  );

  const outlineBtn = cn(
    "h-11 px-6 rounded-xl border text-[11px] font-semibold transition-all flex items-center gap-2",
    dark ? "border-slate-800 text-slate-300 hover:border-primary/40 hover:text-primary" : "border-slate-200 text-slate-700 hover:border-primary/40 hover:text-primary"
  );

  const primaryBtn =
    "h-11 px-7 rounded-xl bg-primary hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed text-white text-[11px] font-semibold transition-all shadow-lg shadow-primary/20 flex items-center gap-2";

  const { data: integrationsData, isLoading } = useQuery({
    queryKey: ["/api/integrations"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/integrations");
      return res.json();
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/integrations", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/integrations"] });
      toast({ title: t("integrations_section.toast_connected_title"), description: t("integrations_section.toast_connected_description") });
      setConnectingId(null);
      setFormData({});
    },
    onError: () => {
      toast({ title: t("integrations_section.toast_error_title"), description: t("integrations_section.toast_connect_error_description"), variant: "destructive" });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string | number; status: string }) => {
      await apiRequest("PATCH", `/api/integrations/${id}`, { action: status === "ACTIVE" ? "activate" : "pause" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/integrations"] });
      toast({ title: t("integrations_section.toast_updated_title"), description: t("integrations_section.toast_status_updated_description") });
    },
    onError: () => {
      toast({ title: t("integrations_section.toast_error_title"), description: t("integrations_section.toast_update_error_description"), variant: "destructive" });
    },
  });

  const staticIntegrations = [
    {
      id: "MICROSOFT",
      name: "Microsoft TTS",
      category: t("integrations_section.items.MICROSOFT.category"),
      description: t("integrations_section.items.MICROSOFT.description"),
      icon: "/images/integrations/tts.png",
      actionLabel: t("integrations_section.items.MICROSOFT.action_label"),
      fields: [
        { key: "key", label: t("integrations_section.items.MICROSOFT.fields.key.label"), placeholder: t("integrations_section.items.MICROSOFT.fields.key.placeholder") },
        { key: "region", label: t("integrations_section.items.MICROSOFT.fields.region.label"), placeholder: t("integrations_section.items.MICROSOFT.fields.region.placeholder") },
      ],
    },
    {
      id: "CLOUDINARY",
      name: "Cloudinary",
      category: t("integrations_section.items.CLOUDINARY.category"),
      description: t("integrations_section.items.CLOUDINARY.description"),
      icon: "/images/integrations/cloudinary.svg",
      actionLabel: t("integrations_section.items.CLOUDINARY.action_label"),
      fields: [
        { key: "cloud_name", label: t("integrations_section.items.CLOUDINARY.fields.cloud_name.label"), placeholder: t("integrations_section.items.CLOUDINARY.fields.cloud_name.placeholder") },
        { key: "api_key", label: t("integrations_section.items.CLOUDINARY.fields.api_key.label"), placeholder: t("integrations_section.items.CLOUDINARY.fields.api_key.placeholder") },
        { key: "api_secret", label: t("integrations_section.items.CLOUDINARY.fields.api_secret.label"), placeholder: t("integrations_section.items.CLOUDINARY.fields.api_secret.placeholder") },
      ],
    },
    {
      id: "ACTIVECAMPAIGN",
      name: "ActiveCampaign",
      category: t("integrations_section.items.ACTIVECAMPAIGN.category"),
      description: t("integrations_section.items.ACTIVECAMPAIGN.description"),
      icon: "/images/integrations/activecampaign.svg",
      actionLabel: t("integrations_section.items.ACTIVECAMPAIGN.action_label"),
      fields: [
        { key: "api_url", label: t("integrations_section.items.ACTIVECAMPAIGN.fields.api_url.label"), placeholder: "https://youraccount.api-us1.com" },
        { key: "api_key", label: t("integrations_section.items.ACTIVECAMPAIGN.fields.api_key.label"), placeholder: t("integrations_section.items.ACTIVECAMPAIGN.fields.api_key.placeholder") },
      ],
    },
    {
      id: "CHATGPT",
      name: "OpenAI",
      category: t("integrations_section.items.CHATGPT.category"),
      description: t("integrations_section.items.CHATGPT.description"),
      icon: "/images/integrations/chat_gpt.svg",
      actionLabel: t("integrations_section.items.CHATGPT.action_label"),
      fields: [{ key: "api_key", label: t("integrations_section.items.CHATGPT.fields.api_key.label"), placeholder: "sk-..." }],
    },
    {
      id: "MAKE",
      name: "Make.com",
      category: t("integrations_section.items.MAKE.category"),
      description: t("integrations_section.items.MAKE.description"),
      icon: "/images/integrations/make.png",
      actionLabel: t("integrations_section.items.MAKE.action_label"),
      externalUrl: "https://make.com",
    },
    {
      id: "ELEVENLABS",
      name: "ElevenLabs",
      category: t("integrations_section.items.ELEVENLABS.category"),
      description: t("integrations_section.items.ELEVENLABS.description"),
      icon: "/images/integrations/elevenlabs.png",
      actionLabel: t("integrations_section.items.ELEVENLABS.action_label"),
      fields: [{ key: "api_key", label: t("integrations_section.items.ELEVENLABS.fields.api_key.label"), placeholder: t("integrations_section.items.ELEVENLABS.fields.api_key.placeholder") }],
    },
    {
      id: "CAL",
      name: "Cal.com",
      category: t("integrations_section.items.CAL.category"),
      description: t("integrations_section.items.CAL.description"),
      icon: "/images/integrations/cal_dot_com.png",
      actionLabel: t("integrations_section.items.CAL.action_label"),
      fields: [{ key: "api_key", label: t("integrations_section.items.CAL.fields.api_key.label"), placeholder: t("integrations_section.items.CAL.fields.api_key.placeholder") }],
    },
    {
      id: "BASEROW",
      name: "Baserow.io",
      category: t("integrations_section.items.BASEROW.category"),
      description: t("integrations_section.items.BASEROW.description"),
      icon: "/images/integrations/baserow.png",
      actionLabel: t("integrations_section.items.BASEROW.action_label"),
      fields: [{ key: "token", label: t("integrations_section.items.BASEROW.fields.token.label"), placeholder: t("integrations_section.items.BASEROW.fields.token.placeholder") }],
    },
  ];

  // Show only integrations the agent is permitted to access (owner holds
  // `workspace.*` so passes all). Cal.com / Baserow have no permission → hidden.
  const visibleIntegrations = staticIntegrations.filter((i) => {
    const slug = INTEGRATION_PERMS[i.id];
    return !!slug && hasAnyPerm(_intPerms, [slug]);
  });

  const handleConnect = (item: any) => {
    if (item.externalUrl) {
      window.open(item.externalUrl, "_blank");
      return;
    }
    const existing = integrationsData?.integrations?.find((i: any) => i.type === item.id);
    if (existing) {
      toast({ title: t("integrations_section.toast_active_session_title"), description: t("integrations_section.toast_already_operational_description", { name: item.name }) });
      return;
    }
    setConnectingId(item.id);
  };

  const submitConnection = () => {
    if (!connectingId) return;
    createMutation.mutate({ type: connectingId, ...formData });
  };

  const toggleIntegration = (type: string, checked: boolean) => {
    const integration = integrationsData?.integrations?.find((i: any) => i.type === type);
    if (integration) {
      toggleMutation.mutate({ id: integration.id, status: checked ? "ACTIVE" : "PAUSED" });
    } else {
      toast({ title: t("integrations_section.toast_action_required_title"), description: t("integrations_section.toast_initial_auth_description") });
    }
  };

  const isConnected = (type: string) => {
    return integrationsData?.integrations?.some((i: any) => i.type === type && i.status === "ACTIVE");
  };

  const currentConnecting = staticIntegrations.find((i) => i.id === connectingId);
  const connectedCount = integrationsData?.integrations?.length || 0;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <>
      <Card className={cn("rounded-[2rem] border overflow-hidden shadow-sm transition-all duration-300", card, border)}>
        <CardContent className="p-0">
          {/* Header */}
          <div className={cn("px-8 py-5 border-b flex items-center justify-between", border)}>
            <div className="flex items-center gap-4">
              <div className={cn("p-2.5 rounded-xl shadow-sm", "bg-primary/10")}>
                <Plug className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h1 className={cn("text-[16px] font-bold tracking-tight", text)}>{t("integrations_section.title")}</h1>
                <p className={cn("text-[11px] font-bold mt-0.5 opacity-60 max-w-2xl", sub)}>
                  {t("integrations_section.subtitle")}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <Badge variant="outline" className="h-7 px-3 rounded-md border-primary/20 bg-primary/5 text-primary text-[10px] font-semibold">
                {t("integrations_section.available_badge", { count: visibleIntegrations.length })}
              </Badge>
              <Badge variant="outline" className="h-7 px-3 rounded-md border-emerald-500/30 bg-emerald-500/5 text-emerald-600 dark:text-emerald-400 text-[10px] font-semibold">
                <Check size={10} className="mr-1" /> {t("integrations_section.connected_badge", { count: connectedCount })}
              </Badge>
            </div>
          </div>

          {/* Integrations Grid */}
          <div className="p-8">
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
              {visibleIntegrations.map((item) => {
                const connected = isConnected(item.id);
                const canToggle = integrationsData?.integrations?.some((i: any) => i.type === item.id);

                return (
                  <div
                    key={item.id}
                    className={cn(
                      "p-6 rounded-[1.5rem] border transition-all hover:shadow-md flex flex-col",
                      connected
                        ? "border-primary/30 bg-primary/5"
                        : cn(softBg, softBorder, "hover:border-primary/40")
                    )}
                  >
                    {/* Top Row: Icon + Category + External */}
                    <div className="flex items-start justify-between mb-4">
                      <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center border shrink-0", dark ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200")}>
                        <img src={item.icon} alt={item.name} className="h-7 w-7 object-contain" />
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className={cn("h-5 px-2 rounded-md text-[10px] font-semibold", dark ? "border-slate-700 bg-slate-800/50 text-slate-400" : "border-slate-200 bg-slate-100 text-slate-500")}>
                          {item.category}
                        </Badge>
                        <button
                          onClick={() => handleConnect(item)}
                          className={cn(
                            "w-8 h-8 rounded-lg flex items-center justify-center transition-all",
                            dark ? "hover:bg-slate-800 text-slate-400 hover:text-primary" : "hover:bg-slate-100 text-slate-500 hover:text-primary"
                          )}
                        >
                          <ExternalLink size={14} />
                        </button>
                      </div>
                    </div>

                    {/* Title + Description */}
                    <div className="space-y-2 mb-5 flex-1">
                      <h3 className={cn("text-[14px] font-black tracking-tight flex items-center gap-2", text)}>
                        {item.name}
                        {connected && (
                          <span className="flex items-center gap-1 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> {t("integrations_section.active")}
                          </span>
                        )}
                      </h3>
                      <p className={cn("text-[11px] font-medium opacity-70 leading-relaxed line-clamp-3", sub)}>
                        {item.description}
                      </p>
                    </div>

                    {/* Footer: Switch + Action */}
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={connected}
                          onCheckedChange={(c) => toggleIntegration(item.id, c)}
                          disabled={!canToggle}
                          className="data-[state=checked]:bg-primary"
                        />
                        <span className={cn("text-[11px] font-semibold", sub)}>
                          {connected ? t("integrations_section.on") : t("integrations_section.off")}
                        </span>
                      </div>
                      <button
                        onClick={() => handleConnect(item)}
                        className={cn(
                          "h-10 px-5 rounded-xl border text-[11px] font-semibold transition-all flex items-center gap-2",
                          connected
                            ? "border-primary bg-primary text-white hover:bg-primary/90"
                            : "border-primary text-primary hover:bg-primary hover:text-white"
                        )}
                      >
                        {connected ? t("integrations_section.manage") : item.actionLabel}
                        <ArrowRight size={12} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Connection Modal ── */}
      <Dialog open={!!connectingId} onOpenChange={(open) => !open && setConnectingId(null)}>
        <DialogContent className={cn("border p-0 overflow-hidden rounded-[2rem] max-w-md", card, border)}>
          <div className="p-6 space-y-5">
            <DialogHeader>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
                  <ShieldCheck size={18} />
                </div>
                <div className="text-left">
                  <DialogTitle className={cn("text-[14px] font-semibold", text)}>
                    {t("integrations_section.connect_dialog_title", { name: currentConnecting?.name })}
                  </DialogTitle>
                  <DialogDescription className={cn("text-[11px] font-medium opacity-60 mt-0.5", sub)}>
                    {t("integrations_section.connect_dialog_description")}
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>

            <div className="space-y-4">
              {currentConnecting?.fields?.map((field: any) => (
                <div key={field.key} className="space-y-2">
                  <label className={cn("block text-[11px] font-semibold", sub)}>
                    {field.label}
                  </label>
                  <div className="relative">
                    <div className={cn("absolute left-4 top-1/2 -translate-y-1/2", sub)}>
                      <Info size={14} />
                    </div>
                    <input
                      type="text"
                      value={formData[field.key] || ""}
                      onChange={(e) => setFormData({ ...formData, [field.key]: e.target.value })}
                      placeholder={field.placeholder || t("integrations_section.enter_placeholder", { label: field.label })}
                      className={inputCls}
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className={cn("flex justify-end gap-2 pt-4 border-t", softBorder)}>
              <button onClick={() => setConnectingId(null)} className={outlineBtn}>
                {t("integrations_section.discard")}
              </button>
              <button
                onClick={submitConnection}
                disabled={createMutation.isPending}
                className={primaryBtn}
              >
                {createMutation.isPending ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
                {t("integrations_section.authorize")}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
