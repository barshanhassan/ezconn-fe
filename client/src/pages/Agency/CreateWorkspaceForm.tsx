import React, { useState } from 'react';
import { getUserInfo } from "@/lib/auth";
import {
  Info, Globe, Users, User, Bot, MessageCircle,
  MessageSquare, Send, Monitor, Layers, ChevronLeft,
  Building2, Settings2, Check,
} from 'lucide-react';
import { FaWhatsapp, FaInstagram, FaFacebookMessenger, FaTelegramPlane } from "react-icons/fa";
import { SiTwilio } from "react-icons/si";
import { BsChatDotsFill } from "react-icons/bs";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import { useTheme } from "@/contexts/ThemeContext";
import { cn } from "@/lib/utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest, ApiError } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";

interface Props {
  onCancel: () => void;
  initialData?: any;
}

const TIMEZONES = [
  { value: "Africa/Cairo", label: "Cairo (UTC+2)" },
  { value: "Africa/Lagos", label: "Lagos (UTC+1)" },
  { value: "Africa/Nairobi", label: "Nairobi (UTC+3)" },
  { value: "America/Chicago", label: "Chicago (UTC-6)" },
  { value: "America/Los_Angeles", label: "Los Angeles (UTC-8)" },
  { value: "America/New_York", label: "New York (UTC-5)" },
  { value: "America/Sao_Paulo", label: "Sao Paulo (UTC-3)" },
  { value: "America/Toronto", label: "Toronto (UTC-5)" },
  { value: "Asia/Baghdad", label: "Baghdad (UTC+3)" },
  { value: "Asia/Bangkok", label: "Bangkok (UTC+7)" },
  { value: "Asia/Dhaka", label: "Dhaka (UTC+6)" },
  { value: "Asia/Dubai", label: "Dubai (UTC+4)" },
  { value: "Asia/Hong_Kong", label: "Hong Kong (UTC+8)" },
  { value: "Asia/Jakarta", label: "Jakarta (UTC+7)" },
  { value: "Asia/Karachi", label: "Islamabad / Karachi (UTC+5)" },
  { value: "Asia/Kolkata", label: "Mumbai / Kolkata (UTC+5:30)" },
  { value: "Asia/Kuala_Lumpur", label: "Kuala Lumpur (UTC+8)" },
  { value: "Asia/Riyadh", label: "Riyadh (UTC+3)" },
  { value: "Asia/Seoul", label: "Seoul (UTC+9)" },
  { value: "Asia/Shanghai", label: "Beijing / Shanghai (UTC+8)" },
  { value: "Asia/Singapore", label: "Singapore (UTC+8)" },
  { value: "Asia/Tehran", label: "Tehran (UTC+3:30)" },
  { value: "Asia/Tokyo", label: "Tokyo (UTC+9)" },
  { value: "Australia/Sydney", label: "Sydney (UTC+10)" },
  { value: "Europe/Berlin", label: "Berlin (UTC+1)" },
  { value: "Europe/Istanbul", label: "Istanbul (UTC+3)" },
  { value: "Europe/London", label: "London (UTC+0)" },
  { value: "Europe/Moscow", label: "Moscow (UTC+3)" },
  { value: "Europe/Paris", label: "Paris (UTC+1)" },
  { value: "Pacific/Auckland", label: "Auckland (UTC+12)" },
  { value: "UTC", label: "UTC (UTC+0)" },
];

const CHANNELS = [
  { id: 'whatsapp_api', name: 'WhatsApp Business API', color: '#25D366', icon: <FaWhatsapp className="w-5 h-5 text-white" />, price: '$10' },
  { id: 'instagram', name: 'Instagram', gradient: 'from-[#f9ce34] via-[#ee2a7b] to-[#6228d7]', icon: <FaInstagram className="w-5 h-5 text-white" />, price: '$10' },
  { id: 'messenger', name: 'Facebook Messenger', color: '#00B2FF', icon: <FaFacebookMessenger className="w-5 h-5 text-white" />, price: '$10' },
  { id: 'telegram', name: 'Telegram', color: '#229ED9', icon: <FaTelegramPlane className="w-[18px] h-[18px] text-white -translate-x-[1px]" />, price: '$10' },
  { id: 'whatsapp_qr', name: 'WhatsApp QR (Z-API)', color: '#25D366', icon: <FaWhatsapp className="w-5 h-5 text-white" />, price: '$24' },
  { id: 'twilio', name: 'Twilio SMS', color: '#F22F46', icon: <SiTwilio className="w-[18px] h-[18px] text-white" />, price: '$10' },
  { id: 'webchat', name: 'Web Chat', color: '#8E24AA', icon: <BsChatDotsFill className="w-[17px] h-[17px] text-white" />, price: '$10' },
];

