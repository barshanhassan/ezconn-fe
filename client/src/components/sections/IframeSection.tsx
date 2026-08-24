import { useMemo, useState } from "react";
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
  Globe,
  Edit2,
  Trash2,
  Plus,
  Loader2,
  ChevronLeft,
  AlertCircle,
  Shield,
  Users,
  Layout,
  AppWindow,
  Link,
  Home,
  Settings,
  BarChart3,
  LineChart,
  PieChart,
  Table,
  Grid3x3,
  List as ListIcon,
  Inbox,
  Mail,
  Bell,
  Calendar,
  CalendarDays,
  Clock,
  User,
  Building,
  Briefcase,
  Folder,
  File,
  FileText,
  StickyNote,
  Bookmark,
  Star,
  Heart,
  Flag,
  Tag,
  Tags,
  MessageCircle,
  MessagesSquare,
  MessageSquare,
  Phone,
  Video,
  Headset,
  Bot,
  Zap,
  Rocket,
  Lock,
  Key,
  Search,
  Filter,
  SlidersHorizontal,
  Info,
  CircleHelp,
  CircleCheck,
  ArrowRight,
  ArrowUpRight,
  LayoutGrid,
  Network,
  Code,
  Terminal,
  X,
} from "lucide-react";

// Replyagent's `iconList` (50+ icons) rebuilt on Lucide. Each entry's key is
// what we persist in `iframes.icon` so a re-render after save reuses the
// same picker entry; the React component drives the visual.
const ICON_GRID: Array<{ key: string; Comp: any }> = [
  { key: "layout", Comp: Layout },
  { key: "app-window", Comp: AppWindow },
  { key: "globe", Comp: Globe },
  { key: "link", Comp: Link },
  { key: "home", Comp: Home },
  { key: "settings", Comp: Settings },
  { key: "bar-chart", Comp: BarChart3 },
  { key: "line-chart", Comp: LineChart },
  { key: "pie-chart", Comp: PieChart },
  { key: "table", Comp: Table },
  { key: "grid", Comp: Grid3x3 },
  { key: "list", Comp: ListIcon },
  { key: "inbox", Comp: Inbox },
  { key: "mail", Comp: Mail },
  { key: "bell", Comp: Bell },
  { key: "calendar", Comp: Calendar },
  { key: "calendar-days", Comp: CalendarDays },
  { key: "clock", Comp: Clock },
  { key: "user", Comp: User },
  { key: "users", Comp: Users },
  { key: "building", Comp: Building },
  { key: "briefcase", Comp: Briefcase },
  { key: "folder", Comp: Folder },
  { key: "file", Comp: File },
  { key: "file-text", Comp: FileText },
  { key: "sticky-note", Comp: StickyNote },
  { key: "bookmark", Comp: Bookmark },
  { key: "star", Comp: Star },
  { key: "heart", Comp: Heart },
  { key: "flag", Comp: Flag },
  { key: "tag", Comp: Tag },
  { key: "tags", Comp: Tags },
  { key: "message-circle", Comp: MessageCircle },
  { key: "messages-square", Comp: MessagesSquare },
  { key: "message-square", Comp: MessageSquare },
  { key: "phone", Comp: Phone },
  { key: "video", Comp: Video },
  { key: "headset", Comp: Headset },
  { key: "bot", Comp: Bot },
  { key: "zap", Comp: Zap },
  { key: "rocket", Comp: Rocket },
  { key: "shield", Comp: Shield },
  { key: "lock", Comp: Lock },
  { key: "key", Comp: Key },
  { key: "search", Comp: Search },
  { key: "filter", Comp: Filter },
  { key: "sliders", Comp: SlidersHorizontal },
  { key: "info", Comp: Info },
  { key: "circle-help", Comp: CircleHelp },
  { key: "circle-check", Comp: CircleCheck },
  { key: "arrow-right", Comp: ArrowRight },
  { key: "arrow-up-right", Comp: ArrowUpRight },
  { key: "layout-grid", Comp: LayoutGrid },
  { key: "network", Comp: Network },
  { key: "code", Comp: Code },
  { key: "terminal", Comp: Terminal },
];

