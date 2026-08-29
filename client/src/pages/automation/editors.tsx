/**
 * Editors — schema-driven property panels rendered inside the right
 * SidebarPanel for each step type. Replyagent parity for the per-node
 * editor components under `gateway-frontend/src/components/automation/`.
 *
 * Architecture: each editor reads a schema (from trigger-schemas /
 * condition-schemas / channel-schemas) and renders the matching primitive
 * pickers in `pickers.tsx`. The save path is uniform — every editor calls
 * `onChange(partial)` which merges into the selected node's `data.value`.
 *
 * Editors covered here:
 *   TriggerEditor         — 36 trigger forms (URL / keyword / lifecycle / etc.)
 *   ChannelEditor         — channel node with per-message-type sub-editor
 *   MessageTypeEditor     — fields for one message type within a channel
 *   ConditionStepEditor   — match mode + condition rows (24 types)
 *   DelayEditor           — duration vs date, time window, day-of-week
 *   RandomizerEditor      — A-F branches with sliders, total = 100
 *   InputChoicesEditor    — quick-reply list editor (max 10 choices)
 */
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
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
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Copy, Plus, Trash2, ChevronUp, ChevronDown } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
  TRIGGER_SCHEMAS,
  getTriggerSchema,
  type TriggerFieldSchema,
} from "./trigger-schemas";
import {
  CONDITION_SCHEMAS,
  getConditionSchema,
  type ConditionSchema,
  type ConditionFieldSchema,
} from "./condition-schemas";
import {
  getMessageTypes,
  getMessageType,
  CHANNEL_LABELS,
  type MessageFieldSchema,
} from "./channel-schemas";
import {
  FieldPicker,
  TextActions,
  WhatsAppTemplatePicker,
  GalleryPickButton,
  ChoicesBuilder,
  ListSectionsBuilder,
} from "./pickers";

const apiGet = async (url: string) => (await apiRequest("GET", url)).json();

// ─── Generic primitive renderer (used by all schema-driven editors) ────

interface PrimitiveProps {
  field:
    | TriggerFieldSchema
    | ConditionFieldSchema
    | MessageFieldSchema
    | { key: string; label: string; type: string; options?: any[]; channel?: string; maxLength?: number; placeholder?: string };
  value: any;
  onChange: (v: any) => void;
  // For start-url tokens, the editor knows the automation slug + channel
  // and computes the URL server-side. We pass it in via a helper context.
  contextual?: {
    automationSlug?: string;
    automationActivitySlug?: string;
    workspaceDomain?: string;
    channelAccountId?: string | number;
  };
}

