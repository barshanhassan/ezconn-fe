/**
 * Contact Profile Modal — 1:1 mirror of replyagent's gateway-frontend
 * `views/Elements/CompanyProfile.vue` (preview_lead mode), built natively in
 * React + TanStack Query.
 *
 * Layout (replyagent parity):
 *   ┌────────────────────────────────────────────────────────────────────┐
 *   │  Header — avatar, name + edit, uploaded chip, delete, source, ×    │
 *   ├──────────────┬───────────────────────────────┬─────────────────────┤
 *   │  Left sidebar│  Middle column                │  Right panel        │
 *   │  - CONTACTS  │  Edit-in-place form           │  SYSTEM FIELDS grid │
 *   │  - TASKS     │  - First / Last name          │  CUSTOM FIELDS      │
 *   │  - OPPS      │  - Gender / Title             │  TAGS               │
 *   │  - BOOKINGS  │  - Language / Locale / TZ     │                     │
 *   │  - CALLS     │  - Phone / WhatsApp / Email   │                     │
 *   │  - AD CLICKS │  - Address (rich)             │                     │
 *   │  - GROUPS    │  - Custom field values        │                     │
 *   └──────────────┴───────────────────────────────┴─────────────────────┘
 *
 * Sub-modals (inline): Change Company, Merge Contacts, Delete, New Custom
 * Field, New Tag, New Task, New Opportunity, New Phone/Email/Address. Every
 * + button + every ⋯ menu wired to the matching backend endpoint.
 */
import { useEffect, useMemo, useState, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { getAvatarColor } from "@/lib/avatar-utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import {
  X,
  Search,
  Plus,
  User as UserIcon,
  ClipboardList,
  BarChart3,
  Calendar,
  Phone as PhoneIcon,
  MousePointerClick,
  FileText,
  ChevronRight,
  MoreHorizontal,
  MessageSquare,
  Image as ImageIcon,
  Clock,
  Magnet,
  KeyRound,
  ArrowLeft,
  Trash2,
  Mail,
  Loader2,
  Check,
  Users,
  ExternalLink,
  Globe,
  MapPin,
  Languages,
  Type as TypeIcon,
  Pencil,
  Download,
  Briefcase,
  Tag as TagIcon,
  GitMerge,
  Repeat,
  AlarmClock,
  CheckSquare,
  Bell,
  History,
  ChevronDown,
  Send,
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { getUserInfo, hasAnyPerm } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";

// apiRequest returns a raw Response; these wrappers parse JSON so callers can
// read fields directly. Mirrors the pattern used across ContactsSection.tsx /
// CustomFieldsSection.tsx (`(await apiRequest(...)).json()`).
const apiGet = async (url: string) => {
  const r = await apiRequest("GET", url);
  return r.json();
};
const apiPost = async (url: string, data?: any) => {
  const r = await apiRequest("POST", url, data);
  return r.json();
};
const apiPatch = async (url: string, data?: any) => {
  const r = await apiRequest("PATCH", url, data);
  return r.json();
};
const apiDelete = async (url: string) => {
  const r = await apiRequest("DELETE", url);
  // DELETE may return empty body — treat as JSON best-effort.
  const text = await r.text();
  try {
    return text ? JSON.parse(text) : { success: true };
  } catch {
    return { success: true };
  }
};
import { format } from "date-fns";
import { formatInWorkspaceTz, useWorkspaceTimezone } from "@/contexts/WorkspaceTimezoneContext";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  CountryPicker,
  PhoneFieldEditor,
  AddressEditor,
  LanguagePicker,
  LocalePicker,
  TimezonePicker,
  CustomFieldRenderer,
  loadCountries,
  type Country,
  type CustomFieldDescriptor,
} from "@/components/contact-profile/shared";
import { ActivityTimeline } from "@/components/contact-profile/ActivityTimeline";
import {
  DeleteContactDialog,
  OpportunityFormDialog,
  GalleryPickerDialog,
  CreateCustomFieldDialog as FullCreateCustomFieldDialog,
  NoteAddDropdown,
  AddLeadDialog,
} from "@/components/contact-profile/sub-dialogs";

// ─── Types ─────────────────────────────────────────────────────────────

interface Contact {
  id: string | number;
  full_name?: string;
  first_name?: string;
  last_name?: string;
  title?: string;
  gender?: string;
  language?: string;
  locale?: string;
  timezone?: string;
  source?: string;
  created_at?: string;
  company_id?: string | number | null;
}

// Localized source label — mirrors replyagent's $t("contact.source_<source>").
const SOURCE_LABELS: Record<string, string> = {
  manual: "Manual",
  whatsapp: "WhatsApp",
  imported_file: "Imported file",
  import: "Imported",
  api: "API",
  instagram: "Instagram",
  messenger: "Messenger",
  facebook: "Facebook",
  telegram: "Telegram",
  webchat: "Webchat",
  sms: "SMS",
  zapi: "WhatsApp",
};
function sourceLabel(s?: string | null): string {
  const k = String(s ?? "manual").toLowerCase();
  return SOURCE_LABELS[k] ?? k.charAt(0).toUpperCase() + k.slice(1);
}

interface ContactProfileModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contact: Contact | null;
}

// Replyagent system field catalog — mirrors `Lead.contact_types` (line 7633).
const GENDER_OPTIONS = [
  { value: "not_specified", label: "Not specified" },
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
  { value: "other", label: "Other" },
];

const PHONE_TYPE_OPTIONS = [
  { value: "work", label: "Work" },
  { value: "personal", label: "Personal" },
  { value: "other", label: "Other" },
];

// ─── Sub-component: editable single-line field with edit-in-place ─────

interface EditableFieldProps {
  label: string;
  value: string | null | undefined;
  placeholder?: string;
  onSave: (next: string) => Promise<void> | void;
  multiline?: boolean;
  saving?: boolean;
  disabled?: boolean;
}

function EditableField({
  label,
  value,
  placeholder = "Click to add",
  onSave,
  multiline = false,
  saving = false,
  disabled = false,
}: EditableFieldProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? "");

  useEffect(() => {
    if (!editing) setDraft(value ?? "");
  }, [value, editing]);

  if (editing && !disabled) {
    return (
      <div className="flex items-start gap-2">
        {multiline ? (
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={placeholder}
            className="min-w-0 flex-1"
            autoFocus
          />
        ) : (
          <Input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={placeholder}
            className="min-w-0 flex-1"
            autoFocus
          />
        )}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => {
            setEditing(false);
            setDraft(value ?? "");
          }}
          disabled={saving}
        >
          <X className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={async () => {
            await onSave(draft);
            setEditing(false);
          }}
          disabled={saving}
        >
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Check className="h-4 w-4" />
          )}
        </Button>
      </div>
    );
  }

  return (
    <button
      type="button"
      className={`w-full cursor-pointer text-left text-sm hover:bg-muted/50 px-2 py-1 rounded ${
        disabled ? "cursor-not-allowed opacity-60" : ""
      }`}
      onClick={() => !disabled && setEditing(true)}
    >
      {value ? (
        <span>{value}</span>
      ) : (
        <span className="text-muted-foreground italic">{placeholder}</span>
      )}
    </button>
  );
}

// ─── Sub-component: left-sidebar collapsible section header ───────────

interface SidebarSectionHeaderProps {
  icon: React.ReactNode;
  label: string;
  count: number;
  onSearchToggle?: () => void;
  searching?: boolean;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  onAdd?: () => void;
  addLabel?: string;
  showAdd?: boolean;
}

