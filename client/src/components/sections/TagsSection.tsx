import { useState, useMemo } from "react";
import {
  Search,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Trash2,
  Edit2,
} from "react-feather";
import {
  ChevronsUpDown,
  ChevronDown,
  ChevronUp,
  Plus,
  MoreVertical,
  Loader2,
  Tag as TagIcon,
  AlertCircle,
  Folder,
  FolderPlus,
  Eye,
  EyeOff,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { cn } from "@/lib/utils";
import { useTheme } from "@/contexts/ThemeContext";
import { formatInWorkspaceTz, useWorkspaceTimezone } from "@/contexts/WorkspaceTimezoneContext";

// Replyagent's `for` filter: which entity a tag is scoped to. Backend
// translates these to Laravel namespace paths under the hood.
type TagFor = "" | "WORKSPACE" | "CONTACT" | "COMPANY" | "OPPORTUNITY";

interface Tag {
  id: string;
  name: string;
  bgColor: string;
  textColor: string;
  displayInbox: boolean;
  folderId: string | null;
  taggableType: string;
  lastEdited: string;
}

interface TagFolder {
  id: string;
  name: string;
}

// Default palette — replyagent's defaults plus a small curated set so the
// color picker isn't an empty hex input. Users can still type any hex.
const TAG_PRESETS: { bg: string; text: string }[] = [
  { bg: "#f3f4f6", text: "#111827" },
  { bg: "#fee2e2", text: "#991b1b" },
  { bg: "#fef3c7", text: "#92400e" },
  { bg: "#dcfce7", text: "#166534" },
  { bg: "#dbeafe", text: "#1e40af" },
  { bg: "#ede9fe", text: "#5b21b6" },
  { bg: "#fce7f3", text: "#9f1239" },
  { bg: "#cffafe", text: "#155e75" },
];

export default function TagsSection() {
  const { mode } = useTheme();
  const dark = mode === "dark";
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const workspaceTz = useWorkspaceTimezone();

  // ── Filter / sort / pagination state ─────────────────────────────
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [sort, setSort] = useState<{ column: string; direction: "asc" | "desc" } | null>(null);
  const [forFilter, setForFilter] = useState<TagFor>("");
  const [folderFilter, setFolderFilter] = useState<string>("ALL"); // 'ALL' | 'root' | folder id

  // ── Dialog state ─────────────────────────────────────────────────
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingItem, setEditingItem] = useState<Tag | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<Tag | null>(null);
  const [showFolderModal, setShowFolderModal] = useState(false);
  const [folderName, setFolderName] = useState("");
  const [editingFolder, setEditingFolder] = useState<TagFolder | null>(null);

  // ── Tag form state ──────────────────────────────────────────────
  const emptyForm = {
    name: "",
    bgColor: TAG_PRESETS[0].bg,
    textColor: TAG_PRESETS[0].text,
    displayInbox: true,
    folderId: "" as string,
    taggableFor: "WORKSPACE" as Exclude<TagFor, "">,
  };
  const [form, setForm] = useState(emptyForm);

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

  // ── Queries ──────────────────────────────────────────────────────
  const { data: tagsData, isLoading } = useQuery<any>({
    queryKey: ["/api/tags/data", forFilter, folderFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (folderFilter && folderFilter !== "ALL") params.set("folder_id", folderFilter);
      else params.set("folder_id", "ALL");
      const url = `/api/tags/data?${params.toString()}`;
      const res = await apiRequest("GET", url);
      return res.json();
    },
  });

  const allTags: Tag[] = useMemo(() => {
    const rows: any[] = tagsData?.tags ?? [];
    return rows
      .filter((t) => {
        // Frontend-side `for` filter — backend `data` endpoint doesn't accept
        // it (mirrors replyagent's behavior where the filter is applied to
        // the cached list). Drop tags whose taggable_type doesn't match.
        if (!forFilter) return true;
        const map: Record<Exclude<TagFor, "">, string> = {
          WORKSPACE: "App\\Models\\Workspace",
          CONTACT: "App\\Models\\Contact",
          COMPANY: "App\\Models\\Company",
          OPPORTUNITY: "App\\Models\\Pipeline\\Opportunity",
        };
        return t.taggable_type === map[forFilter];
      })
      .map((t) => ({
        id: t.id.toString(),
        name: t.name,
        bgColor: t.bg_color ?? "#f3f4f6",
        textColor: t.text_color ?? "#111827",
        displayInbox: Number(t.display_inbox ?? 1) === 1,
        folderId: t.folder_id != null ? String(t.folder_id) : null,
        taggableType: t.taggable_type,
        lastEdited: t.updated_at
          ? formatInWorkspaceTz(t.updated_at, "yyyy-MM-dd", workspaceTz)
          : t.created_at
            ? formatInWorkspaceTz(t.created_at, "yyyy-MM-dd", workspaceTz)
            : "-",
      }));
  }, [tagsData, forFilter, workspaceTz]);

  const folders: TagFolder[] = useMemo(() => {
    return (tagsData?.folders ?? []).map((f: any) => ({
      id: String(f.id),
      name: f.name,
    }));
  }, [tagsData]);

  // ── Mutations ────────────────────────────────────────────────────
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/tags/data"] });
    queryClient.invalidateQueries({ queryKey: ["/api/tags/list"] });
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/tags", {
        name: form.name.trim(),
        bg_color: form.bgColor,
        text_color: form.textColor,
        display_inbox: form.displayInbox,
        folder_id: form.folderId || null,
        taggable_type:
          form.taggableFor === "WORKSPACE"
            ? "App\\Models\\Workspace"
            : form.taggableFor === "CONTACT"
              ? "App\\Models\\Contact"
              : form.taggableFor === "COMPANY"
                ? "App\\Models\\Company"
                : "App\\Models\\Pipeline\\Opportunity",
      });
      return res.json();
    },
    onSuccess: () => {
      invalidate();
      toast({ title: "Tag created" });
      setShowCreateModal(false);
      setForm(emptyForm);
    },
    onError: (e: any) => toast({ title: "Error", description: e?.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!editingItem) throw new Error("No tag selected");
      const res = await apiRequest("PATCH", `/api/tags/${editingItem.id}`, {
        name: form.name.trim(),
        bg_color: form.bgColor,
        text_color: form.textColor,
        display_inbox: form.displayInbox,
        folder_id: form.folderId || null,
      });
      return res.json();
    },
    onSuccess: () => {
      invalidate();
      toast({ title: "Tag updated" });
      setShowEditModal(false);
      setEditingItem(null);
      setForm(emptyForm);
    },
    onError: (e: any) => toast({ title: "Error", description: e?.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/tags/${id}`);
    },
    onSuccess: () => {
      invalidate();
      toast({ title: "Tag deleted" });
      setShowDeleteModal(false);
      setItemToDelete(null);
    },
    onError: (e: any) => toast({ title: "Error", description: e?.message, variant: "destructive" }),
  });

  const folderMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/tags/folder", {
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
    onError: (e: any) => toast({ title: "Error", description: e?.message, variant: "destructive" }),
  });

  const deleteFolderMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/tags/folder/${id}`);
    },
    onSuccess: () => {
      invalidate();
      toast({ title: "Folder deleted" });
      // Reset the folder filter if we just deleted the active folder.
      setFolderFilter((cur) => (cur === itemToDelete?.id ? "ALL" : cur));
    },
    onError: (e: any) => toast({ title: "Error", description: e?.message, variant: "destructive" }),
  });

  // ── Handlers ─────────────────────────────────────────────────────
  const handleColumnSort = (column: string) => {
    if (sort?.column === column) {
      if (sort.direction === "asc") setSort({ column, direction: "desc" });
      else setSort(null);
    } else {
      setSort({ column, direction: "asc" });
    }
  };

  const renderSortIcon = (column: string) => {
    const isActive = sort?.column === column;
    if (!isActive) return <ChevronsUpDown size={12} className="opacity-40" />;
    if (sort?.direction === "asc") return <ChevronUp size={12} className="text-primary" />;
    return <ChevronDown size={12} className="text-primary" />;
  };

  const filteredAndSorted = useMemo(() => {
    let data = [...allTags];
    if (search) data = data.filter((i) => i.name.toLowerCase().includes(search.toLowerCase()));
    if (sort) {
      data.sort((a, b) => {
        const aVal = (a as any)[sort.column];
        const bVal = (b as any)[sort.column];
        let cmp = 0;
        if (typeof aVal === "string" && typeof bVal === "string") cmp = aVal.localeCompare(bVal);
        return sort.direction === "asc" ? cmp : -cmp;
      });
    }
    return data;
  }, [allTags, search, sort]);

  const totalFilteredItems = filteredAndSorted.length;
  const totalPages = Math.max(1, Math.ceil(totalFilteredItems / rowsPerPage));
  const paginatedData = filteredAndSorted.slice((page - 1) * rowsPerPage, page * rowsPerPage);

  const openEdit = (item: Tag) => {
    setEditingItem(item);
    setForm({
      name: item.name,
      bgColor: item.bgColor,
      textColor: item.textColor,
      displayInbox: item.displayInbox,
      folderId: item.folderId ?? "",
      taggableFor:
        item.taggableType === "App\\Models\\Contact"
          ? "CONTACT"
          : item.taggableType === "App\\Models\\Company"
            ? "COMPANY"
            : item.taggableType === "App\\Models\\Pipeline\\Opportunity"
              ? "OPPORTUNITY"
              : "WORKSPACE",
    });
    setShowEditModal(true);
  };

  const openCreate = () => {
    setForm({
      ...emptyForm,
      folderId: folderFilter !== "ALL" && folderFilter !== "root" ? folderFilter : "",
    });
    setShowCreateModal(true);
  };

  const submitCreate = () => {
    if (!form.name.trim()) {
      toast({ title: "Missing name", description: "Please enter a tag name.", variant: "destructive" });
      return;
    }
    createMutation.mutate();
  };

  const submitUpdate = () => {
    if (!form.name.trim()) {
      toast({ title: "Missing name", description: "Please enter a tag name.", variant: "destructive" });
      return;
    }
    updateMutation.mutate();
  };

  const thCls = cn("px-6 py-4 text-left text-[11px] font-semibold cursor-pointer select-none", sub);

  // Color picker: small grid of presets + free hex inputs.
  const ColorPicker = ({
    label,
    value,
    onChange,
    presetKey,
  }: {
    label: string;
    value: string;
    onChange: (v: string) => void;
    presetKey: "bg" | "text";
  }) => (
    <div className="space-y-2">
      <label className={labelCls}>{label}</label>
      <div className="flex items-center gap-2 flex-wrap">
        {TAG_PRESETS.map((p) => (
          <button
            key={p[presetKey]}
            type="button"
            onClick={() => onChange(p[presetKey])}
            className={cn(
              "w-7 h-7 rounded-lg border-2 transition-all",
              value === p[presetKey] ? "border-primary scale-110" : "border-transparent",
            )}
            style={{ backgroundColor: p[presetKey] }}
            aria-label={`Pick ${p[presetKey]}`}
          />
        ))}
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          maxLength={9}
          className={cn(inputCls, "w-28 h-9 text-[11px] font-mono")}
          placeholder="#000000"
        />
      </div>
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
                <TagIcon className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h1 className={cn("text-[16px] font-bold tracking-tight", text)}>Tags</h1>
                <p className={cn("text-[11px] font-bold mt-0.5 opacity-60 max-w-2xl", sub)}>
                  Create tags to categorize your conversations.
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
              <button onClick={openCreate} className={primaryOutlineBtn}>
                <Plus size={12} /> Add Tag
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="p-8 space-y-5">
            {/* Filters */}
            <div className="flex items-center gap-3 flex-wrap">
              <div className="relative flex-1 min-w-[200px] max-w-xs">
                <Search className={cn("absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4", sub)} />
                <input
                  type="text"
                  placeholder="Search tags..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className={cn(inputCls, "pl-11")}
                />
              </div>
              <select
                value={forFilter}
                onChange={(e) => setForFilter(e.target.value as TagFor)}
                className={cn(selectCls, "max-w-[180px]")}
              >
                <option value="">All entities</option>
                <option value="WORKSPACE">Workspace</option>
                <option value="CONTACT">Contact</option>
                <option value="COMPANY">Company</option>
                <option value="OPPORTUNITY">Opportunity</option>
              </select>
              <div className="flex items-center gap-1">
                <select
                  value={folderFilter}
                  onChange={(e) => setFolderFilter(e.target.value)}
                  className={cn(selectCls, "max-w-[200px]")}
                >
                  <option value="ALL">All folders</option>
                  <option value="root">Root (no folder)</option>
                  {folders.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
                </select>
                {folderFilter !== "ALL" && folderFilter !== "root" && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className={cn("w-10 h-11 rounded-xl border flex items-center justify-center", softBorder, sub, "hover:text-primary hover:border-primary/40")}>
                        <MoreVertical size={14} />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className={cn("rounded-xl border p-1.5 w-40", card, border)}>
                      <DropdownMenuItem
                        onClick={() => {
                          const f = folders.find((x) => x.id === folderFilter);
                          if (!f) return;
                          setEditingFolder(f);
                          setFolderName(f.name);
                          setShowFolderModal(true);
                        }}
                        className="rounded-lg text-[12px] font-bold py-2 px-3 flex gap-2 cursor-pointer"
                      >
                        <Edit2 size={13} /> Rename
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => {
                          if (confirm("Delete this folder? It must be empty.")) {
                            deleteFolderMutation.mutate(folderFilter);
                          }
                        }}
                        className="rounded-lg text-[12px] font-bold py-2 px-3 flex gap-2 cursor-pointer text-rose-500 focus:text-rose-500 focus:bg-rose-500/10"
                      >
                        <Trash2 size={13} /> Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
            </div>

            {/* Table */}
            <div className={cn("rounded-[1.5rem] border overflow-hidden", softBorder, softBg)}>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className={cn("border-b", softBorder, dark ? "bg-slate-900/40" : "bg-white/60")}>
                      <th className={thCls} onClick={() => handleColumnSort("name")}>
                        <div className="flex items-center gap-2">Name {renderSortIcon("name")}</div>
                      </th>
                      <th className={cn(thCls, "cursor-default")}>Visible in Inbox</th>
                      <th className={thCls} onClick={() => handleColumnSort("lastEdited")}>
                        <div className="flex items-center gap-2">Last Edited {renderSortIcon("lastEdited")}</div>
                      </th>
                      <th className={cn("px-6 py-4 text-right text-[11px] font-semibold", sub)}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {isLoading ? (
                      <tr>
                        <td colSpan={4} className="px-6 py-12 text-center">
                          <Loader2 className="w-6 h-6 animate-spin mx-auto text-primary" />
                        </td>
                      </tr>
                    ) : paginatedData.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-6 py-16 text-center">
                          <div className="flex flex-col items-center gap-3">
                            <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
                              <TagIcon className="w-7 h-7 text-primary" />
                            </div>
                            <div className="space-y-1">
                              <h3 className={cn("text-[13px] font-black", text)}>No tags found</h3>
                              <p className={cn("text-[11px] font-medium opacity-60", sub)}>
                                Create your first tag to categorize conversations.
                              </p>
                            </div>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      paginatedData.map((item) => (
                        <tr
                          key={item.id}
                          className={cn("border-b transition-colors", softBorder, dark ? "hover:bg-slate-900/40" : "hover:bg-white/80")}
                        >
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <span
                                className="inline-flex h-7 px-3 items-center rounded-md text-[12px] font-semibold"
                                style={{ backgroundColor: item.bgColor, color: item.textColor }}
                              >
                                {item.name}
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            {item.displayInbox ? (
                              <span className="inline-flex h-5 px-2 items-center gap-1 rounded-md text-[10px] font-semibold border border-emerald-500/30 bg-emerald-500/5 text-emerald-600 dark:text-emerald-400">
                                <Eye size={10} /> Yes
                              </span>
                            ) : (
                              <span className="inline-flex h-5 px-2 items-center gap-1 rounded-md text-[10px] font-semibold border border-slate-500/30 bg-slate-500/5 text-slate-500">
                                <EyeOff size={10} /> No
                              </span>
                            )}
                          </td>
                          <td className={cn("px-6 py-4 text-[12px] font-bold", sub)}>{item.lastEdited}</td>
                          <td className="px-6 py-4">
                            <div className="flex justify-end">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <button className={cn("w-9 h-9 rounded-lg border flex items-center justify-center transition-all", dark ? "border-slate-800 hover:border-primary/40 hover:text-primary text-slate-400" : "border-slate-200 hover:border-primary/40 hover:text-primary text-slate-500")}>
                                    <MoreVertical size={14} />
                                  </button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className={cn("rounded-xl border p-1.5 w-44", card, border)}>
                                  <DropdownMenuItem onClick={() => openEdit(item)} className="rounded-lg text-[12px] font-bold py-2 px-3 flex gap-2 cursor-pointer">
                                    <Edit2 size={13} /> Edit
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() => {
                                      setItemToDelete(item);
                                      setShowDeleteModal(true);
                                    }}
                                    className="rounded-lg text-[12px] font-bold py-2 px-3 flex gap-2 cursor-pointer text-rose-500 focus:text-rose-500 focus:bg-rose-500/10"
                                  >
                                    <Trash2 size={13} /> Delete
                                  </DropdownMenuItem>
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

              {!isLoading && (
                <div className={cn("px-6 py-3 border-t flex items-center justify-between flex-wrap gap-3", softBorder, dark ? "bg-slate-900/40" : "bg-white/60")}>
                  <span className={cn("text-[11px] font-semibold", sub)}>
                    {totalFilteredItems} results
                  </span>
                  <div className="flex items-center gap-3">
                    <span className={cn("text-[11px] font-semibold", sub)}>Rows</span>
                    <select
                      value={rowsPerPage}
                      onChange={(e) => {
                        setRowsPerPage(Number(e.target.value));
                        setPage(1);
                      }}
                      className={cn(selectCls, "h-8 w-20 text-[11px] px-3")}
                    >
                      {[10, 25, 50].map((o) => (
                        <option key={o} value={o}>
                          {o}
                        </option>
                      ))}
                    </select>
                    <span className={cn("text-[11px] font-semibold", sub)}>
                      Page {page} of {totalPages}
                    </span>
                    <div className="flex gap-1">
                      {[
                        { Icon: ChevronsLeft, onClick: () => setPage(1), disabled: page === 1 },
                        { Icon: ChevronLeft, onClick: () => setPage((p) => Math.max(1, p - 1)), disabled: page === 1 },
                        { Icon: ChevronRight, onClick: () => setPage((p) => Math.min(totalPages, p + 1)), disabled: page === totalPages || totalFilteredItems === 0 },
                        { Icon: ChevronsRight, onClick: () => setPage(totalPages), disabled: page === totalPages || totalFilteredItems === 0 },
                      ].map(({ Icon, onClick, disabled }, i) => (
                        <button
                          key={i}
                          onClick={onClick}
                          disabled={disabled}
                          className={cn("w-8 h-8 rounded-lg border flex items-center justify-center transition-all disabled:opacity-40", softBorder, dark ? "hover:border-primary/40 hover:text-primary text-slate-400" : "hover:border-primary/40 hover:text-primary text-slate-500")}
                        >
                          <Icon size={14} />
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Create / Edit Modal ── */}
      <Dialog
        open={showCreateModal || showEditModal}
        onOpenChange={(open) => {
          if (!open) {
            setShowCreateModal(false);
            setShowEditModal(false);
            setEditingItem(null);
            setForm(emptyForm);
          }
        }}
      >
        <DialogContent className={cn("border p-0 overflow-hidden rounded-[2rem] max-w-md max-h-[90vh] overflow-y-auto", card, border)}>
          <div className="p-6 space-y-5">
            <DialogHeader>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
                  {showEditModal ? <Edit2 size={18} /> : <TagIcon size={18} />}
                </div>
                <div className="text-left">
                  <DialogTitle className={cn("text-[14px] font-semibold", text)}>
                    {showEditModal ? "Edit Tag" : "Create Tag"}
                  </DialogTitle>
                  <DialogDescription className={cn("text-[11px] font-medium opacity-60 mt-0.5", sub)}>
                    {showEditModal ? "Update name, colors, scope and visibility." : "Add a new tag to categorize conversations."}
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>

            <div className="space-y-4">
              <div className="space-y-2">
                <label className={labelCls}>
                  Name <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <input
                    placeholder="Enter tag name"
                    value={form.name}
                    onChange={(e) => setForm((p) => ({ ...p, name: e.target.value.slice(0, 25) }))}
                    className={cn(inputCls, "pr-16")}
                  />
                  <span className={cn("absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-bold", sub)}>
                    {form.name.length}/25
                  </span>
                </div>
              </div>

              <ColorPicker
                label="Background colour"
                value={form.bgColor}
                onChange={(v) => setForm((p) => ({ ...p, bgColor: v }))}
                presetKey="bg"
              />
              <ColorPicker
                label="Text colour"
                value={form.textColor}
                onChange={(v) => setForm((p) => ({ ...p, textColor: v }))}
                presetKey="text"
              />

              <div className="space-y-2">
                <label className={labelCls}>Preview</label>
                <div>
                  <span
                    className="inline-flex h-8 px-3 items-center rounded-md text-[13px] font-semibold"
                    style={{ backgroundColor: form.bgColor, color: form.textColor }}
                  >
                    {form.name || "Sample"}
                  </span>
                </div>
              </div>

              {/* Scope dropdown intentionally removed — replyagent hardcodes
                  `tag_for: "workspace"` in its CreateTag.vue. The For-filter
                  on the list view still allows browsing tags by entity. */}

              <div className="space-y-2">
                <label className={labelCls}>Folder</label>
                <select
                  value={form.folderId}
                  onChange={(e) => setForm((p) => ({ ...p, folderId: e.target.value }))}
                  className={selectCls}
                >
                  <option value="">Root (no folder)</option>
                  {folders.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className={cn("flex items-center justify-between p-4 rounded-xl border", softBg, softBorder)}>
                <div>
                  <p className={cn("text-[12px] font-black", text)}>Visible in Inbox</p>
                  <p className={cn("text-[10px] font-medium opacity-60", sub)}>
                    Show this tag in conversation lists.
                  </p>
                </div>
                <Switch
                  checked={form.displayInbox}
                  onCheckedChange={(val) => setForm((p) => ({ ...p, displayInbox: val }))}
                  className="data-[state=checked]:bg-primary"
                />
              </div>
            </div>

            <div className={cn("flex justify-end gap-2 pt-4 border-t", softBorder)}>
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setShowEditModal(false);
                  setEditingItem(null);
                  setForm(emptyForm);
                }}
                className={outlineBtn}
              >
                Cancel
              </button>
              <button
                onClick={showEditModal ? submitUpdate : submitCreate}
                disabled={createMutation.isPending || updateMutation.isPending}
                className={primaryBtn}
              >
                {(createMutation.isPending || updateMutation.isPending) && (
                  <Loader2 size={12} className="animate-spin" />
                )}
                {showEditModal ? "Save Changes" : "Create"}
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
                    {editingFolder ? "Pick a new name." : "Group tags under a folder."}
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>

            <div className="space-y-2">
              <label className={labelCls}>Folder name</label>
              <input
                value={folderName}
                onChange={(e) => setFolderName(e.target.value.slice(0, 25))}
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
      <AlertDialog open={showDeleteModal} onOpenChange={setShowDeleteModal}>
        <AlertDialogContent className={cn("rounded-[2rem] border p-0 max-w-md overflow-hidden", card, border)}>
          <div className="p-6 space-y-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-500/10 flex items-center justify-center text-rose-500">
                <AlertCircle size={18} />
              </div>
              <div>
                <h2 className={cn("text-[14px] font-semibold", text)}>Delete Tag?</h2>
                <p className={cn("text-[11px] font-medium opacity-60 mt-0.5 leading-relaxed", sub)}>
                  <span className="text-rose-500 font-black break-all">
                    {itemToDelete?.name || "This tag"}
                  </span>{" "}
                  will be permanently removed and unlinked from every conversation, contact and opportunity.
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <AlertDialogCancel className={cn(outlineBtn, "m-0")}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => itemToDelete && deleteMutation.mutate(itemToDelete.id)}
                disabled={deleteMutation.isPending}
                className="h-11 px-7 rounded-xl bg-rose-500 hover:bg-rose-600 text-white text-[11px] font-semibold transition-all shadow-lg shadow-rose-500/20 flex items-center gap-2"
              >
                {deleteMutation.isPending ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : (
                  <Trash2 size={12} />
                )}
                Delete
              </AlertDialogAction>
            </div>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
