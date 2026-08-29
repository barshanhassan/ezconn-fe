/**
 * Custom ReactFlow node renderers — visual representation of each step
 * type on the builder canvas. Replyagent parity for the Drawflow node
 * templates.
 *
 * Each node renderer is responsible for:
 *   - its own colored header (channel-coloured for channel nodes)
 *   - icon + label
 *   - a short summary of the configured properties (e.g. WhatsApp text
 *     truncated to first 40 chars)
 *   - handles (input on top, output on bottom)
 *   - quick action buttons (delete + duplicate) on hover
 *
 * The `data` prop passed by ReactFlow is the node's `data` field from the
 * store — we read the action-slug / value / channel from there.
 */
import { memo, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { Handle, Position, type NodeProps } from "reactflow";
import { apiRequest } from "@/lib/queryClient";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CHANNEL_LABELS } from "./channel-schemas";
import { getTriggerSchema } from "./trigger-schemas";
import { ACTION_SCHEMAS } from "./action-schemas";
import { useSmartFlowMenu } from "../SmartFlowBuilderPage";
import {
  Zap,
  MessageSquare,
  Clock,
  Shuffle,
  GitBranch,
  Cog,
  Bot,
  Bell,
  MousePointerClick,
  Image as ImageIcon,
  Mic,
  FileText,
  ListChecks,
  Brain,
  HelpCircle,
  Phone,
  Globe,
  Copy,
  Trash2,
} from "lucide-react";
import {
  FaWhatsapp,
  FaInstagram,
  FaFacebookMessenger,
  FaTelegramPlane,
} from "react-icons/fa";
import { SiTwilio } from "react-icons/si";
import { BsChatDotsFill } from "react-icons/bs";

