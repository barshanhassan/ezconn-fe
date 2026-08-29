import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Book,
  Trash2,
  Globe,
  FileText,
  File,
  Loader2,
  Search,
  Plus,
  ChevronLeft,
  Sparkles,
  AlertCircle,
  Upload,
} from "lucide-react";
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
import { getUserInfo, hasAnyPerm } from "@/lib/auth";

const mockFetchedPages = [
  { page: "https://example.com/about",        title: "About Us" },
  { page: "https://example.com/pricing",      title: "Pricing" },
  { page: "https://example.com/contact",      title: "Contact" },
  { page: "https://example.com/blog/post-1",  title: "Blog Post 1" },
  { page: "https://example.com/features",     title: "Features" },
];

export default function AIKnowledgeBaseSection() {
  const { t } = useTranslation();
  const { mode } = useTheme();
  const dark = mode === "dark";
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // "Allow" permissions (replyagent AIStudio/Knowledgebase.vue). replyagent has
  // no edit_kb — create_kb covers create AND edit; delete_kb covers delete.
  // Owners hold `workspace.*` so they pass via the wildcard.
  const _kbPerms = getUserInfo().permissions ?? [];
  const canCreateKB = hasAnyPerm(_kbPerms, ["workspace.ai.create_kb"]);
  const canDeleteKB = hasAnyPerm(_kbPerms, ["workspace.ai.delete_kb"]);

  const [viewMode, setViewMode] = useState<"list" | "edit">("list");

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

  const outlineBtn = cn(
    "h-11 px-6 rounded-xl border text-[11px] font-semibold transition-all flex items-center gap-2",
    dark ? "border-slate-800 text-slate-300 hover:border-primary/40 hover:text-primary" : "border-slate-200 text-slate-700 hover:border-primary/40 hover:text-primary"
  );

  const primaryOutlineBtn = cn(
    "h-10 px-6 rounded-xl border text-[11px] font-semibold transition-all flex items-center gap-2",
    "border-primary text-primary hover:bg-primary hover:text-white"
  );

  const primaryBtn =
    "h-11 px-7 rounded-xl bg-primary hover:bg-primary/90 disabled:opacity-50 text-white text-[11px] font-semibold transition-all shadow-lg shadow-primary/20 flex items-center gap-2";

  const { data: knowledgeBases } = useQuery({
    queryKey: ["/api/ai/knowledge-bases"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/ai/knowledge-bases");
      return res.json();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number | string) => {
      await apiRequest("DELETE", `/api/ai/knowledge-bases/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ai/knowledge-bases"] });
      toast({ title: t("ai_knowledge_base_section.toast_deleted_title"), description: t("ai_knowledge_base_section.toast_deleted_desc") });
    },
    onError: () => {
      toast({ title: t("ai_knowledge_base_section.toast_error_title"), description: t("ai_knowledge_base_section.toast_delete_error_desc"), variant: "destructive" });
    },
  });

  const [formData, setFormData] = useState<any>({
    id: null,
    name: "",
    source_type: "website",
    website: "",
    web_pages: [],
    selected_pages: [],
    files: [],
    website_content: "",
  });

  const [fetching, setFetching] = useState(false);
  const [searchUrl, setSearchUrl] = useState("");
  const [errors, setErrors] = useState<any>({});
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [kbToDelete, setKbToDelete] = useState<any>(null);

  const handleEdit = (kb: any = null) => {
    if (kb) {
      setFormData({
        ...kb,
        website: kb.source_type === "website" ? (kb.url || "") : "",
        web_pages: [],
        selected_pages: [],
        files: [],
        website_content: kb.source_type === "text" ? (kb.content || "") : "",
      });
    } else {
      setFormData({
        id: null,
        name: "",
        source_type: "website",
        website: "",
        web_pages: [],
        selected_pages: [],
        files: [],
        website_content: "",
      });
    }
    setErrors({});
    setViewMode("edit");
  };

  const validateForm = () => {
    const newErrors: any = {};
    if (!formData?.name?.trim()) newErrors.name = t("ai_knowledge_base_section.error_name_required");
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = () => {
    if (!validateForm()) return;
    toast({ title: t("ai_knowledge_base_section.toast_saved_title"), description: t("ai_knowledge_base_section.toast_saved_desc") });
    setViewMode("list");
  };

  const handleFetchPages = () => {
    if (!formData.website) return;
    setFetching(true);
    setTimeout(() => {
      setFetching(false);
      setFormData((prev: any) => ({
        ...prev,
        web_pages: mockFetchedPages,
        selected_pages: [],
      }));
      toast({ title: t("ai_knowledge_base_section.toast_pages_fetched_title"), description: t("ai_knowledge_base_section.toast_pages_fetched_desc", { count: mockFetchedPages.length, site: formData.website }) });
    }, 1500);
  };

  const togglePageSelection = (pageUrl: string) => {
    setFormData((prev: any) => {
      const selected = prev.selected_pages.includes(pageUrl)
        ? prev.selected_pages.filter((p: string) => p !== pageUrl)
        : [...prev.selected_pages, pageUrl];
      return { ...prev, selected_pages: selected };
    });
  };

  const toggleAllPages = (checked: boolean) => {
    setFormData((prev: any) => ({
      ...prev,
      selected_pages: checked ? prev.web_pages.map((p: any) => p.page) : [],
    }));
  };

  const handleAddFile = () => {
    const newFile = { id: Date.now(), object_name: `document_${formData.files.length + 1}.pdf` };
    setFormData((prev: any) => ({ ...prev, files: [...prev.files, newFile] }));
    toast({ title: t("ai_knowledge_base_section.toast_file_added_title"), description: t("ai_knowledge_base_section.toast_file_added_desc", { name: newFile.object_name }) });
  };

  const removeFile = (id: number) => {
    setFormData((prev: any) => ({ ...prev, files: prev.files.filter((f: any) => f.id !== id) }));
    toast({ title: t("ai_knowledge_base_section.toast_file_removed_title"), description: t("ai_knowledge_base_section.toast_file_removed_desc") });
  };

  const confirmDelete = () => {
    if (kbToDelete) {
      deleteMutation.mutate(kbToDelete.id);
      setShowDeleteConfirm(false);
      setKbToDelete(null);
    }
  };

  const filteredPages = formData.web_pages?.filter((p: any) =>
    p.page.toLowerCase().includes(searchUrl.toLowerCase())
  ) || [];

  /* ── EDIT VIEW ── */
  if (viewMode === "edit") {
    return (
      <Card className={cn("rounded-[2rem] border overflow-hidden shadow-sm transition-all duration-300", card, border)}>
        <CardContent className="p-0">
          {/* Header */}
          <div className={cn("px-8 py-5 border-b flex items-center justify-between", border)}>
            <div className="flex items-center gap-4">
              <button
                onClick={() => setViewMode("list")}
                className={cn("w-10 h-10 rounded-xl border flex items-center justify-center transition-all", dark ? "border-slate-800 hover:border-primary/40 hover:text-primary" : "border-slate-200 hover:border-primary/40 hover:text-primary")}
              >
                <ChevronLeft size={16} />
              </button>
              <div className={cn("p-2.5 rounded-xl shadow-sm", dark ? "bg-primary/15" : "bg-primary/10")}>
                <Book className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h1 className={cn("text-[16px] font-bold tracking-tight", text)}>
                  {formData.id ? t("ai_knowledge_base_section.title_edit_kb") : t("ai_knowledge_base_section.title_create_kb")}
                </h1>
                <p className={cn("text-[11px] font-bold mt-0.5 opacity-60", sub)}>
                  {t("ai_knowledge_base_section.subtitle_edit")}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => setViewMode("list")} className={outlineBtn}>{t("ai_knowledge_base_section.btn_cancel")}</button>
              <button onClick={handleSave} className={primaryBtn}>
                <Sparkles size={12} /> {t("ai_knowledge_base_section.btn_publish")}
              </button>
            </div>
          </div>

          <div className="p-8 space-y-6">
            {/* Name */}
            <div className="space-y-2 max-w-md">
              <FieldLabel dark={dark}>{t("ai_knowledge_base_section.label_name")}</FieldLabel>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder={t("ai_knowledge_base_section.placeholder_kb_name")}
                maxLength={250}
                className={cn(inputCls, errors.name && "border-rose-500")}
              />
              {errors.name && <p className="text-[11px] font-bold text-rose-500">{errors.name}</p>}
              <p className={cn("text-[10px] font-bold opacity-50 text-right", sub)}>{formData.name.length}/250</p>
            </div>

            {/* Source Tabs */}
            <Tabs value={formData.source_type} onValueChange={(val) => setFormData({ ...formData, source_type: val })}>
              <TabsList className={cn("inline-flex h-auto p-1 rounded-xl border bg-transparent gap-1", softBorder)}>
                {[
                  { value: "website", label: t("ai_knowledge_base_section.tab_website"), icon: Globe },
                  { value: "pdf",     label: t("ai_knowledge_base_section.tab_pdf"),     icon: File },
                  { value: "text",    label: t("ai_knowledge_base_section.tab_text"),    icon: FileText },
                ].map((tab) => (
                  <TabsTrigger
                    key={tab.value}
                    value={tab.value}
                    className={cn(
                      "h-9 px-5 rounded-lg text-[11px] font-semibold transition-all flex items-center gap-2",
                      "data-[state=active]:!bg-primary data-[state=active]:!text-white data-[state=active]:shadow-md data-[state=active]:shadow-primary/20",
                      dark ? "text-slate-400" : "text-slate-500"
                    )}
                  >
                    <tab.icon size={12} />
                    {tab.label}
                  </TabsTrigger>
                ))}
              </TabsList>

              {/* WEBSITE */}
              <TabsContent value="website" className="mt-6 space-y-5 outline-none">
                <div className="space-y-2">
                  <FieldLabel dark={dark}>{t("ai_knowledge_base_section.label_website_url")}</FieldLabel>
                  <div className="flex gap-2">
                    <div className={cn("flex border rounded-xl overflow-hidden h-11 items-center transition-all flex-1",
                      dark ? "bg-slate-950/50 border-slate-800 focus-within:border-primary/40" : "bg-white border-slate-200 focus-within:border-primary/40")}>
                      <span className={cn("px-3 text-[11px] font-semibold border-r h-full flex items-center",
                        dark ? "text-slate-500 border-slate-800 bg-slate-900/40" : "text-slate-400 border-slate-200 bg-slate-50")}>https://</span>
                      <input
                        value={formData.website}
                        onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                        placeholder={t("ai_knowledge_base_section.placeholder_yoursite")}
                        className={cn("bg-transparent h-full text-[13px] font-bold outline-none px-3 flex-1 min-w-0", text)}
                      />
                    </div>
                    <button
                      onClick={handleFetchPages}
                      disabled={fetching || !formData.website}
                      className={primaryOutlineBtn}
                    >
                      {fetching ? <Loader2 size={12} className="animate-spin" /> : <Globe size={12} />}
                      {fetching ? t("ai_knowledge_base_section.btn_fetching") : t("ai_knowledge_base_section.btn_fetch_pages")}
                    </button>
                  </div>
                </div>

                {formData.web_pages?.length > 0 && (
                  <div className={cn("rounded-[1.5rem] border overflow-hidden", softBorder, softBg)}>
                    {/* Toolbar */}
                    <div className={cn("flex items-center justify-between gap-3 px-5 py-3 border-b flex-wrap", softBorder, dark ? "bg-slate-900/30" : "bg-white/60")}>
                      <div className="flex items-center gap-4 flex-wrap">
                        <div className="flex items-center gap-2">
                          <Checkbox
                            id="select-all"
                            checked={formData.selected_pages.length === formData.web_pages.length && formData.web_pages.length > 0}
                            onCheckedChange={(c) => toggleAllPages(c as boolean)}
                          />
                          <label htmlFor="select-all" className={cn("text-[11px] font-semibold cursor-pointer", text)}>
                            {t("ai_knowledge_base_section.label_select_all")}
                          </label>
                        </div>
                        <div className="relative w-full sm:w-auto">
                          <Search size={11} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                          <Input
                            placeholder={t("ai_knowledge_base_section.placeholder_search_urls")}
                            value={searchUrl}
                            onChange={(e) => setSearchUrl(e.target.value)}
                            className={cn(inputCls, "h-9 pl-8 w-full sm:w-[220px] text-[12px]")}
                          />
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className={cn("h-6 px-2.5 rounded-md text-[10px] font-semibold", dark ? "border-slate-800 bg-slate-900 text-slate-300" : "border-slate-200 bg-white text-slate-600")}>
                          {t("ai_knowledge_base_section.badge_total", { count: formData.web_pages.length })}
                        </Badge>
                        <Badge className="h-6 px-2.5 rounded-md bg-primary/10 text-primary border-primary/20 text-[10px] font-semibold">
                          {t("ai_knowledge_base_section.badge_selected", { count: formData.selected_pages.length })}
                        </Badge>
                      </div>
                    </div>

                    <div className="max-h-[400px] overflow-y-auto">
                      {filteredPages.map((page: any, idx: number) => {
                        const checked = formData.selected_pages.includes(page.page);
                        return (
                          <div
                            key={idx}
                            onClick={() => togglePageSelection(page.page)}
                            className={cn(
                              "flex items-center gap-3 px-5 py-3 border-b last:border-0 cursor-pointer transition-colors",
                              softBorder,
                              checked ? "bg-primary/5" : dark ? "hover:bg-slate-900/40" : "hover:bg-white/60"
                            )}
                          >
                            <Checkbox checked={checked} className="pointer-events-none" />
                            <a
                              href={page.page}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className={cn("text-[12px] font-bold truncate flex-1 hover:underline", checked ? "text-primary" : text)}
                            >
                              {page.page}
                            </a>
                          </div>
                        );
                      })}
                      {filteredPages.length === 0 && (
                        <div className={cn("p-8 text-center text-[11px] font-bold opacity-60", sub)}>
                          {t("ai_knowledge_base_section.no_pages_found")}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </TabsContent>

              {/* PDF */}
              <TabsContent value="pdf" className="mt-6 space-y-5 outline-none">
                <div className="flex items-center justify-between">
                  <FieldLabel dark={dark}>{t("ai_knowledge_base_section.label_assistant_files")}</FieldLabel>
                  <span className={cn("text-[10px] font-bold opacity-60", sub)}>{t("ai_knowledge_base_section.max_files_hint")}</span>
                </div>

                <button
                  type="button"
                  onClick={handleAddFile}
                  className={cn(
                    "w-full h-32 rounded-[1.5rem] border-2 border-dashed transition-all flex flex-col items-center justify-center gap-2 group",
                    "hover:border-primary/50 hover:bg-primary/5",
                    softBorder,
                    softBg
                  )}
                >
                  <div className="p-3 rounded-2xl bg-primary/10 text-primary group-hover:scale-110 transition-transform">
                    <Upload size={18} />
                  </div>
                  <p className="text-[13px] font-semibold text-primary">{t("ai_knowledge_base_section.btn_add_pdf")}</p>
                  <p className={cn("text-[10px] font-medium opacity-60", sub)}>{t("ai_knowledge_base_section.upload_docs_hint")}</p>
                </button>

                {formData.files.length > 0 && (
                  <div className="space-y-2">
                    <FieldLabel dark={dark}>{t("ai_knowledge_base_section.label_attached_files")}</FieldLabel>
                    <div className="space-y-2">
                      {formData.files.map((file: any) => (
                        <div
                          key={file.id}
                          className={cn("flex items-center justify-between p-3 rounded-[1rem] border", softBg, softBorder)}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-9 h-9 rounded-lg bg-rose-500/10 text-rose-500 flex items-center justify-center shrink-0">
                              <FileText size={14} />
                            </div>
                            <span className={cn("text-[12px] font-bold truncate", text)}>{file.object_name}</span>
                          </div>
                          <button
                            onClick={() => removeFile(file.id)}
                            className={cn("w-8 h-8 rounded-lg flex items-center justify-center transition-all shrink-0", dark ? "hover:bg-rose-500/10 hover:text-rose-500 text-slate-400" : "hover:bg-rose-500/10 hover:text-rose-500 text-slate-500")}
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </TabsContent>

              {/* TEXT */}
              <TabsContent value="text" className="mt-6 space-y-2 outline-none">
                <FieldLabel dark={dark}>{t("ai_knowledge_base_section.label_text_content")}</FieldLabel>
                <Textarea
                  value={formData.website_content}
                  onChange={(e) => setFormData({ ...formData, website_content: e.target.value })}
                  rows={12}
                  placeholder={t("ai_knowledge_base_section.placeholder_text_content")}
                  className={cn(
                    "rounded-xl text-[12px] font-mono leading-relaxed resize-none p-4 transition-all",
                    "focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:border-primary/50",
                    dark ? "bg-slate-950/50 border-slate-800 text-white" : "bg-white border-slate-200 text-slate-900"
                  )}
                />
                <p className={cn("text-[10px] font-medium opacity-60", sub)}>
                  {t("ai_knowledge_base_section.text_content_hint")}
                </p>
              </TabsContent>
            </Tabs>
          </div>

          {/* Footer */}
          <div className={cn("px-6 py-4 border-t flex justify-end gap-2", border, softBg)}>
            <button onClick={() => setViewMode("list")} className={outlineBtn}>{t("ai_knowledge_base_section.btn_cancel")}</button>
            <button onClick={handleSave} className={primaryBtn}>
              <Sparkles size={12} /> {t("ai_knowledge_base_section.btn_publish")}
            </button>
          </div>
        </CardContent>
      </Card>
    );
  }

  /* ── LIST VIEW ── */
  return (
    <>
      <Card className={cn("rounded-[2rem] border overflow-hidden shadow-sm transition-all duration-300", card, border)}>
        <CardContent className="p-0">
          {/* Header */}
          <div className={cn("px-8 py-5 border-b flex items-center justify-between gap-4 flex-wrap", border)}>
            <div className="flex items-center gap-4">
              <div className={cn("p-2.5 rounded-xl shadow-sm", dark ? "bg-primary/15" : "bg-primary/10")}>
                <Book className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h1 className={cn("text-[16px] font-bold tracking-tight", text)}>{t("ai_knowledge_base_section.header_title_list")}</h1>
                <p className={cn("text-[11px] font-medium mt-0.5 opacity-60", sub)}>
                  {t("ai_knowledge_base_section.header_subtitle_list")}
                </p>
              </div>
            </div>
            {canCreateKB && (
              <button onClick={() => handleEdit(null)} className={primaryOutlineBtn}>
                <Plus size={12} /> {t("ai_knowledge_base_section.btn_add_kb")}
              </button>
            )}
          </div>

          {/* Body */}
          <div className="p-6">
            {!knowledgeBases || knowledgeBases.length === 0 ? (
              <div className={cn("rounded-[1.5rem] border py-16 px-8 flex flex-col items-center justify-center text-center space-y-5", softBg, softBorder)}>
                <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
                  <Book className="w-8 h-8 text-primary" />
                </div>
                <div className="space-y-1.5 max-w-sm">
                  <h3 className={cn("text-[14px] font-black tracking-tight", text)}>{t("ai_knowledge_base_section.empty_title")}</h3>
                  <p className={cn("text-[11px] font-medium opacity-60 leading-relaxed", sub)}>
                    {t("ai_knowledge_base_section.empty_desc")}
                  </p>
                </div>
              </div>
            ) : (
              <div className={cn("rounded-[1.5rem] border overflow-hidden", softBorder, softBg)}>
                <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className={cn("border-b", softBorder, dark ? "bg-slate-900/30" : "bg-white/60")}>
                      <th className={cn("py-4 px-6 text-left text-[11px] font-semibold", sub)}>{t("ai_knowledge_base_section.col_name")}</th>
                      <th className={cn("py-4 px-6 text-left text-[11px] font-semibold", sub)}>{t("ai_knowledge_base_section.col_status")}</th>
                      <th className={cn("py-4 px-6 text-left text-[11px] font-semibold", sub)}>{t("ai_knowledge_base_section.col_type")}</th>
                      <th className={cn("py-4 px-6 text-right text-[11px] font-semibold", sub)}>{t("ai_knowledge_base_section.col_actions")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {knowledgeBases.map((kb: any) => (
                      <tr
                        key={kb.id}
                        onClick={() => canCreateKB && handleEdit(kb)}
                        className={cn("border-b last:border-0 transition-colors", softBorder, canCreateKB ? "cursor-pointer" : "", dark ? "hover:bg-slate-900/40" : "hover:bg-white/60")}
                      >
                        <td className={cn("py-3 px-6 text-[12px] font-black", text)}>{kb.name}</td>
                        <td className="py-3 px-6">
                          <Badge
                            variant="outline"
                            className={cn(
                              "h-5 px-2 rounded-md text-[10px] font-semibold",
                              kb.status === "PUBLISHED"
                                ? "border-emerald-500/20 bg-emerald-500/5 text-emerald-600 dark:text-emerald-400"
                                : dark ? "border-slate-700 bg-slate-900 text-slate-400" : "border-slate-200 bg-slate-100 text-slate-600"
                            )}
                          >
                            {kb.status}
                          </Badge>
                        </td>
                        <td className="py-3 px-6">
                          <Badge variant="outline" className="h-5 px-2 rounded-md border-primary/20 bg-primary/5 text-primary text-[10px] font-semibold">
                            {kb.source_type}
                          </Badge>
                        </td>
                        <td className="py-3 px-6 text-right" onClick={(e) => e.stopPropagation()}>
                          {canDeleteKB && (
                            <button
                              onClick={() => { setKbToDelete(kb); setShowDeleteConfirm(true); }}
                              className={cn("w-8 h-8 rounded-lg flex items-center justify-center transition-all", dark ? "hover:bg-rose-500/10 hover:text-rose-500 text-slate-400" : "hover:bg-rose-500/10 hover:text-rose-500 text-slate-500")}
                            >
                              <Trash2 size={12} />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Delete Dialog */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent className={cn("rounded-[2rem] border p-0 max-w-md overflow-hidden", card, border)}>
          <div className="p-6 space-y-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-500/10 flex items-center justify-center text-rose-500">
                <AlertCircle size={18} />
              </div>
              <div>
                <h2 className={cn("text-[14px] font-semibold", text)}>{t("ai_knowledge_base_section.delete_dialog_title")}</h2>
                <p className={cn("text-[11px] font-medium opacity-60 mt-0.5 leading-relaxed", sub)}>
                  <span className="text-rose-500 font-black">"{kbToDelete?.name}"</span> {t("ai_knowledge_base_section.delete_dialog_desc_suffix")}
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <AlertDialogCancel className={cn(outlineBtn, "m-0")}>{t("ai_knowledge_base_section.btn_cancel")}</AlertDialogCancel>
              <AlertDialogAction
                onClick={confirmDelete}
                className="h-11 px-7 rounded-xl bg-rose-500 hover:bg-rose-600 text-white text-[11px] font-semibold transition-all shadow-lg shadow-rose-500/20 flex items-center gap-2"
              >
                <Trash2 size={12} /> {t("ai_knowledge_base_section.btn_delete")}
              </AlertDialogAction>
            </div>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

/* ── Helpers ── */
function FieldLabel({ dark, children }: { dark: boolean; children: React.ReactNode }) {
  const sub = dark ? "text-slate-400" : "text-slate-500";
  return (
    <label className={cn("text-[11px] font-semibold pl-1 block", sub)}>{children}</label>
  );
}
