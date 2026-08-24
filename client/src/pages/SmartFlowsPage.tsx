import { useState, useEffect, useCallback, useMemo } from "react";
import { getUserInfo } from "@/lib/auth";
import { Link, useLocation } from "wouter";
import {
    Plus,
    Search,
    Folder,
    Edit2,
    Trash2,
    MoreVertical,
    ChevronDown,
    Copy as ClipboardCopy,
    ChevronsUpDown,
    ChevronUp,
    ArrowDownWideNarrow,
    ArrowUpWideNarrow,
    User,
    FolderPlus,
    PlusCircle,
    Pencil,
    CircleArrowDown,
    FolderOpen,
    Plug,
    ChevronsLeft,
    ChevronLeft,
    ChevronRight,
    ChevronsRight,
    GitMerge,
    Workflow
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
    DropdownMenuSeparator
} from "@/components/ui/dropdown-menu";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

import CustomDropdown from "@/components/CustomDropdown";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import { formatInWorkspaceTz, useWorkspaceTimezone } from "@/contexts/WorkspaceTimezoneContext";

// Replyagent date format: "YYYY-MM-DD hh:mm am/pm" (12-hour, lowercase meridiem).
// Source: gateway-frontend AppStore (date_format=YYYY-MM-DD, time_format=hh:mm a).
const formatDateTime = (d?: string | Date | null): string => {
    if (!d) return '-';
    const dt = new Date(d);
    if (isNaN(dt.getTime())) return '-';
    const y = dt.getFullYear();
    const m = String(dt.getMonth() + 1).padStart(2, '0');
    const day = String(dt.getDate()).padStart(2, '0');
    let h = dt.getHours();
    const ampm = h >= 12 ? 'pm' : 'am';
    h = h % 12 || 12;
    const hh = String(h).padStart(2, '0');
    const mm = String(dt.getMinutes()).padStart(2, '0');
    return `${y}-${m}-${day} ${hh}:${mm} ${ampm}`;
};