function SidebarSectionHeader({
  icon,
  label,
  count,
  onSearchToggle,
  searching,
  searchValue,
  onSearchChange,
  onAdd,
  addLabel,
  showAdd = true,
}: SidebarSectionHeaderProps) {
  return (
    <div className="flex items-center border-b">
      <div className="flex-1 flex items-center gap-2 px-3 py-2">
        {searching ? (
          <Input
            value={searchValue ?? ""}
            onChange={(e) => onSearchChange?.(e.target.value)}
            placeholder="Search..."
            className="h-7 text-xs"
            autoFocus
          />
        ) : (
          <>
            <span className="text-muted-foreground">{icon}</span>
            <span className="text-xs font-semibold uppercase tracking-wider">
              {label}
            </span>
            <span className="text-xs text-muted-foreground">{count}</span>
          </>
        )}
      </div>
      <div className="flex">
        {onSearchToggle && (
          <button
            className="px-3 py-2 border-l hover:bg-muted/50"
            onClick={onSearchToggle}
            type="button"
            aria-label={searching ? "Cancel search" : "Search"}
          >
            {searching ? (
              <X className="h-3.5 w-3.5" />
            ) : (
              <Search className="h-3.5 w-3.5" />
            )}
          </button>
        )}
        {showAdd && onAdd && (
          <button
            className="px-3 py-2 border-l hover:bg-muted/50"
            onClick={onAdd}
            type="button"
            aria-label={addLabel ?? `Add ${label}`}
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────

export default function ContactProfileModal({
  open,
  onOpenChange,
  contact,
}: ContactProfileModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const workspaceTz = useWorkspaceTimezone();

  const contactId = contact?.id ? String(contact.id) : null;

  // ─── Server state ─────────────────────────────────────────────────
  const { data: detail, isLoading } = useQuery({
    queryKey: ["/api/contacts", contactId, "profile"],
    // Silent queryFn — swallow any fetch error so the global handleApiError
    // toast doesn't fire when the modal opens with a stale / wrong contactId.
    queryFn: async () => {
      try { return await apiGet(`/api/contacts/${contactId}`); }
      catch { return null; }
    },
    enabled: !!contactId && open,
    placeholderData: contact ? { contact } : undefined,
  });

  const enriched = detail?.contact ?? null;

  // Tags list endpoint in this project is /api/tags/list (see
  // ContactsSection.tsx) — /api/tags (root GET) is not exposed and 404s with
  // "Cannot GET /tags" against the dev backend.
  const { data: tagsList } = useQuery({
    queryKey: ["/api/tags/list"],
    queryFn: () => apiGet("/api/tags/list"),
    enabled: open,
  });

  const { data: cfList } = useQuery({
    queryKey: ["/api/custom-fields"],
    queryFn: () => apiGet("/api/custom-fields"),
    enabled: open,
  });

  // Companies endpoint may not exist yet in every deploy — swallow 404 so
  // the modal still renders. Worst case the Change Company picker is empty.
  const { data: companiesList } = useQuery({
    queryKey: ["/api/companies"],
    queryFn: async () => {
      try {
        return await apiGet("/api/companies");
      } catch {
        return { companies: [] };
      }
    },
    enabled: open,
    retry: false,
  });

  // Workspace WhatsApp channels — used to start a chat from a contact's number
  // (replyagent: the "…" → send-via-channel popup on each number).
  const { data: allChannelsData } = useQuery({
    queryKey: ["/api/workspaces/all-channels"],
    queryFn: async () => {
      try {
        return await apiGet("/api/workspaces/all-channels");
      } catch {
        return { channels: {} };
      }
    },
    enabled: open,
    retry: false,
  });
  // Workspace members — used to populate the task-assignee dropdown. Only agents
  // with the `receive_tasks` permission are eligible (replyagent: getUsers() filters
  // members by $userCanDo(U.permissions, "...receive_tasks")).
  const { data: membersData } = useQuery({
    queryKey: ["/api/workspaces/members"],
    queryFn: async () => {
      try {
        return await apiGet("/api/workspaces/members");
      } catch {
        return [];
      }
    },
    enabled: open,
    retry: false,
  });
  const taskAssignees = useMemo(() => {
    const members: any[] = Array.isArray(membersData) ? membersData : (membersData?.members ?? membersData?.data ?? []);
    return members
      .filter((m: any) =>
        String(m.status).toUpperCase() === "ACTIVE" &&
        hasAnyPerm(m.permissions ?? [], ["workspace.inbox.user.can.receive_tasks"]),
      )
      .map((m: any) => ({
        id: String(m.id),
        name: (m.full_name || `${m.first_name ?? ""} ${m.last_name ?? ""}`.trim() || m.email || `User ${m.id}`),
      }));
  }, [membersData]);

  // "Hide" permission: when the agent HOLDS `contact.view_channel`, the contact's
  // channel info (Phone / WhatsApp / Email) is hidden (replyagent canSeeChannels).
  // Exact match → owners (no literal slug) keep seeing it.
  const canSeeChannels = !((getUserInfo().permissions as string[] | undefined) ?? [])
    .includes("workspace.inbox.contact.view_channel");

  // "Allow" permissions (replyagent CompanyProfile canManageCompany / canDeleteCompany)
  // — owners pass via the `workspace.*` wildcard, only restricted agents are gated.
  //  - manage → create/update contact fields (name, gender, title, channels,
  //             address/locale, custom-field VALUES, company assignment)
  //  - delete → the "Delete contact" action
  const _userPerms = (getUserInfo().permissions as string[] | undefined) ?? [];
  const canManageContacts = hasAnyPerm(_userPerms, ["workspace.company.manage"]);
  const canDeleteContacts = hasAnyPerm(_userPerms, ["workspace.company.delete"]);
  // merge → the "Merge Contacts" action (replyagent canMergeContact)
  const canMergeContacts = hasAnyPerm(_userPerms, ["workspace.company.merge"]);

  const waChannels: any[] = useMemo(
    () => allChannelsData?.channels?.whatsapp ?? [],
    [allChannelsData],
  );

  const allTags: any[] = useMemo(
    () => tagsList?.tags ?? tagsList?.data ?? [],
    [tagsList],
  );
  const allCustomFields: any[] = useMemo(
    () => cfList?.fields ?? cfList?.data ?? [],
    [cfList],
  );
  const allCompanies: any[] = useMemo(
    () => companiesList?.companies ?? companiesList?.data ?? [],
    [companiesList],
  );

  // ─── Local UI state ────────────────────────────────────────────────
  const [savingField, setSavingField] = useState<string | null>(null);

  // Left-sidebar search visibility flags (replyagent: is_searching)
  const [searchingContacts, setSearchingContacts] = useState(false);
  const [searchContacts, setSearchContacts] = useState("");
  const [searchingTasks, setSearchingTasks] = useState(false);
  const [searchTasks, setSearchTasks] = useState("");
  const [searchingOpp, setSearchingOpp] = useState(false);
  const [searchOpp, setSearchOpp] = useState("");
  // Which call's transcription is expanded (Calls sidebar section).
  const [openTranscriptId, setOpenTranscriptId] = useState<string | null>(null);
  // Inline edit mode for an existing phone/whatsapp number (replyagent: click a
  // number → c.is_editing). Holds { id, value, type } of the row being edited.
  const [editMobile, setEditMobile] = useState<{ id: string; value: string; type: string } | null>(null);

  // Sub-dialog flags
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [confirmStatusOpen, setConfirmStatusOpen] = useState(false);
  const [pendingStatus, setPendingStatus] = useState<string | null>(null);
  const [changeCompanyOpen, setChangeCompanyOpen] = useState(false);
  const [mergeContactsOpen, setMergeContactsOpen] = useState(false);
  const [newCustomFieldOpen, setNewCustomFieldOpen] = useState(false);
  const [newTagOpen, setNewTagOpen] = useState(false);
  const [editingTag, setEditingTag] = useState<any | null>(null);
  const [newTaskOpen, setNewTaskOpen] = useState(false);
  const [newOpportunityOpen, setNewOpportunityOpen] = useState(false);
  const [addPhoneOpen, setAddPhoneOpen] = useState(false);
  const [addEmailOpen, setAddEmailOpen] = useState(false);
  const [addressEditOpen, setAddressEditOpen] = useState(false);
  const [galleryOpen, setGalleryOpen] = useState(false);

  // Custom field / tag pickers
  const [customFieldPickerOpen, setCustomFieldPickerOpen] = useState(false);
  const [customFieldFilter, setCustomFieldFilter] = useState("");
  const [tagPickerOpen, setTagPickerOpen] = useState(false);
  const [tagFilter, setTagFilter] = useState("");

  // Replyagent parity additions:
  // Middle-column view tab — 'form' (lead profile) vs 'timeline' (activity).
  const [midView, setMidView] = useState<"form" | "timeline">("form");
  const [fullDeleteOpen, setFullDeleteOpen] = useState(false);
  const [fullOpportunityOpen, setFullOpportunityOpen] = useState(false);
  const [fullGalleryOpen, setFullGalleryOpen] = useState(false);
  const [fullCreateCFOpen, setFullCreateCFOpen] = useState(false);
  const [addLeadOpen, setAddLeadOpen] = useState(false);
  // Active custom field being inline-edited (from the right-panel list).
  const [activeCustomField, setActiveCustomField] = useState<any | null>(null);
  const [activeCustomFieldDraft, setActiveCustomFieldDraft] = useState<any>("");

  // ─── Mutations ─────────────────────────────────────────────────────
  const invalidateProfile = useCallback(() => {
    if (contactId) {
      queryClient.invalidateQueries({
        queryKey: ["/api/contacts", contactId, "profile"],
      });
    }
    queryClient.invalidateQueries({ queryKey: ["/api/contacts"] });
  }, [contactId, queryClient]);

  const patchContact = useMutation({
    mutationFn: (payload: Record<string, any>) =>
      apiPatch(`/api/contacts/${contactId}`, payload),
    onSuccess: () => {
      invalidateProfile();
      toast({ title: "Contact updated" });
    },
    onError: (err: any) => {
      toast({
        title: "Update failed",
        description: err?.message ?? "Could not save",
        variant: "destructive",
      });
    },
  });

  const deleteContactMutation = useMutation({
    mutationFn: () => apiDelete(`/api/contacts/${contactId}`),
    onSuccess: () => {
      toast({ title: "Contact deleted" });
      // The contact is gone — DROP its profile query (don't invalidate, which
      // would refetch a 404 and leave the modal stuck on "Contact not found").
      queryClient.removeQueries({ queryKey: ["/api/contacts", contactId, "profile"] });
      // The deleted contact's conversation (if it was the open one) no longer
      // exists. Drop the stale selection + its polling queries BEFORE navigating so
      // the inbox doesn't fire a 404 for a deleted inbox ("Inbox not found").
      try { sessionStorage.removeItem("inbox_selected_conv"); } catch {}
      queryClient.removeQueries({ queryKey: ["/api/inbox/messages"] });
      queryClient.removeQueries({ queryKey: ["/api/inbox/get-profile-data"] });
      // Refresh the views the deletion affects (contact + its chat vanish).
      queryClient.invalidateQueries({ queryKey: ["/api/inbox/list"] });
      queryClient.invalidateQueries({ queryKey: ["/api/inbox/count"] });
      queryClient.invalidateQueries({ queryKey: ["/api/contacts"] });
      // Close both the confirm dialog and the profile modal, then land on the inbox.
      setConfirmDeleteOpen(false);
      onOpenChange(false);
      setLocation("/conversations/inbox");
    },
    onError: (err: any) => {
      toast({ title: "Delete failed", description: err?.message ?? "", variant: "destructive" });
    },
  });

  const changeStatusMutation = useMutation({
    mutationFn: (action: string) =>
      apiPost(`/api/contacts/${contactId}/change-status`, { action }),
    onSuccess: () => {
      toast({ title: "Status updated" });
      invalidateProfile();
      setConfirmStatusOpen(false);
      setPendingStatus(null);
    },
  });

  const removeFieldMutation = useMutation({
    mutationFn: (payload: { field: any; type: string }) =>
      apiPost(`/api/contacts/${contactId}/remove-field`, payload),
    onSuccess: () => {
      toast({ title: "Field removed" });
      invalidateProfile();
    },
  });

  const setPrimaryMutation = useMutation({
    mutationFn: (payload: {
      field_id: string;
      field_type: "mobile" | "email";
      mark_primary: boolean;
    }) => apiPost(`/api/contacts/${contactId}/primary`, payload),
    onSuccess: (_, vars) => {
      toast({
        title: vars.mark_primary ? "Marked as primary" : "Removed primary",
      });
      invalidateProfile();
    },
  });

  const unsubscribeMutation = useMutation({
    mutationFn: (optin_id: string) =>
      apiPost(`/api/contacts/${contactId}/unsubscribe`, { optin_id }),
    onSuccess: () => {
      toast({ title: "Unsubscribed" });
      invalidateProfile();
    },
  });

  // Opt a contact's number in/out of a workspace WhatsApp number (replyagent:
  // changeContactOptin → POST /contact/optin/:slug). channel = workspace number,
  // phone_number = the contact's mobile field, action = 'optin' | 'optout'.
  const optinMutation = useMutation({
    mutationFn: (payload: {
      channel: any;
      phone_number: any;
      channel_type: string;
      action: "optin" | "optout";
    }) => apiPost(`/api/contacts/${contactId}/optin`, payload),
    onSuccess: (_, vars) => {
      toast({ title: vars.action === "optin" ? "Opted in" : "Opted out" });
      invalidateProfile();
    },
    onError: (err: any) =>
      toast({ title: "Couldn't update opt-in", description: err?.message ?? "", variant: "destructive" }),
  });

  // Save an inline edit to an existing phone/whatsapp number's value/type
  // (replyagent: number edit-mode → check button).
  const updateMobileMutation = useMutation({
    mutationFn: (payload: { id: string; value: string; type: string }) =>
      apiPatch(`/api/contacts/${contactId}`, { update_mobile: payload }),
    onSuccess: () => {
      toast({ title: "Number updated" });
      setEditMobile(null);
      invalidateProfile();
    },
    onError: (err: any) =>
      toast({ title: "Update failed", description: err?.message ?? "", variant: "destructive" }),
  });

  // Is this contact-mobile opted in for a given workspace WhatsApp number?
  // Mirrors replyagent isOpted(number, c.optins): an optin row whose channel
  // matches and modelable_id === the workspace number id.
  const isWaOpted = (field: any, channel: any) =>
    Array.isArray(field?.optins) &&
    field.optins.some(
      (o: any) => o.channel === "whatsapp" && String(o.modelable_id) === String(channel.id),
    );

  // Toggle opt-in for (contact mobile field, workspace number).
  const toggleOptin = (field: any, channel: any, checked: boolean) => {
    optinMutation.mutate({
      channel: { id: String(channel.id) },
      phone_number: { object_id: String(field.id) },
      channel_type: "whatsapp",
      action: checked ? "optin" : "optout",
    });
  };

  const changeCompanyMutation = useMutation({
    mutationFn: (company_id: string | null) =>
      apiPost(`/api/contacts/${contactId}/change-company`, { company_id }),
    onSuccess: () => {
      toast({ title: "Company updated" });
      invalidateProfile();
      setChangeCompanyOpen(false);
    },
  });

  const createCustomFieldMutation = useMutation({
    mutationFn: (payload: any) => apiPost(`/api/custom-fields/field`, payload),
    onSuccess: () => {
      toast({ title: "Custom field created" });
      queryClient.invalidateQueries({ queryKey: ["/api/custom-fields"] });
      setNewCustomFieldOpen(false);
    },
    onError: (err: any) => {
      toast({
        title: "Create failed",
        description: err?.message ?? "Could not create",
        variant: "destructive",
      });
    },
  });

  const createTagMutation = useMutation({
    mutationFn: (payload: any) => apiPost(`/api/tags`, payload),
    onSuccess: () => {
      toast({ title: "Tag created" });
      queryClient.invalidateQueries({ queryKey: ["/api/tags/list"] });
      setNewTagOpen(false);
    },
  });

  const applyTagMutation = useMutation({
    mutationFn: (tagName: string) => {
      const currentTags = (enriched?.tags ?? []) as string[];
      const next = Array.from(new Set([...currentTags, tagName]));
      return apiPatch(`/api/contacts/${contactId}`, { tags: next });
    },
    onSuccess: () => {
      toast({ title: "Tag added" });
      invalidateProfile();
      setTagPickerOpen(false);
    },
  });

  const removeTagMutation = useMutation({
    mutationFn: (tagName: string) => {
      const currentTags = (enriched?.tags ?? []) as string[];
      const next = currentTags.filter((t) => t !== tagName);
      return apiPatch(`/api/contacts/${contactId}`, { tags: next });
    },
    onSuccess: () => {
      toast({ title: "Tag removed" });
      invalidateProfile();
    },
  });

  // Workspace-level management (replyagent CustomField/Tag delete + edit). These
  // affect the whole workspace, so callers confirm before invoking delete.
  const deleteCustomFieldMutation = useMutation({
    mutationFn: (slug: string) => apiDelete(`/api/custom-fields/field/${slug}`),
    onSuccess: () => {
      toast({ title: "Custom field deleted" });
      queryClient.invalidateQueries({ queryKey: ["/api/custom-fields"] });
      invalidateProfile();
    },
    onError: (err: any) =>
      toast({ title: "Delete failed", description: err?.message, variant: "destructive" }),
  });

  const deleteTagMutation = useMutation({
    mutationFn: (id: string) => apiDelete(`/api/tags/${id}`),
    onSuccess: () => {
      toast({ title: "Tag deleted" });
      queryClient.invalidateQueries({ queryKey: ["/api/tags/list"] });
      invalidateProfile();
    },
    onError: (err: any) =>
      toast({ title: "Delete failed", description: err?.message, variant: "destructive" }),
  });

  const updateTagMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: any }) =>
      apiPatch(`/api/tags/${id}`, payload),
    onSuccess: () => {
      toast({ title: "Tag updated" });
      queryClient.invalidateQueries({ queryKey: ["/api/tags/list"] });
      invalidateProfile();
      setNewTagOpen(false);
      setEditingTag(null);
    },
    onError: (err: any) =>
      toast({ title: "Update failed", description: err?.message, variant: "destructive" }),
  });

  const createTaskMutation = useMutation({
    mutationFn: (payload: any) => {
      // The backend expects `date` + `time` separately (it combines them in the
      // workspace timezone). The dialog provides a single datetime-local string
      // ("YYYY-MM-DDTHH:mm") — split it so task creation actually succeeds.
      const dt = String(payload.datetime ?? "");
      const [date, time] = dt.includes("T") ? dt.split("T") : [dt, ""];
      return apiPost(`/api/tasks`, {
        description: payload.description,
        date,
        time,
        user_id: payload.user_id || null,
        contact_id: contactId,
      });
    },
    onSuccess: () => {
      toast({ title: "Task created" });
      invalidateProfile();
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      setNewTaskOpen(false);
    },
  });

  const createOpportunityMutation = useMutation({
    mutationFn: (payload: any) =>
      apiPost(`/api/opportunities`, { ...payload, contact_id: contactId }),
    onSuccess: () => {
      toast({ title: "Opportunity created" });
      invalidateProfile();
      setNewOpportunityOpen(false);
    },
    onError: (err: any) => {
      toast({
        title: "Create failed",
        description: err?.message ?? "Could not create opportunity",
        variant: "destructive",
      });
      setNewOpportunityOpen(false);
    },
  });

  // ─── Derived: filtered lists ───────────────────────────────────────
  const tasks: any[] = enriched?.tasks ?? [];
  const bookings: any[] = enriched?.bookings ?? [];
  const calls: any[] = enriched?.calls ?? [];
  const adClicks: any[] = enriched?.ad_clicks ?? [];
  const companyContacts: any[] = enriched?.company_contacts ?? [];
  const phones: any[] = enriched?.phones ?? [];
  const whatsapps: any[] = enriched?.whatsapps ?? [];
  const emails: any[] = enriched?.emails ?? [];
  const tags: string[] = enriched?.tags ?? [];
  const counts = enriched?.counts ?? {
    tasks: 0,
    bookings: 0,
    calls: 0,
    ad_clicks: 0,
    opportunities: 0,
    groups: 0,
  };

  const filteredTasks = useMemo(() => {
    if (!searchTasks) return tasks;
    const q = searchTasks.toLowerCase();
    return tasks.filter(
      (t) =>
        (t.description ?? "").toLowerCase().includes(q) ||
        (t.assignee_name ?? "").toLowerCase().includes(q),
    );
  }, [tasks, searchTasks]);

  // Opportunities search filter (replyagent filterOpportunity — by contact name / title).
  const opportunities: any[] = enriched?.opportunities ?? [];
  const filteredOpps = useMemo(() => {
    if (!searchOpp) return opportunities;
    const q = searchOpp.toLowerCase();
    return opportunities.filter(
      (o) =>
        (o.name ?? o.title ?? "").toLowerCase().includes(q) ||
        (o.contact_name ?? o.contact?.full_name ?? "").toLowerCase().includes(q) ||
        (o.pipeline_step_name ?? "").toLowerCase().includes(q),
    );
  }, [opportunities, searchOpp]);

  const fullName = enriched?.full_name
    ? enriched.full_name
    : `${enriched?.first_name ?? ""} ${enriched?.last_name ?? ""}`.trim() ||
      "Unnamed";
  const initials = fullName
    .split(/\s+/)
    .map((p: string) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || "?";

  // ─── Handlers ──────────────────────────────────────────────────────
  const handleSavePatch = async (
    field: string,
    payload: Record<string, any>,
  ) => {
    setSavingField(field);
    try {
      await patchContact.mutateAsync(payload);
    } finally {
      setSavingField(null);
    }
  };

  const handleDownloadContactData = async () => {
    if (!enriched) return;
    const blob = new Blob([JSON.stringify(enriched, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `contact-${contactId}-data.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: "Download started" });
  };

  const handleDownloadConversation = async () => {
    if (!contactId) return;
    try {
      const resp = await apiGet(
        `/api/contacts/${contactId}/download-conversation`,
      );
      const blob = new Blob([resp.text ?? ""], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = resp.filename ?? `contact-${contactId}-conversation.txt`;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: "Conversation downloaded" });
    } catch (err: any) {
      toast({
        title: "Download failed",
        description: err?.message ?? "",
        variant: "destructive",
      });
    }
  };

  const handleOpenConversationHistory = () => {
    setLocation(`/conversations/conversation-logs?contact_id=${contactId}`);
    onOpenChange(false);
  };

  // ─── Per-item actions for OTHER contacts in the company list (replyagent
  // Lead.* menu). These take an explicit id so they act on the clicked contact,
  // not the currently-open one. Change-company / merge stay on the contact's own
  // header (open it first) since those flows are scoped to the open contact.
  const openCompanyContact = (id: string) => {
    onOpenChange(false);
    setLocation(`/contacts?open=${id}`);
  };

  const downloadContactDataById = async (id: string) => {
    try {
      const resp = await apiGet(`/api/contacts/${id}`);
      const data = resp?.contact ?? resp;
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `contact-${id}-data.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: "Download started" });
    } catch (err: any) {
      toast({ title: "Download failed", description: err?.message ?? "", variant: "destructive" });
    }
  };

  const downloadConversationById = async (id: string) => {
    try {
      const resp = await apiGet(`/api/contacts/${id}/download-conversation`);
      const blob = new Blob([resp.text ?? ""], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = resp.filename ?? `contact-${id}-conversation.txt`;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: "Conversation downloaded" });
    } catch (err: any) {
      toast({ title: "Download failed", description: err?.message ?? "", variant: "destructive" });
    }
  };

  const deleteCompanyContactById = async (id: string, name: string) => {
    if (!window.confirm(`Delete contact "${name}"? This cannot be undone.`)) return;
    try {
      await apiDelete(`/api/contacts/${id}`);
      invalidateProfile();
      toast({ title: "Contact deleted" });
    } catch (err: any) {
      toast({ title: "Delete failed", description: err?.message ?? "", variant: "destructive" });
    }
  };

  // Start a WhatsApp conversation from this contact via the chosen workspace
  // channel, then jump to the inbox (replyagent createWhatsappChat).
  const startWhatsappChat = async (waNumberId: string) => {
    if (!contactId) return;
    try {
      const resp = await apiPost("/api/inbox/start-whatsapp-chat", {
        contact_id: contactId,
        wa_number_id: waNumberId,
      });
      onOpenChange(false);
      const inboxId = resp?.inbox_id;
      setLocation(inboxId ? `/conversations/inbox?inbox=${inboxId}` : "/conversations/inbox");
      toast({ title: "Chat opened" });
    } catch (err: any) {
      toast({ title: "Couldn't start chat", description: err?.message ?? "", variant: "destructive" });
    }
  };

  const handleOpenGallery = () => {
    setLocation(
      `/settings/workspace/ManageSection?tab=Media%20Gallery&contact_id=${contactId}`,
    );
    onOpenChange(false);
  };

  // ─── Render ────────────────────────────────────────────────────────
  if (!contact) return null;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          className="max-w-[1400px] w-[95vw] h-[90vh] p-0 overflow-hidden flex flex-col"
          aria-describedby={undefined}
          hideClose
        >
          <DialogTitle className="sr-only">Contact Profile</DialogTitle>

          {/* ───── Header (replyagent CompanyProfile top bar) ───── */}
          <div className="border-b px-6 py-3 flex items-center gap-3 shrink-0">
            {/* Left: source (magnet + localized label, source_name tooltip) + "on <date>" */}
            <div className="flex items-center gap-2 text-sm text-muted-foreground min-w-0">
              {enriched?.source_name ? (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="flex items-center gap-1 font-semibold text-foreground cursor-default">
                        <Magnet className="h-4 w-4" />
                        {sourceLabel(enriched?.source)}
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>{enriched.source_name}</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              ) : (
                <span className="flex items-center gap-1 font-semibold text-foreground">
                  <Magnet className="h-4 w-4" />
                  {sourceLabel(enriched?.source)}
                </span>
              )}
              {enriched?.created_at && (
                <span className="text-xs">
                  on {formatInWorkspaceTz(enriched.created_at, "yyyy-MM-dd HH:mm", workspaceTz)}
                </span>
              )}
            </div>

            <div className="flex-1" />

            {/* Right: pending tag · delete (red) · contact id · history */}
            {String(enriched?.status) === "PENDING" && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="rounded-md bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400 text-[11px] font-bold px-2.5 py-0.5 cursor-default">
                      Pending
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>This contact is pending</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
            {canDeleteContacts && String(enriched?.status ?? "ACTIVE") === "ACTIVE" && (
              <button
                onClick={() => setConfirmDeleteOpen(true)}
                className="rounded-md bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-400 text-[11px] font-bold px-3 py-0.5 hover:bg-rose-200 dark:hover:bg-rose-500/25 transition-colors"
              >
                Delete contact
              </button>
            )}
            {contactId && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="flex items-center gap-1 text-xs text-muted-foreground cursor-default">
                      <KeyRound className="h-3.5 w-3.5" />
                      {contactId}
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>Contact ID</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>

          {/* ───── Body ───── */}
          <div className="flex-1 grid grid-cols-12 overflow-hidden">
            {/* ── LEFT SIDEBAR ── */}
            <div className="col-span-3 border-r bg-muted/20 flex flex-col overflow-hidden">
              {/* Contact summary card */}
              <div className="p-4 border-b">
                <div className="flex items-start gap-3">
                  <Avatar className="h-12 w-12">
                    <AvatarFallback
                      className={`${getAvatarColor(fullName)} text-white text-base font-semibold`}
                    >
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1">
                      <h3 className="font-semibold text-base truncate">
                        {fullName}
                      </h3>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-6 w-6">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="w-52">
                          {canManageContacts && (
                            <DropdownMenuItem
                              onClick={() => setChangeCompanyOpen(true)}
                            >
                              <Repeat className="h-4 w-4 mr-2" />
                              Change company
                            </DropdownMenuItem>
                          )}
                          {canMergeContacts && (
                            <DropdownMenuItem
                              onClick={() => setMergeContactsOpen(true)}
                            >
                              <GitMerge className="h-4 w-4 mr-2" />
                              Merge Contacts
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem onClick={handleDownloadContactData}>
                            <Download className="h-4 w-4 mr-2" />
                            Contact data
                          </DropdownMenuItem>
                          {canDeleteContacts && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => setConfirmDeleteOpen(true)}
                                className="text-destructive"
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Delete
                              </DropdownMenuItem>
                            </>
                          )}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={handleDownloadConversation}>
                            <MessageSquare className="h-4 w-4 mr-2" />
                            Conversation history
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {enriched?.title ?? "Add description, URL,"}
                    </p>
                    {enriched?.support_number_task && (
                      <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                        <span>♂</span>
                        <span>{enriched.support_number_task}</span>
                      </div>
                    )}
                    {contactId && (
                      <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                        <KeyRound className="h-3 w-3" />
                        <span>{contactId}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Scrollable sections list */}
              <ScrollArea className="flex-1">
                {/* CONTACTS */}
                <SidebarSectionHeader
                  icon={<UserIcon className="h-3.5 w-3.5" />}
                  label="Contacts"
                  count={1 + companyContacts.length}
                  searching={searchingContacts}
                  onSearchToggle={() => setSearchingContacts((v) => !v)}
                  searchValue={searchContacts}
                  onSearchChange={setSearchContacts}
                  showAdd={canManageContacts}
                  onAdd={() => setAddLeadOpen(true)}
                />
                <div className="px-3 py-2 space-y-1">
                  {/* Current contact — always shown */}
                  <div className="flex items-center gap-2 bg-primary/10 rounded px-2 py-1.5">
                    <Avatar className="h-6 w-6">
                      <AvatarFallback
                        className={`${getAvatarColor(fullName)} text-white text-[10px]`}
                      >
                        {initials}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-xs font-medium flex-1 truncate">
                      {fullName}
                    </span>
                  </div>
                  {/* Other contacts in the same company */}
                  {companyContacts
                    .filter((c) =>
                      !searchContacts ||
                      (c.full_name ?? "").toLowerCase().includes(searchContacts.toLowerCase())
                    )
                    .map((c: any) => {
                      const n = c.full_name || "Unnamed";
                      const ini = n.split(/\s+/).map((p: string) => p[0]).join("").slice(0, 2).toUpperCase() || "?";
                      return (
                        <div
                          key={c.id}
                          className="group flex items-center gap-2 rounded px-2 py-1.5 hover:bg-muted/50"
                        >
                          <Avatar className="h-6 w-6">
                            <AvatarFallback
                              className={`${getAvatarColor(n)} text-white text-[10px]`}
                            >
                              {ini}
                            </AvatarFallback>
                          </Avatar>
                          <button
                            type="button"
                            title="Open contact"
                            onClick={() => openCompanyContact(String(c.id))}
                            className="text-xs flex-1 truncate text-left"
                          >
                            {n}
                          </button>
                          <button
                            type="button"
                            title="Open contact"
                            onClick={() => openCompanyContact(String(c.id))}
                            className="hover:text-primary shrink-0"
                          >
                            <ExternalLink className="h-3 w-3 text-muted-foreground" />
                          </button>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button type="button" className="hover:text-foreground shrink-0">
                                <MoreHorizontal className="h-3.5 w-3.5 text-muted-foreground" />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48">
                              <DropdownMenuItem onClick={() => openCompanyContact(String(c.id))}>
                                <ExternalLink className="h-3.5 w-3.5 mr-2" />
                                Open contact
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => downloadContactDataById(String(c.id))}>
                                <Download className="h-3.5 w-3.5 mr-2" />
                                Contact data
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => downloadConversationById(String(c.id))}>
                                <MessageSquare className="h-3.5 w-3.5 mr-2" />
                                Conversation history
                              </DropdownMenuItem>
                              {canDeleteContacts && (
                                <>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    className="text-destructive"
                                    onClick={() => deleteCompanyContactById(String(c.id), n)}
                                  >
                                    <Trash2 className="h-3.5 w-3.5 mr-2" />
                                    Delete
                                  </DropdownMenuItem>
                                </>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      );
                    })}
                </div>

                {/* TASKS */}
                <SidebarSectionHeader
                  icon={<ClipboardList className="h-3.5 w-3.5" />}
                  label="Tasks"
                  count={counts.tasks ?? 0}
                  searching={searchingTasks}
                  onSearchToggle={() => setSearchingTasks((v) => !v)}
                  searchValue={searchTasks}
                  onSearchChange={setSearchTasks}
                  onAdd={() => setNewTaskOpen(true)}
                />
                <div className="px-3 py-2 space-y-1">
                  {filteredTasks.length === 0 ? (
                    <p className="text-xs text-muted-foreground italic">
                      No tasks
                    </p>
                  ) : (
                    filteredTasks.map((t) => (
                      <div
                        key={String(t.id)}
                        className="flex items-center gap-2 text-xs px-2 py-1.5 hover:bg-muted/50 rounded"
                      >
                        {t.assignee_initials && (
                          <Avatar className="h-5 w-5">
                            <AvatarFallback className="text-[9px] bg-primary text-primary-foreground">
                              {t.assignee_initials}
                            </AvatarFallback>
                          </Avatar>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="truncate font-medium">
                            {t.description ?? "Task"}
                          </p>
                          {t.datetime && (
                            <p className="text-muted-foreground">
                              {formatInWorkspaceTz(t.datetime, "MMM d, HH:mm", workspaceTz)}
                            </p>
                          )}
                        </div>
                        <button
                          type="button"
                          title="Mark complete"
                          className="hover:text-emerald-600"
                          onClick={async (e) => {
                            e.stopPropagation();
                            try {
                              await apiPost(`/api/tasks/${t.id}/complete`, {
                                status: "COMPLETED",
                              }).catch(() =>
                                apiPatch(`/api/tasks/${t.id}`, {
                                  status: "COMPLETED",
                                }),
                              );
                              invalidateProfile();
                              toast({ title: "Task completed" });
                            } catch (err: any) {
                              toast({
                                title: "Failed",
                                description: err?.message,
                                variant: "destructive",
                              });
                            }
                          }}
                        >
                          <CheckSquare className="h-3.5 w-3.5 text-muted-foreground" />
                        </button>
                        <button
                          type="button"
                          title="Snooze"
                          className="hover:text-amber-600"
                          onClick={async (e) => {
                            e.stopPropagation();
                            try {
                              const next = new Date();
                              next.setHours(next.getHours() + 1);
                              await apiPatch(`/api/tasks/${t.id}`, {
                                datetime: next.toISOString(),
                              });
                              invalidateProfile();
                              toast({ title: "Snoozed 1h" });
                            } catch (err: any) {
                              toast({
                                title: "Failed",
                                description: err?.message,
                                variant: "destructive",
                              });
                            }
                          }}
                        >
                          <AlarmClock className="h-3.5 w-3.5 text-muted-foreground" />
                        </button>
                      </div>
                    ))
                  )}
                </div>

                {/* OPPORTUNITIES */}
                <SidebarSectionHeader
                  icon={<BarChart3 className="h-3.5 w-3.5" />}
                  label="Opportunities"
                  count={counts.opportunities ?? 0}
                  searching={searchingOpp}
                  onSearchToggle={() => setSearchingOpp((v) => !v)}
                  searchValue={searchOpp}
                  onSearchChange={setSearchOpp}
                  onAdd={() => setFullOpportunityOpen(true)}
                />
                <div className="px-3 py-2 space-y-1">
                  {filteredOpps.length === 0 ? (
                    <p className="text-xs text-muted-foreground italic">
                      No opportunities
                    </p>
                  ) : (
                    filteredOpps.map((o: any) => (
                      <div
                        key={String(o.id)}
                        className="flex items-center gap-2 text-xs px-2 py-1.5 hover:bg-muted/50 rounded"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="truncate font-medium">
                            {o.name ?? o.title ?? `Opportunity #${o.id}`}
                          </p>
                          <p className="text-muted-foreground">
                            {o.currency ?? ""} {o.amount ?? o.value ?? 0}
                            {o.pipeline_step_name
                              ? ` • ${o.pipeline_step_name}`
                              : ""}
                          </p>
                        </div>
                        <button
                          type="button"
                          title="Open"
                          className="hover:text-primary"
                          onClick={() => setFullOpportunityOpen(true)}
                        >
                          <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
                        </button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button
                              type="button"
                              className="hover:text-foreground"
                            >
                              <MoreHorizontal className="h-3.5 w-3.5 text-muted-foreground" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent>
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={async () => {
                                try {
                                  await apiDelete(
                                    `/api/pipelines/opportunities/${o.id}`,
                                  );
                                  invalidateProfile();
                                  toast({ title: "Opportunity deleted" });
                                } catch (err: any) {
                                  toast({
                                    title: "Delete failed",
                                    description: err?.message,
                                    variant: "destructive",
                                  });
                                }
                              }}
                            >
                              <Trash2 className="h-3.5 w-3.5 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    ))
                  )}
                </div>

                {/* BOOKINGS */}
                <SidebarSectionHeader
                  icon={<Calendar className="h-3.5 w-3.5" />}
                  label="Bookings"
                  count={counts.bookings ?? 0}
                  showAdd={false}
                />
                <div className="px-3 py-2 space-y-1">
                  {bookings.length === 0 ? (
                    <p className="text-xs text-muted-foreground italic">
                      No bookings
                    </p>
                  ) : (
                    bookings.map((b) => (
                      <div
                        key={String(b.id)}
                        className="text-xs px-2 py-1.5 hover:bg-muted/50 rounded"
                      >
                        <p className="font-medium truncate">{b.title}</p>
                        {b.start && (
                          <p className="text-muted-foreground">
                            {formatInWorkspaceTz(b.start, "MMM d, yyyy HH:mm", workspaceTz)}
                          </p>
                        )}
                      </div>
                    ))
                  )}
                </div>

                {/* CALLS */}
                <SidebarSectionHeader
                  icon={<PhoneIcon className="h-3.5 w-3.5" />}
                  label="Calls"
                  count={counts.calls ?? 0}
                  showAdd={false}
                />
                <div className="px-3 py-2 space-y-1">
                  {calls.length === 0 ? (
                    <p className="text-xs text-muted-foreground italic">
                      No call logs
                    </p>
                  ) : (
                    calls.map((c: any) => (
                      <div
                        key={String(c.id)}
                        className="text-xs px-2 py-1.5 hover:bg-muted/50 rounded"
                      >
                        <div className="flex items-center gap-2">
                          <PhoneIcon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="truncate font-medium">
                              {c.call_type === "outbound" ? `To: ${c.to_number}` : `From: ${c.from_number}`}
                            </p>
                            <p className="text-muted-foreground">
                              {c.call_duration ? `${c.call_duration}s` : "—"}
                              {c.created_at ? ` · ${formatInWorkspaceTz(c.created_at, "MMM d, HH:mm", workspaceTz)}` : ""}
                            </p>
                          </div>
                          {c.transcription && (
                            <button
                              type="button"
                              title="Show transcription"
                              className="hover:text-primary shrink-0"
                              onClick={() =>
                                setOpenTranscriptId((id) =>
                                  id === String(c.id) ? null : String(c.id),
                                )
                              }
                            >
                              <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                            </button>
                          )}
                          <span
                            className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                              c.status === "success" || c.status === "completed"
                                ? "bg-emerald-100 text-emerald-700"
                                : "bg-amber-100 text-amber-700"
                            }`}
                          >
                            {c.status ?? "—"}
                          </span>
                        </div>
                        {c.transcription && openTranscriptId === String(c.id) && (
                          <p className="mt-1 ml-5 text-muted-foreground whitespace-pre-wrap border-l-2 border-border pl-2">
                            {c.transcription}
                          </p>
                        )}
                      </div>
                    ))
                  )}
                </div>

                {/* AD CLICKS */}
                <SidebarSectionHeader
                  icon={<MousePointerClick className="h-3.5 w-3.5" />}
                  label="Ad Clicks"
                  count={counts.ad_clicks ?? 0}
                  showAdd={false}
                />
                <div className="px-3 py-2 space-y-1">
                  {adClicks.length === 0 ? (
                    <p className="text-xs text-muted-foreground italic">
                      No ad clicks
                    </p>
                  ) : (
                    adClicks.map((r: any) => (
                      <div
                        key={String(r.id)}
                        className="text-xs px-2 py-1.5 hover:bg-muted/50 rounded border border-border"
                      >
                        <p className="font-medium truncate">
                          {r.title || r.ad_id || "Ad click"}
                          {r.ad_id && r.title ? (
                            <span className="text-muted-foreground ml-1">#{r.ad_id}</span>
                          ) : null}
                        </p>
                        {r.subtitle && (
                          <p className="text-muted-foreground truncate">{r.subtitle}</p>
                        )}
                        {r.created_at && (
                          <p className="text-muted-foreground">
                            {formatInWorkspaceTz(r.created_at, "MMM d, yyyy HH:mm", workspaceTz)}
                          </p>
                        )}
                      </div>
                    ))
                  )}
                </div>

                {/* GROUPS */}
                <SidebarSectionHeader
                  icon={<Users className="h-3.5 w-3.5" />}
                  label="Groups"
                  count={counts.groups ?? 0}
                  showAdd={false}
                />
                <div className="px-3 py-2">
                  <p className="text-xs text-muted-foreground italic">
                    Not in any groups
                  </p>
                </div>
              </ScrollArea>
            </div>

            {/* ── MIDDLE COLUMN: lead form / activity timeline ── */}
            <div className="col-span-6 overflow-hidden flex flex-col">
              <ScrollArea className="flex-1 px-8 py-6">
                {!enriched ? (
                  <div className="flex items-center justify-center h-64">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <div className="space-y-6 max-w-2xl">
                    {/* Contact picture */}
                    <FieldRow label="Contact picture">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-12 w-12">
                          <AvatarFallback
                            className={`${getAvatarColor(fullName)} text-white`}
                          >
                            {initials}
                          </AvatarFallback>
                        </Avatar>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="outline"
                                size="icon"
                                onClick={() => setFullGalleryOpen(true)}
                              >
                                <ImageIcon className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Open gallery</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                    </FieldRow>

                    <Separator />

                    {/* First Name */}
                    <FieldRow label="First Name">
                      <EditableField
                        label="First Name"
                        value={enriched.first_name}
                        placeholder="Add first name"
                        saving={savingField === "first_name"}
                        disabled={!canManageContacts}
                        onSave={(v) =>
                          handleSavePatch("first_name", { first_name: v })
                        }
                      />
                    </FieldRow>

                    <Separator />

                    {/* Last Name */}
                    <FieldRow label="Last Name">
                      <EditableField
                        label="Last Name"
                        value={enriched.last_name}
                        placeholder="Add last name"
                        saving={savingField === "last_name"}
                        disabled={!canManageContacts}
                        onSave={(v) =>
                          handleSavePatch("last_name", { last_name: v })
                        }
                      />
                    </FieldRow>

                    <Separator />

                    {/* Gender */}
                    <FieldRow label="Gender">
                      <Select
                        value={enriched.gender ?? "not_specified"}
                        disabled={!canManageContacts}
                        onValueChange={(v) =>
                          handleSavePatch("gender", {
                            field: { slug: "gender", value: v },
                            field_type: "SYSTEM_FIELD",
                          })
                        }
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {GENDER_OPTIONS.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FieldRow>

                    <Separator />

                    {/* Title */}
                    <FieldRow label="Title">
                      <EditableField
                        label="Title"
                        value={enriched.title}
                        placeholder="Add title"
                        saving={savingField === "title"}
                        disabled={!canManageContacts}
                        onSave={(v) =>
                          handleSavePatch("title", { title: v })
                        }
                      />
                    </FieldRow>

                    <Separator />

                    {/* Phone / WhatsApp / Email — hidden when the agent holds
                        `contact.view_channel` (replyagent canSeeChannels). */}
                    {canSeeChannels && (
                      <>
                    {/* Phone numbers */}
                    <FieldRow
                      label="Phone"
                      icon={<PhoneIcon className="h-4 w-4 text-emerald-600" />}
                      actionRight={
                        canManageContacts ? (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setAddPhoneOpen(true)}
                          >
                            <Plus className="h-4 w-4" />
                          </Button>
                        ) : undefined
                      }
                    >
                      <div className="space-y-2">
                        {phones.length === 0 ? (
                          <span className="text-sm text-muted-foreground italic">
                            No phone numbers
                          </span>
                        ) : (
                          phones.map((p) => (
                            <div
                              key={p.id}
                              className="flex items-center gap-2 text-sm"
                            >
                              <span>{p.full_mobile_number}</span>
                              {["work", "personal", "other"].includes(String(p.type)) && (
                                <span className="text-[10px] text-muted-foreground capitalize">
                                  ({p.type})
                                </span>
                              )}
                              {p.is_primary && (
                                <span className="rounded-full border border-green-600/30 bg-green-50 dark:bg-green-500/10 text-green-600 dark:text-green-400 text-[10px] px-3 py-[2px]">
                                  Primary
                                </span>
                              )}
                              {p.opted_in && (
                                <span className="rounded-full border border-green-600/30 bg-green-50 dark:bg-green-500/10 text-green-600 dark:text-green-400 text-[10px] px-3 py-[2px]">
                                  Opted In
                                </span>
                              )}
                              {p.opted_in && p.optin_id && (
                                <button
                                  onClick={() => unsubscribeMutation.mutate(String(p.optin_id))}
                                  className="rounded-full border border-red-600/30 bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 text-[10px] px-3 py-[2px] hover:bg-red-100 dark:hover:bg-red-500/20 transition-colors"
                                >
                                  Unsubscribe
                                </button>
                              )}
                              {canManageContacts && (
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6 ml-auto"
                                  >
                                    <MoreHorizontal className="h-3.5 w-3.5" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent>
                                  {!p.is_primary && (
                                    <DropdownMenuItem
                                      onClick={() =>
                                        setPrimaryMutation.mutate({
                                          field_id: String(p.id),
                                          field_type: "mobile",
                                          mark_primary: true,
                                        })
                                      }
                                    >
                                      <Check className="h-4 w-4 mr-2" />
                                      Mark primary
                                    </DropdownMenuItem>
                                  )}
                                  {p.is_primary && (
                                    <DropdownMenuItem
                                      onClick={() =>
                                        setPrimaryMutation.mutate({
                                          field_id: String(p.id),
                                          field_type: "mobile",
                                          mark_primary: false,
                                        })
                                      }
                                    >
                                      <X className="h-4 w-4 mr-2" />
                                      Unmark primary
                                    </DropdownMenuItem>
                                  )}
                                  {p.opted_in && p.optin_id && (
                                    <DropdownMenuItem
                                      onClick={() => unsubscribeMutation.mutate(String(p.optin_id))}
                                    >
                                      <X className="h-4 w-4 mr-2" />
                                      Unsubscribe
                                    </DropdownMenuItem>
                                  )}
                                  <DropdownMenuItem
                                    onClick={() =>
                                      removeFieldMutation.mutate({
                                        field: { slug: "mobile", object_id: p.id },
                                        type: "contact",
                                      })
                                    }
                                    className="text-destructive"
                                  >
                                    <Trash2 className="h-4 w-4 mr-2" />
                                    Remove
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                              )}
                            </div>
                          ))
                        )}
                      </div>
                    </FieldRow>

                    <Separator />

                    {/* WhatsApp */}
                    <FieldRow
                      label="WhatsApp"
                      icon={<MessageSquare className="h-4 w-4 text-emerald-600" />}
                      actionRight={
                        canManageContacts ? (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setAddPhoneOpen(true)}
                          >
                            <Plus className="h-4 w-4" />
                          </Button>
                        ) : undefined
                      }
                    >
                      {whatsapps.length === 0 ? (
                        <span className="text-sm text-muted-foreground italic">
                          No WhatsApp number
                        </span>
                      ) : (
                        <div className="space-y-1">
                          {whatsapps.map((w) =>
                            editMobile?.id === String(w.id) ? (
                              // ── Edit mode (replyagent: c.is_editing) ──
                              <div key={w.id} className="flex items-center gap-1">
                                <Input
                                  value={editMobile.value}
                                  onChange={(e) =>
                                    setEditMobile({ ...editMobile, value: e.target.value })
                                  }
                                  className="h-8 text-sm flex-1"
                                />
                                <Select
                                  value={editMobile.type}
                                  onValueChange={(v) =>
                                    setEditMobile({ ...editMobile, type: v })
                                  }
                                >
                                  <SelectTrigger className="h-8 w-[7em] text-xs">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="work">Work</SelectItem>
                                    <SelectItem value="personal">Personal</SelectItem>
                                    <SelectItem value="other">Other</SelectItem>
                                  </SelectContent>
                                </Select>
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-7 w-7">
                                      <MoreHorizontal className="h-3.5 w-3.5" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent>
                                    {!w.is_primary ? (
                                      <DropdownMenuItem
                                        onClick={() =>
                                          setPrimaryMutation.mutate({
                                            field_id: String(w.id),
                                            field_type: "mobile",
                                            mark_primary: true,
                                          })
                                        }
                                      >
                                        <Check className="h-4 w-4 mr-2" />
                                        Mark primary
                                      </DropdownMenuItem>
                                    ) : (
                                      <DropdownMenuItem
                                        onClick={() =>
                                          setPrimaryMutation.mutate({
                                            field_id: String(w.id),
                                            field_type: "mobile",
                                            mark_primary: false,
                                          })
                                        }
                                      >
                                        <X className="h-4 w-4 mr-2" />
                                        Unmark primary
                                      </DropdownMenuItem>
                                    )}
                                  </DropdownMenuContent>
                                </DropdownMenu>
                                <button
                                  type="button"
                                  className="px-1.5 text-muted-foreground hover:text-destructive"
                                  title="Remove"
                                  onClick={() => {
                                    removeFieldMutation.mutate({
                                      field: { slug: "whatsapp", object_id: w.id },
                                      type: "contact",
                                    });
                                    setEditMobile(null);
                                  }}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                                <button
                                  type="button"
                                  className="px-1.5 text-muted-foreground hover:text-foreground"
                                  title="Cancel"
                                  onClick={() => setEditMobile(null)}
                                >
                                  <X className="h-4 w-4" />
                                </button>
                                <button
                                  type="button"
                                  className="px-1.5 text-emerald-600 hover:text-emerald-700"
                                  title="Save"
                                  onClick={() =>
                                    updateMobileMutation.mutate({
                                      id: String(w.id),
                                      value: editMobile.value,
                                      type: editMobile.type,
                                    })
                                  }
                                >
                                  {updateMobileMutation.isPending ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <Check className="h-4 w-4" />
                                  )}
                                </button>
                              </div>
                            ) : (
                              // ── Display mode: number + Primary + workspace-numbers popup ──
                              <div key={w.id} className="flex items-center gap-2">
                                <span
                                  className={
                                    canManageContacts
                                      ? "text-sm cursor-pointer hover:underline"
                                      : "text-sm"
                                  }
                                  title={canManageContacts ? "Click to edit" : undefined}
                                  onClick={() =>
                                    canManageContacts &&
                                    setEditMobile({
                                      id: String(w.id),
                                      // Prefill with the full international form so re-normalising
                                      // on save can detect the country from the prefix.
                                      value: w.full_mobile_number ?? w.mobile_number ?? "",
                                      type: String(w.type ?? "whatsapp"),
                                    })
                                  }
                                >
                                  {w.full_mobile_number}
                                </span>
                                {w.is_primary && (
                                  <span className="rounded-full border border-green-600/30 bg-green-50 dark:bg-green-500/10 text-green-600 dark:text-green-400 text-[10px] px-3 py-[2px]">
                                    Primary
                                  </span>
                                )}
                                <Popover>
                                  <PopoverTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-6 w-6">
                                      <MoreHorizontal className="h-3.5 w-3.5" />
                                    </Button>
                                  </PopoverTrigger>
                                  <PopoverContent align="end" className="w-64 p-0">
                                    <div className="px-3 py-2 text-xs font-semibold border-b">
                                      WhatsApp
                                    </div>
                                    {waChannels.length === 0 ? (
                                      <p className="px-3 py-3 text-xs text-muted-foreground">
                                        No WhatsApp channel connected.
                                      </p>
                                    ) : (
                                      <div className="divide-y">
                                        {waChannels.map((ch: any) => {
                                          const opted = isWaOpted(w, ch);
                                          return (
                                            <div
                                              key={ch.id}
                                              className="flex items-center justify-between px-3 py-2"
                                            >
                                              <label className="flex items-center gap-2 cursor-pointer min-w-0">
                                                <input
                                                  type="checkbox"
                                                  className="h-4 w-4 shrink-0"
                                                  checked={opted}
                                                  onChange={(e) =>
                                                    toggleOptin(w, ch, e.target.checked)
                                                  }
                                                />
                                                <span className="text-xs truncate">
                                                  {ch.display_phone_number ||
                                                    ch.verified_name ||
                                                    `#${ch.id}`}
                                                </span>
                                              </label>
                                              <div className="flex items-center gap-1 shrink-0">
                                                <span
                                                  className="flex flex-col items-center"
                                                  title="Meta (WhatsApp Cloud API)"
                                                >
                                                  <img
                                                    src="/images/integrations/metadas.png"
                                                    alt="Meta"
                                                    className="h-3.5 w-3.5 object-contain"
                                                  />
                                                  <span className="text-[9px] leading-none text-[#0081f9]">
                                                    Meta
                                                  </span>
                                                </span>
                                                {opted ? (
                                                  <button
                                                    type="button"
                                                    className="p-1 text-muted-foreground hover:text-foreground"
                                                    title="Send message"
                                                    onClick={() => startWhatsappChat(String(ch.id))}
                                                  >
                                                    <Send className="h-3.5 w-3.5" />
                                                  </button>
                                                ) : (
                                                  <span
                                                    className="p-1 text-muted-foreground/40"
                                                    title="This number is not opted-in to send message."
                                                  >
                                                    <Send className="h-3.5 w-3.5" />
                                                  </span>
                                                )}
                                              </div>
                                            </div>
                                          );
                                        })}
                                      </div>
                                    )}
                                  </PopoverContent>
                                </Popover>
                              </div>
                            ),
                          )}
                        </div>
                      )}
                    </FieldRow>

                    <Separator />

                    {/* Email */}
                    <FieldRow
                      label="Email"
                      icon={<Mail className="h-4 w-4 text-blue-600" />}
                      actionRight={
                        canManageContacts ? (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setAddEmailOpen(true)}
                          >
                            <Plus className="h-4 w-4" />
                          </Button>
                        ) : undefined
                      }
                    >
                      <div className="space-y-2">
                        {emails.length === 0 ? (
                          <span className="text-sm text-muted-foreground italic">
                            No email addresses
                          </span>
                        ) : (
                          emails.map((e) => (
                            <div
                              key={e.id}
                              className="flex items-center gap-2 text-sm"
                            >
                              <span>{e.email}</span>
                              {["work", "personal", "other"].includes(String(e.type)) && (
                                <span className="text-[10px] text-muted-foreground capitalize">
                                  ({e.type})
                                </span>
                              )}
                              {e.is_primary && (
                                <span className="rounded-full border border-green-600/30 bg-green-50 dark:bg-green-500/10 text-green-600 dark:text-green-400 text-[10px] px-3 py-[2px]">
                                  Primary
                                </span>
                              )}
                              {e.opted_in && (
                                <span className="rounded-full border border-green-600/30 bg-green-50 dark:bg-green-500/10 text-green-600 dark:text-green-400 text-[10px] px-3 py-[2px]">
                                  Opted In
                                </span>
                              )}
                              {e.opted_in && e.optin_id && (
                                <button
                                  onClick={() => unsubscribeMutation.mutate(String(e.optin_id))}
                                  className="rounded-full border border-red-600/30 bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 text-[10px] px-3 py-[2px] hover:bg-red-100 dark:hover:bg-red-500/20 transition-colors"
                                >
                                  Unsubscribe
                                </button>
                              )}
                              {canManageContacts && (
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6 ml-auto"
                                  >
                                    <MoreHorizontal className="h-3.5 w-3.5" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent>
                                  {!e.is_primary && (
                                    <DropdownMenuItem
                                      onClick={() =>
                                        setPrimaryMutation.mutate({
                                          field_id: String(e.id),
                                          field_type: "email",
                                          mark_primary: true,
                                        })
                                      }
                                    >
                                      <Check className="h-4 w-4 mr-2" />
                                      Mark primary
                                    </DropdownMenuItem>
                                  )}
                                  {e.opted_in && e.optin_id && (
                                    <DropdownMenuItem
                                      onClick={() => unsubscribeMutation.mutate(String(e.optin_id))}
                                    >
                                      <X className="h-4 w-4 mr-2" />
                                      Unsubscribe
                                    </DropdownMenuItem>
                                  )}
                                  <DropdownMenuItem
                                    onClick={() =>
                                      removeFieldMutation.mutate({
                                        field: { slug: "email", object_id: e.id },
                                        type: "contact",
                                      })
                                    }
                                    className="text-destructive"
                                  >
                                    <Trash2 className="h-4 w-4 mr-2" />
                                    Remove
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                              )}
                            </div>
                          ))
                        )}
                      </div>
                    </FieldRow>

                    <Separator />
                      </>
                    )}

                    {/* Address (replyagent parity) */}
                    <FieldRow
                      label="Address"
                      icon={<MapPin className="h-4 w-4 text-rose-600" />}
                    >
                      <AddressEditor
                        initial={(enriched as any)?.address ?? {}}
                        saving={savingField === "address"}
                        disabled={!canManageContacts}
                        onSave={async (a) => {
                          await handleSavePatch("address", {
                            field: {
                              slug: "address",
                              value: JSON.stringify(a),
                            },
                            field_type: "SYSTEM_FIELD",
                          });
                        }}
                        onCancel={() => {}}
                      />
                    </FieldRow>

                    <Separator />

                    {/* Language */}
                    <FieldRow
                      label="Language"
                      icon={<Languages className="h-4 w-4 text-indigo-600" />}
                    >
                      <LanguagePicker
                        value={enriched.language}
                        disabled={!canManageContacts}
                        onChange={(v) =>
                          handleSavePatch("language", {
                            field: { slug: "language", value: v },
                            field_type: "SYSTEM_FIELD",
                          })
                        }
                      />
                    </FieldRow>

                    <Separator />

                    {/* Locale */}
                    <FieldRow
                      label="Locale"
                      icon={<Globe className="h-4 w-4 text-teal-600" />}
                    >
                      <LocalePicker
                        value={enriched.locale}
                        disabled={!canManageContacts}
                        onChange={(v) =>
                          handleSavePatch("locale", {
                            field: { slug: "locale", value: v },
                            field_type: "SYSTEM_FIELD",
                          })
                        }
                      />
                    </FieldRow>

                    <Separator />

                    {/* Timezone */}
                    <FieldRow
                      label="Timezone"
                      icon={<Clock className="h-4 w-4 text-amber-600" />}
                    >
                      <TimezonePicker
                        value={enriched.timezone}
                        disabled={!canManageContacts}
                        onChange={(v) =>
                          handleSavePatch("timezone", {
                            field: { slug: "timezone", value: v },
                            field_type: "SYSTEM_FIELD",
                          })
                        }
                      />
                    </FieldRow>

                    <Separator />

                    {/* Custom field VALUES inline in the center (replyagent parity:
                        each set custom field shows as a labeled row; click to edit
                        opens the value editor prefilled). */}
                    {(enriched.custom_fields_data ?? []).map((cf: any) => {
                      const meta = allCustomFields.find(
                        (f: any) =>
                          String(f.slug) === String(cf.slug) ||
                          String(f.id) === String(cf.id),
                      );
                      const hasValue =
                        cf.value !== undefined &&
                        cf.value !== null &&
                        String(cf.value) !== "";
                      return (
                        <div key={cf.id ?? cf.label}>
                          <FieldRow label={cf.label ?? meta?.label ?? meta?.name ?? "Field"}>
                            <button
                              className="text-sm text-left hover:underline disabled:no-underline disabled:cursor-default"
                              disabled={!canManageContacts}
                              onClick={() => {
                                setMidView("form");
                                setActiveCustomField(meta ?? cf);
                                setActiveCustomFieldDraft(cf.value ?? "");
                              }}
                            >
                              {hasValue ? (
                                String(cf.value)
                              ) : (
                                <span className="text-muted-foreground italic">
                                  Click to set value
                                </span>
                              )}
                            </button>
                          </FieldRow>
                          <Separator />
                        </div>
                      );
                    })}

                    {/* Tags inline */}
                    <FieldRow label="Tags">
                      <div className="flex flex-wrap gap-2">
                        {tags.length === 0 ? (
                          <span className="text-sm text-muted-foreground italic">
                            No tags
                          </span>
                        ) : (
                          tags.map((tg) => (
                            <Badge
                              key={tg}
                              variant="outline"
                              className="text-xs flex items-center gap-1"
                            >
                              <span>{tg}</span>
                              {canManageContacts && (
                                <button
                                  type="button"
                                  onClick={() => removeTagMutation.mutate(tg)}
                                  className="hover:text-destructive"
                                >
                                  <X className="h-3 w-3" />
                                </button>
                              )}
                            </Badge>
                          ))
                        )}
                      </div>
                    </FieldRow>
                  </div>
                )}
              </ScrollArea>
            </div>

            {/* ── RIGHT PANEL: system / custom fields / tags ── */}
            <div className="col-span-3 border-l bg-muted/10 overflow-hidden flex flex-col">
              {/* Right-panel header (replyagent: View contact history + Close) */}
              <div className="flex items-center justify-between px-4 py-3 border-b shrink-0">
                <button
                  onClick={handleOpenConversationHistory}
                  className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  <ArrowLeft className="h-4 w-4" />
                  View contact history
                </button>
                <button
                  onClick={() => onOpenChange(false)}
                  className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  <X className="h-4 w-4" />
                  Close
                </button>
              </div>
              <ScrollArea className="flex-1 p-4">
                {/* SYSTEM FIELDS — quick add/edit chips for contact fields;
                    gated by company.manage (replyagent canManageCompany). */}
                {canManageContacts && (
                <>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                  System Fields
                </h4>
                <div className="grid grid-cols-2 gap-2 mb-6">
                  <SystemFieldChip
                    icon={<PhoneIcon className="h-3.5 w-3.5 text-emerald-600" />}
                    label="Phone"
                    onClick={() => setAddPhoneOpen(true)}
                  />
                  <SystemFieldChip
                    icon={
                      <MessageSquare className="h-3.5 w-3.5 text-emerald-600" />
                    }
                    label="WhatsApp"
                    onClick={() => setAddPhoneOpen(true)}
                  />
                  <SystemFieldChip
                    icon={<Mail className="h-3.5 w-3.5 text-blue-600" />}
                    label="Email"
                    onClick={() => setAddEmailOpen(true)}
                  />
                  <SystemFieldChip
                    icon={<MapPin className="h-3.5 w-3.5 text-rose-600" />}
                    label="Address"
                    onClick={() => {
                      setMidView("form");
                      setAddressEditOpen(true);
                    }}
                  />
                  <SystemFieldChip
                    icon={<UserIcon className="h-3.5 w-3.5 text-violet-600" />}
                    label="Gender"
                    onClick={() => setMidView("form")}
                  />
                  <SystemFieldChip
                    icon={<TypeIcon className="h-3.5 w-3.5 text-orange-600" />}
                    label="Title"
                    onClick={() => setMidView("form")}
                  />
                  <SystemFieldChip
                    icon={<Languages className="h-3.5 w-3.5 text-indigo-600" />}
                    label="Language"
                    onClick={() => setMidView("form")}
                  />
                  <SystemFieldChip
                    icon={<Globe className="h-3.5 w-3.5 text-teal-600" />}
                    label="Locale"
                    onClick={() => setMidView("form")}
                  />
                  <SystemFieldChip
                    icon={<Clock className="h-3.5 w-3.5 text-amber-600" />}
                    label="Timezone"
                    onClick={() => setMidView("form")}
                  />
                </div>
                </>
                )}

                {/* CUSTOM FIELDS */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Custom Fields
                    </h4>
                    <span className="text-xs text-muted-foreground">
                      {allCustomFields.length}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    {canManageContacts && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => {
                          setCustomFieldPickerOpen(true);
                        }}
                      >
                        <Search className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => setFullCreateCFOpen(true)}
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
                <div className="mb-6">
                  {allCustomFields.length === 0 ? (
                    <p className="text-xs text-muted-foreground italic">
                      No custom fields configured.
                    </p>
                  ) : (
                    <div className="space-y-1">
                      {allCustomFields.map((cf: any) => (
                        <div
                          key={cf.id ?? cf.slug}
                          className="flex items-center gap-2 text-xs px-2 py-1.5 hover:bg-muted/50 rounded"
                        >
                          <button
                            className="flex-1 text-left font-medium truncate"
                            onClick={() => {
                              // Switch the middle column to Profile and inline-edit
                              // the chosen field's VALUE via the dialog below.
                              setMidView("form");
                              setActiveCustomField(cf);
                            }}
                          >
                            {cf.label ?? cf.name}
                          </button>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button type="button" className="hover:text-foreground shrink-0">
                                <MoreHorizontal className="h-3.5 w-3.5 text-muted-foreground" />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onClick={() => {
                                  setMidView("form");
                                  setActiveCustomField(cf);
                                }}
                              >
                                <ChevronRight className="h-3.5 w-3.5 mr-2" />
                                Edit value
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="text-destructive"
                                onClick={() => {
                                  if (
                                    window.confirm(
                                      `Delete custom field "${cf.label ?? cf.name}" from the whole workspace?`,
                                    )
                                  ) {
                                    deleteCustomFieldMutation.mutate(String(cf.slug));
                                  }
                                }}
                              >
                                <Trash2 className="h-3.5 w-3.5 mr-2" />
                                Delete field
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* TAGS */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Tags
                    </h4>
                    <span className="text-xs text-muted-foreground">
                      {allTags.length}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    {canManageContacts && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => setTagPickerOpen(true)}
                      >
                        <Search className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => {
                        setEditingTag(null);
                        setNewTagOpen(true);
                      }}
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  {allTags.length === 0 ? (
                    <p className="col-span-2 text-xs text-muted-foreground italic">
                      No tags created
                    </p>
                  ) : (
                    allTags.map((tg: any) => {
                      const tagName = tg.name ?? tg;
                      const applied = tags.includes(tagName);
                      return (
                        <div
                          key={tg.id ?? tagName}
                          className={`text-xs rounded border flex items-center ${
                            applied
                              ? "bg-primary/10 border-primary/30"
                              : "hover:bg-muted/50"
                          }`}
                        >
                          <button
                            className="flex items-center gap-1 px-2 py-1.5 flex-1 min-w-0"
                            disabled={!canManageContacts}
                            onClick={() =>
                              canManageContacts &&
                              (applied
                                ? removeTagMutation.mutate(tagName)
                                : applyTagMutation.mutate(tagName))
                            }
                          >
                            <span className="truncate flex-1 text-left">
                              {tagName}
                            </span>
                            {applied ? (
                              <Check className="h-3 w-3 text-primary shrink-0" />
                            ) : (
                              <ChevronDown className="h-3 w-3 text-muted-foreground shrink-0" />
                            )}
                          </button>
                          {tg.id && (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <button type="button" className="px-1 hover:text-foreground shrink-0">
                                  <MoreHorizontal className="h-3.5 w-3.5 text-muted-foreground" />
                                </button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem
                                  onClick={() => {
                                    setEditingTag(tg);
                                    setNewTagOpen(true);
                                  }}
                                >
                                  <TypeIcon className="h-3.5 w-3.5 mr-2" />
                                  Edit tag
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  className="text-destructive"
                                  onClick={() => {
                                    if (
                                      window.confirm(
                                        `Delete tag "${tagName}" from the whole workspace?`,
                                      )
                                    ) {
                                      deleteTagMutation.mutate(String(tg.id));
                                    }
                                  }}
                                >
                                  <Trash2 className="h-3.5 w-3.5 mr-2" />
                                  Delete tag
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </ScrollArea>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ─── Sub-modals ─── */}

      {/* Confirm delete — replyagent random-code parity */}
      <DeleteContactDialog
        open={confirmDeleteOpen}
        onOpenChange={setConfirmDeleteOpen}
        contactName={fullName}
        deleting={deleteContactMutation.isPending}
        onConfirmDelete={() => deleteContactMutation.mutate()}
      />

      {/* Full Opportunity form (pipeline + step + status + probability + agent) */}
      <OpportunityFormDialog
        open={fullOpportunityOpen}
        onOpenChange={setFullOpportunityOpen}
        contactId={contactId}
        onSaved={() => {
          invalidateProfile();
          setFullOpportunityOpen(false);
        }}
      />

      {/* Gallery picker for contact picture */}
      <GalleryPickerDialog
        open={fullGalleryOpen}
        onOpenChange={setFullGalleryOpen}
        onPick={async (m) => {
          if (!contactId) return;
          await apiPatch(`/api/contacts/${contactId}`, {
            gallery_media_id: m.id,
            picture: m.url,
          });
          invalidateProfile();
          setFullGalleryOpen(false);
          toast({ title: "Picture updated" });
        }}
        mediaType="image"
      />

      {/* Full create custom field (12 content types + system_name availability) */}
      <FullCreateCustomFieldDialog
        open={fullCreateCFOpen}
        onOpenChange={setFullCreateCFOpen}
        onSaved={() => {
          queryClient.invalidateQueries({ queryKey: ["/api/custom-fields"] });
          setFullCreateCFOpen(false);
        }}
      />

      {/* Add new lead under the same company */}
      <AddLeadDialog
        open={addLeadOpen}
        onOpenChange={setAddLeadOpen}
        companyId={enriched?.company_id ? String(enriched.company_id) : null}
        onSaved={() => {
          queryClient.invalidateQueries({ queryKey: ["/api/contacts"] });
          setAddLeadOpen(false);
        }}
      />

      {/* Address editor dialog — opened from the right-panel Address chip */}
      <Dialog open={addressEditOpen} onOpenChange={setAddressEditOpen}>
        <DialogContent className="max-w-md">
          <DialogTitle>Address</DialogTitle>
          <DialogDescription>
            Edit this contact's primary address.
          </DialogDescription>
          <AddressEditor
            initial={(enriched as any)?.address ?? {}}
            saving={savingField === "address"}
            onCancel={() => setAddressEditOpen(false)}
            onSave={async (a) => {
              await handleSavePatch("address", {
                field: { slug: "address", value: JSON.stringify(a) },
                field_type: "SYSTEM_FIELD",
              });
              setAddressEditOpen(false);
            }}
          />
        </DialogContent>
      </Dialog>

      {/* Active custom field inline edit dialog. Opened when a user clicks a
          custom field in the right-panel list. Uses CustomFieldRenderer so the
          input type is correct for the field's content_type (PHONE / DATE /
          MULTISELECT / etc.). */}
      <Dialog
        open={!!activeCustomField}
        onOpenChange={(o) => {
          if (!o) setActiveCustomField(null);
        }}
      >
        <DialogContent className="max-w-md">
          <DialogTitle>
            {activeCustomField?.label ?? activeCustomField?.name ?? "Custom field"}
          </DialogTitle>
          {activeCustomField?.description && (
            <DialogDescription>
              {activeCustomField.description}
            </DialogDescription>
          )}
          {activeCustomField && (
            <CustomFieldRenderer
              field={activeCustomField as any}
              value={activeCustomFieldDraft}
              onChange={setActiveCustomFieldDraft}
            />
          )}
          <div className="flex justify-end gap-2 mt-3">
            <Button
              variant="outline"
              onClick={() => setActiveCustomField(null)}
            >
              Cancel
            </Button>
            {canManageContacts && (
              <Button
                onClick={async () => {
                  if (!activeCustomField) return;
                  await handleSavePatch("custom_field", {
                    field: {
                      slug: activeCustomField.slug,
                      value: activeCustomFieldDraft,
                    },
                    field_type: "CUSTOM_FIELD",
                  });
                  setActiveCustomField(null);
                  setActiveCustomFieldDraft("");
                }}
              >
                Save
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Change Company */}
      <Dialog open={changeCompanyOpen} onOpenChange={setChangeCompanyOpen}>
        <DialogContent className="max-w-md">
          <DialogTitle>Change company</DialogTitle>
          <DialogDescription>
            Move {fullName} to a different company.
          </DialogDescription>
          <div className="space-y-3 py-2">
            <Select
              value=""
              onValueChange={(v) =>
                changeCompanyMutation.mutate(v === "__none__" ? null : v)
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a company" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">— No company —</SelectItem>
                {allCompanies.map((c: any) => (
                  <SelectItem key={c.id} value={String(c.id)}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => setChangeCompanyOpen(false)}
            >
              Cancel
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Merge Contacts */}
      <MergeContactsDialog
        open={mergeContactsOpen}
        onOpenChange={setMergeContactsOpen}
        currentContact={enriched}
        onMerged={() => {
          invalidateProfile();
          setMergeContactsOpen(false);
          onOpenChange(false);
        }}
      />

      {/* New Custom Field */}
      <NewCustomFieldDialog
        open={newCustomFieldOpen}
        onOpenChange={setNewCustomFieldOpen}
        onSave={(payload) => createCustomFieldMutation.mutate(payload)}
        saving={createCustomFieldMutation.isPending}
      />

      {/* New Tag */}
      <NewTagDialog
        open={newTagOpen}
        onOpenChange={(o) => {
          setNewTagOpen(o);
          if (!o) setEditingTag(null);
        }}
        initial={editingTag}
        onSave={(payload) =>
          editingTag?.id
            ? updateTagMutation.mutate({ id: String(editingTag.id), payload })
            : createTagMutation.mutate(payload)
        }
        saving={createTagMutation.isPending || updateTagMutation.isPending}
      />

      {/* New Task */}
      <NewTaskDialog
        open={newTaskOpen}
        onOpenChange={setNewTaskOpen}
        onSave={(payload) => createTaskMutation.mutate(payload)}
        saving={createTaskMutation.isPending}
        assignees={taskAssignees}
      />

      {/* New Opportunity */}
      <NewOpportunityDialog
        open={newOpportunityOpen}
        onOpenChange={setNewOpportunityOpen}
        onSave={(payload) => createOpportunityMutation.mutate(payload)}
        saving={createOpportunityMutation.isPending}
      />

      {/* Add Phone */}
      <AddContactFieldDialog
        open={addPhoneOpen}
        onOpenChange={setAddPhoneOpen}
        title="Add phone number"
        fieldType="phone"
        onSave={async (value, primary, type) => {
          if (!contactId) return;
          await apiPatch(`/api/contacts/${contactId}`, {
            phone: value,
            type,
            mark_primary: primary,
          });
          invalidateProfile();
          setAddPhoneOpen(false);
          toast({ title: "Phone added" });
        }}
      />

      {/* Add Email */}
      <AddContactFieldDialog
        open={addEmailOpen}
        onOpenChange={setAddEmailOpen}
        title="Add email address"
        fieldType="email"
        onSave={async (value, primary, type) => {
          if (!contactId) return;
          await apiPatch(`/api/contacts/${contactId}`, {
            email: value,
            type,
            mark_primary: primary,
          });
          invalidateProfile();
          setAddEmailOpen(false);
          toast({ title: "Email added" });
        }}
      />

      {/* Custom field picker (search existing) */}
      <Dialog open={customFieldPickerOpen} onOpenChange={setCustomFieldPickerOpen}>
        <DialogContent className="max-w-md">
          <DialogTitle>Custom fields</DialogTitle>
          <DialogDescription>Browse or filter custom fields.</DialogDescription>
          <Input
            placeholder="Search..."
            value={customFieldFilter}
            onChange={(e) => setCustomFieldFilter(e.target.value)}
          />
          <ScrollArea className="h-72">
            <div className="space-y-1">
              {allCustomFields
                .filter((cf: any) =>
                  customFieldFilter
                    ? (cf.label ?? cf.name ?? "")
                        .toLowerCase()
                        .includes(customFieldFilter.toLowerCase())
                    : true,
                )
                .map((cf: any) => (
                  <div
                    key={cf.id ?? cf.slug}
                    className="text-sm px-2 py-1.5 hover:bg-muted/50 rounded"
                  >
                    {cf.label ?? cf.name}
                  </div>
                ))}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Tag picker (search existing) */}
      <Dialog open={tagPickerOpen} onOpenChange={setTagPickerOpen}>
        <DialogContent className="max-w-md">
          <DialogTitle>Apply tag</DialogTitle>
          <DialogDescription>Search and apply an existing tag.</DialogDescription>
          <Input
            placeholder="Search..."
            value={tagFilter}
            onChange={(e) => setTagFilter(e.target.value)}
          />
          <ScrollArea className="h-72">
            <div className="space-y-1">
              {allTags
                .filter((t: any) =>
                  tagFilter
                    ? (t.name ?? t).toLowerCase().includes(tagFilter.toLowerCase())
                    : true,
                )
                .map((t: any) => {
                  const tagName = t.name ?? t;
                  const applied = tags.includes(tagName);
                  return (
                    <button
                      key={t.id ?? tagName}
                      className="w-full flex items-center gap-2 text-sm px-2 py-1.5 hover:bg-muted/50 rounded text-left"
                      onClick={() =>
                        applied
                          ? removeTagMutation.mutate(tagName)
                          : applyTagMutation.mutate(tagName)
                      }
                    >
                      <span className="flex-1">{tagName}</span>
                      {applied && <Check className="h-3.5 w-3.5 text-primary" />}
                    </button>
                  );
                })}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ─── Helpers ───────────────────────────────────────────────────────────

function FieldRow({
  label,
  icon,
  children,
  actionRight,
}: {
  label: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  actionRight?: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-12 gap-4 items-start">
      <div className="col-span-3 flex items-center gap-2 pt-1.5">
        {icon}
        <span className="text-sm text-muted-foreground">{label}</span>
      </div>
      <div className="col-span-8">{children}</div>
      <div className="col-span-1 text-right">{actionRight}</div>
    </div>
  );
}

function SystemFieldChip({
  icon,
  label,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-2 border rounded px-2 py-1.5 text-xs hover:bg-muted/50 text-left"
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

// ─── Sub-dialog components ─────────────────────────────────────────────

function NewCustomFieldDialog({
  open,
  onOpenChange,
  onSave,
  saving,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (payload: any) => void;
  saving: boolean;
}) {
  const [label, setLabel] = useState("");
  const [contentType, setContentType] = useState("TEXT");

  useEffect(() => {
    if (!open) {
      setLabel("");
      setContentType("TEXT");
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogTitle>New custom field</DialogTitle>
        <DialogDescription>
          Create a new custom field for this workspace.
        </DialogDescription>
        <div className="space-y-3 py-2">
          <div>
            <Label>Label</Label>
            <Input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. Birthday"
            />
          </div>
          <div>
            <Label>Type</Label>
            <Select value={contentType} onValueChange={setContentType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="TEXT">Text</SelectItem>
                <SelectItem value="NUMBER">Number</SelectItem>
                <SelectItem value="DATE">Date</SelectItem>
                <SelectItem value="DATETIME">Date &amp; time</SelectItem>
                <SelectItem value="PHONE">Phone</SelectItem>
                <SelectItem value="URL">URL</SelectItem>
                <SelectItem value="CURRENCY">Currency</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={!label || saving}
            onClick={() =>
              onSave({
                label,
                slug: label.toLowerCase().replace(/[^a-z0-9]+/g, "_"),
                content_type: contentType,
                input_type: contentType === "DATE" || contentType === "DATETIME" ? "date" : "text",
                entity_type: "Contact",
              })
            }
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Create
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function NewTagDialog({
  open,
  onOpenChange,
  onSave,
  saving,
  initial,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (payload: any) => void;
  saving: boolean;
  initial?: any;
}) {
  const [name, setName] = useState("");
  const [color, setColor] = useState("#3b82f6");
  const isEdit = !!initial?.id;

  useEffect(() => {
    if (open) {
      setName(initial?.name ?? "");
      setColor(initial?.bg_color ?? initial?.color ?? "#3b82f6");
    } else {
      setName("");
      setColor("#3b82f6");
    }
  }, [open, initial]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogTitle>{isEdit ? "Edit tag" : "New tag"}</DialogTitle>
        <DialogDescription>
          {isEdit ? "Update this tag's name or color." : "Create a tag you can apply to contacts."}
        </DialogDescription>
        <div className="space-y-3 py-2">
          <div>
            <Label>Name</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. VIP"
            />
          </div>
          <div>
            <Label>Color</Label>
            <Input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="h-10"
            />
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={!name || saving}
            onClick={() => onSave({ name, bg_color: color })}
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Create
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function NewTaskDialog({
  open,
  onOpenChange,
  onSave,
  saving,
  assignees = [],
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (payload: any) => void;
  saving: boolean;
  // Agents eligible to receive tasks (replyagent: getUsers() filtered by receive_tasks).
  assignees?: { id: string; name: string }[];
}) {
  const [description, setDescription] = useState("");
  const [datetime, setDatetime] = useState("");
  const [assigneeId, setAssigneeId] = useState("none");

  useEffect(() => {
    if (!open) {
      setDescription("");
      setDatetime("");
      setAssigneeId("none");
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogTitle>New task</DialogTitle>
        <DialogDescription>
          Schedule a task linked to this contact.
        </DialogDescription>
        <div className="space-y-3 py-2">
          <div>
            <Label>Description</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What needs to be done?"
            />
          </div>
          <div>
            <Label>Date &amp; time</Label>
            <Input
              type="datetime-local"
              value={datetime}
              onChange={(e) => setDatetime(e.target.value)}
            />
          </div>
          <div>
            <Label>Assign to</Label>
            <Select value={assigneeId} onValueChange={setAssigneeId}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Unassigned" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Unassigned</SelectItem>
                {assignees.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={!description || saving}
            onClick={() =>
              onSave({
                description,
                datetime,
                user_id: assigneeId === "none" ? null : assigneeId,
              })
            }
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Create
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function NewOpportunityDialog({
  open,
  onOpenChange,
  onSave,
  saving,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (payload: any) => void;
  saving: boolean;
}) {
  const [value, setValue] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [closingDate, setClosingDate] = useState("");
  const [note, setNote] = useState("");

  useEffect(() => {
    if (!open) {
      setValue("");
      setCurrency("USD");
      setClosingDate("");
      setNote("");
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogTitle>New opportunity</DialogTitle>
        <DialogDescription>
          Create a sales opportunity for this contact.
        </DialogDescription>
        <div className="space-y-3 py-2">
          <div className="grid grid-cols-3 gap-2">
            <div className="col-span-2">
              <Label>Value</Label>
              <Input
                type="number"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder="0.00"
              />
            </div>
            <div>
              <Label>Currency</Label>
              <Select value={currency} onValueChange={setCurrency}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="USD">USD</SelectItem>
                  <SelectItem value="EUR">EUR</SelectItem>
                  <SelectItem value="GBP">GBP</SelectItem>
                  <SelectItem value="PKR">PKR</SelectItem>
                  <SelectItem value="INR">INR</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>Closing date</Label>
            <Input
              type="date"
              value={closingDate}
              onChange={(e) => setClosingDate(e.target.value)}
            />
          </div>
          <div>
            <Label>Note</Label>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Add a note (optional)"
            />
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={!value || saving}
            onClick={() =>
              onSave({
                value: Number(value),
                currency,
                closing_date: closingDate || null,
                note: note || null,
              })
            }
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Create
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function AddContactFieldDialog({
  open,
  onOpenChange,
  title,
  fieldType,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  fieldType: "phone" | "email";
  onSave: (value: string, primary: boolean, type: string) => Promise<void>;
}) {
  const [value, setValue] = useState("");
  const [primary, setPrimary] = useState(false);
  const [type, setType] = useState("work");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) {
      setValue("");
      setPrimary(false);
      setType("work");
      setSaving(false);
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>
          Enter the value and mark as primary if applicable.
        </DialogDescription>
        <div className="space-y-3 py-2">
          <Input
            type={fieldType === "email" ? "email" : "tel"}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={
              fieldType === "email" ? "name@example.com" : "+1 555 1234567"
            }
          />
          <div>
            <label className="text-xs text-muted-foreground">Type</label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="work">Work</SelectItem>
                <SelectItem value="personal">Personal</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={primary}
              onChange={(e) => setPrimary(e.target.checked)}
            />
            Mark as primary
          </label>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={!value || saving}
            onClick={async () => {
              setSaving(true);
              try {
                await onSave(value, primary, type);
              } finally {
                setSaving(false);
              }
            }}
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Save
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Merge Contacts dialog ──────────────────────────────────────────

function MergeContactsDialog({
  open,
  onOpenChange,
  currentContact,
  onMerged,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentContact: any;
  onMerged: () => void;
}) {
  const { toast } = useToast();
  const [query, setQuery] = useState("");
  const [candidates, setCandidates] = useState<any[]>([]);
  const [destination, setDestination] = useState<any | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [merging, setMerging] = useState(false);
  // Current contact re-fetched in the same shape as the destination so the
  // preview union is accurate (replyagent re-loads it via merge-lead too).
  const [currentNormalized, setCurrentNormalized] = useState<any | null>(null);

  useEffect(() => {
    if (!open) {
      setQuery("");
      setCandidates([]);
      setDestination(null);
      setConfirming(false);
      setMerging(false);
      setCurrentNormalized(null);
      return;
    }
    if (currentContact?.id) {
      apiGet(`/api/contacts/${currentContact.id}/merge-preview`)
        .then((resp: any) => setCurrentNormalized(resp))
        .catch(() => setCurrentNormalized(null));
    }
  }, [open, currentContact]);

  // Build the merge preview: destination + the current contact's unique data
  // (mirrors replyagent's client-side union). Falls back to destination alone
  // until the normalized current contact has loaded.
  const buildPreview = (cur: any, dst: any) => {
    if (!dst) return null;
    if (!cur) return dst;
    const mergeArr = (
      dstArr: any[],
      curArr: any[],
      keyFn: (x: any) => string,
    ) => {
      const m = new Map<string, any>();
      for (const it of dstArr ?? []) m.set(keyFn(it), it);
      for (const it of curArr ?? []) {
        const k = keyFn(it);
        if (!m.has(k)) m.set(k, it);
      }
      return Array.from(m.values());
    };
    const earlier =
      cur.created_at && dst.created_at
        ? new Date(cur.created_at) < new Date(dst.created_at)
          ? cur.created_at
          : dst.created_at
        : dst.created_at ?? cur.created_at;
    return {
      ...dst,
      created_at: earlier,
      mobile_contacts: mergeArr(dst.mobile_contacts, cur.mobile_contacts, (m) =>
        String(m.national_mobile_number ?? m.full_mobile_number ?? m.mobile_number ?? ""),
      ),
      email_contacts: mergeArr(dst.email_contacts, cur.email_contacts, (e) =>
        String(e.email ?? ""),
      ),
      tag_links: mergeArr(dst.tag_links, cur.tag_links, (t) =>
        String(t.tag_id ?? t.name ?? ""),
      ),
      custom_fields_data: mergeArr(
        dst.custom_fields_data,
        cur.custom_fields_data,
        (cf) => String(cf.id ?? cf.label ?? ""),
      ),
      telegram_chats: mergeArr(dst.telegram_chats, cur.telegram_chats, (x) =>
        String(x.from_id ?? x.id ?? ""),
      ),
      whatsapp_chats: mergeArr(dst.whatsapp_chats, cur.whatsapp_chats, (x) =>
        String(x.wa_id ?? x.id ?? ""),
      ),
      facebook_chats: mergeArr(dst.facebook_chats, cur.facebook_chats, (x) =>
        String(x.sender_id ?? x.id ?? ""),
      ),
      instagram_chats: mergeArr(dst.instagram_chats, cur.instagram_chats, (x) =>
        String(x.username ?? x.id ?? ""),
      ),
    };
  };
  const previewContact = buildPreview(currentNormalized, destination);

  useEffect(() => {
    if (!open || !currentContact) return;
    if (query.length < 3) {
      setCandidates([]);
      return;
    }
    apiPost("/api/contacts/search-destination", {
      current_contact_id: String(currentContact.id),
      key: query,
    })
      .then((resp: any) => setCandidates(resp.contacts ?? []))
      .catch(() => setCandidates([]));
  }, [query, open, currentContact]);

  const selectDestination = async (c: any) => {
    try {
      const resp = await apiGet(`/api/contacts/${c.id}/merge-preview`);
      setDestination(resp);
    } catch (err: any) {
      toast({
        title: "Could not load contact",
        description: err?.message ?? "",
        variant: "destructive",
      });
    }
  };

  const handleMerge = async () => {
    if (!currentContact || !destination) return;
    setConfirming(false);
    setMerging(true);
    try {
      await apiPost("/api/contacts/merge", {
        current_contact: String(currentContact.id),
        destination_contact: String(destination.id),
      });
      toast({ title: "Contacts merged" });
      onMerged();
    } catch (err: any) {
      toast({
        title: "Merge failed",
        description: err?.message ?? "",
        variant: "destructive",
      });
    } finally {
      setMerging(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl">
        <DialogTitle>Merge contacts</DialogTitle>
        <DialogDescription>
          Combine two contacts. The destination contact will inherit all phones,
          emails, tags and conversations from the current contact. The current
          contact will be archived.
        </DialogDescription>

        <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded p-3 text-sm">
          <p className="font-semibold mb-1">Note:</p>
          <ul className="list-decimal list-inside space-y-0.5 text-xs">
            <li>All phones, emails, tags and chats move to the destination.</li>
            <li>The destination keeps the earlier subscription date.</li>
            <li>The source contact is archived (soft-deleted).</li>
          </ul>
        </div>

        <div className="grid grid-cols-3 gap-4 mt-3 min-h-[300px]">
          <div className="border-r pr-3">
            <h6 className="font-semibold mb-2 text-sm">Current contact</h6>
            {currentNormalized || currentContact ? (
              <ContactSummary c={currentNormalized ?? currentContact} />
            ) : (
              <p className="text-xs text-muted-foreground">No contact loaded</p>
            )}
          </div>
          <div className="border-r pr-3">
            <h6 className="font-semibold mb-2 text-sm">Destination</h6>
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name…"
            />
            {candidates.length > 0 && (
              <div className="border rounded mt-2 max-h-40 overflow-auto">
                {candidates.map((c) => (
                  <button
                    key={c.id}
                    className="w-full flex items-center gap-2 px-2 py-1.5 hover:bg-muted/50 text-left text-sm"
                    onClick={() => selectDestination(c)}
                  >
                    <Avatar className="h-5 w-5">
                      <AvatarFallback className="text-[9px]">
                        {(c.full_name ?? "?")
                          .split(/\s+/)
                          .map((p: string) => p[0])
                          .join("")
                          .slice(0, 2)
                          .toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <span className="flex-1 truncate">{c.full_name}</span>
                  </button>
                ))}
              </div>
            )}
            {destination && <ContactSummary c={destination} className="mt-3" />}
          </div>
          <div>
            <h6 className="font-semibold mb-2 text-sm">Preview</h6>
            {previewContact ? (
              <ContactSummary c={previewContact} />
            ) : (
              <p className="text-xs text-muted-foreground">
                Select a destination to preview the merge result.
              </p>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-3">
          {confirming ? (
            <>
              <span className="text-orange-500 text-sm self-center mr-2">
                Are you sure?
              </span>
              <Button
                variant="outline"
                onClick={() => setConfirming(false)}
                disabled={merging}
              >
                No
              </Button>
              <Button onClick={handleMerge} disabled={merging}>
                {merging ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Yes, merge
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button
                disabled={!destination}
                onClick={() => setConfirming(true)}
              >
                Merge contacts
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ContactSummary({ c, className = "" }: { c: any; className?: string }) {
  const workspaceTz = useWorkspaceTimezone();
  return (
    <div className={`space-y-1 text-xs ${className}`}>
      <div className="flex items-center gap-2">
        <Avatar className="h-7 w-7">
          <AvatarFallback className="text-[10px]">
            {(c.full_name ?? "?")
              .split(/\s+/)
              .map((p: string) => p[0])
              .join("")
              .slice(0, 2)
              .toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <h6 className="font-semibold flex-1 truncate">
          {c.full_name ?? "Unnamed"}
        </h6>
      </div>
      <div>
        <span className="text-muted-foreground">ID:</span> {c.slug ?? c.id}
      </div>
      {c.created_at && (
        <div>
          <span className="text-muted-foreground">Subscribed:</span>{" "}
          {formatInWorkspaceTz(c.created_at, "yyyy-MM-dd", workspaceTz)}
        </div>
      )}
      {c.mobile_contacts?.length > 0 && (
        <div>
          <span className="text-muted-foreground">Phones:</span>{" "}
          {c.mobile_contacts
            .map((m: any) => m.full_mobile_number ?? m.national_mobile_number)
            .join(", ")}
        </div>
      )}
      {c.email_contacts?.length > 0 && (
        <div>
          <span className="text-muted-foreground">Emails:</span>{" "}
          {c.email_contacts.map((e: any) => e.email).join(", ")}
        </div>
      )}
      {c.tag_links?.length > 0 && (
        <div className="flex gap-1 flex-wrap">
          {c.tag_links.map((tl: any) => (
            <Badge key={tl.id} variant="outline" className="text-[10px]">
              {tl.name}
            </Badge>
          ))}
        </div>
      )}
      {c.custom_fields_data?.length > 0 && (
        <div className="space-y-0.5 pt-0.5">
          {c.custom_fields_data.map((cf: any) => (
            <div key={cf.id ?? cf.label}>
              <span className="text-muted-foreground">{cf.label}:</span>{" "}
              {cf.value}
            </div>
          ))}
        </div>
      )}
      {(() => {
        const channels: string[] = [];
        if (c.telegram_chats?.length) channels.push("Telegram");
        if (c.whatsapp_chats?.length) channels.push("WhatsApp");
        if (c.facebook_chats?.length) channels.push("Facebook");
        if (c.instagram_chats?.length) channels.push("Instagram");
        return channels.length > 0 ? (
          <div>
            <span className="text-muted-foreground">Channels:</span>{" "}
            {channels.join(", ")}
          </div>
        ) : null;
      })()}
    </div>
  );
}
