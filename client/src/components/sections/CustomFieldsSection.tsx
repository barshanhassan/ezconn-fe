import { useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
} from "@/components/ui/alert-dialog";
import {
  Edit2,
  Trash2,
  Copy,
  Database,
  Plus,
  Loader2,
  AlertCircle,
  Folder,
  FolderPlus,
  X,
  Info,
  Check,
  Flag,
  DollarSign,
  Calendar,
  CalendarClock,
  Type,
  Hash,
  Phone as PhoneIcon,
  Mail,
  Link2,
  Braces,
  TextCursorInput,
  List as ListIcon,
  Pencil,
  MessageSquare,
  CircleSlash,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { useTheme } from "@/contexts/ThemeContext";

type ForValue = "WORKSPACE" | "CONTACT" | "COMPANY" | "OPPORTUNITY";
type ContentType =
  | "TEXT"
  | "FIXED"
  | "NUMBER"
  | "EMAIL"
  | "PHONE"
  | "URL"
  | "DATE"
  | "DATETIME"
  | "COUNTRY"
  | "CURRENCY"
  | "JSON";
type InputType =
  | "text"
  | "textarea"
  | "select"
  | "multiselect"
  | "checkbox"
  | "radio"
  | "email"
  | "number"
  | "paragraph";

interface EnumsResponse {
  content_types: string[];
  input_types: string[];
  list_types: string[];
  for_values: ForValue[];
  property_backed_inputs: string[];
}

interface CountryRow {
  id: string;
  name: string;
  iso2: string;
  iso3: string;
  phone_code: string | null;
  phone_digits: number | null;
  currency: string | null;
}

interface CustomField {
  id: string;
  slug: string;
  label: string;
  description: string | null;
  for: ForValue | string;
  content_type: string;
  input_type: string;
  list_type: string;
  has_properties: number | boolean;
  is_multiselect: number | boolean;
  is_fixed: number | boolean;
  fixed_value: string | null;
  allow_in_feeder: boolean;
  display_inbox: number | boolean;
  folder_id: string | null;
  validation: string | null;
  custom_field_properties?: Array<{ id: string; name: string; value: string }>;
}

interface CFFolder {
  id: string;
  name: string;
}

// Replyagent's content_types list (icon + name + details). Order mirrors
// `WorkspaceStore.custom_field_content_types`. GENDER is intentionally
// excluded because replyagent excludes it from the picker too.
const CONTENT_OPTIONS: Array<{
  content_type: ContentType;
  name: string;
  details: string;
  Icon: any;
}> = [
  { content_type: "COUNTRY", name: "Country", details: "List of countries with flags", Icon: Flag },
  { content_type: "CURRENCY", name: "Currency", details: "Choose accepted currencies", Icon: DollarSign },
  { content_type: "DATE", name: "Date", details: "Calendar date picker", Icon: Calendar },
  { content_type: "DATETIME", name: "Datetime", details: "Date with time of day", Icon: CalendarClock },
  { content_type: "TEXT", name: "Text", details: "Plain text, single or multi-line", Icon: Type },
  { content_type: "FIXED", name: "Fixed text", details: "A constant value applied to every record", Icon: CircleSlash },
  { content_type: "NUMBER", name: "Numbers", details: "Numeric input", Icon: Hash },
  { content_type: "PHONE", name: "Phone", details: "Phone number with country code", Icon: PhoneIcon },
  { content_type: "EMAIL", name: "Email", details: "Email address", Icon: Mail },
  { content_type: "URL", name: "URL", details: "Web address", Icon: Link2 },
  { content_type: "JSON", name: "JSON", details: "Structured data payload", Icon: Braces },
];

// Replyagent's input_types — same 5 cards with icons + labels.
const INPUT_OPTIONS: Array<{
  slug: Exclude<InputType, "checkbox" | "radio" | "number" | "paragraph">;
  text: string;
  Icon: any;
}> = [
  { slug: "multiselect", text: "Choice (Multiple)", Icon: ListIcon },
  { slug: "select", text: "Choice (single)", Icon: ListIcon },
  { slug: "text", text: "Single line", Icon: TextCursorInput },
  { slug: "email", text: "Email field", Icon: Mail },
  { slug: "textarea", text: "Paragraph", Icon: MessageSquare },
];

// Content_type → permitted input_type slugs (mirrors replyagent's
// `getInputTypes` switch).
const INPUT_TYPES_BY_CONTENT: Record<string, InputType[]> = {
  COUNTRY: ["select", "multiselect"],
  CURRENCY: ["select", "multiselect"],
  DATE: ["text"],
  DATETIME: ["text"],
  GENDER: ["select", "radio"],
  NUMBER: ["text", "select", "multiselect"],
  TEXT: ["text", "select", "multiselect", "textarea"],
  PHONE: ["text"],
  URL: ["text"],
  EMAIL: ["email"],
  JSON: ["textarea"],
};

const DATE_FORMATS = [
  { php: "Y-m-d", js: "yyyy-MM-dd" },
  { php: "Y.m.d", js: "yyyy.MM.dd" },
  { php: "Y/m/d", js: "yyyy/MM/dd" },
  { php: "d-m-Y", js: "dd-MM-yyyy" },
  { php: "d.m.Y", js: "dd.MM.yyyy" },
  { php: "d/m/Y", js: "dd/MM/yyyy" },
  { php: "m-d-Y", js: "MM-dd-yyyy" },
  { php: "m.d.Y", js: "MM.dd.yyyy" },
  { php: "m/d/Y", js: "MM/dd/yyyy" },
];
const TIME_FORMATS = [
  { php: "H:i", js: "H:mm", text: "Full day (24h)" },
  { php: "h:i a", js: "hh:mm a", text: "Half day (12h)" },
];
const DELIMITERS: Array<{ value: string; label: string }> = [
  { value: ",", label: "Comma" },
  { value: "\n", label: "New line" },
  { value: ";", label: "Semicolon" },
  { value: ":", label: "Colon" },
  { value: "=", label: "Equal sign" },
];

interface FormState {
  slug: string | null;
  label: string;
  systemName: string;
  description: string;
  contentType: ContentType | "";
  inputType: InputType | "";
  listType: "create" | "import";
  creatingFor: ForValue;
  folderId: string;
  fixedValue: string;
  properties: Array<{ name: string; value: string }>;
  countries: string[]; // ids
  currencies: string[]; // ids
  validation: {
    min_length: string;
    max_length: string;
    date_format: string;
    time_format: string;
    country: CountryRow | null;
    digits: string;
  };
}

const EMPTY_FORM: FormState = {
  slug: null,
  label: "",
  systemName: "",
  description: "",
  contentType: "",
  inputType: "",
  listType: "create",
  creatingFor: "WORKSPACE",
  folderId: "",
  fixedValue: "",
  properties: [],
  countries: [],
  currencies: [],
  validation: {
    min_length: "",
    max_length: "",
    date_format: "yyyy-MM-dd",
    time_format: "H:mm",
    country: null,
    digits: "",
  },
};

const WORKSPACE_FIELD_LIMIT = 50;

export default function CustomFieldsSection() {
  const { mode } = useTheme();
  const dark = mode === "dark";
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [showFieldDialog, setShowFieldDialog] = useState(false);
  const [fieldToDelete, setFieldToDelete] = useState<CustomField | null>(null);
  const [contentTypeFilter, setContentTypeFilter] = useState("");
  const [folderFilter, setFolderFilter] = useState<string>("ALL");
  const [showFolderModal, setShowFolderModal] = useState(false);
  const [folderName, setFolderName] = useState("");
  const [editingFolder, setEditingFolder] = useState<CFFolder | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [slugChecking, setSlugChecking] = useState(false);
  const [slugAvailable, setSlugAvailable] = useState<boolean | null>(null);
  const [delimiter, setDelimiter] = useState(",");
  const [importRaw, setImportRaw] = useState("");

  // ── Design tokens ─────────────────────────────────────────
  const card = dark ? "bg-[#0f1829]" : "bg-white";
  const border = dark ? "border-slate-800" : "border-slate-200";
  const text = dark ? "text-white" : "text-slate-900";
  const sub = dark ? "text-slate-500" : "text-slate-400";
  const softBg = dark ? "bg-slate-950/40" : "bg-slate-50/50";
  const softBorder = dark ? "border-slate-800" : "border-slate-100";

  const inputCls = cn(
    "w-full h-11 rounded-xl text-[13px] font-bold transition-all px-4 border outline-none",
    "focus:ring-2 focus:ring-primary/30 focus:border-primary/50",
    dark ? "bg-slate-950/50 border-slate-800 text-white" : "bg-white border-slate-200 text-slate-900",
  );
  const selectCls = cn(
    inputCls,
    "appearance-none cursor-pointer pr-10 bg-no-repeat",
    dark
      ? "bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2212%22 height=%2212%22 viewBox=%220 0 24 24%22 fill=%22none%22 stroke=%22%2394a3b8%22 stroke-width=%222%22><polyline points=%226 9 12 15 18 9%22/></svg>')]"
      : "bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2212%22 height=%2212%22 viewBox=%220 0 24 24%22 fill=%22none%22 stroke=%22%2364748b%22 stroke-width=%222%22><polyline points=%226 9 12 15 18 9%22/></svg>')]",
    "[background-position:right_1rem_center]",
  );
  const textareaCls = cn(
    "w-full rounded-xl text-[13px] font-medium transition-all px-4 py-3 border outline-none resize-none",
    "focus:ring-2 focus:ring-primary/30 focus:border-primary/50",
    dark ? "bg-slate-950/50 border-slate-800 text-white" : "bg-white border-slate-200 text-slate-900",
  );
  const outlineBtn = cn(
    "h-11 px-6 rounded-xl border text-[11px] font-semibold transition-all flex items-center gap-2",
    dark ? "border-slate-800 text-slate-300 hover:border-primary/40 hover:text-primary" : "border-slate-200 text-slate-700 hover:border-primary/40 hover:text-primary",
  );
  const primaryOutlineBtn = cn(
    "h-10 px-6 rounded-xl border text-[11px] font-semibold transition-all flex items-center gap-2",
    "border-primary text-primary hover:bg-primary hover:text-white",
  );
  const primaryBtn =
    "h-11 px-7 rounded-xl bg-primary hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed text-white text-[11px] font-semibold transition-all shadow-lg shadow-primary/20 flex items-center gap-2";
  const labelCls = cn("block text-[11px] font-semibold", sub);

  // ── Data ─────────────────────────────────────────────────────────
  const { data: enums } = useQuery<EnumsResponse>({
    queryKey: ["/api/custom-fields/enums"],
    queryFn: async () => (await apiRequest("GET", "/api/custom-fields/enums")).json(),
    staleTime: Infinity,
  });

  const { data: countries = [] } = useQuery<CountryRow[]>({
    queryKey: ["/api/custom-fields/countries"],
    queryFn: async () => (await apiRequest("GET", "/api/custom-fields/countries")).json(),
    staleTime: Infinity,
  });

  const { data, isLoading } = useQuery<{
    success: boolean;
    total_fields: number;
    fields: CustomField[];
    folders: CFFolder[];
  }>({
    queryKey: ["/api/custom-fields", contentTypeFilter, folderFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (contentTypeFilter) params.set("content_type", contentTypeFilter);
      if (folderFilter && folderFilter !== "ALL") params.set("folder_id", folderFilter);
      else params.set("folder_id", "ALL");
      const res = await apiRequest("GET", `/api/custom-fields?${params}`);
      return res.json();
    },
  });

  const fields: CustomField[] = useMemo(
    () =>
      (data?.fields ?? []).map((f: any) => ({
        ...f,
        id: String(f.id),
        folder_id: f.folder_id != null ? String(f.folder_id) : null,
        allow_in_feeder: !!f.allow_in_feeder,
      })),
    [data],
  );
  const folders: CFFolder[] = useMemo(
    () =>
      (data?.folders ?? []).map((f: any) => ({ id: String(f.id), name: f.name })),
    [data],
  );
  const totalFields = data?.total_fields ?? fields.length;

  // ── Mutations ────────────────────────────────────────────────────
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/custom-fields"] });
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      // Map UI state → replyagent-compatible payload. For COUNTRY/CURRENCY
      // we ship the chosen rows as `properties: [{name, value}]` so the
      // backend's existing property-replacement logic stores them. The
      // `validation` blob mirrors replyagent's structure so a future server
      // implementation can read it without translation.
      const payload: any = {
        label: form.label.trim(),
        description: form.description.trim() || null,
        content_type: form.contentType,
        input_type: form.inputType,
        list_type: form.listType,
        creating_for: form.creatingFor,
        folder_id: form.folderId || null,
        fixed_value: form.contentType === "FIXED" ? form.fixedValue : null,
        validation: serialiseValidation(form),
      };

      if (form.contentType === "COUNTRY") {
        payload.properties = form.countries
          .map((cid) => countries.find((c) => c.id === cid))
          .filter(Boolean)
          .map((c) => ({ name: c!.name, value: c!.iso2 }));
      } else if (form.contentType === "CURRENCY") {
        payload.properties = form.currencies
          .map((cid) => countries.find((c) => c.id === cid))
          .filter(Boolean)
          .filter((c) => c!.currency)
          .map((c) => ({ name: `${c!.currency} (${c!.name})`, value: c!.currency! }));
      } else if (isPropertyBacked(form.inputType)) {
        payload.properties = form.properties.filter((p) => p.name.trim().length > 0);
      } else {
        payload.properties = [];
      }

      if (form.slug) {
        payload.slug = form.slug;
      } else {
        payload.system_name = form.systemName.trim();
      }
      const res = await apiRequest("POST", "/api/custom-fields/field", payload);
      return res.json();
    },
    onSuccess: () => {
      invalidate();
      toast({ title: form.slug ? "Field updated" : "Field created" });
      closeDialog();
    },
    onError: (e: any) =>
      toast({ title: "Error", description: e?.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (slug: string) => {
      await apiRequest("DELETE", `/api/custom-fields/field/${slug}`);
    },
    onSuccess: () => {
      invalidate();
      toast({ title: "Field deleted" });
      setFieldToDelete(null);
    },
    onError: (e: any) =>
      toast({ title: "Error", description: e?.message, variant: "destructive" }),
  });

  const toggleFeederMutation = useMutation({
    mutationFn: async (fieldId: string) => {
      const res = await apiRequest("POST", `/api/custom-fields/${fieldId}/toggle-feeder`);
      return res.json();
    },
    onSuccess: () => invalidate(),
    onError: (e: any) =>
      toast({ title: "Error", description: e?.message, variant: "destructive" }),
  });

  const folderMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/custom-fields/folder", {
        ...(editingFolder ? { id: editingFolder.id } : {}),
        name: folderName.trim(),
      });
      return res.json();
    },
    onSuccess: () => {
      invalidate();
      toast({ title: editingFolder ? "Folder renamed" : "Folder created" });
      setShowFolderModal(false);
      setEditingFolder(null);
      setFolderName("");
    },
    onError: (e: any) =>
      toast({ title: "Error", description: e?.message, variant: "destructive" }),
  });

  const deleteFolderMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/custom-fields/folder/${id}`);
    },
    onSuccess: () => {
      invalidate();
      toast({ title: "Folder deleted" });
      setFolderFilter("ALL");
    },
    onError: (e: any) =>
      toast({ title: "Error", description: e?.message, variant: "destructive" }),
  });

  // ── Slug check (debounced) ───────────────────────────────────────
  useEffect(() => {
    if (form.slug) return; // editing — slug immutable
    const name = form.systemName.trim();
    if (!name) {
      setSlugAvailable(null);
      return;
    }
    setSlugChecking(true);
    const handle = setTimeout(async () => {
      try {
        const res = await apiRequest(
          "GET",
          `/api/custom-fields/check-availability?system_name=${encodeURIComponent(name)}`,
        );
        const json = await res.json();
        setSlugAvailable(!!json.is_available);
      } catch {
        setSlugAvailable(null);
      } finally {
        setSlugChecking(false);
      }
    }, 600);
    return () => clearTimeout(handle);
  }, [form.systemName, form.slug]);

  // ── Handlers ─────────────────────────────────────────────────────
  const openCreate = () => {
    setForm({
      ...EMPTY_FORM,
      folderId: folderFilter !== "ALL" && folderFilter !== "root" ? folderFilter : "",
    });
    setSlugAvailable(null);
    setImportRaw("");
    setShowFieldDialog(true);
  };

  const openEdit = (field: CustomField) => {
    const validation = safeParseValidation(field.validation, countries);
    const props = field.custom_field_properties ?? [];
    setForm({
      slug: field.slug,
      label: field.label,
      systemName: field.slug,
      description: field.description ?? "",
      contentType: field.content_type as ContentType,
      inputType: field.input_type as InputType,
      listType: (field.list_type as "create" | "import") || "create",
      creatingFor: (field.for as ForValue) || "WORKSPACE",
      folderId: field.folder_id ?? "",
      fixedValue: field.fixed_value ?? "",
      properties:
        field.content_type === "COUNTRY" || field.content_type === "CURRENCY"
          ? []
          : props.map((p) => ({ name: p.name, value: p.value })),
      countries:
        field.content_type === "COUNTRY"
          ? props
              .map((p) => countries.find((c) => c.iso2 === p.value)?.id)
              .filter((x): x is string => !!x)
          : [],
      currencies:
        field.content_type === "CURRENCY"
          ? props
              .map((p) => countries.find((c) => c.currency === p.value)?.id)
              .filter((x): x is string => !!x)
          : [],
      validation,
    });
    setShowFieldDialog(true);
  };

  const closeDialog = () => {
    setShowFieldDialog(false);
    setForm(EMPTY_FORM);
    setSlugAvailable(null);
    setImportRaw("");
  };

  const onLabelChange = (value: string) => {
    setForm((p) => {
      // Replyagent auto-generates the slug from the label when creating.
      const next = { ...p, label: value.slice(0, 60) };
      if (!p.slug) {
        next.systemName = value
          .replace(/[^a-zA-Z0-9_ ]/g, "")
          .replace(/\s+/g, "_")
          .toLowerCase()
          .slice(0, 60);
      }
      return next;
    });
  };

  const onSystemNameChange = (value: string) => {
    if (form.slug) return;
    const clean = value
      .replace(/[^a-zA-Z0-9_ ]/g, "")
      .replace(/\s+/g, "_")
      .toLowerCase()
      .slice(0, 60);
    setForm((p) => ({ ...p, systemName: clean }));
  };

  const setContentType = (ct: ContentType) => {
    setForm((p) => ({
      ...p,
      contentType: ct,
      inputType: "",
      properties: [],
      countries: [],
      currencies: [],
      fixedValue: "",
    }));
  };

  const setInputType = (slug: InputType) => {
    setForm((p) => {
      const next = { ...p, inputType: slug };
      if (isPropertyBacked(slug) && p.properties.length === 0) {
        next.properties = [{ name: "", value: "prop[]" }];
      }
      if (!isPropertyBacked(slug)) {
        next.properties = [];
      }
      return next;
    });
  };

  const addProperty = () =>
    setForm((p) => ({
      ...p,
      properties: [...p.properties, { name: "", value: "prop[]" }],
    }));
  const updateProperty = (i: number, value: string) =>
    setForm((p) => {
      const next = [...p.properties];
      next[i] = { ...next[i], name: value };
      return { ...p, properties: next };
    });
  const removePropertyAt = (i: number) =>
    setForm((p) => ({
      ...p,
      properties: p.properties.filter((_, idx) => idx !== i),
    }));

  const toggleCountry = (id: string) =>
    setForm((p) => ({
      ...p,
      countries: p.countries.includes(id)
        ? p.countries.filter((x) => x !== id)
        : [...p.countries, id],
    }));
  const selectAllCountries = (checked: boolean) =>
    setForm((p) => ({ ...p, countries: checked ? countries.map((c) => c.id) : [] }));

  const toggleCurrency = (id: string) =>
    setForm((p) => ({
      ...p,
      currencies: p.currencies.includes(id)
        ? p.currencies.filter((x) => x !== id)
        : [...p.currencies, id],
    }));
  const selectAllCurrencies = (checked: boolean) =>
    setForm((p) => ({
      ...p,
      currencies: checked
        ? countries.filter((c) => !!c.currency).map((c) => c.id)
        : [],
    }));

  const handleImport = (raw: string, delim: string) => {
    setImportRaw(raw);
    if (!raw.trim()) {
      setForm((p) => ({ ...p, properties: [] }));
      return;
    }
    const parts =
      delim === "\n"
        ? raw.split(/\r?\n/)
        : raw.split(delim);
    if (parts.length > 500) {
      toast({ title: "Too many options (max 500)", variant: "destructive" });
      return;
    }
    setForm((p) => ({
      ...p,
      properties: parts
        .map((s) => s.trim())
        .filter((s) => s.length > 0)
        .map((s) => ({ name: s, value: "prop[]" })),
    }));
  };

  const handleSave = () => {
    if (!form.label.trim()) {
      toast({ title: "Display name is required", variant: "destructive" });
      return;
    }
    if (!form.slug && !form.systemName.trim()) {
      toast({ title: "System name is required", variant: "destructive" });
      return;
    }
    if (!form.slug && slugAvailable === false) {
      toast({
        title: "System name is taken",
        description: "Pick a different system name.",
        variant: "destructive",
      });
      return;
    }
    if (!form.contentType) {
      toast({ title: "Pick a content type", variant: "destructive" });
      return;
    }
    if (form.contentType !== "FIXED" && !form.inputType) {
      toast({ title: "Pick how to present this field", variant: "destructive" });
      return;
    }
    if (form.contentType === "FIXED" && !form.inputType) {
      toast({ title: "Pick a fixed input style", variant: "destructive" });
      return;
    }
    if (form.contentType === "FIXED" && !form.fixedValue.trim()) {
      toast({ title: "Enter the fixed value", variant: "destructive" });
      return;
    }
    if (
      isPropertyBacked(form.inputType) &&
      form.contentType !== "COUNTRY" &&
      form.contentType !== "CURRENCY" &&
      form.properties.filter((p) => p.name.trim()).length === 0
    ) {
      toast({
        title: "Add at least one option",
        variant: "destructive",
      });
      return;
    }
    saveMutation.mutate();
  };

  // ── Computed ─────────────────────────────────────────────────────
  const isPropertyBacked = (inputType: string): boolean => {
    return ["checkbox", "multiselect", "radio", "select"].includes(inputType);
  };

  const allowedInputs = useMemo(() => {
    if (!form.contentType) return [];
    const allowed = INPUT_TYPES_BY_CONTENT[form.contentType] ?? [];
    return INPUT_OPTIONS.filter((o) => allowed.includes(o.slug as InputType));
  }, [form.contentType]);

  const isEditMode = !!form.slug;
  const showListOptions =
    form.contentType !== "FIXED" &&
    (form.contentType === "COUNTRY" ||
      form.contentType === "CURRENCY" ||
      isPropertyBacked(form.inputType));

  const showValidation =
    form.contentType !== "FIXED" &&
    form.inputType === "text" &&
    ["TEXT", "NUMBER", "DATE", "DATETIME", "PHONE"].includes(form.contentType);

  // ── Render ───────────────────────────────────────────────────────
  return (
    <>
      <Card className={cn("rounded-[2rem] border overflow-hidden shadow-sm transition-all duration-300", card, border)}>
        <CardContent className="p-0">
          {/* Header */}
          <div className={cn("px-8 py-5 border-b flex flex-wrap items-center justify-between gap-3", border)}>
            <div className="flex items-center gap-4">
              <div className={cn("p-2.5 rounded-xl shadow-sm", "bg-primary/10")}>
                <Database className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h1 className={cn("text-[16px] font-bold tracking-tight", text)}>Custom fields</h1>
                <p className={cn("text-[11px] font-medium mt-0.5 opacity-60 max-w-2xl", sub)}>
                  Manage custom fields and link them to contacts, companies, or opportunities.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => {
                  setEditingFolder(null);
                  setFolderName("");
                  setShowFolderModal(true);
                }}
                className={outlineBtn}
              >
                <FolderPlus size={12} /> New Folder
              </button>
              <button
                onClick={openCreate}
                disabled={fields.length >= WORKSPACE_FIELD_LIMIT}
                className={cn(primaryOutlineBtn, "disabled:opacity-50 disabled:cursor-not-allowed")}
              >
                <Plus size={12} /> Add New
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="p-8">
            <div className={cn("rounded-[1.5rem] border overflow-hidden", softBorder, softBg)}>
              {/* Toolbar */}
              <div className={cn("px-6 py-4 border-b flex items-center justify-between gap-4 flex-wrap", softBorder, dark ? "bg-slate-900/40" : "bg-white/60")}>
                <div className="flex items-center gap-2 flex-wrap">
                  <select
                    value={folderFilter}
                    onChange={(e) => setFolderFilter(e.target.value)}
                    className={cn(selectCls, "h-9 text-[11px] py-0 w-[180px]")}
                  >
                    <option value="ALL">All folders</option>
                    <option value="root">Root</option>
                    {folders.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.name}
                      </option>
                    ))}
                  </select>
                  {folderFilter !== "ALL" && folderFilter !== "root" && (
                    <>
                      <button
                        onClick={() => {
                          const f = folders.find((x) => x.id === folderFilter);
                          if (!f) return;
                          setEditingFolder(f);
                          setFolderName(f.name);
                          setShowFolderModal(true);
                        }}
                        className={cn("w-8 h-8 rounded-md flex items-center justify-center transition-colors", dark ? "hover:bg-slate-800 text-slate-400 hover:text-primary" : "hover:bg-slate-100 text-slate-500 hover:text-primary")}
                        title="Rename folder"
                      >
                        <Edit2 size={13} />
                      </button>
                      <button
                        onClick={() => {
                          if (confirm("Delete this folder? It must be empty.")) {
                            deleteFolderMutation.mutate(folderFilter);
                          }
                        }}
                        className={cn("w-8 h-8 rounded-md flex items-center justify-center transition-colors", "hover:bg-rose-500/10 text-rose-500")}
                        title="Delete folder"
                      >
                        <Trash2 size={13} />
                      </button>
                    </>
                  )}
                </div>
                <div className="flex items-center gap-3 flex-wrap">
                  <span className={cn("text-[11px] font-semibold", sub)}>
                    {totalFields} of {WORKSPACE_FIELD_LIMIT}
                  </span>
                  <select
                    value={contentTypeFilter}
                    onChange={(e) => setContentTypeFilter(e.target.value)}
                    className={cn(selectCls, "h-9 text-[11px] py-0 w-[180px]")}
                  >
                    <option value="">All content types</option>
                    {CONTENT_OPTIONS.map((c) => (
                      <option key={c.content_type} value={c.content_type}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Table */}
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className={cn("border-b", softBorder, dark ? "bg-slate-900/40" : "bg-white/60")}>
                      <th className={cn("px-6 py-4 text-left text-[11px] font-semibold", sub)}>Name</th>
                      <th className={cn("px-6 py-4 text-left text-[11px] font-semibold", sub)}>ID</th>
                      <th className={cn("px-6 py-4 text-left text-[11px] font-semibold", sub)}>Content Type</th>
                      <th className={cn("px-6 py-4 text-left text-[11px] font-semibold", sub)}>Data Format</th>
                      <th className={cn("px-6 py-4 text-left text-[11px] font-semibold", sub)}>For</th>
                      <th className={cn("px-6 py-4 text-left text-[11px] font-semibold", sub)}>Feeder</th>
                      <th className={cn("px-6 py-4 text-right text-[11px] font-semibold", sub)}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {isLoading ? (
                      <tr>
                        <td colSpan={7} className="px-6 py-12 text-center">
                          <Loader2 className="w-6 h-6 animate-spin mx-auto text-primary" />
                        </td>
                      </tr>
                    ) : fields.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-6 py-16 text-center">
                          <div className="flex flex-col items-center gap-3">
                            <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
                              <Database className="w-7 h-7 text-primary" />
                            </div>
                            <div className="space-y-1">
                              <h3 className={cn("text-[13px] font-black", text)}>No custom fields yet</h3>
                              <p className={cn("text-[11px] font-medium opacity-60", sub)}>
                                Create your first custom field to get started.
                              </p>
                            </div>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      fields.map((field) => {
                        const ctMeta = CONTENT_OPTIONS.find((c) => c.content_type === field.content_type);
                        const Icon = ctMeta?.Icon ?? Type;
                        return (
                          <tr
                            key={field.id}
                            className={cn("border-b transition-colors", softBorder, dark ? "hover:bg-slate-900/40" : "hover:bg-white/80")}
                          >
                            <td className="px-6 py-4">
                              <button
                                onClick={() => openEdit(field)}
                                className="text-[13px] font-black text-primary hover:underline text-left"
                              >
                                {field.label}
                              </button>
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-2">
                                <code className={cn("text-[11px] font-bold", sub)}>{field.slug}</code>
                                <button
                                  onClick={() => {
                                    navigator.clipboard.writeText(field.slug);
                                    toast({ title: "Copied", description: "Field ID copied." });
                                  }}
                                  className={cn("w-6 h-6 rounded-md flex items-center justify-center transition-colors", dark ? "hover:bg-slate-800 text-slate-500 hover:text-primary" : "hover:bg-slate-100 text-slate-400 hover:text-primary")}
                                  title="Copy ID"
                                >
                                  <Copy size={11} />
                                </button>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-2">
                                <Icon size={14} className="text-primary" />
                                <span className={cn("text-[12px] font-bold", sub)}>{ctMeta?.name ?? field.content_type}</span>
                              </div>
                            </td>
                            <td className={cn("px-6 py-4 text-[12px] font-bold", sub)}>{field.input_type}</td>
                            <td className={cn("px-6 py-4 text-[12px] font-bold", sub)}>{field.for}</td>
                            <td className="px-6 py-4">
                              <Switch
                                checked={!!field.allow_in_feeder}
                                onCheckedChange={() => toggleFeederMutation.mutate(field.id)}
                                className="data-[state=checked]:bg-primary"
                              />
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex items-center justify-end gap-2">
                                <button
                                  onClick={() => openEdit(field)}
                                  className={cn("w-9 h-9 rounded-lg border flex items-center justify-center transition-all", dark ? "border-slate-800 hover:border-primary/40 hover:text-primary text-slate-400" : "border-slate-200 hover:border-primary/40 hover:text-primary text-slate-500")}
                                  title="Edit"
                                >
                                  <Edit2 size={13} />
                                </button>
                                <button
                                  onClick={() => setFieldToDelete(field)}
                                  className={cn("w-9 h-9 rounded-lg border flex items-center justify-center transition-all", dark ? "border-slate-800 hover:border-rose-500/40 hover:text-rose-500 text-slate-400" : "border-slate-200 hover:border-rose-500/40 hover:text-rose-500 text-slate-500")}
                                  title="Delete"
                                >
                                  <Trash2 size={13} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              <div className={cn("px-6 py-3 border-t text-[11px] font-semibold", softBorder, sub, dark ? "bg-slate-900/40" : "bg-white/60")}>
                Showing {fields.length} of {totalFields} custom fields
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Create / Edit Modal — replyagent-style flow ── */}
      <Dialog open={showFieldDialog} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent className={cn("border p-0 overflow-hidden rounded-[2rem] max-w-2xl max-h-[92vh] overflow-y-auto", card, border)}>
          <div className="p-6 space-y-5">
            <DialogHeader>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
                  <Database size={18} />
                </div>
                <div className="text-left">
                  <DialogTitle className={cn("text-[14px] font-semibold", text)}>
                    {isEditMode ? "Edit Custom Field" : "Create Custom Field"}
                  </DialogTitle>
                  <DialogDescription className={cn("text-[11px] font-medium opacity-60 mt-0.5", sub)}>
                    Define a new field to collect data.
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>

            <div className="space-y-5">
              {/* Display Name */}
              <div className="space-y-2">
                <label className={labelCls}>Display name</label>
                <input
                  type="text"
                  value={form.label}
                  onChange={(e) => onLabelChange(e.target.value)}
                  disabled={isEditMode}
                  className={cn(inputCls, "disabled:opacity-60")}
                  placeholder="e.g. Birthday"
                />
              </div>

              {/* System Name (slug) — only when creating */}
              {!isEditMode && (
                <div className="space-y-2">
                  <label className={cn(labelCls, "flex items-center gap-2")}>
                    System name
                    <span title="Lowercase identifier used by the API + automations">
                      <Info size={11} className="opacity-60" />
                    </span>
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={form.systemName}
                      onChange={(e) => onSystemNameChange(e.target.value)}
                      className={cn(inputCls, "lowercase pr-10 font-mono")}
                      placeholder="e.g. birthday"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2">
                      {slugChecking ? (
                        <Loader2 size={14} className="animate-spin text-primary" />
                      ) : slugAvailable === true ? (
                        <Check size={15} className="text-emerald-500" />
                      ) : slugAvailable === false ? (
                        <X size={15} className="text-rose-500" />
                      ) : null}
                    </span>
                  </div>
                </div>
              )}

              {/* Description */}
              <div className="space-y-2">
                <label className={cn(labelCls, "flex items-center gap-2")}>
                  Description
                  <span title="Optional hint shown to teammates">
                    <Info size={11} className="opacity-60" />
                  </span>
                </label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm((p) => ({ ...p, description: e.target.value.slice(0, 500) }))}
                  rows={2}
                  className={textareaCls}
                />
              </div>

              {/* What type of data — replyagent's rich dropdown */}
              <div className="space-y-2">
                <label className={labelCls}>What type of data you want to collect?</label>
                <div className={cn("rounded-xl border overflow-hidden", softBorder, softBg)}>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 p-3">
                    {CONTENT_OPTIONS.map((opt) => {
                      const selected = form.contentType === opt.content_type;
                      const Icon = opt.Icon;
                      return (
                        <button
                          key={opt.content_type}
                          type="button"
                          onClick={() => !isEditMode && setContentType(opt.content_type)}
                          disabled={isEditMode}
                          className={cn(
                            "flex items-start gap-3 px-3 py-3 rounded-lg border text-left transition-all",
                            selected
                              ? "border-primary bg-primary/5"
                              : cn(softBorder, dark ? "bg-slate-900/40 hover:border-primary/40" : "bg-white hover:border-primary/40"),
                            isEditMode && "opacity-60 cursor-not-allowed",
                          )}
                        >
                          <span
                            className={cn(
                              "w-9 h-9 rounded-lg flex items-center justify-center shrink-0",
                              selected ? "bg-primary text-white" : "bg-primary/10 text-primary",
                            )}
                          >
                            <Icon size={15} />
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className={cn("text-[12px] font-black", text)}>{opt.name}</p>
                            <p className={cn("text-[10px] font-medium opacity-60 mt-0.5 truncate", sub)}>
                              {opt.details}
                            </p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* How to present this field */}
              {form.contentType && form.contentType !== "FIXED" && (
                <div className="space-y-2">
                  <label className={labelCls}>How to present this field</label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {allowedInputs.map((opt) => {
                      const selected = form.inputType === opt.slug;
                      const Icon = opt.Icon;
                      return (
                        <button
                          key={opt.slug}
                          type="button"
                          onClick={() => setInputType(opt.slug as InputType)}
                          className={cn(
                            "rounded-xl border p-4 text-center transition-all flex flex-col items-center gap-2",
                            selected ? "border-primary bg-primary/5" : cn(softBorder, dark ? "bg-slate-900/40 hover:border-primary/40" : "bg-white hover:border-primary/40"),
                          )}
                        >
                          <Icon size={28} className={selected ? "text-primary" : sub.includes("white") ? "text-slate-400" : "text-slate-500"} />
                          <span className={cn("text-[12px] font-semibold", text)}>{opt.text}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* FIXED content_type special section — radio + value input */}
              {form.contentType === "FIXED" && (
                <div className="space-y-3">
                  <p className={cn("text-[11px] font-medium", "text-cyan-500")}>
                    Fixed text applies the same value to every record.
                  </p>
                  <div className="space-y-2">
                    <label className={labelCls}>How to present this field</label>
                    <div className="grid grid-cols-3 gap-3">
                      {[
                        { slug: "text", label: "Text", Icon: TextCursorInput },
                        { slug: "textarea", label: "Paragraph", Icon: MessageSquare },
                        { slug: "number", label: "Number", Icon: Hash },
                      ].map((opt) => {
                        const selected = form.inputType === opt.slug;
                        const Icon = opt.Icon;
                        return (
                          <button
                            key={opt.slug}
                            type="button"
                            onClick={() => setForm((p) => ({ ...p, inputType: opt.slug as InputType }))}
                            className={cn(
                              "rounded-xl border p-3 text-center transition-all flex flex-col items-center gap-1.5",
                              selected ? "border-primary bg-primary/5" : cn(softBorder, dark ? "bg-slate-900/40 hover:border-primary/40" : "bg-white hover:border-primary/40"),
                            )}
                          >
                            <Icon size={18} className={selected ? "text-primary" : "text-slate-500"} />
                            <span className={cn("text-[12px] font-semibold", text)}>{opt.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className={cn(labelCls, "flex items-center gap-2")}>
                      <Info size={11} className="opacity-60" /> Enter the fixed value
                    </label>
                    {form.inputType === "textarea" ? (
                      <textarea
                        value={form.fixedValue}
                        onChange={(e) => setForm((p) => ({ ...p, fixedValue: e.target.value.slice(0, 50000) }))}
                        rows={6}
                        className={textareaCls}
                      />
                    ) : (
                      <input
                        type={form.inputType === "number" ? "number" : "text"}
                        value={form.fixedValue}
                        onChange={(e) => setForm((p) => ({ ...p, fixedValue: e.target.value.slice(0, 250) }))}
                        className={inputCls}
                      />
                    )}
                  </div>
                </div>
              )}

              {/* Validations */}
              {showValidation && (form.contentType === "TEXT" || form.contentType === "NUMBER") && (
                <div className={cn("rounded-xl border p-4 space-y-3", softBg, softBorder)}>
                  <p className={cn("text-[12px] font-semibold", text)}>Validations</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className={cn(labelCls)}>
                        {form.contentType === "TEXT" ? "Min length" : "Min number"}
                      </label>
                      <input
                        type="number"
                        value={form.validation.min_length}
                        onChange={(e) =>
                          setForm((p) => ({
                            ...p,
                            validation: { ...p.validation, min_length: e.target.value },
                          }))
                        }
                        className={inputCls}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className={cn(labelCls)}>
                        {form.contentType === "TEXT" ? "Max length" : "Max number"}
                      </label>
                      <input
                        type="number"
                        value={form.validation.max_length}
                        onChange={(e) =>
                          setForm((p) => ({
                            ...p,
                            validation: { ...p.validation, max_length: e.target.value },
                          }))
                        }
                        className={inputCls}
                      />
                    </div>
                  </div>
                </div>
              )}

              {showValidation && (form.contentType === "DATE" || form.contentType === "DATETIME") && (
                <div className={cn("rounded-xl border p-4 space-y-3", softBg, softBorder)}>
                  <p className={cn("text-[12px] font-semibold", text)}>Validations</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className={cn(labelCls)}>Date format</label>
                      <select
                        value={form.validation.date_format}
                        onChange={(e) =>
                          setForm((p) => ({
                            ...p,
                            validation: { ...p.validation, date_format: e.target.value },
                          }))
                        }
                        className={selectCls}
                      >
                        {DATE_FORMATS.map((f) => (
                          <option key={f.js} value={f.js}>
                            {f.js.toUpperCase()}
                          </option>
                        ))}
                      </select>
                    </div>
                    {form.contentType === "DATETIME" && (
                      <div className="space-y-1">
                        <label className={cn(labelCls)}>Time format</label>
                        <select
                          value={form.validation.time_format}
                          onChange={(e) =>
                            setForm((p) => ({
                              ...p,
                              validation: { ...p.validation, time_format: e.target.value },
                            }))
                          }
                          className={selectCls}
                        >
                          {TIME_FORMATS.map((f) => (
                            <option key={f.js} value={f.js}>
                              {f.text}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {showValidation && form.contentType === "PHONE" && (
                <div className={cn("rounded-xl border p-4 space-y-3", softBg, softBorder)}>
                  <p className={cn("text-[12px] font-semibold", text)}>Validations</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className={cn(labelCls)}>Country</label>
                      <select
                        value={form.validation.country?.id ?? ""}
                        onChange={(e) => {
                          const c = countries.find((x) => x.id === e.target.value) ?? null;
                          setForm((p) => ({
                            ...p,
                            validation: {
                              ...p.validation,
                              country: c,
                              digits: c?.phone_digits ? String(c.phone_digits) : p.validation.digits,
                            },
                          }));
                        }}
                        className={selectCls}
                      >
                        <option value="">Select country</option>
                        {countries.map((c) => (
                          <option key={c.id} value={c.id}>
                            {flagEmoji(c.iso2)} {c.name} {c.phone_code ? `(${c.phone_code})` : ""}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className={cn(labelCls)}>Digits</label>
                      <div className="flex gap-2 items-center">
                        {form.validation.country?.phone_code && (
                          <span className={cn("h-11 px-3 rounded-xl border flex items-center text-[12px] font-bold", softBorder, sub)}>
                            {form.validation.country.phone_code}
                          </span>
                        )}
                        <input
                          type="number"
                          value={form.validation.digits}
                          onChange={(e) =>
                            setForm((p) => ({
                              ...p,
                              validation: { ...p.validation, digits: e.target.value.slice(0, 2) },
                            }))
                          }
                          className={cn(inputCls, "flex-1")}
                          placeholder="e.g 11"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* List options — COUNTRY / CURRENCY / generic choices */}
              {showListOptions && (
                <div className={cn("rounded-xl border p-4 space-y-3", softBg, softBorder)}>
                  {/* Tabs (only when generic choices, not for COUNTRY/CURRENCY which have their own picker) */}
                  {form.contentType !== "COUNTRY" && form.contentType !== "CURRENCY" && (
                    <div className="flex border-b">
                      {[
                        { slug: "create", label: "Create or select options" },
                        { slug: "import", label: "Upload or Copy" },
                      ].map((t) => {
                        const active = form.listType === t.slug;
                        return (
                          <button
                            key={t.slug}
                            type="button"
                            onClick={() => setForm((p) => ({ ...p, listType: t.slug as "create" | "import", properties: [] }))}
                            className={cn(
                              "px-4 py-2 text-[12px] font-semibold transition-colors",
                              active ? "text-primary border-b-2 border-primary" : sub,
                            )}
                          >
                            {t.label}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {/* COUNTRY list */}
                  {form.contentType === "COUNTRY" && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <p className={cn("text-[11px] font-black", text)}>Choose countries</p>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={form.countries.length === countries.length && countries.length > 0}
                            onChange={(e) => selectAllCountries(e.target.checked)}
                            className="rounded accent-[hsl(var(--primary))]"
                          />
                          <span className={cn("text-[11px] font-semibold", sub)}>
                            Select all countries
                          </span>
                        </label>
                      </div>
                      <div className="max-h-60 overflow-y-auto border rounded-lg divide-y">
                        {countries.map((c) => {
                          const checked = form.countries.includes(c.id);
                          return (
                            <label
                              key={c.id}
                              className={cn("flex items-center gap-3 px-3 py-2 cursor-pointer", dark ? "hover:bg-slate-900/40" : "hover:bg-slate-50")}
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => toggleCountry(c.id)}
                                className="rounded accent-[hsl(var(--primary))]"
                              />
                              <span className="text-lg">{flagEmoji(c.iso2)}</span>
                              <span className={cn("text-[12px] font-bold", text)}>{c.name}</span>
                            </label>
                          );
                        })}
                      </div>
                      <p className={cn("text-[10px] font-medium opacity-60", sub)}>
                        {form.countries.length} of {countries.length} selected
                      </p>
                    </div>
                  )}

                  {/* CURRENCY list */}
                  {form.contentType === "CURRENCY" && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <p className={cn("text-[11px] font-black", text)}>Choose currencies</p>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={
                              form.currencies.length ===
                                countries.filter((c) => !!c.currency).length &&
                              form.currencies.length > 0
                            }
                            onChange={(e) => selectAllCurrencies(e.target.checked)}
                            className="rounded accent-[hsl(var(--primary))]"
                          />
                          <span className={cn("text-[11px] font-semibold", sub)}>
                            Select all currencies
                          </span>
                        </label>
                      </div>
                      <div className="max-h-60 overflow-y-auto border rounded-lg divide-y">
                        {countries
                          .filter((c) => !!c.currency)
                          .map((c) => {
                            const checked = form.currencies.includes(c.id);
                            return (
                              <label
                                key={c.id}
                                className={cn("flex items-center gap-3 px-3 py-2 cursor-pointer", dark ? "hover:bg-slate-900/40" : "hover:bg-slate-50")}
                              >
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={() => toggleCurrency(c.id)}
                                  className="rounded accent-[hsl(var(--primary))]"
                                />
                                <span className="text-lg">{flagEmoji(c.iso2)}</span>
                                <span className={cn("text-[12px] font-bold", text)}>
                                  {c.currency} ({c.name})
                                </span>
                              </label>
                            );
                          })}
                      </div>
                    </div>
                  )}

                  {/* Create tab — generic property entry */}
                  {form.contentType !== "COUNTRY" &&
                    form.contentType !== "CURRENCY" &&
                    form.listType === "create" && (
                      <div className="space-y-2">
                        <label className={cn(labelCls)}>List options</label>
                        {form.properties.length === 0 ? (
                          <p className={cn("text-[11px] font-medium opacity-60", sub)}>
                            No options yet.
                          </p>
                        ) : (
                          form.properties.map((prop, idx) => (
                            <div key={idx} className="flex items-center gap-2">
                              <input
                                type="text"
                                value={prop.name}
                                onChange={(e) => updateProperty(idx, e.target.value.slice(0, 250))}
                                className={cn(inputCls, "flex-1")}
                                placeholder="Enter text"
                              />
                              <button
                                type="button"
                                onClick={() => removePropertyAt(idx)}
                                className={cn("w-9 h-9 rounded-lg border flex items-center justify-center transition-all", dark ? "border-slate-800 hover:border-rose-500/40 hover:text-rose-500 text-slate-400" : "border-slate-200 hover:border-rose-500/40 hover:text-rose-500 text-slate-500")}
                              >
                                <X size={13} />
                              </button>
                            </div>
                          ))
                        )}
                        <button
                          type="button"
                          onClick={addProperty}
                          className="flex items-center gap-1 text-primary text-[12px] font-bold mt-1"
                        >
                          <Plus size={14} /> Add more option
                        </button>
                      </div>
                    )}

                  {/* Import tab — paste + delimiter */}
                  {form.contentType !== "COUNTRY" &&
                    form.contentType !== "CURRENCY" &&
                    form.listType === "import" && (
                      <div className="space-y-3">
                        <label className={cn(labelCls)}>Paste options</label>
                        <textarea
                          value={importRaw}
                          onChange={(e) => handleImport(e.target.value, delimiter)}
                          rows={5}
                          className={textareaCls}
                          placeholder="Paste your options here"
                        />
                        <select
                          value={delimiter}
                          onChange={(e) => {
                            setDelimiter(e.target.value);
                            handleImport(importRaw, e.target.value);
                          }}
                          className={selectCls}
                        >
                          {DELIMITERS.map((d) => (
                            <option key={d.value} value={d.value}>
                              {d.label}
                            </option>
                          ))}
                        </select>
                        {form.properties.length > 0 && (
                          <div className={cn("rounded-lg border p-2 max-h-40 overflow-y-auto", softBorder)}>
                            {form.properties.map((p, i) => (
                              <p key={i} className={cn("text-[12px] py-1", text)}>
                                {p.name}
                              </p>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                </div>
              )}

              {/* For + Folder — kept compact */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-2">
                  <label className={labelCls}>For (entity)</label>
                  <select
                    value={form.creatingFor}
                    onChange={(e) => setForm((p) => ({ ...p, creatingFor: e.target.value as ForValue }))}
                    disabled={isEditMode}
                    className={cn(selectCls, "disabled:opacity-50")}
                  >
                    {(enums?.for_values ?? ["WORKSPACE", "CONTACT", "COMPANY", "OPPORTUNITY"]).map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className={labelCls}>Folder</label>
                  <select
                    value={form.folderId}
                    onChange={(e) => setForm((p) => ({ ...p, folderId: e.target.value }))}
                    className={selectCls}
                  >
                    <option value="">Root</option>
                    {folders.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className={cn("flex justify-end gap-2 pt-4 border-t", softBorder)}>
              <button onClick={closeDialog} className={outlineBtn}>
                Cancel
              </button>
              <button onClick={handleSave} disabled={saveMutation.isPending} className={primaryBtn}>
                {saveMutation.isPending && <Loader2 size={12} className="animate-spin" />}
                {isEditMode ? "Update" : "Create"}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Folder Modal ── */}
      <Dialog
        open={showFolderModal}
        onOpenChange={(open) => {
          if (!open) {
            setShowFolderModal(false);
            setEditingFolder(null);
            setFolderName("");
          }
        }}
      >
        <DialogContent className={cn("border p-0 overflow-hidden rounded-[2rem] max-w-sm", card, border)}>
          <div className="p-6 space-y-5">
            <DialogHeader>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
                  <Folder size={18} />
                </div>
                <div className="text-left">
                  <DialogTitle className={cn("text-[14px] font-semibold", text)}>
                    {editingFolder ? "Rename Folder" : "Create Folder"}
                  </DialogTitle>
                  <DialogDescription className={cn("text-[11px] font-medium opacity-60 mt-0.5", sub)}>
                    {editingFolder ? "Pick a new name." : "Group custom fields under a folder."}
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>
            <div className="space-y-2">
              <label className={labelCls}>Folder name</label>
              <input
                value={folderName}
                onChange={(e) => setFolderName(e.target.value.slice(0, 60))}
                className={inputCls}
                placeholder="Enter folder name"
              />
            </div>
            <div className={cn("flex justify-end gap-2 pt-4 border-t", softBorder)}>
              <button
                onClick={() => {
                  setShowFolderModal(false);
                  setEditingFolder(null);
                  setFolderName("");
                }}
                className={outlineBtn}
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (!folderName.trim()) {
                    toast({ title: "Missing name", variant: "destructive" });
                    return;
                  }
                  folderMutation.mutate();
                }}
                disabled={folderMutation.isPending}
                className={primaryBtn}
              >
                {folderMutation.isPending && <Loader2 size={12} className="animate-spin" />}
                {editingFolder ? "Save" : "Create"}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Delete Dialog ── */}
      <AlertDialog open={!!fieldToDelete} onOpenChange={(open) => !open && setFieldToDelete(null)}>
        <AlertDialogContent className={cn("rounded-[2rem] border p-0 max-w-md overflow-hidden", card, border)}>
          <div className="p-6 space-y-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-500/10 flex items-center justify-center text-rose-500">
                <AlertCircle size={18} />
              </div>
              <div>
                <h2 className={cn("text-[14px] font-semibold", text)}>Delete Field?</h2>
                <p className={cn("text-[11px] font-medium opacity-60 mt-0.5 leading-relaxed", sub)}>
                  <span className="text-rose-500 font-black">{fieldToDelete?.label ?? "This field"}</span> and every stored value will be permanently removed.
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <AlertDialogCancel className={cn(outlineBtn, "m-0")}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => fieldToDelete && deleteMutation.mutate(fieldToDelete.slug)}
                disabled={deleteMutation.isPending}
                className="h-11 px-7 rounded-xl bg-rose-500 hover:bg-rose-600 text-white text-[11px] font-semibold transition-all shadow-lg shadow-rose-500/20 flex items-center gap-2"
              >
                {deleteMutation.isPending ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                Delete
              </AlertDialogAction>
            </div>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function isPropertyBacked(inputType: string): boolean {
  return ["checkbox", "multiselect", "radio", "select"].includes(inputType);
}

function flagEmoji(iso2: string): string {
  // Convert ISO 2-letter code to regional indicator symbols (renders as flag).
  if (!iso2 || iso2.length !== 2) return "";
  const codePoints = iso2
    .toUpperCase()
    .split("")
    .map((c) => 127397 + c.charCodeAt(0));
  return String.fromCodePoint(...codePoints);
}

function serialiseValidation(form: FormState): string | null {
  const v = form.validation;
  const payload: any = {};
  if (v.min_length) payload.min_length = v.min_length;
  if (v.max_length) payload.max_length = v.max_length;
  if (form.contentType === "DATE" || form.contentType === "DATETIME") {
    payload.date_format = v.date_format;
    if (form.contentType === "DATETIME") payload.time_format = v.time_format;
  }
  if (form.contentType === "PHONE" && v.country) {
    payload.country = {
      id: v.country.id,
      iso2: v.country.iso2,
      phone_code: v.country.phone_code,
      phone_digits: v.country.phone_digits,
    };
    if (v.digits) payload.digits = v.digits;
  }
  return Object.keys(payload).length === 0 ? null : JSON.stringify(payload);
}

function safeParseValidation(raw: string | null, countries: CountryRow[]) {
  const base = {
    min_length: "",
    max_length: "",
    date_format: "yyyy-MM-dd",
    time_format: "H:mm",
    country: null as CountryRow | null,
    digits: "",
  };
  if (!raw) return base;
  try {
    const parsed = JSON.parse(raw);
    if (parsed.country?.id) {
      base.country = countries.find((c) => c.id === parsed.country.id) ?? null;
    }
    return {
      ...base,
      ...parsed,
      country: base.country,
      digits: parsed.digits ? String(parsed.digits) : "",
      min_length: parsed.min_length ? String(parsed.min_length) : "",
      max_length: parsed.max_length ? String(parsed.max_length) : "",
    };
  } catch {
    return base;
  }
}