const AVATAR_COLORS = ['bg-blue-500', 'bg-emerald-500', 'bg-violet-500', 'bg-orange-500', 'bg-pink-500', 'bg-teal-500'];

function MemberAvatar({ name, index, size = 'md' }: { name: string; index: number; size?: 'sm' | 'md' }) {
  const initials = name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase();
  const color = AVATAR_COLORS[index % AVATAR_COLORS.length];
  const sz = size === 'sm' ? 'w-6 h-6 text-[9px]' : 'w-8 h-8 text-xs';
  return (
    <div className={cn("rounded-full flex items-center justify-center text-white font-bold shrink-0", sz, color)}>
      {initials}
    </div>
  );
}

const CreateWorkspaceForm: React.FC<Props> = ({ onCancel, initialData }) => {
  const { mode } = useTheme();
  const dark = mode === 'dark';
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  const isEdit = !!initialData;

  const userInfo = getUserInfo();
  const agencyId = userInfo.modelable_id;

  const { data: membersData } = useQuery({
    queryKey: [`/api/organizations/${agencyId}/members`],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/organizations/${agencyId}/members`);
      return res.json();
    },
  });
  const members: any[] = membersData?.members || membersData?.data || membersData || [];

  const [form, setForm] = useState({
    name: initialData?.name || '',
    // The workspace's slug IS its subdomain (created via the slug on workspace
    // create), so fall back to slug when editing so the field pre-fills.
    subdomain: initialData?.subdomain || initialData?.slug || '',
    timezone: initialData?.timezone || 'Asia/Karachi',
    agentId: String(initialData?.agency_agent_id ?? initialData?.agent_id ?? ''),
    whiteLabel: initialData?.allow_branding || false,
    allowSupport: initialData?.allow_support || false,
    limitContacts: initialData?.limited_contacts || false,
    contactLimit: initialData?.maximum_contacts || 500,
    limitAgents: initialData?.allow_agents ?? true,
    agentLimit: initialData?.agents_limit || 4,
    aiLimit: initialData?.chatgpt_assistant_limit || 10,
    channels: {
      whatsapp_api: initialData?.whatsapp_channels_limit ?? 1,
      instagram: initialData?.instagram_channels_limit ?? 1,
      messenger: initialData?.facebook_channels_limit ?? 1,
      telegram: initialData?.telegram_channels_limit ?? 1,
      whatsapp_qr: initialData?.zapi_channels_limit ?? 1,
      twilio: initialData?.twilio_channels_limit ?? 1,
      webchat: initialData?.webchat_channels_limit ?? 1,
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const endpoint = isEdit
        ? `/api/organizations/${agencyId}/workspaces/${initialData.id}`
        : `/api/organizations/${agencyId}/workspaces`;
      const res = await apiRequest(isEdit ? "PATCH" : "POST", endpoint, {
        name: form.name,
        slug: form.subdomain,
        timezone: form.timezone,
        agent_id: form.agentId || undefined,
        allow_branding: form.whiteLabel,
        allow_support: form.allowSupport,
        limited_contacts: form.limitContacts,
        maximum_contacts: form.contactLimit,
        allow_agents: form.limitAgents,
        agents_limit: form.agentLimit,
        chatgpt_assistant_limit: form.aiLimit,
        whatsapp_channels_limit: form.channels.whatsapp_api,
        instagram_channels_limit: form.channels.instagram,
        facebook_channels_limit: form.channels.messenger,
        telegram_channels_limit: form.channels.telegram,
        zapi_channels_limit: form.channels.whatsapp_qr,
        twilio_channels_limit: form.channels.twilio,
        webchat_channels_limit: form.channels.webchat,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/organizations/${agencyId}/workspaces`] });
      toast({ title: isEdit ? t("create_workspace_form.updated_toast") : t("create_workspace_form.created_toast") });
      onCancel();
    },
    onError: (err: unknown) => {
      // ApiErrors are already toasted by the global handler in apiRequest.
      // Only show a fallback for unexpected non-API failures (network drops, etc.).
      if (!(err instanceof ApiError)) {
        toast({ title: t("create_workspace_form.error_title"), description: t("create_workspace_form.error_desc"), variant: "destructive" });
      }
    },
  });

  const handleSubmit = () => {
    if (!form.name.trim()) {
      toast({ title: t("create_workspace_form.name_required_title"), description: t("create_workspace_form.name_required_desc"), variant: "destructive" });
      return;
    }
    saveMutation.mutate();
  };

  const set = (key: string, val: any) => setForm(prev => ({ ...prev, [key]: val }));
  const setChannel = (id: string, val: number) =>
    setForm(prev => ({ ...prev, channels: { ...prev.channels, [id]: val } }));

  const selectedMember = members.find((m: any) => String(m.id) === form.agentId);
  const selectedMemberIndex = members.findIndex((m: any) => String(m.id) === form.agentId);

  const cardCls = cn("rounded-xl border", dark ? "bg-[#1e293b] border-slate-700" : "bg-white border-slate-200");
  const labelCls = cn("block text-xs font-semibold mb-1.5", dark ? "text-slate-300" : "text-slate-600");
  const inputCls = cn("h-10 text-sm focus:ring-2 focus:ring-primary focus:ring-offset-0 focus:border-primary", dark ? "bg-[#0f172a] border-slate-700 text-white placeholder:text-slate-600" : "border-slate-200");
  const rowCls = cn("flex items-center gap-3 p-3.5 rounded-xl", dark ? "bg-[#0f172a]" : "bg-slate-50");
  const switchCls = "data-[state=checked]:bg-primary data-[state=unchecked]:bg-slate-300 dark:data-[state=unchecked]:bg-slate-600";
  const selectCls = cn("h-10 text-sm focus:ring-1 focus:ring-offset-0", dark ? "bg-[#0f172a] border-slate-700 text-white" : "border-slate-300");

  return (
    <div className={cn("min-h-screen", dark ? "bg-[#0f172a] text-white" : "bg-slate-50 text-slate-900")}>
      {/* Sticky header */}
      <div className={cn(
        "sticky top-0 z-10 flex items-center justify-between px-6 py-4 border-b",
        dark ? "bg-[#0f172a] border-slate-800" : "bg-slate-50 border-slate-200"
      )}>
        <div className="flex items-center gap-3">
          <button
            onClick={onCancel}
            className={cn("p-2 rounded-lg border transition-colors", dark ? "border-slate-700 hover:bg-slate-800 text-slate-400" : "border-slate-200 hover:bg-white text-slate-500")}
          >
            <ChevronLeft size={16} />
          </button>
          <div>
            <h1 className="text-lg font-bold">{isEdit ? t("create_workspace_form.edit_title", { name: initialData.name }) : t("create_workspace_form.create_title")}</h1>
            <p className={cn("text-xs mt-0.5", dark ? "text-slate-500" : "text-slate-400")}>
              {isEdit ? t("create_workspace_form.edit_desc") : t("create_workspace_form.create_desc")}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2.5">
          <button
            onClick={onCancel}
            className={cn(
              "px-4 py-2 rounded-lg text-sm font-medium border transition-colors",
              dark ? "border-slate-700 text-slate-300 hover:bg-slate-800" : "border-slate-200 text-slate-600 hover:bg-white"
            )}
          >
            {t("create_workspace_form.cancel")}
          </button>
          <button
            onClick={handleSubmit}
            disabled={saveMutation.isPending}
            className="inline-flex items-center gap-2 px-5 py-2 rounded-lg text-[12px] font-semibold bg-primary hover:opacity-90 text-primary-foreground shadow-sm transition-colors disabled:opacity-60"
          >
            {saveMutation.isPending ? (
              <>
                <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                {t("create_workspace_form.saving")}
              </>
            ) : (
              <>
                <Check size={15} />
                {isEdit ? t("create_workspace_form.save_changes") : t("create_workspace_form.save")}
              </>
            )}
          </button>
        </div>
      </div>

      <div className="p-6 space-y-5">

        {/* Section 1: Basic Info */}
        <div className={cardCls}>
          <div className={cn("flex items-center gap-2.5 px-5 py-4 border-b", dark ? "border-slate-700" : "border-slate-100")}>
            <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center shrink-0", dark ? "bg-primary/15" : "bg-primary/10")}>
              <Building2 size={14} className="text-primary" />
            </div>
            <div>
              <p className="text-sm font-semibold">{t("create_workspace_form.basic_info_title")}</p>
              <p className={cn("text-xs", dark ? "text-slate-500" : "text-slate-400")}>{t("create_workspace_form.basic_info_desc")}</p>
            </div>
          </div>
          <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Name */}
            <div>
              <label className={labelCls}>{t("create_workspace_form.workspace_name_label")}</label>
              <Input
                placeholder={t("create_workspace_form.name_placeholder")}
                maxLength={100}
                value={form.name}
                onChange={(e) => {
                  const name = e.target.value;
                  set('name', name);
                  if (!isEdit) set('subdomain', name.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 30));
                }}
                className={inputCls}
              />
            </div>
            {/* Subdomain */}
            <div>
              <label className={cn(labelCls, "flex items-center gap-1")}>
                {t("create_workspace_form.domain_label")} <Info size={11} className="text-slate-400" />
              </label>
              <div className={cn("flex h-10 rounded-lg overflow-hidden border", isEdit && "opacity-50 cursor-not-allowed", dark ? "border-slate-700" : "border-slate-200")}>
                <span className={cn(
                  "flex items-center px-3 border-r text-xs font-medium shrink-0",
                  dark ? "bg-slate-800 border-slate-700 text-slate-400" : "bg-slate-50 border-slate-200 text-slate-500"
                )}>
                  https://
                </span>
                <Input
                  placeholder={t("create_workspace_form.domain_placeholder")}
                  maxLength={30}
                  value={form.subdomain}
                  onChange={(e) => set('subdomain', e.target.value.toLowerCase().replace(/[^a-z0-9]/g, ''))}
                  disabled={isEdit}
                  className={cn("rounded-none border-0 flex-1 focus-visible:ring-0 focus-visible:ring-offset-0 h-full disabled:opacity-100", dark ? "bg-[#0f172a] text-white" : "bg-white")}
                />
                <span className={cn(
                  "flex items-center px-3 border-l text-xs font-medium whitespace-nowrap shrink-0",
                  dark ? "bg-slate-800 border-slate-700 text-slate-400" : "bg-slate-50 border-slate-200 text-slate-500"
                )}>
                  .agentawk.com
                </span>
              </div>
            </div>
            {/* Timezone */}
            <div>
              <label className={labelCls}>{t("create_workspace_form.timezone_label")}</label>
              <Select value={form.timezone} onValueChange={(v) => set('timezone', v)}>
                <SelectTrigger className={selectCls}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className={cn("max-h-72", dark ? "bg-[#1e293b] border-slate-700 text-white" : "")}>
                  {TIMEZONES.map(tz => (
                    <SelectItem key={tz.value} value={tz.value}>{tz.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {/* Agent */}
            <div>
              <label className={cn(labelCls, "flex items-center gap-1")}>
                {t("create_workspace_form.assign_agent_label")} <Info size={11} className="text-slate-400" />
              </label>
              <Select value={form.agentId} onValueChange={(v) => set('agentId', v)}>
                <SelectTrigger className={cn(selectCls, "gap-2")}>
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    {selectedMember ? (
                      <>
                        <MemberAvatar
                          name={`${selectedMember.first_name || ''} ${selectedMember.last_name || ''}`.trim()}
                          index={selectedMemberIndex}
                          size="sm"
                        />
                        <span className="truncate text-sm">
                          {selectedMember.first_name} {selectedMember.last_name}
                        </span>
                      </>
                    ) : (
                      <span className={cn("text-sm", dark ? "text-slate-500" : "text-slate-400")}>{t("create_workspace_form.select_agent_placeholder")}</span>
                    )}
                  </div>
                </SelectTrigger>
                <SelectContent className={cn(dark ? "bg-[#1e293b] border-slate-700" : "")}>
                  {members.length === 0 ? (
                    <div className="px-3 py-2 text-xs text-slate-400">{t("create_workspace_form.no_members_found")}</div>
                  ) : (
                    members.map((m: any, i: number) => {
                      const fullName = `${m.first_name || ''} ${m.last_name || ''}`.trim();
                      return (
                        <SelectItem key={m.id} value={String(m.id)} className="group pr-3">
                          <div className="flex items-center gap-2.5">
                            <MemberAvatar name={fullName} index={i} size="sm" />
                            <div>
                              <p className={cn(
                                "text-sm font-medium group-data-[highlighted]:text-white",
                                dark ? "text-white" : "text-slate-800"
                              )}>{fullName}</p>
                              {m.email && <p className="text-xs text-slate-400 group-data-[highlighted]:text-white/90">{m.email}</p>}
                            </div>
                          </div>
                        </SelectItem>
                      );
                    })
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Section 2: Settings & Limits */}
        <div className={cardCls}>
          <div className={cn("flex items-center gap-2.5 px-5 py-4 border-b", dark ? "border-slate-700" : "border-slate-100")}>
            <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center shrink-0", dark ? "bg-violet-500/20" : "bg-violet-50")}>
              <Settings2 size={14} className="text-violet-500" />
            </div>
            <div>
              <p className="text-sm font-semibold">{t("create_workspace_form.settings_limits_title")}</p>
              <p className={cn("text-xs", dark ? "text-slate-500" : "text-slate-400")}>{t("create_workspace_form.settings_limits_desc")}</p>
            </div>
          </div>
          <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* White Label */}
            <div className={rowCls}>
              <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center shrink-0", dark ? "bg-slate-800" : "bg-white border border-slate-200")}>
                <Globe size={15} className="text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{t("create_workspace_form.white_label_title")}</p>
                <p className={cn("text-xs", dark ? "text-slate-500" : "text-slate-400")}>{t("create_workspace_form.white_label_desc")}</p>
              </div>
              <Switch checked={form.whiteLabel} onCheckedChange={(v) => set('whiteLabel', v)} className={switchCls} />
            </div>
            {/* Allow Support */}
            <div className={rowCls}>
              <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center shrink-0", dark ? "bg-slate-800" : "bg-white border border-slate-200")}>
                <Monitor size={15} className="text-emerald-500" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{t("create_workspace_form.allow_support_title")}</p>
                <p className={cn("text-xs", dark ? "text-slate-500" : "text-slate-400")}>{t("create_workspace_form.allow_support_desc")}</p>
              </div>
              <Switch checked={form.allowSupport} onCheckedChange={(v) => set('allowSupport', v)} className={switchCls} />
            </div>
            {/* Contact Limit */}
            <div className={rowCls}>
              <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center shrink-0", dark ? "bg-slate-800" : "bg-white border border-slate-200")}>
                <Users size={15} className="text-orange-500" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{t("create_workspace_form.limit_contacts_title")}</p>
                <p className={cn("text-xs", dark ? "text-slate-500" : "text-slate-400")}>{t("create_workspace_form.limit_contacts_desc")}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {form.limitContacts && (
                  <Input
                    type="number"
                    min={0}
                    value={form.contactLimit}
                    onChange={(e) => {
                      const cleaned = e.target.value.replace(/^0+(?=\d)/, '');
                      // Force-sync DOM when cleaning changes the string but the parsed
                      // number stays equal to state — React skips re-render in that
                      // case and the leading zero would persist in the input.
                      if (cleaned !== e.target.value) e.target.value = cleaned;
                      set('contactLimit', Math.max(0, parseInt(cleaned) || 0));
                    }}
                    className={cn("w-20 h-8 text-xs text-center", dark ? "bg-slate-900 border-slate-700 text-white" : "border-slate-200")}
                  />
                )}
                <Switch checked={form.limitContacts} onCheckedChange={(v) => set('limitContacts', v)} className={switchCls} />
              </div>
            </div>
            {/* Agent Limit */}
            <div className={rowCls}>
              <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center shrink-0", dark ? "bg-slate-800" : "bg-white border border-slate-200")}>
                <User size={15} className="text-violet-500" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{t("create_workspace_form.limit_agents_title")}</p>
                <p className={cn("text-xs", dark ? "text-slate-500" : "text-slate-400")}>{t("create_workspace_form.limit_agents_desc")}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Input
                  type="number"
                  min={0}
                  value={form.agentLimit}
                  onChange={(e) => {
                    const cleaned = e.target.value.replace(/^0+(?=\d)/, '');
                    if (cleaned !== e.target.value) e.target.value = cleaned;
                    set('agentLimit', Math.max(0, parseInt(cleaned) || 0));
                  }}
                  className={cn("w-20 h-8 text-xs text-center", dark ? "bg-slate-900 border-slate-700 text-white" : "border-slate-200")}
                />
                <Switch checked={form.limitAgents} onCheckedChange={(v) => set('limitAgents', v)} className={switchCls} />
              </div>
            </div>
          </div>
        </div>

        {/* Section 3: Channels */}
        <div className={cardCls}>
          <div className={cn("flex items-center gap-2.5 px-5 py-4 border-b", dark ? "border-slate-700" : "border-slate-100")}>
            <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center shrink-0", dark ? "bg-emerald-500/20" : "bg-emerald-50")}>
              <Layers size={14} className="text-emerald-500" />
            </div>
            <div>
              <p className="text-sm font-semibold">{t("create_workspace_form.channel_connections_title")}</p>
              <p className={cn("text-xs", dark ? "text-slate-500" : "text-slate-400")}>{t("create_workspace_form.channel_connections_desc")}</p>
            </div>
          </div>

          {/* AI Assistant row */}
          <div className={cn("flex items-center gap-4 px-5 py-3.5 border-b", dark ? "border-slate-700/60" : "border-slate-100")}>
            <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center shrink-0", dark ? "bg-slate-800" : "bg-slate-100")}>
              <Bot size={18} className={dark ? "text-slate-300" : "text-slate-600"} />
            </div>
            <div className="flex-1 min-w-0">
              <p className={cn("text-sm font-medium", dark ? "text-slate-200" : "text-slate-700")}>{t("create_workspace_form.ai_chat_assistants_label")}</p>
            </div>
            <span className={cn("text-xs whitespace-nowrap", dark ? "text-slate-500" : "text-slate-400")}>{t("create_workspace_form.included_in_plan", { count: 10 })}</span>
            <span className={cn("text-xs whitespace-nowrap", dark ? "text-slate-500" : "text-slate-400")}>{t("create_workspace_form.additional_price", { price: "$4" })}</span>
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="text-xs font-medium text-blue-500 whitespace-nowrap">{t("create_workspace_form.connection_limit")}</span>
              <Info size={11} className="text-slate-400" />
              <Input
                type="number"
                min={0}
                value={form.aiLimit}
                onChange={(e) => {
                  const cleaned = e.target.value.replace(/^0+(?=\d)/, '');
                  if (cleaned !== e.target.value) e.target.value = cleaned;
                  set('aiLimit', Math.max(0, parseInt(cleaned) || 0));
                }}
                className={cn("w-16 h-8 text-xs text-center", dark ? "bg-[#0f172a] border-slate-700 text-white" : "border-slate-200 bg-white")}
              />
            </div>
          </div>

          {/* Channel rows */}
          <div className="divide-y">
            {CHANNELS.map((ch, idx) => (
              <div
                key={ch.id}
                className={cn(
                  "flex items-center gap-4 px-5 py-3.5",
                  dark ? "divide-slate-700" : "divide-slate-100",
                  idx === CHANNELS.length - 1 ? "" : ""
                )}
                style={{ borderBottomColor: dark ? 'rgb(51,65,85)' : 'rgb(241,245,249)' }}
              >
                <div
                  className={cn("w-9 h-9 rounded-xl flex items-center justify-center shrink-0", ch.gradient ? `bg-gradient-to-tr ${ch.gradient}` : "")}
                  style={ch.color ? { backgroundColor: ch.color } : {}}
                >
                  {ch.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={cn("text-sm font-medium", dark ? "text-slate-200" : "text-slate-700")}>{ch.name}</p>
                </div>
                <span className={cn("text-xs whitespace-nowrap", dark ? "text-slate-500" : "text-slate-400")}>{t("create_workspace_form.first_connection_free")}</span>
                <span className={cn("text-xs whitespace-nowrap", dark ? "text-slate-500" : "text-slate-400")}>{t("create_workspace_form.additional_price", { price: ch.price })}</span>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="text-xs font-medium text-primary whitespace-nowrap">{t("create_workspace_form.connection_limit")}</span>
                  <Info size={11} className="text-slate-400" />
                  <Input
                    type="number"
                    min={0}
                    value={(form.channels as any)[ch.id]}
                    onChange={(e) => {
                      const cleaned = e.target.value.replace(/^0+(?=\d)/, '');
                      if (cleaned !== e.target.value) e.target.value = cleaned;
                      setChannel(ch.id, Math.max(0, parseInt(cleaned) || 0));
                    }}
                    className={cn("w-16 h-8 text-xs text-center", dark ? "bg-[#0f172a] border-slate-700 text-white" : "border-slate-200 bg-white")}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
};

export default CreateWorkspaceForm;
