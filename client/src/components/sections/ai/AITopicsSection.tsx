import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Sparkles,
  Edit2,
  Trash2,
  FileText,
  Plus,
  ChevronLeft,
  AlertCircle,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { useTheme } from "@/contexts/ThemeContext";

interface Topic {
  id: string;
  name: string;
}

export default function AITopicsSection() {
  const { mode } = useTheme();
  const dark = mode === "dark";
  const { toast } = useToast();
  const { t } = useTranslation();

  const [topics, setTopics] = useState<Topic[]>([]);
  const [isCreateFormOpen, setIsCreateFormOpen] = useState(false);
  const [editingTopicId, setEditingTopicId] = useState<string | null>(null);
  const [formData, setFormData] = useState({ name: "" });
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [topicToDelete, setTopicToDelete] = useState<Topic | null>(null);

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

  const handlePublish = () => {
    if (formData.name.trim()) {
      if (editingTopicId) {
        setTopics(topics.map((t) => (t.id === editingTopicId ? { ...t, name: formData.name } : t)));
        toast({ title: t("ai_topics_section.updated"), description: t("ai_topics_section.updated_description") });
      } else {
        setTopics([...topics, { id: String(Date.now()), name: formData.name }]);
        toast({ title: t("ai_topics_section.created"), description: t("ai_topics_section.created_description") });
      }
      setFormData({ name: "" });
      setIsCreateFormOpen(false);
      setEditingTopicId(null);
    }
  };

  const handleEditTopic = (topic: Topic) => {
    setEditingTopicId(topic.id);
    setFormData({ name: topic.name });
    setIsCreateFormOpen(true);
  };

  const handleCancel = () => {
    setFormData({ name: "" });
    setIsCreateFormOpen(false);
    setEditingTopicId(null);
  };

  const handleDeleteTopic = () => {
    if (topicToDelete) {
      setTopics(topics.filter((t) => t.id !== topicToDelete.id));
      toast({ title: t("ai_topics_section.deleted"), description: t("ai_topics_section.deleted_description") });
    }
    setShowDeleteConfirm(false);
    setTopicToDelete(null);
  };

  const hasTopics = topics.length > 0;
  const headerTitle = isCreateFormOpen
    ? editingTopicId
      ? t("ai_topics_section.edit_topic")
      : t("ai_topics_section.add_topic")
    : t("ai_topics_section.ai_topics");
  const headerSub = isCreateFormOpen
    ? editingTopicId
      ? t("ai_topics_section.update_your_topic")
      : t("ai_topics_section.create_new_topic")
    : t("ai_topics_section.manage_topics");

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
                  <Plus size={12} /> {t("ai_topics_section.add_topic")}
                </button>
              ) : (
                <button onClick={handleCancel} className={outlineBtn}>
                  <ChevronLeft size={12} /> {t("ai_topics_section.back")}
                </button>
              )}
            </div>
          </div>

          {/* ── LIST VIEW ── */}
          {!isCreateFormOpen && (
            <div className="p-8">
              {!hasTopics ? (
                <div className={cn("rounded-[1.5rem] border py-16 px-8 flex flex-col items-center justify-center text-center space-y-5", softBg, softBorder)}>
                  <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                    <Sparkles className="w-8 h-8 text-primary" />
                  </div>
                  <div className="space-y-1.5 max-w-sm">
                    <h3 className={cn("text-[14px] font-black tracking-tight", text)}>{t("ai_topics_section.no_topic_found")}</h3>
                    <p className={cn("text-[11px] font-medium opacity-60 leading-relaxed", sub)}>
                      {t("ai_topics_section.no_topic_description")}
                    </p>
                  </div>
                  <button onClick={() => setIsCreateFormOpen(true)} className={primaryOutlineBtn}>
                    <Plus size={12} /> {t("ai_topics_section.add_topic")}
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
                              <FileText size={12} /> {t("ai_topics_section.name")}
                            </div>
                          </th>
                          <th className={cn("px-6 py-4 text-right text-[11px] font-semibold", sub)}>{t("ai_topics_section.actions")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {topics.map((topic) => (
                          <tr
                            key={topic.id}
                            className={cn("border-b transition-colors", softBorder, dark ? "hover:bg-slate-900/40" : "hover:bg-white/80")}
                          >
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                                  <FileText size={14} className="text-primary" />
                                </div>
                                <span className={cn("text-[13px] font-black", text)}>{topic.name}</span>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex items-center justify-end gap-2">
                                <button
                                  onClick={() => handleEditTopic(topic)}
                                  className={cn("w-9 h-9 rounded-lg border flex items-center justify-center transition-all", dark ? "border-slate-800 hover:border-primary/40 hover:text-primary text-slate-400" : "border-slate-200 hover:border-primary/40 hover:text-primary text-slate-500")}
                                  title={t("ai_topics_section.edit")}
                                >
                                  <Edit2 size={13} />
                                </button>
                                <button
                                  onClick={() => { setTopicToDelete(topic); setShowDeleteConfirm(true); }}
                                  className={cn("w-9 h-9 rounded-lg border flex items-center justify-center transition-all", dark ? "border-slate-800 hover:border-rose-500/40 hover:text-rose-500 text-slate-400" : "border-slate-200 hover:border-rose-500/40 hover:text-rose-500 text-slate-500")}
                                  title={t("ai_topics_section.delete")}
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
                    {t("ai_topics_section.showing_count", { count: topics.length })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── CREATE / EDIT FORM ── */}
          {isCreateFormOpen && (
            <div className="p-8">
              <div className={cn("rounded-[1.5rem] border p-8 space-y-6", softBg, softBorder)}>
                <div className="max-w-2xl space-y-6">
                  <div className="space-y-2">
                    <label className={labelCls}>{t("ai_topics_section.topic_name")}</label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className={inputCls}
                      placeholder={t("ai_topics_section.topic_name_placeholder")}
                    />
                  </div>
                </div>

                {/* Footer Actions */}
                <div className={cn("flex justify-end gap-2 pt-6 border-t", softBorder)}>
                  <button onClick={handleCancel} className={outlineBtn}>
                    {t("ai_topics_section.cancel")}
                  </button>
                  <button
                    onClick={handlePublish}
                    disabled={!formData.name.trim()}
                    className={primaryBtn}
                  >
                    <Sparkles size={12} /> {editingTopicId ? t("ai_topics_section.update_topic") : t("ai_topics_section.add_topic")}
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
                <h2 className={cn("text-[14px] font-semibold", text)}>{t("ai_topics_section.delete_dialog_title")}</h2>
                <p className={cn("text-[11px] font-medium opacity-60 mt-0.5 leading-relaxed", sub)}>
                  <span className="text-rose-500 font-black">{topicToDelete?.name || t("ai_topics_section.this_topic")}</span> {t("ai_topics_section.delete_dialog_description")}
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <AlertDialogCancel className={cn(outlineBtn, "m-0")}>{t("ai_topics_section.cancel")}</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDeleteTopic}
                className="h-11 px-7 rounded-xl bg-rose-500 hover:bg-rose-600 text-white text-[11px] font-semibold transition-all shadow-lg shadow-rose-500/20 flex items-center gap-2"
              >
                <Trash2 size={12} /> {t("ai_topics_section.delete")}
              </AlertDialogAction>
            </div>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
