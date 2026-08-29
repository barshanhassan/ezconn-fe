import { useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Plus, BarChart2, Edit2, Copy, Trash2, Send, Zap, Search, ChevronsLeft, ChevronLeft, ChevronRight, ChevronsRight, Archive, Calendar, FileText, X, Download, Paperclip } from "react-feather";
import {
  FaWhatsapp,
  FaTelegramPlane,
  FaFacebookMessenger,
  FaInstagram,
} from "react-icons/fa";
import { SiTwilio } from "react-icons/si";
import { BsChatDotsFill } from "react-icons/bs";
import { ChartContainer } from "@/components/ui/chart";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis, Tooltip as RechartsTooltip } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreVertical, ChevronDown, ChevronsUpDown, ChevronUp, ChevronDown as ChevronDownIcon, ArrowLeft, Info, Activity, Megaphone, MessageSquare, RefreshCw, Eye, UsersRound, CheckCircle2, Mail, AlertTriangle, Clock, Minus, Filter, Tag, Hash, User, Phone as PhoneIcon, Link2, Globe, DollarSign, Percent, CheckSquare, MessageCircle } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import PreviewV2 from "@/components/PreviewV2";
import { useToast } from "@/hooks/use-toast";
import CustomDropdown from "@/components/CustomDropdown";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Loader2 } from "lucide-react";
import { useMemo } from "react";
import { getUserInfo, hasAnyPerm } from "@/lib/auth";
import { formatInWorkspaceTz, useWorkspaceTimezone } from "@/contexts/WorkspaceTimezoneContext";

interface SortEntry {
  column: string;
  direction: "asc" | "desc";
}

// Contact-field tokens that can be dropped into a template variable value.
// The backend swaps them for each recipient's own data at send time, so a
// value like "Hi [CONTACT_FIRST_NAME]" personalises per contact. Mirrors
// replyagent's [CONTACT_*] placeholders — keep in sync with the resolver in
// agentawk-core's broadcast-processor.service.ts.
const CONTACT_TOKENS: Array<{ token: string; labelKey: string }> = [
  { token: "[CONTACT_FIRST_NAME]", labelKey: "first_name" },
  { token: "[CONTACT_LAST_NAME]", labelKey: "last_name" },
  { token: "[CONTACT_FULL_NAME]", labelKey: "full_name" },
  { token: "[CONTACT_TITLE]", labelKey: "title" },
  { token: "[CREATED_AT]", labelKey: "created_on" },
  { token: "[CURRENT_DATETIME]", labelKey: "current_datetime" },
];

// True when `date` falls inside the rolling window identified by `token`.
// Tokens are kept short and human-readable so the dropdown stays compact —
// matches replyagent's broadcast list page quick filters.
function dateRangeMatches(date: Date | undefined, token: string): boolean {
  if (!date) return false;
  const now = new Date();
  const start = new Date(now);
  switch (token) {
    case "today":
      start.setHours(0, 0, 0, 0);
      return date >= start;
    case "last7":
      start.setDate(start.getDate() - 7);
      return date >= start;
    case "last30":
      start.setDate(start.getDate() - 30);
      return date >= start;
    case "thisMonth":
      return (
        date.getFullYear() === now.getFullYear() &&
        date.getMonth() === now.getMonth()
      );
    default:
      return true;
  }
}

interface Campaign {
  id: number;
  name: string;
  type: string;
  messageType: string;
  sent: number;
  delivered: number;
  /** Total audience size for the broadcast (used in stat cards + table). */
  audience?: number;
  /** Failed delivery count (used in row + stats). */
  failed?: number;
  /** Channel slug — whatsapp / telegram / messenger / instagram / etc. */
  channelType?: string;
  /** Display name of the connected channel account (e.g. WhatsApp number name). */
  channelName?: string;
  /** Channel account id — used to reconstruct newBroadcastChannelKey when opening the composer for edit/view. */
  channelableId?: string | null;
  /** Agent / user id who created or is assigned to this broadcast. Drives the Agent filter. */
  agentId?: string | null;
  /** Backend metadata blob preserved so the composer can rehydrate delivery-profile + audience + toggle state. */
  metadata?: Record<string, any>;
  /** ISO created-at date (used in CREATED AT column). */
  createdAt?: Date;
  status: string;
  // New fields for API Triggered
  startDate?: Date;
  endDate?: Date;
  neverEnds?: boolean;
  whatsAppTemplateName: string;
  // New fields for Broadcast
  schedules?: Schedule[];
  recurringStartDate?: Date;
  recurringEndDate?: Date;
  recurringTime?: { hour: string; minute: string; period: string };
  repeatFrequency?: string;
  dailyRepeatInterval?: string;
  weeklyRepeatDays?: string[];
  monthlyRepeatDates?: number[];
  deliverInTimezone?: boolean;
  csvFileName?: string;
  csvContent?: any[];
  recipients?: Recipient[];
  engagementData?: EngagementData[];
  scheduledAt?: Date;
}

interface Schedule {
  id: number;
  date: Date | undefined;
  hour: string;
  minute: string;
  period: string;
}

interface Recipient {
  id: number;
  name: string;
  phone: string;
  status: "Sent" | "Delivered" | "Viewed" | "Failed";
  time: string;
}

interface EngagementData {
  hour: string;
  delivered: number;
  viewed: number;
}

