import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  PhoneIncoming,
  PhoneOutgoing,
  AppWindow,
  MoreVertical,
  Pencil,
  FileText,
  Trash2,
  Play,
  Pause,
  Info,
  ChevronLeft,
  User,
  Settings,
  PhoneForwarded,
  Wand2,
  ListChecks,
  Palette,
  Code,
  AlertTriangle,
  Plus,
  Sparkles,
  Plug,
  AlertCircle,
  Copy,
  Mic,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { cn } from "@/lib/utils";
import { useTheme } from "@/contexts/ThemeContext";
import { getUserInfo, hasAnyPerm } from "@/lib/auth";

const mockVoices = [
  { name: "Alloy", id: "alloy" },
  { name: "Echo", id: "echo" },
  { name: "Fable", id: "fable" },
  { name: "Onyx", id: "onyx" },
  { name: "Nova", id: "nova" },
  { name: "Shimmer", id: "shimmer" },
];

const mockPhones = [
  { id: 1, number: "+1 (555) 123-4567" },
  { id: 2, number: "+1 (555) 987-6543" },
];

const gptModels = [
  { name: "gpt-4o",        value: "gpt-4o" },
  { name: "gpt-4-turbo",   value: "gpt-4-turbo" },
  { name: "gpt-3.5-turbo", value: "gpt-3.5-turbo" },
];

