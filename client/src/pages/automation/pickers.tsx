/**
 * Pickers — reusable popover-style selectors used across the Smart Flow
 * builder. Replyagent parity for the gateway-frontend's FieldPicker /
 * WhatsAppTemplatePicker / TextActions / GalleryModal.
 *
 *  - FieldPicker: 2-column popover (left categories, right field list).
 *    Categories: General system, Custom, Pipeline, Workspace. Inserts a
 *    `{{token}}` into the parent input.
 *  - WhatsAppTemplatePicker: dialog that lists approved WA templates from
 *    `/api/whatsapp/templates`, with body+header preview.
 *  - TextActions: floating popover bar shown next to a focused textarea,
 *    offering emoji + field + character counter.
 *  - GalleryPicker: thin wrapper over the GalleryPickerDialog already used
 *    by the Contact Profile modal — re-exported so editors can import from
 *    one place.
 */
// useEffect/useMemo/useRef/useState all used across pickers (FieldPicker
// search state, TextActions viewport measure ref, ChoicesBuilder popover
// state, etc.) — keep the import single-line.
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import {
  Search,
  Hash,
  User as UserIcon,
  Database,
  Clock,
  Smile,
  ChevronDown,
  Image as ImageIcon,
  FileText,
  X,
  Check,
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { GalleryPickerDialog } from "@/components/contact-profile/sub-dialogs";

const apiGet = async (url: string) => (await apiRequest("GET", url)).json();

// ─── Types ─────────────────────────────────────────────────────────────

export interface FieldPickerCategory {
  key: string;
  label: string;
  icon: React.ReactNode;
  fields: FieldPickerField[];
}

export interface FieldPickerField {
  token: string;     // {{contact.first_name}} format
  label: string;
  contentType?: string; // TEXT / NUMBER / DATE / DATETIME / PHONE / EMAIL / URL
  disabled?: boolean;
  hint?: string;
}

// ─── FieldPicker ───────────────────────────────────────────────────────

export function FieldPicker({
  onInsert,
  hideContentTypes,
  buttonVariant = "ghost",
  buttonLabel,
}: {
  onInsert: (token: string) => void;
  /** Hide tokens whose contentType matches any of these (e.g. ['DATE','DATETIME']). */
  hideContentTypes?: string[];
  buttonVariant?: "ghost" | "outline";
  buttonLabel?: string;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("system");
  const resolvedButtonLabel = buttonLabel ?? t("automation_pickers.field_picker_button");

  const { data: customFieldsResp } = useQuery({
    queryKey: ["/api/custom-fields"],
    queryFn: () => apiGet("/api/custom-fields"),
    enabled: open,
  });
  const { data: pipelinesResp } = useQuery({
    queryKey: ["/api/pipelines"],
    queryFn: () => apiGet("/api/pipelines"),
    enabled: open,
  });

  const categories: FieldPickerCategory[] = useMemo(() => {
    const systemFields: FieldPickerField[] = [
      { token: "{{contact.first_name}}", label: t("automation_pickers.field_first_name"), contentType: "TEXT" },
      { token: "{{contact.last_name}}", label: t("automation_pickers.field_last_name"), contentType: "TEXT" },
      { token: "{{contact.full_name}}", label: t("automation_pickers.field_full_name"), contentType: "TEXT" },
      { token: "{{contact.email}}", label: t("automation_pickers.field_email"), contentType: "EMAIL" },
      { token: "{{contact.mobile_number}}", label: t("automation_pickers.field_mobile_number"), contentType: "PHONE" },
      { token: "{{contact.gender}}", label: t("automation_pickers.field_gender"), contentType: "TEXT" },
      { token: "{{contact.language}}", label: t("automation_pickers.field_language"), contentType: "TEXT" },
      { token: "{{contact.locale}}", label: t("automation_pickers.field_locale"), contentType: "TEXT" },
      { token: "{{contact.timezone}}", label: t("automation_pickers.field_timezone"), contentType: "TEXT" },
      { token: "{{contact.source}}", label: t("automation_pickers.field_contact_source"), contentType: "TEXT" },
      { token: "{{contact.id}}", label: t("automation_pickers.field_contact_id"), contentType: "NUMBER" },
      { token: "{{contact.created_at}}", label: t("automation_pickers.field_subscribed_on"), contentType: "DATETIME" },
    ];
    // Coerce-to-array so non-array shapes from these endpoints (e.g. an
    // object response, an error fallback) don't blow up the picker.
    const cfList = Array.isArray(customFieldsResp?.fields)
      ? customFieldsResp.fields
      : Array.isArray(customFieldsResp)
        ? customFieldsResp
        : [];
    const customFields: FieldPickerField[] = cfList.map((f: any) => ({
      token: `{{custom.${f.slug ?? f.system_name ?? f.id}}}`,
      label: f.label ?? f.name ?? f.slug,
      contentType: f.content_type ?? "TEXT",
    }));
    const plList = Array.isArray(pipelinesResp?.pipelines)
      ? pipelinesResp.pipelines
      : Array.isArray(pipelinesResp)
        ? pipelinesResp
        : [];
    const pipelineFields: FieldPickerField[] = plList.flatMap((p: any) => [
      { token: `{{pipeline.${p.id}.opportunity_value}}`, label: `${p.name} — ${t("automation_pickers.field_opportunity_value")}`, contentType: "NUMBER" },
      { token: `{{pipeline.${p.id}.opportunity_stage}}`, label: `${p.name} — ${t("automation_pickers.field_stage")}`, contentType: "TEXT" },
      { token: `{{pipeline.${p.id}.opportunity_probability}}`, label: `${p.name} — ${t("automation_pickers.field_probability")}`, contentType: "NUMBER" },
    ]);
    const timeFields: FieldPickerField[] = [
      { token: "{{now.iso}}", label: t("automation_pickers.field_now_iso"), contentType: "DATETIME" },
      { token: "{{now.epoch}}", label: t("automation_pickers.field_now_epoch"), contentType: "NUMBER" },
      { token: "{{now.date}}", label: t("automation_pickers.field_today_date"), contentType: "DATE" },
    ];
    const workspaceFields: FieldPickerField[] = [
      { token: "{{workspace.id}}", label: t("automation_pickers.field_workspace_id"), contentType: "NUMBER" },
      { token: "{{workspace.name}}", label: t("automation_pickers.field_workspace_name"), contentType: "TEXT" },
    ];

    const cats: FieldPickerCategory[] = [
      { key: "system", label: t("automation_pickers.category_system"), icon: <UserIcon className="h-3.5 w-3.5" />, fields: systemFields },
      { key: "custom", label: t("automation_pickers.category_custom"), icon: <Database className="h-3.5 w-3.5" />, fields: customFields },
      { key: "pipeline", label: t("automation_pickers.category_pipeline"), icon: <Hash className="h-3.5 w-3.5" />, fields: pipelineFields },
      { key: "time", label: t("automation_pickers.category_time"), icon: <Clock className="h-3.5 w-3.5" />, fields: timeFields },
      { key: "workspace", label: t("automation_pickers.category_workspace"), icon: <Hash className="h-3.5 w-3.5" />, fields: workspaceFields },
    ];

    if (hideContentTypes?.length) {
      return cats.map((c) => ({
        ...c,
        fields: c.fields.map((f) =>
          f.contentType && hideContentTypes.includes(f.contentType)
            ? { ...f, disabled: true, hint: t("automation_pickers.field_not_allowed_here", { contentType: f.contentType }) }
            : f,
        ),
      }));
    }
    return cats;
  }, [customFieldsResp, pipelinesResp, hideContentTypes]);

  const activeFields = useMemo(() => {
    const cat = categories.find((c) => c.key === activeCategory);
    const list = cat?.fields ?? [];
    if (!search) return list;
    const q = search.toLowerCase();
    return list.filter(
      (f) =>
        f.label.toLowerCase().includes(q) ||
        f.token.toLowerCase().includes(q),
    );
  }, [categories, activeCategory, search]);

  const handlePick = (f: FieldPickerField) => {
    if (f.disabled) return;
    onInsert(f.token);
    setOpen(false);
    setSearch("");
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant={buttonVariant}
          size="sm"
          className="h-7 text-xs"
        >
          {resolvedButtonLabel}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-0 w-[560px]" align="start">
        <div className="flex h-80">
          {/* Categories */}
          <div className="w-40 border-r bg-muted/30 py-2">
            {categories.map((c) => (
              <button
                key={c.key}
                type="button"
                className={`w-full flex items-center gap-2 px-3 py-2 text-xs text-left hover:bg-muted/60 ${
                  activeCategory === c.key ? "bg-muted font-medium" : ""
                }`}
                onClick={() => setActiveCategory(c.key)}
              >
                {c.icon}
                {c.label}
                <Badge variant="outline" className="ml-auto h-4 text-[9px]">
                  {c.fields.length}
                </Badge>
              </button>
            ))}
          </div>
          {/* Field list */}
          <div className="flex-1 flex flex-col">
            <div className="border-b p-2">
              <div className="relative">
                <Search className="h-3.5 w-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={t("automation_pickers.search_fields_placeholder")}
                  className="h-7 pl-7 text-xs"
                />
              </div>
            </div>
            <ScrollArea className="flex-1">
              {activeFields.length === 0 ? (
                <p className="text-xs text-muted-foreground p-4 text-center">
                  {t("automation_pickers.no_fields_match")}
                </p>
              ) : (
                activeFields.map((f) => (
                  <button
                    key={f.token}
                    type="button"
                    disabled={f.disabled}
                    title={f.disabled ? f.hint : f.token}
                    className={`w-full flex items-start gap-2 px-3 py-1.5 text-xs text-left ${
                      f.disabled
                        ? "opacity-40 cursor-not-allowed"
                        : "hover:bg-muted/50"
                    }`}
                    onClick={() => handlePick(f)}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{f.label}</p>
                      <p className="font-mono text-[10px] text-muted-foreground truncate">
                        {f.token}
                      </p>
                    </div>
                    {f.contentType && (
                      <Badge variant="outline" className="h-4 text-[9px] shrink-0">
                        {f.contentType}
                      </Badge>
                    )}
                  </button>
                ))
              )}
            </ScrollArea>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ─── WhatsApp Template Picker ──────────────────────────────────────────

export function WhatsAppTemplatePicker({
  value,
  onChange,
  waAccountId,
}: {
  value: string | null;
  onChange: (templateId: string, template: any) => void;
  waAccountId?: string;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const { data } = useQuery({
    queryKey: ["/api/whatsapp/templates", waAccountId ?? "all"],
    queryFn: async () => {
      try {
        const url = waAccountId
          ? `/api/whatsapp/templates?wa_account_id=${waAccountId}`
          : `/api/whatsapp/templates`;
        return await apiGet(url);
      } catch {
        return { templates: [] };
      }
    },
    enabled: open,
    retry: false,
  });

  const templates: any[] = useMemo(
    () => data?.templates ?? data?.data ?? [],
    [data],
  );
  const filtered = useMemo(
    () =>
      templates.filter((t: any) =>
        search
          ? (t.name ?? "").toLowerCase().includes(search.toLowerCase())
          : true,
      ),
    [templates, search],
  );

  const selected = templates.find((t: any) => String(t.id) === String(value));

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="w-full justify-between"
        onClick={() => setOpen(true)}
      >
        <span className="truncate">
          {selected
            ? `${selected.name} (${selected.language ?? "?"})`
            : t("automation_pickers.pick_a_template")}
        </span>
        <ChevronDown className="h-3.5 w-3.5 shrink-0" />
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogTitle>{t("automation_pickers.whatsapp_templates_title")}</DialogTitle>
          <DialogDescription>
            {t("automation_pickers.whatsapp_templates_desc")}
          </DialogDescription>
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("automation_pickers.search_templates_placeholder")}
          />
          <ScrollArea className="h-96">
            {filtered.length === 0 ? (
              <p className="text-sm text-muted-foreground p-6 text-center">
                {t("automation_pickers.no_templates_found")}
              </p>
            ) : (
              filtered.map((t: any) => (
                <button
                  key={t.id}
                  type="button"
                  className="w-full text-left px-3 py-2 border-b hover:bg-muted/40"
                  onClick={() => {
                    onChange(String(t.id), t);
                    setOpen(false);
                  }}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <FileText className="h-3.5 w-3.5 text-emerald-600" />
                    <span className="font-medium text-sm">{t.name}</span>
                    <Badge variant="outline" className="text-[10px]">
                      {t.language ?? "?"}
                    </Badge>
                    <Badge variant="outline" className="text-[10px]">
                      {t.category ?? "?"}
                    </Badge>
                    {t.status && (
                      <Badge
                        className={`text-[10px] ${
                          t.status === "APPROVED"
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {t.status}
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-2 whitespace-pre-wrap">
                    {extractBody(t)}
                  </p>
                </button>
              ))
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </>
  );
}

function extractBody(t: any): string {
  if (typeof t?.body === "string") return t.body;
  const components: any[] = t?.components ?? t?.structure ?? [];
  const body = components.find((c) => String(c?.type).toUpperCase() === "BODY");
  return body?.text ?? "";
}

// ─── TextActions floating bar ──────────────────────────────────────────

/**
 * Renders an inline icon row meant to live just below or above a focused
 * textarea / input. Hosts emoji + variable + character counter.
 *
 * The parent owns the focused element (so emoji/variable can be injected at
 * the caret) and passes `getCursor` / `insertAtCursor` callbacks.
 */
export function TextActions({
  show,
  value,
  maxLength,
  onInsert,
  actions = ["emoji", "keys", "counter"],
  hideContentTypes,
}: {
  show?: boolean;
  value: string;
  maxLength?: number;
  onInsert: (text: string) => void;
  actions?: string[];
  hideContentTypes?: string[];
}) {
  const length = (value ?? "").length;
  const overLimit = maxLength != null && length > maxLength;
  const rowRef = useRef<HTMLDivElement | null>(null);

  // Replyagent's TextActions.vue measures the parent input's viewport
  // position and flips its emoji/field popovers UPWARD when there's < 410px
  // below. Since our pickers are inside Radix popovers, we steer Radix by
  // attaching `data-flip="top"` which Radix's PopoverContent reads via the
  // `side="top"` prop we set on the popover wrappers below.
  const [side, setSide] = useState<"top" | "bottom">("bottom");
  useEffect(() => {
    if (!rowRef.current) return;
    const measure = () => {
      const rect = rowRef.current!.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      setSide(spaceBelow < 410 ? "top" : "bottom");
    };
    measure();
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, []);

  return (
    <div
      ref={rowRef}
      data-side={side}
      className={`mt-1 flex items-center gap-1 transition-opacity ${
        show === false ? "opacity-60" : "opacity-100"
      }`}
    >
      {actions.includes("emoji") && (
        <EmojiPicker onPick={(e) => onInsert(e)} />
      )}
      {actions.includes("keys") && (
        <FieldPicker
          onInsert={onInsert}
          hideContentTypes={hideContentTypes}
          buttonLabel="{{ var }}"
        />
      )}
      <div className="flex-1" />
      {actions.includes("counter") && maxLength != null && (
        <span
          className={`text-[10px] tabular-nums ${
            overLimit ? "text-destructive font-medium" : "text-muted-foreground"
          }`}
        >
          {length} / {maxLength}
        </span>
      )}
    </div>
  );
}

const COMMON_EMOJIS = [
  "😀", "😁", "😂", "🤣", "😊", "😍", "🥰", "😘", "🤗", "🤔",
  "😎", "🤓", "🙂", "😉", "😋", "😢", "😭", "😡", "🤯", "🥳",
  "👋", "👍", "👎", "👏", "🙏", "💪", "🤝", "❤️", "🔥", "✨",
  "🎉", "🎊", "🚀", "💯", "✅", "❌", "⚠️", "💡", "📌", "📞",
  "💬", "📧", "📅", "⏰", "📍", "🏠", "🛒", "💰", "🎁", "📦",
];

function EmojiPicker({ onPick }: { onPick: (e: string) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="ghost" size="sm" className="h-7 w-7 p-0">
          <Smile className="h-3.5 w-3.5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-2" align="start">
        <div className="grid grid-cols-10 gap-1">
          {COMMON_EMOJIS.map((e) => (
            <button
              key={e}
              type="button"
              className="text-base hover:bg-muted/50 rounded"
              onClick={() => {
                onPick(e);
                setOpen(false);
              }}
            >
              {e}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ─── Gallery Picker (re-export for unified import path) ────────────────

export { GalleryPickerDialog };

/**
 * Single-pick gallery button — opens the dialog, accepts the chosen media.
 * Used by image / audio fields in channel editors.
 */
export function GalleryPickButton({
  value,
  onChange,
  mediaType = "image",
  label,
}: {
  value: { id?: string; url?: string; object_name?: string } | null;
  onChange: (media: { id: string; url: string; object_name: string }) => void;
  mediaType?: "image" | "audio" | "video" | "document";
  label?: string;
}) {
  const { t } = useTranslation();
  const resolvedLabel = label ?? t("automation_pickers.pick_from_gallery");
  const [open, setOpen] = useState(false);

  // After selection, show the actual asset preview instead of just a
  // button — replyagent's image activity editor renders the chosen image
  // full-width with a "replace" affordance on hover, and we mirror that:
  //   - image:    inline preview, click anywhere to replace
  //   - audio:    inline <audio> player
  //   - video:    inline <video> preview
  //   - document: filename + icon (no inline preview possible)
  const hasValue = !!(value && (value.url || value.id));

  if (hasValue) {
    const url = value!.url ?? "";
    const name = value!.object_name ?? "selected";
    return (
      <>
        <div className="relative w-full rounded-md border bg-muted/30 overflow-hidden group">
          {mediaType === "image" && url ? (
            <img
              src={url}
              alt={name}
              className="w-full max-h-64 object-contain bg-white"
            />
          ) : mediaType === "audio" && url ? (
            <audio controls src={url} className="w-full" />
          ) : mediaType === "video" && url ? (
            <video
              controls
              src={url}
              className="w-full max-h-64 bg-black"
            />
          ) : (
            <div className="px-3 py-4 flex items-center gap-2 text-sm">
              <ImageIcon className="h-4 w-4 text-muted-foreground" />
              <span className="truncate">{name}</span>
            </div>
          )}

          {/* Hover actions: replace (re-open picker) + clear */}
          <div className="absolute top-1 right-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              type="button"
              title={t("automation_pickers.replace")}
              onClick={() => setOpen(true)}
              className="h-6 w-6 rounded bg-white/90 border shadow-sm flex items-center justify-center text-slate-600 hover:bg-white"
            >
              <ImageIcon className="h-3 w-3" />
            </button>
            <button
              type="button"
              title={t("automation_pickers.remove")}
              onClick={() =>
                onChange({ id: "", url: "", object_name: "" })
              }
              className="h-6 w-6 rounded bg-rose-50 border border-rose-200 shadow-sm flex items-center justify-center text-rose-600 hover:bg-rose-100"
            >
              <X className="h-3 w-3" />
            </button>
          </div>

          {name && (
            <p className="text-[10px] text-muted-foreground truncate px-2 py-1 border-t bg-white">
              {name}
            </p>
          )}
        </div>
        <GalleryPickerDialog
          open={open}
          onOpenChange={setOpen}
          mediaType={mediaType}
          onPick={(m) => {
            onChange(m);
            setOpen(false);
          }}
        />
      </>
    );
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="w-full justify-start gap-2"
        onClick={() => setOpen(true)}
      >
        <ImageIcon className="h-3.5 w-3.5" />
        <span className="truncate">{resolvedLabel}</span>
      </Button>
      <GalleryPickerDialog
        open={open}
        onOpenChange={setOpen}
        mediaType={mediaType}
        onPick={(m) => {
          onChange(m);
          setOpen(false);
        }}
      />
    </>
  );
}

// ─── Choices builder (quick replies / buttons) ─────────────────────────

export interface Choice {
  id?: string | number;
  label: string;
  value?: string;
  save_reply_as?: string;
  mark_as_skip?: boolean;
}

export function ChoicesBuilder({
  value,
  onChange,
  maxChoices = 10,
  labelMaxLength = 20,
  valueMaxLength = 200,
}: {
  value: Choice[];
  onChange: (next: Choice[]) => void;
  maxChoices?: number;
  labelMaxLength?: number;
  valueMaxLength?: number;
}) {
  const { t } = useTranslation();
  const list = value ?? [];

  // Replyagent's InputChoices.vue allows only ONE choice to be marked as
  // skip. When the user flips `mark_as_skip` ON on one row, every other row's
  // skip flag must be cleared.
  const update = (idx: number, partial: Partial<Choice>) => {
    onChange(
      list.map((c, i) => {
        if (i === idx) return { ...c, ...partial };
        if (partial.mark_as_skip === true) return { ...c, mark_as_skip: false };
        return c;
      }),
    );
  };
  const remove = (idx: number) => onChange(list.filter((_, i) => i !== idx));
  const add = () => {
    if (list.length >= maxChoices) return;
    onChange([...list, { label: "", value: "" }]);
  };

  return (
    <div className="space-y-2">
      {list.map((c, idx) => (
        <ChoiceRow
          key={idx}
          choice={c}
          labelMaxLength={labelMaxLength}
          valueMaxLength={valueMaxLength}
          onChange={(partial) => update(idx, partial)}
          onRemove={() => remove(idx)}
        />
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={list.length >= maxChoices}
        onClick={add}
      >
        {list.length >= maxChoices
          ? t("automation_pickers.add_choice_max", { maxChoices })
          : t("automation_pickers.add_choice")}
      </Button>
    </div>
  );
}

function ChoiceRow({
  choice,
  labelMaxLength,
  valueMaxLength,
  onChange,
  onRemove,
}: {
  choice: Choice;
  labelMaxLength: number;
  valueMaxLength: number;
  onChange: (partial: Partial<Choice>) => void;
  onRemove: () => void;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  return (
    <div className="border rounded p-2 space-y-1">
      <div className="flex items-center gap-2">
        <Input
          value={choice.label}
          onChange={(e) => onChange({ label: e.target.value })}
          placeholder={t("automation_pickers.choice_label_placeholder")}
          maxLength={labelMaxLength}
          className="flex-1 h-7 text-xs"
        />
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="sm" className="h-7 px-2 text-[10px]">
              {t("automation_pickers.options")}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-64 p-3 space-y-2">
            <div>
              <label className="text-[10px] text-muted-foreground">
                {t("automation_pickers.save_reply_as_label")}
              </label>
              <Input
                value={choice.save_reply_as ?? ""}
                onChange={(e) => onChange({ save_reply_as: e.target.value })}
                placeholder={t("automation_pickers.save_reply_as_placeholder")}
                className="h-7 text-xs"
              />
            </div>
            <label className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={!!choice.mark_as_skip}
                onChange={(e) => onChange({ mark_as_skip: e.target.checked })}
              />
              {t("automation_pickers.mark_as_skip")}
            </label>
            <div>
              <label className="text-[10px] text-muted-foreground">
                {t("automation_pickers.value_sent_on_click_label")}
              </label>
              <Input
                value={choice.value ?? ""}
                onChange={(e) => onChange({ value: e.target.value })}
                placeholder={t("automation_pickers.optional_value_placeholder")}
                maxLength={valueMaxLength}
                className="h-7 text-xs"
              />
            </div>
          </PopoverContent>
        </Popover>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
          onClick={onRemove}
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
      <div className="flex justify-between text-[10px] text-muted-foreground">
        <span>
          {t("automation_pickers.label_char_count", { length: choice.label.length, max: labelMaxLength })}
        </span>
        {choice.mark_as_skip && (
          <Badge variant="outline" className="text-[9px]">
            {t("automation_pickers.skip")}
          </Badge>
        )}
      </div>
    </div>
  );
}

// ─── List Sections builder (WhatsApp message_list) ─────────────────────

export interface ListSection {
  title: string;
  options: Array<{ id?: string; title: string; description?: string }>;
}

export function ListSectionsBuilder({
  value,
  onChange,
  maxSections = 10,
  maxOptions = 10,
}: {
  value: ListSection[];
  onChange: (next: ListSection[]) => void;
  maxSections?: number;
  maxOptions?: number;
}) {
  const { t } = useTranslation();
  const list = value ?? [];
  const update = (idx: number, partial: Partial<ListSection>) =>
    onChange(list.map((s, i) => (i === idx ? { ...s, ...partial } : s)));
  const remove = (idx: number) => onChange(list.filter((_, i) => i !== idx));
  const add = () => {
    if (list.length >= maxSections) return;
    onChange([...list, { title: "", options: [{ title: "" }] }]);
  };
  return (
    <div className="space-y-2">
      {list.map((s, idx) => (
        <div key={idx} className="border rounded p-2 space-y-1">
          <div className="flex items-center gap-2">
            <Input
              value={s.title}
              onChange={(e) => update(idx, { title: e.target.value })}
              placeholder={t("automation_pickers.section_title_placeholder")}
              maxLength={24}
              className="flex-1 h-7 text-xs"
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0"
              onClick={() => remove(idx)}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
          <div className="space-y-1 pl-2 border-l-2">
            {s.options.map((opt, oIdx) => (
              <div key={oIdx} className="flex items-center gap-1">
                <Input
                  value={opt.title}
                  onChange={(e) => {
                    const opts = [...s.options];
                    opts[oIdx] = { ...opts[oIdx], title: e.target.value };
                    update(idx, { options: opts });
                  }}
                  placeholder={t("automation_pickers.option_title_placeholder")}
                  maxLength={24}
                  className="h-6 text-xs"
                />
                <Input
                  value={opt.description ?? ""}
                  onChange={(e) => {
                    const opts = [...s.options];
                    opts[oIdx] = { ...opts[oIdx], description: e.target.value };
                    update(idx, { options: opts });
                  }}
                  placeholder={t("automation_pickers.option_description_placeholder")}
                  maxLength={72}
                  className="h-6 text-xs"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0"
                  onClick={() => {
                    update(idx, {
                      options: s.options.filter((_, i) => i !== oIdx),
                    });
                  }}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            ))}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-6 text-[10px]"
              disabled={s.options.length >= maxOptions}
              onClick={() =>
                update(idx, { options: [...s.options, { title: "" }] })
              }
            >
              {t("automation_pickers.add_option")}
            </Button>
          </div>
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={list.length >= maxSections}
        onClick={add}
      >
        {t("automation_pickers.add_section")}
      </Button>
    </div>
  );
}
