import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  FileText,
  Edit2,
  Play,
  History,
  Download,
  Trash2,
  Sparkles,
  Plus,
  ChevronLeft,
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
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { useTheme } from "@/contexts/ThemeContext";

export default function AIReportBuilderSection() {
  const { t } = useTranslation();
  const { mode } = useTheme();
  const dark = mode === "dark";
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isCreateFormOpen, setIsCreateFormOpen] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [reportToDelete, setReportToDelete] = useState<any>(null);

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

  const { data: reports, isLoading } = useQuery({
    queryKey: ["/api/ai/reports"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/ai/reports");
      return res.json();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number | string) => {
      await apiRequest("DELETE", `/api/ai/reports/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ai/reports"] });
      toast({ title: t("ai_report_builder_section.toast_deleted_title"), description: t("ai_report_builder_section.toast_deleted_description") });
    },
    onError: () => {
      toast({ title: t("ai_report_builder_section.toast_error_title"), description: t("ai_report_builder_section.toast_delete_error_description"), variant: "destructive" });
    },
  });

  const [formData, setFormData] = useState({
    name: "",
    reportType: "Text type",
    llmModel: "gpt-4o-mini",
    prompt: "",
  });

  const handlePublish = () => {
    if (formData.name.trim() && formData.prompt.trim()) {
      toast({ title: t("ai_report_builder_section.toast_info_title"), description: t("ai_report_builder_section.toast_not_implemented_description") });
      setIsCreateFormOpen(false);
    }
  };

  const handleCancel = () => {
    setFormData({ name: "", reportType: "Text type", llmModel: "gpt-4o-mini", prompt: "" });
    setIsCreateFormOpen(false);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  const hasReports = reports && reports.length > 0;

  return (
    <>
      <Card className={cn("rounded-[2rem] border overflow-hidden shadow-sm transition-all duration-300", card, border)}>
        <CardContent className="p-0">
          {/* Header — dynamic per view */}
          <div className={cn("px-8 py-5 border-b flex items-center justify-between", border)}>
            <div className="flex items-center gap-4">
              <div className={cn("p-2.5 rounded-xl shadow-sm", "bg-primary/10")}>
                <FileText className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h1 className={cn("text-[16px] font-bold tracking-tight", text)}>{t("ai_report_builder_section.title")}</h1>
                <p className={cn("text-[11px] font-bold mt-0.5 opacity-60 max-w-2xl", sub)}>
                  {t("ai_report_builder_section.subtitle")}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {!isCreateFormOpen ? (
                <button onClick={() => setIsCreateFormOpen(true)} className={primaryOutlineBtn}>
                  <Plus size={12} /> {t("ai_report_builder_section.add_new")}
                </button>
              ) : (
                <button onClick={handleCancel} className={outlineBtn}>
                  <ChevronLeft size={12} /> {t("ai_report_builder_section.back")}
                </button>
              )}
            </div>
          </div>

          {/* ── LIST VIEW ── */}
          {!isCreateFormOpen && (
            <div className="p-8">
              {!hasReports ? (
                <div className={cn("rounded-[1.5rem] border py-16 px-8 flex flex-col items-center justify-center text-center space-y-5", softBg, softBorder)}>
                  <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                    <FileText className="w-8 h-8 text-primary" />
                  </div>
                  <div className="space-y-1.5 max-w-sm">
                    <h3 className={cn("text-[14px] font-black tracking-tight", text)}>{t("ai_report_builder_section.empty_title")}</h3>
                    <p className={cn("text-[11px] font-medium opacity-60 leading-relaxed", sub)}>
                      {t("ai_report_builder_section.empty_description")}
                    </p>
                  </div>
                </div>
              ) : (
                <div className={cn("rounded-[1.5rem] border overflow-hidden", softBorder, softBg)}>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className={cn("border-b", softBorder, dark ? "bg-slate-900/40" : "bg-white/60")}>
                          <th className={cn("px-6 py-4 text-left text-[11px] font-semibold", sub)}>
                            <div className="flex items-center gap-2">
                              <FileText size={12} /> {t("ai_report_builder_section.column_name")}
                            </div>
                          </th>
                          <th className={cn("px-6 py-4 text-left text-[11px] font-semibold", sub)}>{t("ai_report_builder_section.column_type")}</th>
                          <th className={cn("px-6 py-4 text-left text-[11px] font-semibold", sub)}>{t("ai_report_builder_section.column_last_run")}</th>
                          <th className={cn("px-6 py-4 text-right text-[11px] font-semibold", sub)}>{t("ai_report_builder_section.column_actions")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {reports.map((report: any) => (
                          <tr
                            key={report.id}
                            className={cn("border-b transition-colors", softBorder, dark ? "hover:bg-slate-900/40" : "hover:bg-white/80")}
                          >
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                                  <FileText size={14} className="text-primary" />
                                </div>
                                <span className={cn("text-[13px] font-black", text)}>{report.name}</span>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <Badge variant="outline" className="h-5 px-2 rounded-md border-primary/20 bg-primary/5 text-primary text-[10px] font-semibold">
                                {report.type}
                              </Badge>
                            </td>
                            <td className={cn("px-6 py-4 text-[12px] font-bold", sub)}>
                              {report.lastRun || "—"}
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex items-center justify-end gap-2">
                                <button
                                  onClick={() => toast({ title: t("ai_report_builder_section.toast_edit_title"), description: t("ai_report_builder_section.toast_edit_description") })}
                                  className={cn("w-9 h-9 rounded-lg border flex items-center justify-center transition-all", dark ? "border-slate-800 hover:border-primary/40 hover:text-primary text-slate-400" : "border-slate-200 hover:border-primary/40 hover:text-primary text-slate-500")}
                                  title={t("ai_report_builder_section.toast_edit_title")}
                                >
                                  <Edit2 size={13} />
                                </button>
                                <button
                                  onClick={() => toast({ title: t("ai_report_builder_section.toast_run_title"), description: t("ai_report_builder_section.toast_run_description") })}
                                  className={cn("w-9 h-9 rounded-lg border flex items-center justify-center transition-all", dark ? "border-slate-800 hover:border-emerald-500/40 hover:text-emerald-500 text-slate-400" : "border-slate-200 hover:border-emerald-500/40 hover:text-emerald-500 text-slate-500")}
                                  title={t("ai_report_builder_section.toast_run_title")}
                                >
                                  <Play size={13} />
                                </button>
                                {report.lastRun && (
                                  <>
                                    <button
                                      onClick={() => toast({ title: t("ai_report_builder_section.toast_history_title"), description: t("ai_report_builder_section.toast_history_description") })}
                                      className={cn("w-9 h-9 rounded-lg border flex items-center justify-center transition-all", dark ? "border-slate-800 hover:border-slate-500/40 hover:text-slate-300 text-slate-400" : "border-slate-200 hover:border-slate-500/40 hover:text-slate-700 text-slate-500")}
                                      title={t("ai_report_builder_section.toast_history_title")}
                                    >
                                      <History size={13} />
                                    </button>
                                    <button
                                      onClick={() => toast({ title: t("ai_report_builder_section.toast_download_title"), description: t("ai_report_builder_section.toast_download_description") })}
                                      className={cn("w-9 h-9 rounded-lg border flex items-center justify-center transition-all", dark ? "border-slate-800 hover:border-purple-500/40 hover:text-purple-500 text-slate-400" : "border-slate-200 hover:border-purple-500/40 hover:text-purple-500 text-slate-500")}
                                      title={t("ai_report_builder_section.toast_download_title")}
                                    >
                                      <Download size={13} />
                                    </button>
                                  </>
                                )}
                                <button
                                  onClick={() => { setReportToDelete(report); setShowDeleteConfirm(true); }}
                                  className={cn("w-9 h-9 rounded-lg border flex items-center justify-center transition-all", dark ? "border-slate-800 hover:border-rose-500/40 hover:text-rose-500 text-slate-400" : "border-slate-200 hover:border-rose-500/40 hover:text-rose-500 text-slate-500")}
                                  title={t("ai_report_builder_section.delete")}
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
                    {t("ai_report_builder_section.showing_count", { count: reports.length, total: reports.length })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── CREATE FORM VIEW ── */}
          {isCreateFormOpen && (
            <div className="p-8">
              <div className={cn("rounded-[1.5rem] border p-8 space-y-6", softBg, softBorder)}>
                <div className="max-w-3xl space-y-6">
                  {/* Name */}
                  <div className="space-y-2">
                    <label className={cn("block text-[11px] font-semibold", sub)}>{t("ai_report_builder_section.field_name")}</label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className={inputCls}
                      placeholder={t("ai_report_builder_section.placeholder_name")}
                    />
                  </div>

                  {/* Report Type */}
                  <div className="space-y-2">
                    <label className={cn("block text-[11px] font-semibold", sub)}>{t("ai_report_builder_section.field_report_type")}</label>
                    <select
                      value={formData.reportType}
                      onChange={(e) => setFormData({ ...formData, reportType: e.target.value })}
                      className={selectCls}
                    >
                      <option value="Text type">{t("ai_report_builder_section.option_text_type")}</option>
                      <option value="Graph type">{t("ai_report_builder_section.option_graph_type")}</option>
                    </select>
                  </div>

                  {/* LLM Model */}
                  <div className="space-y-2">
                    <label className={cn("block text-[11px] font-semibold", sub)}>{t("ai_report_builder_section.field_llm_model")}</label>
                    <select
                      value={formData.llmModel}
                      onChange={(e) => setFormData({ ...formData, llmModel: e.target.value })}
                      className={selectCls}
                    >
                      <option value="gpt-4o-mini">gpt-4o-mini</option>
                      <option value="gpt-4o">gpt-4o</option>
                      <option value="gpt-4-turbo">gpt-4-turbo</option>
                      <option value="gpt-3.5-turbo">gpt-3.5-turbo</option>
                    </select>
                  </div>

                  {/* Prompt */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className={cn("block text-[11px] font-semibold", sub)}>{t("ai_report_builder_section.field_prompt")}</label>
                      <button
                        onClick={() => toast({ title: t("ai_report_builder_section.toast_ai_title"), description: t("ai_report_builder_section.toast_ai_description") })}
                        className={cn("w-9 h-9 rounded-lg border flex items-center justify-center transition-all", "border-primary/30 text-primary hover:bg-primary hover:text-white")}
                        title={t("ai_report_builder_section.ai_suggest")}
                      >
                        <Sparkles size={14} />
                      </button>
                    </div>
                    <textarea
                      value={formData.prompt}
                      onChange={(e) => setFormData({ ...formData, prompt: e.target.value })}
                      className={textareaCls}
                      rows={10}
                      placeholder={t("ai_report_builder_section.placeholder_prompt")}
                    />
                    <p className={cn("text-[11px] font-medium opacity-60", sub)}>
                      {t("ai_report_builder_section.pdf_hint")}
                    </p>
                  </div>
                </div>

                {/* Footer Actions */}
                <div className={cn("flex justify-end gap-2 pt-6 border-t", softBorder)}>
                  <button onClick={handleCancel} className={outlineBtn}>
                    {t("ai_report_builder_section.cancel")}
                  </button>
                  <button
                    onClick={handlePublish}
                    disabled={!formData.name.trim() || !formData.prompt.trim()}
                    className={primaryBtn}
                  >
                    <Sparkles size={12} /> {t("ai_report_builder_section.publish")}
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
                <h2 className={cn("text-[14px] font-semibold", text)}>{t("ai_report_builder_section.delete_dialog_title")}</h2>
                <p className={cn("text-[11px] font-medium opacity-60 mt-0.5 leading-relaxed", sub)}>
                  <span className="text-rose-500 font-black">{reportToDelete?.name || t("ai_report_builder_section.this_report")}</span> {t("ai_report_builder_section.delete_dialog_suffix")}
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <AlertDialogCancel className={cn(outlineBtn, "m-0")}>{t("ai_report_builder_section.cancel")}</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => { deleteMutation.mutate(reportToDelete.id); setShowDeleteConfirm(false); }}
                className="h-11 px-7 rounded-xl bg-rose-500 hover:bg-rose-600 text-white text-[11px] font-semibold transition-all shadow-lg shadow-rose-500/20 flex items-center gap-2"
              >
                <Trash2 size={12} /> {t("ai_report_builder_section.delete")}
              </AlertDialogAction>
            </div>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
