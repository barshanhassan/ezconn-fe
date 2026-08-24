import { useEffect, useMemo, useState } from "react";
import {
  Bot,
  Plus,
  Trash2,
  Edit2,
  MoreVertical,
  ChevronLeft,
  Smile,
  MessageSquare,
  AlertCircle,
  Users,
  Image as ImageIcon,
  X,
  Loader2,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { useTheme } from "@/contexts/ThemeContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

// Replyagent share modes. `users` and `group` are both selective-by-ids
// shapes; we expose `users` as "Specific agents" in the UI because that's
// what the existing card design surfaces.
type ShareValue = "private" | "public" | "users";

interface QRMessage {
  id: string;
  title: string;
  type: "text" | "media";
  content: string;
  mediaList: Array<{ gallery_media_id: string | number }>;
}

interface QRCollection {
  id: string;
  name: string;
  share: ShareValue;
  bindings: string[]; // user ids (strings)
  messages: QRMessage[];
}

interface WorkspaceMember {
  id: string;
  name: string;
  email: string;
}

interface CustomFieldOption {
  slug: string;
  label: string;
}

export default function QuickRepliesSection() {
  const { mode } = useTheme();
  const dark = mode === "dark";
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // ── Data ─────────────────────────────────────────────────────────
  const { data: qrData, isLoading } = useQuery<any>({
    queryKey: ["/api/quick-response"],
    queryFn: async () => (await apiRequest("GET", "/api/quick-response")).json(),
  });

  // Members — used by the "Specific agents" picker. Backend endpoint
  // mirrors replyagent's `workspace/members` (lazily loaded only when the
  // share dropdown calls for it).
  const { data: membersData } = useQuery<any>({
    queryKey: ["/api/workspaces/members"],
    queryFn: async () => (await apiRequest("GET", "/api/workspaces/members")).json(),
  });

  // Custom fields — drive the in-textarea "insert variable" picker. Hardcoded
  // Name/Email was misleading because the actual slugs are workspace-defined.
  const { data: cfData } = useQuery<any>({
    queryKey: ["/api/custom-fields", "for-picker"],
    queryFn: async () =>
      (await apiRequest("GET", "/api/custom-fields?folder_id=ALL")).json(),
    staleTime: 30_000,
  });

  const folders: any[] = qrData?.folders ?? [];
  const responses: any[] = qrData?.responses ?? [];
  const members: WorkspaceMember[] = useMemo(() => {
    const list = membersData?.members ?? membersData?.data ?? membersData ?? [];
    return (Array.isArray(list) ? list : []).map((m: any) => ({
      id: String(m.id ?? m.user_id),
      name:
        m.full_name ||
        m.name ||
        [m.first_name, m.last_name].filter(Boolean).join(" ") ||
        m.email ||
        "Unknown",
      email: m.email ?? "",
    }));
  }, [membersData]);

  const customFields: CustomFieldOption[] = useMemo(() => {
    const list: any[] = cfData?.fields ?? [];
    return list.map((f) => ({ slug: f.slug, label: f.label }));
  }, [cfData]);

  const collections: QRCollection[] = useMemo(() => {
    return folders.map((f: any) => ({
      id: String(f.id),
      name: f.title,
      share: ((f.share || "private") as ShareValue),
      bindings: Array.isArray(f.bindings)
        ? f.bindings.map(String)
        : typeof f.bindings === "string"
          ? safeParseBindings(f.bindings)
          : [],
      messages: responses
        .filter(
          (r: any) =>
            r.parent_id != null && String(r.parent_id) === String(f.id),
        )
        .map((m: any) => ({
          id: String(m.id),
          title: m.title,
          type: (m.type || "text") as "text" | "media",
          content: m.text || "",
          mediaList: Array.isArray(m.mediaList)
            ? m.mediaList.map((x: any) => ({
                gallery_media_id: x.gallery_media_id,
              }))
            : [],
        })),
    }));
  }, [folders, responses]);

  // ── Mutations ────────────────────────────────────────────────────
  const invalidateQR = () =>
    queryClient.invalidateQueries({ queryKey: ["/api/quick-response"] });

  const groupMutation = useMutation({
    mutationFn: async (payload: any) =>
      (await apiRequest("POST", "/api/quick-response/group", payload)).json(),
    onSuccess: () => invalidateQR(),
    onError: (e: any) =>
      toast({ title: "Error", description: e?.message, variant: "destructive" }),
  });
  const messageMutation = useMutation({
    mutationFn: async (payload: any) =>
      (await apiRequest("POST", "/api/quick-response/message", payload)).json(),
    onSuccess: () => invalidateQR(),
    onError: (e: any) =>
      toast({ title: "Error", description: e?.message, variant: "destructive" }),
  });
  const deleteMutation = useMutation({
    mutationFn: async (id: string) =>
      (await apiRequest("DELETE", `/api/quick-response/${id}`)).json(),
    onSuccess: () => invalidateQR(),
    onError: (e: any) =>
      toast({ title: "Error", description: e?.message, variant: "destructive" }),
  });

  // ── View / form state ──────────────────────────────────────────
  const [view, setView] = useState<
    "list" | "create_collection" | "collection_detail" | "create_message"
  >("list");
  const [currentCollectionId, setCurrentCollectionId] = useState<string | null>(null);

  // Collection form
  const [collectionForm, setCollectionForm] = useState<{
    id: string | null;
    name: string;
    share: ShareValue;
    bindings: string[];
  }>({ id: null, name: "", share: "private", bindings: [] });

  // Message form
  const [messageForm, setMessageForm] = useState<{
    id: string | null;
    title: string;
    type: "text" | "media";
    content: string;
    media: Array<{ gallery_media_id: string }>;
    mediaInput: string;
  }>({ id: null, title: "", type: "text", content: "", media: [], mediaInput: "" });

  const [showError, setShowError] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  const currentCollection = collections.find((c) => c.id === currentCollectionId) || null;

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

  // ── Handlers ─────────────────────────────────────────────────────
  const resetCollectionForm = () =>
    setCollectionForm({ id: null, name: "", share: "private", bindings: [] });

  const resetMessageForm = () =>
    setMessageForm({
      id: null,
      title: "",
      type: "text",
      content: "",
      media: [],
      mediaInput: "",
    });

  const handleCreateCollectionClick = () => {
    resetCollectionForm();
    setShowError(false);
    setView("create_collection");
  };

  const handleCancelCreateCollection = () => {
    setShowError(false);
    setView("list");
    resetCollectionForm();
  };

  const handleSubmitCollection = (onDone?: () => void) => {
    if (!collectionForm.name.trim()) {
      setShowError(true);
      return;
    }
    const payload: any = {
      title: collectionForm.name.trim(),
      share: collectionForm.share,
      bindings: collectionForm.share === "users" ? collectionForm.bindings : null,
    };
    if (collectionForm.id) payload.id = collectionForm.id;

    groupMutation.mutate(payload, {
      onSuccess: () => {
        toast({
          title: collectionForm.id ? "Collection updated" : "Collection created",
        });
        if (onDone) onDone();
        else setView("list");
        resetCollectionForm();
      },
    });
  };

  const openEditModal = (collection: QRCollection) => {
    setCollectionForm({
      id: collection.id,
      name: collection.name,
      share: collection.share,
      bindings: collection.bindings,
    });
    setIsEditModalOpen(true);
  };

  const openDeleteModal = (collection: QRCollection) => {
    setCurrentCollectionId(collection.id);
    setIsDeleteModalOpen(true);
  };

  const openCollectionDetail = (collection: QRCollection) => {
    setCurrentCollectionId(collection.id);
    setView("collection_detail");
  };

  const handleCreateMessageClick = () => {
    resetMessageForm();
    setView("create_message");
  };

  const openEditMessage = (msg: QRMessage) => {
    setMessageForm({
      id: msg.id,
      title: msg.title,
      type: msg.type,
      content: msg.content,
      media: msg.mediaList.map((m) => ({
        gallery_media_id: String(m.gallery_media_id),
      })),
      mediaInput: "",
    });
    setView("create_message");
  };

  const handleSubmitMessage = () => {
    if (!currentCollectionId) return;
    if (!messageForm.title.trim()) {
      toast({ title: "Title required", variant: "destructive" });
      return;
    }
    if (messageForm.type === "text" && !messageForm.content.trim()) {
      toast({ title: "Message text required", variant: "destructive" });
      return;
    }
    if (messageForm.type === "media" && messageForm.media.length === 0) {
      toast({ title: "Add at least one media item", variant: "destructive" });
      return;
    }
    const payload: any = {
      title: messageForm.title.trim(),
      group_id: currentCollectionId,
      type: messageForm.type,
      text: messageForm.content,
      media_list: messageForm.media.map((m) => ({ id: m.gallery_media_id })),
    };
    if (messageForm.id) payload.id = messageForm.id;

    messageMutation.mutate(payload, {
      onSuccess: () => {
        toast({
          title: messageForm.id ? "Message updated" : "Message created",
        });
        setView("collection_detail");
        resetMessageForm();
      },
    });
  };

  const handleDeleteCollection = () => {
    if (!currentCollectionId) return;
    deleteMutation.mutate(currentCollectionId, {
      onSuccess: () => {
        toast({ title: "Collection deleted" });
        setCurrentCollectionId(null);
        setIsDeleteModalOpen(false);
        setView("list");
      },
    });
  };

  const handleDeleteMessage = (id: string) => {
    deleteMutation.mutate(id, {
      onSuccess: () => toast({ title: "Message deleted" }),
    });
  };

  const insertField = (slug: string) => {
    if (!slug) return;
    const token = `{{${slug}}}`;
    setMessageForm((p) => ({ ...p, content: (p.content + token).slice(0, 2000) }));
  };

  const addMediaId = () => {
    const id = messageForm.mediaInput.trim();
    if (!id) return;
    if (messageForm.media.some((m) => m.gallery_media_id === id)) {
      toast({ title: "Already added", variant: "destructive" });
      return;
    }
    setMessageForm((p) => ({
      ...p,
      media: [...p.media, { gallery_media_id: id }],
      mediaInput: "",
    }));
  };

  const removeMedia = (id: string) =>
    setMessageForm((p) => ({
      ...p,
      media: p.media.filter((m) => m.gallery_media_id !== id),
    }));

  const toggleBinding = (userId: string) =>
    setCollectionForm((p) => ({
      ...p,
      bindings: p.bindings.includes(userId)
        ? p.bindings.filter((id) => id !== userId)
        : [...p.bindings, userId],
    }));

  const headerTitle =
    view === "create_collection"
      ? collectionForm.id
        ? "Edit Collection"
        : "Create Collection"
      : view === "collection_detail" || view === "create_message"
        ? currentCollection?.name || "Collection"
        : "Quick Replies";

  const RadioRow = ({
    value,
    current,
    onSelect,
    label,
    sublabel,
  }: {
    value: string;
    current: string;
    onSelect: () => void;
    label: string;
    sublabel?: string;
  }) => (
    <div
      onClick={onSelect}
      className={cn(
        "flex items-center gap-3 p-4 rounded-xl border cursor-pointer transition-all",
        current === value
          ? "border-primary bg-primary/5"
          : cn(softBorder, dark ? "bg-slate-900/40 hover:border-primary/40" : "bg-white hover:border-primary/40"),
      )}
    >
      <div
        className={cn(
          "w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0",
          current === value ? "border-primary" : sub,
        )}
      >
        {current === value && <div className="w-2 h-2 rounded-full bg-primary" />}
      </div>
      <div>
        <span className={cn("text-[12px] font-bold", text)}>{label}</span>
        {sublabel && (
          <p className={cn("text-[10px] font-medium opacity-60 mt-0.5", sub)}>{sublabel}</p>
        )}
      </div>
    </div>
  );

  const AgentPicker = () => (
    <div className={cn("rounded-xl border p-4 space-y-3", softBg, softBorder)}>
      <div className="flex items-center gap-2">
        <Users size={14} className="text-primary" />
        <span className={cn("text-[12px] font-semibold", text)}>
          Pick agents ({collectionForm.bindings.length} selected)
        </span>
      </div>
      {members.length === 0 ? (
        <p className={cn("text-[11px] font-medium opacity-60", sub)}>
          No other agents in this workspace yet.
        </p>
      ) : (
        <div className="max-h-44 overflow-y-auto space-y-1.5 pr-1">
          {members.map((m) => {
            const checked = collectionForm.bindings.includes(m.id);
            return (
              <label
                key={m.id}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-lg border cursor-pointer transition-all",
                  checked
                    ? "border-primary/50 bg-primary/5"
                    : cn(softBorder, dark ? "bg-slate-900/40 hover:border-primary/30" : "bg-white hover:border-primary/30"),
                )}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggleBinding(m.id)}
                  className="rounded accent-[hsl(var(--primary))] w-4 h-4"
                />
                <div className="min-w-0">
                  <p className={cn("text-[12px] font-black truncate", text)}>{m.name}</p>
                  {m.email && (
                    <p className={cn("text-[10px] font-medium opacity-60 truncate", sub)}>
                      {m.email}
                    </p>
                  )}
                </div>
              </label>
            );
          })}
        </div>
      )}
    </div>
  );

  return (
    <>
      <Card className={cn("rounded-[2rem] border overflow-hidden shadow-sm transition-all duration-300", card, border)}>
        <CardContent className="p-0">
          {/* Header */}
          <div className={cn("px-8 py-5 border-b flex items-center justify-between", border)}>
            <div className="flex items-center gap-4">
              <div className={cn("p-2.5 rounded-xl shadow-sm", "bg-primary/10")}>
                <Bot className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h1 className={cn("text-[16px] font-bold tracking-tight", text)}>
                  {headerTitle}
                </h1>
                <p className={cn("text-[11px] font-bold mt-0.5 opacity-60 max-w-2xl", sub)}>
                  Create and organize quick replies for live chats with leads or contacts.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {view === "list" && (
                <button onClick={handleCreateCollectionClick} className={primaryOutlineBtn}>
                  <Plus size={12} /> Add Collection
                </button>
              )}
              {view === "create_collection" && (
                <button onClick={handleCancelCreateCollection} className={outlineBtn}>
                  <ChevronLeft size={12} /> Back
                </button>
              )}
              {(view === "collection_detail" || view === "create_message") && (
                <>
                  {view === "collection_detail" && (
                    <button onClick={handleCreateMessageClick} className={primaryOutlineBtn}>
                      <Plus size={12} /> Add Message
                    </button>
                  )}
                  <button onClick={() => setView("list")} className={outlineBtn}>
                    <ChevronLeft size={12} /> Collections
                  </button>
                </>
              )}
            </div>
          </div>

          {/* ── LIST VIEW ── */}
          {view === "list" && (
            <div className="p-8">
              <div className={cn("rounded-[1.5rem] border overflow-hidden", softBorder, softBg)}>
                <div className={cn("px-6 py-4 border-b flex items-center justify-between", softBorder, dark ? "bg-slate-900/40" : "bg-white/60")}>
                  <span className={cn("text-[11px] font-semibold", sub)}>Collection Name</span>
                  <span className={cn("text-[11px] font-semibold", sub)}>Action</span>
                </div>
                {isLoading ? (
                  <div className="py-12 flex justify-center">
                    <Loader2 className="w-6 h-6 animate-spin text-primary" />
                  </div>
                ) : collections.length === 0 ? (
                  <div className="py-16 px-8 flex flex-col items-center justify-center text-center space-y-3">
                    <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
                      <Bot className="w-7 h-7 text-primary" />
                    </div>
                    <div className="space-y-1">
                      <h3 className={cn("text-[13px] font-black", text)}>No collections found</h3>
                      <p className={cn("text-[11px] font-medium opacity-60", sub)}>
                        Create a new one to get started.
                      </p>
                    </div>
                  </div>
                ) : (
                  collections.map((collection) => (
                    <div
                      key={collection.id}
                      onClick={() => openCollectionDetail(collection)}
                      className={cn(
                        "flex items-center justify-between px-6 py-4 border-b last:border-0 cursor-pointer transition-colors group",
                        softBorder,
                        dark ? "hover:bg-slate-900/40" : "hover:bg-white/80",
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                          <Bot size={14} className="text-primary" />
                        </div>
                        <div className="min-w-0">
                          <span className={cn("text-[13px] font-black group-hover:text-primary transition-colors", text)}>
                            {collection.name}
                          </span>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className={cn("text-[10px] font-medium opacity-60", sub)}>
                              {collection.share}
                            </span>
                            <span className={cn("text-[10px] font-medium opacity-60", sub)}>
                              · {collection.messages.length} message{collection.messages.length === 1 ? "" : "s"}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button className={cn("w-9 h-9 rounded-lg border flex items-center justify-center transition-all", dark ? "border-slate-800 hover:border-primary/40 hover:text-primary text-slate-400" : "border-slate-200 hover:border-primary/40 hover:text-primary text-slate-500")}>
                              <MoreVertical size={14} />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className={cn("rounded-xl border p-1.5 w-44", card, border)}>
                            <DropdownMenuItem onClick={() => openEditModal(collection)} className="rounded-lg text-[12px] font-bold py-2 px-3 flex gap-2 cursor-pointer">
                              <Edit2 size={13} /> Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => openCollectionDetail(collection)} className="rounded-lg text-[12px] font-bold py-2 px-3 flex gap-2 cursor-pointer">
                              <Bot size={13} /> Open collection
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => openDeleteModal(collection)} className="rounded-lg text-[12px] font-bold py-2 px-3 flex gap-2 cursor-pointer text-rose-500 focus:text-rose-500 focus:bg-rose-500/10">
                              <Trash2 size={13} /> Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* ── CREATE / EDIT COLLECTION ── */}
          {view === "create_collection" && (
            <div className="p-8">
              <div className={cn("rounded-[1.5rem] border p-8 space-y-6", softBg, softBorder)}>
                <div className="max-w-xl space-y-6">
                  <div className="space-y-2">
                    <label className={labelCls}>Collection Name</label>
                    <input
                      value={collectionForm.name}
                      onChange={(e) => {
                        setCollectionForm((p) => ({ ...p, name: e.target.value.slice(0, 80) }));
                        if (e.target.value.trim()) setShowError(false);
                      }}
                      placeholder="Enter collection name"
                      className={cn(inputCls, showError && "!border-rose-500 focus:!ring-rose-500/30")}
                    />
                    {showError && (
                      <p className="text-[11px] font-bold text-rose-500">Enter collection name.</p>
                    )}
                  </div>

                  <div className="space-y-3">
                    <label className={labelCls}>Share this collection with</label>
                    <div className="space-y-2">
                      <RadioRow
                        value="private"
                        current={collectionForm.share}
                        onSelect={() => setCollectionForm((p) => ({ ...p, share: "private" }))}
                        label="Private"
                        sublabel="Only you can see."
                      />
                      <RadioRow
                        value="public"
                        current={collectionForm.share}
                        onSelect={() => setCollectionForm((p) => ({ ...p, share: "public" }))}
                        label="Public"
                        sublabel="All agents can see."
                      />
                      <RadioRow
                        value="users"
                        current={collectionForm.share}
                        onSelect={() => setCollectionForm((p) => ({ ...p, share: "users" }))}
                        label="Specific agents"
                        sublabel="Share with picked agents only."
                      />
                    </div>
                    {collectionForm.share === "users" && <AgentPicker />}
                  </div>
                </div>

                <div className={cn("flex justify-end gap-2 pt-6 border-t", softBorder)}>
                  <button onClick={handleCancelCreateCollection} className={outlineBtn}>Cancel</button>
                  <button
                    onClick={() => handleSubmitCollection()}
                    disabled={groupMutation.isPending}
                    className={primaryBtn}
                  >
                    {groupMutation.isPending && <Loader2 size={12} className="animate-spin" />}
                    <Plus size={12} /> Save
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ── COLLECTION DETAIL ── */}
          {view === "collection_detail" && currentCollection && (
            <div className="p-8">
              <div className={cn("rounded-[1.5rem] border overflow-hidden", softBorder, softBg)}>
                {currentCollection.messages.length === 0 ? (
                  <div className="py-16 px-8 flex flex-col items-center justify-center text-center space-y-3">
                    <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
                      <MessageSquare className="w-7 h-7 text-primary" />
                    </div>
                    <div className="space-y-1">
                      <h3 className={cn("text-[13px] font-black", text)}>No messages yet</h3>
                      <p className={cn("text-[11px] font-medium opacity-60", sub)}>
                        Add a canned message to this collection.
                      </p>
                    </div>
                  </div>
                ) : (
                  currentCollection.messages.map((message) => (
                    <div
                      key={message.id}
                      className={cn("flex items-center gap-3 px-6 py-4 border-b last:border-0 transition-colors", softBorder, dark ? "hover:bg-slate-900/40" : "hover:bg-white/80")}
                    >
                      <button
                        onClick={() => openEditMessage(message)}
                        className="flex items-center gap-3 flex-1 text-left"
                      >
                        <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                          {message.type === "media" ? (
                            <ImageIcon size={14} className="text-primary" />
                          ) : (
                            <MessageSquare size={14} className="text-primary" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <span className={cn("text-[13px] font-black", text)}>{message.title}</span>
                          <p className={cn("text-[11px] font-medium opacity-60 truncate max-w-md", sub)}>
                            {message.content || `${message.mediaList.length} media`}
                          </p>
                        </div>
                      </button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className={cn("w-9 h-9 rounded-lg border flex items-center justify-center transition-all", dark ? "border-slate-800 hover:border-primary/40 hover:text-primary text-slate-400" : "border-slate-200 hover:border-primary/40 hover:text-primary text-slate-500")}>
                            <MoreVertical size={14} />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className={cn("rounded-xl border p-1.5 w-44", card, border)}>
                          <DropdownMenuItem onClick={() => openEditMessage(message)} className="rounded-lg text-[12px] font-bold py-2 px-3 flex gap-2 cursor-pointer">
                            <Edit2 size={13} /> Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleDeleteMessage(message.id)}
                            className="rounded-lg text-[12px] font-bold py-2 px-3 flex gap-2 cursor-pointer text-rose-500 focus:text-rose-500 focus:bg-rose-500/10"
                          >
                            <Trash2 size={13} /> Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* ── CREATE / EDIT MESSAGE ── */}
          {view === "create_message" && currentCollection && (
            <div className="p-8">
              <div className={cn("rounded-[1.5rem] border p-8 space-y-6", softBg, softBorder)}>
                <div className="space-y-6">
                  <div className="space-y-2">
                    <label className={labelCls}>Message Title</label>
                    <input
                      placeholder="Enter message title"
                      value={messageForm.title}
                      onChange={(e) => setMessageForm((p) => ({ ...p, title: e.target.value.slice(0, 80) }))}
                      className={inputCls}
                    />
                  </div>

                  <div className="space-y-3">
                    <label className={labelCls}>Message Type</label>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-w-md">
                      <RadioRow
                        value="text"
                        current={messageForm.type}
                        onSelect={() => setMessageForm((p) => ({ ...p, type: "text" }))}
                        label="Text message"
                      />
                      <RadioRow
                        value="media"
                        current={messageForm.type}
                        onSelect={() => setMessageForm((p) => ({ ...p, type: "media" }))}
                        label="Media message"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className={labelCls}>Response Text</label>
                    <div className="relative">
                      <textarea
                        placeholder="Type message..."
                        rows={6}
                        value={messageForm.content}
                        onChange={(e) => setMessageForm((p) => ({ ...p, content: e.target.value.slice(0, 2000) }))}
                        className={cn(textareaCls, "pr-10")}
                      />
                      <button
                        type="button"
                        className={cn("absolute bottom-3 right-3 transition-colors", sub, "hover:text-primary")}
                        title="Emoji"
                      >
                        <Smile size={18} />
                      </button>
                    </div>
                    <div className="flex justify-between items-center">
                      <select
                        value=""
                        onChange={(e) => insertField(e.target.value)}
                        className={cn(selectCls, "h-9 max-w-[240px] text-[11px]")}
                      >
                        <option value="">Insert field…</option>
                        <option value="first_name">{`{{first_name}}`}</option>
                        <option value="last_name">{`{{last_name}}`}</option>
                        <option value="email">{`{{email}}`}</option>
                        {customFields.map((f) => (
                          <option key={f.slug} value={f.slug}>
                            {`{{${f.slug}}} — ${f.label}`}
                          </option>
                        ))}
                      </select>
                      <span className="text-[11px] font-semibold text-primary">
                        {2000 - messageForm.content.length} remaining
                      </span>
                    </div>
                  </div>

                  {messageForm.type === "media" && (
                    <div className={cn("rounded-xl border p-4 space-y-3", softBg, softBorder)}>
                      <div>
                        <p className={cn("text-[12px] font-black", text)}>Attached media</p>
                        <p className={cn("text-[11px] font-medium opacity-60", sub)}>
                          Paste a Gallery media ID — find it in Media Gallery. Replyagent supports image, document, video, audio.
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <input
                          placeholder="Gallery media ID"
                          value={messageForm.mediaInput}
                          onChange={(e) => setMessageForm((p) => ({ ...p, mediaInput: e.target.value }))}
                          className={cn(inputCls, "flex-1 font-mono text-[12px]")}
                        />
                        <button onClick={addMediaId} className={primaryOutlineBtn} type="button">
                          <Plus size={12} /> Add
                        </button>
                      </div>
                      {messageForm.media.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {messageForm.media.map((m) => (
                            <span
                              key={m.gallery_media_id}
                              className="inline-flex items-center gap-1.5 h-7 px-3 rounded-md border border-primary/30 bg-primary/5 text-primary text-[11px] font-black"
                            >
                              <ImageIcon size={11} /> #{m.gallery_media_id}
                              <button
                                onClick={() => removeMedia(m.gallery_media_id)}
                                className="hover:text-rose-500"
                                type="button"
                              >
                                <X size={11} />
                              </button>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className={cn("flex justify-end gap-2 pt-6 border-t", softBorder)}>
                  <button
                    onClick={() => {
                      setView("collection_detail");
                      resetMessageForm();
                    }}
                    className={outlineBtn}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSubmitMessage}
                    disabled={messageMutation.isPending}
                    className={primaryBtn}
                  >
                    {messageMutation.isPending && <Loader2 size={12} className="animate-spin" />}
                    <Plus size={12} /> {messageForm.id ? "Save" : "Add"}
                  </button>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Edit Collection Modal ── */}
      <Dialog
        open={isEditModalOpen}
        onOpenChange={(open) => {
          if (!open) {
            setIsEditModalOpen(false);
            resetCollectionForm();
          }
        }}
      >
        <DialogContent className={cn("border p-0 overflow-hidden rounded-[2rem] max-w-md max-h-[90vh] overflow-y-auto", card, border)}>
          <div className="p-6 space-y-5">
            <DialogHeader>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
                  <Edit2 size={18} />
                </div>
                <div className="text-left">
                  <DialogTitle className={cn("text-[14px] font-semibold", text)}>
                    Edit Collection
                  </DialogTitle>
                  <DialogDescription className={cn("text-[11px] font-medium opacity-60 mt-0.5", sub)}>
                    Update name, sharing and agents.
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>

            <div className="space-y-4">
              <div className="space-y-2">
                <label className={labelCls}>Collection Name</label>
                <input
                  value={collectionForm.name}
                  onChange={(e) => setCollectionForm((p) => ({ ...p, name: e.target.value.slice(0, 80) }))}
                  placeholder="Enter collection name"
                  className={inputCls}
                />
              </div>
              <div className="space-y-2">
                <label className={labelCls}>Sharing</label>
                <select
                  value={collectionForm.share}
                  onChange={(e) =>
                    setCollectionForm((p) => ({ ...p, share: e.target.value as ShareValue }))
                  }
                  className={selectCls}
                >
                  <option value="private">Private — only you</option>
                  <option value="public">Public — all agents</option>
                  <option value="users">Specific agents</option>
                </select>
              </div>
              {collectionForm.share === "users" && <AgentPicker />}
            </div>

            <div className={cn("flex justify-end gap-2 pt-4 border-t", softBorder)}>
              <button
                onClick={() => {
                  setIsEditModalOpen(false);
                  resetCollectionForm();
                }}
                className={outlineBtn}
              >
                Cancel
              </button>
              <button
                onClick={() => handleSubmitCollection(() => setIsEditModalOpen(false))}
                disabled={groupMutation.isPending}
                className={primaryBtn}
              >
                {groupMutation.isPending && <Loader2 size={12} className="animate-spin" />}
                Save Changes
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Delete Dialog ── */}
      <AlertDialog open={isDeleteModalOpen} onOpenChange={setIsDeleteModalOpen}>
        <AlertDialogContent className={cn("rounded-[2rem] border p-0 max-w-md overflow-hidden", card, border)}>
          <div className="p-6 space-y-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-500/10 flex items-center justify-center text-rose-500">
                <AlertCircle size={18} />
              </div>
              <div>
                <h2 className={cn("text-[14px] font-semibold", text)}>
                  Delete Collection?
                </h2>
                <p className={cn("text-[11px] font-medium opacity-60 mt-0.5 leading-relaxed", sub)}>
                  <span className="text-rose-500 font-black">
                    {collections.find((c) => c.id === currentCollectionId)?.name ?? "This collection"}
                  </span>{" "}
                  and every message inside it will be permanently removed.
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <AlertDialogCancel className={cn(outlineBtn, "m-0")}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDeleteCollection}
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

function safeParseBindings(raw: string): string[] {
  try {
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.map(String) : [];
  } catch {
    return [];
  }
}