export function PrimitiveField({ field, value, onChange, contextual }: PrimitiveProps) {
  const { t } = useTranslation();
  const ft = String(field.type);
  switch (ft) {
    case "text":
      return (
        <Input
          value={value ?? ""}
          maxLength={(field as any).maxLength}
          placeholder={(field as any).placeholder}
          onChange={(e) => onChange(e.target.value)}
        />
      );
    case "textarea":
      return (
        <div>
          <Textarea
            value={value ?? ""}
            maxLength={(field as any).maxLength}
            placeholder={(field as any).placeholder}
            rows={3}
            onChange={(e) => onChange(e.target.value)}
          />
          <TextActions
            value={value ?? ""}
            maxLength={(field as any).maxLength}
            onInsert={(insert) => onChange((value ?? "") + insert)}
            actions={(field as any).textActions ?? ["emoji", "keys", "counter"]}
          />
        </div>
      );
    case "number":
      return (
        <Input
          type="number"
          value={value ?? ""}
          placeholder={(field as any).placeholder}
          onChange={(e) =>
            onChange(e.target.value === "" ? null : Number(e.target.value))
          }
        />
      );
    case "checkbox":
      return (
        <div className="flex items-center gap-2">
          <Switch
            checked={!!value}
            onCheckedChange={(v) => onChange(v)}
          />
          <span className="text-xs text-muted-foreground">
            {(field as any).helpText ?? ""}
          </span>
        </div>
      );
    case "select":
    case "operator":
      return (
        <Select value={String(value ?? "")} onValueChange={(v) => onChange(v)}>
          <SelectTrigger>
            <SelectValue placeholder={(field as any).placeholder ?? t("automation_editors.common.choose")} />
          </SelectTrigger>
          <SelectContent>
            {((field as any).options ?? []).map((o: any) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    case "json":
      return (
        <Textarea
          value={
            typeof value === "string"
              ? value
              : value
                ? JSON.stringify(value, null, 2)
                : ""
          }
          placeholder={(field as any).placeholder ?? '{ "key": "value" }'}
          rows={5}
          className="font-mono text-xs"
          onChange={(e) => {
            try {
              onChange(JSON.parse(e.target.value));
            } catch {
              onChange(e.target.value);
            }
          }}
        />
      );
    case "tag":
      return <TagSelector value={value} onChange={onChange} />;
    case "custom-field":
      return <CustomFieldSelector value={value} onChange={onChange} />;
    case "system-field":
      return <SystemFieldSelector value={value} onChange={onChange} />;
    case "ai-agent":
      return (
        <RemoteSelector
          value={value}
          onChange={onChange}
          url="/api/ai/agents"
          listKey="agents"
          labelKey="name"
        />
      );
    case "ai-voice-agent":
      return (
        <RemoteSelector
          value={value}
          onChange={onChange}
          url="/api/ai/voice-agents"
          listKey="agents"
          labelKey="name"
        />
      );
    case "dify-bot":
      return (
        <RemoteSelector
          value={value}
          onChange={onChange}
          url="/api/dify/bots"
          listKey="bots"
          labelKey="name"
        />
      );
    case "user":
      return (
        <RemoteSelector
          value={value}
          onChange={onChange}
          url="/api/users"
          listKey="users"
          labelKey="full_name"
        />
      );
    case "automation":
      return (
        <RemoteSelector
          value={value}
          onChange={onChange}
          url="/api/automations"
          listKey="automations"
          labelKey="name"
        />
      );
    case "channel-account":
      return (
        <ChannelAccountSelector
          value={value}
          onChange={onChange}
          channel={(field as any).channel}
        />
      );
    case "pipeline":
      return (
        <RemoteSelector
          value={value}
          onChange={onChange}
          url="/api/pipelines"
          listKey="pipelines"
          labelKey="name"
        />
      );
    case "pipeline-stage":
      return (
        <RemoteSelector
          value={value}
          onChange={onChange}
          url="/api/pipelines/stages"
          listKey="stages"
          labelKey="name"
        />
      );
    case "list-of-keywords":
    case "keywords":
      return (
        <Textarea
          value={Array.isArray(value) ? value.join("\n") : value ?? ""}
          rows={3}
          placeholder="One keyword per line"
          onChange={(e) =>
            onChange(
              e.target.value.split("\n").map((s) => s.trim()).filter(Boolean),
            )
          }
        />
      );
    case "match-type":
      return (
        <Select value={String(value ?? "is")} onValueChange={onChange}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="is">{t("automation_editors.match_type.is_exact")}</SelectItem>
            <SelectItem value="contains">{t("automation_editors.match_type.contains")}</SelectItem>
            <SelectItem value="begins_with">{t("automation_editors.match_type.begins_with")}</SelectItem>
            <SelectItem value="ends_with">{t("automation_editors.match_type.ends_with")}</SelectItem>
            <SelectItem value="word">{t("automation_editors.match_type.exact_word")}</SelectItem>
            <SelectItem value="doesnot_contains">{t("automation_editors.match_type.does_not_contain")}</SelectItem>
          </SelectContent>
        </Select>
      );
    case "start-url":
      return <StartUrlField value={value} contextual={contextual} />;
    case "payload-toggle":
      return (
        <Switch
          checked={!!value}
          onCheckedChange={(v) => onChange(v)}
        />
      );
    case "gallery-pick":
      return (
        <GalleryPickButton
          value={value ?? null}
          onChange={(m) => onChange(m)}
          mediaType={(field as any).mediaType ?? "image"}
          label={(field as any).label ?? "Pick from gallery"}
        />
      );
    case "wa-template-pick":
      return (
        <WhatsAppTemplatePicker
          value={value}
          waAccountId={contextual?.channelAccountId as any}
          onChange={(id, template) =>
            onChange({ id, template })
          }
        />
      );
    case "choices-builder":
      return (
        <ChoicesBuilder
          value={Array.isArray(value) ? value : []}
          onChange={onChange}
        />
      );
    case "list-sections":
      return (
        <ListSectionsBuilder
          value={Array.isArray(value) ? value : []}
          onChange={onChange}
        />
      );
    default:
      return (
        <Input
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder={ft}
        />
      );
  }
}

function StartUrlField({
  value,
  contextual,
}: {
  value: string | undefined;
  contextual?: PrimitiveProps["contextual"];
}) {
  const { t } = useTranslation();
  const { toast } = useToast();
  // Synthesize a URL from the contextual slug if the backend hasn't
  // computed it yet (new flow before first save). A placeholder is shown
  // until publish.
  const computed =
    value ??
    (contextual?.automationActivitySlug
      ? `${typeof window !== "undefined" ? window.location.origin : ""}/api/trigger-automation/${contextual.automationActivitySlug}`
      : t("automation_editors.start_url.not_generated_yet"));

  return (
    <div className="flex items-stretch gap-1">
      <Input value={computed} readOnly className="font-mono text-[11px]" />
      <Button
        type="button"
        variant="outline"
        size="icon"
        title={t("automation_editors.start_url.copy_url")}
        onClick={() => {
          if (typeof navigator !== "undefined" && navigator.clipboard) {
            navigator.clipboard.writeText(computed);
            toast({ title: t("automation_editors.start_url.copied") });
          }
        }}
      >
        <Copy className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

// ─── Selectors that fetch remote lists ─────────────────────────────────

function RemoteSelector({
  value,
  onChange,
  url,
  listKey,
  labelKey,
}: {
  value: any;
  onChange: (v: any) => void;
  url: string;
  listKey: string;
  labelKey: string;
}) {
  const { t } = useTranslation();
  const { data } = useQuery({
    queryKey: [url],
    queryFn: async () => {
      try {
        return await apiGet(url);
      } catch {
        return { [listKey]: [] };
      }
    },
    retry: false,
  });
  // Endpoints vary in shape: some return `{ <listKey>: [...] }`, some
  // return a raw array, some return `{ data: [...] }`. Coerce to an array
  // defensively so `.map` never crashes the editor at runtime.
  const list: any[] = Array.isArray(data)
    ? data
    : Array.isArray(data?.[listKey])
      ? data[listKey]
      : Array.isArray(data?.data)
        ? data.data
        : [];
  return (
    <Select value={String(value ?? "")} onValueChange={onChange}>
      <SelectTrigger>
        <SelectValue placeholder={t("automation_editors.common.choose_ellipsis")} />
      </SelectTrigger>
      <SelectContent>
        {list.length === 0 && (
          <SelectItem value="__none__" disabled>
            {t("automation_editors.common.no_options")}
          </SelectItem>
        )}
        {list.map((item: any) => (
          <SelectItem key={item.id} value={String(item.id)}>
            {item[labelKey] ?? item.name ?? `#${item.id}`}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function TagSelector({
  value,
  onChange,
}: {
  value: any;
  onChange: (v: any) => void;
}) {
  return (
    <RemoteSelector
      value={value}
      onChange={onChange}
      url="/api/tags/list"
      listKey="tags"
      labelKey="name"
    />
  );
}

function CustomFieldSelector({
  value,
  onChange,
}: {
  value: any;
  onChange: (v: any) => void;
}) {
  const { t } = useTranslation();
  const { data } = useQuery({
    queryKey: ["/api/custom-fields"],
    queryFn: () => apiGet("/api/custom-fields"),
  });
  // Same defensive coercion as RemoteSelector — the endpoint may return a
  // direct array, `{ fields: [...] }`, or `{ data: [...] }`.
  const list: any[] = Array.isArray(data?.fields)
    ? data.fields
    : Array.isArray(data)
      ? data
      : Array.isArray(data?.data)
        ? data.data
        : [];
  return (
    <Select value={String(value ?? "")} onValueChange={onChange}>
      <SelectTrigger>
        <SelectValue placeholder={t("automation_editors.common.pick_a_field")} />
      </SelectTrigger>
      <SelectContent>
        {list.map((f: any) => (
          <SelectItem key={f.id} value={String(f.id)}>
            {f.label ?? f.name} ({f.content_type ?? "TEXT"})
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function SystemFieldSelector({
  value,
  onChange,
}: {
  value: any;
  onChange: (v: any) => void;
}) {
  const { t } = useTranslation();
  const opts = [
    "first_name",
    "last_name",
    "email",
    "mobile_number",
    "language",
    "locale",
    "timezone",
    "gender",
    "country_id",
    "subscribed_at",
    "source",
  ];
  return (
    <Select value={String(value ?? "")} onValueChange={onChange}>
      <SelectTrigger>
        <SelectValue placeholder={t("automation_editors.common.pick_a_system_field")} />
      </SelectTrigger>
      <SelectContent>
        {opts.map((s) => (
          <SelectItem key={s} value={s}>
            {s}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function ChannelAccountSelector({
  value,
  onChange,
  channel,
}: {
  value: any;
  onChange: (v: any) => void;
  channel?: string;
}) {
  const urlByChannel: Record<string, { url: string; listKey: string }> = {
    // listKey is `wa`, not `accounts` — /whatsapp/accounts answers with
    // `{ wa: [...] }` (replyagent's response shape). With `accounts` the coercion
    // below fell through to `[]`, so this selector was always empty.
    // `onboard_platform=all` — the endpoint defaults to Business API only
    // (replyagent parity); automation steps can target Coexistence numbers too.
    whatsapp: { url: "/api/whatsapp/accounts?onboard_platform=all", listKey: "wa" },
    telegram: { url: "/api/telegram/bots", listKey: "bots" },
    messenger: { url: "/api/messenger/pages", listKey: "pages" },
    instagram: { url: "/api/instagram/pages", listKey: "pages" },
    webchat: { url: "/api/webchat/instances", listKey: "instances" },
    twilio: { url: "/api/twilio/accounts", listKey: "accounts" },
    evolution: { url: "/api/evolution/instances", listKey: "instances" },
    zapi: { url: "/api/zapi/instances", listKey: "instances" },
  };
  const def = urlByChannel[channel ?? ""] ?? urlByChannel.whatsapp;
  return (
    <RemoteSelector
      value={value}
      onChange={onChange}
      url={def.url}
      listKey={def.listKey}
      labelKey="name"
    />
  );
}

// ─── Schema-driven field block (handles dependsOn) ─────────────────────

function shouldShow(field: any, all: Record<string, any>): boolean {
  if (!field.dependsOn) return true;
  const v = all[field.dependsOn.field];
  if (field.dependsOn.equals === undefined) return !!v;
  // Booleans get stringified in dependsOn metadata; coerce.
  return String(v) === String(field.dependsOn.equals);
}

function SchemaForm({
  fields,
  value,
  onChange,
  contextual,
}: {
  fields: any[];
  value: Record<string, any>;
  onChange: (next: Record<string, any>) => void;
  contextual?: PrimitiveProps["contextual"];
}) {
  return (
    <div className="space-y-3">
      {fields.map((f) => {
        if (!shouldShow(f, value)) return null;
        const v = getPath(value, f.key);
        const set = (next: any) => onChange(setPath(value, f.key, next));
        return (
          <div key={f.key}>
            <Label className="text-xs">
              {f.label}
              {f.required && <span className="text-destructive ml-1">*</span>}
            </Label>
            <PrimitiveField field={f} value={v} onChange={set} contextual={contextual} />
            {f.helpText && (
              <p className="text-[10px] text-muted-foreground mt-1">
                {f.helpText}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}

function getPath(obj: Record<string, any>, path: string): any {
  return path.split(".").reduce((acc: any, k) => (acc == null ? undefined : acc[k]), obj);
}
function setPath(
  obj: Record<string, any>,
  path: string,
  next: any,
): Record<string, any> {
  const keys = path.split(".");
  const out = { ...(obj ?? {}) };
  let cursor: any = out;
  for (let i = 0; i < keys.length - 1; i++) {
    cursor[keys[i]] = { ...(cursor[keys[i]] ?? {}) };
    cursor = cursor[keys[i]];
  }
  cursor[keys[keys.length - 1]] = next;
  return out;
}

// ─── TriggerEditor ─────────────────────────────────────────────────────

export function TriggerEditor({
  event,
  value,
  onChange,
  contextual,
}: {
  event: string;
  value: Record<string, any>;
  onChange: (next: Record<string, any>) => void;
  contextual?: PrimitiveProps["contextual"];
}) {
  const { t } = useTranslation();
  const schema = getTriggerSchema(event);
  if (!schema) {
    return (
      <p className="text-sm text-muted-foreground p-4">
        {t("automation_editors.trigger_editor.unknown_trigger", { event })}
      </p>
    );
  }

  const mainFields = schema.fields.filter((f) => !f.inPayloadSection);
  const payloadFields = schema.fields.filter((f) => f.inPayloadSection);
  const showPayload = !!value?.payload_enabled;

  return (
    <div className="space-y-4">
      <div>
        <h4 className="text-sm font-semibold">{schema.label}</h4>
        <p className="text-xs text-muted-foreground">{schema.category}</p>
      </div>
      <SchemaForm
        fields={mainFields}
        value={value ?? {}}
        onChange={onChange}
        contextual={contextual}
      />
      {payloadFields.length > 0 && showPayload && (
        <div className="border-t pt-3">
          <h6 className="text-xs font-semibold uppercase tracking-wider mb-2">
            {t("automation_editors.trigger_editor.payload_heading")}
          </h6>
          <SchemaForm
            fields={payloadFields}
            value={value ?? {}}
            onChange={onChange}
            contextual={contextual}
          />
        </div>
      )}
    </div>
  );
}

// ─── ChannelEditor (replyagent launcher + secondary editor pattern) ────
//
// Replyagent's channel sidebar has TWO views:
//   1. Launcher: a "Send window" dropdown at top + 3-column grid of message
//      type cards (Text / Image / Audio / Video / Document / Delay /
//      Contact response / Message List / Message templates / CTA Button /
//      AI Studio Question / ChatGPT Answer).
//   2. Editor: when the user clicks a card, the launcher slides out and
//      the type's editor takes over (with a back arrow to the launcher).
//
// `value.type` carries the chosen type. When it's empty the launcher view
// is shown; when set the editor view renders.

import {
  Type as TypeIcon,
  Image as ImageIcon,
  Mic,
  Video as VideoIcon,
  FileText as FileTextIcon,
  Clock as ClockIcon2,
  MessageSquare as MessageSquareIcon2,
  List as ListIcon,
  FileSignature,
  MousePointerClick,
  Brain as BrainIcon,
  HelpCircle as HelpCircleIcon,
  Phone as PhoneIcon,
  ArrowLeft as ArrowLeftIcon,
  Pencil as PencilIcon,
} from "lucide-react";

const TYPE_ICON_MAP: Record<string, React.ReactNode> = {
  text: <TypeIcon className="h-4 w-4" />,
  input: <MessageSquareIcon2 className="h-4 w-4" />,
  button: <MousePointerClick className="h-4 w-4" />,
  image_url: <ImageIcon className="h-4 w-4" />,
  audio: <Mic className="h-4 w-4" />,
  video: <VideoIcon className="h-4 w-4" />,
  document: <FileTextIcon className="h-4 w-4" />,
  delay: <ClockIcon2 className="h-4 w-4" />,
  message_list: <ListIcon className="h-4 w-4" />,
  message_template: <FileSignature className="h-4 w-4" />,
  chatgpt_question: <HelpCircleIcon className="h-4 w-4" />,
  dify_question: <BrainIcon className="h-4 w-4" />,
  cta_button: <MousePointerClick className="h-4 w-4" />,
  call: <PhoneIcon className="h-4 w-4" />,
};

// WhatsApp-specific "send window" options. Shown as a dropdown at the very
// top of the channel sidebar so users explicitly pick when this node should
// fire vs the contact's 24-hour window.
function useWaSendWindowOptions() {
  const { t } = useTranslation();
  return [
    { value: "in_24", label: t("automation_editors.channel_editor.send_window_in_24") },
    { value: "template_after_24", label: t("automation_editors.channel_editor.send_window_template_after_24") },
    { value: "custom_after_24", label: t("automation_editors.channel_editor.send_window_custom_after_24") },
  ];
}

export function ChannelEditor({
  channel,
  value,
  onChange,
}: {
  channel: string;
  value: Record<string, any>;
  onChange: (next: Record<string, any>) => void;
}) {
  const { t } = useTranslation();
  const waSendWindowOptions = useWaSendWindowOptions();
  const types = getMessageTypes(channel);
  const activeType: string | undefined = value?.type;
  const activeTypeSchema = activeType ? getMessageType(channel, activeType) : null;

  const isWaFamily = ["whatsapp", "zapi", "evolution"].includes(channel);
  const sendWindow: string = value?.send_window ?? "in_24";

  // ─── Editor view (a message type is selected) ──────────────────────
  if (activeTypeSchema) {
    return (
      <div className="space-y-4">
        <button
          type="button"
          className="text-emerald-700 text-sm flex items-center gap-1 hover:underline"
          onClick={() => onChange({ ...(value ?? {}), type: undefined })}
        >
          <ArrowLeftIcon className="h-3 w-3" />
          {t("automation_editors.channel_editor.back_to_message_types")}
        </button>
        <div className="flex items-center gap-2">
          {TYPE_ICON_MAP[activeTypeSchema.type]}
          <h4 className="text-sm font-semibold">{activeTypeSchema.label}</h4>
        </div>
        <SchemaForm
          fields={activeTypeSchema.fields as any[]}
          value={value ?? {}}
          onChange={onChange}
          contextual={{ channelAccountId: value?.channel_account_id }}
        />
      </div>
    );
  }

  // ─── Launcher view (pick a message type) ───────────────────────────
  return (
    <div className="space-y-4">
      {isWaFamily && (
        <Select
          value={sendWindow}
          onValueChange={(v) => onChange({ ...(value ?? {}), send_window: v })}
        >
          <SelectTrigger className="h-10 bg-white">
            <div className="flex items-center gap-2">
              <span className="h-5 w-5 rounded-full bg-emerald-500 text-white flex items-center justify-center text-[10px]">
                W
              </span>
              <SelectValue />
            </div>
          </SelectTrigger>
          <SelectContent>
            {waSendWindowOptions.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {/* 3-col grid of message-type cards */}
      <div className="grid grid-cols-2 gap-2">
        {types.map((mt) => (
          <button
            key={mt.type}
            type="button"
            className="border rounded-md p-3 hover:bg-muted/40 flex items-center gap-2 text-sm text-left"
            onClick={() => onChange({ ...(value ?? {}), type: mt.type })}
          >
            <span className="text-slate-600">{TYPE_ICON_MAP[mt.type] ?? <TypeIcon className="h-4 w-4" />}</span>
            <span>{mt.label}</span>
          </button>
        ))}
      </div>

      {/* Channel account footer (shows the connected channel name + number
          at the bottom of the sidebar) */}
      <ChannelAccountFooter
        channel={channel}
        accountId={value?.channel_account_id}
        onChange={(v) => onChange({ ...(value ?? {}), channel_account_id: v })}
      />
    </div>
  );
}

function ChannelAccountFooter({
  channel,
  accountId,
  onChange,
}: {
  channel: string;
  accountId?: string;
  onChange: (v: string) => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="border-t pt-3 mt-4">
      <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">
        {t("automation_editors.channel_editor.channel_account_label")}
      </Label>
      <ChannelAccountSelector
        value={accountId}
        onChange={onChange}
        channel={channel.startsWith("twilio") ? "twilio" : channel}
      />
    </div>
  );
}

// ─── ConditionStepEditor (24 condition types in match/all/any/none) ────

function useMatchModes() {
  const { t } = useTranslation();
  return [
    { value: "all", label: t("automation_editors.condition_editor.match_mode_all") },
    { value: "any", label: t("automation_editors.condition_editor.match_mode_any") },
    { value: "none", label: t("automation_editors.condition_editor.match_mode_none") },
  ];
}

export function ConditionStepEditor({
  value,
  onChange,
  maxConditions = 6,
}: {
  value: { match_mode?: string; conditions?: any[] };
  onChange: (next: { match_mode?: string; conditions?: any[] }) => void;
  maxConditions?: number;
}) {
  const { t } = useTranslation();
  const matchModes = useMatchModes();
  const conditions: any[] = value?.conditions ?? [];
  const matchMode = value?.match_mode ?? "all";

  const update = (idx: number, partial: any) => {
    onChange({
      ...value,
      conditions: conditions.map((c, i) => (i === idx ? { ...c, ...partial } : c)),
    });
  };
  const remove = (idx: number) =>
    onChange({ ...value, conditions: conditions.filter((_, i) => i !== idx) });
  const add = () => {
    if (conditions.length >= maxConditions) return;
    onChange({
      ...value,
      conditions: [
        ...conditions,
        { key: "text", operator: "is", payload: {} },
      ],
    });
  };

  return (
    <div className="space-y-3">
      <div>
        <Label className="text-xs">{t("automation_editors.condition_editor.match_mode_label")}</Label>
        <Select
          value={matchMode}
          onValueChange={(v) => onChange({ ...value, match_mode: v })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {matchModes.map((m) => (
              <SelectItem key={m.value} value={m.value}>
                {m.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        {conditions.map((c, idx) => (
          <ConditionRow
            key={idx}
            condition={c}
            onChange={(partial) => update(idx, partial)}
            onRemove={() => remove(idx)}
          />
        ))}
      </div>

      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={conditions.length >= maxConditions}
        onClick={add}
      >
        <Plus className="h-3.5 w-3.5 mr-1" />
        {t("automation_editors.condition_editor.add_condition")}{" "}
        {conditions.length >= maxConditions &&
          t("automation_editors.condition_editor.max_conditions", { maxConditions })}
      </Button>
    </div>
  );
}

function ConditionRow({
  condition,
  onChange,
  onRemove,
}: {
  condition: any;
  onChange: (partial: any) => void;
  onRemove: () => void;
}) {
  const schema = getConditionSchema(condition.key ?? "text");
  if (!schema) return null;
  const valueless = schema.valueless ?? [];
  const op = condition.operator ?? schema.operators[0]?.value;
  const showValue = !valueless.includes(op);

  return (
    <div className="border rounded p-2 space-y-2">
      <div className="flex items-center gap-2">
        <Select
          value={condition.key ?? "text"}
          onValueChange={(v) =>
            onChange({ key: v, operator: undefined, payload: {} })
          }
        >
          <SelectTrigger className="h-7 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.values(CONDITION_SCHEMAS).map((s) => (
              <SelectItem key={s.key} value={s.key}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={op}
          onValueChange={(v) => onChange({ operator: v })}
        >
          <SelectTrigger className="h-7 text-xs w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {schema.operators.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
          onClick={onRemove}
        >
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>

      {showValue && (
        <SchemaForm
          fields={schema.fields as any[]}
          value={condition.payload ?? {}}
          onChange={(payload) => onChange({ payload })}
        />
      )}
    </div>
  );
}

// ─── DelayEditor ───────────────────────────────────────────────────────

const DAY_KEYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;

export function DelayEditor({
  value,
  onChange,
}: {
  value: any;
  onChange: (next: any) => void;
}) {
  const { t } = useTranslation();
  const mode = value?.mode ?? "duration";
  const unit = value?.unit ?? "minutes";
  const days: string[] = value?.days ?? [];
  const timeWindowEnabled = !!value?.time_window_enabled;

  return (
    <div className="space-y-3">
      <div>
        <Label className="text-xs">{t("automation_editors.delay_editor.wait_by_label")}</Label>
        <Select value={mode} onValueChange={(v) => onChange({ ...value, mode: v })}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="duration">{t("automation_editors.delay_editor.mode_duration")}</SelectItem>
            <SelectItem value="date">{t("automation_editors.delay_editor.mode_specific_date")}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {mode === "duration" ? (
        <>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">{t("automation_editors.delay_editor.amount_label")}</Label>
              <Input
                type="number"
                min={1}
                value={value?.amount ?? ""}
                onChange={(e) =>
                  onChange({ ...value, amount: Number(e.target.value) })
                }
              />
            </div>
            <div>
              <Label className="text-xs">{t("automation_editors.delay_editor.unit_label")}</Label>
              <Select
                value={unit}
                onValueChange={(v) => onChange({ ...value, unit: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="seconds">{t("automation_editors.delay_editor.unit_seconds")}</SelectItem>
                  <SelectItem value="minutes">{t("automation_editors.delay_editor.unit_minutes")}</SelectItem>
                  <SelectItem value="hours">{t("automation_editors.delay_editor.unit_hours")}</SelectItem>
                  <SelectItem value="days">{t("automation_editors.delay_editor.unit_days")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="border-t pt-3">
            <label className="flex items-center gap-2 text-xs cursor-pointer">
              <Switch
                checked={timeWindowEnabled}
                onCheckedChange={(v) =>
                  onChange({ ...value, time_window_enabled: v })
                }
              />
              {t("automation_editors.delay_editor.time_window_toggle")}
            </label>
            {timeWindowEnabled && (
              <div className="grid grid-cols-2 gap-2 mt-2">
                <div>
                  <Label className="text-xs">{t("automation_editors.delay_editor.from_label")}</Label>
                  <Input
                    placeholder="09:00"
                    value={value?.window_from ?? ""}
                    onChange={(e) =>
                      onChange({ ...value, window_from: e.target.value })
                    }
                  />
                </div>
                <div>
                  <Label className="text-xs">{t("automation_editors.delay_editor.to_label")}</Label>
                  <Input
                    placeholder="17:00"
                    value={value?.window_to ?? ""}
                    onChange={(e) =>
                      onChange({ ...value, window_to: e.target.value })
                    }
                  />
                </div>
                <div className="col-span-2">
                  <Label className="text-xs">{t("automation_editors.delay_editor.days_label")}</Label>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {DAY_KEYS.map((d) => {
                      const on = days.includes(d);
                      return (
                        <button
                          key={d}
                          type="button"
                          className={`text-[10px] px-2 py-0.5 rounded border ${
                            on
                              ? "bg-primary text-primary-foreground border-primary"
                              : "hover:bg-muted/50"
                          }`}
                          onClick={() =>
                            onChange({
                              ...value,
                              days: on
                                ? days.filter((x) => x !== d)
                                : [...days, d],
                            })
                          }
                        >
                          {d.toUpperCase()}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
        </>
      ) : (
        <>
          <div>
            <Label className="text-xs">{t("automation_editors.delay_editor.wait_until_label")}</Label>
            <Input
              type="datetime-local"
              value={value?.until ?? ""}
              onChange={(e) =>
                onChange({ ...value, until: e.target.value })
              }
            />
          </div>
          <p className="text-[10px] text-muted-foreground">
            {t("automation_editors.delay_editor.utc_hint")}
          </p>
        </>
      )}
    </div>
  );
}

// ─── RandomizerEditor ──────────────────────────────────────────────────

const BRANCH_LABELS = ["A", "B", "C", "D", "E", "F"];

export function RandomizerEditor({
  value,
  onChange,
}: {
  value: any;
  onChange: (next: any) => void;
}) {
  const { t } = useTranslation();
  const branches: number[] = useMemo(() => {
    const list = value?.weights;
    if (Array.isArray(list) && list.length > 0) return list.map(Number);
    return [50, 50];
  }, [value]);
  const total = branches.reduce((a, b) => a + b, 0);
  const isValid = total === 100;

  const setBranch = (idx: number, n: number) => {
    const next = [...branches];
    next[idx] = Math.max(0, Math.min(100, n));
    onChange({ ...value, weights: next });
  };
  const addBranch = () => {
    if (branches.length >= 6) return;
    onChange({ ...value, weights: [...branches, 0] });
  };
  const removeBranch = (idx: number) => {
    if (branches.length <= 2) return;
    onChange({ ...value, weights: branches.filter((_, i) => i !== idx) });
  };
  const distributeEqually = () => {
    const n = branches.length;
    const per = Math.floor(100 / n);
    const remainder = 100 - per * n;
    const eq = Array.from({ length: n }, (_, i) =>
      i === 0 ? per + remainder : per,
    );
    onChange({ ...value, weights: eq });
  };

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        {t("automation_editors.randomizer_editor.description")}
      </p>
      <div className="space-y-2">
        {branches.map((w, idx) => (
          <div key={idx} className="flex items-center gap-2">
            <Badge variant="outline" className="w-8 justify-center font-mono">
              {BRANCH_LABELS[idx]}
            </Badge>
            <input
              type="range"
              min={0}
              max={100}
              step={1}
              value={w}
              onChange={(e) => setBranch(idx, Number(e.target.value))}
              className="flex-1"
            />
            <Input
              type="number"
              value={w}
              min={0}
              max={100}
              onChange={(e) => setBranch(idx, Number(e.target.value))}
              className="w-20 h-7 text-xs"
            />
            <span className="text-xs text-muted-foreground">%</span>
            {branches.length > 2 && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0"
                onClick={() => removeBranch(idx)}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            )}
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between">
        <span
          className={`text-xs ${
            isValid ? "text-emerald-600" : "text-destructive"
          }`}
        >
          {t("automation_editors.randomizer_editor.total_label", { total })}
          {!isValid && t("automation_editors.randomizer_editor.must_equal_100")}
        </span>
        <div className="flex gap-1">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={distributeEqually}
          >
            {t("automation_editors.randomizer_editor.distribute")}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={branches.length >= 6}
            onClick={addBranch}
          >
            <Plus className="h-3 w-3 mr-1" />
            {t("automation_editors.randomizer_editor.branch")}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── InputChoicesEditor (quick reply node) ─────────────────────────────

export function InputChoicesEditor({
  value,
  onChange,
}: {
  value: any;
  onChange: (next: any) => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="space-y-3">
      <div>
        <Label className="text-xs">{t("automation_editors.input_choices_editor.prompt_label")}</Label>
        <Textarea
          value={value?.prompt ?? ""}
          onChange={(e) => onChange({ ...value, prompt: e.target.value })}
          rows={3}
          placeholder={t("automation_editors.input_choices_editor.prompt_placeholder")}
        />
        <TextActions
          value={value?.prompt ?? ""}
          maxLength={1024}
          onInsert={(insert) =>
            onChange({ ...value, prompt: (value?.prompt ?? "") + insert })
          }
        />
      </div>
      <div>
        <Label className="text-xs">{t("automation_editors.input_choices_editor.choices_label")}</Label>
        <ChoicesBuilder
          value={Array.isArray(value?.choices) ? value.choices : []}
          onChange={(choices) => onChange({ ...value, choices })}
          maxChoices={10}
          labelMaxLength={20}
          valueMaxLength={200}
        />
      </div>
    </div>
  );
}

// Re-export PrimitiveField + SchemaForm for action-editor reuse.
export { SchemaForm, PrimitiveField as PrimitiveFieldRenderer };
