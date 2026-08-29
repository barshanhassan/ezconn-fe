import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Bot,
  MoreVertical,
  Pencil,
  FileText,
  Trash2,
  Plug,
  ChevronLeft,
  User,
  Settings,
  Globe,
  Sparkles,
  Info,
  RotateCcw,
  Zap,
  Plus,
  AlertCircle,
  Upload,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
} from "@/components/ui/alert-dialog";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { cn } from "@/lib/utils";
import { useTheme } from "@/contexts/ThemeContext";
import { getUserInfo, hasAnyPerm } from "@/lib/auth";

const gptModels = [
  { name: "gpt-4o",        value: "gpt-4o" },
  { name: "gpt-4-turbo",   value: "gpt-4-turbo" },
  { name: "gpt-3.5-turbo", value: "gpt-3.5-turbo" },
];

export default function AIChatAssistantsSection() {
  const { t } = useTranslation();
  const { mode } = useTheme();
  const dark = mode === "dark";
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // AI Feeder modal — the agent whose feeder binding is being created (null = closed).
  const [feederAgent, setFeederAgent] = useState<any | null>(null);

  // "Allow" permissions (replyagent $can on the knowledgebase / AI-assistant
  // screen). Owners hold `workspace.*` so they pass via the wildcard.
  const _aiPerms = getUserInfo().permissions ?? [];
  const canCreateKB = hasAnyPerm(_aiPerms, ["workspace.ai.create_knowledgebase"]);
  const canEditKB = hasAnyPerm(_aiPerms, ["workspace.ai.edit_knowledgebase"]);
  const canDeleteKB = hasAnyPerm(_aiPerms, ["workspace.ai.delete_knowledgebase"]);
  // AI Feeder access (replyagent $canAny over the feeder permissions).
  const canManageFeeder = hasAnyPerm(_aiPerms, [
    "workspace.ai.create_feeder",
    "workspace.ai.edit_feeder",
    "workspace.ai.delete_feeder",
  ]);

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

  const { data: agentsData, isLoading } = useQuery({
    queryKey: ["/api/ai/agents"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/ai/agents");
      return res.json();
    },
  });

  const agents = agentsData?.agents || [];
  const totalActive = agentsData?.total_active || 0;
  const limit = 15;

  const deleteMutation = useMutation({
    mutationFn: async (id: number | string) => {
      await apiRequest("DELETE", `/api/ai/agents/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ai/agents"] });
      toast({ title: t("ai_chat_assistants_section.delete_success_title"), description: t("ai_chat_assistants_section.delete_success_description") });
    },
    onError: () => {
      toast({ title: t("ai_chat_assistants_section.error_title"), description: t("ai_chat_assistants_section.delete_error_description"), variant: "destructive" });
    },
  });

  const statusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      await apiRequest("PATCH", `/api/ai/agents/${id}/status`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ai/agents"] });
    },
  });

  const [selectedAgent, setSelectedAgent] = useState<any>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [agentToDelete, setAgentToDelete] = useState<any>(null);

  const [activeTab, setActiveTab] = useState<"personality" | "configurations" | "knowledge" | "functions">("personality");
  const [formData, setFormData] = useState({
    name: "",
    instructions: "",
    model: "gpt-4o",
    prompt_strategy: "fixed",
    creativity: 1.0,
    diversity: 0.5,
    max_chunk_size_tokens: 1000,
    chunk_overlap_tokens: 200,
    response_tokens: 1000,
    history_limit: 10,
    source_type: "pdf",
  });

  const handleEdit = (agent: any) => {
    setSelectedAgent(agent);
    if (agent) {
      setFormData({
        ...formData,
        name: agent.name,
        model: agent.model,
        instructions: agent.instructions || "",
        prompt_strategy: agent.prompt_strategy || "fixed",
        creativity: agent.creativity || 1.0,
        diversity: agent.diversity || 0.5,
      });
    } else {
      setFormData({
        name: "",
        instructions: "",
        model: "gpt-4o",
        prompt_strategy: "fixed",
        creativity: 1.0,
        diversity: 0.5,
        max_chunk_size_tokens: 1000,
        chunk_overlap_tokens: 200,
        response_tokens: 1000,
        history_limit: 10,
        source_type: "pdf",
      });
    }
    setActiveTab("personality");
    setViewMode("edit");
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.name.trim()) {
      try {
        if (selectedAgent) {
          await apiRequest("POST", `/api/ai/agents/${selectedAgent.id}/update`, formData);
          toast({ title: t("ai_chat_assistants_section.save_success_title"), description: t("ai_chat_assistants_section.update_success_description") });
        } else {
          await apiRequest("POST", "/api/ai/agents/create", formData);
          toast({ title: t("ai_chat_assistants_section.save_success_title"), description: t("ai_chat_assistants_section.create_success_description") });
        }
        queryClient.invalidateQueries({ queryKey: ["/api/ai/agents"] });
        setViewMode("list");
      } catch {
        toast({ title: t("ai_chat_assistants_section.error_title"), description: t("ai_chat_assistants_section.save_error_description"), variant: "destructive" });
      }
    }
  };

  const handleStatusToggle = (id: number, currentStatus: string) => {
    const newStatus = currentStatus === "ACTIVE" ? "PAUSED" : "ACTIVE";
    statusMutation.mutate({ id, status: newStatus });
  };

  const confirmDeleteAgent = () => {
    if (agentToDelete) {
      deleteMutation.mutate(agentToDelete.id);
      setShowDeleteConfirm(false);
      setAgentToDelete(null);
    }
  };

  if (isLoading && viewMode === "list") {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  /* ── EDIT VIEW ── */
  if (viewMode === "edit") {
    return (
      <form onSubmit={handleSave}>
        <Card className={cn("rounded-[2rem] border overflow-hidden shadow-sm transition-all duration-300", card, border)}>
          <CardContent className="p-0">
            {/* Header */}
            <div className={cn("px-8 py-5 border-b flex items-center justify-between", border)}>
              <div className="flex items-center gap-4">
                <button
                  type="button"
                  onClick={() => setViewMode("list")}
                  className={cn("w-10 h-10 rounded-xl border flex items-center justify-center transition-all", dark ? "border-slate-800 hover:border-primary/40 hover:text-primary" : "border-slate-200 hover:border-primary/40 hover:text-primary")}
                >
                  <ChevronLeft size={16} />
                </button>
                <div className={cn("p-2.5 rounded-xl shadow-sm", dark ? "bg-primary/15" : "bg-primary/10")}>
                  <Bot className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h1 className={cn("text-[16px] font-bold tracking-tight", text)}>
                    {selectedAgent ? t("ai_chat_assistants_section.edit_title") : t("ai_chat_assistants_section.create_title")}
                  </h1>
                  <p className={cn("text-[11px] font-bold mt-0.5 opacity-60", sub)}>
                    {t("ai_chat_assistants_section.edit_subtitle")}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => setViewMode("list")} className={outlineBtn}>
                  {t("ai_chat_assistants_section.cancel")}
                </button>
                <button type="submit" className={primaryBtn}>
                  <Sparkles size={12} /> {t("ai_chat_assistants_section.publish")}
                </button>
              </div>
            </div>

            {/* Tabs */}
            <Tabs value={activeTab} onValueChange={(v: any) => setActiveTab(v)}>
              <div className={cn("px-8 border-b flex justify-start overflow-x-auto", softBorder)}>
                <TabsList className="h-auto p-0 gap-8 bg-transparent border-none flex justify-start rounded-none">
                  {[
                    { value: "personality",    label: t("ai_chat_assistants_section.tab_personality"),    icon: User },
                    { value: "configurations", label: t("ai_chat_assistants_section.tab_configurations"), icon: Settings },
                    { value: "knowledge",      label: t("ai_chat_assistants_section.tab_knowledge"),     icon: Globe },
                    { value: "functions",      label: t("ai_chat_assistants_section.tab_functions"),      icon: Sparkles },
                  ].map((tab) => (
                    <TabsTrigger
                      key={tab.value}
                      value={tab.value}
                      className={cn(
                        "flex items-center gap-2 px-1 py-5 rounded-none text-[12px] font-semibold transition-all shadow-none bg-transparent border-b-2 border-transparent",
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

              {/* ── Personality ── */}
              <TabsContent value="personality" className="p-8 outline-none">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                  <div className="md:col-span-2 space-y-5">
                    <div className="space-y-2">
                      <FieldLabel dark={dark}>{t("ai_chat_assistants_section.field_assistant_name")}</FieldLabel>
                      <Input
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        placeholder={t("ai_chat_assistants_section.placeholder_assistant_name")}
                        maxLength={250}
                        className={inputCls}
                      />
                      <p className={cn("text-[10px] font-bold opacity-50 text-right", sub)}>{formData.name.length}/250</p>
                    </div>
                    <div className="space-y-2">
                      <FieldLabel dark={dark}>{t("ai_chat_assistants_section.field_instructions")}</FieldLabel>
                      <Textarea
                        rows={12}
                        value={formData.instructions}
                        onChange={(e) => setFormData({ ...formData, instructions: e.target.value })}
                        placeholder={t("ai_chat_assistants_section.placeholder_instructions")}
                        className={cn(
                          "rounded-xl text-[13px] font-medium leading-relaxed resize-none p-4 transition-all",
                          "focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:border-primary/50",
                          dark ? "bg-slate-950/50 border-slate-800 text-white" : "bg-white border-slate-200 text-slate-900"
                        )}
                      />
                      <p className={cn("text-[10px] font-bold opacity-50 text-right", sub)}>{formData.instructions.length}/100000</p>
                    </div>
                  </div>

                  <div className="space-y-6">
                    <div className="space-y-2">
                      <FieldLabel dark={dark}>{t("ai_chat_assistants_section.select_model")}</FieldLabel>
                      <Select value={formData.model} onValueChange={(val) => setFormData({ ...formData, model: val })}>
                        <SelectTrigger className={inputCls}>
                          <SelectValue placeholder={t("ai_chat_assistants_section.select_model")} />
                        </SelectTrigger>
                        <SelectContent className={cn("rounded-xl border shadow-2xl", dark ? "bg-[#0f1829] border-slate-800 text-white" : "bg-white border-slate-200")}>
                          {gptModels.map((m) => (
                            <SelectItem key={m.value} value={m.value} className="text-[12px] font-bold">{m.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <FieldLabel dark={dark}>{t("ai_chat_assistants_section.field_model_strategy")}</FieldLabel>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {([
                          { v: "fixed",   label: t("ai_chat_assistants_section.strategy_fixed_label"),   desc: t("ai_chat_assistants_section.strategy_fixed_desc"), icon: <RotateCcw size={16} /> },
                          { v: "dynamic", label: t("ai_chat_assistants_section.strategy_dynamic_label"), desc: t("ai_chat_assistants_section.strategy_dynamic_desc"),       icon: <Sparkles size={16} /> },
                        ] as const).map((opt) => {
                          const active = formData.prompt_strategy === opt.v;
                          return (
                            <button
                              key={opt.v}
                              type="button"
                              onClick={() => setFormData({ ...formData, prompt_strategy: opt.v })}
                              className={cn(
                                "p-3 rounded-[1rem] border text-left transition-all",
                                active
                                  ? "border-primary/50 bg-primary/5 shadow-md shadow-primary/10"
                                  : cn(softBorder, softBg, "hover:border-primary/30")
                              )}
                            >
                              <div className={cn(
                                "w-8 h-8 rounded-lg flex items-center justify-center mb-2 transition-all",
                                active ? "bg-primary text-white shadow-lg shadow-primary/30" : "bg-primary/10 text-primary"
                              )}>
                                {opt.icon}
                              </div>
                              <p className={cn("text-[12px] font-black tracking-tight", text)}>{opt.label}</p>
                              <p className={cn("text-[10px] font-medium opacity-60 mt-0.5", sub)}>{opt.desc}</p>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              </TabsContent>

              {/* ── Configurations ── */}
              <TabsContent value="configurations" className="p-8 outline-none">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl">
                  <div className="space-y-6">
                    <SliderRow
                      dark={dark}
                      label={t("ai_chat_assistants_section.slider_temperature_label")}
                      value={formData.creativity}
                      min={0} max={2} step={0.01}
                      onChange={(v) => setFormData({ ...formData, creativity: v })}
                      leftLabel={t("ai_chat_assistants_section.slider_more_precise")}
                      rightLabel={t("ai_chat_assistants_section.slider_more_creative")}
                    />

                    <SliderRow
                      dark={dark}
                      label={t("ai_chat_assistants_section.slider_top_p_label")}
                      value={formData.diversity}
                      min={0} max={1} step={0.01}
                      onChange={(v) => setFormData({ ...formData, diversity: v })}
                      leftLabel={t("ai_chat_assistants_section.slider_less_diversity")}
                      rightLabel={t("ai_chat_assistants_section.slider_more_diversity")}
                    />
                  </div>

                  <div className="space-y-6">
                    <div className="space-y-2">
                      <FieldLabel dark={dark}>{t("ai_chat_assistants_section.field_response_tokens")}</FieldLabel>
                      <Input
                        type="number"
                        value={formData.response_tokens}
                        onChange={(e) => setFormData({ ...formData, response_tokens: parseInt(e.target.value) || 0 })}
                        className={inputCls}
                      />
                    </div>

                    <div className="space-y-2">
                      <FieldLabel dark={dark}>{t("ai_chat_assistants_section.field_history_limit")}</FieldLabel>
                      <div className="flex gap-2">
                        {[0, 5, 10, 20].map((val) => {
                          const active = formData.history_limit === val;
                          return (
                            <button
                              key={val}
                              type="button"
                              onClick={() => setFormData({ ...formData, history_limit: val })}
                              className={cn(
                                "flex-1 h-11 rounded-xl text-[12px] font-semibold transition-all border",
                                active
                                  ? "bg-primary text-white border-primary shadow-md shadow-primary/20"
                                  : dark
                                    ? "bg-slate-950/50 border-slate-800 text-slate-300 hover:border-primary/40 hover:text-primary"
                                    : "bg-white border-slate-200 text-slate-700 hover:border-primary/40 hover:text-primary"
                              )}
                            >
                              {val === 0 ? t("ai_chat_assistants_section.history_limit_auto") : val}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              </TabsContent>

              {/* ── Knowledge ── */}
              <TabsContent value="knowledge" className="p-8 outline-none space-y-5">
                <h4 className={cn("text-[13px] font-semibold", text)}>{t("ai_chat_assistants_section.knowledge_heading")}</h4>

                <div className="flex gap-2">
                  {([
                    { v: "pdf",     label: t("ai_chat_assistants_section.source_pdf") },
                    { v: "website", label: t("ai_chat_assistants_section.source_website") },
                    { v: "text",    label: t("ai_chat_assistants_section.source_text") },
                  ] as const).map((opt) => {
                    const active = formData.source_type === opt.v;
                    return (
                      <button
                        key={opt.v}
                        type="button"
                        onClick={() => setFormData({ ...formData, source_type: opt.v })}
                        className={cn(
                          "flex-1 h-11 rounded-xl text-[12px] font-semibold transition-all border",
                          active
                            ? "border-primary text-primary bg-primary/5"
                            : dark
                              ? "border-slate-800 text-slate-400 hover:border-primary/40 hover:text-primary"
                              : "border-slate-200 text-slate-500 hover:border-primary/40 hover:text-primary"
                        )}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>

                <div className={cn("p-8 rounded-[1.5rem] border-2 border-dashed text-center", softBg, softBorder)}>
                  {formData.source_type === "pdf" && (
                    <div className="space-y-3">
                      <div className="mx-auto w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
                        <FileText size={20} />
                      </div>
                      <h3 className={cn("text-[14px] font-semibold", text)}>{t("ai_chat_assistants_section.upload_pdf_title")}</h3>
                      <p className={cn("text-[11px] font-medium opacity-60", sub)}>{t("ai_chat_assistants_section.upload_pdf_description")}</p>
                      <button
                        type="button"
                        onClick={() => toast({ title: t("ai_chat_assistants_section.upload_pdf_toast_title"), description: t("ai_chat_assistants_section.upload_pdf_toast_description") })}
                        className={cn(primaryOutlineBtn, "mx-auto")}
                      >
                        <Upload size={12} /> {t("ai_chat_assistants_section.select_files_button")}
                      </button>
                    </div>
                  )}

                  {formData.source_type === "website" && (
                    <div className="space-y-3 max-w-xl mx-auto">
                      <div className={cn("flex border rounded-xl overflow-hidden h-11 items-center transition-all",
                        dark ? "bg-slate-950/50 border-slate-800 focus-within:border-primary/40" : "bg-white border-slate-200 focus-within:border-primary/40")}>
                        <span className={cn("px-3 text-[11px] font-semibold border-r h-full flex items-center",
                          dark ? "text-slate-500 border-slate-800 bg-slate-900/40" : "text-slate-400 border-slate-200 bg-slate-50")}>https://</span>
                        <Input placeholder="example.com" className={cn(inputCls, "h-full border-0 rounded-none focus-visible:ring-0")} />
                      </div>
                      <button
                        type="button"
                        onClick={() => toast({ title: t("ai_chat_assistants_section.fetching_toast_title"), description: t("ai_chat_assistants_section.fetching_toast_description") })}
                        className={cn(primaryOutlineBtn, "mx-auto")}
                      >
                        {t("ai_chat_assistants_section.fetch_pages_button")}
                      </button>
                    </div>
                  )}

                  {formData.source_type === "text" && (
                    <Textarea
                      rows={8}
                      placeholder={t("ai_chat_assistants_section.placeholder_text_content")}
                      className={cn(
                        "w-full rounded-xl text-[13px] font-medium leading-relaxed resize-none p-4 transition-all",
                        "focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:border-primary/50",
                        dark ? "bg-slate-950/50 border-slate-800 text-white" : "bg-white border-slate-200 text-slate-900"
                      )}
                    />
                  )}
                </div>
              </TabsContent>

              {/* ── Functions ── */}
              <TabsContent value="functions" className="p-8 outline-none">
                <div className="flex flex-col items-center justify-center text-center space-y-4 py-10">
                  <div className="w-14 h-14 bg-primary/10 rounded-2xl flex items-center justify-center text-primary">
                    <Zap size={22} />
                  </div>
                  <div className="space-y-1 max-w-md">
                    <h3 className={cn("text-[14px] font-semibold", text)}>{t("ai_chat_assistants_section.function_calling_title")}</h3>
                    <p className={cn("text-[11px] font-medium opacity-60 leading-relaxed", sub)}>
                      {t("ai_chat_assistants_section.function_calling_description")}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => toast({ title: t("ai_chat_assistants_section.functions_toast_title"), description: t("ai_chat_assistants_section.functions_toast_description") })}
                    className={primaryOutlineBtn}
                  >
                    <Plus size={12} /> {t("ai_chat_assistants_section.add_function_button")}
                  </button>
                </div>
              </TabsContent>
            </Tabs>

            {/* Footer */}
            <div className={cn("px-6 py-4 border-t flex justify-end gap-2", border, softBg)}>
              <button type="button" onClick={() => setViewMode("list")} className={outlineBtn}>
                {t("ai_chat_assistants_section.cancel")}
              </button>
              <button type="submit" className={primaryBtn}>
                <Sparkles size={12} /> {t("ai_chat_assistants_section.publish")}
              </button>
            </div>
          </CardContent>
        </Card>
      </form>
    );
  }

  /* ── LIST VIEW ── */
  return (
    <>
      <Card className={cn("rounded-[2rem] border overflow-hidden shadow-sm transition-all duration-300", card, border)}>
        <CardContent className="p-0">
          {/* Header */}
          <div className={cn("px-8 py-5 border-b flex items-center justify-between gap-4", border)}>
            <div className="flex items-center gap-4">
              <div className={cn("p-2.5 rounded-xl shadow-sm", dark ? "bg-primary/15" : "bg-primary/10")}>
                <Bot className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h1 className={cn("text-[16px] font-bold tracking-tight", text)}>{t("ai_chat_assistants_section.title")}</h1>
                <p className={cn("text-[11px] font-medium mt-0.5 opacity-60", sub)}>
                  {t("ai_chat_assistants_section.subtitle")}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className={cn("flex items-center gap-3 px-3 h-10 rounded-xl border text-[11px] font-semibold", dark ? "border-slate-800 bg-slate-950/50 text-slate-300" : "border-slate-200 bg-slate-50 text-slate-600")}>
                <span>{t("ai_chat_assistants_section.active_count", { count: totalActive })}</span>
                <div className="w-px h-3" style={{ backgroundColor: dark ? "rgb(30 41 59)" : "rgb(226 232 240)" }} />
                <span>{t("ai_chat_assistants_section.limit_count", { count: limit })}</span>
                <Info size={11} className="opacity-50" />
              </div>
              {canCreateKB && (
                <button onClick={() => handleEdit(null)} className={primaryOutlineBtn}>
                  <Plus size={12} /> {t("ai_chat_assistants_section.add_assistant")}
                </button>
              )}
            </div>
          </div>

          {/* Body */}
          <div className="p-6">
            {agents.length === 0 ? (
              <div className={cn("rounded-[1.5rem] border py-16 px-8 flex flex-col items-center justify-center text-center space-y-5", softBg, softBorder)}>
                <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
                  <Bot className="w-8 h-8 text-primary" />
                </div>
                <div className="space-y-1.5 max-w-sm">
                  <h3 className={cn("text-[14px] font-black tracking-tight", text)}>{t("ai_chat_assistants_section.empty_title")}</h3>
                  <p className={cn("text-[11px] font-medium opacity-60 leading-relaxed", sub)}>
                    {t("ai_chat_assistants_section.empty_description")}
                  </p>
                </div>
              </div>
            ) : (
              <div className={cn("rounded-[1.5rem] border overflow-hidden", softBorder, softBg)}>
                <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className={cn("border-b", softBorder, dark ? "bg-slate-900/30" : "bg-white/60")}>
                      <th className={cn("py-4 px-6 text-left text-[11px] font-semibold", sub)}>{t("ai_chat_assistants_section.table_name")}</th>
                      <th className={cn("py-4 px-6 text-left text-[11px] font-semibold", sub)}>{t("ai_chat_assistants_section.table_model")}</th>
                      <th className={cn("py-4 px-6 text-left text-[11px] font-semibold", sub)}>{t("ai_chat_assistants_section.table_ai_calls")}</th>
                      <th className={cn("py-4 px-6 text-left text-[11px] font-semibold", sub)}>{t("ai_chat_assistants_section.table_status")}</th>
                      <th className={cn("py-4 px-6 text-right text-[11px] font-semibold", sub)}>{t("ai_chat_assistants_section.table_actions")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {agents.map((agent: any) => (
                      <tr key={agent.id} className={cn("border-b last:border-0 transition-colors", softBorder, dark ? "hover:bg-slate-900/40" : "hover:bg-white/60")}>
                        <td className="py-3 px-6">
                          <p className={cn("text-[12px] font-black", text)}>{agent.name}</p>
                          <p className={cn("text-[10px] font-medium opacity-60 mt-0.5 flex items-center gap-1", sub)}>
                            <Info size={9} /> {agent.reference_id}
                          </p>
                        </td>
                        <td className={cn("py-3 px-6 text-[12px] font-bold", text)}>
                          <Badge variant="outline" className="h-5 px-2 rounded-md border-primary/20 bg-primary/5 text-primary text-[10px] font-semibold">
                            {agent.model}
                          </Badge>
                        </td>
                        <td className={cn("py-3 px-6 text-[12px] font-bold", text)}>{agent.total_quries?.toLocaleString() ?? "0"}</td>
                        <td className="py-3 px-6">
                          <Switch
                            checked={agent.status === "ACTIVE"}
                            disabled={!canEditKB}
                            onCheckedChange={() => handleStatusToggle(agent.id, agent.status)}
                            className="data-[state=checked]:bg-primary"
                          />
                        </td>
                        <td className="py-3 px-6 text-right">
                          <div className="flex items-center justify-end gap-1">
                            {canEditKB && (
                              <button
                                onClick={() => handleEdit(agent)}
                                className={cn("w-8 h-8 rounded-lg flex items-center justify-center transition-all", dark ? "hover:bg-primary/10 hover:text-primary text-slate-400" : "hover:bg-primary/10 hover:text-primary text-slate-500")}
                              >
                                <Pencil size={12} />
                              </button>
                            )}
                            <button
                              onClick={() => toast({ title: t("ai_chat_assistants_section.logs_toast_title"), description: t("ai_chat_assistants_section.logs_toast_description", { name: agent.name }) })}
                              className={cn("w-8 h-8 rounded-lg flex items-center justify-center transition-all", dark ? "hover:bg-primary/10 hover:text-primary text-slate-400" : "hover:bg-primary/10 hover:text-primary text-slate-500")}
                            >
                              <FileText size={12} />
                            </button>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <button className={cn("w-8 h-8 rounded-lg flex items-center justify-center transition-all", dark ? "hover:bg-slate-800 text-slate-400" : "hover:bg-slate-100 text-slate-500")}>
                                  <MoreVertical size={12} />
                                </button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className={cn("rounded-xl p-1.5 min-w-[160px]", dark ? "bg-[#0f1829] border-slate-800" : "")}>
                                {canManageFeeder && (
                                  <DropdownMenuItem
                                    onClick={() => setFeederAgent(agent)}
                                    className="rounded-lg py-2 cursor-pointer gap-2 font-bold text-[11px]"
                                  >
                                    <Plug size={12} /> {t("ai_chat_assistants_section.ai_feeder_menu_item")}
                                  </DropdownMenuItem>
                                )}
                                {canDeleteKB && (
                                  <DropdownMenuItem
                                    onClick={() => { setAgentToDelete(agent); setShowDeleteConfirm(true); }}
                                    className="rounded-lg py-2 cursor-pointer gap-2 font-bold text-[11px] text-rose-500"
                                  >
                                    <Trash2 size={12} /> {t("ai_chat_assistants_section.delete")}
                                  </DropdownMenuItem>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
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
                <h2 className={cn("text-[14px] font-semibold", text)}>{t("ai_chat_assistants_section.delete_dialog_title")}</h2>
                <p className={cn("text-[11px] font-medium opacity-60 mt-0.5 leading-relaxed", sub)}>
                  <span className="text-rose-500 font-black">"{agentToDelete?.name}"</span> {t("ai_chat_assistants_section.delete_dialog_description_suffix")}
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <AlertDialogCancel className={cn(outlineBtn, "m-0")}>{t("ai_chat_assistants_section.cancel")}</AlertDialogCancel>
              <AlertDialogAction
                onClick={confirmDeleteAgent}
                className="h-11 px-7 rounded-xl bg-rose-500 hover:bg-rose-600 text-white text-[11px] font-semibold transition-all shadow-lg shadow-rose-500/20 flex items-center gap-2"
              >
                <Trash2 size={12} /> {t("ai_chat_assistants_section.delete")}
              </AlertDialogAction>
            </div>
          </div>
        </AlertDialogContent>
      </AlertDialog>

      <AiFeederModal agent={feederAgent} onClose={() => setFeederAgent(null)} />
    </>
  );
}

/* ── Helpers ── */

/**
 * AI Feeder modal — bind an agent to a WhatsApp number + automation via a
 * ref-link trigger. POSTs to /ai-feeder (replyagent addFeeder). The chosen
 * automation should contain an AI step with "reply on WhatsApp" enabled so the
 * agent (grounded on the `feed` knowledge) answers inbound ref-link messages.
 */
function AiFeederModal({ agent, onClose }: { agent: any | null; onClose: () => void }) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [channelableId, setChannelableId] = useState("");
  const [automationId, setAutomationId] = useState("");
  const [triggerText, setTriggerText] = useState("");
  const [feed, setFeed] = useState("");

  const { data: waData } = useQuery<any>({
    queryKey: ["/api/whatsapp/accounts", "feeder"],
    enabled: !!agent,
    queryFn: async () => {
      // `onboard_platform=all` — the endpoint defaults to Business API only
      // (replyagent parity). allow_in_feeder is toggleable on Coexistence
      // numbers too, so the feeder picker must see both platforms.
      const res = await apiRequest("GET", "/api/whatsapp/accounts?with=phoneNumbers&onboard_platform=all");
      return res.json();
    },
  });
  const { data: autoData } = useQuery<any>({
    queryKey: ["/api/automations", "feeder"],
    enabled: !!agent,
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/automations");
      return res.json();
    },
  });

  const numbers: any[] = (waData?.wa ?? []).flatMap((acc: any) =>
    (acc.phone_numbers ?? acc.phoneNumbers ?? []).map((n: any) => ({
      id: String(n.id),
      label: n.display_phone_number || n.verified_name || String(n.id),
    })),
  );
  const automations: any[] = (autoData?.automations ?? autoData ?? []).map((a: any) => ({
    id: String(a.id),
    name: a.name,
  }));

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/ai-feeder", {
        name: name.trim(),
        ai_agent_id: agent.id,
        automation_id: automationId,
        channel_type: "whatsapp",
        channelable_id: channelableId,
        trigger_text: triggerText.trim(),
        feed: feed.trim(),
      });
      return res.json();
    },
    onSuccess: (data: any) => {
      if (data?.success) {
        toast({ title: t("ai_chat_assistants_section.feeder_created_title"), description: t("ai_chat_assistants_section.feeder_created_description") });
        qc.invalidateQueries({ queryKey: ["/api/ai-feeder"] });
        close();
      } else {
        toast({ title: t("ai_chat_assistants_section.feeder_error_title"), description: data?.message ?? "", variant: "destructive" });
      }
    },
    onError: (e: any) => toast({ title: t("ai_chat_assistants_section.feeder_error_title"), description: e?.message ?? "", variant: "destructive" }),
  });

  const close = () => {
    setName(""); setChannelableId(""); setAutomationId(""); setTriggerText(""); setFeed("");
    onClose();
  };

  const valid = name.trim() && channelableId && automationId && triggerText.trim();

  return (
    <Dialog open={!!agent} onOpenChange={(o) => { if (!o) close(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("ai_chat_assistants_section.ai_feeder_dialog_title")}{agent ? ` — ${agent.name}` : ""}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-muted-foreground">{t("ai_chat_assistants_section.label_feeder_name")}</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t("ai_chat_assistants_section.placeholder_feeder_name")} />
          </div>
          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-muted-foreground">{t("ai_chat_assistants_section.label_whatsapp_number")}</label>
            <Select value={channelableId} onValueChange={setChannelableId}>
              <SelectTrigger><SelectValue placeholder={t("ai_chat_assistants_section.placeholder_select_number")} /></SelectTrigger>
              <SelectContent>
                {numbers.length === 0 ? (
                  <SelectItem value="none" disabled>{t("ai_chat_assistants_section.no_whatsapp_numbers")}</SelectItem>
                ) : numbers.map((n) => <SelectItem key={n.id} value={n.id}>{n.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-muted-foreground">{t("ai_chat_assistants_section.label_automation")}</label>
            <Select value={automationId} onValueChange={setAutomationId}>
              <SelectTrigger><SelectValue placeholder={t("ai_chat_assistants_section.placeholder_select_automation")} /></SelectTrigger>
              <SelectContent>
                {automations.length === 0 ? (
                  <SelectItem value="none" disabled>{t("ai_chat_assistants_section.no_automations")}</SelectItem>
                ) : automations.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-muted-foreground">{t("ai_chat_assistants_section.label_trigger_keyword")}</label>
            <Input value={triggerText} onChange={(e) => setTriggerText(e.target.value)} placeholder={t("ai_chat_assistants_section.placeholder_trigger_keyword")} />
          </div>
          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-muted-foreground">{t("ai_chat_assistants_section.label_knowledge_feed")}</label>
            <Textarea value={feed} onChange={(e) => setFeed(e.target.value)} placeholder={t("ai_chat_assistants_section.placeholder_knowledge_feed")} className="min-h-24" />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button onClick={close} className="h-9 px-4 rounded-lg border text-[11px] font-semibold">{t("ai_chat_assistants_section.cancel")}</button>
            <button
              onClick={() => mutation.mutate()}
              disabled={!valid || mutation.isPending}
              className="h-9 px-4 rounded-lg text-[11px] font-semibold bg-primary text-white disabled:opacity-40"
            >
              {mutation.isPending ? t("ai_chat_assistants_section.creating_feeder") : t("ai_chat_assistants_section.create_feeder_button")}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function FieldLabel({ dark, children }: { dark: boolean; children: React.ReactNode }) {
  const sub = dark ? "text-slate-400" : "text-slate-500";
  return (
    <label className={cn("text-[11px] font-semibold pl-1 block", sub)}>{children}</label>
  );
}

function SliderRow({
  dark,
  label,
  value,
  min,
  max,
  step,
  onChange,
  leftLabel,
  rightLabel,
}: {
  dark: boolean;
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  leftLabel: string;
  rightLabel: string;
}) {
  const text = dark ? "text-white" : "text-slate-900";
  const sub  = dark ? "text-slate-500" : "text-slate-400";
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <FieldLabel dark={dark}>{label}</FieldLabel>
        <span className="text-[11px] font-black text-primary bg-primary/10 px-2 py-0.5 rounded-md">{value}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full accent-primary"
      />
      <div className="flex justify-between">
        <span className={cn("text-[11px] font-semibold opacity-60", sub)}>{leftLabel}</span>
        <span className={cn("text-[11px] font-semibold opacity-60", sub)}>{rightLabel}</span>
      </div>
    </div>
  );
}