export default function AIVoiceAssistantsSection() {
  const { mode } = useTheme();
  const dark = mode === "dark";
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // AI Feeder access (replyagent $canAny over the feeder permissions).
  const _voicePerms = getUserInfo().permissions ?? [];
  const canManageFeeder = hasAnyPerm(_voicePerms, [
    "workspace.ai.create_feeder",
    "workspace.ai.edit_feeder",
    "workspace.ai.delete_feeder",
  ]);
  // Voice assistant permissions (replyagent AIVoice/Index.vue $can).
  //  - voice.manage → create / edit / status-toggle
  //  - voice.delete → delete
  const canVoiceManage = hasAnyPerm(_voicePerms, ["workspace.ai.voice.manage"]);
  const canVoiceDelete = hasAnyPerm(_voicePerms, ["workspace.ai.voice.delete"]);

  const [viewMode, setViewMode] = useState<"list" | "edit">("list");
  const [editStep, setEditStep] = useState<"type_selection" | "form">("type_selection");
  const [activeTab, setActiveTab] = useState<"personality" | "configurations" | "transfer" | "functions" | "summary" | "design" | "embed">("personality");

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

  const textareaCls = cn(
    "rounded-xl text-[13px] font-medium leading-relaxed resize-none p-4 transition-all",
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

  const { data: agents } = useQuery({
    queryKey: ["/api/ai/voice-assistants"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/ai/voice-assistants");
      return res.json();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number | string) => {
      await apiRequest("DELETE", `/api/ai/voice-assistants/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ai/voice-assistants"] });
      toast({ title: "Deleted", description: "Voice Assistant removed successfully." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to delete voice assistant.", variant: "destructive" });
    },
  });

  const [formData, setFormData] = useState<any>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [agentToDelete, setAgentToDelete] = useState<any>(null);

  const availableCredits = "1645:59";

  const handleEdit = (agent: any) => {
    if (agent) {
      setFormData({
        ...agent,
        voice: agent.voice || "alloy",
        temperature: agent.temperature || 0.7,
        confidence: agent.confidence || 0.7,
        record_calls: agent.record_calls ?? true,
        allowed_minutes_enabled: false,
        automation_enabled: false,
        call_transfer_config: agent.call_transfer_config ? JSON.parse(agent.call_transfer_config) : [],
        design: agent.design ? JSON.parse(agent.design) : { type: "page", bg_type: "color", bg_color: "#ffffff", title: "", subtitle: "" },
      });
      setEditStep("form");
    } else {
      setFormData({
        name: "",
        model: "gpt-4o",
        type: null,
        voice: "alloy",
        temperature: 0.7,
        confidence: 0.7,
        greeting: "",
        instructions: "",
        record_calls: false,
        call_limit: 0,
        call_ending_message: "",
        twilio_number_id: "",
        summary_model: "gpt-3.5-turbo",
        summary_prompt: "",
        generate_summary: false,
        allowed_minutes_enabled: false,
        automation_enabled: false,
        call_transfer_config: [],
        design: { type: "page", bg_type: "color", bg_color: "#2563eb", title: "", subtitle: "" },
      });
      setEditStep("type_selection");
    }
    setViewMode("edit");
    setActiveTab("personality");
  };

  const handleSetType = (type: string) => {
    setFormData({ ...formData, type });
    setEditStep("form");
  };

  const handleStatusToggle = () => {
    toast({ title: "Info", description: "Status toggle for Voice Assistants will be implemented soon." });
  };

  const confirmDelete = () => {
    if (agentToDelete) {
      deleteMutation.mutate(agentToDelete.id);
      setShowDeleteConfirm(false);
      setAgentToDelete(null);
    }
  };

  const handlePublish = () => {
    if (formData?.name?.trim()) {
      toast({ title: "Info", description: "Saving Voice Assistant..." });
      setViewMode("list");
    }
  };

  /* ── EDIT VIEW — TYPE SELECTION ── */
  if (viewMode === "edit" && editStep === "type_selection") {
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
                <Mic className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h1 className={cn("text-[16px] font-bold tracking-tight", text)}>Select Assistant Type</h1>
                <p className={cn("text-[11px] font-bold mt-0.5 opacity-60", sub)}>
                  Choose how this agent will interact.
                </p>
              </div>
            </div>
            <button onClick={() => setViewMode("list")} className={outlineBtn}>
              <ChevronLeft size={12} /> Back
            </button>
          </div>

          <div className="p-8 grid grid-cols-1 md:grid-cols-3 gap-5">
            {([
              { type: "incoming", icon: PhoneIncoming,  title: "Incoming Call", desc: "Handles incoming calls to your phone number." },
              { type: "outgoing", icon: PhoneOutgoing,  title: "Outgoing Call", desc: "Makes outgoing calls to leads or customers." },
              { type: "widget",   icon: AppWindow,      title: "Web Widget",    desc: "Embeds a voice assistant on your website." },
            ] as const).map((item) => (
              <div
                key={item.type}
                className={cn("p-6 rounded-[1.5rem] border transition-all flex flex-col items-center text-center hover:shadow-md hover:border-primary/40", softBg, softBorder)}
              >
                <div className="w-14 h-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mb-4">
                  <item.icon size={22} />
                </div>
                <h4 className={cn("text-[14px] font-semibold", text)}>{item.title}</h4>
                <p className={cn("text-[11px] font-medium opacity-60 mt-1.5 mb-5 leading-relaxed flex-1", sub)}>{item.desc}</p>
                <button onClick={() => handleSetType(item.type)} className={cn(primaryOutlineBtn, "w-full")}>
                  Select
                </button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  /* ── EDIT VIEW — FORM ── */
  if (viewMode === "edit" && editStep === "form" && formData) {
    return (
      <>
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
                  <Mic className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h1 className={cn("text-[16px] font-bold tracking-tight", text)}>
                    {formData.id ? "Edit Voice Assistant" : "New Voice Assistant"}
                  </h1>
                  <p className={cn("text-[11px] font-bold mt-0.5 opacity-60 capitalize", sub)}>
                    {formData.type} Assistant
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => setViewMode("list")} className={outlineBtn}>Cancel</button>
                <button onClick={handlePublish} className={primaryBtn}>
                  <Sparkles size={12} /> Publish
                </button>
              </div>
            </div>

            <Tabs value={activeTab} onValueChange={(v: any) => setActiveTab(v)}>
              <div className={cn("px-8 border-b flex justify-start overflow-x-auto", softBorder)}>
                <TabsList className="h-auto p-0 gap-8 bg-transparent border-none flex justify-start rounded-none">
                  {[
                    { value: "personality",    label: "Personality",    icon: User,            show: true },
                    { value: "configurations", label: "Configurations", icon: Settings,        show: true },
                    { value: "transfer",       label: "Call Transfer",  icon: PhoneForwarded,  show: formData.type !== "widget" },
                    { value: "functions",      label: "Functions",      icon: Wand2,           show: true },
                    { value: "summary",        label: "Summary",        icon: ListChecks,      show: formData.type !== "widget" },
                    { value: "design",         label: "Design",         icon: Palette,         show: formData.type === "widget" },
                    { value: "embed",          label: "Install",        icon: Code,            show: formData.type === "widget" },
                  ].filter((t) => t.show).map((tab) => (
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

              {/* ── PERSONALITY ── */}
              <TabsContent value="personality" className="p-8 outline-none">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-5">
                    <div className="space-y-2">
                      <FieldLabel dark={dark}>Assistant Name</FieldLabel>
                      <Input
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        maxLength={250}
                        className={inputCls}
                      />
                      <p className={cn("text-[10px] font-bold opacity-50 text-right", sub)}>{formData.name.length}/250</p>
                    </div>

                    <div className="space-y-2">
                      <FieldLabel dark={dark}>Select Model</FieldLabel>
                      <Select value={formData.model} onValueChange={(val) => setFormData({ ...formData, model: val })}>
                        <SelectTrigger className={inputCls}>
                          <SelectValue placeholder="Select model" />
                        </SelectTrigger>
                        <SelectContent className={cn("rounded-xl border shadow-2xl", dark ? "bg-[#0f1829] border-slate-800 text-white" : "bg-white border-slate-200")}>
                          {gptModels.map((m) => <SelectItem key={m.value} value={m.value} className="text-[12px] font-bold">{m.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <FieldLabel dark={dark}>Select Voice</FieldLabel>
                      <div className="flex gap-2">
                        <Select value={formData.voice} onValueChange={(val) => setFormData({ ...formData, voice: val })}>
                          <SelectTrigger className={cn(inputCls, "flex-1")}>
                            <SelectValue placeholder="Select voice" />
                          </SelectTrigger>
                          <SelectContent className={cn("rounded-xl border shadow-2xl", dark ? "bg-[#0f1829] border-slate-800 text-white" : "bg-white border-slate-200")}>
                            {mockVoices.map((v) => <SelectItem key={v.id} value={v.id} className="text-[12px] font-bold">{v.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                        <button
                          type="button"
                          onClick={() => setIsPlaying(!isPlaying)}
                          className={cn("w-11 h-11 rounded-xl border flex items-center justify-center transition-all shrink-0", dark ? "border-slate-800 hover:border-primary/40 hover:text-primary" : "border-slate-200 hover:border-primary/40 hover:text-primary")}
                        >
                          {isPlaying ? <Pause size={14} /> : <Play size={14} />}
                        </button>
                      </div>
                    </div>

                    <SliderRow
                      dark={dark}
                      label="Temperature"
                      value={formData.temperature}
                      min={0} max={1} step={0.1}
                      onChange={(v) => setFormData({ ...formData, temperature: v })}
                      leftLabel="Precise"
                      rightLabel="Creative"
                    />
                  </div>

                  <div className="space-y-5">
                    <div className="space-y-2">
                      <FieldLabel dark={dark}>
                        {formData.type === "outgoing" ? "Outgoing Call Greeting" : "Incoming Call Greeting"}
                      </FieldLabel>
                      <Textarea
                        rows={4}
                        value={formData.greeting}
                        onChange={(e) => setFormData({ ...formData, greeting: e.target.value })}
                        maxLength={2500}
                        placeholder="Hello, how can I help you today?"
                        className={textareaCls}
                      />
                      <p className={cn("text-[10px] font-bold opacity-50 text-right", sub)}>{formData.greeting?.length || 0}/2500</p>
                    </div>

                    <div className="space-y-2">
                      <FieldLabel dark={dark}>Instructions</FieldLabel>
                      <Textarea
                        rows={8}
                        value={formData.instructions}
                        onChange={(e) => setFormData({ ...formData, instructions: e.target.value })}
                        maxLength={250000}
                        placeholder="You are a helpful assistant..."
                        className={textareaCls}
                      />
                    </div>
                  </div>
                </div>
              </TabsContent>

              {/* ── CONFIGURATIONS ── */}
              <TabsContent value="configurations" className="p-8 outline-none space-y-6 max-w-4xl">
                {formData.type !== "widget" && (
                  <div className={cn("grid grid-cols-1 md:grid-cols-2 gap-6 pb-6 border-b", softBorder)}>
                    <div className="space-y-2">
                      <FieldLabel dark={dark}>Select Phone Number</FieldLabel>
                      <Select value={formData.twilio_number_id} onValueChange={(val) => setFormData({ ...formData, twilio_number_id: val })}>
                        <SelectTrigger className={inputCls}>
                          <SelectValue placeholder="Select number" />
                        </SelectTrigger>
                        <SelectContent className={cn("rounded-xl border shadow-2xl", dark ? "bg-[#0f1829] border-slate-800 text-white" : "bg-white border-slate-200")}>
                          {mockPhones.map((p) => <SelectItem key={p.id} value={p.id.toString()} className="text-[12px] font-bold">{p.number}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className={cn("p-4 rounded-[1.25rem] border flex items-center gap-3", softBg, softBorder)}>
                      <Switch checked={formData.record_calls} onCheckedChange={(val) => setFormData({ ...formData, record_calls: val })} className="data-[state=checked]:bg-primary" />
                      <span className={cn("text-[12px] font-black tracking-tight", text)}>Record Calls</span>
                    </div>
                  </div>
                )}

                <div className={cn("grid grid-cols-1 md:grid-cols-2 gap-6 pb-6 border-b", softBorder)}>
                  <div className="space-y-2">
                    <FieldLabel dark={dark}>Call Duration Limit (seconds)</FieldLabel>
                    <Input
                      type="number"
                      value={formData.call_limit}
                      onChange={(e) => setFormData({ ...formData, call_limit: e.target.value })}
                      className={inputCls}
                    />
                  </div>
                </div>

                <div className={cn("pb-6 border-b", softBorder)}>
                  <div className="space-y-2">
                    <FieldLabel dark={dark}>Call Ending Message</FieldLabel>
                    <Textarea
                      rows={3}
                      value={formData.call_ending_message}
                      onChange={(e) => setFormData({ ...formData, call_ending_message: e.target.value })}
                      className={textareaCls}
                    />
                  </div>
                </div>

                <div className={cn("pb-6 border-b", softBorder)}>
                  <div className="space-y-2">
                    <FieldLabel dark={dark}>Select Knowledge Bases</FieldLabel>
                    <Select>
                      <SelectTrigger className={inputCls}>
                        <SelectValue placeholder="Select knowledge bases" />
                      </SelectTrigger>
                      <SelectContent className={cn("rounded-xl border shadow-2xl", dark ? "bg-[#0f1829] border-slate-800 text-white" : "bg-white border-slate-200")}>
                        <SelectItem value="kb1" className="text-[12px] font-bold">Marketing Docs</SelectItem>
                        <SelectItem value="kb2" className="text-[12px] font-bold">Support FAQs</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <SliderRow
                  dark={dark}
                  label="Confidence Threshold"
                  value={formData.confidence}
                  min={0} max={1} step={0.1}
                  onChange={(v) => setFormData({ ...formData, confidence: v })}
                  leftLabel="Low"
                  rightLabel="High"
                />
              </TabsContent>

              {/* ── CALL TRANSFER ── */}
              <TabsContent value="transfer" className="p-8 outline-none space-y-5">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <h4 className={cn("text-[13px] font-semibold", text)}>Call Transfer Rules</h4>
                    <p className={cn("text-[11px] font-medium opacity-60 mt-0.5", sub)}>
                      Define when to transfer calls to a human agent.
                    </p>
                  </div>
                  <button
                    onClick={() => setFormData({
                      ...formData,
                      call_transfer_config: [...(formData.call_transfer_config || []), { description: "", number: "" }],
                    })}
                    className={primaryOutlineBtn}
                  >
                    <Plus size={12} /> Add Rule
                  </button>
                </div>

                <div className="p-4 rounded-[1.25rem] bg-amber-500/10 border border-amber-500/20 flex items-start gap-3">
                  <AlertTriangle size={14} className="text-amber-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-[12px] font-semibold text-amber-600 dark:text-amber-400">Attention Needed</p>
                    <p className="text-[11px] font-medium text-amber-700/80 dark:text-amber-300/80 mt-1 leading-relaxed">
                      Ensure your Twilio account is configured to handle SIP transfers if required.
                    </p>
                  </div>
                </div>

                {formData.call_transfer_config?.length > 0 ? (
                  <div className="space-y-3">
                    {formData.call_transfer_config.map((conf: any, index: number) => (
                      <div key={index} className={cn("flex flex-col md:flex-row gap-3 items-start p-4 rounded-[1.25rem] border", softBg, softBorder)}>
                        <div className="flex-1 w-full space-y-2">
                          <FieldLabel dark={dark}>Description</FieldLabel>
                          <Textarea
                            placeholder="e.g. User asks to speak to a manager"
                            rows={2}
                            value={conf.description}
                            onChange={(e) => {
                              const newConf = [...formData.call_transfer_config];
                              newConf[index].description = e.target.value;
                              setFormData({ ...formData, call_transfer_config: newConf });
                            }}
                            className={textareaCls}
                          />
                        </div>
                        <div className="w-full md:w-1/3 space-y-2">
                          <FieldLabel dark={dark}>Destination</FieldLabel>
                          <Select value={conf.number} onValueChange={(val) => {
                            const newConf = [...formData.call_transfer_config];
                            newConf[index].number = val;
                            setFormData({ ...formData, call_transfer_config: newConf });
                          }}>
                            <SelectTrigger className={inputCls}>
                              <SelectValue placeholder="Select agent" />
                            </SelectTrigger>
                            <SelectContent className={cn("rounded-xl border shadow-2xl", dark ? "bg-[#0f1829] border-slate-800 text-white" : "bg-white border-slate-200")}>
                              <SelectItem value="+15550001111" className="text-[12px] font-bold">Agent Smith (+15550001111)</SelectItem>
                              <SelectItem value="+15550002222" className="text-[12px] font-bold">Support Desk (+15550002222)</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <button
                          onClick={() => {
                            const newConf = formData.call_transfer_config.filter((_: any, i: number) => i !== index);
                            setFormData({ ...formData, call_transfer_config: newConf });
                          }}
                          className={cn("w-10 h-10 rounded-xl border flex items-center justify-center transition-all md:mt-7 shrink-0 self-end md:self-auto", dark ? "border-slate-800 hover:bg-rose-500 hover:border-rose-500 hover:text-white text-rose-500" : "border-slate-200 hover:bg-rose-500 hover:border-rose-500 hover:text-white text-rose-500")}
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className={cn("py-12 text-center rounded-[1.5rem] border-2 border-dashed", softBorder, softBg)}>
                    <PhoneForwarded size={24} className="mx-auto text-primary/40 mb-3" />
                    <p className={cn("text-[11px] font-bold opacity-60", sub)}>No transfer rules configured.</p>
                  </div>
                )}
              </TabsContent>

              {/* ── FUNCTIONS ── */}
              <TabsContent value="functions" className="p-8 outline-none">
                <div className="flex flex-col items-center justify-center text-center space-y-4 py-10">
                  <div className="w-14 h-14 bg-primary/10 rounded-2xl flex items-center justify-center text-primary">
                    <Wand2 size={22} />
                  </div>
                  <div className="space-y-1 max-w-md">
                    <h3 className={cn("text-[14px] font-semibold", text)}>Function Calling</h3>
                    <p className={cn("text-[11px] font-medium opacity-60 leading-relaxed", sub)}>
                      Define custom functions that the AI can call to interact with your business logic or external APIs.
                    </p>
                  </div>
                  <button onClick={() => toast({ title: "Functions", description: "Custom function creator coming soon." })} className={primaryOutlineBtn}>
                    <Plus size={12} /> Add Function
                  </button>
                </div>
              </TabsContent>

              {/* ── SUMMARY ── */}
              <TabsContent value="summary" className="p-8 outline-none space-y-5 max-w-3xl">
                <div className={cn("p-5 rounded-[1.25rem] border flex items-center gap-4", softBg, softBorder)}>
                  <Switch checked={formData.generate_summary} onCheckedChange={(val) => setFormData({ ...formData, generate_summary: val })} className="data-[state=checked]:bg-primary" />
                  <div className="flex-1">
                    <p className={cn("text-[13px] font-black tracking-tight", text)}>Generate Call Summary</p>
                    <p className={cn("text-[11px] font-medium opacity-60 mt-0.5", sub)}>
                      Automatically generate a summary after the call ends.
                    </p>
                  </div>
                </div>

                {formData.generate_summary && (
                  <div className={cn("p-5 rounded-[1.25rem] border space-y-5", softBg, softBorder)}>
                    <div className="space-y-2">
                      <FieldLabel dark={dark}>Summary Model</FieldLabel>
                      <Select value={formData.summary_model} onValueChange={(val) => setFormData({ ...formData, summary_model: val })}>
                        <SelectTrigger className={inputCls}>
                          <SelectValue placeholder="Select model" />
                        </SelectTrigger>
                        <SelectContent className={cn("rounded-xl border shadow-2xl", dark ? "bg-[#0f1829] border-slate-800 text-white" : "bg-white border-slate-200")}>
                          <SelectItem value="gpt-3.5-turbo" className="text-[12px] font-bold">GPT-3.5 Turbo</SelectItem>
                          <SelectItem value="gpt-4o" className="text-[12px] font-bold">GPT-4o</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <FieldLabel dark={dark}>Summary Prompt / Instructions</FieldLabel>
                      <Textarea
                        rows={6}
                        placeholder="Summarize the call focusing on action items..."
                        value={formData.summary_prompt}
                        onChange={(e) => setFormData({ ...formData, summary_prompt: e.target.value })}
                        className={textareaCls}
                      />
                    </div>
                  </div>
                )}
              </TabsContent>

              {/* ── DESIGN (Widget) ── */}
              <TabsContent value="design" className="p-8 outline-none">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-5">
                    <h4 className={cn("text-[13px] font-semibold pb-2 border-b", text, softBorder)}>Widget Appearance</h4>

                    <div className="space-y-2">
                      <FieldLabel dark={dark}>Title</FieldLabel>
                      <Input value={formData.design.title} onChange={(e) => setFormData({ ...formData, design: { ...formData.design, title: e.target.value } })} placeholder="AI Assistant" className={inputCls} />
                    </div>

                    <div className="space-y-2">
                      <FieldLabel dark={dark}>Subtitle</FieldLabel>
                      <Input value={formData.design.subtitle} onChange={(e) => setFormData({ ...formData, design: { ...formData.design, subtitle: e.target.value } })} placeholder="How can I help you?" className={inputCls} />
                    </div>

                    <div className="space-y-2">
                      <FieldLabel dark={dark}>Background Type</FieldLabel>
                      <div className="flex gap-2 flex-wrap">
                        {(["color", "image", "video", "transparent"] as const).map((t) => {
                          const active = formData.design.bg_type === t;
                          return (
                            <button
                              key={t}
                              onClick={() => setFormData({ ...formData, design: { ...formData.design, bg_type: t } })}
                              className={cn(
                                "h-9 px-4 rounded-lg text-[11px] font-semibold border transition-all capitalize",
                                active
                                  ? "border-primary text-primary bg-primary/5"
                                  : dark ? "border-slate-800 text-slate-400 hover:border-primary/40" : "border-slate-200 text-slate-500 hover:border-primary/40"
                              )}
                            >
                              {t}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {formData.design.bg_type === "color" && (
                      <div className="space-y-2">
                        <FieldLabel dark={dark}>Background Color</FieldLabel>
                        <div className={cn("flex items-center gap-3 px-3 h-11 rounded-xl border", dark ? "bg-slate-950/50 border-slate-800" : "bg-white border-slate-200")}>
                          <div className="w-7 h-7 rounded-lg border shrink-0" style={{ backgroundColor: formData.design.bg_color, borderColor: "rgba(0,0,0,0.1)" }} />
                          <Input value={formData.design.bg_color} onChange={(e) => setFormData({ ...formData, design: { ...formData.design, bg_color: e.target.value } })} className={cn("flex-1 h-full border-0 rounded-none focus-visible:ring-0 text-[12px] font-black", text)} />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Preview */}
                  <div className={cn("rounded-[1.5rem] border p-6 flex items-center justify-center", softBg, softBorder)}>
                    <div className={cn("w-[260px] h-[440px] rounded-2xl border shadow-xl overflow-hidden flex flex-col", card, border)}>
                      <div
                        className="h-28 flex items-center justify-center text-white p-4 text-center"
                        style={{ backgroundColor: formData.design.bg_type === "color" ? formData.design.bg_color : "#2563eb" }}
                      >
                        <div>
                          <h3 className="font-black text-[13px]">{formData.design.title || "AI Assistant"}</h3>
                          <p className="text-[11px] opacity-90 mt-0.5">{formData.design.subtitle || "How can I help you?"}</p>
                        </div>
                      </div>
                      <div className={cn("flex-1 flex flex-col items-center justify-center", softBg)}>
                        <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mb-3 animate-pulse">
                          <div className="w-2.5 h-2.5 bg-primary rounded-full" />
                        </div>
                        <p className={cn("text-[11px] font-medium opacity-60", sub)}>Listening...</p>
                      </div>
                      <div className="p-4 border-t flex justify-center" style={{ borderColor: dark ? "rgb(30 41 59)" : "rgb(241 245 249)" }}>
                        <div className="w-10 h-10 rounded-full bg-rose-500 flex items-center justify-center text-white shadow-lg shadow-rose-500/20">
                          <PhoneIncoming size={16} className="rotate-[135deg]" />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </TabsContent>

              {/* ── EMBED ── */}
              <TabsContent value="embed" className="p-8 outline-none space-y-5">
                <div className={cn("p-5 rounded-[1.25rem] border", softBg, softBorder)}>
                  <h4 className={cn("text-[13px] font-semibold mb-3", text)}>Embed Code</h4>
                  <pre className={cn("text-[11px] font-mono p-4 rounded-xl whitespace-pre-wrap mb-4 overflow-x-auto", dark ? "bg-slate-950 text-slate-200 border border-slate-800" : "bg-slate-900 text-slate-100")}>
{`<script>
  window.voiceWidgetSettings = {
    agentId: "123456789",
    primaryColor: "${formData.design.bg_color || '#2563eb'}"
  };
</script>
<script src="https://cdn.example.com/voice-widget.js" async></script>`}
                  </pre>
                  <button
                    onClick={() => toast({ title: "Copied", description: "Embed code copied to clipboard." })}
                    className={primaryOutlineBtn}
                  >
                    <Copy size={12} /> Copy Code
                  </button>
                </div>
              </TabsContent>
            </Tabs>

            {/* Footer */}
            <div className={cn("px-6 py-4 border-t flex justify-end gap-2", border, softBg)}>
              <button onClick={() => setViewMode("list")} className={outlineBtn}>Cancel</button>
              <button onClick={handlePublish} className={primaryBtn}>
                <Sparkles size={12} /> Publish
              </button>
            </div>
          </CardContent>
        </Card>

        {/* Delete Dialog */}
        <DeleteDialog
          open={showDeleteConfirm}
          onOpenChange={setShowDeleteConfirm}
          agent={agentToDelete}
          card={card}
          border={border}
          text={text}
          sub={sub}
          outlineBtn={outlineBtn}
          onConfirm={confirmDelete}
        />
      </>
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
                <Mic className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h1 className={cn("text-[16px] font-bold tracking-tight", text)}>AI voice assistants</h1>
                <p className={cn("text-[11px] font-medium mt-0.5 opacity-60", sub)}>
                  Manage your voice assistants.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className={cn("flex items-center gap-2 px-3 h-10 rounded-xl border text-[11px] font-semibold", dark ? "border-slate-800 bg-slate-950/50 text-slate-300" : "border-slate-200 bg-slate-50 text-slate-600")}>
                <span className="opacity-60">Credits:</span>
                <span className={text}>{availableCredits}</span>
                <span className="opacity-60">mins/secs</span>
              </div>
              {canVoiceManage && (
                <button onClick={() => handleEdit(null)} className={primaryOutlineBtn}>
                  <Plus size={12} /> Add Assistant
                </button>
              )}
            </div>
          </div>

          {/* Body */}
          <div className="p-6">
            {!agents || agents.length === 0 ? (
              <div className={cn("rounded-[1.5rem] border py-16 px-8 flex flex-col items-center justify-center text-center space-y-5", softBg, softBorder)}>
                <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
                  <Mic className="w-8 h-8 text-primary" />
                </div>
                <div className="space-y-1.5 max-w-sm">
                  <h3 className={cn("text-[14px] font-black tracking-tight", text)}>Create your first AI Voice Assistant</h3>
                  <p className={cn("text-[11px] font-medium opacity-60 leading-relaxed", sub)}>
                    Get started by creating a new voice assistant.
                  </p>
                </div>
                <button onClick={() => handleEdit(null)} className={primaryOutlineBtn}>
                  <Plus size={12} /> Add Assistant
                </button>
              </div>
            ) : (
              <div className={cn("rounded-[1.5rem] border overflow-hidden", softBorder, softBg)}>
                <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className={cn("border-b", softBorder, dark ? "bg-slate-900/30" : "bg-white/60")}>
                      <th className={cn("py-4 px-6 text-left text-[11px] font-semibold", sub)}>Name</th>
                      <th className={cn("py-4 px-6 text-left text-[11px] font-semibold", sub)}>Model</th>
                      <th className={cn("py-4 px-6 text-left text-[11px] font-semibold", sub)}>Phone</th>
                      <th className={cn("py-4 px-6 text-left text-[11px] font-semibold", sub)}>Type</th>
                      <th className={cn("py-4 px-6 text-left text-[11px] font-semibold", sub)}>Status</th>
                      <th className={cn("py-4 px-6 text-right text-[11px] font-semibold", sub)}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {agents.map((agent: any) => (
                      <tr key={agent.id} className={cn("border-b last:border-0 transition-colors", softBorder, dark ? "hover:bg-slate-900/40" : "hover:bg-white/60")}>
                        <td className={cn("py-3 px-6 text-[12px] font-black", text)}>{agent.name}</td>
                        <td className="py-3 px-6">
                          <Badge variant="outline" className="h-5 px-2 rounded-md border-primary/20 bg-primary/5 text-primary text-[10px] font-semibold">
                            {agent.model}
                          </Badge>
                        </td>
                        <td className={cn("py-3 px-6 text-[12px] font-bold opacity-70", text)}>{agent.phone_number || "—"}</td>
                        <td className="py-3 px-6">
                          <div className="flex items-center gap-1.5">
                            {agent.type === "incoming" && <PhoneIncoming size={12} className="text-blue-500" />}
                            {agent.type === "outgoing" && <PhoneOutgoing size={12} className="text-emerald-500" />}
                            {agent.type === "widget"   && <AppWindow size={12} className="text-purple-500" />}
                            <span className={cn("text-[12px] font-semibold capitalize", text)}>{agent.type}</span>
                          </div>
                        </td>
                        <td className="py-3 px-6">
                          <Switch
                            checked={agent.status === "ACTIVE"}
                            disabled={!canVoiceManage}
                            onCheckedChange={handleStatusToggle}
                            className="data-[state=checked]:bg-primary"
                          />
                        </td>
                        <td className="py-3 px-6 text-right">
                          <div className="flex items-center justify-end gap-1">
                            {canVoiceManage && (
                              <button
                                onClick={() => handleEdit(agent)}
                                className={cn("w-8 h-8 rounded-lg flex items-center justify-center transition-all", dark ? "hover:bg-primary/10 hover:text-primary text-slate-400" : "hover:bg-primary/10 hover:text-primary text-slate-500")}
                              >
                                <Pencil size={12} />
                              </button>
                            )}
                            <button
                              onClick={() => toast({ title: "Logs", description: `Opening logs for ${agent.name}` })}
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
                                    onClick={() => toast({ title: "AI Feeder", description: `Opening AI Feeder for ${agent.name}` })}
                                    className="rounded-lg py-2 cursor-pointer gap-2 font-bold text-[11px]"
                                  >
                                    <Plug size={12} /> AI Feeder
                                  </DropdownMenuItem>
                                )}
                                {canVoiceDelete && (
                                  <DropdownMenuItem
                                    onClick={() => { setAgentToDelete(agent); setShowDeleteConfirm(true); }}
                                    className="rounded-lg py-2 cursor-pointer gap-2 font-bold text-[11px] text-rose-500"
                                  >
                                    <Trash2 size={12} /> Delete
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

      <DeleteDialog
        open={showDeleteConfirm}
        onOpenChange={setShowDeleteConfirm}
        agent={agentToDelete}
        card={card}
        border={border}
        text={text}
        sub={sub}
        outlineBtn={outlineBtn}
        onConfirm={confirmDelete}
      />
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
  const sub = dark ? "text-slate-500" : "text-slate-400";
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

function DeleteDialog({
  open,
  onOpenChange,
  agent,
  card,
  border,
  text,
  sub,
  outlineBtn,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (b: boolean) => void;
  agent: any;
  card: string;
  border: string;
  text: string;
  sub: string;
  outlineBtn: string;
  onConfirm: () => void;
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className={cn("rounded-[2rem] border p-0 max-w-md overflow-hidden", card, border)}>
        <div className="p-6 space-y-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-500/10 flex items-center justify-center text-rose-500">
              <AlertCircle size={18} />
            </div>
            <div>
              <h2 className={cn("text-[14px] font-semibold", text)}>Delete Voice Assistant?</h2>
              <p className={cn("text-[11px] font-medium opacity-60 mt-0.5 leading-relaxed", sub)}>
                <span className="text-rose-500 font-black">"{agent?.name}"</span> will be permanently removed and the associated phone number will be disconnected.
              </p>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <AlertDialogCancel className={cn(outlineBtn, "m-0")}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={onConfirm}
              className="h-11 px-7 rounded-xl bg-rose-500 hover:bg-rose-600 text-white text-[11px] font-semibold transition-all shadow-lg shadow-rose-500/20 flex items-center gap-2"
            >
              <Trash2 size={12} /> Delete
            </AlertDialogAction>
          </div>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
}
