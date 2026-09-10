/**
 * Smart Flow Builder — replyagent-parity rewrite. Top toolbar + ReactFlow
 * canvas + right sidebar panel (with secondary-bar stack for nested
 * editors). Wired to:
 *   - automation-store (graph state + undo/redo + dirty tracking)
 *   - editors.tsx (schema-driven property editors)
 *   - nodes.tsx (custom ReactFlow node renderers)
 *   - modals.tsx (TriggersModal / SelectAutomationPopup / CommentModal /
 *     LoopRectification / QueueContacts / ConfirmDeleteStep /
 *     ConfirmFlushQueue)
 *   - pickers.tsx (FieldPicker / TemplatePicker / TextActions etc.)
 *
 * Persistence: every save calls `POST /automations/:id/sync-graph` with the
 * full {nodes, edges} payload. The backend reconciles to
 * automation_steps / automation_step_activities / automation_flow rows.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useLocation, useRoute } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  MarkerType,
  ReactFlowProvider,
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  Connection,
  Edge,
  EdgeChange,
  Node,
  NodeChange,
  useReactFlow,
} from "reactflow";
import "reactflow/dist/style.css";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft,
  Save,
  Undo2,
  Redo2,
  Play,
  Upload,
  Edit,
  Trash2,
  Plus,
  ZoomIn,
  ZoomOut,
  AlertTriangle,
  MoreHorizontal,
  MessageSquare,
  Cog,
  Clock,
  Shuffle,
  GitBranch,
  Zap,
  X,
  Loader2,
  Copy,
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import {
  AutomationStoreProvider,
  useAutomationState,
  useAutomationActions,
  useSelectedNode,
  useCanUndoRedo,
} from "./automation/automation-store";
import {
  TriggerEditor,
  ChannelEditor,
  ConditionStepEditor,
  DelayEditor,
  RandomizerEditor,
  InputChoicesEditor,
  PrimitiveFieldRenderer,
  SchemaForm,
} from "./automation/editors";
import {
  ChannelActivitiesPanel,
  TriggerActivitiesPanel,
} from "./automation/activity-editors";
import {
  TriggersModal,
  SelectAutomationPopup,
  CommentModal,
  LoopRectificationDialog,
  QueueContactsModal,
  ConfirmDeleteStep,
  ConfirmFlushQueue,
  useConnectedAccounts,
} from "./automation/modals";
import { AUTOMATION_NODE_TYPES } from "./automation/nodes";
import { ACTION_SCHEMAS } from "./automation/action-schemas";
import { CHANNEL_MESSAGE_TYPES } from "./automation/channel-schemas";
import { getTriggerSchema } from "./automation/trigger-schemas";

const apiGet = async (url: string) => (await apiRequest("GET", url)).json();
const apiPost = async (url: string, data?: any) =>
  (await apiRequest("POST", url, data)).json();
const apiPatch = async (url: string, data?: any) =>
  (await apiRequest("PATCH", url, data)).json();

// ─── Context shared with custom node renderers ────────────────────────
// Nodes themselves can't call hooks from the parent page, so we expose
// the per-flow "add a step below this node" callback and the set of
// channel types that actually have at least one connected account.

export interface SmartFlowMenuCtxValue {
  connectedChannelTypes: Set<string>;
  /**
   * Add a step descending from `sourceNodeId`. Pass `sourceHandle` for
   * multi-branch nodes (Randomizer / Splitter / Condition) so the new
   * edge originates from the specific branch handle rather than the
   * default — otherwise React Flow renders both branches as coming from
   * the same dot.
   */
  addStepBelow: (sourceNodeId: string, type: string, sourceHandle?: string) => void;
  /** Clone a node next to the original. */
  duplicateNode: (nodeId: string) => void;
  /** Remove a node (and its edges). */
  removeNode: (nodeId: string) => void;
  /**
   * Returns true if the given (nodeId, sourceHandle?) already has an
   * outgoing edge. Used by AddStepDropdown to enforce the "one child per
   * output" rule — the dot is hidden once a child exists.
   */
  hasOutgoingEdge: (sourceNodeId: string, sourceHandle?: string) => boolean;
}

export const SmartFlowMenuContext = createContext<SmartFlowMenuCtxValue>({
  connectedChannelTypes: new Set(),
  addStepBelow: () => {},
  duplicateNode: () => {},
  removeNode: () => {},
  hasOutgoingEdge: () => false,
});

export function useSmartFlowMenu() {
  return useContext(SmartFlowMenuContext);
}

// Channels we currently support in the add-step dropdown. Keep in sync
// with `useConnectedAccounts` in modals.tsx — only types listed here can
// ever appear in the dropdown, and they're filtered by what's connected.
export const SMARTFLOW_CHANNEL_TYPES: ReadonlyArray<string> = [
  "whatsapp",
  "telegram",
  "messenger",
  "instagram",
  "webchat",
  "twilio_sms",
  "twilio_call",
  "zapi",
  "evolution",
];

// ─── Page wrapper provides the store context ──────────────────────────

export default function SmartFlowBuilderPage() {
  return (
    <AutomationStoreProvider>
      <ReactFlowProvider>
        <BuilderInner />
      </ReactFlowProvider>
    </AutomationStoreProvider>
  );
}

