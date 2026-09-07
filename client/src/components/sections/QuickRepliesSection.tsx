import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Bot,
  Plus,
  Trash2,
  Edit2,
  MoreVertical,
  ChevronLeft,
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
import MediaGallerySection from "@/components/workspace/MediaGallerySection";
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

export default function QuickRepliesSection() {
  const { t } = useTranslation();
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
        t("quick_replies_section.unknown_member"),
      email: m.email ?? "",
    }));
  }, [membersData]);

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
      toast({ title: t("quick_replies_section.toast_error_title"), description: e?.message, variant: "destructive" }),
  });
  const messageMutation = useMutation({
    mutationFn: async (payload: any) =>
      (await apiRequest("POST", "/api/quick-response/message", payload)).json(),
    onSuccess: () => invalidateQR(),
    onError: (e: any) =>
      toast({ title: t("quick_replies_section.toast_error_title"), description: e?.message, variant: "destructive" }),
  });
  const deleteMutation = useMutation({
    mutationFn: async (id: string) =>
      (await apiRequest("DELETE", `/api/quick-response/${id}`)).json(),
    onSuccess: () => invalidateQR(),
    onError: (e: any) =>
      toast({ title: t("quick_replies_section.toast_error_title"), description: e?.message, variant: "destructive" }),
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
    mediaFileName: string;
  }>({ id: null, title: "", type: "text", content: "", media: [], mediaFileName: "" });

  const [showError, setShowError] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [galleryPickerOpen, setGalleryPickerOpen] = useState(false);

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
      mediaFileName: "",
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
          title: collectionForm.id
            ? t("quick_replies_section.toast_collection_updated")
            : t("quick_replies_section.toast_collection_created"),
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
      mediaFileName: "",
    });
    setView("create_message");
  };

  const handleSubmitMessage = () => {
    if (!currentCollectionId) return;
    if (!messageForm.title.trim()) {
      toast({ title: t("quick_replies_section.toast_title_required"), variant: "destructive" });
      return;
    }
    if (messageForm.type === "text" && !messageForm.content.trim()) {
      toast({ title: t("quick_replies_section.toast_message_text_required"), variant: "destructive" });
      return;
    }
    if (messageForm.type === "media" && messageForm.media.length === 0) {
      toast({ title: t("quick_replies_section.toast_add_media_required"), variant: "destructive" });
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
          title: messageForm.id
            ? t("quick_replies_section.toast_message_updated")
            : t("quick_replies_section.toast_message_created"),
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
        toast({ title: t("quick_replies_section.toast_collection_deleted") });
        setCurrentCollectionId(null);
        setIsDeleteModalOpen(false);
        setView("list");
      },
    });
  };

  const handleDeleteMessage = (id: string) => {
    deleteMutation.mutate(id, {
      onSuccess: () => toast({ title: t("quick_replies_section.toast_message_deleted") }),
    });
  };

  const removeMedia = (id: string) =>
    setMessageForm((p) => ({
      ...p,
      media: p.media.filter((m) => m.gallery_media_id !== id),
      mediaFileName: "",
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
        ? t("quick_replies_section.header_edit_collection")
        : t("quick_replies_section.header_create_collection")
      : view === "collection_detail" || view === "create_message"
        ? currentCollection?.name || t("quick_replies_section.header_collection_fallback")
        : t("quick_replies_section.header_quick_replies");

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
          {t("quick_replies_section.agent_picker_title", { count: collectionForm.bindings.length })}
        </span>
      </div>
      {members.length === 0 ? (
        <p className={cn("text-[11px] font-medium opacity-60", sub)}>
          {t("quick_replies_section.agent_picker_empty")}
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
                  {t("quick_replies_section.header_subtitle")}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {view === "list" && (
                <button onClick={handleCreateCollectionClick} className={primaryOutlineBtn}>
                  <Plus size={12} /> {t("quick_replies_section.add_collection")}
                </button>
              )}
              {view === "create_collection" && (
                <button onClick={handleCancelCreateCollection} className={outlineBtn}>
                  <ChevronLeft size={12} /> {t("quick_replies_section.back")}
                </button>
              )}
              {(view === "collection_detail" || view === "create_message") && (
                <>
                  {view === "collection_detail" && (
                    <button onClick={handleCreateMessageClick} className={primaryOutlineBtn}>
                      <Plus size={12} /> {t("quick_replies_section.add_message")}
                    </button>
                  )}
                  <button onClick={() => setView("list")} className={outlineBtn}>
                    <ChevronLeft size={12} /> {t("quick_replies_section.collections")}
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
                  <span className={cn("text-[11px] font-semibold", sub)}>{t("quick_replies_section.list_collection_name")}</span>
                  <span className={cn("text-[11px] font-semibold", sub)}>{t("quick_replies_section.list_action")}</span>
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
                      <h3 className={cn("text-[13px] font-black", text)}>{t("quick_replies_section.no_collections_title")}</h3>
                      <p className={cn("text-[11px] font-medium opacity-60", sub)}>
                        {t("quick_replies_section.no_collections_desc")}
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
                              {t(`quick_replies_section.share_${collection.share}`)}
                            </span>
                            <span className={cn("text-[10px] font-medium opacity-60", sub)}>
                              · {t("quick_replies_section.message_count", { count: collection.messages.length })}
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
                              <Edit2 size={13} /> {t("quick_replies_section.edit_action")}
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => openCollectionDetail(collection)} className="rounded-lg text-[12px] font-bold py-2 px-3 flex gap-2 cursor-pointer">
                              <Bot size={13} /> {t("quick_replies_section.open_collection_action")}
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => openDeleteModal(collection)} className="rounded-lg text-[12px] font-bold py-2 px-3 flex gap-2 cursor-pointer text-rose-500 focus:text-rose-500 focus:bg-rose-500/10">
                              <Trash2 size={13} /> {t("quick_replies_section.delete_action")}
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
                <div className="space-y-6">
                  <div className="max-w-md space-y-2">
                    <label className={labelCls}>{t("quick_replies_section.create_collection_name_label")}</label>
                    <input
                      value={collectionForm.name}
                      onChange={(e) => {
                        setCollectionForm((p) => ({ ...p, name: e.target.value.slice(0, 80) }));
                        if (e.target.value.trim()) setShowError(false);
                      }}
                      placeholder={t("quick_replies_section.create_collection_name_placeholder")}
                      className={cn(inputCls, showError && "!border-rose-500 focus:!ring-rose-500/30")}
                    />
                    {showError && (
                      <p className="text-[11px] font-bold text-rose-500">{t("quick_replies_section.create_collection_name_error")}</p>
                    )}
                  </div>

                  <div className="space-y-3">
                    <label className={labelCls}>{t("quick_replies_section.share_with_label")}</label>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <RadioRow
                        value="private"
                        current={collectionForm.share}
                        onSelect={() => setCollectionForm((p) => ({ ...p, share: "private" }))}
                        label={t("quick_replies_section.share_private")}
                        sublabel={t("quick_replies_section.share_private_desc")}
                      />
                      <RadioRow
                        value="public"
                        current={collectionForm.share}
                        onSelect={() => setCollectionForm((p) => ({ ...p, share: "public" }))}
                        label={t("quick_replies_section.share_public")}
                        sublabel={t("quick_replies_section.share_public_desc")}
                      />
                      <RadioRow
                        value="users"
                        current={collectionForm.share}
                        onSelect={() => setCollectionForm((p) => ({ ...p, share: "users" }))}
                        label={t("quick_replies_section.share_users")}
                        sublabel={t("quick_replies_section.share_users_desc")}
                      />
                    </div>
                    {collectionForm.share === "users" && <AgentPicker />}
                  </div>
                </div>

                <div className={cn("flex justify-end gap-2 pt-6 border-t", softBorder)}>
                  <button onClick={handleCancelCreateCollection} className={outlineBtn}>{t("quick_replies_section.cancel")}</button>
                  <button
                    onClick={() => handleSubmitCollection()}
                    disabled={groupMutation.isPending}
                    className={primaryBtn}
                  >
                    {groupMutation.isPending && <Loader2 size={12} className="animate-spin" />}
                    <Plus size={12} /> {t("quick_replies_section.save")}
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
                      <h3 className={cn("text-[13px] font-black", text)}>{t("quick_replies_section.no_messages_title")}</h3>
                      <p className={cn("text-[11px] font-medium opacity-60", sub)}>
                        {t("quick_replies_section.no_messages_desc")}
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
                            {message.content || t("quick_replies_section.media_summary", { count: message.mediaList.length })}
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
                            <Edit2 size={13} /> {t("quick_replies_section.edit_action")}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleDeleteMessage(message.id)}
                            className="rounded-lg text-[12px] font-bold py-2 px-3 flex gap-2 cursor-pointer text-rose-500 focus:text-rose-500 focus:bg-rose-500/10"
                          >
                            <Trash2 size={13} /> {t("quick_replies_section.delete_action")}
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
                    <label className={labelCls}>{t("quick_replies_section.message_title_label")}</label>
                    <input
                      placeholder={t("quick_replies_section.message_title_placeholder")}
                      value={messageForm.title}
                      onChange={(e) => setMessageForm((p) => ({ ...p, title: e.target.value.slice(0, 80) }))}
                      className={inputCls}
                    />
                  </div>

                  <div className="space-y-3">
                    <label className={labelCls}>{t("quick_replies_section.message_type_label")}</label>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-w-md">
                      <RadioRow
                        value="text"
                        current={messageForm.type}
                        onSelect={() => setMessageForm((p) => ({ ...p, type: "text" }))}
                        label={t("quick_replies_section.message_type_text")}
                      />
                      <RadioRow
                        value="media"
                        current={messageForm.type}
                        onSelect={() => setMessageForm((p) => ({ ...p, type: "media" }))}
                        label={t("quick_replies_section.message_type_media")}
                      />
                    </div>
                  </div>

                  {messageForm.type === "media" && (
                    <div className="space-y-2">
                      <label className={labelCls}>{t("quick_replies_section.file_label")}</label>
                      {messageForm.media.length > 0 ? (
                        <div className="flex items-center gap-2 h-11 px-4 rounded-xl border border-primary/30 bg-primary/5 text-primary text-[12px] font-bold">
                          <ImageIcon size={14} className="flex-shrink-0" />
                          <span className="flex-1 truncate">
                            {messageForm.mediaFileName || `#${messageForm.media[0].gallery_media_id}`}
                          </span>
                          <button
                            type="button"
                            onClick={() => removeMedia(messageForm.media[0].gallery_media_id)}
                            className="hover:text-rose-500 flex-shrink-0"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => setGalleryPickerOpen(true)}
                            className={cn(outlineBtn, "w-fit")}
                          >
                            <ImageIcon size={12} /> {t("quick_replies_section.select_from_gallery")}
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="space-y-2">
                    <label className={labelCls}>
                      {messageForm.type === "media"
                        ? t("quick_replies_section.caption_label")
                        : t("quick_replies_section.response_text_label")}
                    </label>
                    <textarea
                      placeholder={t("quick_replies_section.response_text_placeholder")}
                      rows={messageForm.type === "media" ? 4 : 6}
                      value={messageForm.content}
                      onChange={(e) => setMessageForm((p) => ({ ...p, content: e.target.value.slice(0, 2000) }))}
                      className={textareaCls}
                    />
                    <div className="flex justify-end">
                      <span className="text-[11px] font-semibold text-primary">
                        {t("quick_replies_section.chars_remaining", { count: 2000 - messageForm.content.length })}
                      </span>
                    </div>
                  </div>
                </div>

                <div className={cn("flex justify-end gap-2 pt-6 border-t", softBorder)}>
                  <button
                    onClick={() => {
                      setView("collection_detail");
                      resetMessageForm();
                    }}
                    className={outlineBtn}
                  >
                    {t("quick_replies_section.cancel")}
                  </button>
                  <button
                    onClick={handleSubmitMessage}
                    disabled={messageMutation.isPending}
                    className={primaryBtn}
                  >
                    {messageMutation.isPending && <Loader2 size={12} className="animate-spin" />}
                    <Plus size={12} /> {messageForm.id ? t("quick_replies_section.save") : t("quick_replies_section.add_button")}
                  </button>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Media Gallery picker for message media (reuses the workspace
          Media Gallery instead of a re-upload) ── */}
      <Dialog open={galleryPickerOpen} onOpenChange={setGalleryPickerOpen}>
        <DialogContent className="max-w-5xl h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>{t("quick_replies_section.select_from_gallery")}</DialogTitle>
          </DialogHeader>
          <div className="flex-1 min-h-0 overflow-auto">
            <MediaGallerySection
              onSelect={(file) => {
                setMessageForm((p) => ({
                  ...p,
                  media: [{ gallery_media_id: String(file.id) }],
                  mediaFileName: file.name ?? "",
                }));
                setGalleryPickerOpen(false);
              }}
            />
          </div>
        </DialogContent>
      </Dialog>

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
                    {t("quick_replies_section.header_edit_collection")}
                  </DialogTitle>
                  <DialogDescription className={cn("text-[11px] font-medium opacity-60 mt-0.5", sub)}>
                    {t("quick_replies_section.edit_collection_modal_desc")}
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>

            <div className="space-y-4">
              <div className="space-y-2">
                <label className={labelCls}>{t("quick_replies_section.create_collection_name_label")}</label>
                <input
                  value={collectionForm.name}
                  onChange={(e) => setCollectionForm((p) => ({ ...p, name: e.target.value.slice(0, 80) }))}
                  placeholder={t("quick_replies_section.create_collection_name_placeholder")}
                  className={inputCls}
                />
              </div>
              <div className="space-y-2">
                <label className={labelCls}>{t("quick_replies_section.sharing_label")}</label>
                <select
                  value={collectionForm.share}
                  onChange={(e) =>
                    setCollectionForm((p) => ({ ...p, share: e.target.value as ShareValue }))
                  }
                  className={selectCls}
                >
                  <option value="private">{t("quick_replies_section.share_private_full")}</option>
                  <option value="public">{t("quick_replies_section.share_public_full")}</option>
                  <option value="users">{t("quick_replies_section.share_users")}</option>
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
                {t("quick_replies_section.cancel")}
              </button>
              <button
                onClick={() => handleSubmitCollection(() => setIsEditModalOpen(false))}
                disabled={groupMutation.isPending}
                className={primaryBtn}
              >
                {groupMutation.isPending && <Loader2 size={12} className="animate-spin" />}
                {t("quick_replies_section.save_changes")}
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
                  {t("quick_replies_section.delete_collection_title")}
                </h2>
                <p className={cn("text-[11px] font-medium opacity-60 mt-0.5 leading-relaxed", sub)}>
                  <span className="text-rose-500 font-black">
                    {collections.find((c) => c.id === currentCollectionId)?.name ?? t("quick_replies_section.delete_collection_fallback_name")}
                  </span>{" "}
                  {t("quick_replies_section.delete_collection_desc_suffix")}
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <AlertDialogCancel className={cn(outlineBtn, "m-0")}>{t("quick_replies_section.cancel")}</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDeleteCollection}
                className="h-11 px-7 rounded-xl bg-rose-500 hover:bg-rose-600 text-white text-[11px] font-semibold transition-all shadow-lg shadow-rose-500/20 flex items-center gap-2"
              >
                {deleteMutation.isPending ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                {t("quick_replies_section.delete_action")}
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
