import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Sparkles,
  Edit2,
  Trash2,
  FileText,
  Grid3x3,
  Link as LinkIcon,
  Plus,
  ChevronLeft,
  AlertCircle,
  Info,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
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

export default function AIItemsSection() {
  const { t } = useTranslation();
  const { mode } = useTheme();
  const dark = mode === "dark";
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [isCreateFormOpen, setIsCreateFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"item-data" | "internal-notes">("item-data");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<any>(null);

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

  const textareaCls = cn(
    "w-full rounded-xl text-[13px] font-medium transition-all px-4 py-3 border outline-none resize-none",
    "focus:ring-2 focus:ring-primary/30 focus:border-primary/50",
    dark ? "bg-slate-950/50 border-slate-800 text-white" : "bg-white border-slate-200 text-slate-900"
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

  const { data: items, isLoading } = useQuery({
    queryKey: ["/api/ai/products"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/ai/products");
      return res.json();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number | string) => {
      await apiRequest("DELETE", `/api/ai/products/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ai/products"] });
      toast({ title: t("ai_items_section.toast_deleted_title"), description: t("ai_items_section.toast_deleted_desc") });
    },
    onError: () => {
      toast({ title: t("ai_items_section.toast_error_title"), description: t("ai_items_section.toast_delete_error_desc"), variant: "destructive" });
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/ai/products", { ...data, ai_theme_id: 1 });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ai/products"] });
      toast({ title: t("ai_items_section.toast_success_title"), description: t("ai_items_section.toast_save_success_desc") });
      handleCancel();
    },
    onError: () => {
      toast({ title: t("ai_items_section.toast_error_title"), description: t("ai_items_section.toast_save_error_desc"), variant: "destructive" });
    },
  });

  const [formData, setFormData] = useState({
    name: "",
    aiAssistant: "",
    smartFlow: "",
    channel: "",
    linkText: "",
    payload: "",
    savePayloadField: "",
    dataToFeedAI: "",
    internalNotes: "",
    images: [] as string[],
  });

  const handlePublish = () => {
    if (formData.name.trim()) {
      saveMutation.mutate({
        name: formData.name,
        payload: formData.payload,
        link_text: formData.linkText,
        properties: {
          aiAssistant: formData.aiAssistant,
          smartFlow: formData.smartFlow,
          channel: formData.channel,
          dataToFeedAI: formData.dataToFeedAI,
        },
      });
    }
  };

  const handleEdit = (item: any) => {
    setEditingId(item.id);
    const props = item.properties ? JSON.parse(item.properties) : {};
    setFormData({
      name: item.name || "",
      aiAssistant: props.aiAssistant || "",
      smartFlow: props.smartFlow || "",
      channel: props.channel || "",
      linkText: item.link_text || "",
      payload: item.payload || "",
      savePayloadField: "",
      dataToFeedAI: props.dataToFeedAI || "",
      internalNotes: "",
      images: [],
    });
    setIsCreateFormOpen(true);
  };

  const handleCancel = () => {
    setFormData({
      name: "",
      aiAssistant: "",
      smartFlow: "",
      channel: "",
      linkText: "",
      payload: "",
      savePayloadField: "",
      dataToFeedAI: "",
      internalNotes: "",
      images: [],
    });
    setIsCreateFormOpen(false);
    setEditingId(null);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  const hasItems = items && items.length > 0;
  const headerTitle = isCreateFormOpen ? (editingId ? t("ai_items_section.title_edit") : t("ai_items_section.title_create")) : t("ai_items_section.title_list");
  const headerSub = isCreateFormOpen
    ? editingId
      ? t("ai_items_section.subtitle_update")
      : t("ai_items_section.subtitle_add")
    : t("ai_items_section.subtitle_add");

  return (
    <>
      <Card className={cn("rounded-[2rem] border overflow-hidden shadow-sm transition-all duration-300", card, border)}>
        <CardContent className="p-0">
          {/* Header — dynamic per view */}
          <div className={cn("px-8 py-5 border-b flex items-center justify-between", border)}>
            <div className="flex items-center gap-4">
              <div className={cn("p-2.5 rounded-xl shadow-sm", "bg-primary/10")}>
                <Sparkles className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h1 className={cn("text-[16px] font-bold tracking-tight", text)}>{headerTitle}</h1>
                <p className={cn("text-[11px] font-bold mt-0.5 opacity-60 max-w-2xl", sub)}>{headerSub}</p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {!isCreateFormOpen ? (
                <button onClick={() => setIsCreateFormOpen(true)} className={primaryOutlineBtn}>
                  <Plus size={12} /> {t("ai_items_section.btn_add_item")}
                </button>
              ) : (
                <button onClick={handleCancel} className={outlineBtn}>
                  <ChevronLeft size={12} /> {t("ai_items_section.btn_back")}
                </button>
              )}
            </div>
          </div>

          {/* ── LIST VIEW ── */}
          {!isCreateFormOpen && (
            <div className="p-8">
              {!hasItems ? (
                <div className={cn("rounded-[1.5rem] border py-16 px-8 flex flex-col items-center justify-center text-center space-y-5", softBg, softBorder)}>
                  <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                    <Sparkles className="w-8 h-8 text-primary" />
                  </div>
                  <div className="space-y-1.5 max-w-sm">
                    <h3 className={cn("text-[14px] font-black tracking-tight", text)}>{t("ai_items_section.empty_title")}</h3>
                    <p className={cn("text-[11px] font-medium opacity-60 leading-relaxed", sub)}>
                      {t("ai_items_section.empty_desc")}
                    </p>
                  </div>
                  <button onClick={() => setIsCreateFormOpen(true)} className={primaryOutlineBtn}>
                    <Plus size={12} /> {t("ai_items_section.btn_create_now")}
                  </button>
                </div>
              ) : (
                <div className={cn("rounded-[1.5rem] border overflow-hidden", softBorder, softBg)}>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className={cn("border-b", softBorder, dark ? "bg-slate-900/40" : "bg-white/60")}>
                          <th className={cn("px-6 py-4 text-left text-[11px] font-semibold", sub)}>
                            <div className="flex items-center gap-2">
                              <FileText size={12} /> {t("ai_items_section.col_name")}
                            </div>
                          </th>
                          <th className={cn("px-6 py-4 text-right text-[11px] font-semibold", sub)}>{t("ai_items_section.col_actions")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {items.map((item: any) => (
                          <tr
                            key={item.id}
                            className={cn("border-b transition-colors", softBorder, dark ? "hover:bg-slate-900/40" : "hover:bg-white/80")}
                          >
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                                  <FileText size={14} className="text-primary" />
                                </div>
                                <span className={cn("text-[13px] font-black", text)}>{item.name}</span>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex items-center justify-end gap-2">
                                <button
                                  onClick={() => toast({ title: t("ai_items_section.toast_grid_view_title"), description: t("ai_items_section.toast_grid_view_desc", { name: item.name }) })}
                                  className={cn("w-9 h-9 rounded-lg border flex items-center justify-center transition-all", dark ? "border-slate-800 hover:border-purple-500/40 hover:text-purple-500 text-slate-400" : "border-slate-200 hover:border-purple-500/40 hover:text-purple-500 text-slate-500")}
                                  title={t("ai_items_section.tooltip_grid_view")}
                                >
                                  <Grid3x3 size={13} />
                                </button>
                                <button
                                  onClick={() => toast({ title: t("ai_items_section.toast_link_copied_title"), description: t("ai_items_section.toast_link_copied_desc") })}
                                  className={cn("w-9 h-9 rounded-lg border flex items-center justify-center transition-all", dark ? "border-slate-800 hover:border-cyan-500/40 hover:text-cyan-500 text-slate-400" : "border-slate-200 hover:border-cyan-500/40 hover:text-cyan-500 text-slate-500")}
                                  title={t("ai_items_section.tooltip_link")}
                                >
                                  <LinkIcon size={13} />
                                </button>
                                <button
                                  onClick={() => handleEdit(item)}
                                  className={cn("w-9 h-9 rounded-lg border flex items-center justify-center transition-all", dark ? "border-slate-800 hover:border-primary/40 hover:text-primary text-slate-400" : "border-slate-200 hover:border-primary/40 hover:text-primary text-slate-500")}
                                  title={t("ai_items_section.tooltip_edit")}
                                >
                                  <Edit2 size={13} />
                                </button>
                                <button
                                  onClick={() => { setItemToDelete(item); setShowDeleteConfirm(true); }}
                                  className={cn("w-9 h-9 rounded-lg border flex items-center justify-center transition-all", dark ? "border-slate-800 hover:border-rose-500/40 hover:text-rose-500 text-slate-400" : "border-slate-200 hover:border-rose-500/40 hover:text-rose-500 text-slate-500")}
                                  title={t("ai_items_section.tooltip_delete")}
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

                  <div className={cn("px-6 py-3 border-t text-[11px] font-semibold", softBorder, sub, dark ? "bg-slate-900/40" : "bg-white/60")}>
                    {t("ai_items_section.showing_items", { count: items.length, total: items.length })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── CREATE / EDIT FORM ── */}
          {isCreateFormOpen && (
            <div className="p-8">
              <div className={cn("rounded-[1.5rem] border p-8 space-y-6", softBg, softBorder)}>
                <div className="space-y-6">
                  {/* Name */}
                  <div className="space-y-2">
                    <label className={labelCls}>{t("ai_items_section.label_name")}</label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className={inputCls}
                      placeholder={t("ai_items_section.placeholder_item_name")}
                    />
                  </div>

                  {/* AI Assistant + Smart Flow */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div className="space-y-2">
                      <label className={labelCls}>{t("ai_items_section.label_ai_assistant")}</label>
                      <select
                        value={formData.aiAssistant}
                        onChange={(e) => setFormData({ ...formData, aiAssistant: e.target.value })}
                        className={selectCls}
                      >
                        <option value="">{t("ai_items_section.option_select_assistant")}</option>
                        <option value="assistant1">{t("ai_items_section.option_assistant_1")}</option>
                        <option value="assistant2">{t("ai_items_section.option_assistant_2")}</option>
                      </select>
                    </div>

                    <div className="space-y-2">
                      <label className={labelCls}>{t("ai_items_section.label_smart_flow")}</label>
                      <select
                        value={formData.smartFlow}
                        onChange={(e) => setFormData({ ...formData, smartFlow: e.target.value })}
                        className={selectCls}
                      >
                        <option value="">{t("ai_items_section.option_select_smart_flow")}</option>
                        <option value="flow1">{t("ai_items_section.option_flow_1")}</option>
                        <option value="flow2">{t("ai_items_section.option_flow_2")}</option>
                      </select>
                    </div>
                  </div>

                  {/* Channel + Link text */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div className="space-y-2">
                      <label className={labelCls}>{t("ai_items_section.label_channel")}</label>
                      <select
                        value={formData.channel}
                        onChange={(e) => setFormData({ ...formData, channel: e.target.value })}
                        className={selectCls}
                      >
                        <option value="">{t("ai_items_section.option_select_channel")}</option>
                        <option value="whatsapp">WhatsApp</option>
                        <option value="instagram">Instagram</option>
                      </select>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center gap-1.5">
                        <label className={labelCls}>{t("ai_items_section.label_link_text")}</label>
                        <span className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full bg-primary/10 text-primary">
                          <Info size={9} />
                        </span>
                      </div>
                      <input
                        type="text"
                        value={formData.linkText}
                        onChange={(e) => setFormData({ ...formData, linkText: e.target.value })}
                        className={inputCls}
                        placeholder={t("ai_items_section.placeholder_link_text")}
                      />
                    </div>
                  </div>

                  {/* Payload + Save payload */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div className="space-y-2">
                      <label className={labelCls}>{t("ai_items_section.label_payload")}</label>
                      <input
                        type="text"
                        value={formData.payload}
                        onChange={(e) => setFormData({ ...formData, payload: e.target.value })}
                        className={inputCls}
                        placeholder={t("ai_items_section.placeholder_payload")}
                      />
                    </div>

                    <div className="space-y-2">
                      <label className={labelCls}>{t("ai_items_section.label_save_payload_field")}</label>
                      <select
                        value={formData.savePayloadField}
                        onChange={(e) => setFormData({ ...formData, savePayloadField: e.target.value })}
                        className={selectCls}
                      >
                        <option value="">{t("ai_items_section.option_select")}</option>
                        <option value="field1">{t("ai_items_section.option_field_1")}</option>
                        <option value="field2">{t("ai_items_section.option_field_2")}</option>
                      </select>
                    </div>
                  </div>

                  {/* Tabs */}
                  <div className={cn("border-b pt-2", border)}>
                    <div className="flex gap-6">
                      <button
                        onClick={() => setActiveTab("item-data")}
                        className={cn(
                          "pb-3 text-[11px] font-semibold border-b-2 transition-all",
                          activeTab === "item-data"
                            ? "border-primary text-primary"
                            : cn("border-transparent", sub, "hover:text-primary")
                        )}
                      >
                        {t("ai_items_section.tab_item_data")}
                      </button>
                      <button
                        onClick={() => setActiveTab("internal-notes")}
                        className={cn(
                          "pb-3 text-[11px] font-semibold border-b-2 transition-all",
                          activeTab === "internal-notes"
                            ? "border-primary text-primary"
                            : cn("border-transparent", sub, "hover:text-primary")
                        )}
                      >
                        {t("ai_items_section.tab_internal_notes")}
                      </button>
                    </div>
                  </div>

                  {/* Tab Content */}
                  {activeTab === "item-data" && (
                    <div className="space-y-2">
                      <label className={cn("block text-[11px] font-semibold text-primary")}>
                        {t("ai_items_section.label_data_to_feed_ai")}
                      </label>
                      <textarea
                        value={formData.dataToFeedAI}
                        onChange={(e) => setFormData({ ...formData, dataToFeedAI: e.target.value })}
                        rows={8}
                        className={textareaCls}
                        placeholder={t("ai_items_section.placeholder_data_to_feed_ai")}
                      />
                    </div>
                  )}

                  {activeTab === "internal-notes" && (
                    <div className="space-y-2">
                      <label className={labelCls}>{t("ai_items_section.label_internal_notes")}</label>
                      <textarea
                        value={formData.internalNotes}
                        onChange={(e) => setFormData({ ...formData, internalNotes: e.target.value })}
                        rows={8}
                        className={textareaCls}
                        placeholder={t("ai_items_section.placeholder_internal_notes")}
                      />
                    </div>
                  )}

                  {/* Add images */}
                  <div className="space-y-2">
                    <label className={labelCls}>{t("ai_items_section.label_add_images")}</label>
                    <div className="flex items-center gap-3">
                      <input
                        type="text"
                        placeholder={t("ai_items_section.placeholder_add_link")}
                        className={cn(inputCls, "flex-1")}
                      />
                      <button
                        onClick={() => toast({ title: t("ai_items_section.toast_coming_soon_title"), description: t("ai_items_section.toast_coming_soon_desc") })}
                        className={outlineBtn}
                      >
                        {t("ai_items_section.btn_select_gallery")}
                      </button>
                    </div>
                    <p className="text-[11px] font-medium text-rose-500 opacity-80">
                      {t("ai_items_section.images_hint")}
                    </p>
                  </div>
                </div>

                {/* Footer Actions */}
                <div className={cn("flex justify-end gap-2 pt-6 border-t", softBorder)}>
                  <button onClick={handleCancel} className={outlineBtn}>
                    {t("ai_items_section.btn_cancel")}
                  </button>
                  <button
                    onClick={handlePublish}
                    disabled={!formData.name.trim()}
                    className={primaryBtn}
                  >
                    <Sparkles size={12} /> {editingId ? t("ai_items_section.btn_update") : t("ai_items_section.btn_generate")}
                  </button>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Delete Dialog ── */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent className={cn("rounded-[2rem] border p-0 max-w-md overflow-hidden", card, border)}>
          <div className="p-6 space-y-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-500/10 flex items-center justify-center text-rose-500">
                <AlertCircle size={18} />
              </div>
              <div>
                <h2 className={cn("text-[14px] font-semibold", text)}>{t("ai_items_section.delete_dialog_title")}</h2>
                <p className={cn("text-[11px] font-medium opacity-60 mt-0.5 leading-relaxed", sub)}>
                  <span className="text-rose-500 font-black">{itemToDelete?.name || t("ai_items_section.delete_dialog_item_fallback")}</span> {t("ai_items_section.delete_dialog_desc_suffix")}
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <AlertDialogCancel className={cn(outlineBtn, "m-0")}>{t("ai_items_section.btn_cancel")}</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => { deleteMutation.mutate(itemToDelete.id); setShowDeleteConfirm(false); }}
                className="h-11 px-7 rounded-xl bg-rose-500 hover:bg-rose-600 text-white text-[11px] font-semibold transition-all shadow-lg shadow-rose-500/20 flex items-center gap-2"
              >
                <Trash2 size={12} /> {t("ai_items_section.btn_delete")}
              </AlertDialogAction>
            </div>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