function BuilderInner() {
  const { t } = useTranslation();
  const [, params] = useRoute("/automations/:id");
  const [, setLocation] = useLocation();
  const automationId = params?.id ?? null;
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const state = useAutomationState();
  const actions = useAutomationActions();
  const selectedNode = useSelectedNode();
  const { canUndo, canRedo } = useCanUndoRedo();

  // Modal flags
  const [triggersModalOpen, setTriggersModalOpen] = useState(false);
  const [pickAutomationOpen, setPickAutomationOpen] = useState(false);
  const [commentModalOpen, setCommentModalOpen] = useState(false);
  const [loopDialogOpen, setLoopDialogOpen] = useState(false);
  const [queueModalOpen, setQueueModalOpen] = useState(false);
  const [deleteStepOpen, setDeleteStepOpen] = useState(false);
  const [flushQueueOpen, setFlushQueueOpen] = useState(false);
  // The trigger-modal can target either the start trigger of the flow or a
  // newly-created trigger node; track which one is open.
  const [triggerTargetNodeId, setTriggerTargetNodeId] = useState<string | null>(null);
  // For SelectAutomationPopup, the action editor that opened it passes back
  // a setter so we can store the picked automation_id wherever the editor
  // wants (e.g. StartAutomation action's automation_id field).
  const [automationPickContext, setAutomationPickContext] = useState<
    | { onPick: (a: any) => void; excludeId?: string }
    | null
  >(null);

  // ─── Fetch the automation + hydrate the graph ───────────────────────
  // staleTime: 0 + refetchOnMount override the global queryClient
  // defaults (staleTime: Infinity) so every navigation back into the
  // builder pulls a fresh snapshot from the server. Without this the
  // cached response from the first open (before the user built the
  // flow) kept overwriting live edges on remount — nodes came back but
  // strings did not, because the cached body had `flows: []`.
  const { data: automation, isLoading } = useQuery({
    queryKey: ["/api/automations", automationId, "graph"],
    queryFn: () => apiGet(`/api/automations/${automationId}`),
    enabled: !!automationId,
    staleTime: 0,
    // gcTime: 0 drops the cached response the moment the component
    // unmounts. Combined with refetchOnMount: "always" this
    // guarantees a fresh fetch on every reopen — no "stale cached
    // data races the background refetch" hydrate race, ever.
    gcTime: 0,
    refetchOnMount: "always",
  });

  // Realtime refresh of integrations (channels / AI agents / custom fields
  // / WhatsApp templates) — replyagent listens to Pusher events; we poll
  // the `/automations/integrations` endpoint every 60 s while the builder
  // is mounted. That keeps the channel-account dropdowns + template picker
  // current after a user connects a new channel in another tab.
  useQuery({
    queryKey: ["/api/automations/integrations"],
    queryFn: () => apiGet(`/api/automations/integrations`),
    enabled: !!automationId,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  });

  // localStorage key namespaced per automation — used as a belt-and-
  // suspenders backup so the flow survives even when the backend save
  // errors out silently (which was the root cause of the "flow lost on
  // reopen" bug users hit before).
  const localStorageKey = automationId ? `smartflow-graph:${automationId}` : null;

  // Track whether hydrate has run at least once, and whether the user
  // has explicitly deleted edges since the last hydrate. This lets the
  // auto-save distinguish "user actually wants zero edges" from
  // "state.edges is [] because hydrate hasn't caught up / server was
  // temporarily empty". Without this guard, a stray node-drag before
  // hydrate finishes would fire an auto-save with edges: [] and wipe
  // every persisted flow row on the backend — the ultimate root cause
  // of the recurring "strings gone on reopen" report.
  const hydratedRef = useRef(false);
  const userExplicitlyClearedEdgesRef = useRef(false);

  useEffect(() => {
    if (!automation || !automationId) return;
    // Skip re-hydration only when the user is in the middle of live
    // edits — a mid-session refetch (only happens on real remounts
    // now that invalidations were removed) with dirty=false is
    // exactly when we DO want fresh server data to land. The
    // hydratedRef strategy was too aggressive: React Query serves
    // stale cached data on remount and only later updates with the
    // fresh refetch, so a "hydrate once per mount" ref pinned the
    // canvas on the stale snapshot and never applied the fresh one.
    // The queryClient.removeQueries cleanup below invalidates the
    // cache on unmount so remounts start from an empty slate — and
    // this dirty-guard keeps auto-save writes from being reversed
    // by any surprise refetch that lands after a markClean().
    if (state.dirty) return;
    let nodes = serializedNodesFromAutomation(automation);
    let edges = serializedEdgesFromAutomation(automation);
    // Three-level overlay for the localStorage safety net. Each rung
    // is more aggressive than the last, and we hit them in order —
    // whichever level applies first wins.
    //   1. Whole-graph overlay — if the local snapshot is strictly
    //      richer than the server response (e.g. backend silently
    //      dropped a full sync-graph write), take the local view.
    //   2. Edge salvage on empty server flows — server returned
    //      nodes but zero edges; layer local edges whose endpoints
    //      still exist in the server's node set on top of server
    //      nodes. This is the case that was leaving the canvas as a
    //      row of disconnected nodes on reopen.
    //   3. Edge top-up when local strictly beats server — local
    //      snapshot has more edges than the server AND every local
    //      edge references a valid server node. Use the local edge
    //      list. Handles the "server saved 1 flow, local has 3"
    //      case (partial backend writes / race with wipe-guard).
    if (localStorageKey) {
      try {
        const raw = localStorage.getItem(localStorageKey);
        if (raw) {
          const snap = JSON.parse(raw);
          const snapNodes = Array.isArray(snap?.nodes) ? snap.nodes : [];
          const snapEdges = Array.isArray(snap?.edges) ? snap.edges : [];
          const snapWeight = snapNodes.length + snapEdges.length;
          const serverWeight = nodes.length + edges.length;
          const serverNodeIds = new Set(nodes.map((n: any) => String(n.id)));
          const localEdgesForServerNodes = snapEdges.filter(
            (e: any) =>
              serverNodeIds.has(String(e.source)) &&
              serverNodeIds.has(String(e.target)),
          );
          if (snapWeight > serverWeight) {
            // eslint-disable-next-line no-console
            console.info(
              `[smartflow] localStorage overlay — snap richer than server (${snapWeight} vs ${serverWeight})`,
            );
            nodes = snapNodes;
            edges = snapEdges;
          } else if (
            edges.length === 0 &&
            localEdgesForServerNodes.length > 0
          ) {
            // eslint-disable-next-line no-console
            console.warn(
              `[smartflow] restored ${localEdgesForServerNodes.length} edge(s) from localStorage — server flows[] was empty`,
            );
            edges = localEdgesForServerNodes;
          } else if (
            localEdgesForServerNodes.length > edges.length &&
            snapNodes.length >= nodes.length
          ) {
            // eslint-disable-next-line no-console
            console.warn(
              `[smartflow] topped up edges from localStorage (${edges.length} -> ${localEdgesForServerNodes.length}) — server had a partial flows[]`,
            );
            edges = localEdgesForServerNodes;
          }
        }
      } catch {
        /* corrupted json — ignore, fall back to server */
      }
    }
    // eslint-disable-next-line no-console
    console.info("[smartflow] hydrate", {
      automationId,
      serverNodes: serializedNodesFromAutomation(automation).length,
      serverEdges: serializedEdgesFromAutomation(automation).length,
      finalNodes: nodes.length,
      finalEdges: edges.length,
    });
    actions.hydrate(nodes, edges);
    actions.setMode(
      automation?.automation?.status === "active" ? "published" : "draft",
    );
    hydratedRef.current = true;
    userExplicitlyClearedEdgesRef.current = false;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [automation, automationId]);

  // Mirror every graph change into localStorage so the flow survives an
  // unexpected close, backend outage, or auth-expired session. Also
  // mirrors after a successful save (clean state) so the local snap
  // stays the last-known-good reference — the previous guard on
  // `state.dirty` meant the localStorage effect stopped writing right
  // after a save, so the snapshot could go stale after an in-place
  // edit + save cycle. Only skip when nothing has been hydrated yet
  // (empty state, first render before the useEffect above runs).
  useEffect(() => {
    if (!localStorageKey) return;
    if (state.nodes.length === 0 && state.edges.length === 0) return;
    try {
      localStorage.setItem(
        localStorageKey,
        JSON.stringify({
          nodes: state.nodes,
          edges: state.edges,
          savedAt: Date.now(),
        }),
      );
    } catch {
      /* quota exceeded or storage disabled — best-effort */
    }
  }, [state.nodes, state.edges, localStorageKey]);

  // Evict the cached automation on unmount (Exit + navigate away).
  // React Query keeps query data in memory across mounts so the same
  // query key returns cached data instantly on the next mount and
  // then does the background refetch. That "stale first, fresh later"
  // pattern meant the canvas showed a pre-edit snapshot on reopen
  // (nodes without their newly-persisted flows) and the hydrate
  // effect either pinned it there (with the hydratedRef strategy)
  // or briefly overwrote fresh data with cache (with the plain
  // dirty guard). Removing the query on unmount forces the next
  // mount to start with `automation: undefined` and only hydrate
  // once the fresh refetch resolves — the reopen behaviour the
  // user actually expects.
  useEffect(() => {
    return () => {
      if (automationId) {
        queryClient.removeQueries({ queryKey: ["/api/automations", automationId, "graph"] });
      }
    };
  }, [automationId, queryClient]);

  // ─── Auto-save (debounced) ───────────────────────────────────────────
  // Persist changes ~1.5 s after the user's last edit so quitting the
  // tab or hitting Exit without a manual Publish still preserves the
  // flow. Hits the same sync-graph endpoint as the manual Save button
  // but skips the "Saved" toast so it doesn't spam while the user is
  // still working. Runs silently — the Save button in the toolbar
  // remains the surface for error toasts on write failures.
  useEffect(() => {
    if (!automationId || !state.dirty) return;
    if (!hydratedRef.current) return; // don't save before first hydrate
    const autoSaveTimer = setTimeout(async () => {
      try {
        actions.setSaving(true);
        // Guard against wiping backend flows: if state.edges is empty
        // but there are multiple nodes AND the user hasn't explicitly
        // deleted the last edge in this session, don't send the edges
        // array — the backend will preserve existing flows in that
        // case. This kills the recurring "reopen has nodes but no
        // strings" bug where a stale/racy state.edges=[] led the
        // auto-save to wipe persisted flow rows.
        const suspiciousEmptyEdges =
          state.edges.length === 0 &&
          state.nodes.length >= 2 &&
          !userExplicitlyClearedEdgesRef.current;
        const payload = suspiciousEmptyEdges
          ? { nodes: state.nodes, edges: [] }
          : { nodes: state.nodes, edges: state.edges };
        // eslint-disable-next-line no-console
        console.info("[smartflow] auto-save", {
          automationId,
          nodes: state.nodes.length,
          edges: state.edges.length,
          suspiciousEmptyEdges,
          userClearedEdges: userExplicitlyClearedEdgesRef.current,
        });
        const resp: any = await apiPost(
          `/api/automations/${automationId}/sync-graph`,
          payload,
        );
        if (resp?.flows_preserved) {
          // eslint-disable-next-line no-console
          console.warn(
            "[smartflow] backend preserved existing flows — payload had empty edges but backend already had flows; strings restored on next fetch",
          );
        }
        actions.markClean();
        // DELIBERATELY not invalidating the query cache here.
        // Invalidate → refetch → hydrate would race the user's live
        // edits and briefly overwrite in-progress trigger config /
        // node data / edges with the just-saved-then-refetched
        // server view — the exact bug reported as "trigger apply
        // ke baad kuch seconds mein sab disappear ho jata hai".
        // refetchOnMount: 'always' on the useQuery already forces
        // a fresh fetch on the next real remount (Exit + Reopen),
        // which is when we actually need current server state.
        //
        // Also not clearing localStorage here. If the backend
        // returns 200 but silently drops a write, the local mirror
        // + overlay-on-hydrate is our recovery path.
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error("[smartflow] auto-save failed:", err);
      } finally {
        actions.setSaving(false);
      }
    }, 1500);
    return () => clearTimeout(autoSaveTimer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.dirty, state.nodes, state.edges, automationId]);

  // ─── Warn on close / navigate away with unsaved changes ─────────────
  // Safety net for the case where the user tries to close the tab
  // before the 1.5 s debounce fires — the browser confirmation dialog
  // gives the auto-save a chance to complete, and if the user cancels
  // the close they get another shot at it.
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (state.dirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [state.dirty]);

  // ─── Save (sync-graph) ──────────────────────────────────────────────
  const saveMutation = useMutation({
    mutationFn: () =>
      apiPost(`/api/automations/${automationId}/sync-graph`, {
        nodes: state.nodes,
        edges: state.edges,
      }),
    onMutate: () => actions.setSaving(true),
    onSuccess: () => {
      actions.setSaving(false);
      actions.markClean();
      toast({ title: t("smart_flow_builder_page.toasts.saved") });
      // Do NOT invalidate — a mid-session refetch would trigger
      // hydrate (guarded to run once) OR briefly race the user's
      // continuing edits. refetchOnMount: 'always' handles the
      // Exit + Reopen freshness case.
    },
    onError: (err: any) => {
      actions.setSaving(false);
      toast({ title: t("smart_flow_builder_page.toasts.save_failed"), description: err?.message, variant: "destructive" });
    },
  });

  const renameMutation = useMutation({
    mutationFn: (name: string) =>
      apiPatch(`/api/automations/${automationId}`, { name }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/automations", automationId, "graph"] });
      // SmartFlowsPage lists flows under a different key ("/api/automations",
      // {folder_id}) — without this, the old name lingers there until a hard
      // refresh even though the builder itself shows the new one.
      queryClient.invalidateQueries({ queryKey: ["/api/automations"] });
    },
  });

  const publishMutation = useMutation({
    mutationFn: () =>
      apiPost(`/api/automations/${automationId}/publish`, {}),
    onSuccess: () => {
      toast({ title: t("smart_flow_builder_page.toasts.published") });
      actions.setMode("published");
      queryClient.invalidateQueries({ queryKey: ["/api/automations", automationId, "graph"] });
      queryClient.invalidateQueries({ queryKey: ["/api/automations"] });
    },
    onError: (err: any) => {
      // Replyagent surfaces a `loop_error` shape — open the loop dialog when
      // we detect that, otherwise toast generically.
      if (err?.body?.error_code === "loop_detected") {
        setLoopDialogOpen(true);
      } else {
        toast({ title: t("smart_flow_builder_page.toasts.publish_failed"), description: err?.message, variant: "destructive" });
      }
    },
  });

  const unpublishMutation = useMutation({
    mutationFn: () =>
      apiPost(`/api/automations/${automationId}/unpublish`, {}),
    onSuccess: () => {
      toast({ title: t("smart_flow_builder_page.toasts.unpublished") });
      actions.setMode("draft");
      queryClient.invalidateQueries({ queryKey: ["/api/automations", automationId, "graph"] });
      queryClient.invalidateQueries({ queryKey: ["/api/automations"] });
    },
  });

  const flushQueueMutation = useMutation({
    mutationFn: () =>
      apiPost(`/api/automations/${automationId}/flush-queue`, {}),
    onSuccess: () => {
      toast({ title: t("smart_flow_builder_page.toasts.queue_cleared") });
      setFlushQueueOpen(false);
      // queue_count (drives the in-flight badge) lives on this same graph
      // query — without this the badge keeps showing the pre-flush count
      // until the user leaves and re-enters the builder.
      queryClient.invalidateQueries({ queryKey: ["/api/automations", automationId, "graph"] });
    },
  });

  // ─── Add a node from the floating + button ──────────────────────────
  // `at` is the canvas-space position where the node should appear. When the
  // caller (e.g. right-click cMenu) knows where the user clicked, it passes
  // that position so the new node spawns under the cursor — otherwise we
  // scatter it in the upper-left quadrant like replyagent.
  const addNode = (
    type: string,
    options?: { extraData?: any; at?: { x: number; y: number } },
  ): string => {
    const id = `node_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const node: Node = {
      id,
      type,
      position:
        options?.at ?? {
          x: 200 + Math.random() * 400,
          y: 200 + Math.random() * 200,
        },
      data: {
        stepType: type,
        label: defaultLabelForType(type),
        value: {},
        ...(options?.extraData ?? {}),
      },
    };
    actions.addNode(node);
    actions.selectNode(id);
    return id;
  };

  // ─── "One child per output" rule ────────────────────────────────────
  // Every node may spawn only ONE outgoing edge per output handle. For
  // single-output nodes (Trigger / channels / Delay / Condition / Action)
  // that's one child total; for multi-branch nodes (Randomizer / Splitter)
  // it's one child per branch handle. Enforced by hiding the add-dot once
  // an outgoing edge exists AND by refusing manual-drag connects.
  const hasOutgoingEdge = useCallback(
    (sourceNodeId: string, sourceHandle?: string) => {
      return state.edges.some(
        (e) =>
          e.source === sourceNodeId &&
          (sourceHandle
            ? (e.sourceHandle ?? undefined) === sourceHandle
            : !e.sourceHandle),
      );
    },
    [state.edges],
  );

  // ─── Add step below a source node (used by per-node "↓" dropdown) ────
  // Positions the new node ~180px below the source and immediately wires
  // an edge from source → new so the user doesn't have to drag a handle.
  const addStepBelow = useCallback(
    (sourceNodeId: string, type: string, sourceHandle?: string) => {
      // One-child-per-output guard: the dot is normally hidden once an edge
      // exists, but this is a defensive no-op in case a stale click races
      // the re-render.
      if (hasOutgoingEdge(sourceNodeId, sourceHandle)) return;
      const src = state.nodes.find((n) => n.id === sourceNodeId);
      const at = src
        ? { x: src.position.x + 300, y: src.position.y }
        : undefined;
      const newId = addNode(type, { at });
      actions.addEdge({
        id: `edge_${sourceNodeId}_${sourceHandle ?? "out"}_${newId}`,
        source: sourceNodeId,
        target: newId,
        ...(sourceHandle ? { sourceHandle } : {}),
        // Explicit arrow head so the flow direction is unambiguous even
        // when the edge is created programmatically (defaultEdgeOptions
        // only applies to onConnect-created edges).
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: "#94a3b8",
          width: 18,
          height: 18,
        },
      } as Edge);
      // Re-select the new node after the current batch settles. Without
      // this defer, React Flow's own `onNodesChange` from the added node
      // can race the SELECT_NODE dispatched inside addNode and flip the
      // sidebar back to whatever was selected before the click. The
      // microtask ensures our selection is the last state write.
      queueMicrotask(() => actions.selectNode(newId));
    },
    [state.nodes, actions, hasOutgoingEdge], // eslint-disable-line react-hooks/exhaustive-deps
  );

  // ─── Connected channels filter (only show what's actually connected) ─
  const connectedAccounts = useConnectedAccounts(true);
  const connectedChannelTypes = useMemo(
    () => new Set(connectedAccounts.map((a) => a.channel)),
    [connectedAccounts],
  );

  // Duplicate a node — clones data + spawns it slightly offset so the new
  // copy is visible. Wired through the menu context so hover-Copy buttons
  // on individual nodes can fire it.
  const duplicateNode = useCallback(
    (nodeId: string) => {
      const src = state.nodes.find((n) => n.id === nodeId);
      if (!src) return;
      const newId = `node_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      actions.addNode({
        id: newId,
        type: src.type,
        position: { x: src.position.x + 40, y: src.position.y + 40 },
        data: JSON.parse(JSON.stringify(src.data ?? {})),
      } as Node);
      actions.selectNode(newId);
    },
    [state.nodes, actions],
  );

  // Remove a node — opens the "Are you sure?" confirmation first so the
  // user can't accidentally wipe a step. The actual `actions.removeNode`
  // call lives in the modal's onConfirm, which also clears the pending
  // target id.
  const [pendingDeleteNodeId, setPendingDeleteNodeId] = useState<string | null>(null);
  const removeNode = useCallback(
    (nodeId: string) => {
      setPendingDeleteNodeId(nodeId);
    },
    [],
  );

  const smartFlowMenuValue = useMemo<SmartFlowMenuCtxValue>(
    () => ({
      connectedChannelTypes,
      addStepBelow,
      duplicateNode,
      removeNode,
      hasOutgoingEdge,
    }),
    [connectedChannelTypes, addStepBelow, duplicateNode, removeNode, hasOutgoingEdge],
  );

  // ─── Right-click context menu (replyagent's cMenu) ───────────────────
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    flowX: number;
    flowY: number;
  } | null>(null);
  const reactFlowRef = useRef<HTMLDivElement | null>(null);

  const onPaneContextMenu = useCallback((e: any) => {
    e.preventDefault();
    const bounds = reactFlowRef.current?.getBoundingClientRect();
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      flowX: bounds ? e.clientX - bounds.left : 200,
      flowY: bounds ? e.clientY - bounds.top : 200,
    });
  }, []);

  // ─── ReactFlow change handlers ──────────────────────────────────────
  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      // For position changes ReactFlow fires many small events — applying
      // them through setNodes pushes a history entry per move, which is
      // unhelpful. We let ReactFlow apply position changes locally and
      // only push history on a "select" / "remove" boundary.
      const next = applyNodeChanges(changes, state.nodes);
      actions.setNodes(next);
    },
    [state.nodes, actions],
  );
  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      const next = applyEdgeChanges(changes, state.edges);
      // Detect a genuine user-driven "remove all edges" — this is the
      // signal the auto-save guard needs to confidently send an empty
      // edges array back to the server. Without it, empty state.edges
      // could be a stale-hydrate artifact and the guard blocks the
      // wipe.
      if (
        state.edges.length > 0 &&
        next.length === 0 &&
        changes.some((c) => c.type === "remove")
      ) {
        userExplicitlyClearedEdgesRef.current = true;
      }
      actions.setEdges(next);
    },
    [state.edges, actions],
  );
  const onConnect = useCallback(
    (conn: Connection) => {
      // One-child-per-output rule: silently drop the connect if the source
      // (nodeId + optional handle) already has an outgoing edge. Keeps
      // manual drag-to-connect in sync with the dot-dropdown guard.
      if (!conn.source) return;
      // Normalise the incoming Connection's sourceHandle before it
      // touches state — treat the literal strings "undefined"/"null"
      // as absent, same as the backend/read side. Older React Flow
      // versions coerced Handle id={undefined} to the string
      // "undefined" and the resulting edge would fail to render on
      // reopen.
      const normSource =
        !conn.sourceHandle ||
        conn.sourceHandle === "undefined" ||
        conn.sourceHandle === "null"
          ? null
          : conn.sourceHandle;
      const normConn: Connection = { ...conn, sourceHandle: normSource };
      const already = state.edges.some(
        (e) =>
          e.source === conn.source &&
          (normSource
            ? (e.sourceHandle ?? undefined) === normSource
            : !e.sourceHandle),
      );
      if (already) return;
      actions.setEdges(addEdge(normConn, state.edges));
    },
    [state.edges, actions],
  );

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* ─── Top toolbar ─── */}
      <BuilderToolbar
        automationName={automation?.automation?.name ?? t("smart_flow_builder_page.toolbar.loading_name")}
        onRename={(name) => renameMutation.mutate(name)}
        saving={state.saving || saveMutation.isPending}
        dirty={state.dirty}
        canUndo={canUndo}
        canRedo={canRedo}
        mode={state.mode}
        runs={automation?.automation?.total_runs ?? 0}
        onUndo={actions.undo}
        onRedo={actions.redo}
        onSave={() => saveMutation.mutate()}
        onPublish={() => {
          // Publishing reads `automation.queue_count` to decide which modal
          // to open (queue contacts vs direct publish vs loop rectification).
          const qc = automation?.queue_count ?? 0;
          if (qc > 0) {
            setQueueModalOpen(true);
          } else {
            publishMutation.mutate();
          }
        }}
        publishing={publishMutation.isPending}
        onUnpublish={() => unpublishMutation.mutate()}
        onTest={() => toast({ title: t("smart_flow_builder_page.toasts.test_run_started") })}
        onFlushQueue={() => setFlushQueueOpen(true)}
        onExit={async () => {
          // Flush any pending edits before leaving so the flow the user
          // just built survives — the debounced auto-save might not have
          // fired yet on rapid Exit clicks. Always writes to
          // localStorage first (near-instant) so even a slow/failing
          // POST doesn't cost the user their work.
          if (state.dirty && automationId) {
            if (localStorageKey) {
              try {
                localStorage.setItem(
                  localStorageKey,
                  JSON.stringify({
                    nodes: state.nodes,
                    edges: state.edges,
                    savedAt: Date.now(),
                  }),
                );
              } catch { /* best-effort */ }
            }
            try {
              actions.setSaving(true);
              const suspiciousEmptyEdges =
                state.edges.length === 0 &&
                state.nodes.length >= 2 &&
                !userExplicitlyClearedEdgesRef.current;
              // eslint-disable-next-line no-console
              console.info("[smartflow] exit-save", {
                automationId,
                nodes: state.nodes.length,
                edges: state.edges.length,
                suspiciousEmptyEdges,
              });
              await apiPost(`/api/automations/${automationId}/sync-graph`, {
                nodes: state.nodes,
                edges: state.edges,
              });
              actions.markClean();
              // No invalidate needed — setLocation("/automations")
              // below unmounts this component, and `refetchOnMount:
              // "always"` on the graph query fires a fresh fetch on
              // the next mount.
              // See auto-save comment — deliberately not clearing
              // localStorage on save success. The overlay logic
              // handles both branches (server did persist / didn't)
              // correctly.
            } catch (err) {
              // eslint-disable-next-line no-console
              console.error("[smartflow] exit-save failed, local snapshot preserved:", err);
            } finally {
              actions.setSaving(false);
            }
          }
          setLocation("/automations");
        }}
      />

      <SmartFlowMenuContext.Provider value={smartFlowMenuValue}>
      <div className="flex-1 flex overflow-hidden">
        {/* ─── Canvas ─── */}
        <div className="flex-1 relative">
          {isLoading ? (
            <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin mr-2" />
              {t("smart_flow_builder_page.canvas.loading_flow")}
            </div>
          ) : (
            <div ref={reactFlowRef} className="absolute inset-0">
            <ReactFlow
              nodes={state.nodes}
              edges={state.edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              onNodeClick={(_e, n) => actions.selectNode(n.id)}
              onPaneClick={() => {
                actions.selectNode(null);
                setContextMenu(null);
              }}
              onPaneContextMenu={onPaneContextMenu}
              nodeTypes={AUTOMATION_NODE_TYPES}
              // Replyagent-parity edge look — a soft slate stroke that's a
              // bit thicker than React Flow's default so the curves read
              // clearly against the white canvas without dominating the
              // node cards. A filled arrow head on the target end makes the
              // flow direction (previous → next) unambiguous.
              defaultEdgeOptions={{
                type: "smoothstep",
                style: { stroke: "#94a3b8", strokeWidth: 1.75 },
                animated: false,
                markerEnd: {
                  type: MarkerType.ArrowClosed,
                  color: "#94a3b8",
                  width: 18,
                  height: 18,
                },
              }}
              fitView
              proOptions={{ hideAttribution: true }}
            >
              {/* Replyagent uses a plain white canvas (no dot grid). Match
                  that exactly — pass color="transparent" so the white page
                  background shows through. */}
              <Background color="transparent" gap={1} />
              {/* Controls (zoom in/out, fit view / full-screen, lock) live
                  on the LEFT edge together with the top-left "+ Add"
                  button — user prefers all builder chrome on one side.
                  MiniMap moves to bottom-right so it doesn't overlap. */}
              <Controls position="bottom-left" />
              <MiniMap zoomable pannable position="bottom-right" />
            </ReactFlow>
            </div>
          )}

          {/* Replyagent's "+" is a small contextual button at the top-right
              of the canvas. Keep it compact and on the right edge instead of
              the prior big floating circle.

              Auto-wire priority:
                1. Selected node (if it can accept a child) — matches the
                   explicit "insert here" intent.
                2. Fallback: most-recently-added leaf node (no outgoing edge,
                   not multi-branch) so the flow keeps chaining forward even
                   when the user forgets to click the tail first.
                3. Nothing on canvas that can accept a child — spawn a
                   standalone node so the click never silently no-ops.

              Multi-branch parents (Randomizer / Splitter) are always
              excluded from auto-wire — the user must pick a specific
              branch via the per-node dot. */}
          <div className="absolute left-4 top-4 z-10">
            <AddNodeButton
              onPick={(type) => {
                const canAcceptChild = (n: Node | null | undefined) =>
                  !!n &&
                  n.type !== "randomizer" &&
                  n.type !== "splitter" &&
                  !hasOutgoingEdge(n.id);

                if (canAcceptChild(selectedNode)) {
                  addStepBelow(selectedNode!.id, type);
                  return;
                }
                // Scan from most recently added → oldest so a stray
                // multi-branch tail doesn't shadow older valid leaves.
                const leaf = [...state.nodes]
                  .reverse()
                  .find(canAcceptChild);
                if (leaf) {
                  addStepBelow(leaf.id, type);
                  return;
                }
                // Standalone-add path — mirror the microtask re-select from
                // addStepBelow so the sidebar always opens the newly-added
                // node's editor even when there was no parent to wire from.
                const orphanId = addNode(type);
                queueMicrotask(() => actions.selectNode(orphanId));
              }}
              connectedChannelTypes={connectedChannelTypes}
            />
          </div>

          {/* Replyagent's right-click cMenu — same step-type list as the
              floating + button, positioned at the cursor; closes on
              outside click. */}
          {contextMenu && (
            <CanvasContextMenu
              x={contextMenu.x}
              y={contextMenu.y}
              connectedChannelTypes={connectedChannelTypes}
              onPick={(type) => {
                const newId = addNode(type, {
                  at: { x: contextMenu.flowX, y: contextMenu.flowY },
                });
                setContextMenu(null);
                // Ensure the right sidebar opens on the freshly-added node —
                // see the note on addStepBelow's re-select for the race this
                // works around.
                queueMicrotask(() => actions.selectNode(newId));
              }}
              onClose={() => setContextMenu(null)}
            />
          )}
        </div>

        {/* ─── Right sidebar ─── */}
        {selectedNode && (
          <SidebarPanel
            node={selectedNode}
            onClose={() => actions.selectNode(null)}
            onDelete={() => setDeleteStepOpen(true)}
            onCommentEdit={() => setCommentModalOpen(true)}
            onChange={(partial) => actions.updateNodeData(selectedNode.id, partial)}
            onPickAutomation={(opts) => {
              setAutomationPickContext(opts);
              setPickAutomationOpen(true);
            }}
            onChangeTrigger={(nodeId) => {
              setTriggerTargetNodeId(nodeId);
              setTriggersModalOpen(true);
            }}
          />
        )}
      </div>
      </SmartFlowMenuContext.Provider>

      {/* ─── Modals ─── */}
      <TriggersModal
        open={triggersModalOpen}
        onOpenChange={setTriggersModalOpen}
        onPick={(event, schema, prefill) => {
          const targetId = triggerTargetNodeId ?? selectedNode?.id;
          if (!targetId) return;
          // Replyagent allows MULTIPLE triggers on the same Start node.
          // Append as a new activity row, and apply the prefill payload —
          // for channel-account-bound triggers the picker already supplied
          // the `channel_account_id` so the user doesn't have to repeat it.
          const target = state.nodes.find((n) => n.id === targetId);
          const existing = (target?.data?.activities as any[]) ?? [];
          // Store the field values under `properties` — this is the shape
          // the trigger field-form (activity-editors.tsx) writes to and the
          // canvas Start card reads from. Also stamp a per-activity `slug`
          // so React can key rows stably even before the first save.
          const next = [
            ...existing,
            {
              slug: `trg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
              event,
              label: schema?.label ?? event,
              properties: prefill ?? {},
            },
          ];
          actions.updateNodeData(targetId, {
            label: "Start",
            activities: next,
            activity_properties: existing.length === 0 ? { event } : target?.data?.activity_properties,
          });
        }}
      />
      <SelectAutomationPopup
        open={pickAutomationOpen}
        onOpenChange={(o) => {
          setPickAutomationOpen(o);
          if (!o) setAutomationPickContext(null);
        }}
        excludeAutomationId={automationPickContext?.excludeId ?? (automationId ?? undefined)}
        onPick={(a) => {
          automationPickContext?.onPick(a);
          setAutomationPickContext(null);
        }}
      />
      <CommentModal
        open={commentModalOpen}
        onOpenChange={setCommentModalOpen}
        initialComment={(selectedNode?.data?.comment as string) ?? ""}
        onSave={(text) => {
          if (selectedNode) actions.updateNodeData(selectedNode.id, { comment: text });
        }}
        onDelete={() => {
          if (selectedNode) actions.updateNodeData(selectedNode.id, { comment: "" });
        }}
        readOnly={state.mode === "published"}
      />
      <LoopRectificationDialog
        open={loopDialogOpen}
        onOpenChange={setLoopDialogOpen}
        loops={(publishMutation.error as any)?.body?.loops ?? []}
        loading={publishMutation.isPending}
        onConfirm={() =>
          apiPost(`/api/automations/${automationId}/publish`, { acknowledge_loops: true })
            .then(() => {
              setLoopDialogOpen(false);
              actions.setMode("published");
              toast({ title: t("smart_flow_builder_page.toasts.published") });
              queryClient.invalidateQueries({ queryKey: ["/api/automations"] });
            })
            .catch((err) => toast({ title: t("smart_flow_builder_page.toasts.publish_failed"), description: err?.message, variant: "destructive" }))
        }
      />
      <QueueContactsModal
        open={queueModalOpen}
        onOpenChange={setQueueModalOpen}
        inFlightCount={automation?.queue_count ?? 0}
        loading={publishMutation.isPending}
        onConfirm={(action, tagName) => {
          apiPost(`/api/automations/${automationId}/publish`, {
            queue_action: action,
            queue_tag_name: tagName,
          })
            .then(() => {
              setQueueModalOpen(false);
              actions.setMode("published");
              toast({ title: t("smart_flow_builder_page.toasts.published") });
              queryClient.invalidateQueries({ queryKey: ["/api/automations"] });
            })
            .catch((err) => toast({ title: t("smart_flow_builder_page.toasts.publish_failed"), description: err?.message, variant: "destructive" }));
        }}
      />
      <ConfirmDeleteStep
        open={deleteStepOpen}
        onOpenChange={setDeleteStepOpen}
        stepTitle={selectedNode?.data?.label ?? "Step"}
        onConfirm={() => {
          if (selectedNode) {
            actions.removeNode(selectedNode.id);
            setDeleteStepOpen(false);
          }
        }}
      />
      {/* Confirmation triggered by the hover Delete button on individual
          nodes — distinct from the sidebar's Delete which uses the
          `deleteStepOpen` flow above. */}
      <ConfirmDeleteStep
        open={pendingDeleteNodeId !== null}
        onOpenChange={(o) => !o && setPendingDeleteNodeId(null)}
        stepTitle={
          state.nodes.find((n) => n.id === pendingDeleteNodeId)?.data?.label ??
          "Step"
        }
        onConfirm={() => {
          if (pendingDeleteNodeId) actions.removeNode(pendingDeleteNodeId);
          setPendingDeleteNodeId(null);
        }}
      />
      <ConfirmFlushQueue
        open={flushQueueOpen}
        onOpenChange={setFlushQueueOpen}
        loading={flushQueueMutation.isPending}
        onConfirm={() => flushQueueMutation.mutate()}
      />
    </div>
  );
}

// ─── Toolbar (top) ────────────────────────────────────────────────────

function BuilderToolbar({
  automationName,
  onRename,
  saving,
  dirty,
  canUndo,
  canRedo,
  mode,
  runs,
  onUndo,
  onRedo,
  onSave,
  onPublish,
  publishing,
  onUnpublish,
  onTest,
  onFlushQueue,
  onExit,
}: {
  automationName: string;
  onRename: (name: string) => void;
  saving: boolean;
  dirty: boolean;
  canUndo: boolean;
  canRedo: boolean;
  mode: "draft" | "published";
  runs: number;
  onUndo: () => void;
  onRedo: () => void;
  onSave: () => void;
  onPublish: () => void;
  publishing: boolean;
  onUnpublish: () => void;
  onTest: () => void;
  onFlushQueue: () => void;
  onExit: () => void;
}) {
  const { t } = useTranslation();
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState(automationName);

  useEffect(() => {
    if (!editingName) setNameDraft(automationName);
  }, [automationName, editingName]);

  // Replyagent toolbar pattern: brand on the far left, title centred,
  // Undo / Redo / Publish / Exit on the right. Everything else (Test, Save,
  // runs counter, Clear queue, Edit draft) is folded into a discreet kebab
  // menu so the bar stays as clean as the original.
  return (
    <div className="h-14 border-b bg-white flex items-center px-4 gap-3 shrink-0">
      <span className="font-bold tracking-wider select-none">
        AGEN<span className="text-emerald-600">TAWK</span>
      </span>

      <div className="flex-1 flex justify-center items-center gap-2">
        {editingName ? (
          <Input
            value={nameDraft}
            onChange={(e) => setNameDraft(e.target.value)}
            onBlur={() => {
              setEditingName(false);
              if (nameDraft && nameDraft !== automationName) onRename(nameDraft);
            }}
            autoFocus
            className="max-w-sm h-8 text-center"
          />
        ) : (
          <button
            type="button"
            onClick={() => setEditingName(true)}
            className="text-sm font-medium hover:bg-muted/40 px-3 py-1 rounded"
          >
            {automationName}
          </button>
        )}
        {saving && (
          <span className="text-[10px] text-muted-foreground flex items-center gap-1">
            <Loader2 className="h-3 w-3 animate-spin" />
            {t("smart_flow_builder_page.toolbar.saving")}
          </span>
        )}
        {dirty && !saving && (
          <span className="text-[10px] text-amber-600">{t("smart_flow_builder_page.toolbar.unsaved")}</span>
        )}
      </div>

      <Button
        variant="ghost"
        size="icon"
        onClick={onUndo}
        disabled={!canUndo}
        title={t("smart_flow_builder_page.toolbar.undo")}
      >
        <Undo2 className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        onClick={onRedo}
        disabled={!canRedo}
        title={t("smart_flow_builder_page.toolbar.redo")}
      >
        <Redo2 className="h-4 w-4" />
      </Button>

      {mode === "draft" ? (
        <Button
          onClick={onPublish}
          disabled={publishing}
          variant="outline"
          className="border-emerald-500 text-emerald-700 hover:bg-emerald-50"
        >
          {publishing && <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />}
          {t("smart_flow_builder_page.toolbar.publish")}
        </Button>
      ) : (
        <>
          {/* Replyagent shows BOTH "Preview" (read-only canvas with stats)
              and "Edit draft" in published mode. The toggle drops back to
              draft for editing. */}
          <Button
            variant="ghost"
            size="sm"
            className="text-xs"
            title={t("smart_flow_builder_page.toolbar.preview_title")}
            disabled
          >
            {t("smart_flow_builder_page.toolbar.preview")}
          </Button>
          <Button
            variant="outline"
            onClick={onUnpublish}
            className="border-emerald-500 text-emerald-700"
          >
            {t("smart_flow_builder_page.toolbar.edit_draft")}
          </Button>
        </>
      )}

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" title={t("smart_flow_builder_page.toolbar.more")}>
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={onSave} disabled={saving}>
            <Save className="h-3.5 w-3.5 mr-2" />
            {t("smart_flow_builder_page.toolbar.save_now")}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onTest}>
            <Play className="h-3.5 w-3.5 mr-2" />
            {t("smart_flow_builder_page.toolbar.test_run")}
          </DropdownMenuItem>
          <DropdownMenuItem disabled>
            <span className="text-xs text-muted-foreground">
              {t("smart_flow_builder_page.toolbar.total_runs", { count: runs })}
            </span>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={onFlushQueue}>
            <Trash2 className="h-3.5 w-3.5 mr-2 text-destructive" />
            {t("smart_flow_builder_page.toolbar.clear_queue")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Button variant="outline" onClick={onExit}>
        {t("smart_flow_builder_page.toolbar.exit")}
      </Button>
    </div>
  );
}

// ─── Canvas right-click context menu (replyagent cMenu parity) ────────

function CanvasContextMenu({
  x,
  y,
  onPick,
  onClose,
  connectedChannelTypes,
}: {
  x: number;
  y: number;
  onPick: (type: string) => void;
  onClose: () => void;
  connectedChannelTypes: Set<string>;
}) {
  const { t } = useTranslation();
  // Close on outside click — capture-phase so the menu doesn't eat the click
  // that would deselect the canvas.
  useEffect(() => {
    const handler = () => onClose();
    document.addEventListener("click", handler, { capture: true, once: true });
    return () => document.removeEventListener("click", handler, { capture: true } as any);
  }, [onClose]);

  // Channel must be onboard (connected account exists) before it can be
  // added — WhatsApp included. Matches AddStepDropdown / AddNodeButton.
  const ALL_CHANNELS: Array<{ type: string; label: string; icon: React.ReactNode }> = [
    { type: "whatsapp", label: "WhatsApp", icon: <MessageSquare className="h-3.5 w-3.5 text-emerald-600" /> },
    { type: "telegram", label: "Telegram", icon: <MessageSquare className="h-3.5 w-3.5 text-sky-600" /> },
    { type: "messenger", label: "Messenger", icon: <MessageSquare className="h-3.5 w-3.5 text-blue-600" /> },
    { type: "instagram", label: "Instagram", icon: <MessageSquare className="h-3.5 w-3.5 text-fuchsia-600" /> },
    { type: "webchat", label: "Webchat", icon: <MessageSquare className="h-3.5 w-3.5 text-orange-600" /> },
    { type: "twilio_sms", label: "SMS", icon: <MessageSquare className="h-3.5 w-3.5 text-amber-600" /> },
    { type: "twilio_call", label: "Call", icon: <MessageSquare className="h-3.5 w-3.5 text-rose-600" /> },
    { type: "zapi", label: "Z-API", icon: <MessageSquare className="h-3.5 w-3.5 text-emerald-700" /> },
    { type: "evolution", label: "Evolution", icon: <MessageSquare className="h-3.5 w-3.5 text-violet-600" /> },
  ];
  const channelItems = ALL_CHANNELS.filter((it) => connectedChannelTypes.has(it.type));

  const featureItems: Array<{ type: string; label: string; icon: React.ReactNode }> = [
    { type: "randomizer", label: t("smart_flow_builder_page.canvas.feature_randomizer"), icon: <Shuffle className="h-3.5 w-3.5 text-indigo-600" /> },
    { type: "delay", label: t("smart_flow_builder_page.canvas.feature_delay"), icon: <Clock className="h-3.5 w-3.5 text-amber-600" /> },
    { type: "condition", label: t("smart_flow_builder_page.canvas.feature_condition"), icon: <GitBranch className="h-3.5 w-3.5 text-teal-600" /> },
    { type: "action", label: t("smart_flow_builder_page.canvas.feature_action"), icon: <Cog className="h-3.5 w-3.5 text-slate-600" /> },
    { type: "splitter", label: t("smart_flow_builder_page.canvas.feature_splitter"), icon: <Shuffle className="h-3.5 w-3.5 text-rose-600" /> },
  ];

  const items = [...channelItems, ...featureItems];

  return (
    <div
      className="fixed z-40 bg-white border rounded-md shadow-lg py-1 min-w-[180px] max-h-[60vh] overflow-auto"
      style={{ left: x, top: y }}
    >
      {items.map((it) => (
        <button
          key={it.type}
          type="button"
          className="w-full px-3 py-1.5 flex items-center gap-2 text-xs hover:bg-muted/50"
          onClick={(e) => {
            e.stopPropagation();
            onPick(it.type);
          }}
        >
          {it.icon}
          <span>{it.label}</span>
        </button>
      ))}
      <div className="border-t mt-1 pt-1">
        <button
          type="button"
          className="w-full px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted/50"
          onClick={onClose}
        >
          {t("smart_flow_builder_page.canvas.cancel")}
        </button>
      </div>
    </div>
  );
}

// ─── Add-node floating button ─────────────────────────────────────────

function AddNodeButton({
  onPick,
  connectedChannelTypes,
}: {
  onPick: (type: string) => void;
  connectedChannelTypes: Set<string>;
}) {
  const { t } = useTranslation();
  const ALL_CHANNELS: Array<{ type: string; label: string; icon: React.ReactNode; color: string }> = [
    { type: "whatsapp", label: "WhatsApp", icon: <MessageSquare className="h-3.5 w-3.5" />, color: "text-emerald-600" },
    { type: "telegram", label: "Telegram", icon: <MessageSquare className="h-3.5 w-3.5" />, color: "text-sky-600" },
    { type: "messenger", label: "Messenger", icon: <MessageSquare className="h-3.5 w-3.5" />, color: "text-blue-600" },
    { type: "instagram", label: "Instagram", icon: <MessageSquare className="h-3.5 w-3.5" />, color: "text-fuchsia-600" },
    { type: "webchat", label: "Webchat", icon: <MessageSquare className="h-3.5 w-3.5" />, color: "text-orange-600" },
    { type: "twilio_sms", label: "SMS", icon: <MessageSquare className="h-3.5 w-3.5" />, color: "text-amber-600" },
    { type: "twilio_call", label: "Call", icon: <MessageSquare className="h-3.5 w-3.5" />, color: "text-rose-600" },
    { type: "zapi", label: "Z-API", icon: <MessageSquare className="h-3.5 w-3.5" />, color: "text-emerald-700" },
    { type: "evolution", label: "Evolution", icon: <MessageSquare className="h-3.5 w-3.5" />, color: "text-violet-600" },
  ];
  // Only onboard (connected) channels can be added — WhatsApp included.
  const channelItems = ALL_CHANNELS.filter((it) => connectedChannelTypes.has(it.type));

  const featureItems: Array<{ type: string; label: string; icon: React.ReactNode; color: string }> = [
    { type: "randomizer", label: t("smart_flow_builder_page.canvas.feature_randomizer"), icon: <Shuffle className="h-3.5 w-3.5" />, color: "text-indigo-600" },
    { type: "delay", label: t("smart_flow_builder_page.canvas.feature_delay"), icon: <Clock className="h-3.5 w-3.5" />, color: "text-amber-600" },
    { type: "condition", label: t("smart_flow_builder_page.canvas.feature_condition"), icon: <GitBranch className="h-3.5 w-3.5" />, color: "text-teal-600" },
    { type: "action", label: t("smart_flow_builder_page.canvas.feature_action"), icon: <Cog className="h-3.5 w-3.5" />, color: "text-slate-600" },
    { type: "splitter", label: t("smart_flow_builder_page.canvas.feature_splitter"), icon: <Shuffle className="h-3.5 w-3.5" />, color: "text-rose-600" },
  ];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-8 px-2 shadow-sm bg-white border-emerald-500 text-emerald-700 hover:bg-emerald-50"
          title={t("smart_flow_builder_page.canvas.add_step")}
        >
          <Plus className="h-3.5 w-3.5 mr-1" />
          {t("smart_flow_builder_page.canvas.add")}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="max-h-[70vh] overflow-auto">
        {channelItems.map((it) => (
          <DropdownMenuItem key={it.type} onClick={() => onPick(it.type)}>
            <span className={it.color}>{it.icon}</span>
            <span className="ml-2">{it.label}</span>
          </DropdownMenuItem>
        ))}
        {channelItems.length > 0 && <DropdownMenuSeparator />}
        {featureItems.map((it) => (
          <DropdownMenuItem key={it.type} onClick={() => onPick(it.type)}>
            <span className={it.color}>{it.icon}</span>
            <span className="ml-2">{it.label}</span>
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={(e) => e.stopPropagation()}
          className="text-muted-foreground"
        >
          <span className="text-slate-500 mr-2 text-xs">→</span>
          {t("smart_flow_builder_page.canvas.cancel")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ─── Right sidebar — routes node type → editor ────────────────────────

function SidebarPanel({
  node,
  onClose,
  onDelete,
  onCommentEdit,
  onChange,
  onPickAutomation,
  onChangeTrigger,
}: {
  node: Node;
  onClose: () => void;
  onDelete: () => void;
  onCommentEdit: () => void;
  onChange: (partial: Record<string, any>) => void;
  onPickAutomation: (opts: { onPick: (a: any) => void; excludeId?: string }) => void;
  onChangeTrigger: (nodeId: string) => void;
}) {
  const { t } = useTranslation();
  const type = node.type ?? (node.data?.stepType as string);
  const value = node.data?.value ?? {};
  const setValue = (next: any) => onChange({ value: next });

  // Replyagent style: the trigger sidebar uses a coloured (green) header
  // band; other step types use a neutral header. Pick the colour pair off
  // the node type so channel nodes inherit their channel hue.
  const headerStyle = sidebarHeaderStyle(type);
  const title =
    type === "trigger"
      ? t("smart_flow_builder_page.sidebar.start")
      : (node.data?.label as string) ?? t("smart_flow_builder_page.sidebar.step");

  // Header buttons sit on a coloured band, so they're rendered as plain
  // <button> elements with transparent backgrounds + white icons to match
  // replyagent's chrome (no shadcn Button rings / borders / hover bg
  // showing through against the green header).
  const headerBtn =
    "h-8 w-8 inline-flex items-center justify-center rounded text-white hover:bg-white/15 transition";

  return (
    <div className="w-96 border-l bg-white flex flex-col">
      <div
        className={`px-4 py-3 flex items-center gap-2 shrink-0 ${headerStyle.bg}`}
      >
        {type === "trigger" ? (
          <span className={`font-semibold text-base ${headerStyle.fg}`}>
            {title}
          </span>
        ) : (
          <Input
            value={(node.data?.label as string) ?? ""}
            onChange={(e) => onChange({ label: e.target.value })}
            maxLength={50}
            className="h-7 text-sm flex-1 bg-white/90"
          />
        )}
        <div className="flex-1" />
        <button
          type="button"
          onClick={onCommentEdit}
          title={t("smart_flow_builder_page.sidebar.comment")}
          className={headerBtn}
        >
          <MessageSquare className="h-4 w-4" />
        </button>
        {type !== "trigger" && (
          <button
            type="button"
            onClick={onDelete}
            title={t("smart_flow_builder_page.sidebar.delete_step")}
            className={headerBtn}
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}
        <button
          type="button"
          onClick={onClose}
          title={t("smart_flow_builder_page.sidebar.close")}
          className={headerBtn}
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="relative flex-1 overflow-hidden">
      <ScrollArea className="absolute inset-0 p-4">
        {type === "trigger" ? (
          <TriggerActivitiesPanel
            nodeData={node.data}
            onChange={onChange}
            onOpenTriggersModal={() => onChangeTrigger(node.id)}
          />
        ) : type && (["whatsapp", "telegram", "messenger", "instagram", "webchat", "twilio_sms", "twilio_call", "zapi", "evolution"].includes(type)) ? (
          <ChannelActivitiesPanel
            channel={type}
            nodeData={node.data}
            onChange={onChange}
          />
        ) : type === "delay" ? (
          <DelayEditor value={value} onChange={setValue} />
        ) : type === "randomizer" ? (
          <RandomizerEditor value={value} onChange={setValue} />
        ) : type === "condition" ? (
          <ConditionStepEditor value={value} onChange={setValue} />
        ) : type === "action" ? (
          <ActionStepEditor
            value={value}
            onChange={setValue}
            onPickAutomation={onPickAutomation}
          />
        ) : (
          <p className="text-sm text-muted-foreground">
            {t("smart_flow_builder_page.sidebar.unknown_step_type", { type })}
          </p>
        )}
      </ScrollArea>
      </div>
    </div>
  );
}

// ─── Action step editor — pick action slug + schema-driven fields ─────

function ActionStepEditor({
  value,
  onChange,
  onPickAutomation,
}: {
  value: any;
  onChange: (next: any) => void;
  onPickAutomation: (opts: { onPick: (a: any) => void; excludeId?: string }) => void;
}) {
  const { t } = useTranslation();
  const slug = value?.slug ?? "";
  const schema = ACTION_SCHEMAS[slug];

  // Group actions for the picker by their `group` property.
  const grouped = useMemo(() => {
    const map = new Map<string, typeof ACTION_SCHEMAS[string][]>();
    for (const s of Object.values(ACTION_SCHEMAS)) {
      const arr = map.get(s.group) ?? [];
      arr.push(s);
      map.set(s.group, arr);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, []);

  if (!schema) {
    return (
      <div className="space-y-3">
        <p className="text-sm font-medium">{t("smart_flow_builder_page.action_editor.pick_action")}</p>
        <ScrollArea className="h-96">
          {grouped.map(([group, items]) => (
            <div key={group} className="mb-3">
              <h6 className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                {group}
              </h6>
              <div className="space-y-1">
                {items.map((it) => (
                  <button
                    key={it.slug}
                    type="button"
                    className="w-full text-left px-2 py-1.5 hover:bg-muted/40 text-xs rounded"
                    onClick={() => onChange({ ...value, slug: it.slug })}
                  >
                    {it.label}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </ScrollArea>
      </div>
    );
  }

  // Special-case actions that depend on the SelectAutomationPopup.
  const automationPickFields = new Set([
    "start_automation",
    "remove_from_flow",
  ]);
  const usePickAutomation = automationPickFields.has(slug);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Badge variant="outline">{schema.group}</Badge>
        <Button
          variant="link"
          size="sm"
          onClick={() => onChange({ slug: undefined })}
        >
          {t("smart_flow_builder_page.action_editor.change_action")}
        </Button>
      </div>
      <p className="text-sm font-medium">{schema.label}</p>
      <SchemaForm
        fields={schema.fields as any[]}
        value={value ?? {}}
        onChange={onChange}
      />
      {usePickAutomation && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() =>
            onPickAutomation({
              onPick: (a) => onChange({ ...value, automation_id: a.id, automation_name: a.name }),
            })
          }
        >
          {t("smart_flow_builder_page.action_editor.pick_automation")}
        </Button>
      )}
    </div>
  );
}

// ─── Sidebar header styling per step type (replyagent colour band) ────

function sidebarHeaderStyle(type: string | undefined): {
  bg: string;
  fg: string;
  btn: string;
} {
  switch (type) {
    case "trigger":
      return {
        bg: "bg-emerald-500",
        fg: "text-white",
        btn: "text-white hover:bg-emerald-600",
      };
    case "whatsapp":
    case "zapi":
    case "evolution":
      return {
        bg: "bg-emerald-600",
        fg: "text-white",
        btn: "text-white hover:bg-emerald-700",
      };
    case "telegram":
      return { bg: "bg-sky-500", fg: "text-white", btn: "text-white hover:bg-sky-600" };
    case "messenger":
      return { bg: "bg-blue-500", fg: "text-white", btn: "text-white hover:bg-blue-600" };
    case "instagram":
      return { bg: "bg-fuchsia-500", fg: "text-white", btn: "text-white hover:bg-fuchsia-600" };
    case "webchat":
      return { bg: "bg-orange-500", fg: "text-white", btn: "text-white hover:bg-orange-600" };
    case "twilio_sms":
      return { bg: "bg-amber-500", fg: "text-white", btn: "text-white hover:bg-amber-600" };
    case "twilio_call":
      return { bg: "bg-rose-500", fg: "text-white", btn: "text-white hover:bg-rose-600" };
    case "delay":
      return { bg: "bg-amber-500", fg: "text-white", btn: "text-white hover:bg-amber-600" };
    case "randomizer":
      return { bg: "bg-indigo-500", fg: "text-white", btn: "text-white hover:bg-indigo-600" };
    case "condition":
      return { bg: "bg-teal-500", fg: "text-white", btn: "text-white hover:bg-teal-600" };
    case "action":
      return { bg: "bg-slate-600", fg: "text-white", btn: "text-white hover:bg-slate-700" };
    default:
      return { bg: "bg-muted", fg: "text-foreground", btn: "" };
  }
}

// ─── Legacy inline panel (kept only to avoid breaking old refs) ───────

function __LegacyTriggerActivitiesPanel({
  value,
  activities,
  onChange,
  onPickNew,
}: {
  value: any;
  activities: any[];
  onChange: (next: any[]) => void;
  onPickNew: () => void;
}) {
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  // If activities are not yet present, synthesize one from the trigger node's
  // `activity_properties.event`. The replyagent canvas always shows at least
  // "Default" — match that.
  const list = activities.length
    ? activities
    : [{ event: value?.event ?? "default_url", label: "Default", payload: {} }];

  if (editingIndex != null && list[editingIndex]) {
    const act = list[editingIndex];
    return (
      <div className="space-y-3">
        <Button
          variant="ghost"
          size="sm"
          className="px-0 text-emerald-700"
          onClick={() => setEditingIndex(null)}
        >
          ← Back to triggers
        </Button>
        <TriggerEditor
          event={act.event ?? "default_url"}
          value={act.payload ?? {}}
          onChange={(payload) => {
            const next = [...list];
            next[editingIndex] = { ...act, payload };
            onChange(next);
          }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-2 -mx-4 -mt-4">
      {list.map((act, idx) => {
        const schema = getTriggerSchema(act.event);
        const isDefault = act.event === "default_url";
        return (
          <div
            key={idx}
            className="flex items-center gap-3 px-4 py-3 hover:bg-muted/40 cursor-pointer border-b"
            onClick={() => setEditingIndex(idx)}
          >
            <TriggerRowIcon event={act.event} />
            <span className="text-sm flex-1 truncate">
              {schema?.label ?? act.label ?? "Default"}
            </span>
            {/* Trash only on non-default trigger entries — replyagent never
                lets you delete the "Default" url, only secondary triggers. */}
            {!isDefault && list.length > 1 && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={(e) => {
                  e.stopPropagation();
                  onChange(list.filter((_, i) => i !== idx));
                }}
              >
                <Trash2 className="h-3.5 w-3.5 text-destructive" />
              </Button>
            )}
          </div>
        );
      })}
      <div className="px-4 pt-3">
        <Button
          type="button"
          variant="outline"
          className="w-full border-emerald-500 text-emerald-700 hover:bg-emerald-50 font-medium"
          onClick={onPickNew}
        >
          Add a trigger
        </Button>
      </div>
    </div>
  );
}

/**
 * Legacy (kept only to avoid orphan references). The trigger sidebar now
 * uses `TriggerActivitiesPanel` from `automation/activity-editors.tsx`.
 */
function TriggerRowIcon({ event }: { event: string }) {
  // Map by trigger category for the icon — the schema gives us the
  // category name from trigger-schemas.ts.
  const schema = getTriggerSchema(event);
  const cat = schema?.category ?? "";
  let glyph: React.ReactNode;
  let color = "text-muted-foreground";
  if (cat === "Tags") {
    glyph = <span className="text-xs">🏷</span>;
    color = "text-orange-600";
  } else if (cat === "Custom Fields" || cat === "System Fields" || cat === "Date Fields") {
    glyph = <Cog className="h-3 w-3" />;
    color = "text-slate-600";
  } else if (cat === "Pipeline") {
    glyph = <GitBranch className="h-3 w-3" />;
    color = "text-violet-600";
  } else if (cat === "Conversation" || cat === "Flow") {
    glyph = <MessageSquare className="h-3 w-3" />;
    color = "text-blue-600";
  } else if (cat === "Broadcast" || cat === "API") {
    glyph = <Zap className="h-3 w-3" />;
    color = "text-emerald-600";
  } else if (event === "default_url") {
    // Default URL trigger: replyagent uses a round bold "N" badge.
    return (
      <span className="h-6 w-6 rounded-full border-2 border-slate-400 flex items-center justify-center text-[10px] font-bold text-slate-700">
        N
      </span>
    );
  } else {
    // Channel-specific URL / keyword triggers — short letter badge.
    return (
      <span className="h-6 w-6 rounded-full border-2 border-slate-400 flex items-center justify-center text-[10px] font-bold text-slate-700">
        {(schema?.category?.[0] ?? "T").toUpperCase()}
      </span>
    );
  }
  return (
    <span className={`h-6 w-6 rounded-full border-2 border-current flex items-center justify-center ${color}`}>
      {glyph}
    </span>
  );
}

// ─── Initial graph helpers ────────────────────────────────────────────

function defaultLabelForType(type: string): string {
  if (type === "trigger") return "Trigger";
  if (type === "delay") return "Delay";
  if (type === "randomizer") return "Randomizer";
  if (type === "splitter") return "Splitter";
  if (type === "condition") return "Condition";
  if (type === "action") return "Action";
  return type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function serializedNodesFromAutomation(automation: any): Node[] {
  // The backend sync-graph response shape mirrors the input shape — we
  // reconstruct from `steps` + their `activities` + node-id stamps stashed
  // in `step.comment`. Steps live at a few different paths depending on
  // whether the caller went through getAutomation (nested under
  // `automation.version.automation_steps`) or an older shape.
  const steps: any[] =
    automation?.steps
    ?? automation?.automation?.steps
    ?? automation?.automation?.version?.automation_steps
    ?? automation?.version?.automation_steps
    ?? [];
  if (!Array.isArray(steps) || steps.length === 0) {
    // Fresh automation — seed with a trigger node.
    return [
      {
        id: "node_seed_trigger",
        type: "trigger",
        position: { x: 250, y: 120 },
        data: {
          stepType: "trigger",
          label: "Start trigger",
          activity_properties: { event: "default_url" },
          value: {},
        },
      },
    ];
  }
  return steps.map((s) => {
    const props = typeof s.properties === "string" ? safeJson(s.properties) : s.properties ?? {};
    // Activities live under `activities` for the sync-graph response and
    // under `automation_step_activities` for the getAutomation response.
    const acts: any[] = s.activities ?? s.automation_step_activities ?? [];
    const firstActivity = acts[0];
    const activityProps =
      typeof firstActivity?.properties === "string"
        ? safeJson(firstActivity.properties)
        : firstActivity?.properties ?? {};
    return {
      id: String(s.comment ?? `step_${s.id}`),
      type: String(s.type ?? "action"),
      position: { x: props.x ?? 200, y: props.y ?? 120 },
      data: {
        stepType: s.type,
        label: s.title,
        comment: s.comment ?? "",
        value: activityProps,
        activity_properties: firstActivity ? { event: firstActivity.event, ...activityProps } : undefined,
      },
    } as Node;
  });
}

function serializedEdgesFromAutomation(automation: any): Edge[] {
  const flows: any[] = automation?.flows ?? automation?.connections ?? [];
  if (!Array.isArray(flows)) return [];
  return flows.map((f, i) => {
    // Backend encodes React Flow's sourceHandle (Randomizer A/B, etc.)
    // in the slug field and returns it under `source_handle`. Without
    // it, React Flow drops multi-output edges on reopen with
    // "Couldn't create edge for source handle id: undefined".
    const rawHandle = f.source_handle ?? f.sourceHandle;
    const sourceHandleRaw =
      rawHandle == null || rawHandle === "" ? undefined : String(rawHandle);
    // Same defensive filter as the backend: previous versions of the
    // FE occasionally sent the literal string "undefined" as
    // sourceHandle (React Flow's Handle id coercion). If any of those
    // slipped into the DB before the write-side guard, drop them on
    // read so the edge falls back to the default handle instead of
    // referencing a non-existent one.
    const sourceHandle =
      sourceHandleRaw === "undefined" || sourceHandleRaw === "null"
        ? undefined
        : sourceHandleRaw;
    return {
      id: String(f.id ?? `e${i}`),
      source: String(f.source_node_id ?? f.connector_node_id ?? f.connector_id ?? ""),
      target: String(f.target_node_id ?? f.next_node_id ?? f.next_step_id ?? ""),
      ...(sourceHandle ? { sourceHandle } : {}),
      // Arrow head on every hydrated edge so previously-saved flows also
      // show flow direction after the reload — defaultEdgeOptions only
      // covers new edges, not ones we push in via the edges prop.
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color: "#94a3b8",
        width: 18,
        height: 18,
      },
    } as Edge;
  });
}

function safeJson(s: string): any {
  try {
    return JSON.parse(s);
  } catch {
    return {};
  }
}
