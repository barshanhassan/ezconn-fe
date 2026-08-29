import { useState, useEffect } from "react";
import {
  MessageSquare,
  UserCheck,
  Trash2,
  FolderSearch,
  Wand2,
  CheckCircle2,
  Settings,
  Plus,
  Info,
  History,
  PenTool,
  PauseCircle,
  Sparkles,
  AlertTriangle,
  Award,
  Heart,
  ShieldCheck,
  Folder,
  X,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useTheme } from "@/contexts/ThemeContext";
import { cn } from "@/lib/utils";
import { useLocation } from "wouter";
import { useTranslation } from "react-i18next";

export default function LiveChatSection() {
  const { t } = useTranslation();
  const { mode } = useTheme();
  const { toast } = useToast();
  const dark = mode === "dark";
  const [, navigate] = useLocation();
  // The custom-field "+" buttons jump to the Custom Fields settings section so
  // an agent can create a field without leaving the flow (replyagent lets you
  // create a field inline from the picker).
  const goToCustomFields = () => navigate("/settings?tab=Custom fields");

  const card       = dark ? "bg-[#0f1829]"    : "bg-white";
  const border     = dark ? "border-slate-800" : "border-slate-200";
  const text       = dark ? "text-white"      : "text-slate-900";
  const sub        = dark ? "text-slate-500"  : "text-slate-400";
  const softBg     = dark ? "bg-slate-950/40" : "bg-slate-50/50";
  const softBorder = dark ? "border-slate-800" : "border-slate-100";
  const tabBorder  = dark ? "border-slate-800" : "border-slate-100";

  const inputCls = cn(
    "h-11 rounded-xl text-[13px] font-bold transition-all px-4",
    "focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:border-primary/50",
    dark ? "bg-slate-950/50 border-slate-800 text-white" : "bg-white border-slate-200 text-slate-900"
  );

  const primaryBtn =
    "h-11 px-8 rounded-xl bg-primary hover:bg-primary/90 disabled:opacity-50 text-white text-[11px] font-semibold transition-all shadow-lg shadow-primary/20";

  const outlineBtn = cn(
    "h-11 w-11 rounded-xl border flex items-center justify-center shrink-0 transition-all hover:border-primary/40 hover:text-primary",
    dark ? "border-slate-800 bg-slate-950/50 text-slate-300" : "border-slate-200 bg-white text-slate-600"
  );

  const { data: settings, isLoading } = useQuery<any>({
    queryKey: ["/api/workspaces/live-chat-settings"],
  });

  const updateMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("PATCH", "/api/workspaces/live-chat-settings", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/workspaces/live-chat-settings"] });
      toast({ title: t("live_chat_section.toasts.saved_title"), description: t("live_chat_section.toasts.settings_updated_description") });
    },
  });

  const [agentAction, setAgentAction] = useState("keep");
  const [saveAgentDetails, setSaveAgentDetails] = useState(false);
  const [agentDataFormat, setAgentDataFormat] = useState("full_name");
  const [customField, setCustomField] = useState("AuditLog");

  const [saveConversationJson, setSaveConversationJson] = useState(false);
  const [jsonCustomField, setJsonCustomField] = useState("Json");

  const [includeSignature, setIncludeSignature] = useState(false);

  const [correctionModel, setCorrectionModel] = useState("gpt-4o-mini");
  const [correctionPrompt, setCorrectionPrompt] = useState("");

  const [pauseSmartFlow, setPauseSmartFlow] = useState("automatically");

  // Custom fields (for Completion tab "Save as JSON" target field — mirrors replyagent's field picker).
  // Schema: custom_fields has `label` (display) + `slug` (system identifier) — NOT `name`/`system_name`.
  // Filter out entries with no label so Radix Select doesn't crash on empty-string values.
  const { data: customFieldsData } = useQuery<any>({ queryKey: ["/api/custom-fields"] });
  const customFields: { id: string; name: string }[] = Array.isArray(customFieldsData?.fields)
    ? customFieldsData.fields
        .map((f: any) => ({ id: String(f.id), name: String(f.label || f.slug || "").trim() }))
        .filter((f: any) => f.name !== "")
    : [];

  // Folders — real conversation folders (replyagent inbox folders), no longer fake local state
  const { data: foldersData } = useQuery<any>({ queryKey: ["/api/inbox/folders"] });
  const folders: { id: string; name: string; assign_to: string | null; assigned_to: string | null }[] = Array.isArray(foldersData)
    ? foldersData.map((f: any) => ({
        id: String(f.id),
        name: f.name || "",
        assign_to: f.assign_to ?? null,
        assigned_to: f.assigned_to != null ? String(f.assigned_to) : null,
      }))
    : [];

  const { data: membersData } = useQuery<any>({ queryKey: ["/api/workspaces/members"] });
  const agents: { id: string; label: string }[] = Array.isArray(membersData)
    ? membersData
        .map((m: any) => ({
          id: m.id != null ? String(m.id) : "",
          label: m.full_name || [m.first_name, m.last_name].filter(Boolean).join(" ") || m.email || `Agent #${m.id}`,
        }))
        .filter((a: any) => a.id !== "")
    : [];

  // Teams — for the Folders tab "Assign to" (replyagent lets a folder be
  // assigned to an Agent OR a Team). Backend GET /teams/get-all returns an array.
  const { data: teamsData } = useQuery<any>({ queryKey: ["/api/teams/get-all"] });
  const teams: { id: string; label: string }[] = Array.isArray(teamsData)
    ? teamsData
        .map((tm: any) => ({ id: tm.id != null ? String(tm.id) : "", label: tm.name || `Team #${tm.id}` }))
        .filter((tm: any) => tm.id !== "")
    : [];

  const [folderFormOpen, setFolderFormOpen] = useState(false);
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
  const [folderName, setFolderName] = useState("");
  const [folderAssignedTo, setFolderAssignedTo] = useState("all");
  // Whether the folder is assigned to an Agent or a Team (replyagent parity).
  const [folderSource, setFolderSource] = useState<"AGENT" | "TEAM">("AGENT");

  const invalidateFolders = () => queryClient.invalidateQueries({ queryKey: ["/api/inbox/folders"] });
  const createFolderMut = useMutation({
    mutationFn: async (payload: any) => (await apiRequest("POST", "/api/inbox/folders", payload)).json(),
    onSuccess: () => { invalidateFolders(); setFolderFormOpen(false); toast({ title: t("live_chat_section.toasts.saved_title"), description: t("live_chat_section.toasts.folder_created_description") }); },
  });
  const updateFolderMut = useMutation({
    mutationFn: async ({ id, ...payload }: any) => (await apiRequest("PATCH", `/api/inbox/folders/${id}`, payload)).json(),
    onSuccess: () => { invalidateFolders(); setFolderFormOpen(false); toast({ title: t("live_chat_section.toasts.saved_title"), description: t("live_chat_section.toasts.folder_updated_description") }); },
  });
  const deleteFolderMut = useMutation({
    mutationFn: async (id: string) => (await apiRequest("DELETE", `/api/inbox/folders/${id}`)).json(),
    onSuccess: () => { invalidateFolders(); setFolderFormOpen(false); toast({ title: t("live_chat_section.toasts.deleted_title"), description: t("live_chat_section.toasts.folder_removed_description") }); },
  });

  const openAddFolder = () => {
    setEditingFolderId(null);
    setFolderName("");
    setFolderSource("AGENT");
    setFolderAssignedTo("all");
    setFolderFormOpen(true);
  };

  const openEditFolder = (f: { id: string; name: string; assign_to: string | null; assigned_to: string | null }) => {
    setEditingFolderId(f.id);
    setFolderName(f.name);
    const src = f.assign_to === "TEAM" ? "TEAM" : "AGENT";
    setFolderSource(src);
    // Team mode has no "all" option; Agent mode falls back to "all" (no specific agent).
    setFolderAssignedTo(f.assigned_to || (src === "TEAM" ? "" : "all"));
    setFolderFormOpen(true);
  };

  // Switching Agent/Team resets the picked target so we never send a stale id
  // that belongs to the other source.
  const changeFolderSource = (src: "AGENT" | "TEAM") => {
    setFolderSource(src);
    setFolderAssignedTo(src === "TEAM" ? "" : "all");
  };

  const saveFolder = () => {
    if (!folderName.trim()) return;
    const assigned = folderAssignedTo && folderAssignedTo !== "all" ? folderAssignedTo : null;
    // Team must have a concrete team selected; Agent allows "all" (= unassigned).
    if (folderSource === "TEAM" && !assigned) return;
    const payload = {
      name: folderName.trim(),
      assign_to: assigned ? folderSource : null,
      assigned_to: assigned,
    };
    if (editingFolderId !== null) {
      updateFolderMut.mutate({ id: editingFolderId, ...payload });
    } else {
      createFolderMut.mutate(payload);
    }
  };

  const removeFolder = () => {
    if (editingFolderId !== null) deleteFolderMut.mutate(editingFolderId);
  };

  const applySettings = (s: any) => {
    setAgentAction(s.value || "keep");
    setSaveAgentDetails(s.save_to_custom_field === 1);
    setAgentDataFormat(s.data_format === "json" ? "json" : "full_name");
    setCustomField(s.custom_field || "AuditLog");
    setSaveConversationJson(s.save_chat === 1);
    setJsonCustomField(s.chat_field || "Json");
    setIncludeSignature(s.append_username === 1);
    setCorrectionModel(s.ai_model || "gpt-4o-mini");
    setCorrectionPrompt(s.ai_prompt || "");
    setPauseSmartFlow(s.automatically_pause_automation ? "automatically" : "keep");
  };

  useEffect(() => {
    if (settings) applySettings(settings);
  }, [settings]);

  const handleDiscard = () => {
    if (settings) applySettings(settings);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  const tabs = [
    { value: "agents", label: t("live_chat_section.tabs.agents"), icon: UserCheck },
    { value: "completion", label: t("live_chat_section.tabs.completion"), icon: History },
    { value: "signature", label: t("live_chat_section.tabs.signature"), icon: PenTool },
    { value: "correction", label: t("live_chat_section.tabs.correction"), icon: Wand2 },
    { value: "folders", label: t("live_chat_section.tabs.folders"), icon: FolderSearch },
    { value: "pause", label: t("live_chat_section.tabs.pause"), icon: PauseCircle },
  ];

  return (
    <Card className={cn("rounded-[2rem] border overflow-hidden shadow-sm transition-all duration-300", card, border)}>
      <CardContent className="p-0">
        {/* ── Header ── */}
        <div className={cn("px-8 py-4 border-b flex items-center justify-between", border)}>
          <div className="flex items-center gap-4">
            <div className={cn("p-2.5 rounded-xl shadow-sm", dark ? "bg-primary/15" : "bg-primary/10")}>
              <MessageSquare className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className={cn("text-[16px] font-bold tracking-tight", text)}>{t("live_chat_section.title")}</h1>
              <p className={cn("text-[11px] font-medium mt-0.5 opacity-60", sub)}>
                {t("live_chat_section.subtitle")}
              </p>
            </div>
          </div>
          <div className={cn("px-3 py-1.5 rounded-lg border text-[10px] font-semibold flex items-center gap-1.5", dark ? "border-slate-800 bg-slate-950/50 text-slate-300" : "border-slate-200 bg-slate-50 text-slate-600")}>
            <Sparkles size={11} className="text-primary" /> {t("live_chat_section.version_badge")}
          </div>
        </div>

        <div>
          <Tabs defaultValue="agents" className="w-full">
            {/* Tabs Bar */}
            <div className={cn("px-8 border-b flex justify-start overflow-x-auto", tabBorder)}>
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

            {/* ── AGENTS TAB ── */}
            <TabsContent value="agents" className="p-6 outline-none space-y-6">
              <SectionHeading
                dark={dark}
                title={t("live_chat_section.agents.heading_title")}
                badge={t("live_chat_section.agents.heading_badge")}
                description={t("live_chat_section.agents.heading_description")}
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <OptionCard
                  dark={dark}
                  active={agentAction === "keep"}
                  onClick={() => setAgentAction("keep")}
                  icon={<UserCheck size={18} />}
                  title={t("live_chat_section.agents.keep_agent_title")}
                  description={t("live_chat_section.agents.keep_agent_description")}
                  recommended
                  recommendedLabel={t("live_chat_section.agents.recommended")}
                />
                <OptionCard
                  dark={dark}
                  active={agentAction === "remove"}
                  onClick={() => setAgentAction("remove")}
                  icon={<Trash2 size={18} />}
                  title={t("live_chat_section.agents.remove_agent_title")}
                  description={t("live_chat_section.agents.remove_agent_description")}
                />
              </div>

              <div className={cn("p-5 rounded-[1.25rem] border flex items-center justify-between gap-6", softBg, softBorder)}>
                <div className="flex items-center gap-4">
                  <div className="p-2 rounded-xl bg-primary/10 text-primary">
                    <Settings size={16} />
                  </div>
                  <div>
                    <p className={cn("text-[13px] font-black tracking-tight", text)}>{t("live_chat_section.agents.save_agent_details_title")}</p>
                    <p className={cn("text-[11px] font-medium opacity-60 mt-0.5", sub)}>
                      {t("live_chat_section.agents.save_agent_details_description")}
                    </p>
                  </div>
                </div>
                <Switch checked={saveAgentDetails} onCheckedChange={setSaveAgentDetails} className="data-[state=checked]:bg-primary" />
              </div>

              {saveAgentDetails && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5 animate-in slide-in-from-top-2 duration-300">
                  <div className="space-y-2">
                    <FieldLabel dark={dark}>{t("live_chat_section.agents.data_format_label")}</FieldLabel>
                    <Select value={agentDataFormat} onValueChange={setAgentDataFormat}>
                      <SelectTrigger className={inputCls}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className={cn("rounded-xl border shadow-2xl", dark ? "bg-[#0f1829] border-slate-800 text-white" : "bg-white border-slate-200")}>
                        <SelectItem value="full_name" className="text-[12px] font-bold">{t("live_chat_section.agents.full_name_option")}</SelectItem>
                        <SelectItem value="json" className="text-[12px] font-bold">{t("live_chat_section.agents.json_option")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <FieldLabel dark={dark}>{t("live_chat_section.agents.custom_field_label")}</FieldLabel>
                    <div className="flex gap-2">
                      <Select value={customField} onValueChange={setCustomField}>
                        <SelectTrigger className={inputCls}>
                          <SelectValue placeholder={t("live_chat_section.agents.select_custom_field_placeholder")} />
                        </SelectTrigger>
                        <SelectContent className={cn("rounded-xl border shadow-2xl", dark ? "bg-[#0f1829] border-slate-800 text-white" : "bg-white border-slate-200")}>
                          {customFields.length === 0 ? (
                            <div className="px-3 py-2 text-[11px] font-medium opacity-60">{t("live_chat_section.agents.no_custom_fields")}</div>
                          ) : (
                            customFields.map((f) => (
                              <SelectItem key={f.id} value={f.name} className="text-[12px] font-bold">{f.name}</SelectItem>
                            ))
                          )}
                        </SelectContent>
                      </Select>
                      <button onClick={goToCustomFields} title={t("live_chat_section.agents.create_custom_field_title")} className={outlineBtn}><Plus size={16} /></button>
                    </div>
                  </div>
                </div>
              )}

              <SaveFooter
                dark={dark}
                onClick={() => updateMutation.mutate({ agentAction, saveAgentDetails, agentDataFormat, customField })}
                loading={updateMutation.isPending}
                primaryBtn={primaryBtn}
                t={t}
              />
            </TabsContent>

            {/* ── COMPLETION TAB ── */}
            <TabsContent value="completion" className="p-6 outline-none space-y-6">
              <SectionHeading
                dark={dark}
                title={t("live_chat_section.completion.heading_title")}
                description={t("live_chat_section.completion.heading_description")}
              />

              <div className={cn("p-6 rounded-[1.5rem] border", softBg, softBorder)}>
                <div className="flex items-start justify-between gap-6">
                  <div className="flex items-start gap-4 flex-1">
                    <div className="p-2 rounded-xl bg-primary/10 text-primary mt-0.5">
                      <History size={16} />
                    </div>
                    <div>
                      <p className={cn("text-[13px] font-black tracking-tight", text)}>{t("live_chat_section.completion.save_as_json_title")}</p>
                      <p className={cn("text-[11px] font-medium opacity-60 mt-1 leading-relaxed", sub)}>
                        {t("live_chat_section.completion.save_as_json_description")}
                      </p>
                    </div>
                  </div>
                  <Switch checked={saveConversationJson} onCheckedChange={setSaveConversationJson} className="data-[state=checked]:bg-primary mt-1" />
                </div>

                {saveConversationJson && (
                  <div className="pt-5 mt-5 border-t flex items-end gap-3 animate-in slide-in-from-top-2 duration-300" style={{ borderColor: dark ? "rgb(30 41 59)" : "rgb(241 245 249)" }}>
                    <div className="flex-1 space-y-2">
                      <FieldLabel dark={dark}>{t("live_chat_section.completion.target_custom_field_label")}</FieldLabel>
                      <Select value={jsonCustomField} onValueChange={setJsonCustomField}>
                        <SelectTrigger className={inputCls}>
                          <SelectValue placeholder={t("live_chat_section.agents.select_custom_field_placeholder")} />
                        </SelectTrigger>
                        <SelectContent className={cn("rounded-xl border shadow-2xl", dark ? "bg-[#0f1829] border-slate-800 text-white" : "bg-white border-slate-200")}>
                          {customFields.length === 0 ? (
                            <div className="px-3 py-2 text-[11px] font-medium opacity-60">{t("live_chat_section.agents.no_custom_fields")}</div>
                          ) : (
                            customFields.map((f) => (
                              <SelectItem key={f.id} value={f.name} className="text-[12px] font-bold">{f.name}</SelectItem>
                            ))
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                    <button onClick={goToCustomFields} title={t("live_chat_section.agents.create_custom_field_title")} className={outlineBtn}><Plus size={16} /></button>
                  </div>
                )}
              </div>

              <SaveFooter
                dark={dark}
                onClick={() => updateMutation.mutate({ saveConversationJson, jsonCustomField })}
                loading={updateMutation.isPending}
                primaryBtn={primaryBtn}
                t={t}
              />
            </TabsContent>

            {/* ── SIGNATURE TAB ── */}
            <TabsContent value="signature" className="p-6 outline-none space-y-5">
              <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                {/* Left: Toggle + Benefits + Warning */}
                <div className="lg:col-span-3 space-y-4">
                  {/* Toggle */}
                  <div className={cn("p-4 rounded-[1.5rem] border flex items-start gap-4", softBg, softBorder)}>
                    <Switch
                      checked={includeSignature}
                      onCheckedChange={setIncludeSignature}
                      className="data-[state=checked]:bg-primary mt-0.5"
                    />
                    <div>
                      <p className={cn("text-[13px] font-black tracking-tight", text)}>
                        {t("live_chat_section.signature.toggle_title")}
                      </p>
                      <p className={cn("text-[11px] font-medium opacity-60 mt-1 leading-relaxed", sub)}>
                        {t("live_chat_section.signature.toggle_description")}
                      </p>
                    </div>
                  </div>

                  {/* Benefits */}
                  <div className="space-y-3">
                    {[
                      {
                        icon: <Award size={14} />,
                        title: t("live_chat_section.signature.benefit_professionalism_title"),
                        desc: t("live_chat_section.signature.benefit_professionalism_description"),
                      },
                      {
                        icon: <Heart size={14} />,
                        title: t("live_chat_section.signature.benefit_personalization_title"),
                        desc: t("live_chat_section.signature.benefit_personalization_description"),
                      },
                      {
                        icon: <ShieldCheck size={14} />,
                        title: t("live_chat_section.signature.benefit_accountability_title"),
                        desc: t("live_chat_section.signature.benefit_accountability_description"),
                      },
                    ].map((b) => (
                      <div key={b.title} className="flex items-start gap-3">
                        <div className="p-1.5 rounded-lg bg-primary/10 text-primary mt-0.5 shrink-0">
                          {b.icon}
                        </div>
                        <div>
                          <p className={cn("text-[13px] font-semibold", text)}>{b.title}</p>
                          <p className={cn("text-[11px] font-medium opacity-60 mt-0.5 leading-relaxed", sub)}>{b.desc}</p>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Warning */}
                  <div className={cn(
                    "p-3 rounded-[1.25rem] border flex items-start gap-3",
                    "bg-amber-500/10 border-amber-500/20"
                  )}>
                    <div className="p-1.5 rounded-lg bg-amber-500/20 text-amber-500 shrink-0">
                      <AlertTriangle size={14} />
                    </div>
                    <div>
                      <p className="text-[12px] font-semibold text-amber-600 dark:text-amber-400">
                        {t("live_chat_section.signature.attention_needed")}
                      </p>
                      <p className={cn("text-[11px] font-medium leading-relaxed mt-1 text-amber-700/80 dark:text-amber-300/80")}>
                        {t("live_chat_section.signature.attention_description")}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Right: Phone Preview */}
                <div className="lg:col-span-2 flex justify-center lg:justify-end">
                  <SignaturePhonePreview dark={dark} signatureName="Maria" showSignature={includeSignature} t={t} />
                </div>
              </div>

              <SaveFooter
                dark={dark}
                onClick={() => updateMutation.mutate({ includeSignature })}
                loading={updateMutation.isPending}
                primaryBtn={primaryBtn}
                t={t}
              />
            </TabsContent>

            {/* ── CORRECTION TAB ── */}
            <TabsContent value="correction" className="p-6 outline-none space-y-5">
              <SectionHeading
                dark={dark}
                title={t("live_chat_section.correction.heading_title")}
                description={t("live_chat_section.correction.heading_description")}
              />

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-1 space-y-4">
                  <div className="space-y-2">
                    <FieldLabel dark={dark}>{t("live_chat_section.correction.ai_model_label")}</FieldLabel>
                    <Select value={correctionModel} onValueChange={setCorrectionModel}>
                      <SelectTrigger className={inputCls}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className={cn("rounded-xl border shadow-2xl", dark ? "bg-[#0f1829] border-slate-800 text-white" : "bg-white border-slate-200")}>
                        <SelectItem value="gpt-4o-mini" className="text-[12px] font-bold">GPT-4o Mini (Fast)</SelectItem>
                        <SelectItem value="gpt-4o" className="text-[12px] font-bold">GPT-4o (Smart)</SelectItem>
                        <SelectItem value="claude-3-haiku" className="text-[12px] font-bold">Claude 3 Haiku</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className={cn("p-4 rounded-[1.25rem] border bg-primary/5 border-primary/20")}>
                    <div className="flex items-center gap-2 mb-2.5">
                      <Sparkles size={14} className="text-primary" />
                      <h5 className="text-[11px] font-semibold text-primary">{t("live_chat_section.correction.capabilities_title")}</h5>
                    </div>
                    <ul className="space-y-1.5">
                      {[
                        t("live_chat_section.correction.capability_grammar_fix"),
                        t("live_chat_section.correction.capability_tone_adjustment"),
                        t("live_chat_section.correction.capability_translation"),
                        t("live_chat_section.correction.capability_expansion"),
                      ].map((f) => (
                        <li key={f} className={cn("flex items-center gap-2 text-[11px] font-bold opacity-80", text)}>
                          <CheckCircle2 size={12} className="text-primary shrink-0" /> {f}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                <div className="lg:col-span-2 space-y-2">
                  <FieldLabel dark={dark}>{t("live_chat_section.correction.custom_prompt_label")}</FieldLabel>
                  <textarea
                    value={correctionPrompt}
                    onChange={(e) => setCorrectionPrompt(e.target.value)}
                    placeholder={t("live_chat_section.correction.custom_prompt_placeholder")}
                    className={cn(
                      "w-full min-h-[170px] rounded-xl border p-4 text-[13px] font-medium leading-relaxed resize-none transition-all",
                      "focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:border-primary/50 focus:outline-none",
                      dark ? "bg-slate-950/50 border-slate-800 text-white" : "bg-white border-slate-200 text-slate-900"
                    )}
                  />
                  <div className={cn("flex items-center gap-2 text-[10px] font-bold opacity-50 pl-1", sub)}>
                    <Info size={11} /> {t("live_chat_section.correction.custom_prompt_hint")}
                  </div>
                </div>
              </div>

              <SaveFooter
                dark={dark}
                onClick={() => updateMutation.mutate({ correctionModel, correctionPrompt })}
                loading={updateMutation.isPending}
                primaryBtn={primaryBtn}
                t={t}
              />
            </TabsContent>

            {/* ── FOLDERS TAB ── */}
            <TabsContent value="folders" className="p-6 outline-none space-y-5">
              <SectionHeading
                dark={dark}
                title={t("live_chat_section.folders.heading_title")}
                description={t("live_chat_section.folders.heading_description")}
              />

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Left: Folder list */}
                <div className={cn("rounded-[1.5rem] border overflow-hidden flex flex-col", softBg, softBorder)}>
                  {folders.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center text-center py-6">
                      <Folder className="w-8 h-8 text-primary/40 mx-auto mb-3" />
                      <p className={cn("text-[11px] font-bold opacity-60", sub)}>{t("live_chat_section.folders.no_folders")}</p>
                    </div>
                  ) : (
                    <ul className="divide-y" style={{ borderColor: dark ? "rgb(30 41 59)" : "rgb(241 245 249)" }}>
                      {folders.map((f) => {
                        const active = editingFolderId === f.id;
                        return (
                          <li key={f.id}>
                            <button
                              onClick={() => openEditFolder(f)}
                              className={cn(
                                "w-full flex items-center gap-3 px-5 py-3.5 transition-all text-left",
                                active
                                  ? "bg-primary/5"
                                  : dark
                                    ? "hover:bg-slate-900/50"
                                    : "hover:bg-slate-100/60"
                              )}
                            >
                              <Folder
                                size={16}
                                className={cn("shrink-0", active ? "text-primary" : "text-primary/70")}
                              />
                              <span
                                className={cn(
                                  "text-[12px] font-bold flex-1 truncate",
                                  active ? "text-primary" : text
                                )}
                              >
                                {f.name}
                              </span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>

                {/* Right: Form or Empty State */}
                <div className={cn("rounded-[1.5rem] border p-6 flex flex-col", softBg, softBorder)}>
                  {folderFormOpen ? (
                    <div className="flex flex-col gap-5 flex-1">
                      <div className="flex items-center justify-between">
                        <h4 className={cn("text-[13px] font-semibold", text)}>
                          {editingFolderId !== null ? t("live_chat_section.folders.edit_folder_title") : t("live_chat_section.folders.new_folder_title")}
                        </h4>
                        <button
                          onClick={() => setFolderFormOpen(false)}
                          className={cn("p-1.5 rounded-lg transition-colors", dark ? "hover:bg-slate-800 text-slate-400" : "hover:bg-slate-200 text-slate-500")}
                        >
                          <X size={14} />
                        </button>
                      </div>

                      <div className="space-y-2">
                        <FieldLabel dark={dark}>{t("live_chat_section.folders.display_name_label")}</FieldLabel>
                        <Input
                          value={folderName}
                          onChange={(e) => setFolderName(e.target.value)}
                          placeholder={t("live_chat_section.folders.display_name_placeholder")}
                          className={inputCls}
                        />
                      </div>

                      <div className="space-y-2">
                        <FieldLabel dark={dark}>{t("live_chat_section.folders.assign_to_label")}</FieldLabel>
                        {/* Agent / Team source toggle — internal reference product lets a
                            folder be assigned to an agent or a whole team. */}
                        <div className={cn("inline-flex p-1 rounded-xl border", dark ? "border-slate-800 bg-slate-950/50" : "border-slate-200 bg-slate-50")}>
                          {(["AGENT", "TEAM"] as const).map((src) => (
                            <button
                              key={src}
                              type="button"
                              onClick={() => changeFolderSource(src)}
                              className={cn(
                                "px-5 h-8 rounded-lg text-[11px] font-semibold transition-all",
                                folderSource === src
                                  ? "bg-primary text-white shadow-sm"
                                  : dark ? "text-slate-400 hover:text-slate-200" : "text-slate-500 hover:text-slate-700",
                              )}
                            >
                              {src === "AGENT" ? t("live_chat_section.folders.source_agent") : t("live_chat_section.folders.source_team")}
                            </button>
                          ))}
                        </div>
                        <Select value={folderAssignedTo} onValueChange={setFolderAssignedTo}>
                          <SelectTrigger className={inputCls}>
                            <SelectValue placeholder={folderSource === "TEAM" ? t("live_chat_section.folders.select_team_placeholder") : t("live_chat_section.folders.select_placeholder")} />
                          </SelectTrigger>
                          <SelectContent className={cn("rounded-xl border shadow-2xl", dark ? "bg-[#0f1829] border-slate-800 text-white" : "bg-white border-slate-200")}>
                            {folderSource === "AGENT" ? (
                              <>
                                <SelectItem value="all" className="text-[12px] font-bold">{t("live_chat_section.folders.all_agents")}</SelectItem>
                                {agents.map((a) => (
                                  <SelectItem key={a.id} value={a.id} className="text-[12px] font-bold">{a.label}</SelectItem>
                                ))}
                              </>
                            ) : teams.length === 0 ? (
                              <div className="px-3 py-2 text-[11px] font-medium opacity-60">{t("live_chat_section.folders.no_teams")}</div>
                            ) : (
                              teams.map((tm) => (
                                <SelectItem key={tm.id} value={tm.id} className="text-[12px] font-bold">{tm.label}</SelectItem>
                              ))
                            )}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="flex items-center gap-2 mt-auto pt-4">
                        {editingFolderId !== null && (
                          <button
                            onClick={removeFolder}
                            disabled={deleteFolderMut.isPending}
                            className="h-10 px-5 rounded-xl border border-rose-500/30 text-rose-500 text-[11px] font-semibold transition-all hover:bg-rose-500/10 disabled:opacity-50 flex items-center gap-2"
                          >
                            <Trash2 size={13} /> {t("live_chat_section.folders.delete_button")}
                          </button>
                        )}
                        <div className="flex-1" />
                        <button
                          onClick={() => setFolderFormOpen(false)}
                          className={cn(
                            "h-10 px-5 rounded-xl border text-[11px] font-semibold transition-all",
                            dark
                              ? "border-slate-800 text-slate-300 hover:border-slate-700"
                              : "border-slate-200 text-slate-700 hover:border-slate-300"
                          )}
                        >
                          {t("live_chat_section.folders.cancel_button")}
                        </button>
                        <button
                          onClick={saveFolder}
                          disabled={
                            createFolderMut.isPending ||
                            updateFolderMut.isPending ||
                            !folderName.trim() ||
                            (folderSource === "TEAM" && (!folderAssignedTo || folderAssignedTo === "all"))
                          }
                          className={primaryBtn.replace("h-11", "h-10").replace("px-8", "px-6")}
                        >
                          {createFolderMut.isPending || updateFolderMut.isPending ? t("live_chat_section.folders.saving_button") : t("live_chat_section.folders.save_button")}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center text-center flex-1 py-6 gap-4">
                      <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center">
                        <Folder className="w-6 h-6 text-primary" />
                      </div>
                      <p className={cn("text-[12px] font-medium opacity-70 max-w-[220px] leading-relaxed", sub)}>
                        {t("live_chat_section.folders.empty_state_description")}
                      </p>
                      <button
                        onClick={openAddFolder}
                        className={cn(
                          "h-10 px-5 rounded-xl border text-[11px] font-semibold transition-all flex items-center gap-2",
                          "border-primary/40 text-primary hover:bg-primary hover:text-white"
                        )}
                      >
                        <Plus size={12} /> {t("live_chat_section.folders.add_folder_button")}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </TabsContent>

            {/* ── PAUSE TAB ── */}
            <TabsContent value="pause" className="p-6 outline-none space-y-5">
              <h3 className={cn("text-[14px] font-semibold", text)}>
                {t("live_chat_section.pause.question")}
              </h3>

              <div className={cn("rounded-[1.5rem] border overflow-hidden", softBg, softBorder)}>
                <RadioRow
                  dark={dark}
                  active={pauseSmartFlow === "keep"}
                  onClick={() => setPauseSmartFlow("keep")}
                  label={t("live_chat_section.pause.manually_label")}
                  description={t("live_chat_section.pause.manually_description")}
                />
                <div className="border-t" style={{ borderColor: dark ? "rgb(30 41 59)" : "rgb(241 245 249)" }} />
                <RadioRow
                  dark={dark}
                  active={pauseSmartFlow === "automatically"}
                  onClick={() => setPauseSmartFlow("automatically")}
                  label={t("live_chat_section.pause.automatically_label")}
                  description={t("live_chat_section.pause.automatically_description")}
                />
              </div>

              <SaveFooter
                dark={dark}
                onClick={() => updateMutation.mutate({ pauseSmartFlow })}
                loading={updateMutation.isPending}
                primaryBtn={primaryBtn}
                t={t}
              />
            </TabsContent>
          </Tabs>
        </div>
      </CardContent>
    </Card>
  );
}

/* ── Helpers ── */

function SectionHeading({ dark, title, description, badge }: { dark: boolean; title: string; description?: string; badge?: string }) {
  const text = dark ? "text-white" : "text-slate-900";
  const sub  = dark ? "text-slate-500" : "text-slate-400";
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2.5">
        <h3 className={cn("text-[14px] font-semibold", text)}>{title}</h3>
        {badge && (
          <span className={cn(
            "text-[10px] font-semibold px-2 py-0.5 rounded-md",
            dark ? "bg-slate-800 text-slate-400" : "bg-slate-100 text-slate-500"
          )}>
            {badge}
          </span>
        )}
      </div>
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

function OptionCard({
  dark,
  active,
  onClick,
  icon,
  title,
  description,
  recommended,
  recommendedLabel,
}: {
  dark: boolean;
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  title: string;
  description: string;
  recommended?: boolean;
  recommendedLabel?: string;
}) {
  const text = dark ? "text-white" : "text-slate-900";
  const sub  = dark ? "text-slate-500" : "text-slate-400";
  return (
    <div
      onClick={onClick}
      className={cn(
        "p-5 rounded-[1.5rem] border cursor-pointer transition-all relative group",
        active
          ? "border-primary/50 bg-primary/5 shadow-md shadow-primary/10"
          : dark
            ? "border-slate-800 hover:border-slate-700"
            : "border-slate-200 hover:border-primary/30"
      )}
    >
      <div className="flex items-start gap-4">
        <div
          className={cn(
            "w-10 h-10 rounded-xl flex items-center justify-center transition-all shrink-0",
            active ? "bg-primary text-white shadow-lg shadow-primary/30" : "bg-primary/10 text-primary"
          )}
        >
          {icon}
        </div>
        <div className="flex-1 pr-6">
          <p className={cn("text-[13px] font-black tracking-tight", text)}>{title}</p>
          <p className={cn("text-[11px] font-medium opacity-60 mt-1 leading-relaxed", sub)}>{description}</p>
          {recommended && (
            <span className="inline-block mt-2.5 text-[10px] font-bold px-2 py-0.5 rounded-md bg-primary/10 text-primary">
              {recommendedLabel}
            </span>
          )}
        </div>
      </div>
      <div
        className={cn(
          "absolute top-5 right-5 w-4 h-4 rounded-full border-2 flex items-center justify-center transition-colors",
          active ? "border-primary" : dark ? "border-slate-700" : "border-slate-300"
        )}
      >
        {active && <div className="w-2 h-2 rounded-full bg-primary" />}
      </div>
    </div>
  );
}

function RadioRow({
  dark,
  active,
  onClick,
  label,
  description,
}: {
  dark: boolean;
  active: boolean;
  onClick: () => void;
  label: string;
  description: string;
}) {
  const text = dark ? "text-white" : "text-slate-900";
  const sub  = dark ? "text-slate-500" : "text-slate-400";
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-4 px-6 py-4 text-left transition-all",
        active
          ? "bg-primary/5"
          : dark
            ? "hover:bg-slate-900/40"
            : "hover:bg-slate-100/60"
      )}
    >
      <div
        className={cn(
          "w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors",
          active ? "border-primary" : dark ? "border-slate-700" : "border-slate-300"
        )}
      >
        {active && <div className="w-2 h-2 rounded-full bg-primary" />}
      </div>
      <span className={cn("text-[12px] font-black tracking-tight w-32 shrink-0", active ? "text-primary" : text)}>
        {label}
      </span>
      <span className={cn("text-[11px] font-medium opacity-60 flex-1", sub)}>{description}</span>
    </button>
  );
}

function SignaturePhonePreview({
  dark,
  signatureName,
  showSignature,
  t,
}: {
  dark: boolean;
  signatureName: string;
  showSignature: boolean;
  t: (key: string) => string;
}) {
  return (
    <div className="relative">
      {/* Phone frame */}
      <div className={cn(
        "w-[190px] h-[380px] rounded-[2rem] border-[6px] shadow-2xl overflow-hidden flex flex-col",
        dark ? "border-slate-900 bg-slate-900" : "border-slate-900 bg-slate-900"
      )}>
        {/* Status bar */}
        <div className="bg-black text-white px-5 py-2 flex items-center justify-between text-[10px] font-bold shrink-0">
          <span>9:41</span>
          <div className="flex items-center gap-1">
            <div className="w-1 h-1 rounded-full bg-white opacity-80" />
            <div className="w-1 h-1 rounded-full bg-white opacity-80" />
          </div>
        </div>

        {/* WhatsApp header */}
        <div className="bg-[#075E54] text-white px-3 py-2.5 flex items-center gap-2 shrink-0">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="m15 18-6-6 6-6" />
          </svg>
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-pink-400 to-purple-500 flex items-center justify-center text-[10px] font-black">
            M
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-bold leading-tight">{signatureName}</p>
            <p className="text-[9px] opacity-80 leading-tight">{t("live_chat_section.signature.preview_online")}</p>
          </div>
        </div>

        {/* Chat body */}
        <div
          className="flex-1 px-3 py-3 space-y-2 overflow-hidden"
          style={{
            backgroundColor: "#ECE5DD",
            backgroundImage:
              "radial-gradient(circle at 1px 1px, rgba(0,0,0,0.04) 1px, transparent 0)",
            backgroundSize: "10px 10px",
          }}
        >
          {/* Today divider */}
          <div className="flex justify-center pb-1">
            <span className="px-2 py-0.5 rounded-md bg-white/80 text-[9px] font-bold text-slate-600 shadow-sm">{t("live_chat_section.signature.preview_today")}</span>
          </div>

          {/* Customer message */}
          <div className="flex justify-start">
            <div className="bg-white rounded-lg rounded-tl-sm px-2.5 py-1.5 max-w-[80%] shadow-sm">
              <p className="text-[10px] text-slate-800 leading-snug">{t("live_chat_section.signature.preview_customer_message")}</p>
              <p className="text-[8px] text-slate-400 text-right mt-0.5">14:30</p>
            </div>
          </div>

          {/* Agent message */}
          <div className="flex justify-end">
            <div className="bg-[#DCF8C6] rounded-lg rounded-tr-sm px-2.5 py-1.5 max-w-[80%] shadow-sm">
              {showSignature && (
                <p className="text-[9px] font-bold text-teal-700 leading-snug">~ {signatureName}</p>
              )}
              <p className="text-[10px] text-slate-800 leading-snug">{t("live_chat_section.signature.preview_agent_message")}</p>
              <p className="text-[8px] text-slate-500 text-right mt-0.5">14:32 ✓✓</p>
            </div>
          </div>
        </div>
      </div>
    </div>
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
        {t("live_chat_section.footer.scope_note")}
      </p>
      <button onClick={onClick} disabled={loading} className={primaryBtn}>
        {loading ? t("live_chat_section.footer.saving") : t("live_chat_section.footer.save_changes")}
      </button>
    </div>
  );
}