// Brand icons rendered inside the channel dropdown items, matching the
// real product logos rather than a generic message bubble.
// ─── NodeHoverActions ─────────────────────────────────────────────────
// Replyagent-parity floating Copy + Delete buttons that appear above a
// node when the user hovers. Wired through `useSmartFlowMenu` so the
// node renderer doesn't need to know about the page-level store. The
// parent node must have the Tailwind `group` class for the buttons to
// reveal on hover.
function NodeHoverActions({ nodeId }: { nodeId: string }) {
  const { t } = useTranslation();
  const { duplicateNode, removeNode } = useSmartFlowMenu();
  return (
    <div
      className="absolute -top-7 left-0 z-20 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100"
      onClick={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        title={t("automation_nodes.duplicate")}
        className="h-6 w-6 rounded border bg-white shadow-sm flex items-center justify-center text-slate-600 hover:bg-slate-100"
        onClick={(e) => {
          e.stopPropagation();
          duplicateNode(nodeId);
        }}
      >
        <Copy className="h-3 w-3" />
      </button>
      <button
        type="button"
        title={t("automation_nodes.delete")}
        className="h-6 w-6 rounded border border-rose-200 bg-rose-50 shadow-sm flex items-center justify-center text-rose-600 hover:bg-rose-100"
        onClick={(e) => {
          e.stopPropagation();
          removeNode(nodeId);
        }}
      >
        <Trash2 className="h-3 w-3" />
      </button>
    </div>
  );
}

const CHANNEL_DROPDOWN_ICONS: Record<string, React.ReactNode> = {
  whatsapp: <FaWhatsapp className="h-3.5 w-3.5 text-emerald-600" />,
  telegram: <FaTelegramPlane className="h-3.5 w-3.5 text-sky-600" />,
  messenger: <FaFacebookMessenger className="h-3.5 w-3.5 text-blue-600" />,
  instagram: <FaInstagram className="h-3.5 w-3.5 text-fuchsia-600" />,
  webchat: <BsChatDotsFill className="h-3.5 w-3.5 text-orange-500" />,
  twilio_sms: <SiTwilio className="h-3.5 w-3.5 text-rose-600" />,
  twilio_call: <Phone className="h-3.5 w-3.5 text-rose-600" />,
  zapi: <FaWhatsapp className="h-3.5 w-3.5 text-emerald-700" />,
  evolution: <FaWhatsapp className="h-3.5 w-3.5 text-emerald-500" />,
};

// ─── AddStepDropdown ───────────────────────────────────────────────────
// Reusable "click ↓ to add next step" dropdown that lives at the bottom
// of each node. Reads the connected-channel filter + the addStepBelow
// callback from `SmartFlowMenuContext` so individual nodes don't have to
// carry callbacks in their data. Channels are shown only when at least
// one account of that type is connected; features (Randomizer / Delay /
// Condition / Action / Splitter) are always available. Cancel just closes
// the menu — Radix handles outside-click close already.

interface AddStepDropdownProps {
  nodeId: string;
  /** Tailwind colour token for the dot border (e.g. "border-emerald-500"). */
  dotColor?: string;
  /** Optional ReactFlow handle id when this dropdown represents one of N
   *  branches (Randomizer / Splitter / Condition). Falls back to default
   *  Bottom handle when omitted. */
  handleId?: string;
  /**
   * Wrapper positioning. By default the dot dangles off the bottom-right
   * corner of the parent node. For multi-branch nodes the caller positions
   * the dot inline next to each branch row via inline styles.
   */
  style?: React.CSSProperties;
}

/**
 * Replyagent-parity "add next step" dropdown — a small hollow circle that
 * IS the React Flow source handle. Clicking it opens the channel/feature
 * picker; dragging from it creates an edge to another node. The Radix
 * dropdown trigger is layered above an invisible Handle so we keep
 * drag-to-connect behaviour while still capturing clicks.
 *
 * Layout: a 10px hollow circle pinned to a position the caller controls
 * via `style` (default: bottom-right corner of the parent card).
 *
 * Channels list is strictly filtered by `useConnectedAccounts` — only
 * actually connected channel types are listed. Features (Randomizer,
 * Delay, Condition, Action, Splitter) and Cancel are always shown.
 */
function AddStepDropdown({
  nodeId,
  dotColor = "border-emerald-500",
  handleId,
  style,
}: AddStepDropdownProps) {
  const { t } = useTranslation();
  const { connectedChannelTypes, addStepBelow, hasOutgoingEdge } = useSmartFlowMenu();

  // "One child per output" rule — once this (node, handle) already has an
  // outgoing edge, hide the click-to-add dot. The React Flow <Handle>
  // itself MUST stay mounted though, otherwise the persisted edge that
  // references this handle can't be rendered on reopen ("Couldn't create
  // edge for source handle id: branch-0"). Matches replyagent behaviour.
  const hasChild = hasOutgoingEdge(nodeId, handleId);

  // Channel must be onboard (connected account exists) before it can be
  // added to a flow — WhatsApp included. Prevents scaffolding a broken
  // flow that references a channel with no runtime account behind it.
  const channels: Array<{ type: string; label: string }> = [
    { type: "whatsapp", label: "WhatsApp" },
    { type: "telegram", label: "Telegram" },
    { type: "messenger", label: "Messenger" },
    { type: "instagram", label: "Instagram" },
    { type: "webchat", label: t("automation_nodes.channel_webchat") },
    { type: "twilio_sms", label: t("automation_nodes.channel_sms") },
    { type: "twilio_call", label: t("automation_nodes.channel_call") },
    { type: "zapi", label: "Z-API" },
    { type: "evolution", label: "Evolution" },
  ].filter((it) => connectedChannelTypes.has(it.type));

  const features: Array<{ type: string; label: string }> = [
    { type: "randomizer", label: t("automation_nodes.feature_randomizer") },
    { type: "delay", label: t("automation_nodes.feature_delay") },
    { type: "condition", label: t("automation_nodes.feature_condition") },
    { type: "action", label: t("automation_nodes.feature_action") },
    { type: "splitter", label: t("automation_nodes.feature_splitter") },
  ];

  const wrapperStyle: React.CSSProperties = style ?? { right: -5, bottom: -5 };

  return (
    // The 10×10 size must be pinned here, NOT left to the dot: once this
    // output has a child the dot isn't rendered, and since the <Handle> is
    // absolutely positioned the wrapper would collapse to 0×0. The handle
    // (left:5, top:5) would then sit ~10px outside the card instead of on its
    // corner, so every connected node's edge started away from it — the
    // visible gap between a node and its wire. A fixed size also gives the
    // branch handles' translateY(-50%) a real height to centre against.
    <div className="absolute z-10 h-2.5 w-2.5" style={wrapperStyle}>
      {/* Invisible React Flow source handle sits exactly where the dot is —
          edges originate from the dot's centre, matching replyagent. This
          handle stays mounted whether or not a child edge exists, so that
          persisted edges referencing `handleId` can always be re-rendered
          on reopen. */}
      <Handle
        type="source"
        position={Position.Right}
        // Only pass `id` when we actually have a handle id — passing
        // `id={undefined}` gets coerced to the string "undefined" in
        // React Flow's internal handle map, and later saves round-trip
        // that literal string back through the backend as a bogus
        // sourceHandle, breaking edge rendering on reopen.
        {...(handleId ? { id: handleId } : {})}
        style={{
          position: "absolute",
          left: 5,
          top: 5,
          width: 1,
          height: 1,
          minWidth: 0,
          minHeight: 0,
          background: "transparent",
          border: "none",
        }}
      />
      {hasChild ? null : (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className={`relative block h-2.5 w-2.5 rounded-full border-2 bg-white shadow transition-transform hover:scale-125 ${dotColor}`}
            title={t("automation_nodes.add_next_step")}
            aria-label={t("automation_nodes.add_next_step")}
            onClick={(e) => e.stopPropagation()}
          />
        </DropdownMenuTrigger>
        <DropdownMenuContent
          side="right"
          align="start"
          sideOffset={6}
          className="min-w-[180px] max-h-[60vh] overflow-auto p-0"
        >
          {channels.map((it) => (
            <DropdownMenuItem
              key={it.type}
              onClick={() => addStepBelow(nodeId, it.type, handleId)}
              className="text-xs py-1.5"
            >
              <span className="mr-2 flex-shrink-0">
                {CHANNEL_DROPDOWN_ICONS[it.type] ?? (
                  <MessageSquare className="h-3.5 w-3.5 text-emerald-600" />
                )}
              </span>
              {it.label}
            </DropdownMenuItem>
          ))}
          {channels.length > 0 && <DropdownMenuSeparator className="my-0" />}
          {features.map((it) => (
            <DropdownMenuItem
              key={it.type}
              onClick={() => addStepBelow(nodeId, it.type, handleId)}
              className="text-xs py-1.5"
            >
              <span className="text-slate-500 mr-2 text-xs">→</span>
              {it.label}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator className="my-0" />
          {/* Cancel — closes the dropdown without firing any add action.
              Radix closes the menu automatically when an item's click is
              not prevented; we just stop the synthetic event from
              bubbling up to the parent node so it doesn't also open the
              right-side trigger panel. Left-aligned with the other rows
              so the list reads as a coherent column. */}
          <DropdownMenuItem
            onClick={(e) => e.stopPropagation()}
            className="text-muted-foreground text-xs py-1.5"
          >
            <span className="text-slate-500 mr-2 text-xs">→</span>
            {t("automation_nodes.cancel")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      )}
    </div>
  );
}

const NODE_WIDTH = 200;

// ─── Trigger node ──────────────────────────────────────────────────────

/**
 * Replyagent's "Start" card is intentionally minimal — a thin white card
 * with green left accent showing only the trigger title + a tiny start
 * indicator. The detailed properties live in the right sidebar, not on
 * the canvas. Match that compactness.
 */
/**
 * Replyagent's "Start" canvas card is a thin white card with a green
 * border, the trigger title at the top, and one row per activity below
 * (so multi-trigger Start nodes render as a stacked list). Match that
 * exactly:
 *
 *   ┌────────────────────────────┐
 *   │  ◉ Start                   │
 *   ├────────────────────────────┤
 *   │  Default                   │
 *   │  Tag applied: <tag>        │
 *   │  …                         │
 *   └────────────────────────────┘
 *           Start ↓
 */
export const TriggerNode = memo(({ id, data }: NodeProps<any>) => {
  const { t } = useTranslation();
  const activities: any[] = data?.activities ?? [];
  // When the user deletes every custom trigger the canvas card falls back
  // to a synthetic Default row. Historically we read `activity_properties`
  // here, but that field persists the event of the FIRST trigger even
  // after deletion — so after removing "Tag applied" the card kept saying
  // "Tag applied: not selected". Force the fallback to a real default_url
  // regardless of stale activity_properties so deletion visibly resets to
  // "Default".
  const items = activities.length
    ? activities
    : [{ event: "default_url", label: t("automation_nodes.default") }];

  // Cached lookups so tag / custom field IDs resolve to their real names on
  // the canvas — matches replyagent showing "Tag applied: marketing" rather
  // than "Tag applied: #5". React Query dedupes: every TriggerNode shares
  // the same in-memory response.
  const tagsById = useTriggerLookup("/api/tags/list", "tags", "name");
  const fieldsById = useTriggerLookup(
    "/api/custom-fields",
    "fields",
    (f) => f.label ?? f.name,
  );

  return (
    <div
      className="relative rounded-xl bg-white shadow-md border border-slate-200"
      style={{ width: 220 }}
    >
      {/* Header — filled colour circle + title case label + close chip */}
      <div className="px-3 py-2.5 flex items-center gap-2.5 bg-white border-b border-slate-100">
        <span className="h-7 w-7 rounded-full bg-emerald-500 flex items-center justify-center shadow-sm shrink-0">
          <span className="h-2.5 w-2.5 rounded-full bg-white" />
        </span>
        <span className="text-[13px] font-semibold text-slate-800">{t("automation_nodes.start")}</span>
      </div>
      {/* Activity rows — single-line "Label: value" summary matching
          replyagent's Start card. Value resolves the picked tag/field to
          its actual name; empty payload falls back to "not selected". */}
      <div className="bg-slate-50/50">
        {items.map((it, idx) => {
          const summary = triggerRowSummary(it, { tagsById, fieldsById }, t);
          return (
            <div
              key={idx}
              className="px-3 py-2 text-[11px] text-slate-700 border-t border-slate-100 first:border-t-0 truncate"
              title={summary}
            >
              {summary}
            </div>
          );
        })}
      </div>
      {/* Bottom hint text with the dropdown dot */}
      <div className="px-3 py-1.5 flex items-center justify-end gap-1.5 text-[10px] text-slate-400 bg-white">
        <span>{t("automation_nodes.start")}</span>
      </div>
      <AddStepDropdown nodeId={id} />
    </div>
  );
});
TriggerNode.displayName = "TriggerNode";

// Shared React Query hook: fetch the remote list at `url`, extract items by
// listKey, and return a { id → name } map so `#5` renders as "marketing".
// Every TriggerNode calls this — React Query dedupes by queryKey, so all
// consumers share the same response.
function useTriggerLookup(
  url: string,
  listKey: string,
  labelKey: string | ((row: any) => string),
): Map<string, string> {
  const { data } = useQuery({
    queryKey: [url],
    queryFn: async () => {
      try {
        return await (await apiRequest("GET", url)).json();
      } catch {
        return { [listKey]: [] };
      }
    },
    retry: false,
    staleTime: 60_000,
  });
  return useMemo(() => {
    const list: any[] = Array.isArray(data)
      ? data
      : Array.isArray(data?.[listKey])
        ? data[listKey]
        : Array.isArray(data?.data)
          ? data.data
          : [];
    const m = new Map<string, string>();
    for (const row of list) {
      const label =
        typeof labelKey === "function"
          ? labelKey(row)
          : (row[labelKey] ?? row.name);
      if (row.id != null && label) m.set(String(row.id), String(label));
    }
    return m;
    // labelKey is captured on first render; it's a plain string or literal
    // function so we can safely omit it from deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);
}

// Compact single-line "Label: value" summary rendered on the Start card,
// matching replyagent's Start block exactly. The label comes from the
// schema (trailing ":" stripped so we control the separator), and the
// value is either the resolved name from the lookup map (tag / field) or
// a "…not selected" placeholder when the trigger hasn't been configured.
function triggerRowSummary(
  act: any,
  lookups: { tagsById: Map<string, string>; fieldsById: Map<string, string> },
  t: (key: string) => string,
): string {
  const schema = getTriggerSchema(act.event);
  const rawLabel = schema?.label ?? act.label ?? t("automation_nodes.default");
  const label = rawLabel.replace(/:\s*$/, "");
  // The trigger field-form (activity-editors.tsx) writes selected values to
  // `properties`, while some legacy code paths seeded `payload`. Read
  // `properties` first, fall back to `payload`, so both storage shapes
  // render the picked tag / field / keywords correctly.
  const payload = act.properties ?? act.payload ?? {};

  const tagName = (id: any) =>
    (id != null && lookups.tagsById.get(String(id))) || null;
  const fieldName = (id: any) =>
    (id != null && lookups.fieldsById.get(String(id))) || null;

  switch (act.event) {
    case "default_url":
      return t("automation_nodes.default");
    case "tag_applied":
    case "tag_removed":
      return `${label}: ${tagName(payload.tag_id) ?? t("automation_nodes.tag_not_selected")}`;
    case "custom_field_changed":
    case "date_field_changed":
      return `${label}: ${fieldName(payload.field_id) ?? t("automation_nodes.field_not_selected")}`;
    case "system_field_changed":
      return `${label}: ${payload.field ?? t("automation_nodes.field_not_selected")}`;
    case "wa_keyword":
    case "tg_keyword":
    case "ig_keyword":
    case "fb_keyword":
    case "wc_keyword":
    case "twilio_keyword":
    case "evolution_keyword":
    case "zapi_keyword": {
      const kw = (payload.keywords ?? []) as string[];
      return `${label}: ${kw.length ? kw.join(", ") : t("automation_nodes.no_keywords")}`;
    }
    default:
      return label;
  }
}

// ─── Channel node (WhatsApp/Telegram/IG/Messenger/Webchat/SMS/Call/Zapi/Evolution) ──

function makeChannelNode(channel: string) {
  const meta = CHANNEL_LABELS[channel] ?? { label: channel, icon: "fa-comment", color: "text-muted-foreground" };
  const Component = memo(({ id, data }: NodeProps<any>) => {
    const { t } = useTranslation();
    // Channel nodes carry a list of activities (Text / Image / Audio / etc.)
    // under `data.activities`. The legacy `data.value` shape is a fallback so
    // older saved flows still render. We list every activity as its own row
    // so the user can see all configured steps directly on the canvas.
    const activities: any[] = data?.activities ?? [];
    const legacyValue = data?.value ?? {};
    const legacySummary = channelSummary(channel, legacyValue, t);
    const iconBg = filledIconBgForChannel(channel);
    return (
      <div
        className="group relative rounded-xl bg-white shadow-md border border-slate-200"
        style={{ width: NODE_WIDTH }}
      >
        <NodeHoverActions nodeId={id} />
        <Handle
          type="target"
          position={Position.Left}
          style={{
            width: 10,
            height: 10,
            background: "white",
            border: "2px solid #cbd5e1",
          }}
        />
        {/* Header with filled colour circle + title-case label */}
        <div className="px-3 py-2.5 flex items-center gap-2.5 bg-white border-b border-slate-100">
          <span className={`h-7 w-7 rounded-full ${iconBg} flex items-center justify-center shadow-sm shrink-0 text-white`}>
            <ChannelIcon channel={channel} />
          </span>
          <span className="text-[13px] font-semibold text-slate-800">
            {meta.label.charAt(0).toUpperCase() + meta.label.slice(1).toLowerCase()}
          </span>
        </div>
        {activities.length > 0 ? (
          <div className="bg-slate-50/50">
            {activities.map((act, idx) => (
              <div
                key={idx}
                className="border-t border-slate-100 first:border-t-0"
              >
                {renderActivityRow(act, t)}
              </div>
            ))}
          </div>
        ) : (
          <div className="px-3 py-3 bg-slate-50/50">
            <div className="border border-dashed border-slate-300 rounded-md px-3 py-2 text-center">
              <p className="text-[11px] font-medium text-slate-400 truncate" title={legacySummary}>
                {legacySummary || data?.label || t("automation_nodes.click_to_configure")}
              </p>
            </div>
          </div>
        )}
        <StatsOverlay data={data} />
        {/* Bottom "Continue" hint next to the dropdown dot */}
        <div className="px-3 py-1.5 flex items-center justify-end gap-1.5 text-[10px] text-slate-400 bg-white">
          <span>{t("automation_nodes.continue")}</span>
        </div>
        <AddStepDropdown nodeId={id} />
      </div>
    );
  });
  Component.displayName = `${meta.label}Node`;
  return Component;
}

// Solid brand backdrop for the header icon circle — matches the channel's
// primary product colour (WhatsApp green, Telegram sky, etc.) so the card
// reads at a glance from across the canvas.
function filledIconBgForChannel(channel: string): string {
  switch (channel) {
    case "whatsapp":
    case "evolution":
    case "zapi":
      return "bg-emerald-500";
    case "telegram":
      return "bg-sky-500";
    case "messenger":
      return "bg-blue-500";
    case "instagram":
      return "bg-gradient-to-tr from-fuchsia-500 to-orange-400";
    case "webchat":
      return "bg-orange-500";
    case "twilio_sms":
    case "twilio_call":
      return "bg-rose-500";
    default:
      return "bg-slate-400";
  }
}

// Render a single activity row in the channel node card. Mirrors
// `activitySummary` in activity-editors.tsx so adding a text activity with
// "hello" instantly previews "hello" on the canvas instead of the empty
// dash that the value-only renderer fell back to. For image / audio /
// video activities we render the actual media inline — replyagent's
// canvas does the same and it's how the user can spot at a glance which
// asset each WhatsApp node is configured to send.
function renderActivityRow(act: any, t: (key: string) => string): React.ReactNode {
  const p = act?.properties ?? {};
  const activityType = p?.type ?? act?.type ?? "";

  // Image — inline thumbnail. Picked media is stored under
  //   properties.gallery_media_id = { id, url, object_name }
  // for the gallery flow; the custom_field flow uses properties.custom_field_id
  // (no preview possible because it resolves at runtime).
  if (activityType === "image" || activityType === "image_url") {
    const url = mediaUrlFromActivity(p);
    if (url) {
      return (
        <img
          src={url}
          alt={p.gallery_media_id?.object_name ?? "image"}
          className="w-full max-h-32 object-contain bg-white"
        />
      );
    }
    return (
      <div className="px-3 py-1.5 text-[11px] truncate">{t("automation_nodes.no_image_selected")}</div>
    );
  }

  // Video — inline player thumbnail
  if (activityType === "video") {
    const url = mediaUrlFromActivity(p);
    if (url) {
      return (
        <video
          src={url}
          className="w-full max-h-32 bg-black"
          muted
          preload="metadata"
        />
      );
    }
    return <div className="px-3 py-1.5 text-[11px] truncate">{t("automation_nodes.no_video")}</div>;
  }

  // Audio — small player
  if (activityType === "audio") {
    const url = mediaUrlFromActivity(p);
    if (url) {
      return (
        <audio src={url} controls className="w-full h-8" preload="none" />
      );
    }
    return <div className="px-3 py-1.5 text-[11px] truncate">{t("automation_nodes.no_audio")}</div>;
  }

  // Everything else is a single-line text summary
  return (
    <div
      className="px-3 py-1.5 text-[11px] truncate"
      title={activityTextSummary(act, t)}
    >
      {activityTextSummary(act, t)}
    </div>
  );
}

// Pull a previewable URL out of an activity's properties payload. Channel
// activities store picked gallery media under `gallery_media_id` (object
// with id / url / object_name); older saved flows may have a flat `url`
// or wrap it under `media`/`value`.
function mediaUrlFromActivity(p: any): string | undefined {
  return (
    p?.gallery_media_id?.url ??
    p?.url ??
    p?.image_url ??
    p?.media?.url ??
    p?.value?.url ??
    undefined
  );
}

function activityTextSummary(act: any, t: (key: string, opts?: any) => string): string {
  const p = act?.properties ?? {};
  const activityType = p?.type ?? act?.type ?? "";
  if (activityType === "text") return (p.message ?? p.text ?? "").slice(0, 60) || t("automation_nodes.empty_text");
  if (activityType === "input") return t("automation_nodes.ask_prefix", { value: (p.message ?? "").slice(0, 50) || t("automation_nodes.empty") });
  if (activityType === "button") return t("automation_nodes.buttons_count", { count: (p.choices ?? []).length });
  if (activityType === "document") return p.filename ?? t("automation_nodes.document");
  if (activityType === "delay") return t("automation_nodes.wait_duration", { amount: p.amount ?? "?", unit: p.unit ?? "min" });
  if (activityType === "message_list") return t("automation_nodes.list_prefix", { value: p.button ?? t("automation_nodes.button_placeholder") });
  if (activityType === "message_template") return p.template?.name ?? t("automation_nodes.template");
  if (activityType === "chatgpt_question") return t("automation_nodes.ai_prefix", { value: (p.question ?? "").slice(0, 40) });
  if (activityType === "dify_question") return t("automation_nodes.dify_prefix", { value: (p.question ?? "").slice(0, 40) });
  if (activityType === "cta_button") return t("automation_nodes.cta_prefix", { value: p.button_text ?? "?" });
  return activityType || t("automation_nodes.activity");
}

/**
 * Replyagent's published / preview-mode canvas overlays per-node statistics:
 * total messages sent + click-through % (uniqueClicks / totalSent). We read
 * those from `data.stats` which the hydrate path populates from
 * `automation_step_statistics`. Hidden when mode === 'draft' OR no stats.
 */
function StatsOverlay({ data }: { data: any }) {
  if (!data || data.mode === "draft") return null;
  const s = data.stats ?? data.statistics?.stats;
  if (!s) return null;
  const sent = Number(s.total_sent ?? s.totalSent ?? 0);
  const clicks = Number(s.unique_clicks ?? s.uniqueClicks ?? 0);
  const ctr = sent > 0 ? Math.round((clicks / sent) * 100) : 0;
  if (sent === 0 && clicks === 0) return null;
  return (
    <div className="px-3 py-1 text-[10px] border-t bg-muted/30 flex items-center justify-between font-mono">
      <span title="Total messages sent">📤 {sent.toLocaleString()}</span>
      <span title="Click-through rate (unique clicks / sent)">
        {ctr}% CTR
      </span>
    </div>
  );
}

function channelSummary(channel: string, value: any, t: (key: string, opts?: any) => string): string {
  const type = value?.type ?? "text";
  if (type === "text") return (value?.message ?? "").slice(0, 60);
  if (type === "input") return t("automation_nodes.ask_prefix", { value: (value?.message ?? "").slice(0, 50) });
  if (type === "button") return t("automation_nodes.buttons_count", { count: (value?.choices ?? []).length });
  if (type === "image_url") return t("automation_nodes.image");
  if (type === "audio") return t("automation_nodes.audio");
  if (type === "message_list") return t("automation_nodes.list_prefix", { value: value?.button ?? t("automation_nodes.button_placeholder") });
  if (type === "message_template") return t("automation_nodes.template_prefix", { value: value?.template_id ?? "?" });
  if (type === "chatgpt_question") return t("automation_nodes.ai_prefix", { value: (value?.question ?? "").slice(0, 40) });
  if (type === "dify_question") return t("automation_nodes.dify_prefix", { value: (value?.question ?? "").slice(0, 40) });
  if (type === "cta_button") return t("automation_nodes.cta_prefix", { value: value?.button_text ?? "?" });
  if (type === "call") return t("automation_nodes.call");
  return type;
}

function ChannelIcon({ channel }: { channel: string }) {
  // Icons render on top of a filled colour circle (see filledIconBgForChannel),
  // so glyphs are white for contrast.
  switch (channel) {
    case "whatsapp":
    case "zapi":
    case "evolution":
      return <FaWhatsapp className="h-4 w-4 text-white" />;
    case "telegram":
      return <FaTelegramPlane className="h-4 w-4 text-white" />;
    case "messenger":
      return <FaFacebookMessenger className="h-4 w-4 text-white" />;
    case "instagram":
      return <FaInstagram className="h-4 w-4 text-white" />;
    case "webchat":
      return <BsChatDotsFill className="h-4 w-4 text-white" />;
    case "twilio_sms":
      return <SiTwilio className="h-4 w-4 text-white" />;
    case "twilio_call":
      return <Phone className="h-4 w-4 text-white" />;
    default:
      return <MessageSquare className="h-4 w-4 text-white" />;
  }
}

function borderForChannel(channel: string): string {
  switch (channel) {
    case "whatsapp":
    case "evolution":
      return "rgb(167 243 208)"; // emerald-200
    case "zapi":
      return "rgb(110 231 183)"; // emerald-300
    case "telegram":
      return "rgb(186 230 253)"; // sky-200
    case "messenger":
      return "rgb(191 219 254)"; // blue-200
    case "instagram":
      return "rgb(245 208 254)"; // fuchsia-200
    case "webchat":
      return "rgb(254 215 170)"; // orange-200
    case "twilio_sms":
      return "rgb(253 230 138)"; // amber-200
    case "twilio_call":
      return "rgb(254 205 211)"; // rose-200
    default:
      return "rgb(228 228 231)";
  }
}

function bgForChannel(channel: string): string {
  switch (channel) {
    case "whatsapp":
    case "evolution":
    case "zapi":
      return "bg-emerald-50 border-emerald-200";
    case "telegram":
      return "bg-sky-50 border-sky-200";
    case "messenger":
      return "bg-blue-50 border-blue-200";
    case "instagram":
      return "bg-fuchsia-50 border-fuchsia-200";
    case "webchat":
      return "bg-orange-50 border-orange-200";
    case "twilio_sms":
      return "bg-amber-50 border-amber-200";
    case "twilio_call":
      return "bg-rose-50 border-rose-200";
    default:
      return "bg-muted/40";
  }
}

export const WhatsAppNode = makeChannelNode("whatsapp");
export const TelegramNode = makeChannelNode("telegram");
export const MessengerNode = makeChannelNode("messenger");
export const InstagramNode = makeChannelNode("instagram");
export const WebchatNode = makeChannelNode("webchat");
export const TwilioSmsNode = makeChannelNode("twilio_sms");
export const TwilioCallNode = makeChannelNode("twilio_call");
export const ZapiNode = makeChannelNode("zapi");
export const EvolutionNode = makeChannelNode("evolution");

// ─── DelayNode ────────────────────────────────────────────────────────

export const DelayNode = memo(({ id, data }: NodeProps<any>) => {
  const { t } = useTranslation();
  const v = data?.value ?? {};
  const summary =
    v.mode === "date"
      ? t("automation_nodes.until_date", { date: v.until ?? "?" })
      : `${v.amount ?? "?"} ${v.unit ?? t("automation_nodes.minutes")}`;
  return (
    <div
      className="group relative rounded-xl border border-slate-200 bg-white shadow-md"
      style={{ width: NODE_WIDTH }}
    >
      <NodeHoverActions nodeId={id} />
      <Handle
        type="target"
        position={Position.Left}
        style={{
          width: 10,
          height: 10,
          background: "white",
          border: "2px solid #cbd5e1",
        }}
      />
      <div className="px-3 py-2.5 flex items-center gap-2.5 bg-white border-b border-slate-100">
        <span className="h-7 w-7 rounded-full bg-amber-500 flex items-center justify-center shadow-sm shrink-0">
          <Clock className="h-3.5 w-3.5 text-white" />
        </span>
        <span className="text-[13px] font-semibold text-slate-800">{t("automation_nodes.delay")}</span>
      </div>
      <div className="px-3 py-2 text-[12px] text-slate-700 bg-slate-50/50">
        <p className="font-medium truncate">{summary}</p>
        {v.time_window_enabled && (
          <p className="text-[10px] text-slate-400 truncate mt-0.5">
            {v.window_from ?? "?"} – {v.window_to ?? "?"} {t("automation_nodes.on_days", { days: (v.days ?? []).join(", ") || t("automation_nodes.any_day") })}
          </p>
        )}
      </div>
      <div className="px-3 py-1.5 flex items-center justify-end gap-1.5 text-[10px] text-slate-400 bg-white">
        <span>{t("automation_nodes.continue")}</span>
      </div>
      <AddStepDropdown nodeId={id} dotColor="border-amber-500" />
    </div>
  );
});
DelayNode.displayName = "DelayNode";

// ─── RandomizerNode ───────────────────────────────────────────────────

export const RandomizerNode = memo(({ id, data }: NodeProps<any>) => {
  const { t } = useTranslation();
  const weights: number[] = data?.value?.weights ?? [50, 50];
  return (
    <div
      className="group relative rounded-xl border border-slate-200 bg-white shadow-md"
      style={{ width: NODE_WIDTH }}
    >
      <NodeHoverActions nodeId={id} />
      <Handle
        type="target"
        position={Position.Left}
        style={{
          width: 10,
          height: 10,
          background: "white",
          border: "2px solid #cbd5e1",
        }}
      />
      <div className="px-3 py-2.5 flex items-center gap-2.5 bg-white border-b border-slate-100">
        <span className="h-7 w-7 rounded-full bg-indigo-500 flex items-center justify-center shadow-sm shrink-0">
          <Shuffle className="h-3.5 w-3.5 text-white" />
        </span>
        <span className="text-[13px] font-semibold text-slate-800">{t("automation_nodes.randomizer")}</span>
      </div>
      {/* One row per branch — each row carries its own clickable dot on the
          right edge, so the edge originates from that exact branch. */}
      <div className="bg-slate-50/50">
        {weights.map((w, i) => {
          return (
            <div
              key={i}
              className="relative px-3 py-2 text-[12px] font-medium text-slate-700 border-t border-slate-100 first:border-t-0"
              style={{ minHeight: 34 }}
            >
              <span>
                {String.fromCharCode(65 + i)} {w}%
              </span>
              <AddStepDropdown
                nodeId={id}
                handleId={`branch-${i}`}
                dotColor="border-indigo-500"
                style={{ right: -5, top: "50%", transform: "translateY(-50%)" }}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
});
RandomizerNode.displayName = "RandomizerNode";

// ─── SplitterNode ─────────────────────────────────────────────────────
// Functionally identical to Randomizer (one input, N weighted outputs) —
// kept as a separate node type so we can label it correctly on canvas
// and so the dropdown picker can offer it as a distinct choice.

export const SplitterNode = memo(({ id, data }: NodeProps<any>) => {
  const { t } = useTranslation();
  const paths: any[] = data?.value?.paths ?? data?.value?.weights ?? [
    { label: t("automation_nodes.path_letter", { letter: "A" }) },
    { label: t("automation_nodes.path_letter", { letter: "B" }) },
  ];
  return (
    <div
      className="group relative rounded-xl border border-slate-200 bg-white shadow-md"
      style={{ width: NODE_WIDTH }}
    >
      <NodeHoverActions nodeId={id} />
      <Handle
        type="target"
        position={Position.Left}
        style={{
          width: 10,
          height: 10,
          background: "white",
          border: "2px solid #cbd5e1",
        }}
      />
      <div className="px-3 py-2.5 flex items-center gap-2.5 bg-white border-b border-slate-100">
        <span className="h-7 w-7 rounded-full bg-rose-500 flex items-center justify-center shadow-sm shrink-0">
          <Shuffle className="h-3.5 w-3.5 text-white" />
        </span>
        <span className="text-[13px] font-semibold text-slate-800">{t("automation_nodes.splitter")}</span>
      </div>
      <div className="bg-slate-50/50">
        {paths.map((p, i) => {
          const label =
            typeof p === "number"
              ? t("automation_nodes.path_letter", { letter: String.fromCharCode(65 + i) })
              : p?.label ?? t("automation_nodes.path_letter", { letter: String.fromCharCode(65 + i) });
          return (
            <div
              key={i}
              className="relative px-3 py-2 text-[12px] font-medium text-slate-700 border-t border-slate-100 first:border-t-0"
              style={{ minHeight: 34 }}
            >
              <span>{label}</span>
              <AddStepDropdown
                nodeId={id}
                handleId={`branch-${i}`}
                dotColor="border-rose-500"
                style={{ right: -5, top: "50%", transform: "translateY(-50%)" }}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
});
SplitterNode.displayName = "SplitterNode";

// ─── ConditionNode ────────────────────────────────────────────────────

export const ConditionNode = memo(({ id, data }: NodeProps<any>) => {
  const { t } = useTranslation();
  const conditions = data?.value?.conditions ?? [];
  const mode = data?.value?.match_mode ?? "all";
  return (
    <div
      className="group relative rounded-xl border border-slate-200 bg-white shadow-md"
      style={{ width: NODE_WIDTH }}
    >
      <NodeHoverActions nodeId={id} />
      <Handle
        type="target"
        position={Position.Left}
        style={{
          width: 10,
          height: 10,
          background: "white",
          border: "2px solid #cbd5e1",
        }}
      />
      <div className="px-3 py-2.5 flex items-center gap-2.5 bg-white border-b border-slate-100">
        <span className="h-7 w-7 rounded-full bg-teal-500 flex items-center justify-center shadow-sm shrink-0">
          <GitBranch className="h-3.5 w-3.5 text-white" />
        </span>
        <span className="text-[13px] font-semibold text-slate-800">{t("automation_nodes.condition")}</span>
      </div>
      <div className="px-3 py-2 text-[12px] text-slate-700 bg-slate-50/50">
        <p className="font-medium truncate">
          {conditions.length === 0
            ? t("automation_nodes.add_a_condition")
            : t("automation_nodes.condition_count", { count: conditions.length, mode })}
        </p>
      </div>
      <div className="px-3 py-1.5 flex items-center justify-end gap-1.5 text-[10px] text-slate-400 bg-white">
        <span>{t("automation_nodes.continue")}</span>
      </div>
      <AddStepDropdown nodeId={id} dotColor="border-teal-500" />
    </div>
  );
});
ConditionNode.displayName = "ConditionNode";

// ─── ActionNode (50+ action types) ────────────────────────────────────

export const ActionNode = memo(({ id, data }: NodeProps<any>) => {
  const { t } = useTranslation();
  const slug = data?.value?.slug ?? data?.actionSlug ?? "";
  const schema = ACTION_SCHEMAS[slug];
  return (
    <div
      className="group relative rounded-xl border border-slate-200 bg-white shadow-md"
      style={{ width: NODE_WIDTH }}
    >
      <NodeHoverActions nodeId={id} />
      <Handle
        type="target"
        position={Position.Left}
        style={{
          width: 10,
          height: 10,
          background: "white",
          border: "2px solid #cbd5e1",
        }}
      />
      <div className="px-3 py-2.5 flex items-center gap-2.5 bg-white border-b border-slate-100">
        <span className="h-7 w-7 rounded-full bg-slate-600 flex items-center justify-center shadow-sm shrink-0">
          <Cog className="h-3.5 w-3.5 text-white" />
        </span>
        <span className="text-[13px] font-semibold text-slate-800">{t("automation_nodes.action")}</span>
      </div>
      <div className="px-3 py-2 text-[12px] text-slate-700 bg-slate-50/50">
        <p className="font-medium truncate">{schema?.label ?? t("automation_nodes.pick_an_action")}</p>
        <p className="text-[10px] text-slate-400 truncate mt-0.5">
          {schema?.group ?? slug}
        </p>
      </div>
      <div className="px-3 py-1.5 flex items-center justify-end gap-1.5 text-[10px] text-slate-400 bg-white">
        <span>{t("automation_nodes.continue")}</span>
      </div>
      <AddStepDropdown nodeId={id} dotColor="border-slate-500" />
    </div>
  );
});
ActionNode.displayName = "ActionNode";

// ─── Combined node-types map (export to ReactFlow) ────────────────────

export const AUTOMATION_NODE_TYPES = {
  trigger: TriggerNode,
  whatsapp: WhatsAppNode,
  telegram: TelegramNode,
  messenger: MessengerNode,
  instagram: InstagramNode,
  webchat: WebchatNode,
  twilio_sms: TwilioSmsNode,
  twilio_call: TwilioCallNode,
  zapi: ZapiNode,
  evolution: EvolutionNode,
  delay: DelayNode,
  randomizer: RandomizerNode,
  splitter: SplitterNode,
  condition: ConditionNode,
  action: ActionNode,
} as const;
