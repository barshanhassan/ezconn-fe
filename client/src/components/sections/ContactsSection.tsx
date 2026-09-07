import { useState, useRef, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useSearch, useLocation } from "wouter";
import { Search, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Trash2, Edit2, Copy, Calendar, X, Download, Upload } from "react-feather";
import { ChevronsUpDown, ChevronDown, ChevronUp, Plus, Filter, ArrowUpDown, GripVertical, MoreVertical, Users, Tag } from "lucide-react";
import { DateRange } from "react-day-picker";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import CustomDropdown from "@/components/CustomDropdown";
import ContactProfileModal from "@/components/ContactProfileModal";
import { PhoneInputWithFlag } from "@/components/PhoneInputWithFlag";
import { COUNTRIES as STATIC_COUNTRIES } from "@/lib/countries";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { getUserInfo, hasAnyPerm } from "@/lib/auth";
import { formatInWorkspaceTz, useWorkspaceTimezone } from "@/contexts/WorkspaceTimezoneContext";
import { parsePhoneNumberFromString, getExampleNumber, type CountryCode, AsYouType } from "libphonenumber-js";
import examples from "libphonenumber-js/mobile/examples";

// ─── Country-code helpers ──────────────────────────────────────────────
// Map the workspace's country phone_code (e.g. "92", "+1") to an ISO
// alpha-2 region code that libphonenumber understands. We only handle the
// common cases here — anything missing falls through to the international
// validator which still accepts +CC prefixed numbers.
const PHONE_CODE_TO_ISO: Record<string, CountryCode> = {
  "1": "US",
  "44": "GB",
  "49": "DE",
  "33": "FR",
  "34": "ES",
  "39": "IT",
  "31": "NL",
  "32": "BE",
  "41": "CH",
  "43": "AT",
  "46": "SE",
  "47": "NO",
  "45": "DK",
  "48": "PL",
  "351": "PT",
  "358": "FI",
  "353": "IE",
  "30": "GR",
  "420": "CZ",
  "55": "BR",
  "52": "MX",
  "54": "AR",
  "56": "CL",
  "57": "CO",
  "51": "PE",
  "58": "VE",
  "20": "EG",
  "27": "ZA",
  "212": "MA",
  "234": "NG",
  "254": "KE",
  "971": "AE",
  "966": "SA",
  "974": "QA",
  "962": "JO",
  "961": "LB",
  "972": "IL",
  "90": "TR",
  "98": "IR",
  "92": "PK",
  "91": "IN",
  "880": "BD",
  "94": "LK",
  "977": "NP",
  "60": "MY",
  "62": "ID",
  "63": "PH",
  "65": "SG",
  "66": "TH",
  "84": "VN",
  "86": "CN",
  "81": "JP",
  "82": "KR",
  "61": "AU",
  "64": "NZ",
};

function phoneCodeToIso(phoneCode: string | undefined): CountryCode | undefined {
  if (!phoneCode) return undefined;
  return PHONE_CODE_TO_ISO[phoneCode.replace(/^\+/, "")];
}

// Returns the expected national number length(s) for the country. We pick
// the example mobile number from libphonenumber so the limit auto-tracks
// the official numbering plan (Pakistan = 10 national digits, etc.).
function expectedNationalLength(iso: CountryCode | undefined): number | undefined {
  if (!iso) return undefined;
  const example = getExampleNumber(iso, examples);
  return example?.nationalNumber.length;
}

interface PhoneValidationResult {
  ok: boolean;
  reason?: "empty" | "no-digits" | "too-short" | "too-long" | "invalid";
  // Translation key + interpolation params for the failure message — the
  // caller (inside the component, where `t` is available) resolves this
  // to localized text. Kept as key/params rather than a resolved string
  // since this helper lives outside the component.
  messageKey?: string;
  messageParams?: Record<string, unknown>;
}

// Run a phone string through libphonenumber-js. When a country is
// selected we use national-mode parsing (so the user can drop the +CC),
// otherwise we treat the input as international and require the +.
function validatePhone(
  raw: string,
  iso: CountryCode | undefined,
): PhoneValidationResult {
  const trimmed = (raw ?? "").trim();
  if (!trimmed) {
    return { ok: false, reason: "empty", messageKey: "contacts_section.phone_validation.required" };
  }
  // Reject inputs that are just punctuation / dashes / spaces.
  if (!/\d/.test(trimmed)) {
    return {
      ok: false,
      reason: "no-digits",
      messageKey: "contacts_section.phone_validation.no_digits",
    };
  }
  const parsed = parsePhoneNumberFromString(trimmed, iso);
  if (!parsed) {
    return {
      ok: false,
      reason: "invalid",
      messageKey: iso
        ? "contacts_section.phone_validation.invalid_for_country"
        : "contacts_section.phone_validation.invalid_international",
    };
  }
  // If we know the country, gate strictly on its national length.
  const expected = expectedNationalLength(iso);
  if (expected !== undefined) {
    const actual = parsed.nationalNumber.length;
    if (actual < expected) {
      return {
        ok: false,
        reason: "too-short",
        messageKey: "contacts_section.phone_validation.too_short",
        messageParams: { expected },
      };
    }
    if (actual > expected) {
      return {
        ok: false,
        reason: "too-long",
        messageKey: "contacts_section.phone_validation.too_long",
        messageParams: { expected },
      };
    }
  }
  if (!parsed.isValid()) {
    return {
      ok: false,
      reason: "invalid",
      messageKey: "contacts_section.phone_validation.not_valid",
    };
  }
  return { ok: true };
}

type SortDirection = "asc" | "desc" | "default";

interface SortState {
  column: string | null;
  direction: SortDirection;
}

interface SortEntry {
  id: string;
  column: string;
  direction: "asc" | "desc";
}

interface FilterEntry {
  id: string;
  column: string;
  operator: string;
  value: string;
}

interface Contact {
  id: string;
  name: string;
  phoneNumber: string;
  tags: string[];
  createdAt: string;
  lastActive: string;
  updatedBy: string;
}

// Per-contact avatar colors. Full class strings kept literal so Tailwind JIT picks them up.
const AVATAR_COLORS = [
  "bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800/50",
  "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/50",
  "bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800/50",
  "bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-800/50",
  "bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400 border-violet-200 dark:border-violet-800/50",
  "bg-cyan-100 dark:bg-cyan-900/30 text-cyan-600 dark:text-cyan-400 border-cyan-200 dark:border-cyan-800/50",
  "bg-fuchsia-100 dark:bg-fuchsia-900/30 text-fuchsia-600 dark:text-fuchsia-400 border-fuchsia-200 dark:border-fuchsia-800/50",
  "bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 border-orange-200 dark:border-orange-800/50",
];

// Same name → same color (consistent across renders).
function getAvatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) | 0;
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

