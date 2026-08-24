import { useState } from "react";
import {
  Users, User, UserPlus, Settings, Phone, ShieldCheck,
  Info, MessageSquare, Users2, Smartphone,
  CheckCircle2, Zap, Plus, Search, ChevronLeft, Activity,
  Shield, LayoutGrid, Globe, Fingerprint, Lock,
  ShieldAlert, Check, Pencil, Mail, Sparkles,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { cn } from "@/lib/utils";
import { useTheme } from "@/contexts/ThemeContext";
import { phoneError } from "@/lib/phone";
import { PhoneInputWithFlag } from "@/components/PhoneInputWithFlag";

interface Agent {
  id: string;
  name: string;
  email: string;
  status: string;
  role: string;
  original: any;
}

const AVATAR_COLORS = [
  { bg: "bg-violet-500/15",  text: "text-violet-600 dark:text-violet-400" },
  { bg: "bg-blue-500/15",    text: "text-blue-600 dark:text-blue-400" },
  { bg: "bg-emerald-500/15", text: "text-emerald-600 dark:text-emerald-400" },
  { bg: "bg-amber-500/15",   text: "text-amber-600 dark:text-amber-400" },
  { bg: "bg-rose-500/15",    text: "text-rose-600 dark:text-rose-400" },
  { bg: "bg-cyan-500/15",    text: "text-cyan-600 dark:text-cyan-400" },
];

function nameHash(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h << 5) - h + name.charCodeAt(i);
  return Math.abs(h) % AVATAR_COLORS.length;
}

function MemberAvatar({ name, size = "sm" }: { name: string; size?: "sm" | "md" }) {
  const idx = nameHash(name);
  const { bg, text } = AVATAR_COLORS[idx];
  const dim = size === "sm" ? "w-8 h-8 text-[11px]" : "w-10 h-10 text-[13px]";
  return (
    <div className={cn("rounded-xl flex items-center justify-center font-black flex-shrink-0", dim, bg, text)}>
      {name.charAt(0).toUpperCase()}
    </div>
  );
}