export default function CampaignManager() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const workspaceTz = useWorkspaceTimezone();
  // "Allow" permissions (replyagent canManageBraodcasts / canDeleteBraodcasts) —
  // owners pass via the `workspace.*` wildcard, only restricted agents are gated.
  //  - manage → create / edit / clone / send-now / archive
  //  - delete → delete a broadcast (+ bulk delete)
  const _broadcastPerms = getUserInfo().permissions ?? [];
  const canManageBroadcasts = hasAnyPerm(_broadcastPerms, ["workspace.broadcast.manage"]);
  const canDeleteBroadcasts = hasAnyPerm(_broadcastPerms, ["workspace.broadcast.delete"]);
  const [selectedCampaigns, setSelectedCampaigns] = useState<number[]>([]);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<string[]>([]);
  // Broadcast-page parity filters (added alongside the legacy
  // selectedCampaignTypes / selectedMessageTypes which are retained for
  // backwards-compat with any saved views).
  const [selectedChannels, setSelectedChannels] = useState<string[]>([]);
  const [dateRangeFilter, setDateRangeFilter] = useState<string[]>([]);
  const [selectedAgents, setSelectedAgents] = useState<string[]>([]);
  const [activeDetailsTab, setActiveDetailsTab] = useState("details");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCampaignTypes, setSelectedCampaignTypes] = useState<string[]>([]);
  const [selectedMessageTypes, setSelectedMessageTypes] = useState<string[]>([]);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [rowsDropdownOpen, setRowsDropdownOpen] = useState(false);
  const [sort, setSort] = useState<SortEntry | null>(null);
  const [csvSort, setCsvSort] = useState<{ column: string; direction: "asc" | "desc" } | null>(null);
  const [campaignCreationStep, setCampaignCreationStep] = useState<"selectType" | "apiTriggeredForm" | "broadcastForm">("selectType");
  // Replyagent-style Step-1 form: pick a name + a connected channel before
  // diving into the full broadcast composer. These two fields live here
  // (not in the broadcast/api form state) because they're the only things
  // the user enters in the new "Create a Broadcast" modal.
  const [newBroadcastChannelKey, setNewBroadcastChannelKey] = useState<string>("");
  const [editingCampaignId, setEditingCampaignId] = useState<number | null>(null);
  const [campaignName, setCampaignName] = useState("");
  const [campaignStartDate, setCampaignStartDate] = useState<Date | undefined>(undefined);
  const [campaignEndDate, setCampaignEndDate] = useState<Date | undefined>(undefined);
  const [selectedWhatsAppTemplate, setSelectedWhatsAppTemplate] = useState<string | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<any | null>(null);
  // Static values for the selected template's body placeholders ({{1}}, {{2}}…),
  // keyed by placeholder number ("1", "2") to match PreviewV2's lookup. The same
  // value is sent to every recipient (no per-contact personalisation yet).
  const [composerVariables, setComposerVariables] = useState<Record<string, string>>({});
  const [startDatePickerOpen, setStartDatePickerOpen] = useState(false);
  const [endDatePickerOpen, setEndDatePickerOpen] = useState(false);
  const [neverEnds, setNeverEnds] = useState(false);
  const [broadcastCampaignType, setBroadcastCampaignType] = useState("");
  const [deliverInTimezone, setDeliverInTimezone] = useState(false);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvData, setCsvData] = useState<any[]>([]);
  const [localCsvData, setLocalCsvData] = useState<any[]>([]);
  const [csvError, setCsvError] = useState<string | null>(null);
  const [isViewCsvModalOpen, setIsViewCsvModalOpen] = useState(false);
  const [schedules, setSchedules] = useState<Schedule[]>([{ id: Date.now(), date: undefined, hour: "", minute: "", period: "" }]);

  // For Recurring Broadcast
  const [recurringStartDate, setRecurringStartDate] = useState<Date | undefined>(undefined);
  const [recurringEndDate, setRecurringEndDate] = useState<Date | undefined>(undefined);
  const [recurringTime, setRecurringTime] = useState({ hour: "", minute: "", period: "" });
  const [repeatFrequency, setRepeatFrequency] = useState(""); // "daily", "weekly", "monthly"
  const [dailyRepeatInterval, setDailyRepeatInterval] = useState("1"); // "1" for "Single Day", "2" for "2 Days" etc.
  const [weeklyRepeatDays, setWeeklyRepeatDays] = useState<string[]>([]); // e.g., ["mon", "tue"]
  const [monthlyRepeatDates, setMonthlyRepeatDates] = useState<number[]>([]); // e.g., [1, 15, 31]

  // For Popover states
  const [recurringStartPickerOpen, setRecurringStartPickerOpen] = useState(false);
  const [recurringEndPickerOpen, setRecurringEndPickerOpen] = useState(false);

  // ─── Full-page broadcast composer state ────────────────────────────
  // The composer replaces the CampaignManager list surface once the user
  // finishes the "Create a Broadcast" modal. All composer-specific inputs
  // live here so switching back to the list keeps its state intact.
  const [composerOpen, setComposerOpen] = useState(false);
  const [composerAudienceMatch, setComposerAudienceMatch] = useState<"any" | "all">("any");
  // Send-attempt tracking so inline error strings only surface AFTER the
  // user has clicked "Send broadcast". Freshly opened composer keeps the
  // fields clean; once an attempt is blocked the errors persist per-field
  // and clear individually as each field is filled in.
  const [composerSendAttempted, setComposerSendAttempted] = useState(false);
  const [composerScheduleMode, setComposerScheduleMode] = useState<"now" | "later">("now");
  const [composerScheduleDate, setComposerScheduleDate] = useState<Date | undefined>(undefined);
  // Audience condition picker — mirrors replyagent's "Select a condition"
  // + "Configure condition" flow. `composerConditions` stores fully
  // configured filters (field + operator + value). Two modals feed it:
  //   1. picker      — pick which field to filter on
  //   2. configureCondition — set operator (Is / Contains / …) + value
  const [conditionModalOpen, setConditionModalOpen] = useState(false);
  const [conditionSearch, setConditionSearch] = useState("");
  const [composerConditions, setComposerConditions] = useState<Array<{
    id: string;         // stable per-row key
    fieldId: string;    // "tag" / "contact_id" / "cf_5" / …
    fieldLabel: string; // "Tag" / "Contact ID"
    category: string;   // "General" / "System" / …
    icon: string;
    fieldType: "enum" | "text" | "number" | "date" | "boolean";
    operator: string;    // "is" / "is_not" / "contains" / …
    value: string;       // stored value (id for enum, raw text otherwise)
    valueLabel?: string; // human-readable label for enum values
  }>>([]);
  // Configure-modal state — populated when the user picks a field from
  // the condition picker. `configureField` doubles as the modal's open
  // flag (null = closed).
  const [configureField, setConfigureField] = useState<null | {
    fieldId: string;
    fieldLabel: string;
    category: string;
    icon: string;
    fieldType: "enum" | "text" | "number" | "date" | "boolean";
    // Enum-only: dropdown options (id + label)
    enumOptions?: Array<{ id: string; label: string }>;
  }>(null);
  const [configureOperator, setConfigureOperator] = useState<string>("is");
  const [configureValue, setConfigureValue] = useState<string>("");
  const [configureValueLabel, setConfigureValueLabel] = useState<string>("");
  const [composerScheduleHour, setComposerScheduleHour] = useState("09");
  const [composerScheduleMinute, setComposerScheduleMinute] = useState("00");
  const [composerScheduleDatePickerOpen, setComposerScheduleDatePickerOpen] = useState(false);
  const [composerPauseIfMarketing, setComposerPauseIfMarketing] = useState(false);
  const [composerTagFailed, setComposerTagFailed] = useState<string>("");
  const [composerDeliveryPreset, setComposerDeliveryPreset] = useState<"conservative" | "standard" | "aggressive" | "custom">("standard");
  // The 4 delivery-profile inputs mirror replyagent's rate-controls: how
  // many messages fire in a burst, how long we wait between bursts, and a
  // random inter-message delay range (min → max seconds).
  const [composerBatchSize, setComposerBatchSize] = useState(10);
  const [composerBatchPause, setComposerBatchPause] = useState(60);
  const [composerIntervalMin, setComposerIntervalMin] = useState(2);
  const [composerIntervalMax, setComposerIntervalMax] = useState(7);
  // Applying a preset writes the four values above so the user can drop
  // into a curve and tweak from there. "custom" doesn't reset — it just
  // marks the active pill.
  const applyDeliveryPreset = (preset: "conservative" | "standard" | "aggressive" | "custom") => {
    setComposerDeliveryPreset(preset);
    if (preset === "conservative") {
      setComposerBatchSize(5); setComposerBatchPause(120); setComposerIntervalMin(5); setComposerIntervalMax(15);
    } else if (preset === "standard") {
      setComposerBatchSize(10); setComposerBatchPause(60); setComposerIntervalMin(2); setComposerIntervalMax(7);
    } else if (preset === "aggressive") {
      setComposerBatchSize(25); setComposerBatchPause(20); setComposerIntervalMin(1); setComposerIntervalMax(3);
    }
  };

  const queryClient = useQueryClient();

  // Fetch campaigns from backend
  const { data: broadcastsData, isLoading: isLoadingCampaigns } = useQuery({
    queryKey: ["/api/broadcasts"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/broadcasts");
      return res.json();
    }
  });

  // Channels (WhatsApp accounts) — drives which channel the new broadcast
  // gets bound to. We auto-select the first one so the existing create form
  // doesn't need an extra picker; users with multiple accounts can extend
  // later. Without a channel the backend rejects the create.
  const { data: channelsResponse } = useQuery<any>({
    queryKey: ["/api/broadcasts/channels"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/broadcasts/channels");
      return res.json();
    },
  });

  // Only *onboarded* channels belong in the picker. A wa_account starts life as
  // PENDING and only flips to status 'ACTIVE' once the WhatsApp microservice
  // confirms registration, so we hide any account that isn't ACTIVE (e.g.
  // half-created accounts that were never fully onboarded).
  const { data: waAccountsResponse } = useQuery<any>({
    queryKey: ["/api/whatsapp/accounts"],
    queryFn: async () => {
      // `onboard_platform=all` — the endpoint defaults to Business API only
      // (replyagent parity); broadcasts can be sent from Coexistence numbers
      // too, so opt out of that default here.
      const res = await apiRequest("GET", "/api/whatsapp/accounts?onboard_platform=all");
      return res.json();
    },
  });
  const onboardedAccountIds = new Set<string>(
    (waAccountsResponse?.wa ?? [])
      .filter((a: any) => String(a.status).toUpperCase() === "ACTIVE")
      .map((a: any) => String(a.id)),
  );
  const channels: any[] = (channelsResponse?.channels ?? []).filter(
    (c: any) => c.channel_type !== "whatsapp" || onboardedAccountIds.has(String(c.channelable_id)),
  );
  const defaultChannel = channels[0] ?? null;

  // Workspace tags — drives the composer's "Tag failed contacts" dropdown.
  // Uses the same /api/tags/list endpoint the SmartFlow trigger picker
  // already consumes, so React Query dedupes the payload across views.
  const { data: tagsResponse } = useQuery<any>({
    queryKey: ["/api/tags/list"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/tags/list");
      return res.json();
    },
  });
  const workspaceTags: Array<{ id: string; name: string }> = useMemo(() => {
    const raw = tagsResponse?.tags ?? tagsResponse?.data ?? tagsResponse ?? [];
    if (!Array.isArray(raw)) return [];
    return raw
      .filter((tg: any) => tg?.id != null && tg?.name)
      .map((tg: any) => ({ id: String(tg.id), name: String(tg.name) }));
  }, [tagsResponse]);

  // Workspace custom fields — populates the "Custom Fields" category in
  // the audience condition picker.
  const { data: customFieldsResponse } = useQuery<any>({
    queryKey: ["/api/custom-fields"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/custom-fields");
      return res.json();
    },
  });
  const workspaceCustomFields: Array<{ id: string; name: string; slug: string }> = useMemo(() => {
    const raw = customFieldsResponse?.fields ?? customFieldsResponse?.data ?? customFieldsResponse ?? [];
    if (!Array.isArray(raw)) return [];
    return raw
      .filter((f: any) => f?.id != null)
      .map((f: any) => ({
        id: String(f.id),
        name: String(f.label ?? f.name ?? `#${f.id}`),
        // The backend audience filter looks custom fields up by slug.
        slug: String(f.slug ?? ""),
      }));
  }, [customFieldsResponse]);

  // Workspace agents/users — powers the Agent filter dropdown above the
  // stat cards. Users are keyed by string id so filter matches downstream
  // work regardless of BigInt / int / string representations returned by
  // different endpoints.
  const { data: usersResponse } = useQuery<any>({
    queryKey: ["/api/users"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/users");
      return res.json();
    },
  });
  const workspaceUsers: Array<{ id: string; name: string }> = useMemo(() => {
    const raw = usersResponse?.users ?? usersResponse?.data ?? usersResponse ?? [];
    if (!Array.isArray(raw)) return [];
    return raw
      .filter((u: any) => u?.id != null)
      .map((u: any) => ({
        id: String(u.id),
        name: String(
          u.name
            ?? u.full_name
            ?? [u.first_name, u.last_name].filter(Boolean).join(" ").trim()
            ?? u.email
            ?? `#${u.id}`,
        ),
      }));
  }, [usersResponse]);

  // Real WhatsApp templates (approved only) — replaces the previous hardcoded
  // mock list. The shape returned by the backend (`components` array, Meta
  // format) gets flattened into the {header, body, footer, variables, buttons}
  // shape PreviewV2 + the form selects expect.
  const { data: templatesResponse } = useQuery<any>({
    queryKey: ["/api/broadcasts/templates", defaultChannel?.channelable_id ?? ""],
    queryFn: async () => {
      const channelParam = defaultChannel?.channelable_id
        ? `?channelable_id=${defaultChannel.channelable_id}`
        : "";
      const res = await apiRequest("GET", `/api/broadcasts/templates${channelParam}`);
      return res.json();
    },
    enabled: !!defaultChannel,
  });

  const createBroadcastMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/broadcasts", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/broadcasts"] });
      toast({
        title: t("campaign_manager.toast.created_title"),
        description: t("campaign_manager.toast.created_desc"),
      });
      setCreateOpen(false);
      resetCreateCampaignForm();
    }
  });

  const updateBroadcastMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number, data: any }) => {
      const res = await apiRequest("PATCH", `/api/broadcasts/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/broadcasts"] });
      toast({
        title: t("campaign_manager.toast.updated_title"),
        description: t("campaign_manager.toast.updated_desc"),
      });
      setCreateOpen(false);
      setEditingCampaignId(null);
      resetCreateCampaignForm();
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/broadcasts/${id}`);
    },
    onSuccess: () => {
      toast({
        title: t("campaign_manager.toast.deleted_title"),
        description: t("campaign_manager.toast.deleted_desc"),
      });
      queryClient.invalidateQueries({ queryKey: ["/api/broadcasts"] });
      setShowDeleteModal(false);
      setCampaignToDelete(null);
    },
    onError: (err: Error) => {
      toast({
        title: t("campaign_manager.toast.delete_failed"),
        description: err.message,
        variant: "destructive",
      });
    }
  });

  // Real WhatsApp templates. The backend returns each Meta `components` array;
  // we flatten the HEADER/BODY/FOOTER/BUTTONS entries into the simpler shape
  // PreviewV2 + the existing form code already understand. Variables are
  // pulled out of the body text by counting `{{1}}` `{{2}}` placeholders.
  // NOTE: declared BEFORE `campaigns` because that memo references this
  // value — flipping the order causes a TDZ runtime crash.
  const whatsappTemplates = useMemo(() => {
    const list: any[] = templatesResponse?.templates ?? [];
    return list.map((tpl: any) => {
      const components: any[] = Array.isArray(tpl.components) ? tpl.components : [];
      const header = components.find((c) => c?.type === "HEADER");
      const body = components.find((c) => c?.type === "BODY");
      const footer = components.find((c) => c?.type === "FOOTER");
      const buttonsBlock = components.find((c) => c?.type === "BUTTONS");

      const bodyText: string = body?.text ?? "";
      const placeholderCount = (bodyText.match(/\{\{\d+\}\}/g) ?? []).length;
      const variables = Array.from({ length: placeholderCount }, (_, i) => `param_${i + 1}`);
      const variableSamples: Record<string, string> = {};
      variables.forEach((v) => (variableSamples[v] = ""));

      return {
        id: Number(tpl.id),
        backend_id: tpl.id, // preserve string form for write-back
        name: tpl.name,
        category: tpl.category,
        language: tpl.language,
        body: bodyText,
        header: header?.text ?? "",
        footer: footer?.text ?? "",
        variables,
        variableSamples,
        buttons: Array.isArray(buttonsBlock?.buttons)
          ? buttonsBlock.buttons.map((b: any, idx: number) => ({
              id: idx + 1,
              type: b?.type ?? "quick-reply",
              buttonText: b?.text ?? "",
              websiteUrl: b?.url ?? "",
              phoneNumber: b?.phone_number ?? "",
            }))
          : [],
      };
    });
  }, [templatesResponse]);

  const campaigns = useMemo(() => {
    if (!broadcastsData?.broadcasts) return [];
    const templateById = new Map<number, any>();
    whatsappTemplates.forEach((tpl: any) => templateById.set(tpl.id, tpl));

    // Backend status (lowercase: draft / pending / in_progress / completed /
    // failed) → the UI status vocab used by the badge colours and filters.
    const statusToUi: Record<string, string> = {
      draft: "draft",
      pending: "scheduled",
      in_progress: "sending",
      completed: "sent",
      failed: "failed",
    };

    return (broadcastsData.broadcasts as any[]).map((b: any) => {
      const rawStatus = String(b.status ?? "draft").toLowerCase();
      // `pending` covers two very different things: waiting for a future
      // send slot ("Scheduled") and handed to the sender right now, which
      // the cron picks up within a minute ("Queued"). Showing "Scheduled"
      // for a Send-now broadcast reads like it didn't send.
      let uiStatus = statusToUi[rawStatus] ?? rawStatus;
      if (rawStatus === "pending") {
        const due = b.scheduled_at ?? b.scheduledAt ?? null;
        const dueDate = due ? new Date(due) : null;
        const isFuture = !!dueDate && !Number.isNaN(dueDate.getTime()) && dueDate.getTime() > Date.now();
        uiStatus = isFuture ? "scheduled" : "queued";
      }
      const metaType = b.metadata?.type ?? (b.channel_type === "whatsapp" ? "Broadcast" : "API Triggered");
      const metaMessageType =
        b.metadata?.messageType ?? b.metadata?.message_type ?? (b.scheduled_at ? "Scheduled" : "Immediate");
      const templateRow = b.wa_template_id ? templateById.get(Number(b.wa_template_id)) : null;

      // Be defensive about date field names — Prisma serialises snake_case
      // by default but custom transformers (or older saved metadata) may
      // expose camelCase variants. Reject obvious garbage (Invalid Date).
      const parseDate = (v: any): Date | undefined => {
        if (!v) return undefined;
        const d = new Date(v);
        return Number.isNaN(d.getTime()) ? undefined : d;
      };
      // Existing rows in the Laravel-era schema may have `created_at = NULL`
      // because the column had no `@default(now())` before today. Fall back
      // to `updated_at` and finally the metadata stamps so the column shows
      // something meaningful even for pre-migration data.
      const createdRaw =
        b.created_at ??
        b.createdAt ??
        b.metadata?.created_at ??
        b.metadata?.createdAt ??
        b.updated_at ??
        b.updatedAt ??
        b.metadata?.startDate;
      const scheduledRaw =
        b.scheduled_at ??
        b.scheduledAt ??
        b.metadata?.scheduled_at ??
        b.metadata?.scheduledAt ??
        b.metadata?.schedules?.[0]?.date ??
        b.metadata?.recurringStartDate;

      return {
        id: Number(b.id),
        name: b.name,
        type: metaType,
        messageType: metaMessageType,
        sent: b.total_sent || 0,
        delivered: b.total_sent || 0, // Per-recipient delivery tracking not wired yet; falls back to total_sent
        audience: b.total_audience || 0,
        failed: b.total_failed || 0,
        channelType: b.channel_type || "whatsapp",
        channelName: b.channel?.name ?? b.channelable?.name ?? b.channel_name ?? "",
        channelableId: b.channelable_id != null ? String(b.channelable_id) : null,
        // The row's owning agent — try the common columns different
        // backends use. Falls back to null so unassigned rows don't
        // accidentally match a filter.
        agentId:
          b.assigned_to != null ? String(b.assigned_to)
          : b.assigned_user_id != null ? String(b.assigned_user_id)
          : b.created_by != null ? String(b.created_by)
          : b.user_id != null ? String(b.user_id)
          : b.creator_id != null ? String(b.creator_id)
          : b.metadata?.agentId != null ? String(b.metadata.agentId)
          : null,
        metadata: b.metadata ?? {},
        createdAt: parseDate(createdRaw),
        status: uiStatus,
        whatsAppTemplateName: templateRow?.name ?? (b.metadata?.whatsAppTemplateName ?? ""),
        startDate: parseDate(createdRaw),
        scheduledAt: parseDate(scheduledRaw),
        repeatFrequency: b.repeat_frequency || "",
        dailyRepeatInterval: b.daily_repeat_interval || "1",
        weeklyRepeatDays: Array.isArray(b.weekly_repeat_days) ? b.weekly_repeat_days : [],
        monthlyRepeatDates: Array.isArray(b.monthly_repeat_dates) ? b.monthly_repeat_dates : [],
        deliverInTimezone: !!b.deliver_in_timezone,
        csvFileName: b.csv_filename || "",
        recurringStartDate: b.start_date ? new Date(b.start_date) : undefined,
        recurringEndDate: b.end_date ? new Date(b.end_date) : undefined,
        recurringTime: b.recurring_time ? b.recurring_time : { hour: "", minute: "", period: "" },
        endDate: b.end_date ? new Date(b.end_date) : undefined,
        neverEnds: !!b.never_ends,
      };
    }) as Campaign[];
  }, [broadcastsData, whatsappTemplates]);

  const handleConfirmDelete = () => {
    if (campaignToDelete) {
      deleteMutation.mutate(campaignToDelete.id);
    }
  };

  // Modal states
  const [cloneDialogOpen, setCloneDialogOpen] = useState(false);
  const [cloneCampaignName, setCloneCampaignName] = useState("");
  const [campaignToCloneId, setCampaignToCloneId] = useState<number | null>(null);
  const [selectedCampaignForPerformance, setSelectedCampaignForPerformance] = useState<Campaign | null>(null);
  const [showArchiveModal, setShowArchiveModal] = useState(false);
  const [campaignToArchive, setCampaignToArchive] = useState<Campaign | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [campaignToDelete, setCampaignToDelete] = useState<Campaign | null>(null);
  const [showBulkArchiveModal, setShowBulkArchiveModal] = useState(false);
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);
  const [recipientSort, setRecipientSort] = useState<{ column: string; direction: "asc" | "desc" } | null>(null);
  const [recipientSearchQuery, setRecipientSearchQuery] = useState("");
  const [recipientPage, setRecipientPage] = useState(1);
  const [recipientRowsPerPage, setRecipientRowsPerPage] = useState(10);
  const [selectedRecipientStatus, setSelectedRecipientStatus] = useState<string[]>([]);

  const dropdownRef = useRef<HTMLDivElement>(null);

  const handleColumnSort = (column: string) => {
    if (sort?.column === column) {
      // Toggle: asc -> desc -> unsorted
      if (sort.direction === "asc") {
        setSort({ column, direction: "desc" });
      } else {
        setSort(null);
      }
    } else {
      // New column, start with asc
      setSort({ column, direction: "asc" });
    }
  };

  const renderSortIcon = (column: string) => {
    const isActive = sort?.column === column;
    const color = isActive ? "text-foreground" : "text-muted-foreground";

    if (!isActive) {
      return <div className="w-4 h-4 flex items-center justify-center"><ChevronsUpDown size={14} className={color} /></div>;
    }
    if (sort?.direction === "asc") {
      return <div className="w-4 h-4 flex items-center justify-center"><ChevronUp size={14} className={color} /></div>;
    }
    return <div className="w-4 h-4 flex items-center justify-center"><ChevronDownIcon size={14} className={color} /></div>;
  };

  const getSortedCampaigns = () => {
    let data = [...campaigns];

    if (sort) {
      data.sort((a, b) => {
        const aVal = a[sort.column as keyof Campaign];
        const bVal = b[sort.column as keyof Campaign];

        let comparison = 0;
        if (typeof aVal === "string" && typeof bVal === "string") {
          comparison = sort.direction === "asc" ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
        } else if (typeof aVal === "number" && typeof bVal === "number") {
          comparison = sort.direction === "asc" ? aVal - bVal : bVal - aVal;
        }

        return comparison;
      });
    }

    return data;
  };

  // Handle CSV column sorting
  const handleCsvColumnSort = (column: string) => {
    if (csvSort?.column === column) {
      // Toggle: asc -> desc -> unsorted
      if (csvSort.direction === "asc") {
        setCsvSort({ column, direction: "desc" });
      } else {
        setCsvSort(null);
      }
    } else {
      // New column, start with asc
      setCsvSort({ column, direction: "asc" });
    }
  };

  // Get sorted CSV data based on current sort state
  const getSortedCsvData = () => {
    if (!csvSort) return csvData;

    const sortedData = [...csvData].sort((a, b) => {
      const aVal = a[csvSort.column as keyof typeof a];
      const bVal = b[csvSort.column as keyof typeof b];

      let comparison = 0;
      if (typeof aVal === "string" && typeof bVal === "string") {
        comparison = csvSort.direction === "asc" ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      } else if (typeof aVal === "number" && typeof bVal === "number") {
        comparison = csvSort.direction === "asc" ? aVal - bVal : bVal - aVal;
      }

      return comparison;
    });

    return sortedData;
  };

  const getSortedLocalCsvData = () => {
    if (!csvSort) return localCsvData;

    const sortedData = [...localCsvData].sort((a, b) => {
      const aVal = a[csvSort.column as keyof typeof a];
      const bVal = b[csvSort.column as keyof typeof b];

      let comparison = 0;
      if (typeof aVal === "string" && typeof bVal === "string") {
        comparison = csvSort.direction === "asc" ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      } else if (typeof aVal === "number" && typeof bVal === "number") {
        comparison = csvSort.direction === "asc" ? aVal - bVal : bVal - aVal;
      }

      return comparison;
    });

    return sortedData;
  };

  // Render sort icon for CSV columns
  const renderCsvSortIcon = (column: string) => {
    const isActive = csvSort?.column === column;
    const color = isActive ? "text-foreground" : "text-muted-foreground";

    if (!isActive) {
      return <div className="w-4 h-4 flex items-center justify-center"><ChevronsUpDown size={14} className={color} /></div>;
    }
    if (csvSort?.direction === "asc") {
      return <div className="w-4 h-4 flex items-center justify-center"><ChevronUp size={14} className={color} /></div>;
    }
    return <div className="w-4 h-4 flex items-center justify-center"><ChevronDownIcon size={14} className={color} /></div>;
  };

  useEffect(() => {
    if (editingCampaignId !== null) {
      const campaignToEdit = campaigns.find(c => c.id === editingCampaignId);
      if (campaignToEdit) {
        setCampaignName(campaignToEdit.name);
        setSelectedWhatsAppTemplate(campaignToEdit.whatsAppTemplateName);
        // Set the selectedTemplate to match the pre-selected template name
        setSelectedTemplate(whatsappTemplates.find(tpl => tpl.name === campaignToEdit.whatsAppTemplateName) || null);

        if (campaignToEdit.type === "API Triggered") {
          setCampaignCreationStep("apiTriggeredForm");
          setCampaignStartDate(campaignToEdit.startDate);
          setCampaignEndDate(campaignToEdit.endDate);
          setNeverEnds(campaignToEdit.neverEnds || false);
        } else if (campaignToEdit.type === "Broadcast") {
          setCampaignCreationStep("broadcastForm");
          setBroadcastCampaignType(campaignToEdit.messageType);
          setDeliverInTimezone(campaignToEdit.deliverInTimezone || false);
          // For csvFile, we can't directly restore a File object from just its name and content
          // A dummy File object is created for display purposes, actual content is in csvData
          setCsvFile(campaignToEdit.csvFileName ? new File([], campaignToEdit.csvFileName) : null);
          setCsvData(campaignToEdit.csvContent || []);

          if (campaignToEdit.messageType === 'Scheduled') {
            setSchedules(campaignToEdit.schedules || [{ id: Date.now(), date: undefined, hour: "", minute: "", period: "" }]);
          } else if (campaignToEdit.messageType === 'Recurring') {
            setRecurringStartDate(campaignToEdit.recurringStartDate);
            setRecurringEndDate(campaignToEdit.recurringEndDate);
            setRecurringTime(campaignToEdit.recurringTime || { hour: "", minute: "", period: "" });
            setRepeatFrequency(campaignToEdit.repeatFrequency || "");
            setDailyRepeatInterval(campaignToEdit.dailyRepeatInterval || "1");
            setWeeklyRepeatDays(campaignToEdit.weeklyRepeatDays || []);
            setMonthlyRepeatDates(campaignToEdit.monthlyRepeatDates || []);
          }
        }
      }
    } else {
      // Reset form when not editing (e.g., creating a new campaign)
      resetCreateCampaignForm();
    }
  }, [editingCampaignId, campaigns]);



  const toggleCampaign = (id: number) => {
    setSelectedCampaigns((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]
    );
  };

  const toggleAll = () => {
    const filteredIds = getFilteredCampaigns().map(c => c.id);
    if (selectedCampaigns.length === filteredIds.length && filteredIds.every(id => selectedCampaigns.includes(id))) {
      setSelectedCampaigns([]);
    } else {
      setSelectedCampaigns(filteredIds);
    }
  };

  const getTypeBadgeClasses = (type: string) => {
    if (type === "Broadcast") return "bg-purple-100 text-purple-700";
    if (type === "API Triggered") return "bg-blue-100 text-blue-700";
    return "bg-gray-100 text-gray-700";
  };

  // Filter campaigns by tab, search, and dropdowns
  const getFilteredCampaigns = () => {
    let filtered = campaigns;

    // Filter by status
    if (selectedStatus.length > 0) {
      filtered = filtered.filter(c => selectedStatus.includes(c.status));
    }

    // Filter by search query
    if (searchQuery.trim()) {
      filtered = filtered.filter(c =>
        c.name.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Filter by channel (whatsapp / telegram / messenger / etc.)
    if (selectedChannels.length > 0) {
      filtered = filtered.filter(
        (c) => c.channelType && selectedChannels.includes(c.channelType),
      );
    }

    // Filter by date range. Values are tokens recognised by
    // dateRangeContains() — "today", "last7", "last30", "thisMonth".
    if (dateRangeFilter.length > 0) {
      const token = dateRangeFilter[0];
      filtered = filtered.filter((c) =>
        dateRangeMatches(c.createdAt ?? c.startDate, token),
      );
    }

    // Filter by agent. Empty selection = show all; picking one or more
    // restricts the list to rows owned by those user ids.
    if (selectedAgents.length > 0) {
      filtered = filtered.filter(
        (c) => c.agentId != null && selectedAgents.includes(c.agentId),
      );
    }

    return getSortedCampaigns().filter(c => filtered.includes(c));
  };

  // Clone handlers
  const handleOpenCloneDialog = (campaignId: number) => {
    const campaignToClone = campaigns.find(c => c.id === campaignId);
    if (!campaignToClone) return;

    setCampaignToCloneId(campaignId);
    setCloneCampaignName(campaignToClone.name);
    setCloneDialogOpen(true);
  };

  const handleCancelCloneDialog = () => {
    setCloneDialogOpen(false);
    setCloneCampaignName("");
    setCampaignToCloneId(null);
  };

  const handleCloneCampaign = () => {
    if (!campaignToCloneId || !cloneCampaignName.trim()) return;

    const campaignToClone = campaigns.find(c => c.id === campaignToCloneId);
    if (!campaignToClone) return;

    const clonedCampaign: Campaign = {
      ...campaignToClone,
      id: Date.now(),
      name: cloneCampaignName,
      status: "draft",
      sent: 0,
      delivered: 0,
    };

    createBroadcastMutation.mutate(clonedCampaign);
    toast({
      title: t("campaign_manager.toast.cloned_title"),
      description: t("campaign_manager.toast.cloned_desc", { name: cloneCampaignName }),
    });
    handleCancelCloneDialog();
  };

  // Archive handlers
  const handleOpenArchiveModal = (campaign: Campaign) => {
    setCampaignToArchive(campaign);
    setShowArchiveModal(true);
  };

  const handleConfirmArchive = () => {
    if (!campaignToArchive) return;

    updateBroadcastMutation.mutate({ id: campaignToArchive.id, data: { status: "archived" } });
    toast({
      title: t("campaign_manager.toast.archived_title"),
      description: t("campaign_manager.toast.archived_desc", { name: campaignToArchive.name }),
    });
    setShowArchiveModal(false);
    setCampaignToArchive(null);
  };

  // Delete handlers
  const handleOpenDeleteModal = (campaign: Campaign) => {
    setCampaignToDelete(campaign);
    setShowDeleteModal(true);
  };

  // Get archivable campaigns (non-archived)
  const getArchivableCampaigns = () => {
    return selectedCampaigns.filter(id => {
      const campaign = campaigns.find(c => c.id === id);
      return campaign && campaign.status !== "archived";
    });
  };

  // Get deletable campaigns (archived only)
  const getDeletableCampaigns = () => {
    return selectedCampaigns.filter(id => {
      const campaign = campaigns.find(c => c.id === id);
      return campaign && campaign.status === "archived";
    });
  };

  // Bulk archive handler
  const handleBulkArchive = () => {
    const archivable = getArchivableCampaigns();
    // Bulk actions should ideally hit a bulk API. For now, hitting update for each or TODO.
    archivable.forEach(id => updateBroadcastMutation.mutate({ id, data: { status: "archived" } }));
    toast({
      title: t("campaign_manager.toast.bulk_archived_title"),
      description: t("campaign_manager.toast.bulk_archived_desc", { count: archivable.length }),
    });
    setShowBulkArchiveModal(false);
    setSelectedCampaigns([]);
  };

  // Bulk delete handler
  const handleBulkDelete = () => {
    const deletable = getDeletableCampaigns();
    // Bulk actions should ideally hit a bulk API.
    deletable.forEach(id => deleteMutation.mutate(id));
    toast({
      title: t("campaign_manager.toast.bulk_deleted_title"),
      description: t("campaign_manager.toast.bulk_deleted_desc", { count: deletable.length }),
    });
    setShowBulkDeleteModal(false);
    setSelectedCampaigns([]);
  };

  const handleRecipientSort = (column: string) => {
    if (recipientSort?.column === column) {
      if (recipientSort.direction === "asc") {
        setRecipientSort({ column, direction: "desc" });
      } else {
        setRecipientSort(null);
      }
    } else {
      setRecipientSort({ column, direction: "asc" });
    }
  };

  const renderRecipientSortIcon = (column: string) => {
    const isActive = recipientSort?.column === column;
    const color = isActive ? "text-foreground" : "text-muted-foreground";

    if (!isActive) {
      return <div className="w-4 h-4 flex items-center justify-center"><ChevronsUpDown size={14} className={color} /></div>;
    }
    if (recipientSort?.direction === "asc") {
      return <div className="w-4 h-4 flex items-center justify-center"><ChevronUp size={14} className={color} /></div>;
    }
    return <div className="w-4 h-4 flex items-center justify-center"><ChevronDownIcon size={14} className={color} /></div>;
  };

  const getSortedRecipients = () => {
    let data = [...(selectedCampaignForPerformance?.recipients || [])];

    if (recipientSearchQuery) {
      data = data.filter(r => r.name.toLowerCase().includes(recipientSearchQuery.toLowerCase()) || r.phone.toLowerCase().includes(recipientSearchQuery.toLowerCase()));
    }

    if (recipientSort) {
      data.sort((a, b) => {
        const aVal = a[recipientSort.column as keyof typeof a];
        const bVal = b[recipientSort.column as keyof typeof b];

        let comparison = 0;
        if (recipientSort.column === "status") {
          const order = ["Viewed", "Delivered", "Sent", "Failed"];
          const aIndex = order.indexOf(aVal as string);
          const bIndex = order.indexOf(bVal as string);
          comparison = recipientSort.direction === "asc" ? aIndex - bIndex : bIndex - aIndex;
        } else if (typeof aVal === "string" && typeof bVal === "string") {
          comparison = recipientSort.direction === "asc" ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
        } else if (typeof aVal === "number" && typeof bVal === "number") {
          comparison = recipientSort.direction === "asc" ? aVal - bVal : bVal - aVal;
        }

        return comparison;
      });
    }

    if (selectedRecipientStatus.length > 0) {
      data = data.filter(r => selectedRecipientStatus.includes(r.status));
    }

    return data;
  };

  const resetCreateCampaignForm = () => {
    setCampaignCreationStep("selectType");
    setCampaignName("");
    setNewBroadcastChannelKey("");
    setCampaignStartDate(undefined);
    setCampaignEndDate(undefined);
    setSelectedWhatsAppTemplate(null);
    setSelectedTemplate(null);
    setComposerVariables({});
    setNeverEnds(false);
    setSchedules([{ id: Date.now(), date: undefined, hour: "", minute: "", period: "" }]);
    setBroadcastCampaignType("");
    setCsvFile(null);
    setCsvData([]);
    setCsvError(null);
    setDeliverInTimezone(false);
    setRecurringStartDate(undefined);
    setRecurringEndDate(undefined);
    setRecurringTime({ hour: "", minute: "", period: "" });
    setRepeatFrequency("");
    setDailyRepeatInterval("1");
    setWeeklyRepeatDays([]);
    setMonthlyRepeatDates([]);
    setCsvSort(null);
  };

  // Helper: build the proper backend payload from the form state. The wire
  // shape is what the new `BroadcastsService` expects — flat schema columns
  // plus a `metadata` blob carrying all the UI-only / recurring extras.
  const buildBroadcastPayload = (
    type: "API Triggered" | "Broadcast",
    uiStatus: "draft" | "scheduled",
  ) => {
    const templateRow = whatsappTemplates.find((tpl: any) => tpl.name === selectedWhatsAppTemplate);
    const wa_template_id = templateRow?.backend_id ?? templateRow?.id ?? null;

    // First scheduled slot drives `scheduled_at`. Backend treats "pending"
    // broadcasts as ready-for-cron; the actual gate is `scheduled_at <= NOW()`.
    let scheduled_at: string | null = null;
    if (uiStatus === "scheduled") {
      if (type === "API Triggered" && campaignStartDate) {
        scheduled_at = campaignStartDate.toISOString();
      } else if (type === "Broadcast") {
        if (broadcastCampaignType === "Scheduled" && schedules[0]?.date) {
          scheduled_at = new Date(schedules[0].date).toISOString();
        } else if (broadcastCampaignType === "Recurring" && recurringStartDate) {
          scheduled_at = new Date(recurringStartDate).toISOString();
        }
      }
    }

    const metadata: Record<string, any> = {
      type,
      messageType: type === "API Triggered" ? "Recurring" : broadcastCampaignType,
      whatsAppTemplateName: selectedWhatsAppTemplate,
    };
    if (type === "API Triggered") {
      Object.assign(metadata, {
        startDate: campaignStartDate ?? null,
        endDate: neverEnds ? null : campaignEndDate ?? null,
        neverEnds,
      });
    } else {
      Object.assign(metadata, {
        csvFileName: csvFile?.name ?? null,
        deliverInTimezone,
      });
      if (broadcastCampaignType === "Scheduled") metadata.schedules = schedules;
      if (broadcastCampaignType === "Recurring") {
        Object.assign(metadata, {
          recurringStartDate,
          recurringEndDate,
          recurringTime,
          repeatFrequency,
          dailyRepeatInterval,
          weeklyRepeatDays,
          monthlyRepeatDates,
        });
      }
    }

    return {
      name: campaignName,
      channel_type: "whatsapp" as const,
      channelable_id: defaultChannel?.channelable_id ?? null,
      channelable_type: defaultChannel?.channelable_type ?? null,
      wa_template_id,
      scheduled_at,
      status: uiStatus, // backend normalises "scheduled" → "pending"
      metadata,
    };
  };

  // ─── Composer submit ────────────────────────────────────────────────
  // Builds a broadcast payload from the composer's audience + schedule +
  // delivery-profile state and posts it. "draft" saves without kicking
  // off delivery; "now" transitions the newly-created row into pending
  // via the existing sendBroadcast endpoint so the cron sweep picks it
  // up within the next minute.
  /**
   * Translate a composer condition row into the shape the backend audience
   * filter understands: { module, key, filter, value }. Returns null when the
   * backend has no module for that field yet — callers must then refuse to
   * send rather than drop it, because a dropped condition silently WIDENS the
   * audience (an empty item list means "everyone" server-side).
   */
  const toBackendFilter = (c: {
    fieldId: string;
    operator: string;
    value: string;
    valueLabel?: string;
  }): { module: string; key: string; filter: string; value: any } | null => {
    const filter = c.operator;
    // Contact columns — the field id doubles as the column name.
    if (
      c.fieldId === "first_name" ||
      c.fieldId === "last_name" ||
      c.fieldId === "full_name" ||
      c.fieldId === "title" ||
      c.fieldId === "source"
    ) {
      return { module: "contact", key: c.fieldId, filter, value: c.value };
    }
    if (c.fieldId === "contact_id") {
      return { module: "contact", key: "id", filter, value: c.value };
    }
    if (c.fieldId === "created_on") {
      return { module: "contact", key: "created_at", filter, value: c.value };
    }
    // Numbers live on contact_mobiles.
    if (c.fieldId === "phone" || c.fieldId === "whatsapp_number" || c.fieldId === "phone_country_code") {
      return { module: "mobile_number", key: c.fieldId, filter, value: c.value };
    }
    if (c.fieldId === "email") {
      return { module: "email", key: "email", filter, value: c.value };
    }
    if (c.fieldId === "tag") {
      return {
        module: "tag",
        key: "tag",
        filter,
        value: { id: c.value, name: c.valueLabel ?? c.value },
      };
    }
    if (c.fieldId.startsWith("cf_")) {
      const cf = workspaceCustomFields.find((f) => `cf_${f.id}` === c.fieldId);
      if (!cf?.slug) return null;
      return { module: "custom_field", key: cf.slug, filter, value: c.value };
    }
    // Opportunity + per-channel attributes have no backend module yet.
    return null;
  };

  // Conditions the backend can't translate — send is blocked while any exist.
  const unsupportedConditions = composerConditions.filter((c) => toBackendFilter(c) === null);

  // Real audience size, evaluated by the backend with the very same filter
  // engine the sender uses — so the number shown is the number messaged.
  // (It used to display `composerConditions.length`, i.e. how many conditions
  // were picked, which is why the preview never matched what was sent.)
  const audienceFilterPayload = useMemo(
    () => ({
      condition: composerAudienceMatch,
      items: composerConditions
        .map(toBackendFilter)
        .filter((f): f is NonNullable<typeof f> => f !== null),
    }),
    [composerConditions, composerAudienceMatch, workspaceCustomFields],
  );
  const { data: audiencePreview, isFetching: audienceLoading } = useQuery<{ count: number }>({
    queryKey: ["/api/broadcasts/audience/preview", JSON.stringify(audienceFilterPayload)],
    queryFn: async () => {
      const res = await apiRequest("POST", "/api/broadcasts/audience/preview", {
        filters: audienceFilterPayload,
      });
      return res.json();
    },
    // Only meaningful once the composer is open with at least one usable
    // condition; an empty item list would count the whole workspace.
    enabled: composerOpen && audienceFilterPayload.items.length > 0,
    staleTime: 15_000,
  });
  const audienceCount =
    audienceFilterPayload.items.length > 0 ? (audiencePreview?.count ?? 0) : 0;

  const buildComposerPayload = (uiStatus: "draft" | "scheduled") => {
    const templateRow = whatsappTemplates.find((tpl: any) => tpl.name === selectedWhatsAppTemplate);
    const wa_template_id = templateRow?.backend_id ?? templateRow?.id ?? null;
    // Ordered values for the template's body placeholders — index 0 → {{1}}.
    const templateParams = (templateRow?.variables ?? []).map(
      (_: any, i: number) => composerVariables[String(i + 1)] ?? "",
    );
    const active = channels.find(
      (c: any) => `${c.channel_type}:${c.channelable_id}` === newBroadcastChannelKey,
    ) ?? defaultChannel;

    let scheduled_at: string | null = null;
    if (uiStatus === "scheduled" && composerScheduleMode === "later" && composerScheduleDate) {
      const d = new Date(composerScheduleDate);
      d.setHours(Number(composerScheduleHour), Number(composerScheduleMinute), 0, 0);
      scheduled_at = d.toISOString();
    }

    return {
      name: campaignName,
      channel_type: active?.channel_type ?? "whatsapp",
      channelable_id: active?.channelable_id ?? null,
      channelable_type: active?.channelable_type ?? null,
      wa_template_id,
      scheduled_at,
      status: uiStatus,
      // The audience the user built. Without this the backend sees no filters
      // and targets EVERY contact in the workspace.
      filters: {
        condition: composerAudienceMatch,
        items: composerConditions
          .map(toBackendFilter)
          .filter((f): f is NonNullable<typeof f> => f !== null),
      },
      metadata: {
        type: "Broadcast",
        messageType: composerScheduleMode === "now" ? "Immediate" : "Scheduled",
        whatsAppTemplateName: selectedWhatsAppTemplate,
        templateParams,
        // Kept so the composer can rebuild the rows when editing.
        conditions: composerConditions,
        audienceMatch: composerAudienceMatch,
        pauseIfMarketing: composerPauseIfMarketing,
        tagFailed: composerTagFailed || null,
        deliveryProfile: {
          preset: composerDeliveryPreset,
          batchSize: composerBatchSize,
          batchPause: composerBatchPause,
          intervalMin: composerIntervalMin,
          intervalMax: composerIntervalMax,
        },
      },
    };
  };

  // Composer close = clear both the open flag AND the edit-target id so a
  // subsequent "+ New Broadcast" doesn't accidentally PATCH the last-
  // opened row.
  const closeComposer = () => {
    setComposerOpen(false);
    setEditingCampaignId(null);
    setComposerSendAttempted(false);
  };

  // Hydrate every composer input from a saved campaign row and open the
  // composer. Called by both the row's Edit icon (pencil) and View icon
  // (eye) — replyagent doesn't have a separate read-only view, opening
  // the composer with the campaign already loaded IS the view.
  const openComposerForCampaign = (campaign: Campaign) => {
    setEditingCampaignId(campaign.id);
    setCampaignName(campaign.name ?? "");
    // Reconstruct the channel key so Column-1's Sending From renders the
    // right chip. Prefer channelableId; fall back to matching by name.
    const channelKey = campaign.channelableId
      ? `${campaign.channelType ?? "whatsapp"}:${campaign.channelableId}`
      : (() => {
          const match = channels.find(
            (c: any) =>
              String(c.channel_type) === (campaign.channelType ?? "whatsapp") &&
              (c.name ?? "") === (campaign.channelName ?? ""),
          );
          return match ? `${match.channel_type}:${match.channelable_id}` : "";
        })();
    setNewBroadcastChannelKey(channelKey);
    // Template
    setSelectedWhatsAppTemplate(campaign.whatsAppTemplateName || null);
    const editTpl =
      whatsappTemplates.find((tpl: any) => tpl.name === campaign.whatsAppTemplateName) || null;
    setSelectedTemplate(editTpl);
    // Restore saved placeholder values (ordered array in metadata.templateParams).
    const savedParams: any[] = Array.isArray(campaign.metadata?.templateParams)
      ? campaign.metadata.templateParams
      : [];
    const initVars: Record<string, string> = {};
    (editTpl?.variables ?? []).forEach((_: any, i: number) => {
      initVars[String(i + 1)] = savedParams[i] != null ? String(savedParams[i]) : "";
    });
    setComposerVariables(initVars);
    // Schedule
    if (campaign.scheduledAt) {
      setComposerScheduleMode("later");
      setComposerScheduleDate(new Date(campaign.scheduledAt));
      const d = new Date(campaign.scheduledAt);
      setComposerScheduleHour(String(d.getHours()).padStart(2, "0"));
      setComposerScheduleMinute(String(d.getMinutes()).padStart(2, "0"));
    } else {
      setComposerScheduleMode("now");
      setComposerScheduleDate(undefined);
    }
    // Composer-only extras (persisted under metadata by handleComposerSend).
    const md: any = campaign.metadata ?? {};
    setComposerAudienceMatch((md.audienceMatch === "all" ? "all" : "any"));
    setComposerPauseIfMarketing(!!md.pauseIfMarketing);
    setComposerTagFailed(md.tagFailed ?? "");
    const dp = md.deliveryProfile ?? {};
    setComposerDeliveryPreset(dp.preset ?? "standard");
    if (dp.batchSize != null) setComposerBatchSize(Number(dp.batchSize));
    if (dp.batchPause != null) setComposerBatchPause(Number(dp.batchPause));
    if (dp.intervalMin != null) setComposerIntervalMin(Number(dp.intervalMin));
    if (dp.intervalMax != null) setComposerIntervalMax(Number(dp.intervalMax));
    setComposerConditions(Array.isArray(md.conditions) ? md.conditions : []);
    setComposerSendAttempted(false);
    setComposerOpen(true);
  };

  const handleComposerSaveDraft = () => {
    if (!campaignName.trim() || !newBroadcastChannelKey) {
      toast({ title: t("campaign_manager.toast.missing_details_title"), description: t("campaign_manager.toast.missing_details_desc"), variant: "destructive" });
      return;
    }
    const payload = buildComposerPayload("draft");
    const onSuccess = () => {
      setComposerOpen(false);
      setEditingCampaignId(null);
    };
    // Edit path routes through the update mutation so we don't create a
    // duplicate row when the user re-saves.
    if (editingCampaignId) {
      updateBroadcastMutation.mutate({ id: editingCampaignId, data: payload }, { onSuccess });
    } else {
      createBroadcastMutation.mutate(payload, { onSuccess });
    }
  };

  const handleComposerSend = () => {
    // Flip the "attempted" flag so inline errors under each field surface.
    // The individual field checks are duplicated in the render logic —
    // this early-return just stops the network call. Once the user
    // fills the missing pieces the errors clear automatically since
    // they read the current values live.
    const templateVarsMissing =
      !!selectedTemplate &&
      (selectedTemplate.variables?.length ?? 0) > 0 &&
      selectedTemplate.variables.some(
        (_: any, i: number) => !(composerVariables[String(i + 1)] ?? "").trim(),
      );
    const anyMissing =
      !campaignName.trim() ||
      !newBroadcastChannelKey ||
      !selectedWhatsAppTemplate ||
      templateVarsMissing ||
      composerConditions.length === 0 ||
      (composerScheduleMode === "later" && !composerScheduleDate);
    if (anyMissing) {
      setComposerSendAttempted(true);
      toast({ title: t("campaign_manager.toast.complete_highlighted"), variant: "destructive" });
      return;
    }
    // Refuse instead of silently dropping: an untranslatable condition would be
    // stripped from the payload, and a broadcast with no filters goes to every
    // contact in the workspace.
    if (unsupportedConditions.length > 0) {
      setComposerSendAttempted(true);
      toast({
        title: t("campaign_manager.toast.unsupported_condition_title"),
        description: t("campaign_manager.toast.unsupported_condition_desc", {
          fields: unsupportedConditions.map((c) => c.fieldLabel).join(", "),
        }),
        variant: "destructive",
      });
      return;
    }
    setComposerSendAttempted(false);
    // Create OR update → then transition to sending if user picked "Send
    // now"; if they scheduled a future date the row stays "pending" and
    // the cron picks it up automatically.
    //
    // "Send now" must create a DRAFT: sendBroadcast only accepts draft/failed,
    // and creating with "scheduled" lands the row on `pending`, which made the
    // follow-up send call fail with "Only draft or failed broadcasts can be
    // sent (current: pending)" even though the cron then sent it anyway.
    const payload = buildComposerPayload(composerScheduleMode === "now" ? "draft" : "scheduled");
    const onSuccess = (data: any) => {
      const id = data?.id ?? data?.broadcast?.id ?? editingCampaignId;
      if (composerScheduleMode === "now" && id) {
        sendBroadcastMutation.mutate(Number(id));
      }
      setComposerOpen(false);
      setEditingCampaignId(null);
    };
    if (editingCampaignId) {
      updateBroadcastMutation.mutate({ id: editingCampaignId, data: payload }, { onSuccess });
    } else {
      createBroadcastMutation.mutate(payload, { onSuccess });
    }
  };

  const handleCreateCampaign = (status: "draft" | "scheduled") => {
    if (!defaultChannel) {
      toast({
        title: t("campaign_manager.toast.no_whatsapp_title"),
        description: t("campaign_manager.toast.no_whatsapp_desc"),
        variant: "destructive",
      });
      return;
    }
    const payload = buildBroadcastPayload("API Triggered", status);
    if (editingCampaignId) {
      updateBroadcastMutation.mutate({ id: editingCampaignId, data: payload });
    } else {
      createBroadcastMutation.mutate(payload);
    }
    setCreateOpen(false);
    setEditingCampaignId(null);
    resetCreateCampaignForm();
  };

  const handleCreateBroadcastCampaign = (status: "draft" | "scheduled") => {
    if (!defaultChannel) {
      toast({
        title: t("campaign_manager.toast.no_whatsapp_title"),
        description: t("campaign_manager.toast.no_whatsapp_desc"),
        variant: "destructive",
      });
      return;
    }
    if (broadcastCampaignType === "Immediate") setDeliverInTimezone(false);
    const payload = buildBroadcastPayload("Broadcast", status);
    if (editingCampaignId) {
      updateBroadcastMutation.mutate({ id: editingCampaignId, data: payload });
    } else {
      createBroadcastMutation.mutate(payload);
    }
    setCreateOpen(false);
    setEditingCampaignId(null);
    resetCreateCampaignForm();
  };

  // Send Now — transitions a draft broadcast into pending so the every-minute
  // cron sweep picks it up. Available from the row action menu.
  const sendBroadcastMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("POST", `/api/broadcasts/${id}/send`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/broadcasts"] });
      toast({
        title: t("campaign_manager.toast.queued_title"),
        description: t("campaign_manager.toast.queued_desc"),
      });
    },
    onError: (err: Error) => {
      toast({
        title: t("campaign_manager.toast.send_failed"),
        description: err.message,
        variant: "destructive",
      });
    },
  });

  const handleScheduleChange = (index: number, field: keyof Schedule, value: any) => {
    const newSchedules = [...schedules];
    newSchedules[index] = { ...newSchedules[index], [field]: value };
    setSchedules(newSchedules);
  };

  const addSchedule = () => {
    if (schedules.length < 5) {
      setSchedules([...schedules, { id: Date.now(), date: undefined, hour: "", minute: "", period: "" }]);
    }
  };

  const removeSchedule = (id: number) => {
    setSchedules(schedules.filter(s => s.id !== id));
  };

  const toggleWeeklyDay = (day: string) => {
    setWeeklyRepeatDays(prev =>
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
    );
  };

  const toggleMonthlyDate = (date: number) => {
    setMonthlyRepeatDates(prev =>
      prev.includes(date) ? prev.filter(d => d !== date) : [...prev, date]
    );
  };

  const isSchedulesInvalid = schedules.length === 0 || schedules.some(s => !s.date || !s.hour || !s.minute || !s.period);

  const isRecurringInvalid = !recurringStartDate || !recurringEndDate || !recurringTime.hour || !recurringTime.minute || !recurringTime.period || !repeatFrequency || (repeatFrequency === 'weekly' && weeklyRepeatDays.length === 0) || (repeatFrequency === 'monthly' && monthlyRepeatDates.length === 0);

  const hasAtLeastOneCompleteRow = localCsvData.some(row => row.name?.trim() && row.number?.trim());
  const hasPartiallyFilledRow = localCsvData.some(row => (row.name?.trim() && !row.number?.trim()) || (!row.name?.trim() && row.number?.trim()));
  const isCsvSaveDisabled = !hasAtLeastOneCompleteRow || hasPartiallyFilledRow;

  // Utility function to format tooltip names
  const formatTooltipName = (name: string): string => {
    return name
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, str => str.toUpperCase())
      .trim();
  };

  // Custom Tooltip Component
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-background border border-border rounded-md p-2 shadow-md">
          <p className="text-sm font-medium">{label}</p>
          {payload.map((entry: any, index: number) => (
            <div key={index} className="flex items-center gap-2">
              <span className="text-sm">{formatTooltipName(entry.name)}:</span>
              <span className="text-sm font-medium" style={{ color: entry.color }}>
                {entry.value}
              </span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };


  // ─── Full-page broadcast composer ────────────────────────────────
  // Rendered instead of the list when composerOpen is true. Uses the
  // campaignName + newBroadcastChannelKey the modal collected, plus the
  // composer's own audience / schedule / delivery state. Same shell
  // padding + rounded card as the list so the transition feels like
  // "same page, different content" rather than a modal spawn.
  if (composerOpen) {
    const activeChannel = channels.find(
      (c: any) => `${c.channel_type}:${c.channelable_id}` === newBroadcastChannelKey,
    );
    const activeChannelType = String(activeChannel?.channel_type ?? "whatsapp");
    const activeChannelName = activeChannel?.name ?? t("campaign_manager.composer.channel_fallback");
    const activeChannelSub = activeChannel?.phone_number ?? activeChannel?.display_phone_number ?? "";
    // Chip state per progress step. Audience needs a segment name AND a
    // resolved channel; Template needs a picked template; Schedule needs
    // either "now" or a picked date; Delivery is always ready (has
    // sensible defaults).
    const steps = [
      { key: "audience", label: t("campaign_manager.composer.step_audience"), ready: !!campaignName.trim() && !!newBroadcastChannelKey },
      { key: "template", label: t("campaign_manager.composer.step_template"), ready: !!selectedWhatsAppTemplate },
      { key: "schedule", label: t("campaign_manager.composer.step_schedule"), ready: composerScheduleMode === "now" || !!composerScheduleDate },
      { key: "delivery", label: t("campaign_manager.composer.step_delivery"), ready: true },
    ];
    const readyCount = steps.filter((s) => s.ready).length;
    const remaining = steps.length - readyCount;

    // Est. duration = time to deliver AUDIENCE messages given batch size
    // + inter-batch pause + per-message interval (using the midpoint of
    // the random range). Falls back to a dash while audience is 0.
    const midInterval = (composerIntervalMin + composerIntervalMax) / 2;
    const secondsPerBatch = composerBatchSize * midInterval + composerBatchPause;
    const numBatches = audienceCount > 0 ? Math.ceil(audienceCount / composerBatchSize) : 0;
    const totalSeconds = Math.max(0, numBatches * secondsPerBatch - composerBatchPause);
    const formatDuration = (s: number) => {
      if (s <= 0) return "—";
      const hh = Math.floor(s / 3600);
      const mm = Math.floor((s % 3600) / 60);
      const ss = Math.floor(s % 60);
      if (hh > 0) return `~${hh}h ${mm}m`;
      if (mm > 0) return `~${mm}m ${ss}s`;
      return `~${ss}s`;
    };
    const estDuration = formatDuration(totalSeconds);
    const isSubmitting = createBroadcastMutation.isPending || sendBroadcastMutation.isPending;
    return (
      <div className="px-6 py-6 pb-24 animate-in fade-in duration-500" data-testid="broadcast-composer">
        {/* Header card */}
        <div className="bg-white dark:bg-slate-900/50 rounded-[20px] border border-slate-300 dark:border-slate-800 shadow-xl shadow-slate-200/50 dark:shadow-none overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <button
                onClick={closeComposer}
                className="shrink-0 h-8 w-8 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center justify-center transition-colors"
                title={t("campaign_manager.composer.back")}
              >
                <ArrowLeft size={16} />
              </button>
              <div className="shrink-0 p-2 rounded-xl bg-primary text-primary-foreground shadow-sm">
                <Megaphone size={18} strokeWidth={2.5} />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h1 className="text-[16px] font-bold text-slate-900 dark:text-white truncate">
                    {editingCampaignId ? campaignName || t("campaign_manager.composer.untitled_broadcast") : t("campaign_manager.composer.performance_broadcast")}
                  </h1>
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 uppercase tracking-wider">
                    {editingCampaignId ? t("campaign_manager.composer.badge_edit") : t("campaign_manager.composer.badge_draft")}
                  </span>
                </div>
                <p className="text-[11.5px] text-slate-500 dark:text-slate-400 truncate">
                  {t("campaign_manager.composer.subtitle")}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button
                variant="ghost"
                size="sm"
                onClick={closeComposer}
                className="h-8 px-3 text-[12px] font-semibold text-slate-600 dark:text-slate-300"
              >
                {t("campaign_manager.common.cancel")}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleComposerSaveDraft}
                disabled={isSubmitting}
                className="h-8 px-3 text-[12px] font-semibold border-slate-200 dark:border-slate-800"
              >
                {createBroadcastMutation.isPending && <Loader2 size={12} className="mr-1.5 animate-spin" />}
                {t("campaign_manager.composer.save_as_draft")}
              </Button>
              <Button
                size="sm"
                onClick={handleComposerSend}
                disabled={isSubmitting || readyCount < 3}
                className="h-8 px-4 text-[12px] font-semibold bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm shadow-primary/20 disabled:opacity-60"
              >
                {sendBroadcastMutation.isPending
                  ? <Loader2 size={12} className="mr-1.5 animate-spin" />
                  : <Send size={13} strokeWidth={2.5} className="mr-1.5" />}
                {composerScheduleMode === "now" ? t("campaign_manager.composer.send_broadcast") : t("campaign_manager.composer.schedule_action")}
              </Button>
            </div>
          </div>

          {/* Progress steps */}
          <div className="px-5 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 bg-slate-50/40 dark:bg-slate-900/30">
            <div className="flex items-center gap-2 flex-wrap">
              {steps.map((s, i) => (
                <span
                  key={s.key}
                  className={cn(
                    "flex items-center gap-1.5 h-7 px-3 rounded-full text-[11.5px] font-semibold border transition-all",
                    s.ready
                      ? "bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-950/30 dark:border-emerald-900/40 dark:text-emerald-300"
                      : "bg-white border-slate-200 text-slate-500 dark:bg-slate-900 dark:border-slate-800 dark:text-slate-400",
                  )}
                >
                  {s.ready ? (
                    <CheckCircle2 size={12} strokeWidth={2.5} />
                  ) : (
                    <span className="h-4 w-4 rounded-full bg-slate-300 dark:bg-slate-700 flex items-center justify-center text-[9px] font-bold text-white">
                      {i + 1}
                    </span>
                  )}
                  {s.label}
                </span>
              ))}
            </div>
            <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 tabular-nums">
              <span className="text-slate-700 dark:text-slate-200 font-semibold">{t("campaign_manager.composer.ready_count", { ready: readyCount, total: steps.length })}</span>{" "}
              <span className="text-slate-700 dark:text-slate-200 font-semibold">{remaining}</span>{" "}
              {t("campaign_manager.composer.steps_remaining", { count: remaining })}
            </p>
          </div>

          {/* 3-column body */}
          <div className="px-5 py-5 grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Column 1: Audience */}
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/40 p-4 space-y-4">
              <div className="flex items-start gap-2.5">
                <span className="h-8 w-8 rounded-lg bg-fuchsia-100 dark:bg-fuchsia-900/40 flex items-center justify-center text-fuchsia-600 dark:text-fuchsia-400 shrink-0">
                  <UsersRound size={16} strokeWidth={2.5} />
                </span>
                <div className="min-w-0">
                  <p className="text-[9.5px] font-bold uppercase tracking-wider text-slate-400">{t("campaign_manager.composer.section_audience")}</p>
                  <h3 className="text-[14px] font-bold text-slate-900 dark:text-white">{t("campaign_manager.composer.who_receives")}</h3>
                </div>
              </div>
              {/* Sending from */}
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-3 flex items-center gap-3">
                <span className={cn(
                  "h-9 w-9 rounded-lg flex items-center justify-center shrink-0",
                  ({
                    whatsapp: "bg-emerald-100 text-emerald-600",
                    telegram: "bg-sky-100 text-sky-600",
                    messenger: "bg-blue-100 text-blue-600",
                    instagram: "bg-fuchsia-100 text-fuchsia-600",
                    webchat: "bg-orange-100 text-orange-600",
                  } as Record<string, string>)[activeChannelType] ?? "bg-slate-100 text-slate-600",
                )}>
                  <ChannelChipIcon channel={activeChannelType} size={16} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[9.5px] font-bold uppercase tracking-wider text-slate-400">{t("campaign_manager.composer.sending_from")}</p>
                  <p className="text-[12.5px] font-semibold text-slate-900 dark:text-white truncate">
                    {activeChannelName}
                  </p>
                </div>
                {activeChannelSub && (
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 shrink-0">
                    {activeChannelSub}
                  </span>
                )}
              </div>
              {/* Segment name */}
              <div className="space-y-1.5">
                <label className="text-[11.5px] font-semibold text-slate-700 dark:text-slate-300">{t("campaign_manager.composer.segment_name")}</label>
                <Input
                  value={campaignName}
                  onChange={(e) => setCampaignName(e.target.value.slice(0, 512))}
                  className={cn(
                    "h-9 text-[13px] rounded-lg",
                    composerSendAttempted && !campaignName.trim()
                      ? "border-rose-300 dark:border-rose-800 focus-visible:ring-rose-300"
                      : "border-slate-200 dark:border-slate-800",
                  )}
                />
                {composerSendAttempted && !campaignName.trim() && (
                  <p className="text-[11px] text-rose-500 italic">{t("campaign_manager.composer.segment_name_required")}</p>
                )}
              </div>
              {/* Match */}
              <div className="space-y-1.5">
                <label className="text-[11.5px] font-semibold text-slate-700 dark:text-slate-300">{t("campaign_manager.composer.match")}</label>
                <div className="grid grid-cols-2 gap-1 p-1 rounded-lg bg-slate-100 dark:bg-slate-800/60">
                  {(["any", "all"] as const).map((m) => (
                    <button
                      key={m}
                      onClick={() => setComposerAudienceMatch(m)}
                      className={cn(
                        "py-1.5 rounded-md text-[11.5px] font-semibold transition-all",
                        composerAudienceMatch === m
                          ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm"
                          : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200",
                      )}
                    >
                      {m === "any" ? t("campaign_manager.composer.match_any") : t("campaign_manager.composer.match_all")}
                    </button>
                  ))}
                </div>
              </div>
              {/* Selected conditions — each chip shows the full filter
                  ("Tag is 'marketing'") plus a small uppercase category
                  label at the top so the user can scan multiple
                  conditions at a glance. */}
              {composerConditions.length > 0 && (
                <div className="space-y-2">
                  {composerConditions.map((c, i) => {
                    const verb = conditionOperatorPreview(c.fieldType, c.operator, t);
                    const skips = operatorSkipsValue(c.operator);
                    const displayValue = skips
                      ? ""
                      : c.fieldType === "enum" || c.fieldType === "text"
                        ? `"${c.valueLabel || c.value}"`
                        : c.value;
                    return (
                      <div
                        key={c.id}
                        className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/40 px-3 py-2"
                      >
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span className="text-[9.5px] font-bold uppercase tracking-wider text-slate-400">
                            {c.category}
                          </span>
                          <button
                            onClick={() =>
                              setComposerConditions(composerConditions.filter((_, idx) => idx !== i))
                            }
                            className="p-0.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 shrink-0"
                            title={t("campaign_manager.common.remove")}
                          >
                            <X size={12} />
                          </button>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="h-6 w-6 rounded-md bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center text-emerald-600 shrink-0">
                            <ConditionGlyph name={c.icon} size={11} />
                          </span>
                          <p className="text-[12px] font-semibold text-slate-800 dark:text-slate-200 truncate flex-1">
                            {c.fieldLabel} {verb}{displayValue ? " " + displayValue : ""}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              {/* Add condition */}
              <button
                onClick={() => setConditionModalOpen(true)}
                className="w-full py-6 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 text-[11.5px] font-semibold text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/40 hover:border-primary/50 hover:text-primary transition-colors"
              >
                {t("campaign_manager.composer.add_condition")}
              </button>
              {/* Total audience — replyagent uses a warm rose→pink accent
                  so this row stands out from the emerald + slate chrome
                  around it. Number becomes a gradient text; a filled
                  circular user chip anchors the bottom-right. Placeholder
                  count = number of picked conditions until a real
                  contact-count endpoint is wired in. */}
              <div className="relative rounded-xl border border-rose-200 dark:border-rose-900/40 bg-gradient-to-br from-rose-50/70 via-white to-fuchsia-50/60 dark:from-rose-950/20 dark:via-slate-900/40 dark:to-fuchsia-950/20 p-3 overflow-hidden">
                <p className="text-[28px] font-bold leading-none tabular-nums bg-gradient-to-br from-rose-600 to-fuchsia-600 bg-clip-text text-transparent">
                  {audienceLoading ? "…" : audienceCount.toLocaleString()}
                </p>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mt-1.5">{t("campaign_manager.composer.total_audience")}</p>
                <p className="text-[10.5px] text-slate-400 dark:text-slate-500">
                  {composerConditions.length === 0
                    ? t("campaign_manager.composer.audience_hint_empty")
                    : unsupportedConditions.length > 0
                      ? t("campaign_manager.composer.audience_hint_unsupported")
                      : t("campaign_manager.composer.audience_hint_ready")}
                </p>
                {composerSendAttempted && composerConditions.length === 0 && (
                  <p className="text-[10.5px] text-rose-500 italic mt-1.5">
                    {t("campaign_manager.composer.no_audience_error")}
                  </p>
                )}
                <span className="absolute right-3 bottom-3 h-9 w-9 rounded-full bg-gradient-to-br from-rose-500 to-fuchsia-500 shadow-md shadow-rose-500/30 flex items-center justify-center">
                  <UsersRound size={16} className="text-white" strokeWidth={2.5} />
                </span>
              </div>
            </div>

            {/* Column 2: Configuration */}
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/40 p-4 space-y-4">
              <div className="flex items-start gap-2.5">
                <span className="h-8 w-8 rounded-lg bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center text-blue-600 dark:text-blue-400 shrink-0">
                  <MessageSquare size={16} strokeWidth={2.5} />
                </span>
                <div className="min-w-0">
                  <p className="text-[9.5px] font-bold uppercase tracking-wider text-slate-400">{t("campaign_manager.composer.section_configuration")}</p>
                  <h3 className="text-[14px] font-bold text-slate-900 dark:text-white">{t("campaign_manager.composer.message_and_schedule")}</h3>
                </div>
              </div>
              {/* Template */}
              <div className="space-y-1.5">
                <label className="text-[11.5px] font-semibold text-slate-700 dark:text-slate-300">{t("campaign_manager.composer.template")}</label>
                <Select
                  value={selectedWhatsAppTemplate || ""}
                  onValueChange={(value) => {
                    setSelectedWhatsAppTemplate(value);
                    const tpl = whatsappTemplates.find(tpl => tpl.name === value) || null;
                    setSelectedTemplate(tpl);
                    // Reset placeholder values for the newly picked template.
                    const count = tpl?.variables?.length ?? 0;
                    const next: Record<string, string> = {};
                    for (let i = 1; i <= count; i++) next[String(i)] = "";
                    setComposerVariables(next);
                  }}
                >
                  <SelectTrigger className={cn(
                    "h-11 rounded-xl bg-white dark:bg-slate-900",
                    composerSendAttempted && !selectedWhatsAppTemplate
                      ? "border-rose-300 dark:border-rose-800 focus-visible:ring-rose-300"
                      : "border-slate-200 dark:border-slate-800",
                  )}>
                    <div className="flex items-center gap-2">
                      <span className="h-6 w-6 rounded-md bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-amber-500">★</span>
                      <SelectValue placeholder={t("campaign_manager.composer.select_template")} />
                    </div>
                  </SelectTrigger>
                  <SelectContent>
                    {whatsappTemplates.map(template => (
                      <SelectItem key={template.id} value={template.name}>{template.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {composerSendAttempted && !selectedWhatsAppTemplate && (
                  <p className="text-[11px] text-rose-500 italic">{t("campaign_manager.composer.template_required")}</p>
                )}
              </div>

              {/* Template variables ({{1}}, {{2}}…) — static values, same for every recipient */}
              {selectedTemplate && (selectedTemplate.variables?.length ?? 0) > 0 && (
                <div className="space-y-2">
                  <label className="text-[11.5px] font-semibold text-slate-700 dark:text-slate-300">
                    {t("campaign_manager.composer.template_variables")}
                  </label>
                  <p className="text-[10.5px] text-slate-500 dark:text-slate-400 leading-snug">
                    {t("campaign_manager.composer.template_variables_hint")}
                  </p>
                  {selectedTemplate.variables.map((_: any, i: number) => {
                    const key = String(i + 1);
                    const value = composerVariables[key] ?? "";
                    const missing = composerSendAttempted && !value.trim();
                    const personalised = /\[[A-Z_]+\]/.test(value);
                    return (
                      <div key={key} className="flex items-center gap-2">
                        <span className="h-9 min-w-[3rem] px-2 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-[11px] font-bold text-slate-500 shrink-0">
                          {`{{${key}}}`}
                        </span>
                        <Input
                          value={value}
                          onChange={(e) =>
                            setComposerVariables((prev) => ({ ...prev, [key]: e.target.value }))
                          }
                          placeholder={t("campaign_manager.composer.variable_placeholder", { key: `{{${key}}}` })}
                          className={cn(
                            "h-9 rounded-lg text-[12px]",
                            missing
                              ? "border-rose-300 dark:border-rose-800 focus-visible:ring-rose-300"
                              : personalised
                                ? "border-emerald-300 dark:border-emerald-800"
                                : "border-slate-200 dark:border-slate-800",
                          )}
                        />
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button
                              type="button"
                              title={t("campaign_manager.composer.insert_contact_field")}
                              className="h-9 w-9 rounded-lg border border-slate-200 dark:border-slate-800 flex items-center justify-center text-slate-500 hover:text-primary shrink-0"
                            >
                              <User className="h-3.5 w-3.5" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="rounded-xl p-1.5 min-w-[190px]">
                            {CONTACT_TOKENS.map((tok) => (
                              <DropdownMenuItem
                                key={tok.token}
                                className="rounded-lg py-2 cursor-pointer font-medium text-[11px]"
                                onClick={() =>
                                  setComposerVariables((prev) => ({
                                    ...prev,
                                    [key]: `${prev[key] ?? ""}${tok.token}`,
                                  }))
                                }
                              >
                                {t(`campaign_manager.contact_tokens.${tok.labelKey}`)}
                              </DropdownMenuItem>
                            ))}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    );
                  })}
                  {selectedTemplate.variables.some((_: any, i: number) =>
                    /\[[A-Z_]+\]/.test(composerVariables[String(i + 1)] ?? ""),
                  ) && (
                    <p className="text-[10.5px] text-emerald-600 dark:text-emerald-400 leading-snug">
                      {t("campaign_manager.composer.contact_fields_note")}
                    </p>
                  )}
                  {composerSendAttempted &&
                    selectedTemplate.variables.some(
                      (_: any, i: number) => !(composerVariables[String(i + 1)] ?? "").trim(),
                    ) && <p className="text-[11px] text-rose-500 italic">{t("campaign_manager.composer.fill_all_variables")}</p>}
                </div>
              )}

              {/* Pause if Marketing */}
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-3 flex items-start gap-3">
                <span className="h-7 w-7 rounded-lg bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center text-emerald-600 shrink-0">
                  <CheckCircle2 size={13} strokeWidth={2.5} />
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] font-semibold text-slate-900 dark:text-white">{t("campaign_manager.composer.pause_marketing_title")}</p>
                  <p className="text-[10.5px] text-slate-500 dark:text-slate-400 leading-snug mt-0.5">
                    {t("campaign_manager.composer.pause_marketing_desc")}
                  </p>
                </div>
                <button
                  onClick={() => setComposerPauseIfMarketing(!composerPauseIfMarketing)}
                  className={cn(
                    "shrink-0 h-5 w-9 rounded-full transition-colors relative",
                    composerPauseIfMarketing ? "bg-primary" : "bg-slate-300 dark:bg-slate-700",
                  )}
                >
                  <span className={cn(
                    "absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all",
                    composerPauseIfMarketing ? "left-4" : "left-0.5",
                  )} />
                </button>
              </div>
              {/* Schedule */}
              <div className="space-y-1.5">
                <label className="text-[11.5px] font-semibold text-slate-700 dark:text-slate-300">{t("campaign_manager.composer.schedule")}</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setComposerScheduleMode("now")}
                    className={cn(
                      "rounded-xl border p-3 text-left transition-all",
                      composerScheduleMode === "now"
                        ? "border-primary bg-primary/[0.06] shadow-sm"
                        : "border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/40",
                    )}
                  >
                    <Zap size={14} className="text-primary mb-1.5" strokeWidth={2.5} />
                    <p className="text-[12px] font-semibold text-slate-900 dark:text-white">{t("campaign_manager.composer.send_now")}</p>
                    <p className="text-[10.5px] text-slate-500 dark:text-slate-400">{t("campaign_manager.composer.send_now_hint")}</p>
                  </button>
                  <button
                    onClick={() => setComposerScheduleMode("later")}
                    className={cn(
                      "rounded-xl border p-3 text-left transition-all",
                      composerScheduleMode === "later"
                        ? "border-primary bg-primary/[0.06] shadow-sm"
                        : "border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/40",
                    )}
                  >
                    <Calendar size={14} className={cn("mb-1.5", composerScheduleMode === "later" ? "text-primary" : "text-slate-500")} strokeWidth={2.5} />
                    <p className="text-[12px] font-semibold text-slate-900 dark:text-white">{t("campaign_manager.composer.schedule")}</p>
                    <p className="text-[10.5px] text-slate-500 dark:text-slate-400">{t("campaign_manager.composer.schedule_hint")}</p>
                  </button>
                </div>
                {/* Date + time inputs appear only when "Schedule" mode is
                    active. Time is broken into HH / MM selects so the user
                    doesn't need a native time picker. */}
                {composerScheduleMode === "later" && (
                  <div className="space-y-1.5 pt-1">
                  <div className="grid grid-cols-2 gap-2">
                    <Popover open={composerScheduleDatePickerOpen} onOpenChange={setComposerScheduleDatePickerOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "h-9 justify-between text-left font-normal text-[12px] rounded-lg",
                            composerSendAttempted && !composerScheduleDate
                              ? "border-rose-300 dark:border-rose-800"
                              : "border-slate-200 dark:border-slate-800",
                          )}
                        >
                          <div className="flex items-center min-w-0">
                            <Calendar size={12} className="mr-1.5 shrink-0" />
                            <span className="truncate">
                              {composerScheduleDate ? composerScheduleDate.toLocaleDateString() : t("campaign_manager.composer.pick_date")}
                            </span>
                          </div>
                          <ChevronDown size={12} className="shrink-0 text-slate-400" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <CalendarComponent
                          mode="single"
                          selected={composerScheduleDate}
                          onSelect={(date) => {
                            setComposerScheduleDate(date);
                            setComposerScheduleDatePickerOpen(false);
                          }}
                          disabled={{ before: new Date() }}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    <div className="grid grid-cols-2 gap-1">
                      <Select value={composerScheduleHour} onValueChange={setComposerScheduleHour}>
                        <SelectTrigger className="h-9 text-[12px] rounded-lg">
                          <SelectValue placeholder={t("campaign_manager.composer.hh")} />
                        </SelectTrigger>
                        <SelectContent>
                          {Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0")).map((h) => (
                            <SelectItem key={h} value={h}>{h}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Select value={composerScheduleMinute} onValueChange={setComposerScheduleMinute}>
                        <SelectTrigger className="h-9 text-[12px] rounded-lg">
                          <SelectValue placeholder={t("campaign_manager.composer.mm")} />
                        </SelectTrigger>
                        <SelectContent>
                          {["00", "15", "30", "45"].map((m) => (
                            <SelectItem key={m} value={m}>{m}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  {composerSendAttempted && !composerScheduleDate && (
                    <p className="text-[11px] text-rose-500 italic">{t("campaign_manager.composer.schedule_date_required")}</p>
                  )}
                  </div>
                )}
              </div>
              {/* Tag failed contacts */}
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-3">
                <div className="flex items-start gap-2.5 mb-2">
                  <span className="h-7 w-7 rounded-lg bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center text-emerald-600 shrink-0">
                    <span className="text-[11px]">🏷</span>
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[12px] font-semibold text-slate-900 dark:text-white">{t("campaign_manager.composer.tag_failed_title")}</p>
                    <p className="text-[10.5px] text-slate-500 dark:text-slate-400 leading-snug">
                      {t("campaign_manager.composer.tag_failed_desc")}
                    </p>
                  </div>
                </div>
                <Select value={composerTagFailed} onValueChange={setComposerTagFailed}>
                  <SelectTrigger className="h-9 rounded-lg text-[12px]">
                    <SelectValue placeholder={t("campaign_manager.composer.tag_placeholder")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none">{t("campaign_manager.composer.no_tag")}</SelectItem>
                    {workspaceTags.map((tg) => (
                      <SelectItem key={tg.id} value={tg.id}>{tg.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Column 3: Preview */}
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/40 p-4 space-y-4">
              <div className="flex items-start gap-2.5">
                <span className="h-8 w-8 rounded-lg bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
                  <Eye size={16} strokeWidth={2.5} />
                </span>
                <div className="min-w-0">
                  <p className="text-[9.5px] font-bold uppercase tracking-wider text-slate-400">{t("campaign_manager.composer.section_preview")}</p>
                  <h3 className="text-[14px] font-bold text-slate-900 dark:text-white">{t("campaign_manager.composer.how_it_lands")}</h3>
                </div>
              </div>
              <div className="rounded-xl bg-slate-100 dark:bg-slate-800/60 h-[280px] flex items-center justify-center">
                {selectedTemplate ? (
                  <PreviewV2
                    mode="chat"
                    headerText={selectedTemplate.header || ""}
                    bodyText={selectedTemplate.body || ""}
                    footerText={selectedTemplate.footer || ""}
                    selectedMediaFile={null}
                    templateButtons={selectedTemplate.buttons || []}
                    variableSamples={composerVariables}
                  />
                ) : (
                  <p className="text-[12px] text-slate-400">{t("campaign_manager.composer.no_template_selected")}</p>
                )}
              </div>
              <div className="pt-2 border-t border-slate-200 dark:border-slate-800 space-y-1.5">
                <div className="flex items-center justify-between text-[11.5px]">
                  <span className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
                    <UsersRound size={12} /> {t("campaign_manager.composer.audience")}
                  </span>
                  <span className="font-semibold text-slate-900 dark:text-white tabular-nums">{t("campaign_manager.composer.contacts_count", { count: audienceCount })}</span>
                </div>
                <div className="flex items-center justify-between text-[11.5px]">
                  <span className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
                    <Clock size={12} /> {t("campaign_manager.composer.est_duration")}
                  </span>
                  <span className="font-semibold text-slate-900 dark:text-white">{estDuration}</span>
                </div>
                <div className="flex items-center justify-between text-[11.5px]">
                  <span className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
                    <Zap size={12} /> {t("campaign_manager.composer.first_message_at")}
                  </span>
                  <span className="font-semibold text-slate-900 dark:text-white">
                    {composerScheduleMode === "now"
                      ? t("campaign_manager.composer.now")
                      : composerScheduleDate
                        ? `${composerScheduleDate.toLocaleDateString()} ${composerScheduleHour}:${composerScheduleMinute}`
                        : "—"}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Delivery profile */}
          <div className="px-5 py-5 border-t border-slate-200 dark:border-slate-800">
            <div className="flex items-start gap-2.5 mb-4">
              <span className="h-8 w-8 rounded-lg bg-orange-100 dark:bg-orange-900/40 flex items-center justify-center text-orange-600 dark:text-orange-400 shrink-0">
                <Activity size={16} strokeWidth={2.5} />
              </span>
              <div className="min-w-0">
                <p className="text-[9.5px] font-bold uppercase tracking-wider text-slate-400">{t("campaign_manager.composer.section_delivery")}</p>
                <h3 className="text-[14px] font-bold text-slate-900 dark:text-white">{t("campaign_manager.composer.delivery_desc")}</h3>
              </div>
            </div>
            {/* Preset cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4">
              {([
                { key: "conservative", label: t("campaign_manager.presets.conservative"), desc: t("campaign_manager.presets.conservative_desc"), Icon: CheckCircle2, iconBg: "bg-sky-500", batch: 5, pause: 120, interval: "5-15s" },
                { key: "standard",     label: t("campaign_manager.presets.standard"),     desc: t("campaign_manager.presets.standard_desc"),    Icon: CheckCircle2, iconBg: "bg-emerald-500", batch: 10, pause: 60, interval: "2-7s" },
                { key: "aggressive",   label: t("campaign_manager.presets.aggressive"),   desc: t("campaign_manager.presets.aggressive_desc"), Icon: Zap,        iconBg: "bg-orange-500", batch: 25, pause: 20, interval: "1-3s" },
                { key: "custom",       label: t("campaign_manager.presets.custom"),       desc: t("campaign_manager.presets.custom_desc"),  Icon: Activity,   iconBg: "bg-violet-500", batch: composerBatchSize, pause: composerBatchPause, interval: `${composerIntervalMin}-${composerIntervalMax}s` },
              ] as const).map((p) => (
                <button
                  key={p.key}
                  onClick={() => applyDeliveryPreset(p.key)}
                  className={cn(
                    "text-left p-3 rounded-xl border-2 transition-all",
                    composerDeliveryPreset === p.key
                      ? "border-primary bg-primary/[0.04] shadow-sm"
                      : "border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/40",
                  )}
                >
                  <div className="flex items-start justify-between mb-2">
                    <span className={cn("h-7 w-7 rounded-lg flex items-center justify-center text-white", p.iconBg)}>
                      <p.Icon size={13} strokeWidth={2.5} />
                    </span>
                    <span className={cn(
                      "h-4 w-4 rounded-full border-2 flex items-center justify-center",
                      composerDeliveryPreset === p.key ? "border-primary bg-primary" : "border-slate-300 dark:border-slate-600",
                    )}>
                      {composerDeliveryPreset === p.key && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
                    </span>
                  </div>
                  <p className="text-[13px] font-bold text-slate-900 dark:text-white">{p.label}</p>
                  <p className="text-[10.5px] text-slate-500 dark:text-slate-400 mb-2">{p.desc}</p>
                  <div className="space-y-0.5 text-[10.5px]">
                    <div className="flex items-center justify-between"><span className="text-slate-500">{t("campaign_manager.presets.batch")}</span><span className="font-semibold text-slate-800 dark:text-slate-200 tabular-nums">{p.batch}</span></div>
                    <div className="flex items-center justify-between"><span className="text-slate-500">{t("campaign_manager.presets.pause")}</span><span className="font-semibold text-slate-800 dark:text-slate-200 tabular-nums">{p.pause}s</span></div>
                    <div className="flex items-center justify-between"><span className="text-slate-500">{t("campaign_manager.presets.interval")}</span><span className="font-semibold text-slate-800 dark:text-slate-200 tabular-nums">{p.interval}</span></div>
                  </div>
                </button>
              ))}
            </div>
            {/* Number inputs */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <NumberStepper
                label={t("campaign_manager.composer.batch_size")}
                suffix={t("campaign_manager.composer.batch_size_suffix")}
                value={composerBatchSize}
                onChange={(v) => { setComposerBatchSize(v); setComposerDeliveryPreset("custom"); }}
                min={1} max={100}
                hint={t("campaign_manager.composer.batch_size_hint")}
              />
              <NumberStepper
                label={t("campaign_manager.composer.batch_pause")}
                suffix={t("campaign_manager.composer.batch_pause_suffix")}
                value={composerBatchPause}
                onChange={(v) => { setComposerBatchPause(v); setComposerDeliveryPreset("custom"); }}
                min={1} max={600}
                hint={t("campaign_manager.composer.batch_pause_hint")}
              />
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-[10.5px] font-bold uppercase tracking-wider text-slate-500">{t("campaign_manager.composer.interval_per_message")}</label>
                  <span className="text-[10px] text-slate-400 uppercase tracking-wider">{t("campaign_manager.composer.random_range")}</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <StepperInput value={composerIntervalMin} onChange={(v) => { setComposerIntervalMin(v); setComposerDeliveryPreset("custom"); }} min={1} max={60} />
                  <StepperInput value={composerIntervalMax} onChange={(v) => { setComposerIntervalMax(v); setComposerDeliveryPreset("custom"); }} min={1} max={60} />
                </div>
                <p className="text-[10.5px] text-slate-400">{t("campaign_manager.composer.random_delay_hint")}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Sticky bottom bar */}
        <div className="fixed bottom-0 left-0 right-0 z-30 bg-white/95 dark:bg-slate-900/95 backdrop-blur border-t border-slate-200 dark:border-slate-800 px-6 py-3 flex items-center justify-between shadow-lg">
          <div className="flex items-center gap-4 text-[11.5px] text-slate-500 dark:text-slate-400">
            <span className="flex items-center gap-1.5"><UsersRound size={13} /> <span className="font-semibold text-slate-800 dark:text-slate-200 tabular-nums">{audienceCount}</span> {t("campaign_manager.composer.contacts_label")}</span>
            <span className="flex items-center gap-1.5"><Clock size={13} /> <span className="font-semibold text-slate-800 dark:text-slate-200">{estDuration}</span> {t("campaign_manager.composer.to_deliver")}</span>
            <span className="flex items-center gap-1.5"><Zap size={13} /> {t("campaign_manager.composer.starts")} <span className="font-semibold text-slate-800 dark:text-slate-200">
              {composerScheduleMode === "now"
                ? t("campaign_manager.composer.now")
                : composerScheduleDate
                  ? `${composerScheduleDate.toLocaleDateString()} ${composerScheduleHour}:${composerScheduleMinute}`
                  : "—"}
            </span></span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={closeComposer} className="h-9 px-4 text-[12.5px]">{t("campaign_manager.common.cancel")}</Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleComposerSaveDraft}
              disabled={isSubmitting}
              className="h-9 px-4 text-[12.5px] border-slate-200 dark:border-slate-800"
            >
              {createBroadcastMutation.isPending && <Loader2 size={12} className="mr-1.5 animate-spin" />}
              {t("campaign_manager.composer.save_as_draft")}
            </Button>
            <Button
              size="sm"
              onClick={handleComposerSend}
              disabled={isSubmitting || readyCount < 3}
              className="h-9 px-5 text-[12.5px] font-semibold bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm shadow-primary/20 disabled:opacity-60"
            >
              {sendBroadcastMutation.isPending
                ? <Loader2 size={12} className="mr-1.5 animate-spin" />
                : <Send size={13} strokeWidth={2.5} className="mr-1.5" />}
              {composerScheduleMode === "now" ? t("campaign_manager.composer.send_broadcast") : t("campaign_manager.composer.schedule_action")}
            </Button>
          </div>
        </div>

        {/* Condition picker modal — opens from "+ Add condition" in the
            Audience column. Grids the pickable fields into sections
            (General / System / Opportunity / Custom / per-channel) so
            users can browse or search. Selecting a card hands off to
            the Configure modal for operator + value selection. */}
        <ConditionPickerModal
          open={conditionModalOpen}
          onOpenChange={setConditionModalOpen}
          search={conditionSearch}
          onSearchChange={setConditionSearch}
          channels={channels}
          customFields={workspaceCustomFields}
          workspaceTags={workspaceTags}
          onPick={(cond) => {
            // Hand off to the Configure modal — pre-seed with a
            // reasonable default operator per field type so the user
            // sees a valid "preview" line the moment the modal opens.
            setConfigureField({
              fieldId: cond.id,
              fieldLabel: cond.label,
              category: cond.category,
              icon: cond.icon,
              fieldType: cond.fieldType,
              enumOptions: cond.enumOptions,
            });
            setConfigureOperator(
              cond.fieldType === "boolean" ? "is_true"
              : cond.fieldType === "date" ? "is"
              : cond.fieldType === "number" ? "has_value"
              : cond.fieldType === "text" ? "is"
              : "is",
            );
            setConfigureValue("");
            setConfigureValueLabel("");
            setConditionModalOpen(false);
            setConditionSearch("");
          }}
        />

        {/* Configure condition modal — operator + value inputs for the
            just-picked field. Saving appends a fully-configured filter to
            composerConditions; Back re-opens the picker so the user can
            switch fields without losing their place. */}
        <ConfigureConditionModal
          field={configureField}
          operator={configureOperator}
          value={configureValue}
          valueLabel={configureValueLabel}
          onOperatorChange={setConfigureOperator}
          onValueChange={setConfigureValue}
          onValueLabelChange={setConfigureValueLabel}
          onBack={() => {
            setConfigureField(null);
            setConditionModalOpen(true);
          }}
          onClose={() => setConfigureField(null)}
          onSave={() => {
            if (!configureField) return;
            setComposerConditions([
              ...composerConditions,
              {
                id: `cond_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
                fieldId: configureField.fieldId,
                fieldLabel: configureField.fieldLabel,
                category: configureField.category,
                icon: configureField.icon,
                fieldType: configureField.fieldType,
                operator: configureOperator,
                value: configureValue,
                valueLabel: configureValueLabel || configureValue,
              },
            ]);
            setConfigureField(null);
          }}
        />
      </div>
    );
  }

  return (
    <div className="px-6 py-6 space-y-3 animate-in fade-in duration-700" data-testid="campaign-manager">
        {/* 1. Branded Header Card — replyagent splits the Broadcasts header
            into its own rounded floating card with visible shadow, then
            leaves a small gap before the content card below. The two-
            layer drop shadow (soft ambient + close contact) matches the
            floating-header treatment used elsewhere in the app so the
            "card lifted off the page" cue is consistent. */}
        <div className="bg-white dark:bg-slate-900/50 rounded-[20px] border border-slate-200/70 dark:border-slate-800 shadow-[0_10px_28px_-8px_rgba(15,23,42,0.18),0_4px_10px_-2px_rgba(15,23,42,0.08)] dark:shadow-[0_10px_28px_-6px_rgba(0,0,0,0.55),0_4px_10px_-2px_rgba(0,0,0,0.35)] overflow-hidden">
            <div className="py-3 px-5 flex items-center justify-between bg-gradient-to-r from-primary/[0.06] via-white to-white dark:from-primary/10 dark:via-transparent dark:to-transparent">
                <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-primary text-primary-foreground shadow-sm">
                        <Megaphone size={20} strokeWidth={2.5} />
                    </div>
                    <div className="space-y-0.5">
                        <h1 className="text-lg font-bold tracking-tight text-slate-900 dark:text-white">
                            {t("campaign_manager.list.title")}
                        </h1>
                        <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                            {t("campaign_manager.list.subtitle")}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <Button
                        variant="outline"
                        onClick={() => queryClient.invalidateQueries({ queryKey: ["/api/broadcasts"] })}
                        className="h-8 px-3 rounded-lg text-[11px] font-semibold border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800"
                    >
                        <RefreshCw size={13} strokeWidth={2.5} className="mr-1.5" />
                        {t("campaign_manager.list.refresh")}
                    </Button>
                    {canManageBroadcasts && (
                    <Button
                        onClick={() => setCreateOpen(true)}
                        className="h-8 px-4 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 font-semibold text-[11px] shadow-lg shadow-primary/20 transition-all duration-300 active:scale-95 flex items-center gap-2 border-0"
                        data-testid="button-create-campaign"
                    >
                        <Plus size={14} strokeWidth={2.5} />
                        <span>{t("campaign_manager.list.new_broadcast")}</span>
                    </Button>
                    )}
                </div>
            </div>
        </div>

        {/* 2. Content Card — filters + stats + sub-header + table +
            pagination now live in their own rounded card, visibly
            separated from the header above by the space-y-3 gap on the
            parent. Same two-layer shadow so both cards read as
            coordinated floating panels. */}
        <div className="bg-white dark:bg-slate-900/50 rounded-[20px] border border-slate-200/70 dark:border-slate-800 shadow-[0_10px_28px_-8px_rgba(15,23,42,0.18),0_4px_10px_-2px_rgba(15,23,42,0.08)] dark:shadow-[0_10px_28px_-6px_rgba(0,0,0,0.55),0_4px_10px_-2px_rgba(0,0,0,0.35)] overflow-hidden flex flex-col">

            {/* Filter Row — replyagent moved filters ABOVE the stat cards
                so the user chooses the slice first, then sees stats reflect
                that slice. Four labeled dropdowns: Date Range, Status,
                Channel, Agent — each with a small icon inside the label. */}
            <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800/80 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Date Range — the leading "All Time" option acts as the
                    clear-selection sentinel; onChange filters it out so
                    downstream code keeps the empty-array semantics. */}
                <div className="space-y-1.5">
                    <label className="text-[11px] font-medium text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                        <Calendar className="h-3.5 w-3.5" />
                        {t("campaign_manager.filters.date_range")}
                    </label>
                    <CustomDropdown
                        options={[
                            { id: "", name: t("campaign_manager.filters.all_time") },
                            { id: "today", name: t("campaign_manager.filters.today") },
                            { id: "last7", name: t("campaign_manager.filters.last7") },
                            { id: "last30", name: t("campaign_manager.filters.last30") },
                            { id: "thisMonth", name: t("campaign_manager.filters.this_month") },
                        ]}
                        selected={dateRangeFilter}
                        onChange={(ids) => setDateRangeFilter(ids[0] === "" ? [] : ids)}
                        placeholder={t("campaign_manager.filters.all_time")}
                        width="100%"
                        showSelectedOption={true}
                        showSearch={false}
                        triggerContent={
                            <>
                                <span className={cn("truncate text-[12px]", dateRangeFilter.length > 0 ? "text-slate-900 dark:text-white font-medium" : "text-slate-500 dark:text-slate-400")}>
                                    {dateRangeFilter.length === 0
                                        ? t("campaign_manager.filters.all_time")
                                        : ({ today: t("campaign_manager.filters.today"), last7: t("campaign_manager.filters.last7"), last30: t("campaign_manager.filters.last30"), thisMonth: t("campaign_manager.filters.this_month") } as Record<string, string>)[dateRangeFilter[0]] ?? dateRangeFilter[0]}
                                </span>
                                <ChevronDown className="h-3.5 w-3.5 text-slate-400/50 shrink-0" />
                            </>
                        }
                    />
                </div>

                {/* Status */}
                <div className="space-y-1.5">
                    <label className="text-[11px] font-medium text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        {t("campaign_manager.filters.status")}
                    </label>
                    <CustomDropdown
                        options={[
                            { id: "", name: t("campaign_manager.filters.all") },
                            { id: "draft", name: t("campaign_manager.status.draft") },
                            { id: "queued", name: t("campaign_manager.status.queued") },
                            { id: "scheduled", name: t("campaign_manager.status.scheduled") },
                            { id: "sending", name: t("campaign_manager.status.sending") },
                            { id: "sent", name: t("campaign_manager.status.sent") },
                            { id: "failed", name: t("campaign_manager.status.failed") },
                            { id: "archived", name: t("campaign_manager.status.archived") },
                        ]}
                        selected={selectedStatus}
                        onChange={(ids) => setSelectedStatus(ids[0] === "" ? [] : ids)}
                        placeholder={t("campaign_manager.filters.all")}
                        width="100%"
                        showSelectedOption={true}
                        showSearch={false}
                        triggerContent={
                            <>
                                <span className={cn("truncate text-[12px]", selectedStatus.length > 0 ? "text-slate-900 dark:text-white font-medium" : "text-slate-500 dark:text-slate-400")}>
                                    {selectedStatus.length === 0
                                        ? t("campaign_manager.filters.all")
                                        : t(`campaign_manager.status.${selectedStatus[0]}`, { defaultValue: selectedStatus[0].charAt(0).toUpperCase() + selectedStatus[0].slice(1) })}
                                </span>
                                <ChevronDown className="h-3.5 w-3.5 text-slate-400/50 shrink-0" />
                            </>
                        }
                    />
                </div>

                {/* Channel */}
                <div className="space-y-1.5">
                    <label className="text-[11px] font-medium text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                        <MessageSquare className="h-3.5 w-3.5" />
                        {t("campaign_manager.filters.channel")}
                    </label>
                    <CustomDropdown
                        options={[
                            { id: "", name: t("campaign_manager.filters.all") },
                            { id: "whatsapp", name: "WhatsApp" },
                            { id: "telegram", name: "Telegram" },
                            { id: "messenger", name: "Messenger" },
                            { id: "instagram", name: "Instagram" },
                            { id: "webchat", name: "Webchat" },
                            { id: "twilio_sms", name: "SMS" },
                        ]}
                        selected={selectedChannels}
                        onChange={(ids) => setSelectedChannels(ids[0] === "" ? [] : ids)}
                        placeholder={t("campaign_manager.filters.all")}
                        width="100%"
                        showSelectedOption={true}
                        showSearch={false}
                        triggerContent={
                            <>
                                <span className={cn("truncate text-[12px]", selectedChannels.length > 0 ? "text-slate-900 dark:text-white font-medium" : "text-slate-500 dark:text-slate-400")}>
                                    {selectedChannels.length === 0
                                        ? t("campaign_manager.filters.all")
                                        : selectedChannels[0].charAt(0).toUpperCase() + selectedChannels[0].slice(1).replace("_", " ")}
                                </span>
                                <ChevronDown className="h-3.5 w-3.5 text-slate-400/50 shrink-0" />
                            </>
                        }
                    />
                </div>

                {/* Agent — filter broadcasts by owning user. Options load
                    from workspace users; when multiple are picked the
                    trigger shows the count ("3 agents") like replyagent. */}
                <div className="space-y-1.5">
                    <label className="text-[11px] font-medium text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                        <UsersRound className="h-3.5 w-3.5" />
                        {t("campaign_manager.filters.agent")}
                    </label>
                    <CustomDropdown
                        options={[
                            { id: "", name: t("campaign_manager.filters.all_agents") },
                            ...workspaceUsers.map((u) => ({ id: u.id, name: u.name })),
                        ]}
                        selected={selectedAgents}
                        onChange={(ids) => setSelectedAgents(ids[0] === "" ? [] : ids)}
                        placeholder={t("campaign_manager.filters.all_agents")}
                        width="100%"
                        showSelectedOption={true}
                        showSearch={workspaceUsers.length > 6}
                        triggerContent={
                            <>
                                <span className={cn("truncate text-[12px]", selectedAgents.length > 0 ? "text-slate-900 dark:text-white font-medium" : "text-slate-500 dark:text-slate-400")}>
                                    {selectedAgents.length === 0
                                        ? t("campaign_manager.filters.all_agents")
                                        : selectedAgents.length === 1
                                            ? workspaceUsers.find((u) => u.id === selectedAgents[0])?.name ?? t("campaign_manager.filters.agents_count", { count: 1 })
                                            : t("campaign_manager.filters.agents_count", { count: selectedAgents.length })}
                                </span>
                                <ChevronDown className="h-3.5 w-3.5 text-slate-400/50 shrink-0" />
                            </>
                        }
                    />
                </div>
            </div>

            {/* 3. Stat Cards Row — replyagent broadcast parity */}
            <BroadcastStatsRow campaigns={campaigns} />

            {/* 4. All Broadcasts sub-header — replyagent puts a small band
                above the table showing "All Broadcasts (count)" on the left
                and a search box on the right so the primary search action
                sits closer to the data it filters. */}
            <div className="px-5 py-3 border-b border-slate-200 dark:border-slate-800/80 flex items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                    <h3 className="text-[13px] font-semibold text-slate-900 dark:text-white">
                        {t("campaign_manager.list.all_broadcasts")}
                    </h3>
                    <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-bold tabular-nums">
                        {campaigns.length}
                    </span>
                </div>
                <div className="relative group w-full max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 group-focus-within:text-primary transition-colors" />
                    <Input
                        placeholder={t("campaign_manager.list.search_placeholder")}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-9 h-8 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 rounded-md text-[12px] font-medium placeholder:text-slate-400"
                        data-testid="input-search"
                    />
                </div>
            </div>

            {/* 5. Main Table Section — bulk selection removed to match
                replyagent (row-level actions live in the row's icon cluster
                instead of a checkbox + bulk bar workflow). */}
            <div className="flex-1 overflow-auto scrollbar-hide">
                <table className="w-full text-left border-collapse">
                    <thead className="sticky top-0 z-20 bg-slate-50/80 dark:bg-slate-800/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800/80">
                        <tr>
                            <th className="py-2 px-3 font-semibold text-[11px] text-slate-500 dark:text-slate-400 cursor-pointer group" onClick={() => handleColumnSort("name")}>
                                <div className="flex items-center gap-2">
                                    {t("campaign_manager.table.name_channel")}
                                    <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                                        {renderSortIcon("name")}
                                    </div>
                                </div>
                            </th>
                            <th className="py-2 px-3 font-semibold text-[11px] text-slate-500 dark:text-slate-400 cursor-pointer group" onClick={() => handleColumnSort("audience")}>
                                <div className="flex items-center gap-2">
                                    {t("campaign_manager.table.audience")}
                                    <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                                        {renderSortIcon("audience")}
                                    </div>
                                </div>
                            </th>
                            <th className="py-2 px-3 font-semibold text-[11px] text-slate-500 dark:text-slate-400 cursor-pointer group" onClick={() => handleColumnSort("createdAt")}>
                                <div className="flex items-center gap-2">
                                    {t("campaign_manager.table.created_at")}
                                    <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                                        {renderSortIcon("createdAt")}
                                    </div>
                                </div>
                            </th>
                            <th className="py-2 px-3 font-semibold text-[11px] text-slate-500 dark:text-slate-400 cursor-pointer group" onClick={() => handleColumnSort("scheduledAt")}>
                                <div className="flex items-center gap-2">
                                    {t("campaign_manager.table.scheduled")}
                                    <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                                        {renderSortIcon("scheduledAt")}
                                    </div>
                                </div>
                            </th>
                            <th className="py-2 px-3 font-semibold text-[11px] text-slate-500 dark:text-slate-400 cursor-pointer group" onClick={() => handleColumnSort("status")}>
                                <div className="flex items-center gap-2">
                                    {t("campaign_manager.table.status")}
                                    <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                                        {renderSortIcon("status")}
                                    </div>
                                </div>
                            </th>
                            <th className="py-2 px-3 font-semibold text-[11px] text-slate-500 dark:text-slate-400 text-right">{t("campaign_manager.table.action")}</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-800/80">
                        {isLoadingCampaigns ? (
                            <tr>
                                <td colSpan={6} className="py-20 text-center">
                                    <div className="flex flex-col items-center gap-3">
                                        <Loader2 size={24} className="animate-spin text-primary" />
                                        <p className="text-[11px] font-semibold text-slate-400">{t("campaign_manager.list.loading")}</p>
                                    </div>
                                </td>
                            </tr>
                        ) : getFilteredCampaigns().length === 0 ? (
                            <tr>
                                <td colSpan={6} className="py-20 text-center">
                                    <div className="flex flex-col items-center gap-3 opacity-60">
                                        <div className="w-16 h-16 rounded-full bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-slate-300 dark:text-slate-600 mb-2">
                                            <Send size={32} strokeWidth={1} />
                                        </div>
                                        <div className="space-y-1">
                                            <p className="text-[14px] font-bold text-slate-900 dark:text-white">{t("campaign_manager.list.empty_title")}</p>
                                            <p className="text-[11px] font-medium text-slate-400">{t("campaign_manager.list.empty_desc")}</p>
                                        </div>
                                        {canManageBroadcasts && (
                                          <Button
                                              variant="outline"
                                              onClick={() => setCreateOpen(true)}
                                              className="mt-1 h-7.5 px-5 rounded-lg text-[10px] font-bold border-primary/30 text-primary hover:bg-primary/10 transition-all shadow-sm"
                                          >
                                              {t("campaign_manager.list.create_one_now")}
                                          </Button>
                                        )}
                                    </div>
                                </td>
                            </tr>
                        ) : (
                            getFilteredCampaigns().map((campaign) => (
                                <tr
                                    key={campaign.id}
                                    className="group hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                                >
                                    {/* NAME & CHANNEL — replyagent stacks the broadcast name above a
                                        small channel-coloured chip showing which account it'll send via. */}
                                    <td className="py-2 px-3">
                                        <div className="flex items-center gap-2 min-w-0">
                                            <span className={cn(
                                                "shrink-0 h-6 w-6 rounded-full border flex items-center justify-center",
                                                channelChipClass(campaign.channelType),
                                            )}>
                                                <ChannelChipIcon channel={campaign.channelType} />
                                            </span>
                                            <div className="min-w-0">
                                                <p className="text-[12px] font-semibold text-slate-900 dark:text-white group-hover:text-primary transition-colors truncate max-w-[200px]">
                                                    {campaign.name}
                                                </p>
                                                <p className="text-[10px] font-medium text-slate-400 dark:text-slate-500 truncate max-w-[200px]">
                                                    {campaign.channelName ||
                                                        (({
                                                            whatsapp: "WhatsApp",
                                                            telegram: "Telegram",
                                                            messenger: "Messenger",
                                                            instagram: "Instagram",
                                                            webchat: "Webchat",
                                                            twilio_sms: "SMS",
                                                            twilio_call: "Call",
                                                        } as Record<string, string>)[campaign.channelType ?? ""] ??
                                                        (campaign.channelType ?? ""))}
                                                </p>
                                            </div>
                                        </div>
                                    </td>
                                    {/* AUDIENCE — primary total with a small "failed" indicator
                                        when present, matching replyagent's row layout. */}
                                    <td className="py-2 px-3">
                                        <div className="flex items-center gap-1.5">
                                            <span className="text-[12px] font-semibold text-slate-900 dark:text-white tabular-nums">
                                                {(campaign.audience ?? 0).toLocaleString()}
                                            </span>
                                            {(campaign.failed ?? 0) > 0 && (
                                                <span className="text-[10px] font-semibold text-rose-600 dark:text-rose-400 tabular-nums">
                                                    {t("campaign_manager.list.failed_count", { count: campaign.failed })}
                                                </span>
                                            )}
                                        </div>
                                    </td>
                                    {/* CREATED AT */}
                                    <td className="py-2 px-3 text-[11px] font-medium text-slate-600 dark:text-slate-300">
                                        {campaign.createdAt
                                            ? formatInWorkspaceTz(campaign.createdAt, "dd MMM yy", workspaceTz)
                                            : "—"}
                                    </td>
                                    {/* SCHEDULED */}
                                    <td className="py-2 px-3 text-[11px] font-medium text-slate-600 dark:text-slate-300">
                                        {campaign.scheduledAt
                                            ? formatInWorkspaceTz(campaign.scheduledAt, "dd MMM, HH:mm", workspaceTz)
                                            : "—"}
                                    </td>
                                    {/* STATUS */}
                                    <td className="py-2 px-3">
                                        <span className={cn(
                                            "px-2 py-0.5 rounded-md text-[10px] font-semibold border shadow-sm capitalize",
                                            campaign.status === "delivered" || campaign.status === "sent" ? "bg-green-50 text-green-700 border-green-100 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800/50" :
                                            campaign.status === "scheduled" ? "bg-yellow-50 text-yellow-700 border-yellow-100 dark:bg-yellow-900/30 dark:text-yellow-300 dark:border-yellow-800/50" :
                                            campaign.status === "queued" || campaign.status === "sending" ? "bg-blue-50 text-blue-700 border-blue-100 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800/50" :
                                            campaign.status === "failed" ? "bg-rose-50 text-rose-700 border-rose-100 dark:bg-rose-900/30 dark:text-rose-300 dark:border-rose-800/50" :
                                            "bg-slate-50 text-slate-600 border-slate-100 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700"
                                        )}>
                                            {campaign.status}
                                        </span>
                                    </td>
                                    <td className="py-2 px-3 text-right">
                                        {/* Inline icon actions — replyagent
                                            surfaces the three most-used
                                            actions (Edit, Delete, View
                                            Details) as coloured icon
                                            buttons. Less-used actions (Clone,
                                            Send Now, Archive) stay in the
                                            kebab menu behind MoreVertical. */}
                                        <div className="flex items-center justify-end gap-1">
                                            {canManageBroadcasts && (
                                                <button
                                                    onClick={() => openComposerForCampaign(campaign)}
                                                    title={t("campaign_manager.list.edit_broadcast")}
                                                    className="p-1.5 rounded-md text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                                                >
                                                    <Edit2 size={14} />
                                                </button>
                                            )}
                                            {canDeleteBroadcasts && (
                                                <button
                                                    onClick={() => handleOpenDeleteModal(campaign)}
                                                    title={t("campaign_manager.list.delete_broadcast")}
                                                    className="p-1.5 rounded-md text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-colors"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            )}
                                            <button
                                                onClick={() => openComposerForCampaign(campaign)}
                                                title={t("campaign_manager.list.view_broadcast")}
                                                className="p-1.5 rounded-md text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                                            >
                                                <Eye size={14} />
                                            </button>
                                            {/* Kebab for secondary actions (Clone, Send Now). */}
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <button
                                                        title={t("campaign_manager.list.more_actions")}
                                                        className="p-1.5 rounded-md text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                                                    >
                                                        <MoreVertical size={14} />
                                                    </button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end" className="w-48 p-1">
                                                    {canManageBroadcasts && (
                                                        <DropdownMenuItem
                                                            onClick={() => handleOpenCloneDialog(campaign.id)}
                                                            className="flex items-center gap-2 px-3 py-2 text-[11px] font-semibold text-slate-700 dark:text-slate-300 rounded-lg cursor-pointer hover:bg-primary/10 hover:text-primary"
                                                        >
                                                            <Copy size={14} className="text-primary" />
                                                            {t("campaign_manager.list.clone")}
                                                        </DropdownMenuItem>
                                                    )}
                                                    {canManageBroadcasts && (campaign.status === "draft" || campaign.status === "failed") && (
                                                        <DropdownMenuItem
                                                            onClick={() => sendBroadcastMutation.mutate(campaign.id)}
                                                            className="flex items-center gap-2 px-3 py-2 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 rounded-lg cursor-pointer hover:bg-emerald-50 dark:hover:bg-emerald-900/20"
                                                        >
                                                            <Send size={14} className="text-emerald-600" />
                                                            {t("campaign_manager.list.send_now")}
                                                        </DropdownMenuItem>
                                                    )}
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* 6. Pagination Footer Section */}
            <div className="px-5 py-3 border-t border-slate-200 dark:border-slate-800/80 bg-slate-50/50 dark:bg-transparent flex items-center justify-between">
                <div className="flex items-center gap-6">
                    <div className="flex items-center gap-2">
                        <span className="text-[11px] font-semibold text-slate-500">{t("campaign_manager.list.rows_per_page")}</span>
                        <div className="relative" ref={dropdownRef}>
                            <button
                                type="button"
                                className="flex items-center gap-2 px-3 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md shadow-sm hover:bg-slate-50 transition-all text-[11px] font-semibold tabular-nums"
                                onClick={() => setRowsDropdownOpen(!rowsDropdownOpen)}
                            >
                                {rowsPerPage}
                                <ChevronDown className="h-3 w-3 text-slate-400" />
                            </button>
                            {rowsDropdownOpen && (
                                <div className="absolute bottom-full left-0 mb-1 z-[60] w-full rounded-lg shadow-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
                                    <ul className="py-1">
                                        {[10, 25, 50].map(option => (
                                            <li
                                                key={option}
                                                className={cn(
                                                    "px-3 py-2 text-[11px] font-semibold tabular-nums cursor-pointer hover:bg-primary/10 hover:text-primary transition-colors text-center",
                                                    rowsPerPage === option ? "bg-primary/10 text-primary" : "text-slate-600"
                                                )}
                                                onClick={() => {
                                                    setRowsPerPage(option);
                                                    setRowsDropdownOpen(false);
                                                }}
                                            >
                                                {option}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>
                    </div>
                    <div className="h-4 w-px bg-slate-200 dark:bg-slate-800"></div>
                    <span className="text-[11px] font-semibold text-slate-500 tabular-nums">
                        {t("campaign_manager.list.results_total", { count: getFilteredCampaigns().length })}
                    </span>
                </div>

                <div className="flex items-center gap-4">
                    <span className="text-[11px] font-semibold text-slate-500 tabular-nums">
                        {t("campaign_manager.list.page")} 1 <span className="text-slate-300 mx-1">/</span> 1
                    </span>
                    <div className="flex items-center gap-1 bg-white dark:bg-slate-800 p-0.5 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm">
                        <Button variant="ghost" size="icon" className="h-7 w-7 rounded-md hover:bg-slate-50 disabled:opacity-30" disabled>
                            <ChevronsLeft size={14} />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 rounded-md hover:bg-slate-50 disabled:opacity-30" disabled>
                            <ChevronLeft size={14} />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 rounded-md hover:bg-slate-50 disabled:opacity-30" disabled>
                            <ChevronRight size={14} />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 rounded-md hover:bg-slate-50 disabled:opacity-30" disabled>
                            <ChevronsRight size={14} />
                        </Button>
                    </div>
                </div>
            </div>
        </div>

      {/* Create Campaign Dialog */}
      <Dialog open={createOpen} onOpenChange={(isOpen) => {
        setCreateOpen(isOpen);
        if (!isOpen) {
          resetCreateCampaignForm();
          setEditingCampaignId(null); // Reset editingCampaignId when dialog Cancels
        }
      }}>
        <DialogContent className={cn(
          campaignCreationStep === "apiTriggeredForm" || campaignCreationStep === "broadcastForm"
            ? "max-w-3xl"
            : "max-w-[520px] p-6 rounded-2xl shadow-2xl",
        )} data-testid="dialog-create-campaign">
          {campaignCreationStep === "selectType" && (
            <>
              {/* Replyagent-parity "Create a Broadcast" modal — refined
                  premium look: filled primary megaphone tile, chunky
                  step-number badges, brand-tinted channel cards with
                  soft washed backgrounds so the panel feels airy rather
                  than dense. Theme-aware primary token drives the accent
                  so any workspace theme flows through. */}
              {/* Header sits in its own edge-to-edge band — negative
                  horizontal margins cancel the DialogContent p-6 so the
                  divider under the title spans the full modal width, and
                  border-slate-200 (over 100) makes the seam clearly
                  visible instead of blending into the background. */}
              <DialogHeader className="-mx-6 -mt-6 px-6 pt-6 pb-4 mb-5 border-b border-slate-200 dark:border-slate-800">
                <div className="flex items-start gap-3">
                  <div className="shrink-0 h-11 w-11 rounded-xl bg-primary flex items-center justify-center shadow-sm shadow-primary/25">
                    <Megaphone size={20} className="text-primary-foreground" strokeWidth={2.5} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <DialogTitle className="text-[17px] font-bold text-slate-900 dark:text-white">{t("campaign_manager.create_dialog.title")}</DialogTitle>
                    <p className="text-[12.5px] text-slate-500 dark:text-slate-400 mt-0.5">
                      {t("campaign_manager.create_dialog.subtitle")}
                    </p>
                  </div>
                </div>
              </DialogHeader>

              <div className="space-y-6 max-h-[62vh] overflow-y-auto pr-1 -mr-1">
                {/* Step 1: Name */}
                <div className="space-y-2.5">
                  <div className="flex items-center gap-2.5">
                    <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-primary text-primary-foreground text-[11px] font-bold shadow-sm">1</span>
                    <label className="text-[14px] font-semibold text-slate-900 dark:text-white">{t("campaign_manager.create_dialog.name")}</label>
                  </div>
                  <Input
                    placeholder={t("campaign_manager.create_dialog.name_placeholder")}
                    value={campaignName}
                    onChange={(e) => setCampaignName(e.target.value.slice(0, 512))}
                    className="h-10 text-[13px] rounded-lg border-slate-200 dark:border-slate-800 focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-0 focus-visible:border-primary/50 transition-shadow"
                  />
                  <p className="text-[11.5px] text-slate-400 dark:text-slate-500 flex items-center gap-1.5">
                    <Info size={11} className="shrink-0" />
                    {t("campaign_manager.create_dialog.name_hint")}
                  </p>
                </div>

                {/* Step 2: Select a channel */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2.5">
                    <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-primary text-primary-foreground text-[11px] font-bold shadow-sm">2</span>
                    <label className="text-[14px] font-semibold text-slate-900 dark:text-white">{t("campaign_manager.create_dialog.select_channel")}</label>
                  </div>

                  {channels.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-slate-300 dark:border-slate-700 px-4 py-8 text-center bg-slate-50/50 dark:bg-slate-900/30">
                      <div className="mx-auto h-10 w-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-2">
                        <MessageSquare size={18} className="text-slate-400" />
                      </div>
                      <p className="text-[12.5px] font-semibold text-slate-700 dark:text-slate-200">
                        {t("campaign_manager.create_dialog.no_channels")}
                      </p>
                      <p className="text-[11.5px] text-slate-400 mt-1 max-w-xs mx-auto">
                        {t("campaign_manager.create_dialog.no_channels_hint")}
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {Object.entries(
                        channels.reduce((acc: Record<string, any[]>, c: any) => {
                          const key = String(c.channel_type ?? "whatsapp");
                          (acc[key] ||= []).push(c);
                          return acc;
                        }, {}),
                      ).map(([type, list]) => {
                        const typeLabel = ({
                          whatsapp: "WhatsApp",
                          telegram: "Telegram",
                          messenger: "Messenger",
                          instagram: "Instagram",
                          webchat: "Webchat",
                          twilio_sms: "SMS",
                          twilio_call: "Call",
                        } as Record<string, string>)[type] ?? type;
                        // Brand palette per channel type. Each ships four
                        // tokens — heading text colour, filled heading-tile
                        // bg, soft card background wash, and card border —
                        // so rows read as one coherent brand block and
                        // groups visually separate at a glance.
                        const brand = ({
                          whatsapp:  { text: "text-emerald-600", tile: "bg-emerald-500", cardBg: "bg-emerald-50/50 hover:bg-emerald-50 dark:bg-emerald-950/20 dark:hover:bg-emerald-950/30", cardBorder: "border-emerald-100 dark:border-emerald-900/40", iconBg: "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-400" },
                          telegram:  { text: "text-sky-600",     tile: "bg-sky-500",     cardBg: "bg-sky-50/50 hover:bg-sky-50 dark:bg-sky-950/20 dark:hover:bg-sky-950/30",             cardBorder: "border-sky-100 dark:border-sky-900/40",         iconBg: "bg-sky-100 text-sky-600 dark:bg-sky-900/40 dark:text-sky-400" },
                          messenger: { text: "text-blue-600",    tile: "bg-blue-500",    cardBg: "bg-blue-50/50 hover:bg-blue-50 dark:bg-blue-950/20 dark:hover:bg-blue-950/30",         cardBorder: "border-blue-100 dark:border-blue-900/40",       iconBg: "bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400" },
                          instagram: { text: "text-fuchsia-600", tile: "bg-gradient-to-tr from-fuchsia-500 to-orange-400", cardBg: "bg-fuchsia-50/50 hover:bg-fuchsia-50 dark:bg-fuchsia-950/20 dark:hover:bg-fuchsia-950/30", cardBorder: "border-fuchsia-100 dark:border-fuchsia-900/40", iconBg: "bg-fuchsia-100 text-fuchsia-600 dark:bg-fuchsia-900/40 dark:text-fuchsia-400" },
                          webchat:   { text: "text-orange-600",  tile: "bg-orange-500",  cardBg: "bg-orange-50/50 hover:bg-orange-50 dark:bg-orange-950/20 dark:hover:bg-orange-950/30", cardBorder: "border-orange-100 dark:border-orange-900/40",   iconBg: "bg-orange-100 text-orange-600 dark:bg-orange-900/40 dark:text-orange-400" },
                          twilio_sms:  { text: "text-amber-600", tile: "bg-amber-500",   cardBg: "bg-amber-50/50 hover:bg-amber-50 dark:bg-amber-950/20 dark:hover:bg-amber-950/30",     cardBorder: "border-amber-100 dark:border-amber-900/40",     iconBg: "bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-400" },
                          twilio_call: { text: "text-rose-600",  tile: "bg-rose-500",    cardBg: "bg-rose-50/50 hover:bg-rose-50 dark:bg-rose-950/20 dark:hover:bg-rose-950/30",         cardBorder: "border-rose-100 dark:border-rose-900/40",       iconBg: "bg-rose-100 text-rose-600 dark:bg-rose-900/40 dark:text-rose-400" },
                        } as Record<string, { text: string; tile: string; cardBg: string; cardBorder: string; iconBg: string }>)[type] ?? {
                          text: "text-slate-700", tile: "bg-slate-400", cardBg: "bg-slate-50 hover:bg-slate-100 dark:bg-slate-900/40", cardBorder: "border-slate-200 dark:border-slate-800", iconBg: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
                        };
                        return (
                          <div key={type} className="space-y-2">
                            <div className="flex items-center gap-2 px-0.5">
                              <span className={cn("h-[22px] w-[22px] rounded-md flex items-center justify-center text-white shrink-0", brand.tile)}>
                                <ChannelChipIcon channel={type} size={12} />
                              </span>
                              <span className={cn("text-[13.5px] font-bold", brand.text)}>
                                {typeLabel}
                              </span>
                            </div>
                            <div className="space-y-2">
                              {list.map((c: any) => {
                                const key = `${c.channel_type}:${c.channelable_id}`;
                                const isSelected = newBroadcastChannelKey === key;
                                return (
                                  <div key={key} className="space-y-2">
                                  <button
                                    type="button"
                                    onClick={() => setNewBroadcastChannelKey(key)}
                                    className={cn(
                                      "w-full flex items-center gap-3 px-3.5 py-3 rounded-xl border-2 text-left transition-all duration-150",
                                      isSelected
                                        ? "border-primary bg-primary/[0.06] shadow-sm shadow-primary/10"
                                        : cn(brand.cardBorder, brand.cardBg, "hover:shadow-sm"),
                                    )}
                                  >
                                    {/* Soft-tinted rounded square icon tile —
                                        light background + brand-coloured
                                        glyph so the row feels premium and
                                        readable instead of shouting with a
                                        solid brand fill. */}
                                    <span className={cn("h-9 w-9 rounded-lg flex items-center justify-center shrink-0", brand.iconBg)}>
                                      <ChannelChipIcon channel={type} size={16} />
                                    </span>
                                    <div className="flex-1 min-w-0">
                                      <p className="text-[13px] font-semibold text-slate-900 dark:text-white truncate leading-tight">
                                        {c.name ?? `#${c.channelable_id}`}
                                      </p>
                                      {(() => {
                                        const sub =
                                          type === "whatsapp"
                                            ? c.phone_number ?? c.display_phone_number ?? ""
                                            : type === "messenger"
                                              ? "Facebook Page"
                                              : type === "telegram"
                                                ? c.username
                                                  ? `@${String(c.username).replace(/^@/, "")}`
                                                  : "Telegram Bot"
                                                : type === "instagram"
                                                  ? "Instagram Account"
                                                  : type === "webchat"
                                                    ? c.domain ?? "Web Chat"
                                                    : type === "twilio_sms"
                                                      ? c.phone_number ?? "SMS"
                                                      : "";
                                        return sub ? (
                                          <p className="text-[11.5px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                                            {sub}
                                          </p>
                                        ) : null;
                                      })()}
                                    </div>
                                    <span
                                      className={cn(
                                        "shrink-0 h-[18px] w-[18px] rounded-full border-2 flex items-center justify-center transition-all",
                                        isSelected
                                          ? "border-primary bg-primary"
                                          : "border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900",
                                      )}
                                    >
                                      {isSelected && <span className="h-2 w-2 rounded-full bg-white" />}
                                    </span>
                                  </button>
                                  {/* Yellow WhatsApp payment-method warning
                                      appears directly under the selected
                                      WhatsApp account. Matches replyagent's
                                      inline advisory — the broadcast will
                                      silently fail if Meta hasn't been
                                      given a payment method. */}
                                  {isSelected && type === "whatsapp" && (
                                    <div className="flex items-start gap-2.5 px-3.5 py-2.5 rounded-xl border border-amber-200 dark:border-amber-900/50 bg-amber-50/70 dark:bg-amber-950/20">
                                      <AlertTriangle size={14} className="shrink-0 mt-0.5 text-amber-500" strokeWidth={2.5} />
                                      <p className="text-[11.5px] text-amber-800 dark:text-amber-200 leading-snug">
                                        {t("campaign_manager.create_dialog.payment_warning")}
                                      </p>
                                    </div>
                                  )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Footer — edge-to-edge divider mirrors the header seam so
                  the modal reads as three distinct bands (header / body /
                  actions) instead of a single flat surface. */}
              <div className="flex items-center justify-between gap-2 pt-4 -mx-6 -mb-6 px-6 pb-6 border-t border-slate-200 dark:border-slate-800 mt-5">
                <p className="text-[11.5px] text-slate-400 dark:text-slate-500">
                  {newBroadcastChannelKey
                    ? t("campaign_manager.create_dialog.ready_hint")
                    : t("campaign_manager.create_dialog.choose_channel_hint")}
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setCreateOpen(false);
                      resetCreateCampaignForm();
                    }}
                    className="h-9 px-4 rounded-lg font-semibold text-[12.5px] border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800"
                  >
                    {t("campaign_manager.common.cancel")}
                  </Button>
                  <Button
                    size="sm"
                    disabled={!campaignName.trim() || !newBroadcastChannelKey}
                    onClick={() => {
                      // Close the "Create a Broadcast" modal and open the
                      // full-page composer. The composer picks up
                      // campaignName + newBroadcastChannelKey from state.
                      // Fresh open = clean validation slate.
                      setComposerSendAttempted(false);
                      setCreateOpen(false);
                      setComposerOpen(true);
                    }}
                    className="h-9 px-4 rounded-lg font-semibold text-[12.5px] bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm shadow-primary/20 disabled:shadow-none disabled:opacity-60"
                  >
                    <Plus size={14} className="mr-1.5" strokeWidth={2.5} />
                    {t("campaign_manager.create_dialog.create_broadcast")}
                  </Button>
                </div>
              </div>
            </>
          )}

        </DialogContent>
      </Dialog>


      {/* Clone Campaign Dialog */}
      <Dialog open={cloneDialogOpen} onOpenChange={handleCancelCloneDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("campaign_manager.clone.title")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">{t("campaign_manager.clone.campaign_name")}<span className="text-red-500 pl-0.5">*</span></label>
              <div className="relative">
                <Input
                  placeholder={t("campaign_manager.clone.name_placeholder")}
                  value={cloneCampaignName}
                  onChange={(e) => setCloneCampaignName(e.target.value.slice(0, 512))}
                  className="pr-12 border border-input [border-color:hsl(var(--input))] hover-elevate"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                  {cloneCampaignName.length}/512
                </span>
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={handleCancelCloneDialog}>
                {t("campaign_manager.common.cancel")}
              </Button>
              <Button
                className="btn-outline-primary"
                variant="outline"
                onClick={handleCloneCampaign}
                disabled={!cloneCampaignName.trim()}
              >
                {t("campaign_manager.clone.title")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>


      {/* Delete Campaign Modal */}
      <Dialog open={showDeleteModal} onOpenChange={setShowDeleteModal}>
        <DialogContent className="max-w-sm">
          <DialogHeader className="mb-2">
            <DialogTitle>{t("campaign_manager.delete.title")}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <p className="text-sm text-foreground">
              {t("campaign_manager.delete.confirm_prefix")} <span className="font-semibold break-all">{campaignToDelete?.name}</span>{t("campaign_manager.delete.confirm_suffix")}
            </p>
          </div>

          {/* Modal Footer */}
          <div className="flex gap-2 justify-end mt-2">
            <Button
              onClick={() => setShowDeleteModal(false)}
              variant="outline"
              className="border-input [border-color:hsl(var(--input))]"
            >
              {t("campaign_manager.common.cancel")}
            </Button>
            <Button
              onClick={handleConfirmDelete}
              className="bg-red-500 hover:bg-red-600 border-red-600 text-white"
            >
              {t("campaign_manager.common.delete")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

    </div>
  );
}

// ─── Channel chip helpers (used in the NAME & CHANNEL column) ───────────
function channelChipClass(channel?: string): string {
  switch (channel) {
    case "whatsapp":
      return "bg-emerald-50 border-emerald-200 text-emerald-600 dark:bg-emerald-900/30 dark:border-emerald-800";
    case "telegram":
      return "bg-sky-50 border-sky-200 text-sky-600 dark:bg-sky-900/30 dark:border-sky-800";
    case "messenger":
      return "bg-blue-50 border-blue-200 text-blue-600 dark:bg-blue-900/30 dark:border-blue-800";
    case "instagram":
      return "bg-fuchsia-50 border-fuchsia-200 text-fuchsia-600 dark:bg-fuchsia-900/30 dark:border-fuchsia-800";
    case "webchat":
      return "bg-orange-50 border-orange-200 text-orange-600 dark:bg-orange-900/30 dark:border-orange-800";
    case "twilio_sms":
    case "twilio_call":
      return "bg-rose-50 border-rose-200 text-rose-600 dark:bg-rose-900/30 dark:border-rose-800";
    default:
      return "bg-slate-50 border-slate-200 text-slate-500 dark:bg-slate-800 dark:border-slate-700";
  }
}

function ChannelChipIcon({
  channel,
  size = 12,
}: {
  channel?: string;
  size?: number;
}) {
  // Real brand glyphs (react-icons) — used both in the broadcast row's
  // colour chip and in the "Create a Broadcast" channel picker so the
  // user sees the actual product logo (WhatsApp green tick, Telegram
  // paper plane, etc.) instead of a generic chat bubble.
  const klass = `h-[${size}px] w-[${size}px]`;
  switch (channel) {
    case "whatsapp":
    case "zapi":
    case "evolution":
      return <FaWhatsapp className={klass} />;
    case "telegram":
      return <FaTelegramPlane className={klass} />;
    case "messenger":
      return <FaFacebookMessenger className={klass} />;
    case "instagram":
      return <FaInstagram className={klass} />;
    case "webchat":
      return <BsChatDotsFill className={klass} />;
    case "twilio_sms":
    case "twilio_call":
      return <SiTwilio className={klass} />;
    default:
      return <MessageSquare className={klass} strokeWidth={2.5} />;
  }
}

// ─── Audience condition picker ─────────────────────────────────────────
// Full-modal grid of pickable audience filters. Sections are:
//   • General     — Tag / Opportunity Tag
//   • System      — the built-in contact fields
//   • Opportunity — pipeline opportunity fields
//   • Custom      — workspace's custom fields (fetched at parent)
//   • [channel]   — per-channel-account fields (Last Interaction, ID, …)
// Each card is a green-tinted rounded panel; hovering lifts it, and
// selecting fires onPick with the chosen field so the parent can append
// it to the composer's condition list.

interface ConditionOption {
  id: string;
  label: string;
  category: string;
  icon: string;
  fieldType: "enum" | "text" | "number" | "date" | "boolean";
  // Enum-only: options for the Configure-condition value dropdown. For
  // Tag / Opportunity Tag we pass the workspace tags; for Status we hard-
  // code the pipeline stage labels.
  enumOptions?: Array<{ id: string; label: string }>;
}

function ConditionPickerModal({
  open,
  onOpenChange,
  search,
  onSearchChange,
  channels,
  customFields,
  workspaceTags,
  onPick,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  search: string;
  onSearchChange: (v: string) => void;
  channels: any[];
  customFields: Array<{ id: string; name: string }>;
  workspaceTags: Array<{ id: string; name: string }>;
  onPick: (cond: ConditionOption) => void;
}) {
  const { t } = useTranslation();
  // Icon glyph per option — kept as a lookup so the option list can stay
  // pure-data.
  const glyph = (name: string, size = 13): React.ReactNode => {
    switch (name) {
      case "tag": return <Tag size={size} strokeWidth={2.5} />;
      case "hash": return <Hash size={size} strokeWidth={2.5} />;
      case "user": return <User size={size} strokeWidth={2.5} />;
      case "phone": return <PhoneIcon size={size} strokeWidth={2.5} />;
      case "link": return <Link2 size={size} strokeWidth={2.5} />;
      case "message": return <MessageSquare size={size} strokeWidth={2.5} />;
      case "mail": return <Mail size={size} strokeWidth={2.5} />;
      case "clock": return <Clock size={size} strokeWidth={2.5} />;
      case "check": return <CheckCircle2 size={size} strokeWidth={2.5} />;
      case "dollar": return <DollarSign size={size} strokeWidth={2.5} />;
      case "calendar": return <Calendar size={size} />;
      case "percent": return <Percent size={size} strokeWidth={2.5} />;
      case "globe": return <Globe size={size} strokeWidth={2.5} />;
      case "check-square": return <CheckSquare size={size} strokeWidth={2.5} />;
      case "message-circle": return <MessageCircle size={size} strokeWidth={2.5} />;
      default: return <Filter size={size} strokeWidth={2.5} />;
    }
  };

  const tagEnum = workspaceTags.map((tg) => ({ id: tg.id, label: tg.name }));
  const statusEnum = [
    { id: "open", label: t("campaign_manager.opportunity_status.open") },
    { id: "won", label: t("campaign_manager.opportunity_status.won") },
    { id: "lost", label: t("campaign_manager.opportunity_status.lost") },
  ];
  // Build sections dynamically so channel accounts appear inline.
  const sections: Array<{ title: string; options: ConditionOption[] }> = [
    {
      title: t("campaign_manager.categories.general"),
      options: [
        { id: "tag", label: t("campaign_manager.fields.tag"), category: t("campaign_manager.categories.general"), icon: "tag", fieldType: "enum", enumOptions: tagEnum },
        { id: "opportunity_tag", label: t("campaign_manager.fields.opportunity_tag"), category: t("campaign_manager.categories.general"), icon: "tag", fieldType: "enum", enumOptions: tagEnum },
      ],
    },
    {
      title: t("campaign_manager.categories.system"),
      options: [
        { id: "contact_id", label: t("campaign_manager.fields.contact_id"), category: t("campaign_manager.categories.system"), icon: "hash", fieldType: "number" },
        { id: "full_name", label: t("campaign_manager.fields.full_name"), category: t("campaign_manager.categories.system"), icon: "user", fieldType: "text" },
        { id: "first_name", label: t("campaign_manager.fields.first_name"), category: t("campaign_manager.categories.system"), icon: "user", fieldType: "text" },
        { id: "last_name", label: t("campaign_manager.fields.last_name"), category: t("campaign_manager.categories.system"), icon: "user", fieldType: "text" },
        { id: "title", label: t("campaign_manager.fields.title"), category: t("campaign_manager.categories.system"), icon: "user", fieldType: "text" },
        { id: "source", label: t("campaign_manager.fields.source"), category: t("campaign_manager.categories.system"), icon: "link", fieldType: "text" },
        { id: "phone", label: t("campaign_manager.fields.phone"), category: t("campaign_manager.categories.system"), icon: "phone", fieldType: "text" },
        { id: "whatsapp_number", label: t("campaign_manager.fields.whatsapp_number"), category: t("campaign_manager.categories.system"), icon: "phone", fieldType: "text" },
        { id: "phone_country_code", label: t("campaign_manager.fields.phone_country_code"), category: t("campaign_manager.categories.system"), icon: "message", fieldType: "text" },
        { id: "email", label: t("campaign_manager.fields.email"), category: t("campaign_manager.categories.system"), icon: "mail", fieldType: "text" },
        { id: "created_on", label: t("campaign_manager.fields.created_on"), category: t("campaign_manager.categories.system"), icon: "clock", fieldType: "date" },
      ],
    },
    {
      title: t("campaign_manager.categories.opportunity"),
      options: [
        { id: "opp_status", label: t("campaign_manager.fields.opp_status"), category: t("campaign_manager.categories.opportunity"), icon: "check", fieldType: "enum", enumOptions: statusEnum },
        { id: "opp_value", label: t("campaign_manager.fields.opp_value"), category: t("campaign_manager.categories.opportunity"), icon: "dollar", fieldType: "number" },
        { id: "opp_closing_date", label: t("campaign_manager.fields.opp_closing_date"), category: t("campaign_manager.categories.opportunity"), icon: "calendar", fieldType: "date" },
        { id: "opp_confidence", label: t("campaign_manager.fields.opp_confidence"), category: t("campaign_manager.categories.opportunity"), icon: "percent", fieldType: "number" },
        { id: "opp_assigned_to", label: t("campaign_manager.fields.opp_assigned_to"), category: t("campaign_manager.categories.opportunity"), icon: "user", fieldType: "text" },
      ],
    },
    ...(customFields.length > 0
      ? [{
          title: t("campaign_manager.categories.custom_fields"),
          options: customFields.map((f) => ({
            id: `cf_${f.id}`,
            label: f.name,
            category: t("campaign_manager.categories.custom_fields"),
            icon: "check-square",
            fieldType: "text" as const,
          })),
        }]
      : []),
    // Per channel account — replyagent groups by channel type + account
    // name so the user can filter on channel-specific attributes.
    ...channels.map((c: any) => {
      const type = String(c.channel_type ?? "");
      const acctName = c.name ?? `#${c.channelable_id}`;
      const typeLabel = ({
        whatsapp: "WhatsApp",
        telegram: "Telegram",
        messenger: "Messenger",
        instagram: "Instagram",
        webchat: "Webchat",
      } as Record<string, string>)[type] ?? type;
      const commonOpts: ConditionOption[] = [
        { id: `${type}_${c.channelable_id}_last_interaction`, label: t("campaign_manager.fields.last_interaction"), category: `${typeLabel} (${acctName})`, icon: "clock", fieldType: "date" },
        { id: `${type}_${c.channelable_id}_opted_in`, label: t("campaign_manager.fields.opted_in"), category: `${typeLabel} (${acctName})`, icon: "check-square", fieldType: "boolean" },
      ];
      const typeSpecific: ConditionOption[] = type === "telegram"
        ? [
            { id: `${type}_${c.channelable_id}_tg_id`, label: t("campaign_manager.fields.telegram_id"), category: `${typeLabel} (${acctName})`, icon: "hash", fieldType: "text" },
            { id: `${type}_${c.channelable_id}_tg_username`, label: t("campaign_manager.fields.telegram_username"), category: `${typeLabel} (${acctName})`, icon: "user", fieldType: "text" },
          ]
        : type === "whatsapp"
        ? [
            { id: `${type}_${c.channelable_id}_wa_number`, label: t("campaign_manager.fields.wa_phone_number"), category: `${typeLabel} (${acctName})`, icon: "hash", fieldType: "text" },
            { id: `${type}_${c.channelable_id}_wa_country`, label: t("campaign_manager.fields.wa_country_code"), category: `${typeLabel} (${acctName})`, icon: "message", fieldType: "text" },
          ]
        : type === "messenger"
        ? [
            { id: `${type}_${c.channelable_id}_msg_window`, label: t("campaign_manager.fields.message_window"), category: `${typeLabel} (${acctName})`, icon: "message-circle", fieldType: "boolean" },
            { id: `${type}_${c.channelable_id}_locale`, label: t("campaign_manager.fields.locale"), category: `${typeLabel} (${acctName})`, icon: "globe", fieldType: "text" },
            { id: `${type}_${c.channelable_id}_language`, label: t("campaign_manager.fields.language"), category: `${typeLabel} (${acctName})`, icon: "message", fieldType: "text" },
          ]
        : [];
      return {
        title: `${typeLabel} (${acctName})`,
        options: [commonOpts[0], ...typeSpecific, commonOpts[1]],
      };
    }),
  ];

  // Search filter — matches label OR category.
  const q = search.trim().toLowerCase();
  const filteredSections = q
    ? sections
        .map((s) => ({
          ...s,
          options: s.options.filter(
            (o) => o.label.toLowerCase().includes(q) || o.category.toLowerCase().includes(q),
          ),
        }))
        .filter((s) => s.options.length > 0)
    : sections;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[560px] p-0 rounded-2xl overflow-hidden">
        {/* Header with filter tile + title + close X */}
        <DialogHeader className="px-5 py-4 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-start gap-3">
            <div className="shrink-0 h-11 w-11 rounded-xl bg-emerald-500 flex items-center justify-center shadow-sm shadow-emerald-500/25">
              <Filter size={18} className="text-white" strokeWidth={2.5} />
            </div>
            <div className="flex-1 min-w-0">
              <DialogTitle className="text-[16px] font-bold text-slate-900 dark:text-white">
                {t("campaign_manager.condition_picker.title")}
              </DialogTitle>
              <p className="text-[12px] text-slate-500 dark:text-slate-400 mt-0.5">
                {t("campaign_manager.condition_picker.subtitle")}
              </p>
            </div>
          </div>
        </DialogHeader>

        {/* Search */}
        <div className="px-5 pt-4 pb-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <Input
              placeholder={t("campaign_manager.condition_picker.search")}
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              className="pl-9 h-10 rounded-lg border-slate-200 dark:border-slate-800 text-[13px]"
              autoFocus
            />
          </div>
        </div>

        {/* Sections */}
        <div className="px-5 py-3 max-h-[52vh] overflow-y-auto space-y-5">
          {filteredSections.length === 0 ? (
            <div className="py-10 text-center text-[12px] text-slate-400">
              {t("campaign_manager.condition_picker.no_match", { query: search })}
            </div>
          ) : (
            filteredSections.map((section) => (
              <div key={section.title} className="space-y-2">
                <h4 className="text-[13px] font-bold text-slate-800 dark:text-slate-200">
                  {section.title}
                </h4>
                <div className="grid grid-cols-2 gap-2">
                  {section.options.map((opt) => (
                    <button
                      key={opt.id}
                      onClick={() => onPick(opt)}
                      className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-emerald-400 hover:bg-emerald-50/40 dark:hover:bg-emerald-950/20 text-left transition-all"
                    >
                      <span className="h-7 w-7 rounded-md flex items-center justify-center shrink-0 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-500 dark:text-emerald-400">
                        {glyph(opt.icon)}
                      </span>
                      <span className="text-[12.5px] font-semibold text-slate-800 dark:text-slate-200 truncate">
                        {opt.label}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Operator vocab per field type ─────────────────────────────────────
// Kept small and human — matches the operators visible in replyagent's
// Configure-condition modal. Each entry gives us both the machine value
// (persisted into the broadcast metadata) and the past-tense label used
// in the live preview line.
const CONDITION_OPERATORS: Record<
  "enum" | "text" | "number" | "date" | "boolean",
  Array<{ value: string; label: string; preview: string }>
> = {
  enum: [
    { value: "is", label: "Is", preview: "is" },
    { value: "is_not", label: "Is not", preview: "is not" },
  ],
  text: [
    { value: "has_value", label: "Has value", preview: "has value" },
    { value: "is_null", label: "Is Null", preview: "is null" },
    { value: "is", label: "Is", preview: "is" },
    { value: "is_not", label: "Is not", preview: "is not" },
    { value: "contains", label: "Contains", preview: "contains" },
    { value: "does_not_contain", label: "Does not contain", preview: "does not contain" },
    { value: "begins_with", label: "Begins with", preview: "begins with" },
  ],
  number: [
    { value: "has_value", label: "Has value", preview: "has value" },
    { value: "is_null", label: "Is Null", preview: "is null" },
    { value: "is", label: "Is", preview: "is" },
    { value: "is_not", label: "Is not", preview: "is not" },
    { value: "greater_than", label: "Greater than", preview: "is greater than" },
    { value: "less_than", label: "Less than", preview: "is less than" },
  ],
  date: [
    { value: "is", label: "Is", preview: "is" },
    { value: "before", label: "Before", preview: "is before" },
    { value: "after", label: "After", preview: "is after" },
  ],
  boolean: [
    { value: "is_true", label: "Is true", preview: "is true" },
    { value: "is_false", label: "Is false", preview: "is false" },
  ],
};

// Returns the past-tense preview verb for a given (fieldType, operator).
function conditionOperatorPreview(
  fieldType: keyof typeof CONDITION_OPERATORS,
  op: string,
  t: (key: string) => string,
): string {
  const found = CONDITION_OPERATORS[fieldType].find((o) => o.value === op);
  return found ? t(`campaign_manager.operator_previews.${found.value}`) : op;
}

// True when the operator itself carries the whole meaning (no value input
// needed) — has_value / is_null / boolean ops.
function operatorSkipsValue(op: string): boolean {
  return op === "has_value" || op === "is_null" || op === "is_true" || op === "is_false";
}

// ─── Configure condition modal ──────────────────────────────────────────
// Second-step of the audience-condition flow. Renders a compact "field
// picked" breadcrumb card, an operator dropdown, an appropriate value
// input (enum dropdown / text / number / date), and a live emerald
// preview strip so the user sees the sentence build in real time.

function ConfigureConditionModal({
  field,
  operator,
  value,
  valueLabel,
  onOperatorChange,
  onValueChange,
  onValueLabelChange,
  onBack,
  onClose,
  onSave,
}: {
  field: null | {
    fieldId: string;
    fieldLabel: string;
    category: string;
    icon: string;
    fieldType: "enum" | "text" | "number" | "date" | "boolean";
    enumOptions?: Array<{ id: string; label: string }>;
  };
  operator: string;
  value: string;
  valueLabel: string;
  onOperatorChange: (v: string) => void;
  onValueChange: (v: string) => void;
  onValueLabelChange: (v: string) => void;
  onBack: () => void;
  onClose: () => void;
  onSave: () => void;
}) {
  const { t } = useTranslation();
  if (!field) return null;
  const operators = CONDITION_OPERATORS[field.fieldType];
  const skipValue = operatorSkipsValue(operator);
  // Preview line — quoted for text/enum, bare for numbers, empty when
  // the operator (has_value / is_null) subsumes the value.
  const previewVerb = conditionOperatorPreview(field.fieldType, operator, t);
  const previewValue = skipValue
    ? ""
    : field.fieldType === "enum"
      ? (valueLabel ? `"${valueLabel}"` : `""`)
      : field.fieldType === "text"
        ? `"${value}"`
        : value || `""`;
  const previewLine = `${field.fieldLabel} ${previewVerb}${previewValue ? " " + previewValue : ""}`;
  // Save gate — enum needs a picked value, text/number need a non-empty
  // input UNLESS the operator skips the value.
  const canSave = skipValue
    ? true
    : field.fieldType === "enum"
      ? !!value
      : field.fieldType === "date"
        ? !!value
        : String(value).trim().length > 0;

  return (
    <Dialog open={!!field} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-[520px] p-0 rounded-2xl overflow-hidden">
        {/* Header */}
        <DialogHeader className="px-5 py-4 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-start gap-3">
            <div className="shrink-0 h-11 w-11 rounded-xl bg-emerald-500 flex items-center justify-center shadow-sm shadow-emerald-500/25">
              <Filter size={18} className="text-white" strokeWidth={2.5} />
            </div>
            <div className="flex-1 min-w-0">
              <DialogTitle className="text-[16px] font-bold text-slate-900 dark:text-white">
                {t("campaign_manager.configure_condition.title")}
              </DialogTitle>
              <p className="text-[12px] text-slate-500 dark:text-slate-400 mt-0.5">
                {t("campaign_manager.configure_condition.subtitle")}
              </p>
            </div>
          </div>
        </DialogHeader>

        <div className="px-5 py-4 space-y-4">
          {/* Field breadcrumb card */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 px-3 py-2.5 flex items-center gap-2.5">
            <span className="h-8 w-8 rounded-md bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 flex items-center justify-center shrink-0">
              <ConditionGlyph name={field.icon} />
            </span>
            <div className="min-w-0">
              <p className="text-[12.5px] font-bold text-slate-900 dark:text-white truncate">{field.fieldLabel}</p>
              <p className="text-[10.5px] text-slate-500 dark:text-slate-400 truncate">{field.category}</p>
            </div>
          </div>

          {/* Operator */}
          <div className="space-y-1.5">
            <label className="text-[11.5px] font-semibold text-slate-700 dark:text-slate-300">
              {field.fieldType === "enum" ? t("campaign_manager.configure_condition.where") : t("campaign_manager.configure_condition.when")}
            </label>
            <Select value={operator} onValueChange={onOperatorChange}>
              <SelectTrigger className="h-9 rounded-lg text-[12.5px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {operators.map((op) => (
                  <SelectItem key={op.value} value={op.value}>{t(`campaign_manager.operators.${op.value}`)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Value input — hidden when the operator skips it */}
          {!skipValue && (
            <div className="space-y-1.5">
              <label className="text-[11.5px] font-semibold text-slate-700 dark:text-slate-300">
                {field.fieldType === "enum" ? field.fieldLabel : t("campaign_manager.configure_condition.where")}
              </label>
              {field.fieldType === "enum" ? (
                <Select
                  value={value}
                  onValueChange={(v) => {
                    onValueChange(v);
                    const found = field.enumOptions?.find((o) => o.id === v);
                    onValueLabelChange(found?.label ?? v);
                  }}
                >
                  <SelectTrigger className="h-9 rounded-lg text-[12.5px]">
                    <SelectValue placeholder={t("campaign_manager.configure_condition.select_value", { field: field.fieldLabel.toLowerCase() })} />
                  </SelectTrigger>
                  <SelectContent>
                    {(field.enumOptions ?? []).length === 0 ? (
                      <SelectItem value="__none__" disabled>{t("campaign_manager.configure_condition.no_options")}</SelectItem>
                    ) : (
                      (field.enumOptions ?? []).map((o) => (
                        <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              ) : field.fieldType === "date" ? (
                <Input
                  type="date"
                  value={value}
                  onChange={(e) => onValueChange(e.target.value)}
                  className="h-9 rounded-lg text-[12.5px]"
                />
              ) : field.fieldType === "number" ? (
                <Input
                  type="number"
                  value={value}
                  onChange={(e) => onValueChange(e.target.value)}
                  placeholder={t("campaign_manager.configure_condition.enter_number")}
                  className="h-9 rounded-lg text-[12.5px]"
                />
              ) : (
                <Input
                  value={value}
                  onChange={(e) => onValueChange(e.target.value)}
                  placeholder={t("campaign_manager.configure_condition.enter_value", { field: field.fieldLabel.toLowerCase() })}
                  className="h-9 rounded-lg text-[12.5px]"
                />
              )}
            </div>
          )}

          {/* Live preview */}
          <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg border border-emerald-200 dark:border-emerald-900/40 bg-emerald-50/60 dark:bg-emerald-950/20">
            <CheckSquare size={13} strokeWidth={2.5} className="text-emerald-600 shrink-0" />
            <p className="text-[12px] font-medium text-emerald-800 dark:text-emerald-200 truncate">
              {previewLine}
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onBack}
            className="h-9 px-3 text-[12.5px] border-slate-200 dark:border-slate-800"
          >
            <ChevronLeft size={13} className="mr-1" />
            {t("campaign_manager.configure_condition.back")}
          </Button>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={onClose} className="h-9 px-4 text-[12.5px]">{t("campaign_manager.common.close")}</Button>
            <Button
              size="sm"
              onClick={onSave}
              disabled={!canSave}
              className="h-9 px-4 text-[12.5px] font-semibold bg-emerald-500 hover:bg-emerald-600 text-white shadow-sm shadow-emerald-500/20 disabled:opacity-60"
            >
              <CheckCircle2 size={13} strokeWidth={2.5} className="mr-1.5" />
              {t("campaign_manager.configure_condition.save")}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Extracted glyph switch used by both modals so the same icon vocabulary
// stays in one place.
function ConditionGlyph({ name, size = 13 }: { name: string; size?: number }) {
  switch (name) {
    case "tag": return <Tag size={size} strokeWidth={2.5} />;
    case "hash": return <Hash size={size} strokeWidth={2.5} />;
    case "user": return <User size={size} strokeWidth={2.5} />;
    case "phone": return <PhoneIcon size={size} strokeWidth={2.5} />;
    case "link": return <Link2 size={size} strokeWidth={2.5} />;
    case "message": return <MessageSquare size={size} strokeWidth={2.5} />;
    case "mail": return <Mail size={size} strokeWidth={2.5} />;
    case "clock": return <Clock size={size} strokeWidth={2.5} />;
    case "check": return <CheckCircle2 size={size} strokeWidth={2.5} />;
    case "dollar": return <DollarSign size={size} strokeWidth={2.5} />;
    case "calendar": return <Calendar size={size} />;
    case "percent": return <Percent size={size} strokeWidth={2.5} />;
    case "globe": return <Globe size={size} strokeWidth={2.5} />;
    case "check-square": return <CheckSquare size={size} strokeWidth={2.5} />;
    case "message-circle": return <MessageCircle size={size} strokeWidth={2.5} />;
    default: return <Filter size={size} strokeWidth={2.5} />;
  }
}

// ─── Composer number stepper primitives ─────────────────────────────────
// A tidy "− [value] +" input group used in the Delivery Profile section.
// Same-height buttons + tabular-nums keep the row visually clean across
// the four fields.
function StepperInput({
  value,
  onChange,
  min,
  max,
}: {
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
}) {
  const bump = (delta: number) => onChange(Math.max(min, Math.min(max, value + delta)));
  return (
    <div className="flex items-stretch h-9 rounded-lg border border-slate-200 dark:border-slate-800 overflow-hidden">
      <button
        type="button"
        onClick={() => bump(-1)}
        className="px-2 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-500 transition-colors"
      >
        <Minus size={12} strokeWidth={2.5} />
      </button>
      <div className="flex-1 flex items-center justify-center text-[13px] font-semibold text-slate-900 dark:text-white tabular-nums border-x border-slate-200 dark:border-slate-800">
        {value}
      </div>
      <button
        type="button"
        onClick={() => bump(1)}
        className="px-2 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-500 transition-colors"
      >
        <Plus size={12} strokeWidth={2.5} />
      </button>
    </div>
  );
}

function NumberStepper({
  label,
  suffix,
  value,
  onChange,
  min,
  max,
  hint,
}: {
  label: string;
  suffix?: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  hint?: string;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <label className="text-[10.5px] font-bold uppercase tracking-wider text-slate-500">{label}</label>
        {suffix && <span className="text-[10px] text-slate-400 uppercase tracking-wider">{suffix}</span>}
      </div>
      <StepperInput value={value} onChange={onChange} min={min} max={max} />
      {hint && <p className="text-[10.5px] text-slate-400">{hint}</p>}
    </div>
  );
}

// ─── BroadcastStatsRow ──────────────────────────────────────────────────
// Four KPI cards mirroring replyagent's /broadcasts dashboard:
//   1. Total Broadcasts   — count of broadcasts in the list       (green)
//   2. Total Contacts     — sum of audience across all broadcasts (blue)
//   3. Avg Delivery Rate  — totalSent / totalAudience (capped 100%)
//      + mini emerald bar chart of per-week delivery rate         (navy)
//   4. Avg Open Rate      — placeholder until per-recipient read receipts
//      + mini amber bar chart                                      (orange)
// Coloured top borders + top-right icon tile match replyagent's card
// treatment and let the user scan the row at a glance.
function BroadcastStatsRow({ campaigns }: { campaigns: Campaign[] }) {
  const { t } = useTranslation();
  const totalBroadcasts = campaigns.length;
  const totalContacts = campaigns.reduce(
    (sum, c) => sum + (c.audience ?? 0),
    0,
  );
  const totalSent = campaigns.reduce((sum, c) => sum + (c.sent ?? 0), 0);
  const deliveryRate =
    totalContacts > 0
      ? Math.min(100, Math.round((totalSent / totalContacts) * 100))
      : 0;
  const openRate = 0; // No read receipts wired yet.

  // Synthetic 8-bucket series for the mini bar charts. A hand-picked
  // sample shape (not random — random re-generates on every render and
  // makes the tiles flicker) gives the tiles the organic up-and-down
  // pattern replyagent shows, instead of the previous flat straight
  // line we got from a constant value. Scaled off the aggregate rate so
  // the bars still trend up when the rate does; a min floor keeps every
  // bar visible when the placeholder rate is 0.
  const deliveryShape = [55, 45, 42, 65, 50, 48, 55, 75];
  const openShape    = [40, 50, 65, 45, 55, 42, 68, 50];
  const scaleFor = (rate: number) => Math.max(0.5, Math.min(1, rate / 100 + 0.6));
  const deliverySeries = deliveryShape.map((v) => Math.round(v * scaleFor(deliveryRate)));
  const openSeries     = openShape.map((v) => Math.round(v * scaleFor(openRate)));

  interface Card {
    label: string;
    value: string;
    hint?: string;
    Icon: any;
    iconBg: string;
    iconColor: string;
    /** Tailwind class for the coloured top border strip. */
    topBorder: string;
    /** Optional mini-chart bar colour. */
    chartColor?: string;
    chartData?: number[];
  }

  const cards: Card[] = [
    {
      label: t("campaign_manager.stats.total_broadcasts"),
      value: totalBroadcasts.toLocaleString(),
      hint: t("campaign_manager.stats.this_month"),
      Icon: Megaphone,
      iconBg: "bg-primary/10",
      iconColor: "text-primary",
      topBorder: "bg-primary",
    },
    {
      label: t("campaign_manager.stats.total_contacts"),
      value: totalContacts.toLocaleString(),
      hint: t("campaign_manager.stats.reachable_audience"),
      Icon: UsersRound,
      iconBg: "bg-blue-100 dark:bg-blue-900/30",
      iconColor: "text-blue-600 dark:text-blue-400",
      topBorder: "bg-blue-500",
    },
    {
      label: t("campaign_manager.stats.avg_delivery_rate"),
      value: `${deliveryRate}%`,
      Icon: CheckCircle2,
      iconBg: "bg-slate-100 dark:bg-slate-800",
      iconColor: "text-slate-700 dark:text-slate-300",
      topBorder: "bg-slate-800 dark:bg-slate-600",
      chartColor: "bg-primary/60",
      chartData: deliverySeries,
    },
    {
      label: t("campaign_manager.stats.avg_open_rate"),
      value: `${openRate}%`,
      Icon: Mail,
      iconBg: "bg-amber-100 dark:bg-amber-900/30",
      iconColor: "text-amber-600 dark:text-amber-400",
      topBorder: "bg-amber-500",
      chartColor: "bg-amber-300",
      chartData: openSeries,
    },
  ];

  return (
    <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800/80 bg-slate-50/30 dark:bg-slate-900/20">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((c) => (
          <div
            key={c.label}
            className="relative bg-white dark:bg-slate-900/60 rounded-xl border border-slate-200 dark:border-slate-800 pt-1 pb-4 px-4 flex flex-col justify-between overflow-hidden shadow-sm min-h-[140px]"
          >
            {/* Coloured top strip */}
            <div className={cn("absolute top-0 left-0 right-0 h-1.5 rounded-t-xl", c.topBorder)} />
            {/* Icon top-right */}
            <div className="flex items-start justify-between mt-2">
              <p className="text-[12px] font-medium text-slate-600 dark:text-slate-300">
                {c.label}
              </p>
              <div className={cn("p-1.5 rounded-md", c.iconBg)}>
                <c.Icon size={14} strokeWidth={2.5} className={c.iconColor} />
              </div>
            </div>
            <div className="mt-1">
              <p className="text-[24px] font-bold leading-tight text-slate-900 dark:text-white">
                {c.value}
              </p>
              {c.hint && (
                <p className="text-[10px] font-medium text-primary flex items-center gap-1 mt-0.5">
                  <span className="inline-block">↗</span>
                  {c.hint}
                </p>
              )}
              {c.chartData && (
                // Taller (h-10 = 40px) mini bar chart with rounded-md
                // corners so each bar reads as a chunky pill rather than
                // a hairline. Bars span 20-100% of the 40px track so the
                // shortest one is still clearly visible.
                <div className="flex items-end gap-1 mt-3 h-10">
                  {c.chartData.map((v, i) => (
                    <div
                      key={i}
                      className={cn("flex-1 rounded-md", c.chartColor)}
                      style={{ height: `${Math.max(25, Math.min(100, v))}%` }}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
