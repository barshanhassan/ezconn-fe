/**
 * Sub-dialogs used by the Contact Profile modal. Each one mirrors a Vue
 * sub-modal from replyagent (DeleteContact, OpportunityForm, GalleryPicker,
 * BulkActions, CreateCustomField full, etc.).
 */
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
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
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
  Loader2,
  X,
  Check,
  AlertTriangle,
  ChevronDown,
  Plus,
  Trash2,
  Folder,
  Image as ImageIcon,
  Search,
  Tag as TagIcon,
  ListChecks,
  Upload,
  Download,
  PowerOff,
  Power,
} from "lucide-react";

const apiGet = async (url: string) => (await apiRequest("GET", url)).json();
const apiPost = async (url: string, data?: any) =>
  (await apiRequest("POST", url, data)).json();
const apiDelete = async (url: string) => {
  const r = await apiRequest("DELETE", url);
  const text = await r.text();
  try {
    return text ? JSON.parse(text) : { success: true };
  } catch {
    return { success: true };
  }
};

// ─── DeleteContact with random 5-digit code ─────────────────────────

export function DeleteContactDialog({
  open,
  onOpenChange,
  contactName,
  onConfirmDelete,
  deleting,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  contactName: string;
  onConfirmDelete: () => void;
  deleting: boolean;
}) {
  const { t } = useTranslation();
  // A fresh random 5-digit code is generated each time the dialog opens. We
  // use a ref-equivalent state initialized when the dialog opens.
  const [code, setCode] = useState<string>("");
  const [typed, setTyped] = useState("");

  useEffect(() => {
    if (open) {
      // generate 5-digit number, range 10000..99999
      const n = Math.floor(10000 + Math.random() * 90000);
      setCode(String(n));
      setTyped("");
    }
  }, [open]);

  const matches = typed === code;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogTitle className="text-base">
          {t("contact_profile_sub_dialogs.delete_contact.title")}{" "}
          <span className="text-destructive font-semibold">{contactName}</span>
        </DialogTitle>
        <DialogDescription className="text-sm">
          {t("contact_profile_sub_dialogs.delete_contact.description")}
        </DialogDescription>
        <ul className="list-disc pl-5 text-xs space-y-1">
          <li>
            <strong>{contactName}</strong>
            {t("contact_profile_sub_dialogs.delete_contact.bullet_profile_trash")}
          </li>
          <li>{t("contact_profile_sub_dialogs.delete_contact.bullet_conversations")}</li>
          <li>
            {t("contact_profile_sub_dialogs.delete_contact.bullet_tasks")}
          </li>
          <li>{t("contact_profile_sub_dialogs.delete_contact.bullet_automations")}</li>
          <li className="text-destructive">
            {t("contact_profile_sub_dialogs.delete_contact.bullet_no_restore")}
          </li>
        </ul>
        <div className="mt-3">
          <Label className="text-xs">
            {t("contact_profile_sub_dialogs.delete_contact.type_prefix")}{" "}
            <span className="font-mono font-bold bg-muted px-1 py-0.5 rounded">
              {code}
            </span>{" "}
            {t("contact_profile_sub_dialogs.delete_contact.type_suffix")}
          </Label>
          <Input
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            placeholder={t("contact_profile_sub_dialogs.delete_contact.enter_code")}
            className="mt-1"
            inputMode="numeric"
            autoFocus
          />
        </div>
        <div className="flex justify-end gap-2 mt-3">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("contact_profile_sub_dialogs.common.cancel")}
          </Button>
          <Button
            disabled={!matches || deleting}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            onClick={onConfirmDelete}
          >
            {deleting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            {t("contact_profile_sub_dialogs.common.delete")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Opportunity Form (pipeline + step + status + probability + agent) ───

export function OpportunityFormDialog({
  open,
  onOpenChange,
  contactId,
  initial,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  contactId: string | null;
  initial?: any;
  onSaved: () => void;
}) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [pipelineId, setPipelineId] = useState<string | null>(null);
  const [stepId, setStepId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [value, setValue] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [closingDate, setClosingDate] = useState("");
  const [probability, setProbability] = useState(50);
  const [agentId, setAgentId] = useState<string | null>(null);
  const [status, setStatus] = useState("ACTIVE");
  const [lostReason, setLostReason] = useState("");
  const [note, setNote] = useState("");

  useEffect(() => {
    if (!open) {
      setPipelineId(null);
      setStepId(null);
      setTitle("");
      setValue("");
      setCurrency("USD");
      setClosingDate("");
      setProbability(50);
      setAgentId(null);
      setStatus("ACTIVE");
      setLostReason("");
      setNote("");
    } else if (initial) {
      setPipelineId(initial.pipeline_id ?? null);
      setStepId(initial.step_id ?? null);
      setTitle(initial.title ?? "");
      setValue(String(initial.value ?? ""));
      setCurrency(initial.currency ?? "USD");
      setClosingDate(initial.closing_date ?? "");
      setProbability(Number(initial.probability ?? 50));
      setAgentId(initial.assign_to ?? null);
      setStatus(initial.status ?? "ACTIVE");
      setLostReason(initial.lost_reason ?? "");
      setNote(initial.note?.text ?? "");
    }
  }, [open, initial]);

  const { data: pipelinesResp } = useQuery({
    queryKey: ["/api/pipelines"],
    queryFn: () => apiGet("/api/pipelines"),
    enabled: open,
  });
  const pipelines: any[] = useMemo(
    () => pipelinesResp?.pipelines ?? pipelinesResp ?? [],
    [pipelinesResp],
  );
  const steps: any[] = useMemo(
    () =>
      pipelines.find((p) => String(p.id) === String(pipelineId))?.steps ?? [],
    [pipelines, pipelineId],
  );

  const { data: usersResp } = useQuery({
    queryKey: ["/api/users"],
    queryFn: () => apiGet("/api/users"),
    enabled: open,
  });
  const users: any[] = useMemo(
    () => usersResp?.users ?? usersResp ?? [],
    [usersResp],
  );

  const submit = useMutation({
    mutationFn: () =>
      apiPost("/api/pipelines/opportunities", {
        pipeline_id: pipelineId,
        step_id: stepId,
        contact_id: contactId,
        title,
        value: value ? Number(value) : 0,
        currency,
        closing_date: closingDate || null,
        probability,
        assign_to: agentId,
        status,
        lost_reason: status === "LOST" ? lostReason : null,
        note: note ? { text: note } : null,
      }),
    onSuccess: () => {
      toast({ title: t("contact_profile_sub_dialogs.opportunity_form.saved_toast") });
      queryClient.invalidateQueries({ queryKey: ["/api/contacts"] });
      onSaved();
    },
    onError: (err: any) => {
      toast({
        title: t("contact_profile_sub_dialogs.opportunity_form.save_failed_toast"),
        description: err?.message ?? "",
        variant: "destructive",
      });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogTitle>
          {initial
            ? t("contact_profile_sub_dialogs.opportunity_form.edit_title")
            : t("contact_profile_sub_dialogs.opportunity_form.new_title")}
        </DialogTitle>
        <DialogDescription>
          {t("contact_profile_sub_dialogs.opportunity_form.description")}
        </DialogDescription>

        <div className="grid grid-cols-2 gap-4 py-2">
          <div>
            <Label>{t("contact_profile_sub_dialogs.opportunity_form.pipeline_label")}</Label>
            <Select
              value={pipelineId ?? ""}
              onValueChange={(v) => {
                setPipelineId(v);
                setStepId(null);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder={t("contact_profile_sub_dialogs.opportunity_form.choose_pipeline")} />
              </SelectTrigger>
              <SelectContent>
                {pipelines.map((p: any) => (
                  <SelectItem key={p.id} value={String(p.id)}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>{t("contact_profile_sub_dialogs.opportunity_form.step_label")}</Label>
            <Select
              value={stepId ?? ""}
              onValueChange={setStepId}
              disabled={!pipelineId}
            >
              <SelectTrigger>
                <SelectValue placeholder={t("contact_profile_sub_dialogs.opportunity_form.choose_step")} />
              </SelectTrigger>
              <SelectContent>
                {steps.map((s: any) => (
                  <SelectItem key={s.id} value={String(s.id)}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="col-span-2">
            <Label>{t("contact_profile_sub_dialogs.opportunity_form.title_label")}</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>

          <div>
            <Label>{t("contact_profile_sub_dialogs.opportunity_form.value_label")}</Label>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">{currency}</span>
              <Input
                type="number"
                value={value}
                onChange={(e) => setValue(e.target.value)}
              />
            </div>
          </div>
          <div>
            <Label>{t("contact_profile_sub_dialogs.opportunity_form.currency_label")}</Label>
            <Select value={currency} onValueChange={setCurrency}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {["USD", "EUR", "GBP", "PKR", "INR", "BRL", "AED"].map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>{t("contact_profile_sub_dialogs.opportunity_form.closing_date_label")}</Label>
            <Input
              type="date"
              value={closingDate}
              onChange={(e) => setClosingDate(e.target.value)}
            />
          </div>
          <div>
            <Label>
              {t("contact_profile_sub_dialogs.opportunity_form.probability_label", { probability })}
            </Label>
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={probability}
              onChange={(e) => setProbability(Number(e.target.value))}
              className="w-full"
            />
          </div>

          <div>
            <Label>{t("contact_profile_sub_dialogs.opportunity_form.assigned_to_label")}</Label>
            <Select value={agentId ?? ""} onValueChange={setAgentId}>
              <SelectTrigger>
                <SelectValue placeholder={t("contact_profile_sub_dialogs.opportunity_form.unassigned")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">{t("contact_profile_sub_dialogs.opportunity_form.unassigned")}</SelectItem>
                {users.map((u: any) => (
                  <SelectItem key={u.id} value={String(u.id)}>
                    {u.full_name ?? u.name ?? `${u.first_name ?? ""} ${u.last_name ?? ""}`.trim() ?? `User ${u.id}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>{t("contact_profile_sub_dialogs.opportunity_form.status_label")}</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ACTIVE">{t("contact_profile_sub_dialogs.opportunity_form.status_active")}</SelectItem>
                <SelectItem value="WON">{t("contact_profile_sub_dialogs.opportunity_form.status_won")}</SelectItem>
                <SelectItem value="LOST">{t("contact_profile_sub_dialogs.opportunity_form.status_lost")}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {status === "LOST" && (
            <div className="col-span-2">
              <Label>{t("contact_profile_sub_dialogs.opportunity_form.lost_reason_label")}</Label>
              <Input
                value={lostReason}
                onChange={(e) => setLostReason(e.target.value)}
                placeholder={t("contact_profile_sub_dialogs.opportunity_form.lost_reason_placeholder")}
              />
            </div>
          )}

          <div className="col-span-2">
            <Label>{t("contact_profile_sub_dialogs.opportunity_form.note_label")}</Label>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={t("contact_profile_sub_dialogs.opportunity_form.note_placeholder")}
              rows={2}
            />
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("contact_profile_sub_dialogs.common.cancel")}
          </Button>
          <Button
            disabled={!pipelineId || !stepId || submit.isPending}
            onClick={() => submit.mutate()}
          >
            {submit.isPending && (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            )}
            {t("contact_profile_sub_dialogs.common.save")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Gallery Picker ────────────────────────────────────────────────
//
// Replyagent-parity media picker used by image / audio / video / document
// activity fields in the smart-flow builder. Three things must work:
//   1. List existing workspace media (filtered by mediaType when set)
//   2. Upload a fresh file from the picker itself ("Add files")
//   3. Enter a direct URL as fallback when the asset lives elsewhere
//
// Earlier bug: this dialog read `data.media`/`data.data` from
// /api/gallery/listings, but the backend actually returns
// `{ folders, file_folders: { data: [...] } }`. Reading the right key is
// what makes the gallery stop showing "No media yet" for workspaces that
// already have uploads.

export function GalleryPickerDialog({
  open,
  onOpenChange,
  onPick,
  mediaType,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onPick: (media: { id: string; url: string; object_name: string }) => void;
  mediaType?: string;
}) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [urlInput, setUrlInput] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["/api/gallery/listings", mediaType],
    queryFn: () =>
      apiGet(
        `/api/gallery/listings${mediaType ? `?media_type=${mediaType}` : ""}`,
      ),
    enabled: open,
  });

  // Backend shape: { folders, file_folders: { data, total, ... } }.
  // Be defensive — also accept legacy `media` / top-level `data` so an
  // older API contract still works.
  const items: any[] = useMemo(() => {
    return (
      data?.file_folders?.data ??
      data?.media ??
      (Array.isArray(data?.data) ? data.data : []) ??
      []
    );
  }, [data]);

  const filteredItems = useMemo(() => {
    if (!mediaType) return items;
    const want = mediaType.toUpperCase();
    return items.filter((m: any) => {
      const t = (m.media_type ?? "").toString().toUpperCase();
      return !t || t === want;
    });
  }, [items, mediaType]);

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const fd = new FormData();
      fd.append("files", file);
      const res = await apiRequest("POST", "/api/gallery/upload", fd);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/gallery/listings"] });
      toast({
        title: t("contact_profile_sub_dialogs.gallery_picker.uploaded_toast"),
        description: t("contact_profile_sub_dialogs.gallery_picker.uploaded_toast_description"),
      });
    },
    onError: (err: any) =>
      toast({
        title: t("contact_profile_sub_dialogs.gallery_picker.upload_failed_toast"),
        description: err?.message ?? t("contact_profile_sub_dialogs.gallery_picker.try_again"),
        variant: "destructive",
      }),
  });

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) uploadMutation.mutate(file);
    e.target.value = ""; // allow re-selecting the same file
  };

  const handleUrlSubmit = () => {
    const url = urlInput.trim();
    if (!url) return;
    onPick({ id: "", url, object_name: url.split("/").pop() ?? url });
    setUrlInput("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogTitle>{t("contact_profile_sub_dialogs.gallery_picker.title")}</DialogTitle>
        <DialogDescription>
          {t("contact_profile_sub_dialogs.gallery_picker.description")}
        </DialogDescription>

        {/* Action bar — upload + URL fallback */}
        <div className="flex items-center gap-2 border-b pb-3">
          <label className="inline-flex">
            <input
              type="file"
              accept={mediaType === "image" ? "image/*" : undefined}
              className="hidden"
              onChange={handleFileInput}
              disabled={uploadMutation.isPending}
            />
            <span className="inline-flex items-center gap-2 cursor-pointer text-xs px-3 py-1.5 rounded border bg-white hover:bg-muted">
              <ImageIcon className="h-3.5 w-3.5" />
              {uploadMutation.isPending
                ? t("contact_profile_sub_dialogs.gallery_picker.uploading")
                : t("contact_profile_sub_dialogs.gallery_picker.add_files")}
            </span>
          </label>

          <div className="flex-1 flex items-center gap-2">
            <Input
              type="url"
              placeholder={t("contact_profile_sub_dialogs.gallery_picker.url_placeholder")}
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              className="h-8 text-xs"
            />
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={handleUrlSubmit}
              disabled={!urlInput.trim()}
            >
              {t("contact_profile_sub_dialogs.gallery_picker.use_url")}
            </Button>
          </div>
        </div>

        <ScrollArea className="h-96">
          {isLoading ? (
            <p className="text-sm text-muted-foreground p-6 text-center">
              {t("contact_profile_sub_dialogs.gallery_picker.loading")}
            </p>
          ) : filteredItems.length === 0 ? (
            <p className="text-sm text-muted-foreground p-6 text-center">
              {t("contact_profile_sub_dialogs.gallery_picker.no_media")}
            </p>
          ) : (
            <div className="grid grid-cols-4 gap-3 p-2">
              {filteredItems.map((m: any) => {
                const id = String(m.object_id ?? m.id ?? "");
                const url = m.file_url ?? m.url ?? "";
                const thumb = m.thumb_200 ?? m.thumbnail ?? url;
                return (
                  <button
                    key={id || url}
                    type="button"
                    className="border rounded overflow-hidden hover:ring-2 hover:ring-primary text-left"
                    onClick={() =>
                      onPick({
                        id,
                        url,
                        object_name: m.object_name ?? "",
                      })
                    }
                  >
                    {url ? (
                      <img
                        src={thumb}
                        alt={m.object_name}
                        className="w-full h-24 object-cover bg-muted"
                      />
                    ) : (
                      <div className="w-full h-24 flex items-center justify-center bg-muted">
                        <ImageIcon className="h-6 w-6 text-muted-foreground" />
                      </div>
                    )}
                    <p className="text-xs truncate p-1">{m.object_name}</p>
                  </button>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

// ─── Full Create Custom Field — 12 content types ─────────────────────

export function CreateCustomFieldDialog({
  open,
  onOpenChange,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onSaved: () => void;
}) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [label, setLabel] = useState("");
  const [systemName, setSystemName] = useState("");
  const [systemNameTouched, setSystemNameTouched] = useState(false);
  const [description, setDescription] = useState("");
  const [contentType, setContentType] = useState("TEXT");
  const [inputType, setInputType] = useState("text");
  const [properties, setProperties] = useState<
    { value: string; label?: string }[]
  >([]);
  const [availability, setAvailability] = useState<"unknown" | "ok" | "taken" | "checking">("unknown");

  const slugFromLabel = (s: string) =>
    s
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");

  useEffect(() => {
    if (!systemNameTouched) {
      setSystemName(slugFromLabel(label));
    }
  }, [label, systemNameTouched]);

  // Live system_name availability check (debounced)
  useEffect(() => {
    if (!systemName || !open) {
      setAvailability("unknown");
      return;
    }
    setAvailability("checking");
    const timer = setTimeout(async () => {
      try {
        const resp = await apiGet(
          `/api/custom-fields/check-availability?system_name=${encodeURIComponent(systemName)}`,
        );
        setAvailability(resp.is_available ? "ok" : "taken");
      } catch {
        setAvailability("unknown");
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [systemName, open]);

  useEffect(() => {
    if (!open) {
      setLabel("");
      setSystemName("");
      setSystemNameTouched(false);
      setDescription("");
      setContentType("TEXT");
      setInputType("text");
      setProperties([]);
      setAvailability("unknown");
    }
  }, [open]);

  // Auto-adjust input type when content type changes.
  useEffect(() => {
    if (contentType === "DATE") setInputType("date");
    else if (contentType === "DATETIME") setInputType("datetime");
    else if (contentType === "NUMBER" || contentType === "CURRENCY") setInputType("number");
    else if (contentType === "PHONE") setInputType("text");
    else if (contentType === "URL") setInputType("text");
    else if (contentType === "EMAIL") setInputType("email");
    else setInputType("text");
  }, [contentType]);

  const submit = useMutation({
    mutationFn: () =>
      apiPost("/api/custom-fields/field", {
        label,
        system_name: systemName,
        slug: systemName,
        description,
        content_type: contentType,
        input_type: inputType,
        entity_type: "Contact",
        properties: properties.filter((p) => p.value),
      }),
    onSuccess: () => {
      toast({ title: t("contact_profile_sub_dialogs.custom_field.created_toast") });
      queryClient.invalidateQueries({ queryKey: ["/api/custom-fields"] });
      onSaved();
    },
    onError: (err: any) => {
      toast({
        title: t("contact_profile_sub_dialogs.custom_field.create_failed_toast"),
        description: err?.message ?? "",
        variant: "destructive",
      });
    },
  });

  const showProperties = ["select", "multiselect", "radio"].includes(inputType);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogTitle>{t("contact_profile_sub_dialogs.custom_field.title")}</DialogTitle>
        <DialogDescription>
          {t("contact_profile_sub_dialogs.custom_field.description")}
        </DialogDescription>

        <div className="space-y-3 py-2">
          <div>
            <Label>{t("contact_profile_sub_dialogs.custom_field.label_label")}</Label>
            <Input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder={t("contact_profile_sub_dialogs.custom_field.label_placeholder")}
              maxLength={60}
            />
          </div>
          <div>
            <Label>{t("contact_profile_sub_dialogs.custom_field.system_name_label")}</Label>
            <div className="relative">
              <Input
                value={systemName}
                onChange={(e) => {
                  setSystemNameTouched(true);
                  setSystemName(e.target.value.toLowerCase());
                }}
                placeholder="date_of_birth"
                maxLength={250}
                className="pr-8"
              />
              <div className="absolute right-2 top-1/2 -translate-y-1/2">
                {availability === "checking" && (
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                )}
                {availability === "ok" && (
                  <Check className="h-3.5 w-3.5 text-emerald-600" />
                )}
                {availability === "taken" && (
                  <X className="h-3.5 w-3.5 text-destructive" />
                )}
              </div>
            </div>
            {availability === "taken" && (
              <p className="text-xs text-destructive mt-1">
                {t("contact_profile_sub_dialogs.custom_field.system_name_taken")}
              </p>
            )}
          </div>
          <div>
            <Label>{t("contact_profile_sub_dialogs.custom_field.description_label")}</Label>
            <Textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>{t("contact_profile_sub_dialogs.custom_field.content_type_label")}</Label>
              <Select value={contentType} onValueChange={setContentType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="TEXT">{t("contact_profile_sub_dialogs.custom_field.content_type_text")}</SelectItem>
                  <SelectItem value="NUMBER">{t("contact_profile_sub_dialogs.custom_field.content_type_number")}</SelectItem>
                  <SelectItem value="CURRENCY">{t("contact_profile_sub_dialogs.custom_field.content_type_currency")}</SelectItem>
                  <SelectItem value="DATE">{t("contact_profile_sub_dialogs.custom_field.content_type_date")}</SelectItem>
                  <SelectItem value="DATETIME">{t("contact_profile_sub_dialogs.custom_field.content_type_datetime")}</SelectItem>
                  <SelectItem value="PHONE">{t("contact_profile_sub_dialogs.custom_field.content_type_phone")}</SelectItem>
                  <SelectItem value="EMAIL">{t("contact_profile_sub_dialogs.custom_field.content_type_email")}</SelectItem>
                  <SelectItem value="URL">{t("contact_profile_sub_dialogs.custom_field.content_type_url")}</SelectItem>
                  <SelectItem value="FIXED">{t("contact_profile_sub_dialogs.custom_field.content_type_fixed")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{t("contact_profile_sub_dialogs.custom_field.input_type_label")}</Label>
              <Select value={inputType} onValueChange={setInputType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="text">{t("contact_profile_sub_dialogs.custom_field.input_type_single_line")}</SelectItem>
                  <SelectItem value="textarea">{t("contact_profile_sub_dialogs.custom_field.input_type_multi_line")}</SelectItem>
                  <SelectItem value="number">{t("contact_profile_sub_dialogs.custom_field.content_type_number")}</SelectItem>
                  <SelectItem value="email">{t("contact_profile_sub_dialogs.custom_field.content_type_email")}</SelectItem>
                  <SelectItem value="date">{t("contact_profile_sub_dialogs.custom_field.input_type_date_picker")}</SelectItem>
                  <SelectItem value="datetime">{t("contact_profile_sub_dialogs.custom_field.content_type_datetime")}</SelectItem>
                  <SelectItem value="select">{t("contact_profile_sub_dialogs.custom_field.input_type_single_select")}</SelectItem>
                  <SelectItem value="multiselect">{t("contact_profile_sub_dialogs.custom_field.input_type_multi_select")}</SelectItem>
                  <SelectItem value="radio">{t("contact_profile_sub_dialogs.custom_field.input_type_radio")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {showProperties && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <Label>{t("contact_profile_sub_dialogs.custom_field.options_label")}</Label>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setProperties([...properties, { value: "", label: "" }])
                  }
                >
                  <Plus className="h-3.5 w-3.5 mr-1" /> {t("contact_profile_sub_dialogs.custom_field.add_option")}
                </Button>
              </div>
              {properties.map((p, idx) => (
                <div key={idx} className="flex gap-2 mb-1">
                  <Input
                    value={p.value}
                    onChange={(e) => {
                      const next = [...properties];
                      next[idx] = { ...p, value: e.target.value };
                      setProperties(next);
                    }}
                    placeholder={t("contact_profile_sub_dialogs.custom_field.value_placeholder")}
                  />
                  <Input
                    value={p.label ?? ""}
                    onChange={(e) => {
                      const next = [...properties];
                      next[idx] = { ...p, label: e.target.value };
                      setProperties(next);
                    }}
                    placeholder={t("contact_profile_sub_dialogs.custom_field.option_label_placeholder")}
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() =>
                      setProperties(properties.filter((_, i) => i !== idx))
                    }
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("contact_profile_sub_dialogs.common.cancel")}
          </Button>
          <Button
            disabled={
              !label ||
              !systemName ||
              availability === "taken" ||
              submit.isPending
            }
            onClick={() => submit.mutate()}
          >
            {submit.isPending && (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            )}
            {t("contact_profile_sub_dialogs.common.create")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Note-add dropdown with 6 channels ──────────────────────────────

export function NoteAddDropdown({
  contactId,
  onAdded,
}: {
  contactId: string | null;
  onAdded: () => void;
}) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [channel, setChannel] = useState<string | null>(null);
  const [text, setText] = useState("");

  const submit = useMutation({
    mutationFn: () =>
      apiPost("/api/notes", {
        contact_id: contactId,
        note: text,
        type: channel === "internal" ? "text" : "channel",
        channel: channel === "internal" ? null : channel,
      }),
    onSuccess: () => {
      toast({ title: t("contact_profile_sub_dialogs.note_add.added_toast") });
      setOpen(false);
      setText("");
      setChannel(null);
      onAdded();
    },
  });

  const channelOptions = [
    { k: "internal", l: t("contact_profile_sub_dialogs.note_add.channel_internal") },
    { k: "sms", l: t("contact_profile_sub_dialogs.note_add.channel_sms") },
    { k: "whatsapp", l: "WhatsApp" },
    { k: "messenger", l: "Messenger" },
    { k: "instagram", l: "Instagram" },
    { k: "telegram", l: "Telegram" },
    { k: "email", l: t("contact_profile_sub_dialogs.note_add.channel_email") },
  ];

  return (
    <>
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm">
            <Plus className="h-3.5 w-3.5 mr-1" />
            {t("contact_profile_sub_dialogs.note_add.add_note")}
            <ChevronDown className="h-3 w-3 ml-1" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-48 p-0">
          {channelOptions.map((opt) => (
            <button
              key={opt.k}
              type="button"
              className="w-full text-left text-sm px-3 py-2 hover:bg-muted/50"
              onClick={() => {
                setChannel(opt.k);
                setOpen(true);
              }}
            >
              {opt.l}
            </button>
          ))}
        </PopoverContent>
      </Popover>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogTitle>
            {channel === "internal"
              ? t("contact_profile_sub_dialogs.note_add.channel_internal")
              : t("contact_profile_sub_dialogs.note_add.channel_note_title", {
                  channel: `${channel?.[0]?.toUpperCase()}${channel?.slice(1)}`,
                })}
          </DialogTitle>
          <DialogDescription>
            {t("contact_profile_sub_dialogs.note_add.timeline_hint")}
          </DialogDescription>
          <Textarea
            rows={4}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={t("contact_profile_sub_dialogs.note_add.write_note_placeholder")}
          />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>
              {t("contact_profile_sub_dialogs.common.cancel")}
            </Button>
            <Button
              disabled={!text || submit.isPending}
              onClick={() => submit.mutate()}
            >
              {submit.isPending && (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              )}
              {t("contact_profile_sub_dialogs.common.save")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ─── Bulk Actions Popup — 10 actions ────────────────────────────────

export type BulkAction =
  | "add_tag"
  | "remove_tag"
  | "add_cf_value"
  | "remove_cf_value"
  | "activate"
  | "delete"
  | "delete_all"
  | "import"
  | "export"
  | "export_psid";

export function BulkActionsPopup({
  selectedIds,
  onAction,
}: {
  selectedIds: string[];
  onAction: (action: BulkAction) => void;
}) {
  const { t } = useTranslation();
  const actionOptions: { k: BulkAction; l: string; icon: any }[] = [
    { k: "add_tag", l: t("contact_profile_sub_dialogs.bulk_actions.add_tag"), icon: TagIcon },
    { k: "remove_tag", l: t("contact_profile_sub_dialogs.bulk_actions.remove_tag"), icon: X },
    { k: "add_cf_value", l: t("contact_profile_sub_dialogs.bulk_actions.set_custom_field"), icon: ListChecks },
    { k: "remove_cf_value", l: t("contact_profile_sub_dialogs.bulk_actions.clear_custom_field"), icon: ListChecks },
    { k: "activate", l: t("contact_profile_sub_dialogs.bulk_actions.activate_contacts"), icon: Power },
    { k: "delete", l: t("contact_profile_sub_dialogs.bulk_actions.delete_contacts"), icon: Trash2 },
    { k: "delete_all", l: t("contact_profile_sub_dialogs.bulk_actions.delete_all_filtered"), icon: Trash2 },
    { k: "import", l: t("contact_profile_sub_dialogs.bulk_actions.import_contacts"), icon: Upload },
    { k: "export", l: t("contact_profile_sub_dialogs.bulk_actions.export_contacts"), icon: Download },
    { k: "export_psid", l: t("contact_profile_sub_dialogs.bulk_actions.export_psid"), icon: Download },
  ];
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          disabled={selectedIds.length === 0}
        >
          {t("contact_profile_sub_dialogs.bulk_actions.button_label", { count: selectedIds.length })}
          <ChevronDown className="h-3 w-3 ml-1" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-0">
        {actionOptions.map((opt) => {
          const Icon = opt.icon;
          return (
            <button
              key={opt.k}
              type="button"
              className="w-full text-left text-sm px-3 py-2 hover:bg-muted/50 flex items-center gap-2"
              onClick={() => onAction(opt.k)}
            >
              <Icon className="h-3.5 w-3.5 text-muted-foreground" />
              {opt.l}
            </button>
          );
        })}
      </PopoverContent>
    </Popover>
  );
}

// ─── Add Lead (new contact in company) ──────────────────────────────

export function AddLeadDialog({
  open,
  onOpenChange,
  companyId,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  companyId: string | null;
  onSaved: () => void;
}) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [first, setFirst] = useState("");
  const [last, setLast] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [timezone, setTimezone] = useState("UTC");

  useEffect(() => {
    if (!open) {
      setFirst("");
      setLast("");
      setEmail("");
      setPhone("");
      setTimezone("UTC");
    }
  }, [open]);

  const submit = useMutation({
    mutationFn: () =>
      apiPost("/api/contacts", {
        first_name: first,
        last_name: last,
        email: email || undefined,
        phone: phone || undefined,
        timezone,
        company_id: companyId,
      }),
    onSuccess: () => {
      toast({ title: t("contact_profile_sub_dialogs.add_lead.created_toast") });
      queryClient.invalidateQueries({ queryKey: ["/api/contacts"] });
      onSaved();
    },
    onError: (err: any) => {
      toast({
        title: t("contact_profile_sub_dialogs.add_lead.create_failed_toast"),
        description: err?.message ?? "",
        variant: "destructive",
      });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogTitle>{t("contact_profile_sub_dialogs.add_lead.title")}</DialogTitle>
        <DialogDescription>
          {companyId
            ? t("contact_profile_sub_dialogs.add_lead.description_company")
            : t("contact_profile_sub_dialogs.add_lead.description_workspace")}
        </DialogDescription>
        <div className="space-y-3 py-2">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>{t("contact_profile_sub_dialogs.add_lead.first_name_label")}</Label>
              <Input
                value={first}
                onChange={(e) => setFirst(e.target.value)}
                maxLength={30}
              />
            </div>
            <div>
              <Label>{t("contact_profile_sub_dialogs.add_lead.last_name_label")}</Label>
              <Input
                value={last}
                onChange={(e) => setLast(e.target.value)}
                maxLength={30}
              />
            </div>
          </div>
          <div>
            <Label>{t("contact_profile_sub_dialogs.add_lead.email_label")}</Label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div>
            <Label>{t("contact_profile_sub_dialogs.add_lead.phone_label")}</Label>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("contact_profile_sub_dialogs.common.cancel")}
          </Button>
          <Button
            disabled={(!first && !last) || submit.isPending}
            onClick={() => submit.mutate()}
          >
            {submit.isPending && (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            )}
            {t("contact_profile_sub_dialogs.common.create")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
