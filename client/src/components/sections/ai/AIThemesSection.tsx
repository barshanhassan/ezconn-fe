import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Sparkles,
  HelpCircle,
  Edit2,
  Trash2,
  FileText,
  Plus,
  ChevronLeft,
  ExternalLink,
  AlertCircle,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { cn } from "@/lib/utils";
import { useTheme } from "@/contexts/ThemeContext";

interface Theme {
  id: string;
  name: string;
  description: string;
  icon: "baserow" | "question";
  badges?: Array<{ text: string; variant: "beta" | "new" }>;
  available: boolean;
}

interface ThemeItem {
  id: string;
  name: string;
}

export default function AIThemesSection() {
  const { t } = useTranslation();
  const { mode } = useTheme();
  const dark = mode === "dark";
  const { toast } = useToast();

  const { isLoading } = useQuery({
    queryKey: ["/api/ai/themes"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/ai/themes");
      return res.json();
    },
  });

  const [selectedTheme, setSelectedTheme] = useState<Theme | null>(null);
  const [isCreateFormOpen, setIsCreateFormOpen] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<ThemeItem | null>(null);

  const [formData, setFormData] = useState({
    name: "",
    subtitle: "",
    smartFlow: "",
    channel: "",
    payload: "",
    spreadsheet: "",
  });

  const [themeItems, setThemeItems] = useState<ThemeItem[]>([
    { id: "1", name: "Baserow theme" },
    { id: "2", name: "imoveis" },
    { id: "3", name: "imoveis_test_jaderson" },
    { id: "4", name: "imveis_tutorial" },
    { id: "5", name: "Cadastro de Veiculos Rent" },
  ]);

  const themes: Theme[] = [
    {
      id: "1",
      name: "Baserow.io",
      description: t("ai_themes_section.theme_baserow_description"),
      icon: "baserow",
      badges: [
        { text: t("ai_themes_section.badge_beta"), variant: "beta" },
        { text: t("ai_themes_section.badge_new"), variant: "new" },
      ],
      available: true,
    },
    {
      id: "2",
      name: t("ai_themes_section.theme_databases_name"),
      description: t("ai_themes_section.theme_databases_description"),
      icon: "question",
      badges: [],
      available: false,
    },
  ];

  // ── Design tokens ─────────────────────────────────────────────
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

  // ── Helpers ──────────────────────────────────────────────────
  const renderIcon = (iconType: string, size: "sm" | "md" = "md") => {
    const sizeCls = size === "sm" ? "w-12 h-12" : "w-16 h-16";
    if (iconType === "baserow") {
      return (
        <div className={cn(sizeCls, "rounded-xl bg-primary/10 flex items-center justify-center shrink-0")}>
          <div className="space-y-1">
            <div className="flex gap-1">
              <div className="w-4 h-1.5 bg-primary/60 rounded-sm"></div>
              <div className="w-4 h-1.5 bg-primary/60 rounded-sm"></div>
            </div>
            <div className="w-9 h-1.5 bg-primary rounded-sm"></div>
            <div className="flex gap-1">
              <div className="w-4 h-1.5 bg-primary/80 rounded-sm"></div>
              <div className="w-1.5 h-1.5 bg-primary/80 rounded-sm"></div>
            </div>
          </div>
        </div>
      );
    }
    return (
      <div className={cn(sizeCls, "rounded-xl bg-slate-500/10 flex items-center justify-center shrink-0 border", border)}>
        <HelpCircle className={cn(size === "sm" ? "w-6 h-6" : "w-8 h-8", sub)} />
      </div>
    );
  };

  const handlePublish = () => {
    if (formData.name.trim()) {
      const newItem: ThemeItem = {
        id: String(themeItems.length + 1),
        name: formData.name,
      };
      setThemeItems([...themeItems, newItem]);
      setFormData({ name: "", subtitle: "", smartFlow: "", channel: "", payload: "", spreadsheet: "" });
      setIsCreateFormOpen(false);
      toast({ title: t("ai_themes_section.toast_created_title"), description: t("ai_themes_section.toast_theme_published_description") });
    }
  };

  const handleCancel = () => {
    setFormData({ name: "", subtitle: "", smartFlow: "", channel: "", payload: "", spreadsheet: "" });
    setIsCreateFormOpen(false);
  };

  const handleDeleteItem = () => {
    if (itemToDelete) {
      setThemeItems(themeItems.filter((i) => i.id !== itemToDelete.id));
      toast({ title: t("ai_themes_section.toast_deleted_title"), description: t("ai_themes_section.toast_theme_removed_description") });
    }
    setShowDeleteConfirm(false);
    setItemToDelete(null);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  // ── Header subtitle/buttons per view ─────────────────────────
  const headerTitle = selectedTheme ? selectedTheme.name : t("ai_themes_section.title");
  const headerSub = isCreateFormOpen
    ? t("ai_themes_section.header_sub_create")
    : selectedTheme
      ? selectedTheme.description
      : t("ai_themes_section.header_sub_default");

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
              {selectedTheme && !isCreateFormOpen && (
                <>
                  <button onClick={() => setIsCreateFormOpen(true)} className={primaryOutlineBtn}>
                    <Plus size={12} /> {t("ai_themes_section.add_new")}
                  </button>
                  <button onClick={() => setSelectedTheme(null)} className={outlineBtn}>
                    <ChevronLeft size={12} /> {t("ai_themes_section.back")}
                  </button>
                </>
              )}
              {selectedTheme && isCreateFormOpen && (
                <button onClick={handleCancel} className={outlineBtn}>
                  <ChevronLeft size={12} /> {t("ai_themes_section.back")}
                </button>
              )}
            </div>
          </div>

          {/* ── DEFAULT: Theme Cards Grid ── */}
          {!selectedTheme && (
            <div className="p-8">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {themes.map((theme) => (
                  <div
                    key={theme.id}
                    className={cn(
                      "p-6 rounded-[1.5rem] border transition-all hover:shadow-md hover:border-primary/40 flex flex-col",
                      softBg,
                      softBorder
                    )}
                  >
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        {renderIcon(theme.icon, "sm")}
                        <h3 className={cn("text-[14px] font-black tracking-tight", text)}>{theme.name}</h3>
                      </div>
                      <a
                        href="#"
                        onClick={(e) => e.preventDefault()}
                        className={cn(
                          "w-8 h-8 rounded-lg flex items-center justify-center transition-all",
                          dark ? "hover:bg-slate-800 text-slate-400 hover:text-primary" : "hover:bg-slate-100 text-slate-500 hover:text-primary"
                        )}
                      >
                        <ExternalLink size={14} />
                      </a>
                    </div>

                    <p className={cn("text-[11px] font-medium opacity-70 leading-relaxed mb-5 flex-1", sub)}>
                      {theme.description}
                    </p>

                    <div className="flex items-center justify-between">
                      <div className="flex gap-1.5">
                        {theme.badges?.map((badge, idx) => (
                          <Badge
                            key={idx}
                            variant="outline"
                            className={cn(
                              "h-5 px-2 rounded-md text-[10px] font-semibold",
                              badge.variant === "beta"
                                ? "border-rose-500/30 bg-rose-500/5 text-rose-600 dark:text-rose-400"
                                : "border-emerald-500/30 bg-emerald-500/5 text-emerald-600 dark:text-emerald-400"
                            )}
                          >
                            {badge.text}
                          </Badge>
                        ))}
                      </div>
                      {theme.available ? (
                        <button onClick={() => setSelectedTheme(theme)} className={primaryOutlineBtn}>
                          {t("ai_themes_section.select")}
                        </button>
                      ) : (
                        <button
                          disabled
                          className={cn(
                            "h-10 px-6 rounded-xl border text-[11px] font-semibold cursor-not-allowed opacity-50",
                            dark ? "border-slate-800 text-slate-500" : "border-slate-200 text-slate-400"
                          )}
                        >
                          {t("ai_themes_section.soon")}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── TABLE VIEW (theme selected, not in create form) ── */}
          {selectedTheme && !isCreateFormOpen && (
            <div className="p-8">
              {themeItems.length === 0 ? (
                <div className={cn("rounded-[1.5rem] border py-16 px-8 flex flex-col items-center justify-center text-center space-y-5", softBg, softBorder)}>
                  <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                    <FileText className="w-8 h-8 text-primary" />
                  </div>
                  <div className="space-y-1.5 max-w-sm">
                    <h3 className={cn("text-[14px] font-black tracking-tight", text)}>{t("ai_themes_section.empty_title")}</h3>
                    <p className={cn("text-[11px] font-medium opacity-60 leading-relaxed", sub)}>
                      {t("ai_themes_section.empty_description")}
                    </p>
                  </div>
                  <button onClick={() => setIsCreateFormOpen(true)} className={primaryOutlineBtn}>
                    <Plus size={12} /> {t("ai_themes_section.create_now")}
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
                              <FileText size={12} /> {t("ai_themes_section.column_name")}
                            </div>
                          </th>
                          <th className={cn("px-6 py-4 text-right text-[11px] font-semibold", sub)}>{t("ai_themes_section.column_actions")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {themeItems.map((item) => (
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
                                  onClick={() => toast({ title: t("ai_themes_section.toast_edit_title"), description: t("ai_themes_section.toast_edit_description") })}
                                  className={cn("w-9 h-9 rounded-lg border flex items-center justify-center transition-all", dark ? "border-slate-800 hover:border-primary/40 hover:text-primary text-slate-400" : "border-slate-200 hover:border-primary/40 hover:text-primary text-slate-500")}
                                  title={t("ai_themes_section.toast_edit_title")}
                                >
                                  <Edit2 size={13} />
                                </button>
                                <button
                                  onClick={() => { setItemToDelete(item); setShowDeleteConfirm(true); }}
                                  className={cn("w-9 h-9 rounded-lg border flex items-center justify-center transition-all", dark ? "border-slate-800 hover:border-rose-500/40 hover:text-rose-500 text-slate-400" : "border-slate-200 hover:border-rose-500/40 hover:text-rose-500 text-slate-500")}
                                  title={t("ai_themes_section.delete")}
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
                    {t("ai_themes_section.showing_count", { count: themeItems.length, total: themeItems.length })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── CREATE FORM VIEW ── */}
          {selectedTheme && isCreateFormOpen && (
            <div className="p-8">
              <div className={cn("rounded-[1.5rem] border p-8 space-y-6", softBg, softBorder)}>
                <div className="max-w-3xl space-y-6">
                  {/* Name */}
                  <div className="space-y-2">
                    <label className={cn("block text-[11px] font-semibold", sub)}>{t("ai_themes_section.field_name")}</label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className={inputCls}
                      placeholder={t("ai_themes_section.placeholder_theme_name")}
                    />
                  </div>

                  {/* Subtitle */}
                  <div className="space-y-2">
                    <label className={cn("block text-[11px] font-semibold", sub)}>{t("ai_themes_section.field_subtitle")}</label>
                    <input
                      type="text"
                      value={formData.subtitle}
                      onChange={(e) => setFormData({ ...formData, subtitle: e.target.value })}
                      className={inputCls}
                      placeholder={t("ai_themes_section.placeholder_subtitle")}
                    />
                  </div>

                  {/* TRIGGER SECTION */}
                  <div className="pt-2 space-y-4">
                    <h3 className="text-[12px] font-semibold text-primary">{t("ai_themes_section.trigger_section")}</h3>

                    <div className="space-y-2">
                      <label className={cn("block text-[11px] font-semibold", sub)}>Smart Flow</label>
                      <select
                        value={formData.smartFlow}
                        onChange={(e) => setFormData({ ...formData, smartFlow: e.target.value })}
                        className={selectCls}
                      >
                        <option value="">{t("ai_themes_section.select_smart_flow")}</option>
                        <option value="flow1">{t("ai_themes_section.flow_1")}</option>
                        <option value="flow2">{t("ai_themes_section.flow_2")}</option>
                      </select>
                    </div>

                    <div className="space-y-2">
                      <label className={cn("block text-[11px] font-semibold", sub)}>{t("ai_themes_section.field_channel")}</label>
                      <select
                        value={formData.channel}
                        onChange={(e) => setFormData({ ...formData, channel: e.target.value })}
                        className={selectCls}
                      >
                        <option value="">{t("ai_themes_section.select_channel")}</option>
                        <option value="whatsapp">WhatsApp</option>
                        <option value="instagram">Instagram</option>
                      </select>
                    </div>

                    <div className="space-y-2">
                      <label className={cn("block text-[11px] font-semibold", sub)}>{t("ai_themes_section.field_payload")}</label>
                      <input
                        type="text"
                        value={formData.payload}
                        onChange={(e) => setFormData({ ...formData, payload: e.target.value })}
                        className={inputCls}
                        placeholder={t("ai_themes_section.placeholder_payload")}
                      />
                    </div>
                  </div>

                  {/* BASEROW.IO SECTION */}
                  <div className="pt-2 space-y-4">
                    <h3 className="text-[12px] font-semibold text-primary">{t("ai_themes_section.baserow_section")}</h3>

                    <div className="space-y-2">
                      <label className={cn("block text-[11px] font-semibold", sub)}>{t("ai_themes_section.field_select_spreadsheet")}</label>
                      <select
                        value={formData.spreadsheet}
                        onChange={(e) => setFormData({ ...formData, spreadsheet: e.target.value })}
                        className={selectCls}
                      >
                        <option value="">{t("ai_themes_section.select_spreadsheet")}</option>
                        <option value="sheet1">{t("ai_themes_section.spreadsheet_1")}</option>
                        <option value="sheet2">{t("ai_themes_section.spreadsheet_2")}</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Footer Actions */}
                <div className={cn("flex justify-end gap-2 pt-6 border-t", softBorder)}>
                  <button onClick={handleCancel} className={outlineBtn}>
                    {t("ai_themes_section.cancel")}
                  </button>
                  <button
                    onClick={handlePublish}
                    disabled={!formData.name.trim()}
                    className={primaryBtn}
                  >
                    <Sparkles size={12} /> {t("ai_themes_section.publish")}
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
                <h2 className={cn("text-[14px] font-semibold", text)}>{t("ai_themes_section.delete_dialog_title")}</h2>
                <p className={cn("text-[11px] font-medium opacity-60 mt-0.5 leading-relaxed", sub)}>
                  <span className="text-rose-500 font-black">{itemToDelete?.name || t("ai_themes_section.this_item")}</span> {t("ai_themes_section.delete_dialog_suffix")}
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <AlertDialogCancel className={cn(outlineBtn, "m-0")}>{t("ai_themes_section.cancel")}</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDeleteItem}
                className="h-11 px-7 rounded-xl bg-rose-500 hover:bg-rose-600 text-white text-[11px] font-semibold transition-all shadow-lg shadow-rose-500/20 flex items-center gap-2"
              >
                <Trash2 size={12} /> {t("ai_themes_section.delete")}
              </AlertDialogAction>
            </div>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