export default function ContactsSection() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const workspaceTz = useWorkspaceTimezone();
  const searchParams = useSearch();
  const [, setLocation] = useLocation();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  // "Allow" permissions (replyagent $can) — owners pass via the `workspace.*`
  // wildcard, so restricted agents are the only ones gated.
  //  - manage  → Create/Update contacts (Add Contact, Edit, Bulk Edit)
  //  - delete  → Delete contact + Bulk Delete
  //  - export  → Export CSV
  const userPerms = getUserInfo().permissions ?? [];
  const canManageContacts = hasAnyPerm(userPerms, ["workspace.company.manage"]);
  const canDeleteContacts = hasAnyPerm(userPerms, ["workspace.company.delete"]);
  const canExportContacts = hasAnyPerm(userPerms, ["workspace.company.export"]);
  //  - import      → upload a CSV of contacts (replyagent canImportFiles)
  //  - export_psid → export Facebook/Instagram PSIDs (replyagent canExportPSID)
  const canImportContacts = hasAnyPerm(userPerms, ["workspace.company.import"]);
  const canExportPSID = hasAnyPerm(userPerms, ["workspace.company.export_psid"]);

  // Plan-level gate (separate from the role permission above) — the backend
  // rejects import/export outright when the agency's plan doesn't include
  // it, so check this up front and tell the user before they pick a file,
  // rather than letting them go through the whole dialog just to hit a 403.
  const { data: planFeatures } = useQuery({
    queryKey: ["/api/workspaces/plan-features"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/workspaces/plan-features");
      return res.json();
    },
  });
  const planAllowsImportExport = planFeatures?.allow_import_contacts ?? true;

  // Fetch tags
  const { data: tagsResponse } = useQuery({
    queryKey: ["/api/tags/list"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/tags/list");
      return res.json();
    }
  });

  // Real workspace tags only — no hardcoded placeholders (those would create
  // junk tags like "Marketing"/"Test" on save). The add/edit/bulk pickers use
  // these; the top filter prepends an "All" sentinel via tagFilterOptions.
  const realTags = ((tagsResponse?.tags || tagsResponse || []) as any[])
    .map((tg: any) => ({ id: tg.name || tg.id?.toString(), name: tg.name || tg }))
    .filter((tag, index, self) =>
      tag.name && index === self.findIndex((tg) => tg.name === tag.name)
    );
  const contactTagOptions = realTags;
  const tagFilterOptions = [{ id: "__all__", name: t("contacts_section.filters.all") }, ...realTags];

  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  // Fetch contacts. `page`/`rowsPerPage` used to be collected purely for a
  // decorative pagination bar (hardcoded "Page 1 of 1", disabled arrows) —
  // the backend had a hard `take: 50` with no skip/count at all, so
  // anything past the newest 50 contacts (e.g. right after a bulk import)
  // was simply never fetched. Both are now real query params.
  const { data: contactsResponse, isLoading: isLoadingContacts } = useQuery({
    queryKey: ["/api/contacts", { search, status: statusFilter, page, rowsPerPage }],
    queryFn: async () => {
      const res = await apiRequest(
        "GET",
        `/api/contacts?search=${encodeURIComponent(search)}&page=${page}&limit=${rowsPerPage}`,
      );
      return res.json();
    }
  });
  const contactsTotal: number = contactsResponse?.total ?? 0;
  const contactsPages: number = contactsResponse?.pages ?? 1;

  // Any change to what's being asked for (search text, status tab, or page
  // size) invalidates which page makes sense — always land back on page 1
  // rather than showing a now-meaningless "page 4 of 1".
  useEffect(() => {
    setPage(1);
  }, [search, statusFilter, rowsPerPage]);

  // Country dial codes for the Add Contact phone field. replyagent stores a
  // number as +<dialcode><national>, so we need the country to normalise local
  // input. Cached forever (custom-fields/countries is static).
  const { data: countriesResponse } = useQuery({
    queryKey: ["/api/custom-fields/countries"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/custom-fields/countries");
      return res.json();
    },
    staleTime: Infinity,
  });
  const countries: { id: string; name: string; phone_code: string }[] = Array.isArray(countriesResponse)
    ? countriesResponse
    : (countriesResponse?.data || countriesResponse?.countries || []);
  // Same "PK" default the Add Contact flag chip uses, resolved to a real
  // countries.id — used as the CSV import's default country until the user
  // picks a different one.
  const pkDialCode = STATIC_COUNTRIES.find((c) => c.code === "PK")?.dial;
  const defaultImportCountryId = pkDialCode
    ? countries.find((c) => `+${(c.phone_code || "").replace(/^\+/, "")}` === pkDialCode)?.id
    : undefined;

  // Map backend contacts to frontend format
  const contacts: Contact[] = (contactsResponse?.contacts || contactsResponse || []).map((c: any) => ({
    id: (c.id || '').toString(),
    name: c.full_name || `${c.first_name || ''} ${c.last_name || ''}`.trim() || 'No Name',
    // Keep the raw value (empty string when missing) — the UI renders a
    // "-" placeholder, but filters need to see the actual data so the
    // "is empty" / "is not empty" operators behave correctly. Earlier
    // this stored the literal "-" sentinel, which broke filtering for
    // contacts that have no phone number on file.
    phoneNumber: c.primary_mobile || '',
    tags: (c.tag_links || []).map((tl: any) => tl.tags?.name || tl.name || tl).filter(Boolean),
    // Be permissive about field names + fall back to updated_at when
    // created_at is null (legacy rows from before we started stamping it
    // on create). Same goes for lastActive.
    createdAt: (() => {
      const raw = c.created_at ?? c.createdAt ?? c.updated_at ?? c.updatedAt;
      if (!raw) return "";
      const d = new Date(raw);
      return Number.isNaN(d.getTime()) ? "" : formatInWorkspaceTz(d, "yyyy-MM-dd", workspaceTz);
    })(),
    lastActive: (() => {
      const raw = c.updated_at ?? c.updatedAt ?? c.created_at ?? c.createdAt;
      if (!raw) return "";
      const d = new Date(raw);
      return Number.isNaN(d.getTime()) ? "" : formatInWorkspaceTz(d, "yyyy-MM-dd", workspaceTz);
    })(),
    updatedBy: 'System'
  }));

  // Auto-open contact from URL ?open=ID — open modal directly without needing contact in list
  useEffect(() => {
    const params = new URLSearchParams(searchParams);
    const openId = params.get("open");
    if (!openId) return;
    setSelectedContactForDetails({ id: openId, name: '' } as any);
    setShowDetailsModal(true);
    setLocation("/contacts", { replace: true });
  }, [searchParams]);

  // Add Mutation
  // ─── Add / Delete / Update mutations with optimistic updates ──────────
  // The previous flow waited on the server response before closing the
  // modal AND triggered a refetch which made the UI feel sluggish (~1-2s
  // gap). We now apply the change to the cached query results immediately
  // and roll back if the server rejects — list updates the moment the
  // user clicks Save / Delete.
  const addMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/contacts", data);
      return res.json();
    },
    onMutate: async (newData) => {
      await queryClient.cancelQueries({ queryKey: ["/api/contacts"] });
      const queries = queryClient.getQueriesData<any>({ queryKey: ["/api/contacts"] });
      const tempId = `temp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      const tempContact = {
        id: tempId,
        first_name: newData.first_name,
        last_name: newData.last_name,
        full_name: `${newData.first_name ?? ""} ${newData.last_name ?? ""}`.trim(),
        primary_mobile: newData.phone,
        tag_links: (newData.tags ?? []).map((name: string) => ({ tags: { name } })),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        _optimistic: true,
      };
      // Prepend to every cached /api/contacts query (the list is keyed by
      // search/status so there can be several). Be defensive about shape.
      queries.forEach(([key, value]) => {
        if (!value) return;
        if (Array.isArray(value)) {
          queryClient.setQueryData(key, [tempContact, ...value]);
        } else if (Array.isArray(value.contacts)) {
          queryClient.setQueryData(key, { ...value, contacts: [tempContact, ...value.contacts] });
        }
      });
      // Close modal + reset form immediately — server roundtrip happens
      // in the background.
      setShowAddContactModal(false);
      setNewContactName("");
      setNewContactPhone("");
      setNewContactCountryId("");
      setNewContactCountryIso("PK");
      setNewContactTags([]);
      toast({ title: t("contacts_section.toasts.contact_added") });
      return { queries, tempId };
    },
    onError: (err: any, _vars, context) => {
      // Roll the optimistic insert back so the user doesn't see a ghost row.
      if (context?.queries) {
        context.queries.forEach(([key, value]) => {
          queryClient.setQueryData(key, value);
        });
      }
      let msg: string = err?.message ?? "";
      try {
        const parsed = JSON.parse(msg);
        if (parsed?.message) msg = Array.isArray(parsed.message) ? parsed.message.join(", ") : parsed.message;
      } catch { /* plain string */ }
      const isLimit = /reached the limit/i.test(msg);
      const isDup = /already exists/i.test(msg);
      toast({
        title: isLimit
          ? t("contacts_section.toasts.contact_limit_reached")
          : isDup
            ? t("contacts_section.toasts.duplicate_contact")
            : t("contacts_section.toasts.error"),
        description: isLimit
          ? t("contacts_section.toasts.contact_limit_reached_desc")
          : msg,
        variant: "destructive",
      });
    },
    onSettled: () => {
      // Final reconciliation with the server: replaces the temp row with
      // the real one (real id, normalised phone, etc.) without ever
      // showing an empty list in between.
      queryClient.invalidateQueries({ queryKey: ["/api/contacts"] });
    },
  });

  // ── Import (CSV) ── native CSV import (replyagent canImportFiles equivalent).
  // Backend `POST /api/contacts/import/csv` accepts the raw CSV text and dedups
  // by email/phone, auto-creating tags. Header columns expected:
  // first_name, last_name, email, phone, tags (tags ';'-separated).
  const [showImportModal, setShowImportModal] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importResult, setImportResult] = useState<{ created: number; updated: number; total: number } | null>(null);
  const importInputRef = useRef<HTMLInputElement | null>(null);
  // Country assumed for any phone number in the file that isn't already in
  // full international form (no leading + or 00) — e.g. a local "0300..."
  // row. Defaults to Pakistan like the rest of this page (newContactCountryIso).
  const [importCountryId, setImportCountryId] = useState<string>("");

  const importMutation = useMutation({
    mutationFn: async (csv: string) => {
      const res = await apiRequest("POST", "/api/contacts/import/csv", {
        csv,
        default_country_id: importCountryId || defaultImportCountryId || undefined,
      });
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/contacts"] });
      setImportResult({
        created: data?.created ?? 0,
        updated: data?.updated ?? 0,
        total: data?.total ?? 0,
      });
      toast({
        title: t("contacts_section.toasts.import_complete"),
        description: t("contacts_section.toasts.import_complete_desc", {
          created: data?.created ?? 0,
          updated: data?.updated ?? 0,
        }),
      });
    },
    onError: (err: any) => {
      let msg: string = err?.message ?? "";
      try {
        const parsed = JSON.parse(msg);
        if (parsed?.message) msg = Array.isArray(parsed.message) ? parsed.message.join(", ") : parsed.message;
      } catch { /* plain string */ }
      toast({ title: t("contacts_section.toasts.import_failed"), description: msg || t("contacts_section.toasts.import_failed_desc"), variant: "destructive" });
    },
  });

  const handleRunImport = async () => {
    if (!importFile) return;
    const text = await importFile.text();
    importMutation.mutate(text);
  };

  const handleCloseImport = () => {
    setShowImportModal(false);
    setImportFile(null);
    setImportResult(null);
    if (importInputRef.current) importInputRef.current.value = "";
  };

  const downloadImportTemplate = () => {
    const csv = "first_name,last_name,email,phone,tags\nJohn,Doe,john@example.com,+12025550123,vip;newsletter\n";
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "contacts-import-template.csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Delete Mutation — optimistic removal so the row disappears the
  // moment the user confirms.
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/contacts/${id}`);
    },
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ["/api/contacts"] });
      const queries = queryClient.getQueriesData<any>({ queryKey: ["/api/contacts"] });
      queries.forEach(([key, value]) => {
        if (!value) return;
        if (Array.isArray(value)) {
          queryClient.setQueryData(key, value.filter((c: any) => String(c.id) !== String(id)));
        } else if (Array.isArray(value.contacts)) {
          queryClient.setQueryData(key, {
            ...value,
            contacts: value.contacts.filter((c: any) => String(c.id) !== String(id)),
          });
        }
      });
      setShowDeleteContactModal(false);
      toast({ title: t("contacts_section.toasts.contact_deleted") });
      return { queries };
    },
    onError: (err: any, _vars, context) => {
      if (context?.queries) {
        context.queries.forEach(([key, value]) => queryClient.setQueryData(key, value));
      }
      let msg: string = err?.message ?? t("contacts_section.toasts.delete_failed_desc");
      try {
        const parsed = JSON.parse(msg);
        if (parsed?.message)
          msg = Array.isArray(parsed.message) ? parsed.message.join(", ") : parsed.message;
      } catch { /* plain string */ }
      toast({ title: t("contacts_section.toasts.delete_failed"), description: msg, variant: "destructive" });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contacts"] });
    },
  });

  // Update Mutation — optimistic patch so the row updates instantly.
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string, data: any }) => {
      const res = await apiRequest("PATCH", `/api/contacts/${id}`, data);
      return res.json();
    },
    onMutate: async ({ id, data }) => {
      await queryClient.cancelQueries({ queryKey: ["/api/contacts"] });
      const queries = queryClient.getQueriesData<any>({ queryKey: ["/api/contacts"] });
      const patchRow = (row: any): any =>
        String(row.id) === String(id)
          ? {
              ...row,
              first_name: data.first_name ?? row.first_name,
              last_name: data.last_name ?? row.last_name,
              full_name: `${data.first_name ?? row.first_name ?? ""} ${data.last_name ?? row.last_name ?? ""}`.trim(),
              primary_mobile: data.phone ?? row.primary_mobile,
              tag_links: data.tags
                ? data.tags.map((name: string) => ({ tags: { name } }))
                : row.tag_links,
              updated_at: new Date().toISOString(),
            }
          : row;
      queries.forEach(([key, value]) => {
        if (!value) return;
        if (Array.isArray(value)) {
          queryClient.setQueryData(key, value.map(patchRow));
        } else if (Array.isArray(value.contacts)) {
          queryClient.setQueryData(key, { ...value, contacts: value.contacts.map(patchRow) });
        }
      });
      setShowEditContactModal(false);
      setEditingContact(null);
      setEditContactCountryIso("PK");
      setEditContactName("");
      setEditContactPhone("");
      setEditContactTags([]);
      setEditTagInput("");
      toast({ title: t("contacts_section.toasts.contact_updated") });
      return { queries };
    },
    onError: (err: any, _vars, context) => {
      if (context?.queries) {
        context.queries.forEach(([key, value]) => queryClient.setQueryData(key, value));
      }
      let msg: string = err?.message ?? t("contacts_section.toasts.update_failed_desc");
      try {
        const parsed = JSON.parse(msg);
        if (parsed?.message)
          msg = Array.isArray(parsed.message) ? parsed.message.join(", ") : parsed.message;
      } catch { /* plain string */ }
      toast({ title: t("contacts_section.toasts.update_failed"), description: msg, variant: "destructive" });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contacts"] });
    },
  });

  const currentUserName = "Demo User";
  const [sorts, setSorts] = useState<SortEntry[]>([]);
  const [filters, setFilters] = useState<FilterEntry[]>([]);
  const [showSort, setShowSort] = useState(false);
  const [showFilter, setShowFilter] = useState(false);
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [createdAtRange, setCreatedAtRange] = useState<DateRange | undefined>(undefined);
  const [lastActiveRange, setLastActiveRange] = useState<DateRange | undefined>(undefined);
  const [createdAtOpen, setCreatedAtOpen] = useState(false);
  const [lastActiveOpen, setLastActiveOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const sortDropdownRef = useRef<HTMLDivElement>(null);
  const filterDropdownRef = useRef<HTMLDivElement>(null);
  const [rowsDropdownOpen, setRowsDropdownOpen] = useState(false);

  // Contact Details Modal State
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedContactForDetails, setSelectedContactForDetails] = useState<Contact | null>(null);

  // Add Contact Modal State
  const [showAddContactModal, setShowAddContactModal] = useState(false);
  const [newContactName, setNewContactName] = useState("");
  const [newContactPhone, setNewContactPhone] = useState("");
  const [newContactCountryId, setNewContactCountryId] = useState<string>("");
  // ISO-2 country code driving the flag/dial-code picker. The backend
  // still expects `country_id` on save, so on submit we resolve the ISO
  // back to the matching workspace-country row via the shared dial code.
  const [newContactCountryIso, setNewContactCountryIso] = useState<string>("PK");
  const [newContactTags, setNewContactTags] = useState<string[]>([]);
  const [newTagInput, setNewTagInput] = useState("");

  // Edit Contact Modal State
  const [showEditContactModal, setShowEditContactModal] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [editContactName, setEditContactName] = useState("");
  const [editContactPhone, setEditContactPhone] = useState("");
  // ISO-2 driving the edit modal's flag picker. Pre-filled from the
  // saved contact's E.164 phone on open (falls back to PK).
  const [editContactCountryIso, setEditContactCountryIso] = useState<string>("PK");
  const [editContactTags, setEditContactTags] = useState<string[]>([]);
  const [editTagInput, setEditTagInput] = useState("");

  // Delete Contact Modal State
  const [showDeleteContactModal, setShowDeleteContactModal] = useState(false);
  const [contactToDelete, setContactToDelete] = useState<Contact | null>(null);

  // Bulk Edit Modal State
  const [showBulkEditModal, setShowBulkEditModal] = useState(false);
  const [bulkEditTags, setBulkEditTags] = useState<string[]>([]);
  const [bulkTagInput, setBulkTagInput] = useState("");

  // Bulk Delete Modal State
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);

  const [draggedSortId, setDraggedSortId] = useState<string | null>(null);
  const [openSortColumnDropdown, setOpenSortColumnDropdown] = useState<string | null>(null);
  const [openSortDirectionDropdown, setOpenSortDirectionDropdown] = useState<string | null>(null);
  const [draggedFilterId, setDraggedFilterId] = useState<string | null>(null);
  const [openFilterColumnDropdown, setOpenFilterColumnDropdown] = useState<string | null>(null);
  const [openFilterOperatorDropdown, setOpenFilterOperatorDropdown] = useState<string | null>(null);

  // Shared label for the sort/filter column pickers.
  const columnLabel = (col: string) => {
    switch (col) {
      case "name": return t("contacts_section.table.name");
      case "phoneNumber": return t("contacts_section.table.phone_number");
      case "createdAt": return t("contacts_section.table.created_at");
      case "lastActive": return t("contacts_section.table.last_active");
      default: return t("contacts_section.table.updated_by");
    }
  };

  // Display label for a filter operator — the underlying `operator` value
  // stored in state stays the raw English string (it drives comparison
  // logic in getFilteredAndSortedData), only the label shown is localized.
  const operatorLabel = (op: string) => {
    switch (op) {
      case "contains": return t("contacts_section.filter_panel.operator_contains");
      case "does not contain": return t("contacts_section.filter_panel.operator_not_contains");
      case "is": return t("contacts_section.filter_panel.operator_is");
      case "is not": return t("contacts_section.filter_panel.operator_is_not");
      case "is empty": return t("contacts_section.filter_panel.operator_is_empty");
      case "is not empty": return t("contacts_section.filter_panel.operator_is_not_empty");
      default: return op;
    }
  };

  const addSort = () => {
    const availableColumns = ["name", "phoneNumber", "createdAt", "lastActive", "updatedBy"];
    const usedColumns = sorts.map(s => s.column);
    const nextColumn = availableColumns.find(col => !usedColumns.includes(col)) || "name";
    setSorts([...sorts, { id: Date.now().toString(), column: nextColumn, direction: "asc" }]);
  };

  const removeSort = (id: string) => {
    setSorts(sorts.filter(s => s.id !== id));
  };

  const updateSort = (id: string, column: string, direction: "asc" | "desc") => {
    // Check if this column is already used by another sort entry
    if (sorts.some(s => s.id !== id && s.column === column)) {
      return; // Don't allow duplicate columns
    }
    setSorts(sorts.map(s => s.id === id ? { ...s, column, direction } : s));
  };

  const handleSortDragStart = (id: string) => {
    setDraggedSortId(id);
  };

  const handleSortDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleSortDrop = (targetId: string) => {
    if (!draggedSortId || draggedSortId === targetId) return;

    const draggedIndex = sorts.findIndex(s => s.id === draggedSortId);
    const targetIndex = sorts.findIndex(s => s.id === targetId);

    const newSorts = [...sorts];
    [newSorts[draggedIndex], newSorts[targetIndex]] = [newSorts[targetIndex], newSorts[draggedIndex]];
    setSorts(newSorts);
    setDraggedSortId(null);
  };

  const canAddSort = (column: string) => {
    return !sorts.some(s => s.column === column);
  };

  const handleFilterDragStart = (id: string) => {
    setDraggedFilterId(id);
  };

  const handleFilterDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleFilterDrop = (targetId: string) => {
    if (!draggedFilterId || draggedFilterId === targetId) return;

    const draggedIndex = filters.findIndex(f => f.id === draggedFilterId);
    const targetIndex = filters.findIndex(f => f.id === targetId);

    const newFilters = [...filters];
    [newFilters[draggedIndex], newFilters[targetIndex]] = [newFilters[targetIndex], newFilters[draggedIndex]];
    setFilters(newFilters);
    setDraggedFilterId(null);
  };



  const addFilter = () => {
    setFilters([...filters, { id: Date.now().toString(), column: "name", operator: "contains", value: "" }]);
  };

  const removeFilter = (id: string) => {
    setFilters(filters.filter(f => f.id !== id));
  };

  const updateFilter = (id: string, column: string, operator: string, value: string) => {
    setFilters(filters.map(f => f.id === id ? { ...f, column, operator, value } : f));
  };

  const getFilteredAndSortedData = () => {
    let data = [...contacts];

    // Apply search — phone may be empty (contact without a number), so
    // skip the phone match in that case instead of relying on every row
    // having a phoneNumber.
    if (search) {
      const needle = search.toLowerCase();
      data = data.filter((item) => {
        if (item.name.toLowerCase().includes(needle)) return true;
        if (item.phoneNumber && item.phoneNumber.toLowerCase().includes(needle))
          return true;
        return false;
      });
    }

    // Apply tag filter
    if (selectedTags.length > 0 && !selectedTags.includes("__all__")) {
      data = data.filter(item => selectedTags.some(tag => item.tags.includes(tag)));
    }

    // Apply date range filters
    if (createdAtRange?.from || createdAtRange?.to) {
      data = data.filter(item => {
        const itemDate = new Date(item.createdAt);
        if (createdAtRange.from && itemDate < createdAtRange.from) return false;
        if (createdAtRange.to) {
          const endDate = new Date(createdAtRange.to);
          endDate.setHours(23, 59, 59, 999);
          if (itemDate > endDate) return false;
        }
        return true;
      });
    }

    if (lastActiveRange?.from || lastActiveRange?.to) {
      data = data.filter(item => {
        const itemDate = new Date(item.lastActive);
        if (lastActiveRange.from && itemDate < lastActiveRange.from) return false;
        if (lastActiveRange.to) {
          const endDate = new Date(lastActiveRange.to);
          endDate.setHours(23, 59, 59, 999);
          if (itemDate > endDate) return false;
        }
        return true;
      });
    }

    // Apply custom filters
    data = data.filter(item => {
      return filters.every(filter => {
        const itemValue = item[filter.column as keyof Contact];
        if (typeof itemValue !== "string") return true;

        switch (filter.operator) {
          case "contains":
            return itemValue.toLowerCase().includes(filter.value.toLowerCase());
          case "does not contain":
            return !itemValue.toLowerCase().includes(filter.value.toLowerCase());
          case "is":
            return itemValue.toLowerCase() === filter.value.toLowerCase();
          case "is not":
            return itemValue.toLowerCase() !== filter.value.toLowerCase();
          case "is empty":
            return itemValue === "";
          case "is not empty":
            return itemValue !== "";
          default:
            return true;
        }
      });
    });

    // Apply sorting - Excel-style multi-level sort
    if (sorts.length > 0) {
      data.sort((a, b) => {
        for (const sort of sorts) {
          const aVal = a[sort.column as keyof Contact];
          const bVal = b[sort.column as keyof Contact];

          let comparison = 0;
          if (typeof aVal === "string" && typeof bVal === "string") {
            comparison = sort.direction === "asc" ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
          }

          // If values are different, return the comparison result
          if (comparison !== 0) {
            return comparison;
          }
          // If values are equal, continue to next sort criterion
        }
        return 0; // All criteria are equal
      });
    }

    return data;
  };

  const toggleRowSelection = (id: string) => {
    const newSelected = new Set(selectedRows);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedRows(newSelected);
  };

  const toggleAllRows = () => {
    const data = getFilteredAndSortedData();
    if (selectedRows.size === data.length) {
      setSelectedRows(new Set());
    } else {
      setSelectedRows(new Set(data.map(c => c.id)));
    }
  };

  const handleEditContact = (contact: Contact) => {
    setEditingContact(contact);
    setEditContactName(contact.name);
    // Parse the stored E.164 phone (e.g. "+923001234567") so the flag
    // picker lands on the right country and the input only shows the
    // national portion — otherwise the user would see the +CC prefix
    // duplicated once they type.
    const raw = contact.phoneNumber || "";
    const parsed = parsePhoneNumberFromString(raw);
    if (parsed) {
      setEditContactCountryIso(parsed.country ?? "PK");
      setEditContactPhone(parsed.nationalNumber);
    } else {
      setEditContactCountryIso("PK");
      setEditContactPhone(raw.replace(/^\+/, ""));
    }
    setEditContactTags([...contact.tags]);
    setEditTagInput("");
    setShowEditContactModal(true);
  };

  const handleCopyContact = (contact: Contact) => {
    const contactText = `${contact.name} - ${contact.phoneNumber}`;
    navigator.clipboard.writeText(contactText);
    toast({
      title: t("contacts_section.toasts.copied_to_clipboard"),
      description: contactText,
    });
  };

  const handleDeleteContact = (contact: Contact) => {
    setContactToDelete(contact);
    setShowDeleteContactModal(true);
  };

  const handleConfirmDelete = () => {
    if (contactToDelete) {
      deleteMutation.mutate(contactToDelete.id);
    }
  };

  const handleOpenBulkEdit = () => {
    setBulkEditTags([]);
    setBulkTagInput("");
    setShowBulkEditModal(true);
  };

  const handleAddBulkTag = () => {
    if (bulkTagInput.trim() && !bulkEditTags.includes(bulkTagInput.trim())) {
      setBulkEditTags([...bulkEditTags, bulkTagInput.trim()]);
      setBulkTagInput("");
    }
  };

  const handleRemoveBulkTag = (tag: string) => {
    setBulkEditTags(bulkEditTags.filter(tg => tg !== tag));
  };

  const handleToggleBulkTag = (tag: string) => {
    if (bulkEditTags.includes(tag)) {
      setBulkEditTags(bulkEditTags.filter(tg => tg !== tag));
    } else {
      setBulkEditTags([...bulkEditTags, tag]);
    }
  };

  const handleSaveBulkEdit = async () => {
    const selectedContactIds = Array.from(selectedRows);
    try {
      await Promise.all(selectedContactIds.map(id =>
        apiRequest("PATCH", `/api/contacts/${id}`, { tags: bulkEditTags })
      ));
      toast({
        title: t("contacts_section.toasts.contacts_updated"),
        description: t("contacts_section.toasts.tags_updated_for_count", { count: selectedContactIds.length }),
      });
      queryClient.invalidateQueries({ queryKey: ["/api/contacts"] });
      setShowBulkEditModal(false);
      setSelectedRows(new Set());
    } catch (error) {
      toast({ title: t("contacts_section.toasts.error"), description: t("contacts_section.toasts.failed_update_contacts"), variant: "destructive" });
    }
  };

  const handleOpenBulkDelete = () => {
    setShowBulkDeleteModal(true);
  };

  const handleConfirmBulkDelete = async () => {
    const selectedContactIds = Array.from(selectedRows);
    try {
      await Promise.all(selectedContactIds.map(id =>
        apiRequest("DELETE", `/api/contacts/${id}`)
      ));
      toast({
        title: t("contacts_section.toasts.contacts_deleted"),
        description: t("contacts_section.toasts.contacts_deleted_desc", { count: selectedContactIds.length }),
      });
      queryClient.invalidateQueries({ queryKey: ["/api/contacts"] });
      setShowBulkDeleteModal(false);
      setSelectedRows(new Set());
    } catch (error) {
      toast({ title: t("contacts_section.toasts.error"), description: t("contacts_section.toasts.failed_delete_contacts"), variant: "destructive" });
    }
  };

  const handleAddTag = () => {
    if (newTagInput.trim() && !newContactTags.includes(newTagInput.trim())) {
      setNewContactTags([...newContactTags, newTagInput.trim()]);
      setNewTagInput("");
    }
  };

  const handleRemoveTag = (tag: string) => {
    setNewContactTags(newContactTags.filter(tg => tg !== tag));
  };

  const handleToggleTag = (tag: string) => {
    if (newContactTags.includes(tag)) {
      handleRemoveTag(tag);
    } else {
      setNewContactTags([...newContactTags, tag]);
    }
  };

  const handleAddEditTag = () => {
    if (editTagInput.trim() && !editContactTags.includes(editTagInput.trim())) {
      setEditContactTags([...editContactTags, editTagInput.trim()]);
      setEditTagInput("");
    }
  };

  const handleRemoveEditTag = (tag: string) => {
    setEditContactTags(editContactTags.filter(tg => tg !== tag));
  };

  const handleToggleEditTag = (tag: string) => {
    if (editContactTags.includes(tag)) {
      handleRemoveEditTag(tag);
    } else {
      setEditContactTags([...editContactTags, tag]);
    }
  };

  const handleSaveContact = () => {
    if (!newContactName.trim()) {
      toast({
        title: t("contacts_section.toasts.missing_fields"),
        description: t("contacts_section.toasts.enter_name"),
        variant: "destructive",
      });
      return;
    }
    // Phone is mandatory and must be a real number — not a dash, "abc",
    // or a too-short / too-long string. We validate against the ISO-2
    // code picked in the flag chip; the workspace country_id (if we
    // could resolve one) rides along on the save payload for the
    // backend's normalizeMobile step.
    const iso = (newContactCountryIso || "PK") as any;
    const phoneResult = validatePhone(newContactPhone, iso);
    if (!phoneResult.ok) {
      toast({
        title: t("contacts_section.toasts.invalid_phone"),
        description: phoneResult.messageKey
          ? t(phoneResult.messageKey, phoneResult.messageParams)
          : t("contacts_section.toasts.enter_valid_phone"),
        variant: "destructive",
      });
      return;
    }
    const names = newContactName.trim().split(" ");
    addMutation.mutate({
      first_name: names[0],
      last_name: names.slice(1).join(" "),
      phone: newContactPhone.trim(),
      country_id: newContactCountryId || undefined,
      tags: newContactTags,
    });
  };

  const handleSaveEditContact = () => {
    if (!editContactName.trim()) {
      toast({
        title: t("contacts_section.toasts.missing_fields"),
        description: t("contacts_section.toasts.enter_name"),
        variant: "destructive",
      });
      return;
    }
    // Same libphonenumber-js gate as Add so an edit can't slip a bad
    // number in. Uses the ISO from the flag chip so validation matches
    // what the user visually picked.
    const iso = (editContactCountryIso || "PK") as any;
    const phoneResult = validatePhone(editContactPhone, iso);
    if (!phoneResult.ok) {
      toast({
        title: t("contacts_section.toasts.invalid_phone"),
        description: phoneResult.messageKey
          ? t(phoneResult.messageKey, phoneResult.messageParams)
          : t("contacts_section.toasts.enter_valid_phone"),
        variant: "destructive",
      });
      return;
    }
    if (editingContact) {
      const names = editContactName.split(' ');
      // Resolve the picked ISO back to the workspace country_id so the
      // backend's normalizeMobile step picks the right dial code.
      const dial = STATIC_COUNTRIES.find((c) => c.code === iso)?.dial;
      const matchedId = dial
        ? countries.find(
            (c) => `+${(c.phone_code || "").replace(/^\+/, "")}` === dial,
          )?.id
        : undefined;
      updateMutation.mutate({
        id: editingContact.id,
        data: {
          first_name: names[0],
          last_name: names.slice(1).join(' '),
          phone: editContactPhone.trim(),
          country_id: matchedId,
          tags: editContactTags,
        },
      });
    }
  };

  const handleExportSelectedAsCSV = () => {
    if (!planAllowsImportExport) {
      toast({
        title: t("contacts_section.toasts.not_available_on_plan"),
        description: t("contacts_section.toasts.not_available_on_plan_desc"),
        variant: "destructive",
      });
      return;
    }
    if (selectedRows.size === 0) {
      toast({
        title: t("contacts_section.toasts.no_contacts_selected"),
        description: t("contacts_section.toasts.select_contact_to_export"),
        variant: "destructive",
      });
      return;
    }

    const selectedContacts = contacts.filter(c => selectedRows.has(c.id));

    // Helper function to escape CSV values
    const escapeCSV = (value: string) => {
      if (value.includes(",") || value.includes('"') || value.includes("\n")) {
        return `"${value.replace(/"/g, '""')}"`;
      }
      return value;
    };

    // CSV headers
    const headers = [
      t("contacts_section.table.id"),
      t("contacts_section.table.name"),
      t("contacts_section.table.phone_number"),
      t("contacts_section.table.tags"),
      t("contacts_section.table.created_at"),
      t("contacts_section.table.last_active"),
      t("contacts_section.table.updated_by"),
    ];

    // CSV rows
    const rows = selectedContacts.map(contact => [
      escapeCSV(contact.id),
      escapeCSV(contact.name),
      escapeCSV(contact.phoneNumber.replace(/^\+/, "")), // Remove + prefix
      escapeCSV(contact.tags.join(", ")),
      escapeCSV(contact.createdAt),
      escapeCSV(contact.lastActive),
      escapeCSV(contact.updatedBy),
    ]);

    // Combine headers and rows
    const csvContent = [
      headers.join(","),
      ...rows.map(row => row.join(",")),
    ].join("\n");

    // Create blob and download
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);

    link.setAttribute("href", url);
    link.setAttribute("download", `contacts_${new Date().toISOString().split("T")[0]}.csv`);
    link.style.visibility = "hidden";

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast({
      title: t("contacts_section.toasts.export_successful"),
      description: t("contacts_section.toasts.export_successful_csv_desc", { count: selectedContacts.length }),
    });
  };

  // Export Facebook/Instagram PSIDs for the selected contacts. Only
  // INSTAGRAM/MESSENGER contacts produce a row; the backend pulls the
  // page-scoped sender_id from insta_chats / fb_chats.
  const [exportingPSID, setExportingPSID] = useState(false);
  const handleExportPSID = async () => {
    if (!planAllowsImportExport) {
      toast({
        title: t("contacts_section.toasts.not_available_on_plan"),
        description: t("contacts_section.toasts.not_available_on_plan_desc"),
        variant: "destructive",
      });
      return;
    }
    if (selectedRows.size === 0) {
      toast({
        title: t("contacts_section.toasts.no_contacts_selected"),
        description: t("contacts_section.toasts.select_contact_to_export_psid"),
        variant: "destructive",
      });
      return;
    }
    setExportingPSID(true);
    try {
      const ids = Array.from(selectedRows);
      const res = await apiRequest("POST", "/api/contacts/export/psid", { ids });
      const data = await res.json();
      const csv: string = data?.csv ?? "";
      // Header-only CSV → no IG/Messenger PSIDs in the selection.
      if (!csv || csv.trim().split("\n").length <= 1) {
        toast({
          title: t("contacts_section.toasts.no_psids_found"),
          description: t("contacts_section.toasts.no_psids_found_desc"),
        });
        return;
      }
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", data?.filename || "PSID.csv");
      link.style.visibility = "hidden";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast({ title: t("contacts_section.toasts.export_successful"), description: t("contacts_section.toasts.psids_exported_desc") });
    } catch (err: any) {
      let msg: string = err?.message ?? "";
      try {
        const parsed = JSON.parse(msg);
        if (parsed?.message) msg = Array.isArray(parsed.message) ? parsed.message.join(", ") : parsed.message;
      } catch { /* plain string */ }
      toast({ title: t("contacts_section.toasts.export_failed"), description: msg || t("contacts_section.toasts.export_failed_psid_desc"), variant: "destructive" });
    } finally {
      setExportingPSID(false);
    }
  };

  const handleColumnSort = (column: string) => {
    const existingSort = sorts.find(s => s.column === column);
    if (existingSort) {
      if (existingSort.direction === "asc") {
        updateSort(existingSort.id, column, "desc");
      } else {
        removeSort(existingSort.id);
      }
    } else {
      addSort();
      setSorts([...sorts, { id: Date.now().toString(), column, direction: "asc" }]);
    }
  };

  const renderSortIcon = (column: string) => {
    const sort = sorts.find(s => s.column === column);
    const isActive = !!sort;
    const color = isActive ? "text-foreground" : "text-muted-foreground";

    if (!sort) {
      return <div className="w-4 h-4 flex items-center justify-center"><ChevronsUpDown size={14} className={color} /></div>;
    }
    if (sort.direction === "asc") {
      return <div className="w-4 h-4 flex items-center justify-center"><ChevronUp size={14} className={color} /></div>;
    }
    return <div className="w-4 h-4 flex items-center justify-center"><ChevronDown size={14} className={color} /></div>;
  };

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setRowsDropdownOpen(false);
      }
      if (sortDropdownRef.current && !sortDropdownRef.current.contains(event.target as Node)) {
        setShowSort(false);
      }
      if (filterDropdownRef.current && !filterDropdownRef.current.contains(event.target as Node)) {
        setShowFilter(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <>
      <div className="space-y-3 animate-in fade-in duration-700">
        {/* 1. Branded Header Card — standalone floating card matching the
            broadcasts / smart-flows treatment: two-layer drop shadow,
            soft border, gap below via parent's space-y-3. */}
        <div className="bg-white dark:bg-slate-900/50 rounded-[20px] border border-slate-200/70 dark:border-slate-800 shadow-[0_10px_28px_-8px_rgba(15,23,42,0.18),0_4px_10px_-2px_rgba(15,23,42,0.08)] dark:shadow-[0_10px_28px_-6px_rgba(0,0,0,0.55),0_4px_10px_-2px_rgba(0,0,0,0.35)] overflow-hidden">
          <div className="py-1.5 px-5 flex items-center justify-between bg-transparent">
            <div className="flex items-center gap-6">
              <div className="p-2 rounded-xl bg-primary/10 text-primary border border-primary/10 shadow-inner">
                <Users size={20} strokeWidth={2.5} />
              </div>
              <div className="space-y-0.5">
                <h1 className="text-lg font-bold tracking-tight text-slate-900 dark:text-white">
                  {t("contacts_section.header.title")}
                </h1>
                <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                  {t("contacts_section.header.subtitle")}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {canImportContacts && (
                <Button
                  variant="outline"
                  onClick={() => {
                    if (!planAllowsImportExport) {
                      toast({
                        title: t("contacts_section.toasts.not_available_on_plan"),
                        description: t("contacts_section.toasts.not_available_on_plan_desc"),
                        variant: "destructive",
                      });
                      return;
                    }
                    setImportResult(null);
                    setShowImportModal(true);
                  }}
                  className="h-8 px-4 rounded-lg font-semibold text-[11px] transition-all duration-300 active:scale-95 flex items-center gap-2"
                >
                  <Upload size={14} strokeWidth={2.5} />
                  <span>{t("contacts_section.header.import")}</span>
                </Button>
              )}
              {canManageContacts && (
                <Button
                  onClick={() => setShowAddContactModal(true)}
                  className="h-8 px-4 rounded-lg bg-primary text-primary-foreground font-semibold text-[11px] shadow-lg shadow-primary/20 transition-all duration-300 active:scale-95 flex items-center gap-2 border-0 hover:bg-primary/90"
                >
                  <Plus size={14} strokeWidth={2.5} />
                  <span>{t("contacts_section.header.add_contact")}</span>
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* 2. Content Card — filters + table + pagination in their own
            rounded floating card. */}
        <div className="bg-white dark:bg-slate-900/50 rounded-[20px] border border-slate-200/70 dark:border-slate-800 shadow-[0_10px_28px_-8px_rgba(15,23,42,0.18),0_4px_10px_-2px_rgba(15,23,42,0.08)] dark:shadow-[0_10px_28px_-6px_rgba(0,0,0,0.55),0_4px_10px_-2px_rgba(0,0,0,0.35)] overflow-hidden flex flex-col">

          {/* Unified Filter Row Section */}
          {/* 2. Unified Filter Row Section */}
          <div className="px-5 py-2.5 bg-slate-50/50 dark:bg-transparent border-b border-slate-200 dark:border-slate-800/80 flex items-center gap-3 flex-wrap">
            {/* Search Bar - Modernized */}
            <div className="relative group flex-1 min-w-[200px] max-w-[280px]">
              <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                <Search className="h-3.5 w-3.5 text-slate-400 group-focus-within:text-primary transition-colors" />
              </div>
              <input
                type="text"
                placeholder={t("contacts_section.filters.search_placeholder")}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="block w-full pl-9 pr-3 h-9 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-[12px] font-medium placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/10 focus:border-primary/50 transition-all duration-200 shadow-sm shadow-slate-100/50 dark:shadow-none"
              />
            </div>

            {/* Filters */}
            <div className="flex items-center gap-2">
              <CustomDropdown
                options={tagFilterOptions}
                selected={selectedTags}
                onChange={setSelectedTags}
                placeholder={t("contacts_section.filters.tags")}
                width="120px"
                className="!w-[120px]"
                showSelectedOption={true}
                showSearch={false}
                triggerContent={
                  <>
                    <div className="flex items-center gap-2 truncate">
                      <Tag className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                      <span className={cn("truncate text-[12px]", selectedTags.length > 0 ? "text-slate-900 dark:text-white font-bold" : "text-slate-500 dark:text-slate-400")}>
                        {selectedTags.length === 0 || selectedTags.includes("__all__")
                          ? t("contacts_section.filters.all")
                          : tagFilterOptions.find(o => o.id === selectedTags[0])?.name ?? selectedTags[0]}
                      </span>
                    </div>
                    <ChevronDown className="h-3.5 w-3.5 text-slate-400/50 shrink-0" />
                  </>
                }
              />

              {/* Created At Popover */}
              <Popover open={createdAtOpen} onOpenChange={setCreatedAtOpen}>
                <PopoverTrigger asChild>
                  <button style={{ borderRadius: '6px' }} className="h-9 w-[120px] px-3 flex items-center justify-center gap-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 !rounded-md hover:bg-slate-50 dark:hover:bg-slate-800 transition-all text-[11px] font-medium text-slate-600 dark:text-slate-300 shadow-sm border-0">
                    <Calendar size={13} className="text-slate-400" />
                    <span>{createdAtRange?.from ? format(createdAtRange.from, 'dd MMM') : t("contacts_section.filters.created")}</span>
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <CalendarComponent
                    mode="range"
                    selected={createdAtRange}
                    onSelect={setCreatedAtRange}
                  />
                </PopoverContent>
              </Popover>

              <div className="h-6 w-px bg-slate-200 dark:bg-slate-800 mx-1" />

              {/* Sort Button & Dropdown */}
              <div className="relative" ref={sortDropdownRef}>
                <Button
                  onClick={() => setShowSort(!showSort)}
                  variant="outline"
                  style={{ borderRadius: '6px' }}
                  className={cn(
                    "h-9 w-[120px] px-3 !rounded-md text-[11px] font-bold border border-slate-200 dark:border-slate-800 shadow-sm",
                    showSort ? "bg-primary/10 text-primary border-primary/30" : "bg-white text-slate-600"
                  )}
                >
                  <ArrowUpDown size={13} className="mr-2" />
                  {t("contacts_section.filters.sort")} {sorts.length > 0 && `(${sorts.length})`}
                </Button>

                {showSort && (
                  <div className="absolute z-50 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl p-4 top-full mt-2 right-0 min-w-[320px] animate-in slide-in-from-top-2 duration-200">
                    {sorts.length === 0 ? (
                      <div className="text-center py-6">
                        <h3 className="font-semibold text-[13px] text-slate-900 dark:text-white mb-1">{t("contacts_section.sort_panel.empty_title")}</h3>
                        <p className="text-[11px] text-slate-500 mb-4">{t("contacts_section.sort_panel.empty_subtitle")}</p>
                        <Button onClick={addSort} className="h-8 text-[11px] bg-primary text-primary-foreground hover:bg-primary/90">{t("contacts_section.sort_panel.add_sort")}</Button>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {sorts.map((sort) => (
                          <div key={sort.id} className="flex gap-2 items-center" draggable onDragStart={() => handleSortDragStart(sort.id)} onDragOver={handleSortDragOver} onDrop={() => handleSortDrop(sort.id)}>
                            <div className="relative flex-1">
                              <button type="button" onClick={() => setOpenSortColumnDropdown(openSortColumnDropdown === sort.id ? null : sort.id)} className="w-full flex items-center justify-between px-3 h-8 text-left bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg hover:border-primary/50 transition-colors text-[11px]">
                                <span className="truncate font-medium text-slate-700 dark:text-slate-200">{columnLabel(sort.column)}</span>
                                <ChevronDown className="h-3 w-3 text-slate-400" />
                              </button>
                              {openSortColumnDropdown === sort.id && (
                                <div className="absolute z-10 w-full mt-1.5 bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                                  <ul className="py-1">
                                    {["name", "phoneNumber", "createdAt", "lastActive", "updatedBy"].map(option => {
                                      const isCurrentOption = option === sort.column;
                                      const isDisabled = !canAddSort(option) && option !== sort.column;
                                      return (
                                        <li key={option} className={`px-3 py-2 text-[11px] font-medium transition-colors ${isCurrentOption || isDisabled ? "text-slate-300 dark:text-slate-600 cursor-not-allowed" : "cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200"}`} onClick={() => { if (!isDisabled && !isCurrentOption) { updateSort(sort.id, option, sort.direction); setOpenSortColumnDropdown(null); } }}>
                                          {columnLabel(option)}
                                        </li>
                                      );
                                    })}
                                  </ul>
                                </div>
                              )}
                            </div>
                            <div className="relative">
                              <button type="button" onClick={() => setOpenSortDirectionDropdown(openSortDirectionDropdown === sort.id ? null : sort.id)} className="w-[80px] flex items-center justify-between px-3 h-8 text-left bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg hover:border-primary/50 transition-colors text-[11px]">
                                <span className="truncate font-medium text-slate-700 dark:text-slate-200">{sort.direction === "asc" ? t("contacts_section.sort_panel.asc") : t("contacts_section.sort_panel.desc")}</span>
                                <ChevronDown className="h-3 w-3 text-slate-400" />
                              </button>
                              {openSortDirectionDropdown === sort.id && (
                                <div className="absolute z-10 w-full mt-1.5 bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                                  <ul className="py-1">
                                    {["asc", "desc"].map(option => (
                                      <li key={option} className="px-3 py-2 text-[11px] font-medium cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200" onClick={() => { updateSort(sort.id, sort.column, option as "asc" | "desc"); setOpenSortDirectionDropdown(null); }}>
                                        {option === "asc" ? t("contacts_section.sort_panel.asc") : t("contacts_section.sort_panel.desc")}
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                            </div>
                            <button onClick={() => removeSort(sort.id)} className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-lg transition-colors"><Trash2 size={13} /></button>
                            <GripVertical size={13} className="text-slate-300 cursor-grab active:cursor-grabbing" />
                          </div>
                        ))}
                        <div className="flex gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                          <Button onClick={addSort} disabled={sorts.length >= 5} className="h-8 text-[11px] flex-1 bg-white dark:bg-transparent border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800" variant="outline">{t("contacts_section.sort_panel.add_sort")}</Button>
                          <Button onClick={() => setSorts([])} variant="ghost" className="h-8 text-[11px] flex-1 text-slate-500 hover:text-slate-900 hover:bg-transparent dark:hover:text-white">{t("contacts_section.sort_panel.reset_sorts")}</Button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Filter Button & Dropdown */}
              <div className="relative" ref={filterDropdownRef}>
                <Button
                  onClick={() => setShowFilter(!showFilter)}
                  variant="outline"
                  style={{ borderRadius: '6px' }}
                  className={cn(
                    "h-9 w-[120px] px-3 !rounded-md text-[11px] font-bold border border-slate-200 dark:border-slate-800 shadow-sm",
                    showFilter ? "bg-primary/10 text-primary border-primary/30" : "bg-white text-slate-600"
                  )}
                >
                  <Filter size={13} className="mr-2" />
                  {t("contacts_section.filters.filter")} {filters.length > 0 && `(${filters.length})`}
                </Button>

                {showFilter && (
                  <div className="absolute z-50 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl p-4 top-full mt-2 right-0 min-w-[340px] animate-in slide-in-from-top-2 duration-200">
                    {filters.length === 0 ? (
                      <div className="text-center py-6">
                        <h3 className="font-semibold text-[13px] text-slate-900 dark:text-white mb-1">{t("contacts_section.filter_panel.empty_title")}</h3>
                        <p className="text-[11px] text-slate-500 mb-4">{t("contacts_section.filter_panel.empty_subtitle")}</p>
                        <Button onClick={addFilter} className="h-8 text-[11px] bg-primary text-primary-foreground hover:bg-primary/90">{t("contacts_section.filter_panel.add_filter")}</Button>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {filters.map((filter) => (
                          <div key={filter.id} className="flex gap-2 items-center" draggable onDragStart={() => handleFilterDragStart(filter.id)} onDragOver={handleFilterDragOver} onDrop={() => handleFilterDrop(filter.id)}>
                            <div className="relative flex-1">
                              <button type="button" onClick={() => setOpenFilterColumnDropdown(openFilterColumnDropdown === filter.id ? null : filter.id)} className="w-full flex items-center justify-between px-3 h-8 text-left bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg hover:border-primary/50 transition-colors text-[11px]">
                                <span className="truncate font-medium text-slate-700 dark:text-slate-200">{columnLabel(filter.column)}</span>
                                <ChevronDown className="h-3 w-3 text-slate-400" />
                              </button>
                              {openFilterColumnDropdown === filter.id && (
                                <div className="absolute z-10 w-full mt-1.5 bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                                  <ul className="py-1">
                                    {["name", "phoneNumber", "createdAt", "lastActive", "updatedBy"].map(option => {
                                      const isCurrentOption = option === filter.column;
                                      return (
                                        <li key={option} className={`px-3 py-2 text-[11px] font-medium transition-colors ${isCurrentOption ? "text-slate-300 dark:text-slate-600 cursor-not-allowed" : "cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200"}`} onClick={() => { if (!isCurrentOption) { updateFilter(filter.id, option, filter.operator, filter.value); setOpenFilterColumnDropdown(null); } }}>
                                          {columnLabel(option)}
                                        </li>
                                      );
                                    })}
                                  </ul>
                                </div>
                              )}
                            </div>
                            <div className="relative flex-1">
                              <button type="button" onClick={() => setOpenFilterOperatorDropdown(openFilterOperatorDropdown === filter.id ? null : filter.id)} className="w-full flex items-center justify-between px-3 h-8 text-left bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg hover:border-primary/50 transition-colors text-[11px]">
                                <span className="truncate font-medium text-slate-700 dark:text-slate-200">{operatorLabel(filter.operator)}</span>
                                <ChevronDown className="h-3 w-3 text-slate-400" />
                              </button>
                              {openFilterOperatorDropdown === filter.id && (
                                <div className="absolute z-10 w-full mt-1.5 bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                                  <ul className="py-1">
                                    {["contains", "does not contain", "is", "is not", "is empty", "is not empty"].map(option => (
                                      <li key={option} className="px-3 py-2 text-[11px] font-medium cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200" onClick={() => { updateFilter(filter.id, filter.column, option, filter.value); setOpenFilterOperatorDropdown(null); }}>
                                        {operatorLabel(option)}
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                            </div>
                            {filter.operator === "is empty" || filter.operator === "is not empty" ? (
                              <div className="h-8 px-3 text-[11px] font-medium text-slate-400 border border-dashed border-slate-200 dark:border-slate-700 rounded-lg flex items-center justify-center bg-slate-50/40 dark:bg-slate-800/30 flex-1">
                                {t("contacts_section.filter_panel.no_value")}
                              </div>
                            ) : (
                              <input type="text" placeholder={t("contacts_section.filter_panel.value_placeholder")} value={filter.value} onChange={(e) => updateFilter(filter.id, filter.column, filter.operator, e.target.value)} className="h-8 px-3 text-[11px] font-medium border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all bg-slate-50 dark:bg-slate-800/50 flex-1" />
                            )}
                            <button onClick={() => removeFilter(filter.id)} className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-lg transition-colors"><Trash2 size={13} /></button>
                            <GripVertical size={13} className="text-slate-300 cursor-grab active:cursor-grabbing" />
                          </div>
                        ))}
                        <div className="flex gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                          <Button onClick={addFilter} className="h-8 text-[11px] flex-1 bg-white dark:bg-transparent border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800" variant="outline">{t("contacts_section.filter_panel.add_filter")}</Button>
                          <Button onClick={() => setFilters([])} variant="ghost" className="h-8 text-[11px] flex-1 text-slate-500 hover:text-slate-900 hover:bg-transparent dark:hover:text-white">{t("contacts_section.filter_panel.reset_filters")}</Button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* 3. Table Content Area */}
          <div className="flex-1 bg-white dark:bg-transparent">
            {/* Bulk Actions Toolbar */}
            {selectedRows.size > 0 && (
              <div className="px-5 py-2.5 bg-primary/10 dark:bg-primary/10 border-b border-primary/20 dark:border-primary/20 flex items-center justify-between animate-in slide-in-from-top-1 duration-300">
                <div className="flex items-center gap-3">
                  <div className="bg-primary text-primary-foreground text-[10px] font-bold px-2 py-0.5 rounded-full shadow-lg shadow-primary/20">
                    {selectedRows.size}
                  </div>
                  <span className="text-[11px] font-bold text-primary uppercase tracking-tight">{t("contacts_section.bulk_toolbar.contacts_selected")}</span>
                </div>
                <div className="flex items-center gap-2">
                  {canManageContacts && (
                    <Button
                      onClick={handleOpenBulkEdit}
                      className="h-7 px-3 rounded-lg bg-white dark:bg-slate-800 border-primary/30 dark:border-primary/30 text-primary hover:bg-primary/10 dark:hover:bg-primary/15 text-[10px] font-bold transition-all shadow-sm active:scale-95 flex items-center gap-2"
                      variant="outline"
                    >
                      <Edit2 size={13} />
                      <span>{t("contacts_section.bulk_toolbar.edit_tags")}</span>
                    </Button>
                  )}
                  {canExportContacts && (
                    <Button
                      onClick={handleExportSelectedAsCSV}
                      className="h-7 px-3 rounded-lg bg-white dark:bg-slate-800 border-primary/30 dark:border-primary/30 text-primary hover:bg-primary/10 dark:hover:bg-primary/15 text-[10px] font-bold transition-all shadow-sm active:scale-95 flex items-center gap-2"
                      variant="outline"
                    >
                      <Download size={13} />
                      <span>{t("contacts_section.bulk_toolbar.export_csv")}</span>
                    </Button>
                  )}
                  {canExportPSID && (
                    <Button
                      onClick={handleExportPSID}
                      disabled={exportingPSID}
                      className="h-7 px-3 rounded-lg bg-white dark:bg-slate-800 border-primary/30 dark:border-primary/30 text-primary hover:bg-primary/10 dark:hover:bg-primary/15 text-[10px] font-bold transition-all shadow-sm active:scale-95 flex items-center gap-2"
                      variant="outline"
                    >
                      {exportingPSID ? <Loader2 className="h-3 w-3 animate-spin" /> : <Download size={13} />}
                      <span>{t("contacts_section.bulk_toolbar.export_psid")}</span>
                    </Button>
                  )}
                  {canDeleteContacts && (
                    <Button
                      onClick={handleOpenBulkDelete}
                      className="h-7 px-3 rounded-lg bg-white dark:bg-slate-800 border-rose-200 dark:border-rose-900/30 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 text-[10px] font-bold transition-all shadow-sm active:scale-95 flex items-center gap-2"
                      variant="outline"
                    >
                      <Trash2 size={13} />
                      <span>{t("contacts_section.bulk_toolbar.delete_selected")}</span>
                    </Button>
                  )}
                </div>
              </div>
            )}

            {/* Table Area */}
            <div className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-280px)] scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-800">
              <table className="w-full text-xs border-separate border-spacing-0">
                <thead className="select-none sticky top-0 z-20">
                  <tr className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 backdrop-blur-md bg-opacity-95 dark:bg-opacity-95">
                    <th className="text-left py-2 px-4 font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider text-[10px] border-b border-slate-200 dark:border-slate-800">
                      <Checkbox
                        checked={selectedRows.size > 0 && selectedRows.size === getFilteredAndSortedData().length}
                        onCheckedChange={toggleAllRows}
                      />
                    </th>
                    <th
                      className="text-left py-2 px-4 font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider text-[10px] cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors border-b border-slate-200 dark:border-slate-800"
                      onClick={() => handleColumnSort("name")}
                    >
                      <div className="flex items-center gap-2">
                        {t("contacts_section.table.name")}
                        {renderSortIcon("name")}
                      </div>
                    </th>
                    <th
                      className="text-left py-2 px-4 font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider text-[10px] cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors border-b border-slate-200 dark:border-slate-800"
                      onClick={() => handleColumnSort("phoneNumber")}
                    >
                      <div className="flex items-center gap-2">
                        {t("contacts_section.table.phone_number")}
                        {renderSortIcon("phoneNumber")}
                      </div>
                    </th>
                    <th className="text-left py-2 px-4 font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider text-[10px] border-b border-slate-200 dark:border-slate-800">{t("contacts_section.table.tags")}</th>
                    <th
                      className="text-left py-2 px-4 font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider text-[10px] cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors border-b border-slate-200 dark:border-slate-800"
                      onClick={() => handleColumnSort("createdAt")}
                    >
                      <div className="flex items-center gap-2">
                        {t("contacts_section.table.created_at")}
                        {renderSortIcon("createdAt")}
                      </div>
                    </th>
                    <th
                      className="text-left py-2 px-4 font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider text-[10px] cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors border-b border-slate-200 dark:border-slate-800"
                      onClick={() => handleColumnSort("lastActive")}
                    >
                      <div className="flex items-center gap-2">
                        {t("contacts_section.table.last_active")}
                        {renderSortIcon("lastActive")}
                      </div>
                    </th>
                    <th
                      className="text-left py-2 px-4 font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider text-[10px] cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors border-b border-slate-200 dark:border-slate-800"
                      onClick={() => handleColumnSort("updatedBy")}
                    >
                      <div className="flex items-center gap-2">
                        {t("contacts_section.table.updated_by")}
                        {renderSortIcon("updatedBy")}
                      </div>
                    </th>
                    <th className="text-left py-2 px-4 font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider text-[10px] border-b border-slate-200 dark:border-slate-800">{t("contacts_section.table.actions")}</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoadingContacts ? (
                    <tr>
                      <td colSpan={8} className="text-center py-20">
                        <div className="flex flex-col items-center gap-3">
                          <Loader2 className="h-8 w-8 text-primary animate-spin" />
                          <p className="text-[11px] font-medium text-slate-500">{t("contacts_section.table.loading_contacts")}</p>
                        </div>
                      </td>
                    </tr>
                  ) : getFilteredAndSortedData().length === 0 ? (
                    <tr>
                      <td colSpan={8} className="text-center py-12">
                        <div className="flex flex-col items-center gap-2">
                          <div className="p-3 rounded-full bg-slate-50 dark:bg-slate-800/50">
                            <Users className="h-6 w-6 text-slate-300" />
                          </div>
                          <p className="text-[11px] font-medium text-slate-500">{t("contacts_section.table.no_contacts_found")}</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    getFilteredAndSortedData().map((contact) => (
                      <tr
                        key={contact.id}
                        className="border-b border-slate-50 dark:border-slate-800/50 hover:bg-primary/[0.06] dark:hover:bg-primary/5 transition-all duration-200 group"
                      >
                        <td className="py-1.5 px-4">
                          <Checkbox
                            checked={selectedRows.has(contact.id)}
                            onCheckedChange={() => toggleRowSelection(contact.id)}
                          />
                        </td>
                        <td className="py-1.5 px-4">
                          <div className="flex items-center gap-3">
                            <div className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-[10px] shadow-sm border ${getAvatarColor(contact.name)}`}>
                              {contact.name.charAt(0).toUpperCase()}
                            </div>
                            <button
                              className="font-semibold text-slate-700 dark:text-slate-200 hover:text-primary dark:hover:text-primary transition-colors text-[11px] text-left focus:outline-none"
                              onClick={() => {
                                setSelectedContactForDetails(contact);
                                setShowDetailsModal(true);
                              }}
                            >
                              {contact.name}
                            </button>
                          </div>
                        </td>
                        <td className="py-1.5 px-4 font-medium text-slate-500 dark:text-slate-400 text-[11px]">
                          {contact.phoneNumber || <span className="text-slate-300 dark:text-slate-600">—</span>}
                        </td>
                        <td className="py-1.5 px-4 max-w-lg">
                          <div className="flex flex-wrap gap-1.5">
                            {contact.tags.map((tag) => (
                              <span key={tag} className="px-2 py-0.5 bg-primary/10 dark:bg-primary/10 text-primary dark:text-primary rounded-full text-[9px] font-bold border border-primary/20 dark:border-primary/20">
                                {tag}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="py-2 px-4 text-slate-500 dark:text-slate-500 text-[11px] font-medium">
                          {contact.createdAt || <span className="text-slate-300 dark:text-slate-600">—</span>}
                        </td>
                        <td className="py-2 px-4 text-slate-500 dark:text-slate-500 text-[11px] font-medium">
                          {contact.lastActive || <span className="text-slate-300 dark:text-slate-600">—</span>}
                        </td>
                        <td className="py-2 px-4 text-slate-500 dark:text-slate-500 text-[11px] font-medium">{contact.updatedBy}</td>
                        <td className="py-2 px-4">
                          <div className={`${selectedRows.size > 0 ? 'opacity-50 pointer-events-none' : ''}`}>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <button className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors group-hover:text-primary">
                                  <MoreVertical size={14} className="text-slate-400 group-hover:text-primary transition-colors" />
                                </button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-36 p-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl">
                                {canManageContacts && (
                                  <DropdownMenuItem onClick={() => handleEditContact(contact)} className="flex items-center gap-2 px-2 py-1.5 text-[11px] font-medium rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer">
                                    <Edit2 size={13} className="text-slate-400" />
                                    <span>{t("contacts_section.row_actions.edit")}</span>
                                  </DropdownMenuItem>
                                )}
                                <DropdownMenuItem onClick={() => handleCopyContact(contact)} className="flex items-center gap-2 px-2 py-1.5 text-[11px] font-medium rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer">
                                  <Copy size={13} className="text-slate-400" />
                                  <span>{t("contacts_section.row_actions.copy")}</span>
                                </DropdownMenuItem>
                                {canDeleteContacts && (
                                  <>
                                    <div className="h-px bg-slate-100 dark:bg-slate-800 my-1" />
                                    <DropdownMenuItem onClick={() => handleDeleteContact(contact)} className="flex items-center gap-2 px-2 py-1.5 text-[11px] font-medium rounded-lg text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-colors cursor-pointer">
                                      <Trash2 size={13} />
                                      <span>{t("contacts_section.row_actions.delete")}</span>
                                    </DropdownMenuItem>
                                  </>
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

            {/* Pagination */}
            <div className="py-3 px-5 border-t border-slate-100 dark:border-slate-800/50 flex items-center justify-between bg-slate-50/30 dark:bg-transparent">
              <div className="flex items-center gap-4">
                <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500">
                  {t("contacts_section.pagination.results", { count: contactsTotal })}
                </span>

                <div className="flex items-center gap-2 border-l border-slate-200 dark:border-slate-800 pl-4">
                  <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500">{t("contacts_section.pagination.rows")}</span>
                  <div className="relative" ref={dropdownRef}>
                    <button
                      type="button"
                      className="flex items-center gap-2 h-7 px-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg hover:border-primary/50 transition-all text-[11px] font-bold text-slate-700 dark:text-slate-200 shadow-sm"
                      onClick={() => setRowsDropdownOpen(!rowsDropdownOpen)}
                    >
                      <span>{rowsPerPage}</span>
                      <ChevronDown className="h-3 w-3 text-slate-400" />
                    </button>
                    {rowsDropdownOpen && (
                      <div className="absolute bottom-full mb-1.5 z-10 w-full bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-slate-200 dark:border-slate-800 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                        <ul className="py-1">
                          {[10, 25, 50].map(option => (
                            <li
                              key={option}
                              className="px-3 py-2 text-[11px] font-bold cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 transition-colors"
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
              </div>

              <div className="flex items-center gap-4">
                <div className="text-[10px] font-bold text-slate-400 dark:text-slate-500">
                  {t("contacts_section.pagination.page_prefix")} <span className="text-slate-900 dark:text-slate-200">{page}</span> {t("contacts_section.pagination.page_of_suffix")} {contactsPages}
                </div>
                <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800/50 rounded-xl">
                  <button
                    className="p-1.5 hover:bg-white dark:hover:bg-slate-700 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-sm active:scale-90"
                    disabled={page <= 1}
                    onClick={() => setPage(1)}
                  >
                    <ChevronsLeft size={13} className="text-slate-600 dark:text-slate-400" />
                  </button>
                  <button
                    className="p-1.5 hover:bg-white dark:hover:bg-slate-700 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-sm active:scale-90"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    <ChevronLeft size={13} className="text-slate-600 dark:text-slate-400" />
                  </button>
                  <button
                    className="p-1.5 hover:bg-white dark:hover:bg-slate-700 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-sm active:scale-90"
                    disabled={page >= contactsPages}
                    onClick={() => setPage((p) => Math.min(contactsPages, p + 1))}
                  >
                    <ChevronRight size={13} className="text-slate-600 dark:text-slate-400" />
                  </button>
                  <button
                    className="p-1.5 hover:bg-white dark:hover:bg-slate-700 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-sm active:scale-90"
                    disabled={page >= contactsPages}
                    onClick={() => setPage(contactsPages)}
                  >
                    <ChevronsRight size={13} className="text-slate-600 dark:text-slate-400" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Import Contacts Modal */}
      <Dialog open={showImportModal} onOpenChange={(o) => { if (!o) handleCloseImport(); else setShowImportModal(true); }}>
        <DialogContent className="max-w-md">
          <DialogHeader className="mb-2">
            <DialogTitle>{t("contacts_section.import_modal.title")}</DialogTitle>
          </DialogHeader>

          {importResult ? (
            <div className="space-y-4">
              <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-4 text-sm space-y-1">
                <div className="flex justify-between"><span className="text-muted-foreground">{t("contacts_section.import_modal.created")}</span><span className="font-semibold text-emerald-600">{importResult.created}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">{t("contacts_section.import_modal.updated")}</span><span className="font-semibold text-blue-600">{importResult.updated}</span></div>
                <div className="flex justify-between border-t border-slate-200 dark:border-slate-800 pt-1 mt-1"><span className="text-muted-foreground">{t("contacts_section.import_modal.total")}</span><span className="font-semibold">{importResult.total}</span></div>
              </div>
              <div className="flex justify-end">
                <Button onClick={handleCloseImport}>{t("contacts_section.import_modal.done")}</Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-xs text-muted-foreground">
                {t("contacts_section.import_modal.instructions_prefix")}{" "}<span className="font-medium">.csv</span>{" "}{t("contacts_section.import_modal.instructions_columns_prefix")}{" "}
                <code className="text-[11px]">first_name, last_name, email, phone, tags</code>{" "}
                {t("contacts_section.import_modal.instructions_suffix")}
              </p>
              <p className="text-[10.5px] text-muted-foreground leading-snug">
                {t(
                  "contacts_section.import_modal.alias_hint",
                  "A file exported from the old system (\"First name\", \"Last name\", \"Mobile number\", \"Emails\", \"Whatsapp\", \"Tags\") is also recognised automatically.",
                )}
              </p>

              <button
                type="button"
                onClick={downloadImportTemplate}
                className="inline-flex items-center gap-1.5 text-[11px] font-medium text-primary hover:underline"
              >
                <Download size={13} />
                <span>{t("contacts_section.import_modal.download_template")}</span>
              </button>

              <div>
                <input
                  ref={importInputRef}
                  type="file"
                  accept=".csv,text/csv"
                  onChange={(e) => setImportFile(e.target.files?.[0] ?? null)}
                  className="block w-full text-xs text-slate-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-[11px] file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/90 cursor-pointer"
                />
                {importFile && (
                  <p className="mt-1.5 text-[11px] text-muted-foreground truncate">{t("contacts_section.import_modal.selected_file", { name: importFile.name })}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-medium text-slate-600 dark:text-slate-400">
                  {t("contacts_section.import_modal.default_country_label", "Country for local numbers")}
                </label>
                <CustomDropdown
                  options={countries.map((c) => ({
                    id: c.id,
                    name: `${c.name} (+${(c.phone_code || "").replace(/^\+/, "")})`,
                  }))}
                  selected={[importCountryId || defaultImportCountryId || ""].filter(Boolean)}
                  onChange={(sel) => setImportCountryId(sel[0] ?? "")}
                  placeholder={t("contacts_section.import_modal.select_country", "Select country")}
                  width="100%"
                />
                <p className="text-[10.5px] text-muted-foreground leading-snug">
                  {t(
                    "contacts_section.import_modal.default_country_hint",
                    "Only used for rows whose phone number has no country code (e.g. \"0300...\"). Numbers already written as +92... are left as-is.",
                  )}
                </p>
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={handleCloseImport}>{t("contacts_section.common.cancel")}</Button>
                <Button
                  onClick={handleRunImport}
                  disabled={!importFile || importMutation.isPending}
                  className="flex items-center gap-2"
                >
                  {importMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload size={14} />}
                  <span>{importMutation.isPending ? t("contacts_section.import_modal.importing") : t("contacts_section.header.import")}</span>
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Add Contact Modal */}
      <Dialog open={showAddContactModal} onOpenChange={setShowAddContactModal}>
        <DialogContent className="max-w-md">
          <DialogHeader className="mb-2">
            <DialogTitle>{t("contacts_section.add_modal.title")}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Name Input */}
            <div>
              <label className="text-sm font-medium text-foreground">{t("contacts_section.common.name")}<span className="text-red-500 pl-0.5">*</span></label>
              <input
                type="text"
                placeholder={t("contacts_section.common.name_placeholder")}
                value={newContactName}
                onChange={(e) => setNewContactName(e.target.value)}
                className="w-full mt-1 px-3 py-2 text-sm border border-input rounded-md bg-background focus:outline-none transition-colors"
              />
            </div>

            {/* Phone Input — flag picker + searchable country list,
                identical to the agency panel's Add Agent form. The
                picker chip stores the ISO-2 code; on save we resolve it
                back to the matching workspace country row. */}
            <div className="space-y-1">
              <label className="text-sm font-medium text-foreground">
                {t("contacts_section.common.phone_number")}<span className="text-red-500 pl-0.5">*</span>
              </label>
              {(() => {
                const iso = (newContactCountryIso || "PK") as any;
                const expected = expectedNationalLength(iso);
                const digitCount = (newContactPhone.match(/\d/g) ?? []).length;
                const tooLong = expected !== undefined && digitCount > expected;
                const isComplete = expected !== undefined && digitCount === expected;
                const staticCountry = STATIC_COUNTRIES.find((c) => c.code === iso);
                const hint = expected
                  ? (staticCountry
                      ? t("contacts_section.common.digit_hint_with_country", { digitCount, expected, country: staticCountry.name })
                      : t("contacts_section.common.digit_hint", { digitCount, expected }))
                  : t("contacts_section.common.local_number");
                return (
                  <>
                    <PhoneInputWithFlag
                      country={newContactCountryIso || "PK"}
                      onCountryChange={(newIso) => {
                        setNewContactCountryIso(newIso);
                        // Keep newContactCountryId in sync with the workspace
                        // countries table so the save payload picks up the
                        // correct backend id.
                        const dial = STATIC_COUNTRIES.find((c) => c.code === newIso)?.dial;
                        if (dial) {
                          const match = countries.find(
                            (c) => `+${(c.phone_code || "").replace(/^\+/, "")}` === dial,
                          );
                          setNewContactCountryId(match?.id ?? "");
                        }
                      }}
                      value={newContactPhone}
                      onChange={(digits) => {
                        // Hard-cap to the country's national length.
                        const capped =
                          expected !== undefined ? digits.slice(0, expected) : digits;
                        setNewContactPhone(capped);
                      }}
                      inputClassName={cn(
                        "h-10 text-sm",
                        tooLong ? "border-red-500" : "",
                      )}
                    />
                    <p
                      className={cn(
                        "text-[11px]",
                        tooLong
                          ? "text-red-600"
                          : isComplete
                            ? "text-emerald-600"
                            : "text-muted-foreground",
                      )}
                    >
                      {hint}
                    </p>
                  </>
                );
              })()}
            </div>

            {/* Tags Section */}
            <div className="space-y-1">
              <label className="text-sm font-medium text-foreground">{t("contacts_section.common.tags")}</label>
              {/* Selected Tags */}
              {newContactTags.length > 0 && (
                <div className="flex flex-wrap gap-2 pb-1">
                  {newContactTags.map(tag => (
                    <div
                      key={tag}
                      className="flex items-center gap-1 px-2 py-1 bg-primary/10 text-primary rounded-full text-xs"
                    >
                      {tag}
                      <button
                        onClick={() => handleRemoveTag(tag)}
                        className="hover:text-primary/80"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <CustomDropdown
                options={contactTagOptions}
                selected={newContactTags}
                onChange={setNewContactTags}
                placeholder={t("contacts_section.common.select_tags")}
                width="100%"
              />
            </div>
          </div>

          {/* Modal Footer */}
          <div className="flex gap-2 justify-end mt-2">
            <Button
              onClick={() => setShowAddContactModal(false)}
              variant="outline"
              className="border-input [border-color:hsl(var(--input))] font-normal"
            >
              {t("contacts_section.common.cancel")}
            </Button>
            <Button
              onClick={handleSaveContact}
              className="btn-outline-primary font-normal"
              variant="outline"
            >
              {t("contacts_section.add_modal.save_contact")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Contact Modal */}
      <Dialog open={showEditContactModal} onOpenChange={setShowEditContactModal}>
        <DialogContent className="max-w-md">
          <DialogHeader className="mb-2">
            <DialogTitle>{t("contacts_section.edit_modal.title")}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Name Input */}
            <div>
              <label className="text-sm font-medium text-foreground">{t("contacts_section.common.name")}<span className="text-red-500 pl-0.5">*</span></label>
              <input
                type="text"
                placeholder={t("contacts_section.common.name_placeholder")}
                value={editContactName}
                onChange={(e) => setEditContactName(e.target.value)}
                className="w-full mt-1 px-3 py-2 text-sm border border-input rounded-md bg-background focus:outline-none transition-colors"
              />
            </div>

            {/* Phone Input — same PhoneInputWithFlag as the Add modal,
                pre-filled from the contact's E.164 phone number. */}
            <div className="space-y-1">
              <label className="text-sm font-medium text-foreground">
                {t("contacts_section.common.phone_number")}<span className="text-red-500 pl-0.5">*</span>
              </label>
              {(() => {
                const iso = (editContactCountryIso || "PK") as any;
                const expected = expectedNationalLength(iso);
                const digitCount = (editContactPhone.match(/\d/g) ?? []).length;
                const tooLong = expected !== undefined && digitCount > expected;
                const isComplete = expected !== undefined && digitCount === expected;
                const staticCountry = STATIC_COUNTRIES.find((c) => c.code === iso);
                const hint = expected
                  ? (staticCountry
                      ? t("contacts_section.common.digit_hint_with_country", { digitCount, expected, country: staticCountry.name })
                      : t("contacts_section.common.digit_hint", { digitCount, expected }))
                  : t("contacts_section.common.local_number");
                return (
                  <>
                    <PhoneInputWithFlag
                      country={editContactCountryIso || "PK"}
                      onCountryChange={(newIso) => setEditContactCountryIso(newIso)}
                      value={editContactPhone}
                      onChange={(digits) => {
                        const capped =
                          expected !== undefined ? digits.slice(0, expected) : digits;
                        setEditContactPhone(capped);
                      }}
                      inputClassName={cn(
                        "h-10 text-sm",
                        tooLong ? "border-red-500" : "",
                      )}
                    />
                    <p
                      className={cn(
                        "text-[11px]",
                        tooLong
                          ? "text-red-600"
                          : isComplete
                            ? "text-emerald-600"
                            : "text-muted-foreground",
                      )}
                    >
                      {hint}
                    </p>
                  </>
                );
              })()}
            </div>

            {/* Tags Section */}
            <div className="space-y-1">
              <label className="text-sm font-medium text-foreground">{t("contacts_section.common.tags")}</label>
              {/* Selected Tags */}
              {editContactTags.length > 0 && (
                <div className="flex flex-wrap gap-2 pb-1">
                  {editContactTags.map(tag => (
                    <div
                      key={tag}
                      className="flex items-center gap-1 px-2 py-1 bg-muted rounded-full text-xs"
                    >
                      {tag}
                      <button
                        onClick={() => handleRemoveEditTag(tag)}
                        className="hover:text-primary"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <CustomDropdown
                options={contactTagOptions}
                selected={editContactTags}
                onChange={setEditContactTags}
                placeholder={t("contacts_section.common.select_tags")}
                width="100%"
              />
            </div>
          </div>

          {/* Modal Footer */}
          <div className="flex gap-2 justify-end mt-2">
            <Button
              onClick={() => setShowEditContactModal(false)}
              variant="outline"
              className="border-input [border-color:hsl(var(--input))]"
            >
              {t("contacts_section.common.cancel")}
            </Button>
            <Button
              onClick={handleSaveEditContact}
              className="btn-outline-primary"
              variant="outline"
            >
              {t("contacts_section.common.save_changes")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Contact Modal */}
      <Dialog open={showDeleteContactModal} onOpenChange={setShowDeleteContactModal}>
        <DialogContent className="max-w-sm">
          <DialogHeader className="mb-2">
            <DialogTitle>{t("contacts_section.delete_modal.title")}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <p className="text-sm text-foreground">
              {t("contacts_section.delete_modal.confirm_prefix")} <span className="font-semibold break-all">{contactToDelete?.name}</span>{t("contacts_section.delete_modal.confirm_suffix")}
            </p>
          </div>

          {/* Modal Footer */}
          <div className="flex gap-2 justify-end mt-2">
            <Button
              onClick={() => setShowDeleteContactModal(false)}
              variant="outline"
              className="border-input [border-color:hsl(var(--input))]"
            >
              {t("contacts_section.common.cancel")}
            </Button>
            <Button
              onClick={handleConfirmDelete}
              className="btn-outline-destructive"
              variant="outline"
            >
              {t("contacts_section.common.delete")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Bulk Edit Modal */}
      <Dialog open={showBulkEditModal} onOpenChange={setShowBulkEditModal}>
        <DialogContent className="max-w-md">
          <DialogHeader className="mb-2">
            <DialogTitle>{t("contacts_section.bulk_edit_modal.title", { count: selectedRows.size })}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Tags Section */}
            <div>
              <label className="text-sm font-medium text-foreground mb-2 block">{t("contacts_section.common.tags")}</label>
              <div className="flex gap-2 mb-2">
                <input
                  type="text"
                  placeholder={t("contacts_section.bulk_edit_modal.add_or_select_tag")}
                  value={bulkTagInput}
                  onChange={(e) => setBulkTagInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAddBulkTag();
                    }
                  }}
                  className="flex-1 px-3 py-2 text-sm border border-input rounded-md bg-background focus:outline-none transition-colors"
                />
                <Button
                  onClick={handleAddBulkTag}
                  size="sm"
                  variant="outline"
                  className="btn-outline-primary"
                >
                  {t("contacts_section.common.add")}
                </Button>
              </div>

              {/* Selected Tags */}
              <div className="flex flex-wrap gap-2 mb-3">
                {bulkEditTags.map((tag) => (
                  <span key={tag} className="px-2 py-1 bg-primary/10 text-primary rounded text-xs flex items-center gap-1">
                    {tag}
                    <button
                      onClick={() => handleRemoveBulkTag(tag)}
                      className="hover:text-primary/80"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>

              {/* Available Tags */}
              {contactTagOptions.length > 0 && (
                <div>
                  <p className="text-xs text-muted-foreground mb-2">{t("contacts_section.bulk_edit_modal.available_tags")}</p>
                  <div className="flex flex-wrap gap-2">
                    {contactTagOptions.map((tagObj: any) => (
                      <button
                        key={tagObj.name}
                        onClick={() => handleToggleBulkTag(tagObj.name)}
                        className={`px-2 py-1 rounded text-xs transition-colors ${bulkEditTags.includes(tagObj.name)
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-foreground hover:bg-muted/80"
                          }`}
                      >
                        {tagObj.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Modal Footer */}
          <div className="flex gap-2 justify-end mt-2">
            <Button
              onClick={() => setShowBulkEditModal(false)}
              variant="outline"
              className="border-input [border-color:hsl(var(--input))]"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveBulkEdit}
              className="btn-outline-primary"
              variant="outline"
            >
              {t("contacts_section.common.save_changes")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Bulk Delete Modal */}
      <Dialog open={showBulkDeleteModal} onOpenChange={setShowBulkDeleteModal}>
        <DialogContent className="max-w-sm">
          <DialogHeader className="mb-2">
            <DialogTitle>{t("contacts_section.bulk_delete_modal.title")}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <p className="text-sm text-foreground">
              {t("contacts_section.bulk_delete_modal.confirm_prefix")} <span className="font-semibold">{t("contacts_section.bulk_delete_modal.contact_count", { count: selectedRows.size })}</span>{t("contacts_section.delete_modal.confirm_suffix")}
            </p>
          </div>

          {/* Modal Footer */}
          <div className="flex gap-2 justify-end mt-2">
            <Button
              onClick={() => setShowBulkDeleteModal(false)}
              variant="outline"
              className="border-input [border-color:hsl(var(--input))]"
            >
              {t("contacts_section.common.cancel")}
            </Button>
            <Button
              onClick={handleConfirmBulkDelete}
              className="btn-outline-destructive"
              variant="outline"
            >
              {t("contacts_section.common.delete")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <ContactProfileModal
        open={showDetailsModal}
        onOpenChange={setShowDetailsModal}
        contact={selectedContactForDetails}
      />
    </>
  );
}

