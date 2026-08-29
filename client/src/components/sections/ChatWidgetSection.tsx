import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
} from "@/components/ui/alert-dialog";
import {
  Edit2,
  Trash2,
  MessageCircle,
  Mail,
  Phone,
  Send,
  Facebook,
  Copy,
  Eye,
  Plus,
  Loader2,
  ChevronLeft,
  AlertCircle,
  Info,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { useTheme } from "@/contexts/ThemeContext";

function safeJsonParse(input: any): any {
  if (input == null) return null;
  if (typeof input !== "string") return input;
  try {
    return JSON.parse(input);
  } catch {
    return null;
  }
}

export default function ChatWidgetSection() {
  const { mode } = useTheme();
  const dark = mode === "dark";
  const { toast } = useToast();
  const { t } = useTranslation();

  // `actions` is the wire shape expected by the backend (and persisted on
  // `widget_actions`). The frontend channel buttons toggle entries in this
  // array; the per-channel dropdown sets `model_type` + `model.id`.
  interface ChannelAction {
    channel: string;        // e.g. 'whatsapp'
    model_type: string;     // 'WHATSAPP_NUMBER', 'TELEGRAM_BOT', ...
    model_id: string;       // resource id from connected channels
    model_label?: string;   // display label (e.g. phone number)
  }
  const emptyForm = {
    id: null as string | null,
    name: "",
    title: "",
    actions: [] as ChannelAction[],
    headerColor: "#1e40af",
    bodyColor: "#ffffff",
    position: "bottom-right",
    footerText: t("chat_widget_section.footer_text_placeholder"),
    fontFamily: "Verdana",
  };

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [widgetToDelete, setWidgetToDelete] = useState<any>(null);
  const [formData, setFormData] = useState(emptyForm);

  // ── Design tokens ─────────────────────────────────────────
  const card       = dark ? "bg-[#0f1829]"    : "bg-white";
  const border     = dark ? "border-slate-800" : "border-slate-200";
  const text       = dark ? "text-white"      : "text-slate-900";
  const sub        = dark ? "text-slate-500"  : "text-slate-400";
  const softBg     = dark ? "bg-slate-950/40" : "bg-slate-50/50";
  const softBorder = dark ? "border-slate-800" : "border-slate-100";

  const inputCls = cn(
    "w-full h-11 rounded-xl text-[13px] font-bold transition-all px-4 border outline-none",
    "focus:ring-2 focus:ring-primary/30 focus:border-primary/50",
    dark ? "bg-slate-950/50 border-slate-800 text-white" : "bg-white border-slate-200 text-slate-900"
  );

  const selectCls = cn(
    inputCls,
    "appearance-none cursor-pointer pr-10 bg-no-repeat",
    dark
      ? "bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2212%22 height=%2212%22 viewBox=%220 0 24 24%22 fill=%22none%22 stroke=%22%2394a3b8%22 stroke-width=%222%22><polyline points=%226 9 12 15 18 9%22/></svg>')]"
      : "bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2212%22 height=%2212%22 viewBox=%220 0 24 24%22 fill=%22none%22 stroke=%22%2364748b%22 stroke-width=%222%22><polyline points=%226 9 12 15 18 9%22/></svg>')]",
    "[background-position:right_1rem_center]"
  );

  const outlineBtn = cn(
    "h-11 px-6 rounded-xl border text-[11px] font-semibold transition-all flex items-center gap-2",
    dark ? "border-slate-800 text-slate-300 hover:border-primary/40 hover:text-primary" : "border-slate-200 text-slate-700 hover:border-primary/40 hover:text-primary"
  );

  const primaryOutlineBtn = cn(
    "h-10 px-6 rounded-xl border text-[11px] font-semibold transition-all flex items-center gap-2",
    "border-primary text-primary hover:bg-primary hover:text-white"
  );

  const primaryBtn =
    "h-11 px-7 rounded-xl bg-primary hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed text-white text-[11px] font-semibold transition-all shadow-lg shadow-primary/20 flex items-center gap-2";

  const labelCls = cn("block text-[11px] font-semibold", sub);

  // Backend now returns `{widgets, whatsapp, telegram, messenger, instagram,
  // zapi, twilio_numbers}` so the frontend dropdowns can populate from
  // connected channels rather than free-text inputs.
  const { data, isLoading } = useQuery<any>({
    queryKey: ["/api/widgets"],
    queryFn: async () => (await apiRequest("GET", "/api/widgets")).json(),
  });
  const widgets: any[] = data?.widgets ?? [];

  // Available options per channel — shape mirrors replyagent's
  // `getWidgetData`. Empty arrays just mean nothing's connected for that
  // channel; the dropdown disables itself in that case.
  const channelOptions = useMemo(
    () => ({
      whatsapp: (data?.whatsapp?.channels ?? []).map((c: any) => ({
        id: String(c.id),
        label: c.name ?? c.waba_id ?? t("chat_widget_section.fallback_waba", { id: c.id }),
        model_type: "WHATSAPP_NUMBER",
      })),
      telegram: (data?.telegram?.bots ?? []).map((c: any) => ({
        id: String(c.id),
        label: c.username ? `@${c.username}` : c.name ?? t("chat_widget_section.fallback_bot", { id: c.id }),
        model_type: "TELEGRAM_BOT",
      })),
      messenger: (data?.messenger?.pages ?? []).map((c: any) => ({
        id: String(c.id),
        label: c.name ?? t("chat_widget_section.fallback_page", { id: c.id }),
        model_type: "FACEBOOK_PAGE",
      })),
      instagram: (data?.instagram?.pages ?? []).map((c: any) => ({
        id: String(c.id),
        label: c.name ?? t("chat_widget_section.fallback_ig", { id: c.id }),
        model_type: "INSTAGRAM_PAGE",
      })),
      zapi: (data?.zapi?.channels ?? []).map((c: any) => ({
        id: String(c.id),
        label: c.phone ?? c.name ?? t("chat_widget_section.fallback_zapi", { id: c.id }),
        model_type: "ZAPI_INSTANCE",
      })),
      twilio: (data?.twilio_numbers ?? []).map((c: any) => ({
        id: String(c.id),
        label: c.phone_number ?? c.friendly_name ?? t("chat_widget_section.fallback_twilio", { id: c.id }),
        model_type: "TWILIO_NUMBER",
      })),
    }),
    [data, t],
  );

  const saveMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/widgets", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/widgets"] });
      toast({ title: t("chat_widget_section.toast_success_title"), description: t("chat_widget_section.toast_widget_saved") });
      setIsCreateModalOpen(false);
      setEditingId(null);
    },
    onError: (error: Error) => {
      toast({ title: t("chat_widget_section.toast_error_title"), description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/widgets/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/widgets"] });
      toast({ title: t("chat_widget_section.toast_success_title"), description: t("chat_widget_section.toast_widget_deleted") });
      setWidgetToDelete(null);
    },
    onError: (error: Error) => {
      toast({ title: t("chat_widget_section.toast_error_title"), description: error.message, variant: "destructive" });
    },
  });

  // Replyagent's 8 widget channels. We render channels through their actual
  // brand SVGs (the `automations/*.svg` files used by Inbox + Automations)
  // rather than monochrome Lucide icons — that's what makes the row visually
  // recognisable in replyagent's UI.
  interface ChannelMeta {
    key: string;
    label: string;
    svg?: string;          // brand SVG path
    LucideIcon?: any;      // fallback lucide icon (when no SVG asset)
    optionsKey?: keyof typeof channelOptions;
    needsNumberType?: boolean; // SMS/Call use Custom number / Twilio number first
    placeholder?: string;
    inputType?: "text" | "email" | "tel";
    tooltip: string;
  }
  const channelMetas: ChannelMeta[] = [
    {
      key: "email",
      label: t("chat_widget_section.channel_email"),
      LucideIcon: Mail,
      inputType: "email",
      placeholder: t("chat_widget_section.email_placeholder"),
      tooltip: t("chat_widget_section.tooltip_email"),
    },
    {
      key: "sms",
      label: t("chat_widget_section.channel_sms"),
      svg: "/images/automations/sms.svg",
      optionsKey: "twilio",
      needsNumberType: true,
      placeholder: t("chat_widget_section.phone_placeholder"),
      tooltip: t("chat_widget_section.tooltip_sms"),
    },
    {
      key: "call",
      label: t("chat_widget_section.channel_call"),
      LucideIcon: Phone,
      optionsKey: "twilio",
      needsNumberType: true,
      placeholder: t("chat_widget_section.phone_placeholder"),
      tooltip: t("chat_widget_section.tooltip_call"),
    },
    {
      key: "whatsapp",
      label: "WhatsApp",
      svg: "/images/automations/whatsapp.svg",
      optionsKey: "whatsapp",
      tooltip: t("chat_widget_section.tooltip_whatsapp"),
    },
    {
      // Replyagent places Z-API immediately after WhatsApp (both green
      // WhatsApp icons). Keep that order so the side-by-side visual matches.
      key: "zapi",
      label: "Z-API",
      svg: "/images/automations/whatsapp.svg",
      optionsKey: "zapi",
      tooltip: t("chat_widget_section.tooltip_zapi"),
    },
    {
      key: "telegram",
      label: "Telegram",
      svg: "/images/automations/telegram.svg",
      optionsKey: "telegram",
      tooltip: t("chat_widget_section.tooltip_telegram"),
    },
    {
      key: "messenger",
      label: "Messenger",
      svg: "/images/automations/messenger.svg",
      optionsKey: "messenger",
      tooltip: t("chat_widget_section.tooltip_messenger"),
    },
    {
      key: "instagram",
      label: "Instagram",
      svg: "/images/automations/instagram.svg",
      optionsKey: "instagram",
      tooltip: t("chat_widget_section.tooltip_instagram"),
    },
  ];

  // Renders a brand SVG icon or falls back to a Lucide outline icon. Kept
  // small + unstyled-square so the row looks identical to replyagent's
  // image-only row icons.
  const renderChannelIcon = (meta: ChannelMeta, size = 20) => {
    if (meta.svg) {
      return <img src={meta.svg} alt={meta.label} style={{ width: size, height: size }} className="object-contain" />;
    }
    const Icon = meta.LucideIcon ?? MessageCircle;
    return <Icon size={size - 4} className="text-primary" />;
  };

  const handleCreateWidget = () => {
    if (!formData.name.trim() || !formData.title.trim()) {
      toast({ title: t("chat_widget_section.toast_name_title_required"), variant: "destructive" });
      return;
    }
    saveMutation.mutate({
      ...(editingId ? { id: editingId } : {}),
      name: formData.name,
      title: formData.title,
      subtitle: formData.footerText || null,
      header_bg: formData.headerColor,
      body_bg: formData.bodyColor,
      font_family: formData.fontFamily,
      position: formData.position,
      // Replyagent persists each channel as a widget_actions row with the
      // resolved model id under `modelable_id`. We send both shapes so the
      // backend can pick either.
      actions: formData.actions.map((a) => ({
        channel: a.channel,
        model_type: a.model_type,
        model: { id: a.model_id, name: a.model_label },
        modelable_id: a.model_id,
      })),
    });
  };

  const handleEditWidget = (widget: any) => {
    const actions: ChannelAction[] = Array.isArray(widget.actions)
      ? widget.actions
          .filter((a: any) => a && a.channel)
          .map((a: any) => {
            const modelRaw = typeof a.model === "string" ? safeJsonParse(a.model) : a.model;
            return {
              channel: String(a.channel).toLowerCase(),
              model_type: a.model_type ?? "",
              model_id: String(modelRaw?.id ?? a.modelable_id ?? ""),
              model_label: modelRaw?.name ?? modelRaw?.label ?? "",
            };
          })
      : [];
    setFormData({
      id: String(widget.id),
      name: widget.name,
      title: widget.title,
      actions,
      headerColor: widget.header_bg || "#1e40af",
      bodyColor: widget.body_bg || "#ffffff",
      position: widget.position || "bottom-right",
      footerText: widget.subtitle || t("chat_widget_section.footer_text_placeholder"),
      fontFamily: widget.font_family || "Verdana",
    });
    setEditingId(widget.id);
    setIsCreateModalOpen(true);
  };

  const openCreate = () => {
    setEditingId(null);
    setFormData(emptyForm);
    setIsCreateModalOpen(true);
  };

  const closeForm = () => {
    setIsCreateModalOpen(false);
    setFormData(emptyForm);
    setEditingId(null);
  };

  const toggleChannel = (channel: string) => {
    setFormData((prev) => {
      const existing = prev.actions.find((a) => a.channel === channel);
      if (existing) {
        return { ...prev, actions: prev.actions.filter((a) => a.channel !== channel) };
      }
      // Default: when ticking a channel pre-populate with the first available
      // resource so the dropdown shows a sensible value rather than empty.
      const opts =
        channel === "whatsapp"
          ? channelOptions.whatsapp
          : channel === "telegram"
            ? channelOptions.telegram
            : channel === "messenger"
              ? channelOptions.messenger
              : channel === "instagram"
                ? channelOptions.instagram
                : channel === "zapi"
                  ? channelOptions.zapi
                  : channel === "sms" || channel === "call"
                    ? channelOptions.twilio
                    : [];
      const first = opts[0];
      return {
        ...prev,
        actions: [
          ...prev.actions,
          {
            channel,
            model_type: first?.model_type ?? "",
            model_id: first?.id ?? "",
            model_label: first?.label ?? "",
          },
        ],
      };
    });
  };

  const updateChannelResource = (channel: string, id: string) => {
    setFormData((prev) => {
      const opts =
        channel === "whatsapp"
          ? channelOptions.whatsapp
          : channel === "telegram"
            ? channelOptions.telegram
            : channel === "messenger"
              ? channelOptions.messenger
              : channel === "instagram"
                ? channelOptions.instagram
                : channel === "zapi"
                  ? channelOptions.zapi
                  : channelOptions.twilio;
      const pick = opts.find((o: { id: string; label: string; model_type: string }) => o.id === id);
      return {
        ...prev,
        actions: prev.actions.map((a) =>
          a.channel === channel
            ? {
                ...a,
                model_id: id,
                model_label: pick?.label ?? id,
                model_type: pick?.model_type ?? a.model_type,
              }
            : a,
        ),
      };
    });
  };

  // Embed code uses the persisted widget slug so the snippet you copy after
  // saving actually addresses *this* widget. Pre-save we show a placeholder
  // so the user knows it'll be filled in after save.
  const currentWidgetSlug = editingId
    ? widgets.find((w: any) => String(w.id) === String(editingId))?.slug
    : null;
  const widgetCode = `<!-- EZCONN Chat Widget -->
<script
  src="https://widget.ezconn.io/embed.js"
  data-widget-slug="${currentWidgetSlug ?? "WILL_BE_GENERATED_ON_SAVE"}"
  data-position="${formData.position}"
  defer
></script>`;

  const ColorInput = ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
    <div className="flex gap-2 items-center">
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn("w-11 h-11 rounded-xl cursor-pointer border", softBorder)}
      />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(inputCls, "flex-1")}
      />
    </div>
  );

  return (
    <>
      <Card className={cn("rounded-[2rem] border overflow-hidden shadow-sm transition-all duration-300", card, border)}>
        <CardContent className="p-0">
          {/* Header — dynamic per view */}
          <div className={cn("px-8 py-5 border-b flex items-center justify-between", border)}>
            <div className="flex items-center gap-4">
              <div className={cn("p-2.5 rounded-xl shadow-sm", "bg-primary/10")}>
                <MessageCircle className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h1 className={cn("text-[16px] font-bold tracking-tight", text)}>
                  {isCreateModalOpen
                    ? editingId
                      ? t("chat_widget_section.header_edit_title")
                      : t("chat_widget_section.header_create_title")
                    : t("chat_widget_section.header_list_title")}
                </h1>
                <p className={cn("text-[11px] font-medium mt-0.5 opacity-60 max-w-2xl", sub)}>
                  {t("chat_widget_section.header_subtitle")}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {!isCreateModalOpen ? (
                <button onClick={openCreate} className={primaryOutlineBtn}>
                  <Plus size={12} /> {t("chat_widget_section.add_new")}
                </button>
              ) : (
                <button onClick={closeForm} className={outlineBtn}>
                  <ChevronLeft size={12} /> {t("chat_widget_section.back")}
                </button>
              )}
            </div>
          </div>

          {/* ── LIST VIEW ── */}
          {!isCreateModalOpen && (
            <div className="p-8">
              <div className={cn("rounded-[1.5rem] border overflow-hidden", softBorder, softBg)}>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className={cn("border-b", softBorder, dark ? "bg-slate-900/40" : "bg-white/60")}>
                        <th className={cn("px-6 py-4 text-left text-[11px] font-semibold", sub)}>{t("chat_widget_section.table_name")}</th>
                        <th className={cn("px-6 py-4 text-left text-[11px] font-semibold", sub)}>{t("chat_widget_section.table_title")}</th>
                        <th className={cn("px-6 py-4 text-left text-[11px] font-semibold", sub)}>{t("chat_widget_section.table_channels")}</th>
                        <th className={cn("px-6 py-4 text-right text-[11px] font-semibold", sub)}>{t("chat_widget_section.table_actions")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {isLoading ? (
                        <tr>
                          <td colSpan={4} className="px-6 py-12 text-center">
                            <Loader2 className="w-6 h-6 animate-spin mx-auto text-primary" />
                          </td>
                        </tr>
                      ) : widgets.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="px-6 py-16 text-center">
                            <div className="flex flex-col items-center gap-3">
                              <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
                                <MessageCircle className="w-7 h-7 text-primary" />
                              </div>
                              <div className="space-y-1">
                                <h3 className={cn("text-[13px] font-black", text)}>{t("chat_widget_section.empty_title")}</h3>
                                <p className={cn("text-[11px] font-medium opacity-60", sub)}>
                                  {t("chat_widget_section.empty_description")}
                                </p>
                              </div>
                            </div>
                          </td>
                        </tr>
                      ) : (
                        widgets.map((widget) => (
                          <tr
                            key={widget.id}
                            className={cn("border-b transition-colors", softBorder, dark ? "hover:bg-slate-900/40" : "hover:bg-white/80")}
                          >
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                                  <MessageCircle size={14} className="text-primary" />
                                </div>
                                <span className="text-[13px] font-black text-primary">{widget.name}</span>
                              </div>
                            </td>
                            <td className={cn("px-6 py-4 text-[12px] font-bold", sub)}>{widget.title}</td>
                            <td className={cn("px-6 py-4 text-[11px] font-bold italic", sub)}>{t("chat_widget_section.live_settings")}</td>
                            <td className="px-6 py-4">
                              <div className="flex items-center justify-end gap-2">
                                <button
                                  onClick={() => handleEditWidget(widget)}
                                  className={cn("w-9 h-9 rounded-lg border flex items-center justify-center transition-all", dark ? "border-slate-800 hover:border-primary/40 hover:text-primary text-slate-400" : "border-slate-200 hover:border-primary/40 hover:text-primary text-slate-500")}
                                  title={t("chat_widget_section.edit_action")}
                                >
                                  <Edit2 size={13} />
                                </button>
                                <button
                                  onClick={() => setWidgetToDelete(widget)}
                                  className={cn("w-9 h-9 rounded-lg border flex items-center justify-center transition-all", dark ? "border-slate-800 hover:border-rose-500/40 hover:text-rose-500 text-slate-400" : "border-slate-200 hover:border-rose-500/40 hover:text-rose-500 text-slate-500")}
                                  title={t("chat_widget_section.delete_action")}
                                >
                                  <Trash2 size={13} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
                <div className={cn("px-6 py-3 border-t text-[11px] font-semibold", softBorder, sub, dark ? "bg-slate-900/40" : "bg-white/60")}>
                  {t("chat_widget_section.showing_count", { count: widgets.length, total: widgets.length })}
                </div>
              </div>
            </div>
          )}

          {/* ── CREATE / EDIT FORM ── */}
          {isCreateModalOpen && (
            <div className="p-8">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Form */}
                <div className="lg:col-span-2 space-y-6">
                  <div className={cn("rounded-[1.5rem] border p-6 space-y-5", softBg, softBorder)}>
                    {/* Field labels mirror replyagent's `ChatWidgets.vue`
                        verbatim — "Widget name", "Widget title", "Widget
                        header color", "Widget title font family", "Widget
                        body color", "Widget position on your website". */}
                    <div className="space-y-2">
                      <label className={labelCls}>{t("chat_widget_section.widget_name_label")}</label>
                      <input
                        type="text"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value.slice(0, 250) })}
                        className={inputCls}
                        placeholder={t("chat_widget_section.widget_name_placeholder")}
                        maxLength={250}
                      />
                    </div>

                    <div className="space-y-2">
                      <label className={labelCls}>{t("chat_widget_section.widget_title_label")}</label>
                      <input
                        type="text"
                        value={formData.title}
                        onChange={(e) => setFormData({ ...formData, title: e.target.value.slice(0, 250) })}
                        className={inputCls}
                        placeholder={t("chat_widget_section.widget_title_placeholder")}
                        maxLength={250}
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      <div className="space-y-2">
                        <label className={labelCls}>{t("chat_widget_section.widget_header_color_label")}</label>
                        <ColorInput value={formData.headerColor} onChange={(v) => setFormData({ ...formData, headerColor: v })} />
                      </div>
                      <div className="space-y-2">
                        <label className={labelCls}>{t("chat_widget_section.widget_font_family_label")}</label>
                        <select
                          value={formData.fontFamily}
                          onChange={(e) => setFormData({ ...formData, fontFamily: e.target.value })}
                          className={selectCls}
                        >
                          {/* Replyagent's font set — keep order for parity.
                              Font names are proper nouns, not translated. */}
                          <option value="arial">Arial</option>
                          <option value="cursive">Brush Script MT</option>
                          <option value="georgia">Georgia</option>
                          <option value="monospace">Monospace</option>
                          <option value="tahoma">Tahoma</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      <div className="space-y-2">
                        <label className={labelCls}>{t("chat_widget_section.widget_body_color_label")}</label>
                        <ColorInput value={formData.bodyColor} onChange={(v) => setFormData({ ...formData, bodyColor: v })} />
                      </div>
                      <div className="space-y-2">
                        <label className={labelCls}>{t("chat_widget_section.widget_position_label")}</label>
                        <select
                          value={formData.position}
                          onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                          className={selectCls}
                        >
                          {/* Order mirrors replyagent: Right bottom first */}
                          <option value="bottom-right">{t("chat_widget_section.position_bottom_right")}</option>
                          <option value="bottom-left">{t("chat_widget_section.position_bottom_left")}</option>
                          <option value="top-right">{t("chat_widget_section.position_top_right")}</option>
                          <option value="top-left">{t("chat_widget_section.position_top_left")}</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Channels — replyagent-style row: checkbox + brand SVG +
                      per-channel control + info tooltip. */}
                  <div className={cn("rounded-[1.5rem] border p-6 space-y-4", softBg, softBorder)}>
                    <label className={labelCls}>{t("chat_widget_section.channels_select_label")}</label>
                    <div className="space-y-3">
                      <TooltipProvider delayDuration={150}>
                        {channelMetas.map((meta) => {
                          const action = formData.actions.find((a) => a.channel === meta.key);
                          const isOn = !!action;
                          const opts = meta.optionsKey ? channelOptions[meta.optionsKey] : [];
                          // Replyagent defaults SMS/Call to Custom number (so
                          // the phone-number text input appears straight away).
                          // Switching to Twilio number swaps in the connected
                          // numbers dropdown.
                          const numberType = (action as any)?.number_type ?? "CUSTOM_NUMBER";

                          // Helper that auto-checks the channel if the user
                          // starts interacting with its controls before ticking
                          // the box (matches replyagent — controls are always
                          // live, the checkbox just confirms intent on save).
                          const ensureChannelOn = () => {
                            if (!isOn) toggleChannel(meta.key);
                          };

                          return (
                            <div key={meta.key} className="flex flex-wrap items-center gap-3">
                              <input
                                type="checkbox"
                                id={`channel-${meta.key}`}
                                checked={isOn}
                                onChange={() => toggleChannel(meta.key)}
                                className="w-4 h-4 rounded accent-[hsl(var(--primary))]"
                              />
                              <span className="w-6 h-6 flex items-center justify-center shrink-0">
                                {renderChannelIcon(meta, 20)}
                              </span>

                              {/* Email row: just an email input — always active */}
                              {meta.inputType === "email" && (
                                <input
                                  type="email"
                                  placeholder={meta.placeholder}
                                  value={action?.model_label ?? ""}
                                  onFocus={ensureChannelOn}
                                  onChange={(e) => {
                                    ensureChannelOn();
                                    setFormData((prev) => ({
                                      ...prev,
                                      actions: prev.actions.some((a) => a.channel === meta.key)
                                        ? prev.actions.map((a) =>
                                            a.channel === meta.key
                                              ? { ...a, model_id: e.target.value, model_label: e.target.value, model_type: "EMAIL" }
                                              : a,
                                          )
                                        : [
                                            ...prev.actions,
                                            { channel: meta.key, model_id: e.target.value, model_label: e.target.value, model_type: "EMAIL" } as any,
                                          ],
                                    }));
                                  }}
                                  className={cn(inputCls, "flex-1")}
                                />
                              )}

                              {/* SMS / Call row: number_type dropdown + value */}
                              {meta.needsNumberType && (
                                <>
                                  <select
                                    value={numberType}
                                    onChange={(e) => {
                                      ensureChannelOn();
                                      setFormData((prev) => ({
                                        ...prev,
                                        actions: prev.actions.some((a) => a.channel === meta.key)
                                          ? prev.actions.map((a) =>
                                              a.channel === meta.key
                                                ? { ...a, number_type: e.target.value, model_id: "", model_label: "", model_type: e.target.value } as any
                                                : a,
                                            )
                                          : [
                                              ...prev.actions,
                                              { channel: meta.key, number_type: e.target.value, model_id: "", model_label: "", model_type: e.target.value } as any,
                                            ],
                                      }));
                                    }}
                                    className={cn(selectCls, "w-44")}
                                  >
                                    <option value="CUSTOM_NUMBER">{t("chat_widget_section.number_type_custom")}</option>
                                    <option value="TWILIO_NUMBER">{t("chat_widget_section.number_type_twilio")}</option>
                                  </select>
                                  {numberType === "CUSTOM_NUMBER" ? (
                                    <input
                                      type="tel"
                                      placeholder={meta.placeholder}
                                      value={action?.model_label ?? ""}
                                      onFocus={ensureChannelOn}
                                      onChange={(e) => {
                                        ensureChannelOn();
                                        setFormData((prev) => ({
                                          ...prev,
                                          actions: prev.actions.some((a) => a.channel === meta.key)
                                            ? prev.actions.map((a) =>
                                                a.channel === meta.key
                                                  ? { ...a, model_id: e.target.value, model_label: e.target.value, model_type: "CUSTOM_NUMBER" }
                                                  : a,
                                              )
                                            : [
                                                ...prev.actions,
                                                { channel: meta.key, number_type: "CUSTOM_NUMBER", model_id: e.target.value, model_label: e.target.value, model_type: "CUSTOM_NUMBER" } as any,
                                              ],
                                        }));
                                      }}
                                      className={cn(inputCls, "flex-1")}
                                    />
                                  ) : (
                                    <select
                                      value={action?.model_id ?? ""}
                                      onChange={(e) => { ensureChannelOn(); updateChannelResource(meta.key, e.target.value); }}
                                      disabled={opts.length === 0}
                                      className={cn(selectCls, "flex-1 disabled:opacity-50")}
                                    >
                                      {opts.length === 0 ? (
                                        <option value="">{t("chat_widget_section.no_twilio_numbers")}</option>
                                      ) : (
                                        <>
                                          <option value="">{t("chat_widget_section.select_twilio_number")}</option>
                                          {opts.map((o: { id: string; label: string; model_type: string }) => (
                                            <option key={o.id} value={o.id}>{o.label}</option>
                                          ))}
                                        </>
                                      )}
                                    </select>
                                  )}
                                </>
                              )}

                              {/* WhatsApp / Z-API / Telegram / Messenger / Instagram:
                                  always-active "Select an action." dropdown */}
                              {!meta.needsNumberType && !meta.inputType && meta.optionsKey && (
                                <select
                                  value={action?.model_id ?? ""}
                                  onChange={(e) => { ensureChannelOn(); updateChannelResource(meta.key, e.target.value); }}
                                  className={selectCls + " flex-1"}
                                >
                                  <option value="">{t("chat_widget_section.select_action")}</option>
                                  {opts.map((o: { id: string; label: string; model_type: string }) => (
                                    <option key={o.id} value={o.id}>{o.label}</option>
                                  ))}
                                </select>
                              )}

                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <button type="button" className={cn("w-7 h-7 rounded-full flex items-center justify-center", sub, "hover:text-primary")}>
                                    <Info size={14} />
                                  </button>
                                </TooltipTrigger>
                                <TooltipContent className="max-w-xs text-[11px] font-medium">
                                  {meta.tooltip}
                                </TooltipContent>
                              </Tooltip>
                            </div>
                          );
                        })}
                      </TooltipProvider>
                    </div>
                  </div>

                  <div className={cn("rounded-[1.5rem] border p-6 space-y-2", softBg, softBorder)}>
                    <label className={labelCls}>{t("chat_widget_section.footer_text_label")}</label>
                    <input
                      type="text"
                      value={formData.footerText}
                      onChange={(e) => setFormData({ ...formData, footerText: e.target.value })}
                      className={inputCls}
                      placeholder={t("chat_widget_section.footer_text_placeholder")}
                    />
                  </div>
                </div>

                {/* Preview + Code */}
                <div className="space-y-6">
                  <div className={cn("rounded-[1.5rem] border p-6 space-y-3", softBg, softBorder)}>
                    <label className={labelCls}>{t("chat_widget_section.preview_label")}</label>
                    <div
                      className="rounded-[1.25rem] overflow-hidden shadow-lg border"
                      style={{ backgroundColor: formData.bodyColor, borderColor: dark ? "#1e293b" : "#e2e8f0" }}
                    >
                      <div
                        style={{ backgroundColor: formData.headerColor }}
                        className="p-4 text-white min-h-[5rem] flex items-center justify-center"
                      >
                        <p className="text-[13px] font-bold text-center" style={{ fontFamily: formData.fontFamily }}>
                          {formData.title || t("chat_widget_section.widget_title_placeholder")}
                        </p>
                      </div>
                      <div className="p-6 flex justify-center">
                        <div className="w-14 h-14 rounded-full bg-primary flex items-center justify-center shadow-lg">
                          <MessageCircle size={28} className="text-white" />
                        </div>
                      </div>
                      {formData.footerText && (
                        <div className={cn("border-t p-3 text-center text-[11px] font-bold", softBorder, sub)}>
                          {formData.footerText}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className={cn("rounded-[1.5rem] border p-6 space-y-3", softBg, softBorder)}>
                    <label className={labelCls}>{t("chat_widget_section.code_snippet_label")}</label>
                    {/* Replyagent shows an empty disabled textarea until the
                        widget is saved (it needs the slug to be useful). We
                        mirror that — placeholder hint + disabled state. */}
                    {currentWidgetSlug ? (
                      <div className={cn("relative rounded-xl border p-4 font-mono text-[11px] overflow-auto h-44", softBorder, dark ? "bg-slate-950/50 text-slate-300" : "bg-white text-slate-700")}>
                        <pre className="whitespace-pre-wrap">{widgetCode}</pre>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(widgetCode);
                            toast({ title: t("chat_widget_section.copied_title"), description: t("chat_widget_section.copied_description") });
                          }}
                          className={cn("absolute top-2 right-2 w-8 h-8 rounded-lg flex items-center justify-center transition-colors", dark ? "hover:bg-slate-800 text-slate-400 hover:text-primary" : "hover:bg-slate-100 text-slate-500 hover:text-primary")}
                        >
                          <Copy size={13} />
                        </button>
                      </div>
                    ) : (
                      <div className={cn("rounded-xl border p-4 h-44 flex items-center justify-center text-center", softBorder, sub)}>
                        <p className="text-[11px] font-medium opacity-60">
                          {t("chat_widget_section.save_to_generate_snippet")}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Footer Actions */}
              <div className={cn("flex justify-end gap-2 pt-6 mt-6 border-t", softBorder)}>
                <button onClick={closeForm} className={outlineBtn}>
                  {t("chat_widget_section.cancel")}
                </button>
                <button
                  onClick={handleCreateWidget}
                  disabled={!formData.name.trim() || !formData.title.trim() || saveMutation.isPending}
                  className={primaryBtn}
                >
                  {saveMutation.isPending && <Loader2 size={12} className="animate-spin" />}
                  {t("chat_widget_section.save")}
                </button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Delete Dialog ── */}
      <AlertDialog open={!!widgetToDelete} onOpenChange={(open) => !open && setWidgetToDelete(null)}>
        <AlertDialogContent className={cn("rounded-[2rem] border p-0 max-w-md overflow-hidden", card, border)}>
          <div className="p-6 space-y-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-500/10 flex items-center justify-center text-rose-500">
                <AlertCircle size={18} />
              </div>
              <div>
                <h2 className={cn("text-[14px] font-semibold", text)}>{t("chat_widget_section.delete_dialog_title")}</h2>
                <p className={cn("text-[11px] font-medium opacity-60 mt-0.5 leading-relaxed", sub)}>
                  <span className="text-rose-500 font-black">{widgetToDelete?.name || t("chat_widget_section.delete_dialog_fallback_name")}</span> {t("chat_widget_section.delete_dialog_description")}
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <AlertDialogCancel className={cn(outlineBtn, "m-0")}>{t("chat_widget_section.cancel")}</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => deleteMutation.mutate(widgetToDelete.id)}
                className="h-11 px-7 rounded-xl bg-rose-500 hover:bg-rose-600 text-white text-[11px] font-semibold transition-all shadow-lg shadow-rose-500/20 flex items-center gap-2"
              >
                <Trash2 size={12} /> {t("chat_widget_section.delete_action")}
              </AlertDialogAction>
            </div>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