export default function ManageAgentSection() {
  const { mode } = useTheme();
  const dark = mode === "dark";
  const { toast } = useToast();

  const [view, setView] = useState<"list" | "add" | "edit">("list");
  const [editingId, setEditingId] = useState<string | number | null>(null);
  // True when editing the workspace owner — role is then locked (replyagent: is_owner).
  const [editingOwner, setEditingOwner] = useState(false);
  const [activeTab, setActiveTab] = useState("agent");
  const [mobileAccess, setMobileAccess] = useState(false);
  const [limitIp, setLimitIp] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  // Login policy: per-weekday hours + ip (replyagent user_login_policies)
  const [loginPolicy, setLoginPolicy] = useState<Record<string, string>>({});
  const setPolicyField = (k: string, v: string) => setLoginPolicy((p) => ({ ...p, [k]: v }));

  const card       = dark ? "bg-[#0f1829]"    : "bg-white";
  const border     = dark ? "border-slate-800" : "border-slate-200";
  const text       = dark ? "text-white"      : "text-slate-900";
  const sub        = dark ? "text-slate-500"  : "text-slate-400";
  const softBg     = dark ? "bg-slate-950/40" : "bg-slate-50/50";
  const softBorder = dark ? "border-slate-800" : "border-slate-100";

  const inputCls = cn(
    "h-11 rounded-xl text-[13px] font-bold transition-all px-4",
    "focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:border-primary/50",
    "placeholder:font-normal [&_[data-placeholder]]:font-normal",
    dark
      ? "bg-slate-950/50 border-slate-800 text-white placeholder:text-slate-600 [&_[data-placeholder]]:text-slate-600"
      : "bg-white border-slate-200 text-slate-900 placeholder:text-slate-400 [&_[data-placeholder]]:text-slate-400"
  );

  const primaryBtn =
    "h-11 px-7 rounded-xl bg-primary hover:bg-primary/90 disabled:opacity-50 text-white text-[11px] font-semibold transition-all shadow-lg shadow-primary/20 flex items-center gap-2";

  const outlineBtn = cn(
    "h-11 px-6 rounded-xl border text-[11px] font-semibold transition-all flex items-center gap-2",
    dark ? "border-slate-800 text-slate-300 hover:border-primary/40 hover:text-primary" : "border-slate-200 text-slate-700 hover:border-primary/40 hover:text-primary"
  );

  const { data: membersData, isLoading } = useQuery<any>({
    queryKey: ["/api/workspaces/members"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/workspaces/members");
      return res.json();
    },
  });

  const { data: tagsApiData } = useQuery<any>({
    queryKey: ["/api/tags/list"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/tags/list");
      return res.json();
    },
  });

  // Real workspace roles (replyagent: role dropdown lists the workspace's acl_roles)
  const { data: rolesApiData } = useQuery<any>({
    queryKey: ["/api/workspaces/all-roles"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/workspaces/all-roles");
      return res.json();
    },
  });
  // Workspace info — for the Login Policy timezone label (replyagent: workspace.timezone).
  const { data: workspaceInfo } = useQuery<any>({
    queryKey: ["/api/workspaces/current"],
    queryFn: async () => (await apiRequest("GET", "/api/workspaces/current")).json(),
  });
  const workspaceTimezone = workspaceInfo?.timezone || "UTC";
  // Only ACTIVE roles are assignable (replyagent: roles.filter(r => r.status === 'ACTIVE')).
  const roles: { id: string; name: string }[] = (rolesApiData?.roles || rolesApiData || [])
    .filter((r: any) => (r.status ? r.status === "ACTIVE" : !r.isArchived))
    .map((r: any) => ({ id: String(r.id), name: r.name || "Role" }));

  // Real data for the agent access-scope tabs (replyagent user_accesses)
  const { data: systemFieldsApi } = useQuery<any>({
    queryKey: ["/api/system-fields"],
    queryFn: async () => (await apiRequest("GET", "/api/system-fields")).json(),
  });
  const { data: customFieldsApi } = useQuery<any>({
    queryKey: ["/api/custom-fields"],
    queryFn: async () => (await apiRequest("GET", "/api/custom-fields")).json(),
  });
  // Real conversation channels for the workspace (replyagent GET /all-channels)
  const { data: allChannelsApi } = useQuery<any>({
    queryKey: ["/api/workspaces/all-channels"],
    queryFn: async () => (await apiRequest("GET", "/api/workspaces/all-channels")).json(),
  });

  const agents: Agent[] = (membersData?.members || membersData || []).map((m: any) => ({
    id: m.id.toString(),
    name: m.full_name || `${m.first_name || ""} ${m.last_name || ""}`.trim(),
    email: m.email,
    status: m.status || "Active",
    role: m.role || "Agent",
    original: m,
  }));

  const filteredAgents = agents.filter(
    (a) =>
      a.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      a.email.toLowerCase().includes(searchTerm.toLowerCase())
  );


  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/workspaces/members", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/workspaces/members"] });
      toast({ title: "Saved", description: "Agent created successfully." });
      resetForm();
      setView("list");
    },
    onError: (err: any) => {
      // Friendlier title for the agents_limit cap (backend throws "Reached the limit").
      const msg: string = err?.message ?? "";
      const isLimit = /reached the limit/i.test(msg);
      toast({
        title: isLimit ? "Agent limit reached" : "Error",
        description: isLimit
          ? "This workspace has hit its maximum number of agents. Increase the limit in the organization edit screen or remove an existing agent first."
          : msg,
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string | number; data: any }) => {
      const res = await apiRequest("PATCH", `/api/workspaces/members/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/workspaces/members"] });
      toast({ title: "Saved", description: "Agent updated successfully." });
      resetForm();
      setView("list");
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string | number) => {
      const res = await apiRequest("DELETE", `/api/workspaces/members/${id}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/workspaces/members"] });
      toast({ title: "Deleted", description: "Agent removed." });
    },
  });

  const [selectedSystemFields, setSelectedSystemFields] = useState<string[]>([]);
  const [selectedCustomFields, setSelectedCustomFields] = useState<string[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedChatAgents, setSelectedChatAgents] = useState<string[]>([]);
  const [selectedChatChannels, setSelectedChatChannels] = useState<string[]>([]);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("");
  const [language, setLanguage] = useState("en-us");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [whatsappNumber, setWhatsappNumber] = useState("");
  // Default country = US (replyagent parity — country_id 204 = United States).
  const [phoneCountry, setPhoneCountry] = useState("US");
  const [whatsappCountry, setWhatsappCountry] = useState("US");
  const [phoneNotifications, setPhoneNotifications] = useState(false);
  const [whatsappNotifications, setWhatsappNotifications] = useState(false);
  const [twoFA, setTwoFA] = useState(false);
  // Per-agent limits (replyagent user_limits) — each independently toggleable
  const [limits, setLimits] = useState({
    enable_conversation: false, conversation_limit: "",
    enable_opportunities: false, opportunities_limit: "",
    enable_tasks: false, tasks_limit: "",
    enable_call_limit: false, calls_limit: "",
  });
  const setLimit = (k: string, v: any) => setLimits((p) => ({ ...p, [k]: v }));

  // Real {id,label} lists for the scope tabs (ids saved into user_accesses)
  const systemFieldsList = (systemFieldsApi?.fields || []).map((f: any) => ({ id: String(f.id), label: f.name || f.slug || "Field" }));
  const customFieldsList = (customFieldsApi?.fields || []).map((f: any) => ({ id: String(f.id), label: f.label || f.name || f.system_name || "Field" }));
  const tagsList = (tagsApiData?.tags || []).map((t: any) => ({ id: String(t.id), label: t.name || "Tag", color: t.bg_color || "#f3f4f6" }));
  const agentsList = agents.map((a) => ({ id: a.id, label: a.name || a.email }));

  // Flatten the real /all-channels payload into one selectable list. Each entry id is
  // encoded as `${type}:${realId}` so ids can't collide across channel types; we decode
  // back into a per-type `channels` object on save (replyagent saveAccessParams).
  const ch = allChannelsApi?.channels || {};
  const channelList: { id: string; label: string; type: string }[] = [
    ...(ch.whatsapp || []).map((c: any) => ({ id: `whatsapp:${c.id}`, type: "whatsapp", label: `${c.verified_name || "WhatsApp"}${c.display_phone_number ? ` - ${c.display_phone_number}` : ""}` })),
    ...(ch.zapi || []).map((c: any) => ({ id: `zapi:${c.id}`, type: "zapi", label: `${c.name || "Z-API"}${c.phone_number ? ` - ${c.phone_number}` : ""}` })),
    ...(ch.telegram || []).map((c: any) => ({ id: `telegram:${c.id}`, type: "telegram", label: c.name || "Telegram" })),
    ...(ch.twilio || []).map((c: any) => ({ id: `twilio:${c.id}`, type: "twilio", label: `${c.account_name || "Twilio"}${c.twilio_phone_number ? ` - ${c.twilio_phone_number}` : ""}` })),
    ...(ch.messenger || []).map((c: any) => ({ id: `messenger:${c.id}`, type: "messenger", label: c.name || "Messenger" })),
    ...(ch.instagram || []).map((c: any) => ({ id: `instagram:${c.id}`, type: "instagram", label: c.name || "Instagram" })),
    ...(ch.webchat || []).map((c: any) => ({ id: `webchat:${c.id}`, type: "webchat", label: c.name || "Webchat" })),
  ];
  // Channel type → icon asset under /images/automations (zapi shares whatsapp, twilio = sms)
  const channelIcon = (type: string) =>
    `/images/automations/${type === "zapi" ? "whatsapp" : type === "twilio" ? "sms" : type}.svg`;

  // Pick black/white text for a tag chip based on its background luminance
  // (replyagent renders tags as their own coloured chips).
  const readableText = (bg: string) => {
    const hex = (bg || "").replace("#", "");
    if (hex.length !== 6) return "#0f172a";
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return lum > 0.6 ? "#0f172a" : "#ffffff";
  };

  const toggleAll = (
    checked: boolean,
    list: string[],
    setter: (v: string[]) => void
  ) => setter(checked ? list : []);

  const toggleItem = (item: string, list: string[], setter: (v: string[]) => void) =>
    setter(list.includes(item) ? list.filter((i) => i !== item) : [...list, item]);

  const resetForm = () => {
    setFirstName("");
    setLastName("");
    setEmail("");
    setRole("");
    setLanguage("en-us");
    setPhoneNumber("");
    setWhatsappNumber("");
    setPhoneCountry("US");
    setWhatsappCountry("US");
    setPhoneNotifications(false);
    setWhatsappNotifications(false);
    setMobileAccess(false);
    setLimitIp(false);
    setLoginPolicy({});
    setTwoFA(false);
    setLimits({
      enable_conversation: false, conversation_limit: "",
      enable_opportunities: false, opportunities_limit: "",
      enable_tasks: false, tasks_limit: "",
      enable_call_limit: false, calls_limit: "",
    });
    setSelectedSystemFields([]);
    setSelectedCustomFields([]);
    setSelectedTags([]);
    setSelectedChatAgents([]);
    setSelectedChatChannels([]);
    setEditingId(null);
    setEditingOwner(false);
    setActiveTab("agent");
  };

  const handleEdit = (agent: Agent) => {
    setEditingId(agent.id);
    const o = agent.original || {};
    setEditingOwner(o.is_owner == 1 || o.is_owner === true);
    const names = agent.name.split(" ");
    setFirstName(o.first_name || names[0] || "");
    setLastName(o.last_name || names.slice(1).join(" ") || "");
    setEmail(agent.email);
    // real role id from the member (no more fragile name-matching)
    setRole(o.role_id ? String(o.role_id) : "");
    setLanguage(o.locale || "en-us");
    setTwoFA(!!o.tfa_required);
    setMobileAccess(o.mobile_access == 1 || o.mobile_access === true);
    setPhoneNumber(o.phone || "");
    setPhoneCountry(o.phone_country || "US");
    setWhatsappNumber(o.whatsapp || "");
    setWhatsappCountry(o.whatsapp_country || "US");
    setPhoneNotifications(!!o.receive_sms_notification);
    setWhatsappNotifications(!!o.receive_whatsapp_notification);
    // Login policy prefill (normalize "HH:MM:SS" → "HH:MM" for the time selects)
    const lp = o.login_policy || {};
    const normalized: Record<string, string> = { ip: lp.ip || "" };
    ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"].forEach((d) => {
      normalized[`${d}_login`] = (lp[`${d}_login`] || "").slice(0, 5);
      normalized[`${d}_logout`] = (lp[`${d}_logout`] || "").slice(0, 5);
    });
    setLoginPolicy(normalized);
    setLimitIp(!!lp.limit_by_ip);
    // Limits prefill
    const li = o.limits || {};
    setLimits({
      enable_conversation: !!li.enable_conversation, conversation_limit: li.conversation_limit ? String(li.conversation_limit) : "",
      enable_opportunities: !!li.enable_opportunities, opportunities_limit: li.opportunities_limit ? String(li.opportunities_limit) : "",
      enable_tasks: !!li.enable_tasks, tasks_limit: li.tasks_limit ? String(li.tasks_limit) : "",
      enable_call_limit: !!li.enable_call_limit, calls_limit: li.calls_limit ? String(li.calls_limit) : "",
    });
    // Access scopes prefill (ids as strings)
    setSelectedSystemFields(Array.isArray(o.systemFields) ? o.systemFields.map(String) : []);
    setSelectedCustomFields(Array.isArray(o.customFields) ? o.customFields.map(String) : []);
    setSelectedTags(Array.isArray(o.tags) ? o.tags.map(String) : []);
    // An agent always keeps access to their own conversations — force self into
    // the selection so the counter and saved payload include it (replyagent: own id pushed on mount).
    setSelectedChatAgents(
      Array.from(new Set([...(Array.isArray(o.agents) ? o.agents.map(String) : []), String(agent.id)])),
    );
    // Channel access prefill — encode the per-type id lists back into `${type}:${id}`
    const chSel: string[] = [];
    const chObj = o.channels || {};
    Object.keys(chObj).forEach((type) => (chObj[type] || []).forEach((id: any) => chSel.push(`${type}:${id}`)));
    setSelectedChatChannels(chSel);
    setView("edit");
  };

  const handleSave = () => {
    if (!firstName.trim() || !email.trim()) {
      toast({
        title: "Validation Error",
        description: "Please fill in First Name and Email.",
        variant: "destructive",
      });
      return;
    }
    // Email must be a valid address (replyagent Vuelidate `email`).
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      toast({
        title: "Validation Error",
        description: "Please enter a valid email address.",
        variant: "destructive",
      });
      return;
    }
    // Block save if a phone/whatsapp number is too short/long (replyagent parity)
    const pErr = phoneError(phoneNumber, phoneCountry);
    const wErr = phoneError(whatsappNumber, whatsappCountry);
    if (pErr || wErr) {
      toast({ title: "Validation Error", description: pErr || wErr, variant: "destructive" });
      return;
    }
    const payload: any = {
      first_name: firstName,
      last_name: lastName,
      email,
      role_id: role || undefined, // real workspace role id (omitted if none picked)
      locale: language,
      tfa_required: twoFA,
      mobile_access: mobileAccess,
      phone: phoneNumber,
      phone_country: phoneCountry,
      whatsapp: whatsappNumber,
      whatsapp_country: whatsappCountry,
      receive_sms_notification: phoneNotifications,
      receive_whatsapp_notification: whatsappNotifications,
      loginPolicy: { ...loginPolicy, limit_by_ip: limitIp },
      limits,
      // access scopes
      systemFields: selectedSystemFields,
      customFields: selectedCustomFields,
      tags: selectedTags,
      agents: selectedChatAgents,
      // per-type channel access (decode `${type}:${id}` back into a channels object;
      // every type sent so deselected channels are revoked — replyagent saveAccessParams)
      channels: (() => {
        const out: Record<string, string[]> = { whatsapp: [], zapi: [], twilio: [], telegram: [], messenger: [], instagram: [], webchat: [] };
        selectedChatChannels.forEach((v) => {
          const idx = v.indexOf(":");
          const type = v.slice(0, idx);
          const id = v.slice(idx + 1);
          if (out[type]) out[type].push(id);
        });
        return out;
      })(),
    };
    if (view === "edit" && editingId) {
      updateMutation.mutate({ id: editingId, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const TIME_OPTIONS = Array.from({ length: 96 }, (_, i) => {
    const h = Math.floor(i / 4).toString().padStart(2, "0");
    const m = ((i % 4) * 15).toString().padStart(2, "0");
    return `${h}:${m}`;
  });

  const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

  /* ── ADD / EDIT VIEW ─────────────────────────────────────────── */
  if (view === "add" || view === "edit") {
    return (
      <Card className={cn("rounded-[2rem] border overflow-hidden shadow-sm transition-all duration-300", card, border)}>
        <CardContent className="p-0">
          {/* Header */}
          <div className={cn("px-8 py-5 border-b flex flex-wrap items-center justify-between gap-3", border)}>
            <div className="flex items-center gap-4">
              <button
                onClick={() => { resetForm(); setView("list"); }}
                className={cn("w-10 h-10 rounded-xl border flex items-center justify-center transition-all", dark ? "border-slate-800 hover:border-primary/40 hover:text-primary" : "border-slate-200 hover:border-primary/40 hover:text-primary")}
              >
                <ChevronLeft size={16} />
              </button>
              <div className={cn("p-2.5 rounded-xl shadow-sm", dark ? "bg-primary/15" : "bg-primary/10")}>
                <UserPlus className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h1 className={cn("text-[16px] font-bold tracking-tight", text)}>
                  {view === "add" ? "Add Agent" : "Edit Agent"}
                </h1>
                <p className={cn("text-[11px] font-bold mt-0.5 opacity-60", sub)}>
                  Add or edit agent details
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => { setView("list"); resetForm(); }} className={outlineBtn}>
                Discard
              </button>
              <button
                onClick={handleSave}
                disabled={createMutation.isPending || updateMutation.isPending}
                className={primaryBtn}
              >
                {createMutation.isPending || updateMutation.isPending ? (
                  <Activity className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <ShieldCheck className="w-3.5 h-3.5" />
                )}
                Save
              </button>
            </div>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              {/* Top tab bar — matches the Live Chat settings page's tab style. */}
              <div className={cn("px-8 border-b flex justify-start overflow-x-auto", border)}>
                <TabsList className="h-auto p-0 gap-6 bg-transparent border-none flex justify-start rounded-none">
                  {[
                    { value: "agent", label: "Agent", icon: User },
                    { value: "2fa", label: "2FA", icon: ShieldCheck },
                    { value: "login", label: "Login Policy", icon: Lock },
                    { value: "system", label: "System Fields", icon: LayoutGrid },
                    { value: "custom", label: "Custom Fields", icon: Settings },
                    { value: "tags", label: "Tags", icon: MessageSquare },
                    { value: "chat-agents", label: "Chat Agents", icon: Users2 },
                    { value: "chat-channels", label: "Chat Channels", icon: Globe },
                  ].map((tab) => (
                    <TabsTrigger
                      key={tab.value}
                      value={tab.value}
                      className={cn(
                        "flex items-center gap-2 px-1 py-4 rounded-none text-[12px] font-semibold transition-all shadow-none bg-transparent border-b-2 border-transparent whitespace-nowrap",
                        "data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-primary data-[state=active]:text-primary",
                        "hover:text-primary",
                        dark ? "text-slate-500" : "text-slate-400"
                      )}
                    >
                      <tab.icon size={14} />
                      {tab.label}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </div>

              <div className="p-8 min-w-0">
                {/* Identity */}
                <TabsContent value="agent" className="m-0 outline-none space-y-8">
                  <SectionHeading dark={dark} title="Agent" description="Basic information about this agent." />

                  {/* Two-column layout mirroring replyagent: left = name fields,
                      right = Phone / WhatsApp (with inline Enable-notifications).
                      Both columns hold exactly 2 rows each so they stay balanced —
                      Email/Role/Interface Language move to their own full-width row
                      below instead of trailing alone in the left column, which used
                      to leave the right column visibly empty underneath. */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-5 max-w-5xl">
                    {/* Left column — name */}
                    <div className="space-y-5">
                      <Field dark={dark} label="First Name" required>
                        <Input value={firstName} maxLength={100} onChange={(e) => setFirstName(e.target.value)} className={inputCls} placeholder="e.g. Jonathan" />
                      </Field>
                      <Field dark={dark} label="Last Name">
                        <Input value={lastName} maxLength={100} onChange={(e) => setLastName(e.target.value)} className={inputCls} placeholder="e.g. Wick" />
                      </Field>
                    </div>

                    {/* Right column — Phone / WhatsApp (replyagent placement) */}
                    <div className="space-y-5">
                      {[
                        { label: "Phone Number", value: phoneNumber, setter: setPhoneNumber, country: phoneCountry, countrySetter: setPhoneCountry, notify: phoneNotifications, notifySetter: setPhoneNotifications, notifyDisabled: false, notifyTip: "Receive SMS notifications for new conversations on this number." },
                        { label: "WhatsApp Number", value: whatsappNumber, setter: setWhatsappNumber, country: whatsappCountry, countrySetter: setWhatsappCountry, notify: whatsappNotifications, notifySetter: setWhatsappNotifications, notifyDisabled: !whatsappNumber.trim(), notifyTip: "Receive WhatsApp notifications for new conversations on this number." },
                      ].map((row) => (
                        <Field key={row.label} dark={dark} label={row.label}>
                          <div className="flex items-center gap-3">
                            <div className="flex-1 min-w-0">
                              <PhoneInputWithFlag
                                country={row.country}
                                onCountryChange={row.countrySetter}
                                value={row.value}
                                onChange={row.setter}
                                inputClassName={inputCls}
                                isDark={dark}
                              />
                              {phoneError(row.value, row.country) && (
                                <p className="text-[11px] text-rose-500 mt-1">{phoneError(row.value, row.country)}</p>
                              )}
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <Switch checked={row.notify} disabled={row.notifyDisabled} onCheckedChange={row.notifySetter} className="data-[state=checked]:bg-primary disabled:opacity-40" />
                              <span className={cn("text-[11px] font-bold flex items-center gap-1 cursor-help whitespace-nowrap", sub)} title={row.notifyTip}>
                                Enable notifications <Info size={11} />
                              </span>
                            </div>
                          </div>
                        </Field>
                      ))}
                    </div>
                  </div>

                  {/* Email / Role / Interface Language — one full-width row. */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-x-6 gap-y-5 max-w-5xl">
                    <Field dark={dark} label="Email Address" required>
                      <Input value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} placeholder="wick@hightable.com" />
                    </Field>
                    <Field dark={dark} label="Role">
                      {editingOwner ? (
                        // Workspace owner's role is locked (replyagent: is_owner → disabled "Workspace Owner").
                        <Input value="Workspace Owner" disabled className={cn(inputCls, "opacity-70")} />
                      ) : (
                        <Select value={role} onValueChange={setRole}>
                          <SelectTrigger className={inputCls}>
                            <SelectValue placeholder="Select role" />
                          </SelectTrigger>
                          <SelectContent className={cn("rounded-xl border shadow-2xl", dark ? "bg-[#0f1829] border-slate-800 text-white" : "bg-white border-slate-200")}>
                            {roles.length === 0 ? (
                              <div className="px-3 py-2 text-[11px] font-medium opacity-60">No roles yet</div>
                            ) : (
                              roles.map((r) => (
                                <SelectItem key={r.id} value={r.id} className="text-[12px] font-bold">{r.name}</SelectItem>
                              ))
                            )}
                          </SelectContent>
                        </Select>
                      )}
                    </Field>
                    {/* Interface Language is only set on create — hidden when editing
                        (replyagent: v-show="!isEditing"). */}
                    {view !== "edit" && (
                      <Field dark={dark} label="Interface Language">
                        <Select value={language} onValueChange={setLanguage}>
                          <SelectTrigger className={inputCls}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className={cn("rounded-xl border shadow-2xl", dark ? "bg-[#0f1829] border-slate-800 text-white" : "bg-white border-slate-200")}>
                            <SelectItem value="en-us" className="text-[12px] font-bold">English (US)</SelectItem>
                            <SelectItem value="pt-br" className="text-[12px] font-bold">Portuguese (Brazil)</SelectItem>
                            <SelectItem value="es" className="text-[12px] font-bold">Spanish</SelectItem>
                          </SelectContent>
                        </Select>
                      </Field>
                    )}
                  </div>

                  {/* Limits (replyagent user_limits) */}
                  <div className="pt-6 border-t space-y-4 max-w-4xl" style={{ borderColor: dark ? "rgb(30 41 59)" : "rgb(241 245 249)" }}>
                    <h4 className={cn("text-[12px] font-semibold", text)}>Limits</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {[
                        { label: "Open conversations", enableKey: "enable_conversation", valueKey: "conversation_limit", tip: "Set a Maximum Limit of Open Conversations for this Agent." },
                        { label: "Open opportunities", enableKey: "enable_opportunities", valueKey: "opportunities_limit", tip: "Set a Maximum Limit of Open Opportunities for this Agent." },
                        { label: "Open tasks", enableKey: "enable_tasks", valueKey: "tasks_limit", tip: "Set a Maximum Limit of Open Tasks for this Agent." },
                        { label: "Incoming calls (Per day)", enableKey: "enable_call_limit", valueKey: "calls_limit", tip: "Set a daily maximum limit for the number of incoming calls that can be assigned to this agent." },
                      ].map((row) => {
                        const enabled = (limits as any)[row.enableKey] as boolean;
                        return (
                          <div key={row.label} className={cn("p-3 rounded-2xl border flex items-center gap-2.5", softBg, softBorder)}>
                            <div className="flex-1 min-w-0 space-y-1">
                              <div className="flex items-center gap-1.5">
                                <FieldLabel dark={dark}>{row.label}</FieldLabel>
                                <span title={row.tip} className="shrink-0 cursor-help"><Info size={11} className={sub} /></span>
                              </div>
                              <Input
                                type="number"
                                min={0}
                                inputMode="numeric"
                                value={(limits as any)[row.valueKey]}
                                onChange={(e) => setLimit(row.valueKey, e.target.value)}
                                placeholder="0"
                                className={cn(inputCls, "h-9")}
                              />
                            </div>
                            <div className="flex items-center pl-2.5 border-l shrink-0" style={{ borderColor: dark ? "rgb(30 41 59)" : "rgb(226 232 240)" }}>
                              <Switch checked={enabled} onCheckedChange={(c) => setLimit(row.enableKey, c)} className="data-[state=checked]:bg-primary" />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </TabsContent>

                {/* Security */}
                <TabsContent value="2fa" className="m-0 outline-none space-y-6">
                  <SectionHeading dark={dark} title="Two factor auth" />

                  <div className={cn("p-6 rounded-[1.5rem] border flex items-start gap-4", softBg, softBorder)}>
                    <div className={cn("w-14 h-14 rounded-xl border flex items-center justify-center shrink-0", dark ? "border-slate-700 bg-slate-950/50" : "border-slate-200 bg-white")}>
                      <Fingerprint size={26} className="text-primary" />
                    </div>
                    <div className="space-y-3 flex-1">
                      <div className="flex items-start gap-4">
                        <div className="flex-1">
                          <p className={cn("text-[13px] font-black tracking-tight", text)}>Require 2-Factor Authentication</p>
                          <p className={cn("text-[11px] font-medium opacity-60 mt-1 leading-relaxed", sub)}>
                            This will force the agent to enable 2-Factor Authentication on their next login.
                          </p>
                        </div>
                        <Switch checked={twoFA} onCheckedChange={setTwoFA} className="data-[state=checked]:bg-primary mt-0.5" />
                      </div>
                      <p className={cn("text-[11px] font-medium opacity-70 leading-relaxed", sub)}>
                        We recommend using{" "}
                        <a href="https://authy.com" target="_blank" rel="noreferrer" className="text-primary font-bold underline">Authy</a>{" "}
                        as your two-factor authentication app.
                      </p>
                    </div>
                  </div>
                </TabsContent>

                {/* Login Policy */}
                <TabsContent value="login" className="m-0 outline-none space-y-6">
                  <div className="flex items-center justify-between gap-4">
                    <SectionHeading dark={dark} title="Login Policy" description="Specify the allowed login hours for this agent in the Workspace." />
                    <div className={cn("px-3 py-1.5 rounded-lg border text-[11px] font-semibold shrink-0", dark ? "bg-slate-950/50 border-slate-800 text-slate-300" : "bg-slate-50 border-slate-200 text-slate-600")}>
                      <Globe className="inline w-3 h-3 mr-1" /> Timezone: {workspaceTimezone}
                    </div>
                  </div>

                  {/* Owner's login policy is locked (replyagent: owner_login_policy_disabled). */}
                  {editingOwner && (
                    <p className="text-[12px] font-bold text-rose-500">
                      The workspace owner's login policy cannot be restricted.
                    </p>
                  )}

                  <div className={cn("rounded-[1.5rem] border overflow-hidden", softBg, softBorder)}>
                    <Table>
                      <TableHeader>
                        <TableRow className={cn("border-b hover:bg-transparent", softBorder)}>
                          <TableHead className={cn("py-4 px-6 text-[11px] font-semibold", sub)}>Day</TableHead>
                          <TableHead className={cn("py-4 px-6 text-[11px] font-semibold", sub)}>Login allowed from</TableHead>
                          <TableHead className={cn("py-4 px-6 text-[11px] font-semibold", sub)}>Logout at</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {DAYS.map((day) => {
                          const k = day.toLowerCase();
                          const loginVal = loginPolicy[`${k}_login`] || "";
                          // Logout only selectable once a login time is set, and only for later times (replyagent parity)
                          const logoutOptions = loginVal ? TIME_OPTIONS.filter((t) => t > loginVal) : [];
                          return (
                          <TableRow key={day} className={cn("border-b last:border-0 hover:bg-transparent", softBorder)}>
                            <TableCell className={cn("py-3 px-6 text-[12px] font-black", text)}>{day}</TableCell>
                            <TableCell className="py-3 px-6">
                              <Select
                                value={loginVal}
                                disabled={editingOwner}
                                onValueChange={(v) => {
                                  setPolicyField(`${k}_login`, v);
                                  // Clear logout if it is no longer after the new login time
                                  const lo = loginPolicy[`${k}_logout`];
                                  if (lo && lo <= v) setPolicyField(`${k}_logout`, "");
                                }}
                              >
                                <SelectTrigger className={cn(inputCls, "h-9", editingOwner && "opacity-50")}>
                                  <SelectValue placeholder="Select Time" />
                                </SelectTrigger>
                                <SelectContent className="max-h-[300px] rounded-xl">
                                  {TIME_OPTIONS.map((t) => <SelectItem key={t} value={t} className="text-[12px] font-bold">{t}</SelectItem>)}
                                </SelectContent>
                              </Select>
                            </TableCell>
                            <TableCell className="py-3 px-6">
                              <Select value={loginPolicy[`${k}_logout`] || ""} onValueChange={(v) => setPolicyField(`${k}_logout`, v)} disabled={!loginVal || editingOwner}>
                                <SelectTrigger className={cn(inputCls, "h-9", (!loginVal || editingOwner) && "opacity-50")}>
                                  <SelectValue placeholder="Select Time" />
                                </SelectTrigger>
                                <SelectContent className="max-h-[300px] rounded-xl">
                                  {logoutOptions.map((t) => <SelectItem key={t} value={t} className="text-[12px] font-bold">{t}</SelectItem>)}
                                </SelectContent>
                              </Select>
                            </TableCell>
                          </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>

                  <div className={cn("p-5 rounded-[1.25rem] border flex items-center justify-between gap-4", softBg, softBorder)}>
                    <div className="flex items-center gap-4 flex-1 min-w-0">
                      <div className={cn("p-2 rounded-xl shrink-0", limitIp ? "bg-primary/10 text-primary" : "bg-slate-500/10 text-slate-400")}>
                        <Globe size={16} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={cn("text-[13px] font-semibold", text)}>Limit access by IP address</p>
                        {limitIp && <Input value={loginPolicy.ip || ""} disabled={editingOwner} onChange={(e) => setPolicyField("ip", e.target.value)} placeholder="Type IP Address..." className={cn(inputCls, "h-9 mt-2 max-w-xs")} />}
                      </div>
                    </div>
                    <Switch checked={limitIp} disabled={editingOwner} onCheckedChange={setLimitIp} className="data-[state=checked]:bg-primary disabled:opacity-40" />
                  </div>
                </TabsContent>

                {/* List selection tabs */}
                {[
                  { key: "system",        title: "System Fields",  desc: "Select the system fields this agent is allowed to manage in Live Chat and Customers' Profiles", list: systemFieldsList, selected: selectedSystemFields,  setter: setSelectedSystemFields },
                  { key: "custom",        title: "Custom Fields",  desc: "Select the custom fields this agent is allowed to manage in Live Chat and Customers' Profiles", list: customFieldsList, selected: selectedCustomFields,  setter: setSelectedCustomFields },
                  { key: "tags",          title: "Tags",           desc: "Select the tags this agent is allowed to manage in Live Chat and Customers' Profiles",          list: tagsList,         selected: selectedTags,         setter: setSelectedTags },
                  { key: "chat-agents",   title: "Chat Agents",    desc: "Select the Agents whose conversations this agent can view in Live Chat",                       list: agentsList,       selected: selectedChatAgents,    setter: setSelectedChatAgents },
                  { key: "chat-channels", title: "Chat Channels",  desc: "Select the channels this agent can access in Live Chat",                                       list: channelList,      selected: selectedChatChannels, setter: setSelectedChatChannels },
                ].map((cfg) => (
                  <TabsContent key={cfg.key} value={cfg.key} className="m-0 outline-none space-y-5">
                    <div className="flex items-start justify-between gap-4">
                      <SectionHeading dark={dark} title={cfg.title} description={cfg.desc} />
                      <div className="px-3 py-1.5 rounded-lg bg-primary/10 text-primary text-[11px] font-semibold shrink-0">
                        {cfg.selected.length} / {cfg.list.length}
                      </div>
                    </div>

                    {cfg.key === "chat-channels" && (
                      <div className="flex items-start gap-3 p-4 rounded-[1.25rem] border bg-blue-500/5 border-blue-500/20">
                        <Info size={16} className="text-blue-500 shrink-0 mt-0.5" />
                        <p className="text-[11px] font-medium leading-relaxed text-blue-600 dark:text-blue-400">
                          After adding a new channel, make sure to grant access to it for each Agent if you want them to view and handle conversations from that channel. Otherwise, agents won't be able to see or interact with those conversations.
                        </p>
                      </div>
                    )}

                    <div className={cn("rounded-[1.5rem] border overflow-hidden", softBg, softBorder)}>
                      <div className={cn("flex items-center gap-3 px-5 py-3 border-b", softBorder, dark ? "bg-slate-900/30" : "bg-white/60")}>
                        <Checkbox
                          checked={cfg.selected.length === cfg.list.length && cfg.list.length > 0}
                          onCheckedChange={(c) => {
                            const all = cfg.list.map((i: any) => i.id);
                            // Chat Agents: deselect-all still keeps the agent's own row (replyagent parity).
                            if (cfg.key === "chat-agents" && !c && editingId != null) {
                              cfg.setter([String(editingId)]);
                            } else {
                              toggleAll(c as boolean, all, cfg.setter);
                            }
                          }}
                        />
                        <span className={cn("text-[11px] font-semibold", sub)}>Select All</span>
                      </div>
                      <div>
                        {cfg.list.length === 0 && (
                          <div className="px-5 py-4 text-[11px] font-medium opacity-60">No items</div>
                        )}
                        {cfg.list.map((item: any) => {
                          // An agent always keeps access to their own conversations — self row is locked on (replyagent parity)
                          const isSelf = cfg.key === "chat-agents" && editingId != null && item.id === String(editingId);
                          const checked = isSelf || cfg.selected.includes(item.id);
                          return (
                            <div
                              key={item.id}
                              onClick={() => { if (!isSelf) toggleItem(item.id, cfg.selected, cfg.setter); }}
                              className={cn(
                                "flex items-center justify-between px-5 py-3 transition-colors border-b last:border-0",
                                softBorder,
                                isSelf ? "cursor-not-allowed" : "cursor-pointer",
                                checked ? "bg-primary/5" : dark ? "hover:bg-slate-900/40" : "hover:bg-white/60"
                              )}
                            >
                              <div className="flex items-center gap-3">
                                <Checkbox checked={checked} disabled={isSelf} className="pointer-events-none" />
                                {cfg.key === "chat-agents" && <MemberAvatar name={item.label} />}
                                {cfg.key === "chat-channels" && item.type && (
                                  <img src={channelIcon(item.type)} alt={item.type} className="w-7 h-7 rounded-lg shrink-0 object-contain" />
                                )}
                                {cfg.key === "tags" ? (
                                  // Tags render as their own coloured chip (replyagent <Tag>).
                                  <span
                                    className="text-[11px] font-bold px-2.5 py-0.5 rounded-full"
                                    style={{ backgroundColor: item.color, color: readableText(item.color) }}
                                  >
                                    {item.label}
                                  </span>
                                ) : (
                                  <span className={cn("text-[12px] font-bold", text)}>{item.label}</span>
                                )}
                                {isSelf && <span className={cn("text-[10px] font-semibold", sub)}>You</span>}
                              </div>
                              {checked && <Check size={14} className="text-primary" />}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </TabsContent>
                ))}
              </div>
            </Tabs>
        </CardContent>
      </Card>
    );
  }

  /* ── LIST VIEW ─────────────────────────────────────────────── */
  return (
    <Card className={cn("rounded-[2rem] border overflow-hidden shadow-sm transition-all duration-300", card, border)}>
      <CardContent className="p-0">
        {/* Header */}
        <div className={cn("px-8 py-5 border-b flex items-center justify-between", border)}>
          <div className="flex items-center gap-4">
            <div className={cn("p-2.5 rounded-xl shadow-sm", dark ? "bg-primary/15" : "bg-primary/10")}>
              <Users className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className={cn("text-[16px] font-bold tracking-tight", text)}>Manage agents</h1>
              <p className={cn("text-[11px] font-medium mt-0.5 opacity-60", sub)}>
                Add or edit agent details
              </p>
            </div>
          </div>
          <span className="px-3 py-1.5 rounded-lg bg-primary/10 text-primary text-[11px] font-semibold flex items-center gap-1.5">
            <Shield size={11} /> {agents.length} Agents
          </span>
        </div>

          <div className={cn("px-6 py-4 border-b flex items-center justify-between gap-3", softBorder)}>
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <Input
                placeholder="Search agents..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className={cn(inputCls, "pl-9 h-10")}
              />
            </div>
            <button onClick={() => { resetForm(); setView("add"); }} className={primaryBtn}>
              <Plus size={12} /> Add Agent
            </button>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center h-48">
              <div className="animate-spin rounded-full h-7 w-7 border-b-2 border-primary"></div>
            </div>
          ) : filteredAgents.length === 0 ? (
            <div className="py-16 text-center space-y-3">
              <div className="w-14 h-14 mx-auto bg-primary/10 rounded-2xl flex items-center justify-center">
                <Users className="w-6 h-6 text-primary" />
              </div>
              <p className={cn("text-[12px] font-medium opacity-60", sub)}>No agents found</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className={cn("border-b hover:bg-transparent", softBorder)}>
                  <TableHead className={cn("py-4 px-6 text-[11px] font-semibold text-left", sub)}>Agent</TableHead>
                  <TableHead className={cn("py-4 px-6 text-[11px] font-semibold", sub)}>Status</TableHead>
                  <TableHead className={cn("py-4 px-6 text-[11px] font-semibold", sub)}>Role</TableHead>
                  <TableHead className={cn("py-4 px-6 text-[11px] font-semibold text-right", sub)}>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAgents.map((agent) => (
                  <TableRow key={agent.id} className={cn("border-b last:border-0 transition-colors", softBorder, dark ? "hover:bg-slate-900/30" : "hover:bg-slate-50/60")}>
                    <TableCell className="py-3 px-6">
                      <div className="flex items-center gap-3">
                        <MemberAvatar name={agent.name} size="md" />
                        <div className="flex flex-col min-w-0">
                          <span className={cn("text-[12px] font-black truncate", text)}>{agent.name || agent.email}</span>
                          <span className={cn("text-[11px] font-medium opacity-60 truncate flex items-center gap-1", sub)}>
                            <Mail size={10} /> {agent.email}
                          </span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="py-3 px-6">
                      <Badge variant="outline" className="h-6 px-2.5 border-emerald-500/30 text-emerald-600 bg-emerald-500/5 text-[11px] font-semibold rounded-md">
                        {agent.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="py-3 px-6">
                      <Badge variant="outline" className={cn("h-6 px-2.5 text-[11px] font-semibold rounded-md", dark ? "bg-slate-900/50 border-slate-700 text-slate-300" : "bg-slate-100 border-slate-200 text-slate-600")}>
                        {agent.role}
                      </Badge>
                    </TableCell>
                    <TableCell className="py-3 px-6 text-right">
                      <button
                        onClick={() => handleEdit(agent)}
                        className={cn("inline-flex items-center justify-center w-8 h-8 rounded-lg transition-all", dark ? "hover:bg-primary/10 hover:text-primary text-slate-400" : "hover:bg-primary/10 hover:text-primary text-slate-500")}
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
      </CardContent>
    </Card>
  );
}

/* ── Helpers ── */

function SectionHeading({ dark, title, description }: { dark: boolean; title: string; description?: string }) {
  const text = dark ? "text-white" : "text-slate-900";
  const sub  = dark ? "text-slate-500" : "text-slate-400";
  return (
    <div className="space-y-1.5">
      <h3 className={cn("text-[14px] font-semibold", text)}>{title}</h3>
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

function Field({
  dark,
  label,
  required,
  children,
}: {
  dark: boolean;
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5 pl-1">
        <FieldLabel dark={dark}>{label}</FieldLabel>
        {required && <span className="text-rose-500 text-xs leading-none -mt-0.5">*</span>}
      </div>
      {children}
    </div>
  );
}