function IconByKey({ iconKey, size = 14, className = "" }: { iconKey: string | null; size?: number; className?: string }) {
  const found = ICON_GRID.find((i) => i.key === iconKey);
  const Comp = found?.Comp ?? Globe;
  return <Comp size={size} className={className} />;
}
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { useTheme } from "@/contexts/ThemeContext";

type Placement = "settings_menu" | "main_menu";

interface IframeRow {
  id: string;
  name: string;
  menu: string | null;
  placement: Placement;
  icon: string | null;
  menu_text: string | null;
  html: string;
  permissions: Array<{ id: string; user_id: string }>;
}

interface WorkspaceMember {
  id: string;
  name: string;
  email: string;
}

export default function IframeSection() {
  const { mode } = useTheme();
  const dark = mode === "dark";
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [view, setView] = useState<"list" | "form" | "permissions">("list");
  const [iconPickerOpen, setIconPickerOpen] = useState(false);
  const [iconSearch, setIconSearch] = useState("");
  const [formData, setFormData] = useState({
    id: null as string | null,
    name: "",
    menu_text: "",
    menu: "",
    placement: "settings_menu" as Placement,
    icon: "",
    html: "",
  });
  const [permissionTarget, setPermissionTarget] = useState<IframeRow | null>(null);
  const [permissionSelections, setPermissionSelections] = useState<Set<string>>(new Set());
  const [isEditTitleModalOpen, setIsEditTitleModalOpen] = useState(false);
  const [menuTitleInput, setMenuTitleInput] = useState("");
  const [iframeToDelete, setIframeToDelete] = useState<IframeRow | null>(null);

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
    "w-full rounded-xl text-[12px] font-mono transition-all px-4 py-3 border outline-none resize-none",
    "focus:ring-2 focus:ring-primary/30 focus:border-primary/50",
    dark ? "bg-slate-950/50 border-slate-800 text-white" : "bg-white border-slate-200 text-slate-900",
  );
  const outlineBtn = cn(
    "h-11 px-6 rounded-xl border text-[11px] font-semibold transition-all flex items-center gap-2",
    dark ? "border-slate-800 text-slate-300 hover:border-primary/40 hover:text-primary" : "border-slate-200 text-slate-700 hover:border-primary/40 hover:text-primary",
  );
  const primaryOutlineBtn = cn(
    "h-10 px-6 rounded-xl border text-[11px] font-semibold transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed",
    "border-primary text-primary hover:bg-primary hover:text-white",
  );
  const primaryBtn =
    "h-11 px-7 rounded-xl bg-primary hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed text-white text-[11px] font-semibold transition-all shadow-lg shadow-primary/20 flex items-center gap-2";
  const labelCls = cn("block text-[11px] font-semibold", sub);

  // ── Data ─────────────────────────────────────────────────────────
  const { data, isLoading } = useQuery<{ iframes: IframeRow[]; menu_title: string }>({
    queryKey: ["/api/iframes"],
    queryFn: async () => (await apiRequest("GET", "/api/iframes")).json(),
  });

  const { data: membersData } = useQuery<any>({
    queryKey: ["/api/workspaces/members"],
    queryFn: async () => (await apiRequest("GET", "/api/workspaces/members")).json(),
  });

  const iframes: IframeRow[] = data?.iframes ?? [];
  const menuTitle = data?.menu_title ?? "Iframes";

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

  // ── Mutations ────────────────────────────────────────────────────
  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["/api/iframes"] });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload: any = {
        name: formData.name.trim(),
        placement: formData.placement,
        menu: formData.menu.trim() || null,
        menu_text: formData.menu_text.trim() || null,
        icon: formData.icon.trim() || null,
        html: formData.html,
      };
      if (formData.id) payload.id = formData.id;
      const res = await apiRequest("POST", "/api/iframes", payload);
      return res.json();
    },
    onSuccess: () => {
      invalidate();
      toast({ title: formData.id ? "Iframe updated" : "Iframe created" });
      resetForm();
      setView("list");
    },
    onError: (e: any) =>
      toast({ title: "Error", description: e?.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/iframes/${id}`);
    },
    onSuccess: () => {
      invalidate();
      toast({ title: "Iframe deleted" });
      setIframeToDelete(null);
    },
    onError: (e: any) =>
      toast({ title: "Error", description: e?.message, variant: "destructive" }),
  });

  const titleMutation = useMutation({
    mutationFn: async (title: string) => {
      await apiRequest("POST", "/api/iframes/menu-title", { title });
    },
    onSuccess: () => {
      invalidate();
      toast({ title: "Menu title updated" });
      setIsEditTitleModalOpen(false);
    },
    onError: (e: any) =>
      toast({ title: "Error", description: e?.message, variant: "destructive" }),
  });

  const permissionsMutation = useMutation({
    mutationFn: async () => {
      if (!permissionTarget) throw new Error("No iframe selected");
      const payload = {
        permissions: Array.from(permissionSelections).map((id) => ({ user_id: id })),
      };
      const res = await apiRequest(
        "POST",
        `/api/iframes/${permissionTarget.id}/permissions`,
        payload,
      );
      return res.json();
    },
    onSuccess: () => {
      invalidate();
      toast({ title: "Permissions saved" });
      setView("list");
      setPermissionTarget(null);
      setPermissionSelections(new Set());
    },
    onError: (e: any) =>
      toast({ title: "Error", description: e?.message, variant: "destructive" }),
  });

  // ── Handlers ─────────────────────────────────────────────────────
  const resetForm = () =>
    setFormData({
      id: null,
      name: "",
      menu_text: "",
      menu: "",
      placement: "settings_menu",
      icon: "",
      html: "",
    });

  const openCreate = () => {
    resetForm();
    setView("form");
  };

  const openEdit = (iframe: IframeRow) => {
    setFormData({
      id: iframe.id,
      name: iframe.name ?? "",
      menu_text: iframe.menu_text ?? "",
      menu: iframe.menu ?? "",
      placement: (iframe.placement ?? "settings_menu") as Placement,
      icon: iframe.icon ?? "",
      html: iframe.html ?? "",
    });
    setView("form");
  };

  const openPermissions = (iframe: IframeRow) => {
    setPermissionTarget(iframe);
    setPermissionSelections(new Set((iframe.permissions ?? []).map((p) => p.user_id)));
    setView("permissions");
  };

  const handleSave = () => {
    if (!formData.name.trim()) {
      toast({ title: "Name is required", variant: "destructive" });
      return;
    }
    if (formData.placement === "settings_menu" && !formData.menu.trim()) {
      toast({
        title: "Menu group required",
        description: "Settings-menu iframes need a parent group name.",
        variant: "destructive",
      });
      return;
    }
    if (!formData.html.trim()) {
      toast({ title: "HTML is required", variant: "destructive" });
      return;
    }
    saveMutation.mutate();
  };

  const togglePermission = (userId: string) => {
    setPermissionSelections((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  };

  const headerTitle =
    view === "form"
      ? formData.id
        ? "Edit Iframe"
        : "Create Iframe"
      : view === "permissions"
        ? `Permissions — ${permissionTarget?.name ?? ""}`
        : menuTitle;

  return (
    <>
      <Card className={cn("rounded-[2rem] border overflow-hidden shadow-sm transition-all duration-300", card, border)}>
        <CardContent className="p-0">
          {/* Header */}
          <div className={cn("px-8 py-5 border-b flex flex-wrap items-center justify-between gap-3", border)}>
            <div className="flex items-center gap-4">
              <div className={cn("p-2.5 rounded-xl shadow-sm", "bg-primary/10")}>
                <Globe className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h1 className={cn("text-[16px] font-bold tracking-tight", text)}>
                  {headerTitle}
                </h1>
                <p className={cn("text-[11px] font-bold mt-0.5 opacity-60 max-w-2xl", sub)}>
                  Embed another webpage or resource inside your current page.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {view === "list" && (
                <>
                  <button onClick={() => { setMenuTitleInput(menuTitle); setIsEditTitleModalOpen(true); }} className={outlineBtn}>
                    <Edit2 size={12} /> Edit Menu Title
                  </button>
                  <button onClick={openCreate} disabled={iframes.length >= 3} className={primaryOutlineBtn}>
                    <Plus size={12} /> Add New
                  </button>
                </>
              )}
              {view !== "list" && (
                <button
                  onClick={() => {
                    setView("list");
                    resetForm();
                    setPermissionTarget(null);
                  }}
                  className={outlineBtn}
                >
                  <ChevronLeft size={12} /> Back
                </button>
              )}
            </div>
          </div>

          {/* ── LIST VIEW ── */}
          {view === "list" && (
            <div className="p-8">
              <div className={cn("rounded-[1.5rem] border overflow-hidden", softBorder, softBg)}>
                <div className={cn("px-6 py-3 border-b text-[11px] font-semibold", softBorder, sub, dark ? "bg-slate-900/40" : "bg-white/60")}>
                  You can create a maximum of 3 items
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className={cn("border-b", softBorder, dark ? "bg-slate-900/40" : "bg-white/60")}>
                        <th className={cn("px-6 py-4 text-left text-[11px] font-semibold", sub)}>Name</th>
                        <th className={cn("px-6 py-4 text-left text-[11px] font-semibold", sub)}>Placement</th>
                        <th className={cn("px-6 py-4 text-left text-[11px] font-semibold", sub)}>Sidebar Group</th>
                        <th className={cn("px-6 py-4 text-left text-[11px] font-semibold", sub)}>Permissions</th>
                        <th className={cn("px-6 py-4 text-right text-[11px] font-semibold", sub)}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {isLoading ? (
                        <tr>
                          <td colSpan={5} className="px-6 py-12 text-center">
                            <Loader2 className="w-6 h-6 animate-spin mx-auto text-primary" />
                          </td>
                        </tr>
                      ) : iframes.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-6 py-16 text-center">
                            <div className="flex flex-col items-center gap-3">
                              <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
                                <Globe className="w-7 h-7 text-primary" />
                              </div>
                              <div className="space-y-1">
                                <h3 className={cn("text-[13px] font-black", text)}>No iframes yet</h3>
                                <p className={cn("text-[11px] font-medium opacity-60", sub)}>
                                  Click "Add New" to embed your first iframe.
                                </p>
                              </div>
                            </div>
                          </td>
                        </tr>
                      ) : (
                        iframes.map((iframe) => (
                          <tr
                            key={iframe.id}
                            className={cn("border-b transition-colors", softBorder, dark ? "hover:bg-slate-900/40" : "hover:bg-white/80")}
                          >
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                                  {/* Render whichever icon was saved on the row;
                                      falls back to Globe when nothing's picked yet. */}
                                  <IconByKey iconKey={iframe.icon} size={14} className="text-primary" />
                                </div>
                                <div>
                                  <p className={cn("text-[13px] font-black", text)}>{iframe.name}</p>
                                  {iframe.menu_text && (
                                    <p className={cn("text-[11px] font-medium opacity-60", sub)}>
                                      {iframe.menu_text}
                                    </p>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <span className="inline-flex h-5 px-2 items-center rounded-md border border-primary/30 bg-primary/5 text-primary text-[10px] font-semibold">
                                {iframe.placement === "main_menu" ? "Main menu" : "Settings menu"}
                              </span>
                            </td>
                            <td className={cn("px-6 py-4 text-[12px] font-bold", sub)}>
                              {iframe.menu || "—"}
                            </td>
                            <td className={cn("px-6 py-4 text-[12px] font-bold", sub)}>
                              {(iframe.permissions ?? []).length === 0
                                ? "Everyone"
                                : `${(iframe.permissions ?? []).length} agents`}
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex items-center justify-end gap-2">
                                <button
                                  onClick={() => openPermissions(iframe)}
                                  className={cn("w-9 h-9 rounded-lg border flex items-center justify-center transition-all", dark ? "border-slate-800 hover:border-primary/40 hover:text-primary text-slate-400" : "border-slate-200 hover:border-primary/40 hover:text-primary text-slate-500")}
                                  title="Permissions"
                                >
                                  <Shield size={13} />
                                </button>
                                <button
                                  onClick={() => openEdit(iframe)}
                                  className={cn("w-9 h-9 rounded-lg border flex items-center justify-center transition-all", dark ? "border-slate-800 hover:border-primary/40 hover:text-primary text-slate-400" : "border-slate-200 hover:border-primary/40 hover:text-primary text-slate-500")}
                                  title="Edit"
                                >
                                  <Edit2 size={13} />
                                </button>
                                <button
                                  onClick={() => setIframeToDelete(iframe)}
                                  className={cn("w-9 h-9 rounded-lg border flex items-center justify-center transition-all", dark ? "border-slate-800 hover:border-rose-500/40 hover:text-rose-500 text-slate-400" : "border-slate-200 hover:border-rose-500/40 hover:text-rose-500 text-slate-500")}
                                  title="Delete"
                                >
                                  <Trash2 size={13} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
                <div className={cn("px-6 py-3 border-t text-[11px] font-semibold", softBorder, sub, dark ? "bg-slate-900/40" : "bg-white/60")}>
                  Showing {iframes.length} of {iframes.length} iframes
                </div>
              </div>
            </div>
          )}

          {/* ── CREATE / EDIT FORM ── */}
          {view === "form" && (
            <div className="p-8">
              <div className={cn("rounded-[1.5rem] border p-8 space-y-6", softBg, softBorder)}>
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className={labelCls}>Name</label>
                      <input
                        value={formData.name}
                        onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value.slice(0, 255) }))}
                        className={inputCls}
                        placeholder="Enter iframe name"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className={labelCls}>Placement</label>
                      <select
                        value={formData.placement}
                        onChange={(e) =>
                          setFormData((p) => ({ ...p, placement: e.target.value as Placement }))
                        }
                        className={selectCls}
                      >
                        <option value="settings_menu">Settings menu</option>
                        <option value="main_menu">Main menu (top-level)</option>
                      </select>
                    </div>
                  </div>

                  {formData.placement === "settings_menu" && (
                    <div className="space-y-2">
                      <label className={labelCls}>Sidebar group (menu)</label>
                      <input
                        value={formData.menu}
                        onChange={(e) => setFormData((p) => ({ ...p, menu: e.target.value.slice(0, 255) }))}
                        className={inputCls}
                        placeholder="Settings sidebar group name"
                      />
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className={labelCls}>Sidebar label</label>
                      <input
                        value={formData.menu_text}
                        onChange={(e) => setFormData((p) => ({ ...p, menu_text: e.target.value.slice(0, 255) }))}
                        className={inputCls}
                        placeholder="Text shown in the sidebar"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className={labelCls}>Icon</label>
                      <button
                        type="button"
                        onClick={() => setIconPickerOpen(true)}
                        className={cn(inputCls, "flex items-center justify-between cursor-pointer")}
                      >
                        <span className="flex items-center gap-2">
                          <IconByKey iconKey={formData.icon} size={15} className="text-primary" />
                          <span className={cn("text-[12px] font-bold", formData.icon ? text : sub)}>
                            {formData.icon ? formData.icon : "Pick an icon"}
                          </span>
                        </span>
                        <span className={cn("text-[10px] font-black", sub)}>Change</span>
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className={labelCls}>HTML / Embed code</label>
                    <textarea
                      value={formData.html}
                      onChange={(e) => setFormData((p) => ({ ...p, html: e.target.value }))}
                      rows={10}
                      className={textareaCls}
                      placeholder="Paste your embed / iframe HTML here..."
                    />
                  </div>
                </div>

                <div className={cn("flex justify-end gap-2 pt-6 border-t", softBorder)}>
                  <button
                    onClick={() => {
                      setView("list");
                      resetForm();
                    }}
                    className={outlineBtn}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={saveMutation.isPending}
                    className={primaryBtn}
                  >
                    {saveMutation.isPending && <Loader2 size={12} className="animate-spin" />}
                    {formData.id ? "Save" : "Publish"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ── PERMISSIONS VIEW ── */}
          {view === "permissions" && permissionTarget && (
            <div className="p-8">
              <div className={cn("rounded-[1.5rem] border p-8 space-y-6", softBg, softBorder)}>
                <div className="flex items-center gap-3">
                  <Users size={16} className="text-primary" />
                  <div>
                    <p className={cn("text-[13px] font-black", text)}>
                      Pick the agents who can see this iframe
                    </p>
                    <p className={cn("text-[11px] font-medium opacity-60", sub)}>
                      Leave the list empty to grant access to every workspace member.
                    </p>
                  </div>
                </div>

                <div className="max-h-80 overflow-y-auto space-y-1.5 pr-2">
                  {members.length === 0 ? (
                    <p className={cn("text-[11px] font-medium opacity-60", sub)}>
                      No other agents in this workspace yet.
                    </p>
                  ) : (
                    members.map((m) => {
                      const checked = permissionSelections.has(m.id);
                      return (
                        <label
                          key={m.id}
                          className={cn(
                            "flex items-center gap-3 px-3 py-2.5 rounded-lg border cursor-pointer transition-all",
                            checked
                              ? "border-primary/50 bg-primary/5"
                              : cn(softBorder, dark ? "bg-slate-900/40 hover:border-primary/30" : "bg-white hover:border-primary/30"),
                          )}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => togglePermission(m.id)}
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
                    })
                  )}
                </div>

                <div className={cn("flex justify-end gap-2 pt-6 border-t", softBorder)}>
                  <button
                    onClick={() => {
                      setView("list");
                      setPermissionTarget(null);
                    }}
                    className={outlineBtn}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => permissionsMutation.mutate()}
                    disabled={permissionsMutation.isPending}
                    className={primaryBtn}
                  >
                    {permissionsMutation.isPending && <Loader2 size={12} className="animate-spin" />}
                    Save
                  </button>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Edit Menu Title Modal ── */}
      <Dialog open={isEditTitleModalOpen} onOpenChange={setIsEditTitleModalOpen}>
        <DialogContent className={cn("border p-0 overflow-hidden rounded-[2rem] max-w-md", card, border)}>
          <div className="p-6 space-y-5">
            <DialogHeader>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
                  <Edit2 size={18} />
                </div>
                <div className="text-left">
                  <DialogTitle className={cn("text-[14px] font-semibold", text)}>
                    Edit Menu Title
                  </DialogTitle>
                  <DialogDescription className={cn("text-[11px] font-medium opacity-60 mt-0.5", sub)}>
                    Change the label shown in the sidebar group.
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>

            <div className="space-y-2">
              <label className={labelCls}>Menu Title</label>
              <input
                value={menuTitleInput}
                onChange={(e) => setMenuTitleInput(e.target.value)}
                className={inputCls}
              />
            </div>

            <div className={cn("flex justify-end gap-2 pt-4 border-t", softBorder)}>
              <button onClick={() => setIsEditTitleModalOpen(false)} className={outlineBtn}>
                Cancel
              </button>
              <button
                onClick={() => titleMutation.mutate(menuTitleInput || menuTitle)}
                disabled={titleMutation.isPending}
                className={primaryBtn}
              >
                {titleMutation.isPending && <Loader2 size={12} className="animate-spin" />}
                Save
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Icon Picker (replyagent parity: ~50 icon grid + search) ── */}
      <Dialog open={iconPickerOpen} onOpenChange={(open) => { if (!open) { setIconPickerOpen(false); setIconSearch(""); } }}>
        <DialogContent className={cn("border p-0 overflow-hidden rounded-[2rem] max-w-xl", card, border)}>
          <div className="p-6 space-y-4">
            <DialogHeader>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
                  <IconByKey iconKey={formData.icon || "globe"} size={18} />
                </div>
                <div className="text-left">
                  <DialogTitle className={cn("text-[14px] font-semibold", text)}>
                    Pick an icon
                  </DialogTitle>
                  <DialogDescription className={cn("text-[11px] font-medium opacity-60 mt-0.5", sub)}>
                    Shown beside the iframe in the sidebar.
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>

            <div className="relative">
              <Search size={14} className={cn("absolute left-3 top-1/2 -translate-y-1/2", sub)} />
              <input
                value={iconSearch}
                onChange={(e) => setIconSearch(e.target.value.toLowerCase())}
                placeholder="Search icons…"
                className={cn(inputCls, "pl-10")}
              />
            </div>

            <div className="grid grid-cols-8 gap-2 max-h-80 overflow-y-auto p-1">
              {ICON_GRID.filter((i) => !iconSearch || i.key.includes(iconSearch)).map((i) => {
                const selected = formData.icon === i.key;
                const Comp = i.Comp;
                return (
                  <button
                    key={i.key}
                    type="button"
                    onClick={() => {
                      setFormData((p) => ({ ...p, icon: i.key }));
                      setIconPickerOpen(false);
                      setIconSearch("");
                    }}
                    title={i.key}
                    className={cn(
                      "aspect-square rounded-lg border flex items-center justify-center transition-all",
                      selected
                        ? "border-primary bg-primary/10 text-primary"
                        : cn(softBorder, dark ? "bg-slate-900/40 hover:border-primary/40 text-slate-400 hover:text-primary" : "bg-white hover:border-primary/40 text-slate-500 hover:text-primary"),
                    )}
                  >
                    <Comp size={16} />
                  </button>
                );
              })}
            </div>

            <div className={cn("flex items-center justify-between pt-4 border-t", softBorder)}>
              <button
                type="button"
                onClick={() => {
                  setFormData((p) => ({ ...p, icon: "" }));
                  setIconPickerOpen(false);
                  setIconSearch("");
                }}
                className={cn(outlineBtn, "border-rose-500/30 text-rose-500 hover:bg-rose-500/5")}
              >
                <X size={12} /> Clear icon
              </button>
              <button
                type="button"
                onClick={() => { setIconPickerOpen(false); setIconSearch(""); }}
                className={outlineBtn}
              >
                Done
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Delete Dialog ── */}
      <AlertDialog open={!!iframeToDelete} onOpenChange={(open) => !open && setIframeToDelete(null)}>
        <AlertDialogContent className={cn("rounded-[2rem] border p-0 max-w-md overflow-hidden", card, border)}>
          <div className="p-6 space-y-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-500/10 flex items-center justify-center text-rose-500">
                <AlertCircle size={18} />
              </div>
              <div>
                <h2 className={cn("text-[14px] font-semibold", text)}>Delete Iframe?</h2>
                <p className={cn("text-[11px] font-medium opacity-60 mt-0.5 leading-relaxed", sub)}>
                  <span className="text-rose-500 font-black">{iframeToDelete?.name || "This iframe"}</span> will be permanently removed.
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <AlertDialogCancel className={cn(outlineBtn, "m-0")}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => iframeToDelete && deleteMutation.mutate(iframeToDelete.id)}
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