export default function SmartFlowsPage() {
    const [, setLocation] = useLocation();
    const workspaceTz = useWorkspaceTimezone();
    const [searchText, setSearchText] = useState("");
    // Single-select filters (replyagent parity): one option selected at a time, with
    // an "all" sentinel meaning no filter. The CustomDropdown is run in
    // `showSelectedOption` mode so the trigger shows the chosen option's name.
    const [selectedFolders, setSelectedFolders] = useState<string[]>(["all"]);
    const [statusFilter, setStatusFilter] = useState<string[]>(["all"]);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showFolderModal, setShowFolderModal] = useState(false);
    const [newFlowName, setNewFlowName] = useState("");
    const [newFolderName, setNewFolderName] = useState("");
    // const [isCreating, setIsCreating] = useState(false);
    const [isCreatingFolder, setIsCreatingFolder] = useState(false);
    const [selectedUsers, setSelectedUsers] = useState<string[]>(["all"]);
    // Sort order on updated_at (replyagent parity: desc=newest first, asc=oldest first).
    const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
    const [rowsPerPage, setRowsPerPage] = useState(10);
    const [currentPage, setCurrentPage] = useState(1);

    // Row action modals (replyagent parity for the 3-dot menu)
    const [renameTarget, setRenameTarget] = useState<any | null>(null);
    const [renameValue, setRenameValue] = useState("");
    const [changeFolderTarget, setChangeFolderTarget] = useState<any | null>(null);
    const [changeFolderTargetId, setChangeFolderTargetId] = useState<string>("");
    const [deleteTarget, setDeleteTarget] = useState<any | null>(null);

    // Bulk-select (replyagent's multi-select footer). selectedIds holds the
    // automation IDs currently checked; the master checkbox toggles the
    // visible page's flows in/out of the set.
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [bulkRunning, setBulkRunning] = useState<null | "publish" | "unpublish" | "delete">(null);

    const toggleSelect = (id: string) =>
        setSelectedIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });

    const clearSelection = () => setSelectedIds(new Set());

    const runBulk = async (action: "publish" | "unpublish" | "delete") => {
        if (selectedIds.size === 0) return;
        const verb =
            action === "publish" ? "publish" :
            action === "unpublish" ? "unpublish" : "delete";
        if (!window.confirm(`${verb.charAt(0).toUpperCase() + verb.slice(1)} ${selectedIds.size} automation${selectedIds.size === 1 ? "" : "s"}?`)) return;
        setBulkRunning(action);
        try {
            const ids = Array.from(selectedIds);
            await Promise.all(
                ids.map((id) => {
                    if (action === "delete") {
                        return apiRequest("DELETE", `/api/automations/${id}`);
                    }
                    return apiRequest("POST", `/api/automations/${id}/${action}`, {});
                }),
            );
            toast({ title: `${verb.charAt(0).toUpperCase() + verb.slice(1)}ed ${ids.length}` });
            clearSelection();
            queryClient.invalidateQueries({ queryKey: ["/api/automations"] });
        } catch (e: any) {
            toast({ title: "Bulk action failed", description: e?.message, variant: "destructive" });
        } finally {
            setBulkRunning(null);
        }
    };



    const { toast } = useToast();
    const queryClient = useQueryClient();

    // Fetch automations and folders from backend
    const { data: automationsData, isLoading } = useQuery({
        queryKey: ["/api/automations", { folder_id: selectedFolders[0] }],
        queryFn: async () => {
            const folderId = selectedFolders.includes("all") ? undefined : selectedFolders[0];
            const res = await apiRequest("GET", `/api/automations${folderId ? `?folder_id=${folderId}` : ""}`);
            return res.json();
        }
    });

    const folders = automationsData?.folders || [];
    const flows = automationsData?.automations || [];

    // Fetch workspace members — this page is workspace-scoped. Workspace users do not
    // have agency.users.* permission, so calling /agencies/:id/members would 403.
    const { data: membersResponse } = useQuery({
        queryKey: ["/api/workspaces/members"],
        queryFn: async () => {
            const res = await apiRequest("GET", "/api/workspaces/members");
            return res.json();
        }
    });

    // Backend GET /workspaces/members returns a plain array of user objects, not a
    // wrapped { users: [...] } or { members: [...] }. Be defensive: accept both shapes
    // so other places in the codebase that wrap the response don't break this.
    const membersList: any[] = Array.isArray(membersResponse)
        ? membersResponse
        : (membersResponse?.users || membersResponse?.members || []);

    const mockUsers = membersList.map((m: any) => ({
        id: m.id,
        name: `${m.first_name || ''} ${m.last_name || ''}`.trim() || m.email,
        picture: `https://ui-avatars.com/api/?name=${m.first_name || 'U'}&background=random`
    }));

    const filteredFlows = useMemo(() => {
        let result = flows;

        // Filter by folder
        if (selectedFolders.length > 0 && !selectedFolders.includes("all")) {
            result = result.filter((flow: any) => {
                if (selectedFolders.includes("root") && !flow.folder_id) return true;
                return selectedFolders.includes(flow.folder_id?.toString());
            });
        }

        // Filter by search
        if (searchText) {
            result = result.filter((flow: any) =>
                flow.name.toLowerCase().includes(searchText.toLowerCase())
            );
        }

        // Filter by Status
        if (statusFilter.length > 0 && !statusFilter.includes("all")) {
            result = result.filter((flow: any) => statusFilter.includes(flow.status));
        }

        // Filter by selected user (single-select with "all" sentinel)
        if (selectedUsers.length > 0 && !selectedUsers.includes("all")) {
            result = result.filter((flow: any) =>
                flow.created_by && selectedUsers.includes(flow.created_by.id.toString())
            );
        }

        // Sort by updated_at; direction comes from the sort dropdown (replyagent parity).
        // Fall back to last_updated for backwards-compat with older response shapes.
        return [...result].sort((a: any, b: any) => {
            const dateA = new Date(a.updated_at || a.last_updated || 0).getTime();
            const dateB = new Date(b.updated_at || b.last_updated || 0).getTime();
            return sortOrder === 'desc' ? dateB - dateA : dateA - dateB;
        });
    }, [selectedFolders, searchText, statusFilter, selectedUsers, flows, sortOrder]);


    // Create Flow Mutation
    const createFlowMutation = useMutation({
        mutationFn: async (data: { name: string, folder_id?: string | null }) => {
            const res = await apiRequest("POST", "/api/automations", data);
            return res.json();
        },
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: ["/api/automations"] });
            setShowCreateModal(false);
            setNewFlowName("");
            
            toast({
                title: "Automation created",
                description: "Opening builder...",
            });
            
            // Redirect to builder
            setLocation(`/automations/${data.automation.id}`);
        },
        onError: (err: Error) => {
            toast({
                title: "Creation failed",
                description: err.message,
                variant: "destructive"
            });
        }
    });

    const handleCreateFlow = () => {
        if (newFlowName.trim()) {
            const folder_id = selectedFolders.length === 1 && selectedFolders[0] !== "all" && selectedFolders[0] !== "root"
                ? selectedFolders[0]
                : null;
            createFlowMutation.mutate({ name: newFlowName.trim(), folder_id });
        }
    };

    const isCreating = createFlowMutation.isPending;

    // Create Folder Mutation — replyagent parity (POST /automations/folder/create)
    const createFolderMutation = useMutation({
        mutationFn: async (data: { name: string }) => {
            const res = await apiRequest("POST", "/api/automations/folder/create", data);
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/automations"] });
            setShowFolderModal(false);
            setNewFolderName("");
            toast({ title: "Folder created" });
        },
        onError: (err: Error) => {
            toast({
                title: "Failed to create folder",
                description: err.message,
                variant: "destructive",
            });
        },
    });

    const handleCreateFolder = () => {
        const name = newFolderName.trim();
        if (!name) return;
        createFolderMutation.mutate({ name });
    };

    const handleOpenFlow = (flowId: number) => {
        setLocation(`/automations/${flowId}`);
    };

    // Rename mutation — PATCH /api/automations/:id (replyagent parity: updater_id bump,
    // creator stays immutable). On success: invalidate list + close modal.
    const renameMutation = useMutation({
        mutationFn: async ({ id, name }: { id: number | string; name: string }) => {
            const res = await apiRequest("PATCH", `/api/automations/${id}`, { name });
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/automations"] });
            setRenameTarget(null);
            setRenameValue("");
            toast({ title: "Flow renamed" });
        },
        onError: (err: Error) => {
            toast({ title: "Rename failed", description: err.message, variant: "destructive" });
        },
    });

    // Change folder mutation — POST /api/automations/folder/change
    const changeFolderMutation = useMutation({
        mutationFn: async ({ automation_id, folder_id }: { automation_id: number | string; folder_id: string }) => {
            const res = await apiRequest("POST", "/api/automations/folder/change", {
                automation_id,
                folder_id,
            });
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/automations"] });
            setChangeFolderTarget(null);
            setChangeFolderTargetId("");
            toast({ title: "Folder updated" });
        },
        onError: (err: Error) => {
            toast({ title: "Folder change failed", description: err.message, variant: "destructive" });
        },
    });

    // Delete flow mutation — DELETE /api/automations/:id (soft delete + channel unlinks)
    const deleteFlowMutation = useMutation({
        mutationFn: async (id: number | string) => {
            const res = await apiRequest("DELETE", `/api/automations/${id}`);
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/automations"] });
            setDeleteTarget(null);
            toast({ title: "Flow deleted" });
        },
        onError: (err: Error) => {
            toast({ title: "Delete failed", description: err.message, variant: "destructive" });
        },
    });



    // Prepare dropdown options. Each filter dropdown is single-select with an "all"
    // sentinel at the top so the user can return to "no filter" without clearing state.
    const userOptions = [
        { id: "all", name: "All Users" },
        ...mockUsers.map((u: any) => ({
            id: u.id.toString(),
            name: u.name,
            icon: <img src={u.picture} className="w-5 h-5 rounded-full" alt={u.name} />,
        })),
    ];

    const folderOptions = [
        { id: "all", name: "All Folders" },
        ...folders.map((f: any) => ({ id: f.id.toString(), name: f.name }))
    ];

    // Status pills (All / Active / Drafts / Unpublished) with live counts.
    // Counted off the folder+search+user filtered set — but NOT the status
    // filter itself, so each pill keeps showing how many it would select.
    const statusCounts = useMemo(() => {
        let base = flows;
        if (selectedFolders.length > 0 && !selectedFolders.includes("all")) {
            base = base.filter((flow: any) => {
                if (selectedFolders.includes("root") && !flow.folder_id) return true;
                return selectedFolders.includes(flow.folder_id?.toString());
            });
        }
        if (searchText) {
            base = base.filter((flow: any) => flow.name.toLowerCase().includes(searchText.toLowerCase()));
        }
        if (selectedUsers.length > 0 && !selectedUsers.includes("all")) {
            base = base.filter((flow: any) => flow.created_by && selectedUsers.includes(flow.created_by.id.toString()));
        }
        const by = (s: string) => base.filter((f: any) => f.status === s).length;
        return { all: base.length, active: by("active"), draft: by("draft"), unpublished: by("unpublished") };
    }, [flows, selectedFolders, searchText, selectedUsers]);

    const statusPills: Array<{ id: string; label: string; count: number }> = [
        { id: "all", label: "All", count: statusCounts.all },
        { id: "active", label: "Active", count: statusCounts.active },
        { id: "draft", label: "Drafts", count: statusCounts.draft },
        { id: "unpublished", label: "Unpublished", count: statusCounts.unpublished },
    ];

    // Folder name per flow, for the row badge.
    const folderNameById = useMemo(() => {
        const m = new Map<string, string>();
        folders.forEach((f: any) => m.set(String(f.id), f.name));
        return m;
    }, [folders]);

    const totalPages = Math.ceil(filteredFlows.length / rowsPerPage);
    const paginatedFlows = filteredFlows.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);

    return (
        <div className="px-4 pt-8 pb-4 space-y-3 animate-in fade-in duration-700">
            {/* 1. Branded Header Card — standalone floating card with the
                two-layer drop shadow used across the app (broadcasts /
                settings / insights). The old single-card layout squashed
                the header + filters + table together with only a
                border-b divider; splitting them out gives replyagent's
                clear "header floats above the content" cue. */}
            <div className="bg-white dark:bg-slate-900/50 rounded-[20px] border border-slate-200/70 dark:border-slate-800 shadow-[0_10px_28px_-8px_rgba(15,23,42,0.18),0_4px_10px_-2px_rgba(15,23,42,0.08)] dark:shadow-[0_10px_28px_-6px_rgba(0,0,0,0.55),0_4px_10px_-2px_rgba(0,0,0,0.35)] overflow-hidden">
                <div className="py-4 px-5 flex items-center justify-between bg-transparent">
                    <div className="flex items-center gap-4">
                        <div className="p-2 rounded-xl bg-primary/10 text-primary border border-primary/10 shadow-inner">
                            <GitMerge size={20} strokeWidth={2.5} />
                        </div>
                        <div className="space-y-0.5">
                            <h1 className="text-lg font-semibold tracking-tight text-slate-900 dark:text-white">
                                Smart Flows
                            </h1>
                            <p className="text-[11px] font-medium text-slate-600 dark:text-slate-400">
                                Build, manage and automate your multi-channel communication workflows
                            </p>
                        </div>
                    </div>

                    <Button
                        onClick={() => setShowCreateModal(true)}
                        className="h-8 px-4 rounded-lg bg-primary text-primary-foreground font-semibold text-[10px] shadow-lg shadow-primary/20 transition-all duration-300 active:scale-95 flex items-center gap-2 border-0 hover:bg-primary/90 uppercase tracking-widest"
                    >
                        <Plus size={14} strokeWidth={3} />
                        <span>Create Flow</span>
                    </Button>
                </div>
            </div>

            {/* 2. Content Card — filters + table + pagination in their
                own rounded floating card with matching shadow. */}
            <div className="bg-white dark:bg-slate-900/50 rounded-[20px] border border-slate-200/70 dark:border-slate-800 shadow-[0_10px_28px_-8px_rgba(15,23,42,0.18),0_4px_10px_-2px_rgba(15,23,42,0.08)] dark:shadow-[0_10px_28px_-6px_rgba(0,0,0,0.55),0_4px_10px_-2px_rgba(0,0,0,0.35)] overflow-hidden">

                {/* Filters Section */}
                <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800/80 flex items-center justify-between gap-4 bg-white dark:bg-transparent">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                        {/* Folder Dropdown — leads the toolbar (replyagent parity) */}
                        <CustomDropdown
                            options={folderOptions}
                            selected={selectedFolders}
                            onChange={setSelectedFolders}
                            placeholder="All Folders"
                            width="160px"
                            showSearch={true}
                            showSelectedOption={true}
                        />

                        {/* Create Folder Button */}
                        <button
                            className="flex items-center justify-center h-9 w-9 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/50 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-500 hover:text-emerald-600 hover:border-emerald-200 transition-all shadow-sm shrink-0"
                            onClick={() => setShowFolderModal(true)}
                            title="Create New Folder"
                        >
                            <FolderPlus size={16} />
                        </button>

                        <div className="h-4 w-px bg-slate-300 dark:bg-slate-700 mx-1" />

                        {/* Status pills with counts — replaces the status dropdown so
                            the spread of flows is visible at a glance. */}
                        <div className="flex items-center gap-1 rounded-xl bg-slate-100 dark:bg-slate-900/60 p-1">
                            {statusPills.map((pill) => {
                                const activePill = statusFilter.includes(pill.id);
                                return (
                                    <button
                                        key={pill.id}
                                        onClick={() => { setStatusFilter([pill.id]); setCurrentPage(1); }}
                                        className={cn(
                                            "flex items-center gap-1.5 h-7 px-2.5 rounded-lg text-[11px] font-semibold transition-all",
                                            activePill
                                                ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm"
                                                : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200",
                                        )}
                                    >
                                        {pill.label}
                                        <span className={cn(
                                            "px-1.5 py-0.5 rounded-md text-[9px] font-bold tabular-nums",
                                            activePill
                                                ? "bg-primary/10 text-primary"
                                                : "bg-slate-200/70 dark:bg-slate-800 text-slate-500 dark:text-slate-400",
                                        )}>
                                            {pill.count}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                        {/* Search */}
                        <div className="relative w-56 group">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors w-3.5 h-3.5" />
                            <Input
                                type="text"
                                value={searchText}
                                onChange={(e) => setSearchText(e.target.value)}
                                placeholder="Search flows..."
                                className="pl-9 h-9 text-[11px] font-medium w-full border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/50 rounded-xl focus:ring-2 focus:ring-primary/20 transition-all placeholder:text-slate-400 text-slate-800 dark:text-slate-200"
                            />
                        </div>

                        {/* Users Dropdown — single-select */}
                        <CustomDropdown
                            options={userOptions}
                            selected={selectedUsers}
                            onChange={setSelectedUsers}
                            placeholder="All Users"
                            width="170px"
                            showSearch={true}
                            showSelectedOption={true}
                        />
                    </div>

                    {/* Sort dropdown — From newest / From oldest (replyagent parity) */}
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <button className="flex items-center gap-2 h-9 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/50 hover:bg-slate-50 dark:hover:bg-slate-800 text-[11px] font-medium text-slate-700 dark:text-slate-200 shadow-sm transition-all">
                                {sortOrder === 'desc' ? (
                                    <ArrowDownWideNarrow size={14} className="text-slate-500" />
                                ) : (
                                    <ArrowUpWideNarrow size={14} className="text-slate-500" />
                                )}
                                <span>{sortOrder === 'desc' ? 'From newest' : 'From oldest'}</span>
                                <ChevronDown size={12} className="text-slate-400" />
                            </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="rounded-xl p-1.5 min-w-[160px] shadow-xl border border-slate-200 dark:border-slate-800">
                            <DropdownMenuItem
                                onClick={() => setSortOrder('desc')}
                                className="rounded-lg px-3 py-2 text-[12px] font-medium cursor-pointer hover:bg-primary/10 hover:text-primary transition-all gap-2"
                            >
                                <ArrowDownWideNarrow size={14} className="text-slate-400" />
                                From newest
                            </DropdownMenuItem>
                            <DropdownMenuItem
                                onClick={() => setSortOrder('asc')}
                                className="rounded-lg px-3 py-2 text-[12px] font-medium cursor-pointer hover:bg-primary/10 hover:text-primary transition-all gap-2"
                            >
                                <ArrowUpWideNarrow size={14} className="text-slate-400" />
                                From oldest
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>

                {/* 3a. Bulk action toolbar — visible only when ≥1 row is checked */}
                {selectedIds.size > 0 && (
                    <div className="flex items-center justify-between bg-primary/[0.08] border-y border-primary/20 px-5 py-2">
                        <span className="text-[12px] font-semibold text-primary">
                            {selectedIds.size} selected
                        </span>
                        <div className="flex items-center gap-2">
                            <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-[11px]"
                                disabled={!!bulkRunning}
                                onClick={() => runBulk("publish")}
                            >
                                {bulkRunning === "publish" && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
                                Publish
                            </Button>
                            <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-[11px]"
                                disabled={!!bulkRunning}
                                onClick={() => runBulk("unpublish")}
                            >
                                {bulkRunning === "unpublish" && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
                                Unpublish
                            </Button>
                            <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-[11px] text-rose-600 border-rose-200"
                                disabled={!!bulkRunning}
                                onClick={() => runBulk("delete")}
                            >
                                {bulkRunning === "delete" && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
                                Delete
                            </Button>
                            <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 text-[11px]"
                                onClick={clearSelection}
                            >
                                Clear
                            </Button>
                        </div>
                    </div>
                )}

                {/* 3. Table Section */}
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="border-b border-slate-200 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-800/40">
                                <th className="px-3 py-3 w-8">
                                    <input
                                        type="checkbox"
                                        aria-label="Select all visible flows"
                                        checked={paginatedFlows.length > 0 && paginatedFlows.every((f: any) => selectedIds.has(String(f.id)))}
                                        onChange={(e) => {
                                            if (e.target.checked) {
                                                const next = new Set(selectedIds);
                                                paginatedFlows.forEach((f: any) => next.add(String(f.id)));
                                                setSelectedIds(next);
                                            } else {
                                                const next = new Set(selectedIds);
                                                paginatedFlows.forEach((f: any) => next.delete(String(f.id)));
                                                setSelectedIds(next);
                                            }
                                        }}
                                    />
                                </th>
                                {/* Flow takes every spare pixel so Runs / Created by /
                                    Updated at collapse to their content and sit over on
                                    the right, as in the reference. */}
                                <th className="px-5 py-3 text-[10px] font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-widest w-full">Flow</th>
                                <th className="px-5 py-3 text-[10px] font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-widest text-left whitespace-nowrap">Runs</th>
                                <th className="px-5 py-3 text-[10px] font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-widest text-left whitespace-nowrap">Created By</th>
                                <th className="px-5 py-3 text-[10px] font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-widest text-left whitespace-nowrap">Updated At</th>
                                <th className="px-5 py-3 text-[10px] font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-widest text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 dark:divide-slate-800/80">
                            {paginatedFlows.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="py-14 text-center bg-white dark:bg-transparent">
                                        <div className="flex flex-col items-center gap-3">
                                            <div className="p-3.5 rounded-full bg-primary/10 dark:bg-primary/20 text-primary/40 dark:text-primary shadow-inner">
                                                <FolderOpen size={32} strokeWidth={1} />
                                            </div>
                                            <div className="space-y-1">
                                                <p className="text-[14px] font-semibold text-slate-900 dark:text-white uppercase tracking-tight">No Smart Flows found</p>
                                                <p className="text-[11px] font-normal text-slate-400 tracking-wide">Create your first automation workflow</p>
                                            </div>
                                            <Button 
                                                variant="outline" 
                                                onClick={() => setShowCreateModal(true)} 
                                                className="mt-1 h-7.5 px-5 rounded-lg text-[9px] font-semibold border-primary/30 text-primary hover:bg-primary/10 transition-all shadow-sm"
                                            >
                                                CREATE ONE NOW
                                            </Button>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                paginatedFlows.map((flow: any) => (
                                    <tr key={flow.id} className="group hover:bg-primary/[0.06] dark:hover:bg-primary/5 transition-all duration-200">
                                        <td className="px-3 py-4 w-8">
                                            <input
                                                type="checkbox"
                                                aria-label={`Select ${flow.name}`}
                                                checked={selectedIds.has(String(flow.id))}
                                                onChange={() => toggleSelect(String(flow.id))}
                                                onClick={(e) => e.stopPropagation()}
                                            />
                                        </td>
                                        <td className="px-5 py-4">
                                            <div className="flex items-center gap-3">
                                                {/* Flow glyph — tinted by status, mirrors replyagent */}
                                                <span className={cn(
                                                    "h-9 w-9 rounded-xl flex items-center justify-center shrink-0",
                                                    flow.status === "active" ? "bg-violet-100 text-violet-600 dark:bg-violet-500/15 dark:text-violet-400" :
                                                    flow.status === "unpublished" ? "bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400" :
                                                    "bg-amber-50 text-amber-500 dark:bg-amber-500/10 dark:text-amber-400/80"
                                                )}>
                                                    <Workflow size={16} strokeWidth={2} />
                                                </span>
                                                <div className="flex flex-col gap-1.5 min-w-0">
                                                    <button
                                                        onClick={() => handleOpenFlow(flow.id)}
                                                        className="text-[13px] font-semibold text-slate-900 dark:text-white hover:text-primary transition-colors text-left tracking-tight truncate"
                                                    >
                                                        {flow.name}
                                                    </button>
                                                    <div className="flex items-center gap-2">
                                                        {/* Status — dot + label, like the reference */}
                                                        <span className={cn(
                                                            "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-semibold border",
                                                            flow.status === "active" ? "border-emerald-200 text-emerald-700 dark:border-emerald-500/30 dark:text-emerald-400" :
                                                            flow.status === "unpublished" ? "border-amber-200 text-amber-700 dark:border-amber-500/30 dark:text-amber-400" :
                                                            "border-amber-200 text-amber-700 dark:border-amber-500/30 dark:text-amber-400"
                                                        )}>
                                                            <span className={cn(
                                                                "h-1.5 w-1.5 rounded-full",
                                                                flow.status === "active" ? "bg-emerald-500" : "bg-amber-500"
                                                            )} />
                                                            {flow.status === "active" ? "Active" : flow.status === "unpublished" ? "Unpublished" : "Draft"}
                                                        </span>
                                                        {/* Folder badge */}
                                                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-medium border border-slate-200 text-slate-500 dark:border-slate-700 dark:text-slate-400">
                                                            <FolderOpen size={10} />
                                                            {folderNameById.get(String(flow.folder_id)) ?? "No folder"}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-5 py-4 whitespace-nowrap">
                                            <span className="text-[12px] font-semibold text-slate-900 dark:text-white tabular-nums">
                                                {flow.total_runs}
                                            </span>
                                        </td>
                                        <td className="px-5 py-4 whitespace-nowrap">
                                            <div className="flex items-center gap-2 min-w-0">
                                                <div className="w-7 h-7 rounded-full bg-primary/10 dark:bg-primary/20 flex items-center justify-center border border-primary/10 dark:border-primary/20 shrink-0 text-[9px] font-bold text-primary uppercase">
                                                    {flow.created_by ? (
                                                        (() => {
                                                            const f = (flow.created_by.first_name || '').trim();
                                                            const l = (flow.created_by.last_name || '').trim();
                                                            if (f || l) return `${f.charAt(0)}${l.charAt(0)}` || f.charAt(0) || l.charAt(0);
                                                            return (flow.created_by.email || '?').charAt(0).toUpperCase();
                                                        })()
                                                    ) : (
                                                        <User size={13} className="text-primary" />
                                                    )}
                                                </div>
                                                <span className="text-[11.5px] font-medium text-slate-700 dark:text-slate-300 truncate">
                                                    {flow.created_by
                                                        ? `${flow.created_by.first_name || ''} ${flow.created_by.last_name || ''}`.trim() || flow.created_by.email || 'User'
                                                        : 'Unknown'}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-5 py-4 whitespace-nowrap">
                                            {/* Date on top, time beneath — reference layout */}
                                            <div className="flex flex-col leading-tight">
                                                <span className="text-[11.5px] font-semibold text-slate-700 dark:text-slate-300 tabular-nums">
                                                    {flow.updated_at ? formatInWorkspaceTz(flow.updated_at, "dd/MM/yyyy", workspaceTz) : "—"}
                                                </span>
                                                <span className="text-[10px] font-medium text-slate-400 tabular-nums">
                                                    {flow.updated_at
                                                        ? formatInWorkspaceTz(flow.updated_at, "HH:mm", workspaceTz)
                                                        : ""}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-5 py-4 text-right">
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <button className="p-2 rounded-xl hover:bg-white dark:hover:bg-slate-800 hover:shadow-lg transition-all text-slate-400 hover:text-primary border border-transparent hover:border-slate-200 dark:hover:border-slate-700 active:scale-90">
                                                        <MoreVertical size={16} />
                                                    </button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end" className="w-56 p-2 rounded-[16px] border-slate-200 dark:border-slate-800 shadow-2xl bg-white dark:bg-slate-900">
                                                    <DropdownMenuItem onClick={() => handleOpenFlow(flow.id)} className="rounded-xl px-3 py-2 text-[12px] font-semibold cursor-pointer hover:bg-primary/10 dark:hover:bg-primary/20 hover:text-primary transition-all gap-3">
                                                        <Pencil size={15} className="text-slate-400" />
                                                        Edit flow
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem
                                                        onClick={() => { setRenameTarget(flow); setRenameValue(flow.name || ""); }}
                                                        className="rounded-xl px-3 py-2 text-[12px] font-semibold cursor-pointer hover:bg-primary/10 dark:hover:bg-primary/20 hover:text-primary transition-all gap-3"
                                                    >
                                                        <ClipboardCopy size={15} className="text-slate-400" />
                                                        Rename
                                                    </DropdownMenuItem>
                                                    <DropdownMenuSeparator className="my-1.5 bg-slate-200 dark:bg-slate-800" />
                                                    <DropdownMenuItem
                                                        onClick={() => { setChangeFolderTarget(flow); setChangeFolderTargetId(flow.folder_id?.toString() || ""); }}
                                                        className="rounded-xl px-3 py-2 text-[12px] font-semibold cursor-pointer hover:bg-primary/10 dark:hover:bg-primary/20 hover:text-primary transition-all gap-3"
                                                    >
                                                        <FolderOpen size={15} className="text-slate-400" />
                                                        Change Folder
                                                    </DropdownMenuItem>
                                                    <DropdownMenuSeparator className="my-1.5 bg-slate-200 dark:bg-slate-800" />
                                                    <DropdownMenuItem
                                                        onClick={() => setDeleteTarget(flow)}
                                                        className="rounded-xl px-3 py-2 text-[12px] font-semibold text-rose-600 cursor-pointer hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-all gap-3"
                                                    >
                                                        <Trash2 size={15} />
                                                        Delete Flow
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* 4. Modern Pagination Footer */}
                <div className="px-5 py-4 bg-slate-50/50 dark:bg-slate-800/40 border-t border-slate-200 dark:border-slate-800/80 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <span className="text-[11px] font-semibold text-slate-600 uppercase tracking-widest">{filteredFlows.length} Results</span>
                        <div className="h-4 w-px bg-slate-300 dark:bg-slate-700" />
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest">Rows:</span>
                            <Select
                                value={rowsPerPage.toString()}
                                onValueChange={(value) => {
                                    setRowsPerPage(Number(value));
                                    setCurrentPage(1);
                                }}
                            >
                                <SelectTrigger className="w-[65px] h-7.5 text-[11px] font-semibold rounded-lg border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-sm no-focus-outline">
                                    <SelectValue placeholder={rowsPerPage} />
                                </SelectTrigger>
                                <SelectContent className="rounded-[12px] border-slate-200 dark:border-slate-800 p-1">
                                    {[10, 25, 50, 100].map((pageSize) =>(
                                        <SelectItem key={pageSize} value={pageSize.toString()} className="text-[11px] font-semibold rounded-lg cursor-pointer">
                                            {pageSize}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="flex items-center gap-6">
                        <span className="text-[11px] font-semibold text-slate-600 uppercase tracking-widest">
                            Page <span className="text-primary font-semibold">{currentPage}</span> / {Math.max(1, totalPages)}
                        </span>

                        <div className="flex items-center gap-1">
                            <button
                                className="p-1.5 rounded-lg hover:bg-white dark:hover:bg-slate-800 text-slate-400 hover:text-primary disabled:opacity-20 disabled:pointer-events-none transition-all border border-transparent hover:border-slate-200 dark:hover:border-slate-700 shadow-sm hover:shadow-md active:scale-90"
                                onClick={() => setCurrentPage(1)}
                                disabled={currentPage === 1}
                            >
                                <ChevronsLeft size={16} />
                            </button>
                            <button
                                className="p-1.5 rounded-lg hover:bg-white dark:hover:bg-slate-800 text-slate-400 hover:text-primary disabled:opacity-20 disabled:pointer-events-none transition-all border border-transparent hover:border-slate-200 dark:hover:border-slate-700 shadow-sm hover:shadow-md active:scale-90"
                                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                disabled={currentPage === 1}
                            >
                                <ChevronLeft size={16} />
                            </button>
                            <button
                                className="p-1.5 rounded-lg hover:bg-white dark:hover:bg-slate-800 text-slate-400 hover:text-primary disabled:opacity-20 disabled:pointer-events-none transition-all border border-transparent hover:border-slate-200 dark:hover:border-slate-700 shadow-sm hover:shadow-md active:scale-90"
                                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                disabled={currentPage === totalPages || totalPages === 0}
                            >
                                <ChevronRight size={16} />
                            </button>
                            <button
                                className="p-1.5 rounded-lg hover:bg-white dark:hover:bg-slate-800 text-slate-400 hover:text-primary disabled:opacity-20 disabled:pointer-events-none transition-all border border-transparent hover:border-slate-200 dark:hover:border-slate-700 shadow-sm hover:shadow-md active:scale-90"
                                onClick={() => setCurrentPage(totalPages)}
                                disabled={currentPage === totalPages || totalPages === 0}
                            >
                                <ChevronsRight size={16} />
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Create Flow Modal */}
            {showCreateModal && (
                <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-[60] p-4">
                    <div className="bg-white dark:bg-background rounded-lg shadow-xl max-w-lg w-full transform transition-all">
                        <div className="px-6 pt-6 pb-4">
                            <h3 className="text-lg font-medium leading-6 mb-1">Create a Smart Flow</h3>
                        </div>
                        <form onSubmit={(e) => { e.preventDefault(); handleCreateFlow(); }}>
                            <div className="px-6 space-y-5">
                                <div>
                                    <label className="block text-sm font-semibold mb-2">Flow Name</label>
                                    <Input
                                        type="text"
                                        value={newFlowName}
                                        onChange={(e) => setNewFlowName(e.target.value)}
                                        placeholder="Enter flow name..."
                                        className="w-full"
                                        maxLength={250}
                                        autoFocus
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold mb-2">Select Folder</label>
                                    <select className="w-full px-3 py-2 border border-input rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring">
                                        <option value="">Root Folder</option>
                                        {folders.map((folder: any) => (
                                            <option key={folder.id} value={folder.id}>{folder.name}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                            <div className="px-6 py-4 mt-5 flex gap-3 justify-end border-t">
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => {
                                        setShowCreateModal(false);
                                        setNewFlowName("");
                                        // setIsCreating(false);
                                    }}
                                    disabled={isCreating}
                                >
                                    Cancel
                                </Button>
                                <Button
                                    type="submit"
                                    disabled={!newFlowName.trim() || isCreating}
                                    className="min-w-[100px]"
                                >
                                    {isCreating ? (
                                        <>
                                            <svg className="animate-spin -ml-1 mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                            </svg>
                                            Creating...
                                        </>
                                    ) : (
                                        "Create"
                                    )}
                                </Button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Create Folder Modal */}
            {showFolderModal && (
                <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-[60] p-4">
                    <div className="bg-white dark:bg-background rounded-lg shadow-xl max-w-lg w-full transform transition-all">
                        <div className="px-6 pt-6 pb-4">
                            <h3 className="text-lg font-medium leading-6 mb-1">Create New Folder</h3>
                        </div>
                        <form onSubmit={(e) => { e.preventDefault(); handleCreateFolder(); }}>
                            <div className="px-6">
                                <div>
                                    <label className="block text-sm font-semibold mb-2">Folder Name</label>
                                    <Input
                                        type="text"
                                        value={newFolderName}
                                        onChange={(e) => setNewFolderName(e.target.value)}
                                        placeholder="Enter folder name..."
                                        className="w-full"
                                        autoFocus
                                    />
                                </div>
                            </div>
                            <div className="px-6 py-4 mt-5 flex gap-3 justify-end border-t">
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => {
                                        setShowFolderModal(false);
                                        setNewFolderName("");
                                    }}
                                    disabled={createFolderMutation.isPending}
                                >
                                    Cancel
                                </Button>
                                <Button
                                    type="submit"
                                    disabled={!newFolderName.trim() || createFolderMutation.isPending}
                                    className="min-w-[100px]"
                                >
                                    {createFolderMutation.isPending ? (
                                        <>
                                            <svg className="animate-spin -ml-1 mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                            </svg>
                                            Creating...
                                        </>
                                    ) : (
                                        "Create"
                                    )}
                                </Button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Rename Flow Modal */}
            {renameTarget && (
                <Dialog open={!!renameTarget} onOpenChange={(open) => { if (!open) { setRenameTarget(null); setRenameValue(""); } }}>
                    <DialogContent className="sm:max-w-[440px]">
                        <DialogHeader>
                            <DialogTitle>Rename Flow</DialogTitle>
                        </DialogHeader>
                        <form onSubmit={(e) => {
                            e.preventDefault();
                            const name = renameValue.trim();
                            if (!name) return;
                            renameMutation.mutate({ id: renameTarget.id, name });
                        }}>
                            <div className="py-2">
                                <label className="block text-sm font-semibold mb-2">Flow Name</label>
                                <Input
                                    type="text"
                                    value={renameValue}
                                    onChange={(e) => setRenameValue(e.target.value)}
                                    placeholder="Enter new name..."
                                    autoFocus
                                />
                            </div>
                            <div className="flex gap-3 justify-end mt-5">
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => { setRenameTarget(null); setRenameValue(""); }}
                                    disabled={renameMutation.isPending}
                                >
                                    Cancel
                                </Button>
                                <Button
                                    type="submit"
                                    disabled={!renameValue.trim() || renameValue.trim() === renameTarget.name || renameMutation.isPending}
                                    className="min-w-[100px]"
                                >
                                    {renameMutation.isPending ? "Saving..." : "Save"}
                                </Button>
                            </div>
                        </form>
                    </DialogContent>
                </Dialog>
            )}

            {/* Change Folder Modal */}
            {changeFolderTarget && (
                <Dialog open={!!changeFolderTarget} onOpenChange={(open) => { if (!open) { setChangeFolderTarget(null); setChangeFolderTargetId(""); } }}>
                    <DialogContent className="sm:max-w-[440px]">
                        <DialogHeader>
                            <DialogTitle>Change Folder</DialogTitle>
                        </DialogHeader>
                        <div className="py-2">
                            <label className="block text-sm font-semibold mb-2">Select Folder</label>
                            <Select value={changeFolderTargetId} onValueChange={setChangeFolderTargetId}>
                                <SelectTrigger className="w-full">
                                    <SelectValue placeholder="Choose a folder..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {folders.length === 0 ? (
                                        <div className="px-3 py-2 text-sm text-slate-500">No folders yet — create one first.</div>
                                    ) : folders.map((f: any) => (
                                        <SelectItem key={f.id.toString()} value={f.id.toString()}>
                                            {f.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <p className="text-[11px] text-slate-500 mt-2">
                                Currently in: <span className="font-semibold">
                                    {folders.find((f: any) => f.id?.toString() === changeFolderTarget?.folder_id?.toString())?.name || 'No folder'}
                                </span>
                            </p>
                        </div>
                        <div className="flex gap-3 justify-end mt-5">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => { setChangeFolderTarget(null); setChangeFolderTargetId(""); }}
                                disabled={changeFolderMutation.isPending}
                            >
                                Cancel
                            </Button>
                            <Button
                                type="button"
                                onClick={() => {
                                    if (!changeFolderTargetId) return;
                                    changeFolderMutation.mutate({
                                        automation_id: changeFolderTarget.id,
                                        folder_id: changeFolderTargetId,
                                    });
                                }}
                                disabled={!changeFolderTargetId || changeFolderTargetId === changeFolderTarget?.folder_id?.toString() || changeFolderMutation.isPending}
                                className="min-w-[100px]"
                            >
                                {changeFolderMutation.isPending ? "Moving..." : "Move"}
                            </Button>
                        </div>
                    </DialogContent>
                </Dialog>
            )}

            {/* Delete Flow Confirm Modal */}
            {deleteTarget && (
                <Dialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
                    <DialogContent className="sm:max-w-[440px]">
                        <DialogHeader>
                            <DialogTitle>Delete Flow?</DialogTitle>
                        </DialogHeader>
                        <div className="py-2">
                            <p className="text-sm text-slate-600 dark:text-slate-400">
                                <span className="font-semibold text-slate-900 dark:text-white">"{deleteTarget.name}"</span> will be removed and any channel auto-replies linked to it will be unlinked.
                                This action cannot be undone.
                            </p>
                        </div>
                        <div className="flex gap-3 justify-end mt-5">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => setDeleteTarget(null)}
                                disabled={deleteFlowMutation.isPending}
                            >
                                Cancel
                            </Button>
                            <Button
                                type="button"
                                variant="destructive"
                                onClick={() => deleteFlowMutation.mutate(deleteTarget.id)}
                                disabled={deleteFlowMutation.isPending}
                                className="min-w-[100px]"
                            >
                                {deleteFlowMutation.isPending ? "Deleting..." : "Delete"}
                            </Button>
                        </div>
                    </DialogContent>
                </Dialog>
            )}
        </div>
    );
}
