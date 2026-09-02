import React, { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Film, Folder, Plus, Search, Grid, List, FileText,
  Image as ImageIcon, Mic, Video, UploadCloud, Check, X,
  Pencil, Trash2, Upload, AlertCircle, Download, Share2,
  MoreHorizontal, ArrowLeft, Filter, Loader2,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest, apiUploadWithProgress } from "@/lib/queryClient";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
} from "@/components/ui/alert-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useTheme } from "@/contexts/ThemeContext";

interface MediaGallerySectionProps {
  // May be async (the composer picker awaits a server-side download before
  // resolving) — awaited here so the item's Select button can show a
  // loading state instead of leaving the agent guessing whether the click
  // registered.
  onSelect?: (file: any) => void | Promise<void>;
}

export default function MediaGallerySection({ onSelect }: MediaGallerySectionProps) {
  const { mode } = useTheme();
  const dark = mode === "dark";
  const { toast } = useToast();
  const { t } = useTranslation();

  const card       = dark ? "bg-[#0f1829]"    : "bg-white";
  const border     = dark ? "border-slate-800" : "border-slate-200";
  const text       = dark ? "text-white"      : "text-slate-900";
  const sub        = dark ? "text-slate-500"  : "text-slate-400";
  const softBg     = dark ? "bg-slate-950/40" : "bg-slate-50/50";
  const softBorder = dark ? "border-slate-800" : "border-slate-100";

  const inputCls = cn(
    "h-11 rounded-xl text-[13px] font-bold transition-all px-4",
    "focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:border-primary/50",
    dark ? "bg-slate-950/50 border-slate-800 text-white" : "bg-white border-slate-200 text-slate-900"
  );

  const primaryBtn =
    "h-11 px-6 rounded-xl bg-primary hover:bg-primary/90 disabled:opacity-50 text-white text-[11px] font-semibold transition-all shadow-lg shadow-primary/20 flex items-center gap-2";

  const outlineBtn = cn(
    "h-10 px-4 rounded-xl border text-[11px] font-semibold transition-all flex items-center gap-2",
    dark ? "border-slate-800 text-slate-300 hover:border-primary/40 hover:text-primary" : "border-slate-200 text-slate-700 hover:border-primary/40 hover:text-primary"
  );

  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [filter, setFilter] = useState("All files");
  const [searchQuery, setSearchQuery] = useState("");
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [parentId, setParentId] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [uploadFileCount, setUploadFileCount] = useState<number>(0);
  const [uploadTotalBytes, setUploadTotalBytes] = useState<number>(0);

  const queryClient = useQueryClient();

  const { data: galleryData, isLoading } = useQuery({
    queryKey: ["/api/gallery/listings", { object_id: parentId }],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/gallery/listings${parentId ? `?object_id=${parentId}` : ""}`);
      return res.json();
    },
  });

  // Replyagent uses structured error codes (ACCESS_DENIED / SIZE_EXCEEDED /
  // COMPRESSED_BLOCKED / etc.) so the UI can show specific toasts. The
  // backend wraps the response under NestJS's `{statusCode, message}` envelope
  // when we throw with a structured payload — `ApiError.body` (set by
  // queryClient.ts) holds the parsed payload, including our `code`.
  const extractError = (err: any): { code?: string; message?: string } => {
    const body = err?.body ?? null;
    // NestJS HttpException wraps the structured payload under `message`,
    // so when we threw `{success, code, message}` the parsed body looks
    // like `{statusCode, message: {success, code, message}}`. Handle both
    // shapes.
    const inner = body?.message && typeof body.message === "object" ? body.message : body;
    if (inner && typeof inner === "object") {
      return { code: inner.code, message: inner.message ?? body?.message };
    }
    return { message: err?.message };
  };
  const errorToast = (err: any, fallbackTitle = t("media_gallery_section.error_title_default")) => {
    const { code, message } = extractError(err);
    const titleByCode: Record<string, string> = {
      ACCESS_DENIED: t("media_gallery_section.error_access_denied"),
      SIZE_EXCEEDED: t("media_gallery_section.error_size_exceeded"),
      COMPRESSED_BLOCKED: t("media_gallery_section.error_compressed_blocked"),
      INVALID_FILE_TYPE: t("media_gallery_section.error_invalid_file_type"),
      BATCH_LIMIT: t("media_gallery_section.error_batch_limit"),
      NAME_TOO_LONG: t("media_gallery_section.error_name_too_long"),
      NAME_REQUIRED: t("media_gallery_section.error_name_required"),
    };
    toast({
      title: code && titleByCode[code] ? titleByCode[code] : fallbackTitle,
      description: message ?? t("media_gallery_section.error_message_default"),
      variant: "destructive",
    });
  };

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => { await apiRequest("DELETE", `/api/gallery/media/${id}`); },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/gallery/listings"] });
      toast({ title: t("media_gallery_section.deleted_title"), description: t("media_gallery_section.deleted_description") });
    },
    onError: (err) => errorToast(err, t("media_gallery_section.delete_failed_title")),
  });

  const renameMutation = useMutation({
    mutationFn: async ({ id, newName }: { id: string; newName: string }) => {
      await apiRequest("PATCH", `/api/gallery/rename/${id}`, { object_name: newName });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/gallery/listings"] });
      toast({ title: t("media_gallery_section.renamed_title"), description: t("media_gallery_section.renamed_description") });
    },
    onError: (err) => errorToast(err, t("media_gallery_section.rename_failed_title")),
  });

  const createFolderMutation = useMutation({
    mutationFn: async (name: string) => {
      await apiRequest("POST", "/api/gallery/folder", { name, parent_id: parentId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/gallery/listings"] });
      toast({ title: t("media_gallery_section.created_title"), description: t("media_gallery_section.created_description") });
    },
    onError: (err) => errorToast(err, t("media_gallery_section.folder_create_failed_title")),
  });

  const uploadMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      await apiUploadWithProgress("POST", "/api/gallery/upload", formData, (percent) =>
        setUploadProgress(percent),
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/gallery/listings"] });
      toast({ title: t("media_gallery_section.uploaded_title"), description: t("media_gallery_section.uploaded_description") });
    },
    onError: (err) => errorToast(err, t("media_gallery_section.upload_failed_title")),
    onSettled: () => {
      setUploadProgress(0);
      setUploadFileCount(0);
      setUploadTotalBytes(0);
    },
  });

  const mediaItems = useMemo(() => {
    if (!galleryData) return [];
    const folders = (galleryData.folders || []).map((f: any) => ({
      id: f.object_id || f.id.toString(),
      name: f.object_name,
      type: "folder",
      media_type: "FOLDER",
      size: "—",
      url: "#",
    }));
    const files = (galleryData.file_folders?.data || []).map((f: any) => ({
      id: f.object_id || f.id.toString(),
      name: f.object_name,
      type: f.media_type?.toLowerCase() || "file",
      media_type: f.media_type?.toUpperCase() || "FILE",
      size: `${(f.file_size / 1024).toFixed(1)} KB`,
      url: f.file_url,
      // Server already swaps the stored S3 key for a 1h signed URL on
      // listing — prefer it for image grid rendering (200px instead of
      // full-res = faster + cheaper bandwidth).
      thumb: f.thumb_200 ?? null,
    }));
    return [...folders, ...files];
  }, [galleryData]);

  // Mirrors backend gallery.validation.ts so the user gets immediate
  // feedback instead of round-tripping to a 422. Keep these in lockstep
  // with SIZE_CAPS_MB / MAX_FILES_PER_UPLOAD on the server.
  const MAX_FILES = 10;
  const SIZE_MB: Record<string, number> = { IMAGE: 10, VIDEO: 15, AUDIO: 10, DOCUMENT: 10, FILE: 10 };
  const COMPRESSED = new Set(["zip", "rar", "7z", "tar", "gz", "bz2", "xz", "tgz", "tbz2"]);
  const EXT_KIND: Record<string, keyof typeof SIZE_MB> = {
    jpg: "IMAGE", jpeg: "IMAGE", png: "IMAGE", gif: "IMAGE", bmp: "IMAGE",
    tif: "IMAGE", tiff: "IMAGE", webp: "IMAGE",
    m4v: "VIDEO", avi: "VIDEO", mpeg: "VIDEO", mp4: "VIDEO", mkv: "VIDEO",
    webm: "VIDEO", flv: "VIDEO", wmv: "VIDEO", mov: "VIDEO",
    mp3: "AUDIO", wav: "AUDIO", aac: "AUDIO", ogg: "AUDIO", oga: "AUDIO", m4a: "AUDIO",
    doc: "DOCUMENT", docx: "DOCUMENT", pdf: "DOCUMENT", xls: "DOCUMENT",
    xlsx: "DOCUMENT", ppt: "DOCUMENT", pptx: "DOCUMENT", csv: "DOCUMENT",
    txt: "DOCUMENT", odt: "DOCUMENT", html: "DOCUMENT", htm: "DOCUMENT",
  };

  const KIND_LABEL: Record<string, string> = {
    IMAGE: t("media_gallery_section.kind_image"),
    VIDEO: t("media_gallery_section.kind_video"),
    AUDIO: t("media_gallery_section.kind_audio"),
    DOCUMENT: t("media_gallery_section.kind_document"),
    FILE: t("media_gallery_section.kind_file"),
  };

  const handleFileUpload = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const fileArr = Array.from(files);

    if (fileArr.length > MAX_FILES) {
      toast({
        title: t("media_gallery_section.error_batch_limit"),
        description: t("media_gallery_section.too_many_files_description", { max: MAX_FILES }),
        variant: "destructive",
      });
      return;
    }

    for (const file of fileArr) {
      const ext = (file.name.split(".").pop() ?? "").toLowerCase();
      if (!ext) {
        toast({ title: t("media_gallery_section.error_invalid_file_type"), description: t("media_gallery_section.no_extension_description", { name: file.name }), variant: "destructive" });
        return;
      }
      if (COMPRESSED.has(ext)) {
        toast({ title: t("media_gallery_section.error_compressed_blocked"), description: t("media_gallery_section.compressed_blocked_description", { name: file.name, ext }), variant: "destructive" });
        return;
      }
      const kind = EXT_KIND[ext];
      if (!kind) {
        toast({ title: t("media_gallery_section.error_invalid_file_type"), description: t("media_gallery_section.unsupported_file_description", { name: file.name, ext }), variant: "destructive" });
        return;
      }
      const cap = SIZE_MB[kind];
      if (file.size / (1024 * 1024) > cap) {
        toast({
          title: t("media_gallery_section.error_size_exceeded"),
          description: t("media_gallery_section.file_too_large_description", { name: file.name, cap, kind: KIND_LABEL[kind] }),
          variant: "destructive",
        });
        return;
      }
    }

    const formData = new FormData();
    if (parentId) formData.append("parent_id", parentId);
    fileArr.forEach((file) => formData.append("files", file));
    setUploadFileCount(fileArr.length);
    setUploadTotalBytes(fileArr.reduce((sum, f) => sum + f.size, 0));
    setUploadProgress(0);
    uploadMutation.mutate(formData, {
      onSettled: () => setUploadDialogOpen(false),
    });
  };

  // Download via the server-mediated endpoint so the browser always saves
  // (rather than potentially opening inline from a signed URL).
  const downloadObject = (objectId: string, filename: string) => {
    const a = document.createElement("a");
    a.href = `/api/gallery/download/${objectId}`;
    a.download = filename;
    a.target = "_blank";
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const filteredMedia = mediaItems.filter((item: any) => {
    const matchesFilter =
      filter === "All files" ||
      (filter === "Audios" && item.media_type === "AUDIO") ||
      (filter === "Images" && item.media_type === "IMAGE") ||
      (filter === "Files" && (item.media_type === "PDF" || item.media_type === "DOCUMENT" || item.media_type === "FILE")) ||
      (filter === "Videos" && item.media_type === "VIDEO") ||
      (filter === "Folders" && item.media_type === "FOLDER");
    return matchesFilter && item.name?.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const getIcon = (type: string, size = "w-8 h-8") => {
    const t = type?.toUpperCase();
    switch (t) {
      case "AUDIO":  return <Mic className={cn(size, "text-emerald-500")} />;
      case "PDF":    return <FileText className={cn(size, "text-rose-500")} />;
      case "IMAGE":  return <ImageIcon className={cn(size, "text-blue-500")} />;
      case "VIDEO":  return <Video className={cn(size, "text-amber-500")} />;
      case "FOLDER": return <Folder className={cn(size, "text-primary fill-primary/20")} />;
      default:       return <FileText className={cn(size, "text-slate-400")} />;
    }
  };

  return (
    <>
    <Card className={cn("rounded-[2rem] border overflow-hidden shadow-sm transition-all duration-300", card, border)}>
      <CardContent className="p-0">
        {/* Header */}
        <div className={cn("px-8 py-5 border-b flex items-center justify-between", border)}>
          <div className="flex items-center gap-4">
            <div className={cn("p-2.5 rounded-xl shadow-sm", dark ? "bg-primary/15" : "bg-primary/10")}>
              <Film className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className={cn("text-[16px] font-bold tracking-tight", text)}>{t("media_gallery_section.title")}</h1>
              <p className={cn("text-[11px] font-medium mt-0.5 opacity-60", sub)}>
                {t("media_gallery_section.subtitle")}
              </p>
            </div>
          </div>
          <button onClick={() => setUploadDialogOpen(true)} className={primaryBtn}>
            <Upload size={12} /> {t("media_gallery_section.upload")}
          </button>
        </div>

        {/* Toolbar */}
        <div className={cn("px-6 py-4 border-b flex flex-col md:flex-row md:items-center justify-between gap-3", softBorder)}>
            <div className="flex items-center gap-3 flex-wrap">
              {parentId ? (
                <button onClick={() => setParentId(null)} className={outlineBtn}>
                  <ArrowLeft size={12} /> {t("media_gallery_section.back")}
                </button>
              ) : (
                <div className="flex items-center gap-2 px-3 h-10">
                  <Folder size={14} className="text-primary" />
                  <span className={cn("text-[12px] font-semibold", sub)}>{t("media_gallery_section.root")}</span>
                </div>
              )}

              {isCreatingFolder ? (
                <div className="flex items-center gap-2 animate-in slide-in-from-left-2 duration-200">
                  <Input
                    autoFocus
                    value={newFolderName}
                    placeholder={t("media_gallery_section.folder_name_placeholder")}
                    maxLength={100}
                    className={cn(inputCls, "h-10 w-44")}
                    onChange={(e) => setNewFolderName(e.target.value.slice(0, 100))}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && newFolderName.trim()) {
                        createFolderMutation.mutate(newFolderName.trim());
                        setNewFolderName("");
                        setIsCreatingFolder(false);
                      } else if (e.key === "Escape") {
                        setNewFolderName("");
                        setIsCreatingFolder(false);
                      }
                    }}
                  />
                  <button
                    onClick={() => {
                      if (newFolderName.trim()) {
                        createFolderMutation.mutate(newFolderName.trim());
                        setNewFolderName("");
                        setIsCreatingFolder(false);
                      }
                    }}
                    className="h-10 w-10 rounded-xl bg-primary hover:bg-primary/90 text-white flex items-center justify-center transition-all shadow-md shadow-primary/20"
                  >
                    <Check size={14} />
                  </button>
                  <button
                    onClick={() => { setIsCreatingFolder(false); setNewFolderName(""); }}
                    className={cn("h-10 w-10 rounded-xl border flex items-center justify-center", softBorder, dark ? "text-slate-400 hover:text-white" : "text-slate-500 hover:text-slate-900")}
                  >
                    <X size={14} />
                  </button>
                </div>
              ) : (
                <button onClick={() => setIsCreatingFolder(true)} className={outlineBtn}>
                  <Plus size={12} /> {t("media_gallery_section.new_folder")}
                </button>
              )}
            </div>

            <div className="flex items-center gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                <Input
                  placeholder={t("media_gallery_section.search_placeholder")}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className={cn(inputCls, "pl-9 h-10 w-56")}
                />
              </div>

              <div className="flex items-center gap-1 p-1 rounded-xl border" style={{ borderColor: dark ? "rgb(30 41 59)" : "rgb(226 232 240)" }}>
                {[
                  { v: "grid" as const, icon: Grid },
                  { v: "list" as const, icon: List },
                ].map((m) => (
                  <button
                    key={m.v}
                    onClick={() => setViewMode(m.v)}
                    className={cn(
                      "w-8 h-8 rounded-lg flex items-center justify-center transition-all",
                      viewMode === m.v
                        ? "bg-primary text-white shadow-md shadow-primary/20"
                        : dark ? "text-slate-500 hover:text-primary" : "text-slate-500 hover:text-primary"
                    )}
                  >
                    <m.icon size={14} />
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Filter Pills */}
          <div className={cn("px-6 py-3 border-b flex items-center gap-2 overflow-x-auto", softBorder)}>
            <Filter size={12} className="text-slate-400 shrink-0" />
            {[
              { value: "All files", label: t("media_gallery_section.filter_all_files") },
              { value: "Folders", label: t("media_gallery_section.filter_folders") },
              { value: "Images", label: t("media_gallery_section.filter_images") },
              { value: "Videos", label: t("media_gallery_section.filter_videos") },
              { value: "Audios", label: t("media_gallery_section.filter_audios") },
              { value: "Files", label: t("media_gallery_section.filter_files") },
            ].map((f) => {
              const active = filter === f.value;
              return (
                <button
                  key={f.value}
                  onClick={() => setFilter(f.value)}
                  className={cn(
                    "h-8 px-3 rounded-lg text-[11px] font-semibold transition-all whitespace-nowrap",
                    active
                      ? "bg-primary/10 text-primary"
                      : dark ? "text-slate-500 hover:text-primary hover:bg-slate-900/40" : "text-slate-500 hover:text-primary hover:bg-slate-100/60"
                  )}
                >
                  {f.label}
                </button>
              );
            })}
          </div>

          {/* Body */}
          <div className="p-6 min-h-[400px]">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center h-64 gap-3">
                <Loader2 className="w-7 h-7 animate-spin text-primary" />
                <p className={cn("text-[11px] font-bold opacity-60", sub)}>{t("media_gallery_section.loading_files")}</p>
              </div>
            ) : filteredMedia.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center space-y-4">
                <div className="w-14 h-14 bg-primary/10 rounded-2xl flex items-center justify-center">
                  <Film className="w-6 h-6 text-primary" />
                </div>
                <div className="space-y-1">
                  <p className={cn("text-[14px] font-semibold", text)}>{t("media_gallery_section.no_files_found_title")}</p>
                  <p className={cn("text-[11px] font-medium opacity-60 max-w-xs", sub)}>
                    {t("media_gallery_section.no_files_found_subtitle")}
                  </p>
                </div>
                <button onClick={() => setUploadDialogOpen(true)} className={primaryBtn}>
                  <Upload size={12} /> {t("media_gallery_section.upload_file")}
                </button>
              </div>
            ) : viewMode === "grid" ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                {filteredMedia.map((item: any) => (
                  <div
                    key={item.id}
                    onClick={() => {
                      if (item.type === "folder") setParentId(item.id);
                      else if (onSelect) onSelect(item);
                    }}
                    className="group relative flex flex-col gap-2 cursor-pointer"
                  >
                    <div className={cn(
                      "aspect-square rounded-[1.25rem] border overflow-hidden transition-all relative",
                      "group-hover:shadow-md group-hover:border-primary/40",
                      softBg,
                      softBorder
                    )}>
                      {item.media_type === "IMAGE" && (item.thumb || item.url) && item.url !== "#" ? (
                        <img
                          src={item.thumb ?? item.url}
                          alt={item.name}
                          loading="lazy"
                          className="absolute inset-0 w-full h-full object-cover"
                          onError={(e) => {
                            (e.currentTarget as HTMLImageElement).style.display = "none";
                          }}
                        />
                      ) : item.media_type === "VIDEO" && item.url && item.url !== "#" ? (
                        <video
                          src={item.url}
                          preload="metadata"
                          muted
                          className="absolute inset-0 w-full h-full object-cover"
                        />
                      ) : null}
                      <div className={cn(
                        "absolute inset-0 flex items-center justify-center",
                        (item.media_type === "IMAGE" || item.media_type === "VIDEO") && item.url && item.url !== "#" ? "pointer-events-none" : ""
                      )}>
                        {!(item.media_type === "IMAGE" && item.url && item.url !== "#") &&
                          !(item.media_type === "VIDEO" && item.url && item.url !== "#") &&
                          getIcon(item.type, "w-10 h-10")}
                      </div>

                      {/* Hover overlay — clicking anywhere on the tile itself
                          selects/opens it (the outer div's onClick); this is
                          just the "..." menu for secondary actions, sitting
                          on top of the media itself — not a full tint over
                          the thumbnail. */}
                      <div className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        {item.type !== "folder" && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button
                                onClick={(e) => e.stopPropagation()}
                                className="w-8 h-8 rounded-lg bg-white text-primary flex items-center justify-center hover:scale-110 transition-transform shadow-md"
                              >
                                <MoreHorizontal size={14} strokeWidth={2.5} />
                              </button>
                            </DropdownMenuTrigger>
                            {/* z-[70]: this component now also renders inside
                                the composer's Media Gallery Dialog (z-[60]) —
                                the base DropdownMenu z-50 would render behind
                                it, same issue fixed earlier for the country
                                picker inside the Add Contact dialog. */}
                            <DropdownMenuContent className={cn("rounded-xl p-1.5 min-w-[140px] z-[70]", dark ? "bg-[#0f1829] border-slate-800" : "")}>
                              <DropdownMenuItem
                                className="rounded-lg py-2 cursor-pointer gap-2 font-bold text-[11px]"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  downloadObject(item.id, item.name);
                                }}
                              >
                                <Download size={12} /> {t("media_gallery_section.download")}
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="rounded-lg py-2 cursor-pointer gap-2 font-bold text-[11px]"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  navigator.clipboard.writeText(item.url);
                                  toast({ title: t("media_gallery_section.copied_title"), description: t("media_gallery_section.copied_description") });
                                }}
                              >
                                <Share2 size={12} /> {t("media_gallery_section.share")}
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="rounded-lg py-2 cursor-pointer gap-2 font-bold text-[11px]"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setRenamingId(item.id);
                                  setRenameValue(item.name);
                                }}
                              >
                                <Pencil size={12} /> {t("media_gallery_section.rename")}
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="rounded-lg py-2 cursor-pointer gap-2 font-bold text-[11px] text-rose-500"
                                onClick={(e) => { e.stopPropagation(); setDeleteId(item.id); }}
                              >
                                <Trash2 size={12} /> {t("media_gallery_section.delete")}
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </div>
                    </div>

                    <div className="px-1 space-y-1">
                      <p className={cn("text-[12px] font-black truncate", text)}>{item.name}</p>
                      <div className="flex items-center justify-between gap-1">
                        <Badge variant="outline" className="h-4 px-1.5 rounded-md border-primary/20 bg-primary/5 text-primary text-[8px] font-black uppercase tracking-tight">
                          {item.media_type}
                        </Badge>
                        <span className={cn("text-[10px] font-bold opacity-40", sub)}>{item.size}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className={cn("rounded-[1.5rem] border overflow-hidden", softBorder, softBg)}>
                <Table>
                  <TableHeader>
                    <TableRow className={cn("border-b hover:bg-transparent", softBorder)}>
                      <TableHead className={cn("py-4 px-6 text-[11px] font-semibold", sub)}>{t("media_gallery_section.table_name")}</TableHead>
                      <TableHead className={cn("py-4 px-6 text-[11px] font-semibold", sub)}>{t("media_gallery_section.table_type")}</TableHead>
                      <TableHead className={cn("py-4 px-6 text-[11px] font-semibold", sub)}>{t("media_gallery_section.table_size")}</TableHead>
                      <TableHead className={cn("py-4 px-6 text-[11px] font-semibold text-right", sub)}>{t("media_gallery_section.table_actions")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredMedia.map((item: any) => (
                      <TableRow
                        key={item.id}
                        className={cn("group border-b last:border-0 transition-colors cursor-pointer", softBorder, dark ? "hover:bg-slate-900/40" : "hover:bg-white/60")}
                        onClick={() => { if (item.type === "folder") setParentId(item.id); }}
                      >
                        <TableCell className="py-3 px-6">
                          <div className="flex items-center gap-3">
                            <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center overflow-hidden", dark ? "bg-slate-900/60" : "bg-white")}>
                              {item.media_type === "IMAGE" && (item.thumb || item.url) && item.url !== "#" ? (
                                <img
                                  src={item.thumb ?? item.url}
                                  alt={item.name}
                                  loading="lazy"
                                  className="w-full h-full object-cover"
                                  onError={(e) => {
                                    (e.currentTarget as HTMLImageElement).style.display = "none";
                                  }}
                                />
                              ) : (
                                getIcon(item.type, "w-4 h-4")
                              )}
                            </div>
                            <span className={cn("text-[12px] font-black truncate", text)}>{item.name}</span>
                          </div>
                        </TableCell>
                        <TableCell className="py-3 px-6">
                          <Badge variant="outline" className="h-5 px-2 rounded-md border-primary/20 bg-primary/5 text-primary text-[10px] font-semibold">
                            {item.media_type}
                          </Badge>
                        </TableCell>
                        <TableCell className={cn("py-3 px-6 text-[11px] font-bold opacity-60", sub)}>{item.size}</TableCell>
                        <TableCell className="py-3 px-6 text-right">
                          <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            {item.type !== "folder" && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  downloadObject(item.id, item.name);
                                }}
                                className={cn("w-8 h-8 rounded-lg flex items-center justify-center transition-all", dark ? "hover:bg-primary/10 text-slate-400 hover:text-primary" : "hover:bg-primary/10 text-slate-500 hover:text-primary")}
                              >
                                <Download size={12} />
                              </button>
                            )}
                            <button
                              onClick={(e) => { e.stopPropagation(); setRenamingId(item.id); setRenameValue(item.name); }}
                              className={cn("w-8 h-8 rounded-lg flex items-center justify-center transition-all", dark ? "hover:bg-primary/10 text-slate-400 hover:text-primary" : "hover:bg-primary/10 text-slate-500 hover:text-primary")}
                            >
                              <Pencil size={12} />
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); setDeleteId(item.id); }}
                              className={cn("w-8 h-8 rounded-lg flex items-center justify-center transition-all", dark ? "hover:bg-rose-500/10 text-slate-400 hover:text-rose-500" : "hover:bg-rose-500/10 text-slate-500 hover:text-rose-500")}
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Rename Dialog */}
      <AlertDialog open={renamingId !== null} onOpenChange={(open) => !open && setRenamingId(null)}>
        <AlertDialogContent className={cn("rounded-[2rem] border p-0 max-w-md overflow-hidden", card, border)}>
          <div className="p-6 space-y-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                <Pencil size={16} />
              </div>
              <div>
                <h2 className={cn("text-[14px] font-semibold", text)}>{t("media_gallery_section.rename_dialog_title")}</h2>
                <p className={cn("text-[11px] font-medium opacity-60 mt-0.5", sub)}>{t("media_gallery_section.rename_dialog_subtitle")}</p>
              </div>
            </div>
            <Input
              autoFocus
              value={renameValue}
              maxLength={100}
              onChange={(e) => setRenameValue(e.target.value.slice(0, 100))}
              className={inputCls}
            />
            <div className="flex justify-end gap-2">
              <AlertDialogCancel className={cn(outlineBtn, "m-0")}>{t("media_gallery_section.cancel")}</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  if (renamingId && renameValue.trim()) renameMutation.mutate({ id: renamingId, newName: renameValue.trim() });
                  setRenamingId(null);
                }}
                className={primaryBtn}
              >
                {t("media_gallery_section.save")}
              </AlertDialogAction>
            </div>
          </div>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Dialog */}
      <AlertDialog open={deleteId !== null} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent className={cn("rounded-[2rem] border p-0 max-w-md overflow-hidden", card, border)}>
          <div className="p-6 space-y-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-500/10 flex items-center justify-center text-rose-500">
                <AlertCircle size={18} />
              </div>
              <div>
                <h2 className={cn("text-[14px] font-semibold", text)}>{t("media_gallery_section.delete_dialog_title")}</h2>
                <p className={cn("text-[11px] font-medium opacity-60 mt-0.5 leading-relaxed", sub)}>
                  {t("media_gallery_section.delete_dialog_description")}
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <AlertDialogCancel className={cn(outlineBtn, "m-0")}>{t("media_gallery_section.cancel")}</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => { if (deleteId) deleteMutation.mutate(deleteId); setDeleteId(null); }}
                className="h-11 px-7 rounded-xl bg-rose-500 hover:bg-rose-600 text-white text-[11px] font-semibold transition-all shadow-lg shadow-rose-500/20 flex items-center gap-2"
              >
                <Trash2 size={12} /> {t("media_gallery_section.delete")}
              </AlertDialogAction>
            </div>
          </div>
        </AlertDialogContent>
      </AlertDialog>

      {/* Upload Dialog */}
      <AlertDialog
        open={uploadDialogOpen}
        onOpenChange={(open) => {
          // Block close while an upload is running so the user sees progress through.
          if (!uploadMutation.isPending) setUploadDialogOpen(open);
        }}
      >
        <AlertDialogContent className={cn("rounded-[2rem] border p-0 max-w-lg overflow-hidden", card, border)}>
          <div className="p-6 space-y-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                  <UploadCloud size={16} />
                </div>
                <div>
                  <h2 className={cn("text-[14px] font-semibold", text)}>
                    {uploadMutation.isPending ? t("media_gallery_section.upload_dialog_title_uploading") : t("media_gallery_section.upload_dialog_title_default")}
                  </h2>
                  <p className={cn("text-[11px] font-medium opacity-60 mt-0.5", sub)}>
                    {uploadMutation.isPending
                      ? `${t("media_gallery_section.file_count", { count: uploadFileCount })} • ${t("media_gallery_section.mb_total", { mb: (uploadTotalBytes / (1024 * 1024)).toFixed(1) })}`
                      : t("media_gallery_section.upload_dialog_subtitle_default")}
                  </p>
                </div>
              </div>
              {!uploadMutation.isPending && (
                <button
                  onClick={() => setUploadDialogOpen(false)}
                  className={cn("w-8 h-8 rounded-lg flex items-center justify-center transition-all", dark ? "hover:bg-slate-900 text-slate-400" : "hover:bg-slate-100 text-slate-500")}
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {uploadMutation.isPending ? (
              <div className={cn("rounded-[1.5rem] border p-8 flex flex-col items-center text-center gap-4", softBg, softBorder)}>
                <Loader2 className="w-10 h-10 text-primary animate-spin" />
                <div className="w-full space-y-2">
                  <div className="flex items-center justify-between">
                    <span className={cn("text-[12px] font-semibold", text)}>
                      {uploadProgress < 100 ? t("media_gallery_section.uploading_status") : t("media_gallery_section.finalizing_status")}
                    </span>
                    <span className={cn("text-[13px] font-black", "text-primary")}>{uploadProgress}%</span>
                  </div>
                  <div className={cn("w-full h-2 rounded-full overflow-hidden", dark ? "bg-slate-800" : "bg-slate-200")}>
                    <div
                      className="h-full bg-primary rounded-full transition-all duration-150 ease-out"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                  <p className={cn("text-[10px] font-medium opacity-60", sub)}>
                    {uploadProgress < 100
                      ? t("media_gallery_section.progress_bytes", { done: ((uploadProgress / 100) * uploadTotalBytes / (1024 * 1024)).toFixed(1), total: (uploadTotalBytes / (1024 * 1024)).toFixed(1) })
                      : t("media_gallery_section.saving_to_storage")}
                  </p>
                </div>
              </div>
            ) : (
              <div
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(e) => { e.preventDefault(); setIsDragging(false); handleFileUpload(e.dataTransfer.files); }}
                className={cn(
                  "border-2 border-dashed rounded-[1.5rem] p-10 transition-all flex flex-col items-center text-center gap-3 relative cursor-pointer",
                  isDragging
                    ? "bg-primary/10 border-primary"
                    : cn(softBg, "border-slate-300 dark:border-slate-700 hover:border-primary/50")
                )}
              >
                <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                  <Upload size={20} strokeWidth={2.5} />
                </div>
                <div>
                  <p className={cn("text-[13px] font-semibold", text)}>{t("media_gallery_section.drop_files_here")}</p>
                  <p className={cn("text-[11px] font-medium opacity-60 mt-1", sub)}>
                    {t("media_gallery_section.browse_prefix")} <span className="text-primary font-black">{t("media_gallery_section.browse_word")}</span> {t("media_gallery_section.browse_suffix")}
                  </p>
                </div>
                <input
                  type="file"
                  multiple
                  className="absolute inset-0 opacity-0 cursor-pointer"
                  onChange={(e) => handleFileUpload(e.target.files)}
                />
              </div>
            )}

            {!uploadMutation.isPending && (
              <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-500/10 border border-amber-500/20">
                <AlertCircle size={14} className="text-amber-500 shrink-0 mt-0.5" />
                <div className="text-[11px] font-medium text-amber-700 dark:text-amber-400 leading-relaxed space-y-0.5">
                  <p>
                    {t("media_gallery_section.limits_prefix")} <span className="font-black">{t("media_gallery_section.limits_files_bold")}</span> {t("media_gallery_section.limits_suffix")}
                  </p>
                  <p>
                    {t("media_gallery_section.limits_image")} <span className="font-black">10 MB</span> · {t("media_gallery_section.limits_video")} <span className="font-black">15 MB</span> · {t("media_gallery_section.limits_audio")} <span className="font-black">10 MB</span> · {t("media_gallery_section.limits_document")} <span className="font-black">10 MB</span>
                  </p>
                </div>
              </div>
            )}
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
