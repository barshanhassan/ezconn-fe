import { useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { Search, RefreshCw, MoreVertical, Download, FileText, Trash2 } from "react-feather";
import { Calendar, ChevronsUpDown, ChevronDown, ChevronUp, ChevronsLeft, ChevronLeft, ChevronRight, ChevronsRight, MessageSquare, Activity } from "lucide-react";
import { DateRange } from "react-day-picker";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import CustomDropdown from "@/components/CustomDropdown";
import { format } from "date-fns";
import React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { formatInWorkspaceTz, useWorkspaceTimezone } from "@/contexts/WorkspaceTimezoneContext";


interface SortEntry {
    id: string;
    column: string;
    direction: "asc" | "desc";
}

interface Conversation {
    id: string;
    customerNumber: string;
    customer: string;
    agent: string;
    agentId: string;
    channel: "whatsapp" | "telegram" | "messenger" | "instagram" | "webchat" | "evolution" | "zapi" | "sms" | "unknown";
    startTime: string;
    duration: string;
    duration_ms?: number;
    status: "Active" | "Queued" | "Completed" | "Unassigned" | "Deleted";
    status_raw?: string;
    messages: number;
    last_message?: { text: string; direction: string; at?: string } | null;
    timeline: string;
    sentiment: string;
    sentimentSummary: string;
}

/**
 * Convert a date-range preset (or custom range) into ISO `date_from` /
 * `date_to` strings the backend `/api/logs/*` endpoints consume. Returns
 * `{}` for the "all time" case so the backend skips the date clause.
 */
function rangeToQuery(
    preset: string,
    custom: DateRange | undefined,
): { date_from?: string; date_to?: string } {
    const now = new Date();
    const startOfDay = (d: Date) => {
        const x = new Date(d);
        x.setHours(0, 0, 0, 0);
        return x;
    };
    const endOfDay = (d: Date) => {
        const x = new Date(d);
        x.setHours(23, 59, 59, 999);
        return x;
    };
    if (preset === "custom") {
        if (custom?.from && custom?.to) {
            return {
                date_from: startOfDay(custom.from).toISOString(),
                date_to: endOfDay(custom.to).toISOString(),
            };
        }
        return {};
    }
    const today = endOfDay(now);
    if (preset === "last-7-days") {
        const from = new Date(now);
        from.setDate(now.getDate() - 7);
        return { date_from: startOfDay(from).toISOString(), date_to: today.toISOString() };
    }
    if (preset === "last-14-days") {
        const from = new Date(now);
        from.setDate(now.getDate() - 14);
        return { date_from: startOfDay(from).toISOString(), date_to: today.toISOString() };
    }
    if (preset === "last-30-days") {
        const from = new Date(now);
        from.setDate(now.getDate() - 30);
        return { date_from: startOfDay(from).toISOString(), date_to: today.toISOString() };
    }
    if (preset === "this-month") {
        const from = new Date(now.getFullYear(), now.getMonth(), 1);
        return { date_from: startOfDay(from).toISOString(), date_to: today.toISOString() };
    }
    if (preset === "this-quarter") {
        const q = Math.floor(now.getMonth() / 3);
        const from = new Date(now.getFullYear(), q * 3, 1);
        return { date_from: startOfDay(from).toISOString(), date_to: today.toISOString() };
    }
    return {};
}


export default function ConversationLogsPage() {
    const { t } = useTranslation();
    const queryClient = useQueryClient();
    const workspaceTz = useWorkspaceTimezone();

    const [search, setSearch] = useState("");
    const [selectedStatus, setSelectedStatus] = useState<string[]>([]);
    const [page, setPage] = useState(1);
    const [rowsPerPage, setRowsPerPage] = useState(10);
    const [dateRangePreset, setDateRangePreset] = useState("last-7-days");
    const [customDateRange, setCustomDateRange] = useState<DateRange | undefined>(undefined);
    const [isCustomDateOpen, setIsCustomDateOpen] = useState(false);

    // Resolve the active date range once per render so both the list + stats
    // queries stay in lockstep.
    const dateQuery = rangeToQuery(dateRangePreset, customDateRange);

    // Comma-joined status list — backend accepts "ACTIVE,COMPLETED" style.
    const statusParam = selectedStatus
        .map((s) => s.toUpperCase())
        .filter(Boolean)
        .join(",");

    const { data: logsResponse, isLoading } = useQuery<{ logs: Conversation[]; total: number }>({
        queryKey: [
            "/api/logs/conversations",
            { page, limit: rowsPerPage, search, status: statusParam, dateRangePreset, customDateRange },
        ],
        queryFn: async () => {
            const params = new URLSearchParams({
                page: page.toString(),
                limit: rowsPerPage.toString(),
            });
            if (search) params.set("search", search);
            if (statusParam) params.set("status", statusParam);
            if (dateQuery.date_from) params.set("date_from", dateQuery.date_from);
            if (dateQuery.date_to) params.set("date_to", dateQuery.date_to);
            const res = await apiRequest(
                "GET",
                `/api/logs/conversations?${params.toString()}`,
            );
            return res.json();
        },
    });

    const { data: statsResponse } = useQuery<{ conversations: any }>({
        queryKey: ["/api/logs/stats", { dateRangePreset, customDateRange }],
        queryFn: async () => {
            const params = new URLSearchParams();
            if (dateQuery.date_from) params.set("date_from", dateQuery.date_from);
            if (dateQuery.date_to) params.set("date_to", dateQuery.date_to);
            const url = params.toString() ? `/api/logs/stats?${params.toString()}` : "/api/logs/stats";
            const res = await apiRequest("GET", url);
            return res.json();
        },
    });

    const conversations = logsResponse?.logs || [];
    const stats = statsResponse?.conversations || {
        total: 0,
        queued: 0,
        active: 0,
        completed: 0,
        resolutionRate: "0%"
    };

    const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
    const [sorts, setSorts] = useState<SortEntry[]>([]);
    const [rowsDropdownOpen, setRowsDropdownOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);


    // Modal State — opens via row "View details" action; fetches the full
    // thread (last N messages) from `/api/logs/conversations/:id`.
    const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
    const [viewDetailsOpen, setViewDetailsOpen] = useState(false);

    const handleViewDetails = (conv: Conversation) => {
        setSelectedConversation(conv);
        setViewDetailsOpen(true);
    };

    const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

    const deleteMutation = useMutation({
        mutationFn: async (id: string) => {
            const res = await apiRequest("DELETE", `/api/logs/conversations/${id}`);
            return res.json();
        },
        onSuccess: () => {
            setDeleteConfirmId(null);
            queryClient.invalidateQueries({ queryKey: ["/api/logs/conversations"] });
            queryClient.invalidateQueries({ queryKey: ["/api/logs/stats"] });
        },
    });

    // Fetch the conversation thread when the modal opens. Lazy — won't fire
    // until the user actually clicks a row.
    const { data: detailData, isLoading: detailLoading } = useQuery<{
        conversation: Conversation;
        messages: Array<{ id: string; direction: string; text: string; type: string; status: string | null; created_at: string | null }>;
    }>({
        queryKey: ["/api/logs/conversations", selectedConversation?.id, "detail"],
        queryFn: async () => {
            if (!selectedConversation) return { conversation: null as any, messages: [] };
            const res = await apiRequest(
                "GET",
                `/api/logs/conversations/${selectedConversation.id}?messages_limit=50`,
            );
            return res.json();
        },
        enabled: !!selectedConversation && viewDetailsOpen,
    });

    // Match the inbox_status enum (UPPERCASE) but show friendly labels —
    // statusToLabel in the backend maps UNASSIGNED → "Queued" so we mirror
    // those labels here.
    const statusOptions = [
        { id: "ACTIVE", name: t("conversation_logs_page.status_active") },
        { id: "UNASSIGNED", name: t("conversation_logs_page.status_queued") },
        { id: "COMPLETED", name: t("conversation_logs_page.status_completed") },
        { id: "DELETED", name: t("conversation_logs_page.status_deleted") },
    ];

    const kpiData = {
        totalConversations: stats.total,
        queued: stats.queued,
        active: stats.active,
        completed: stats.completed,
        resolutionRate: stats.resolutionRate,
    };

    const toggleRowSelection = (id: string) => {
        const newSelected = new Set(selectedRows);
        if (newSelected.has(id)) {
            newSelected.delete(id);
        } else {
            newSelected.add(id);
        }
        setSelectedRows(newSelected);
    };

    const toggleAllRows = () => {
        // Backend already handles search / status / date filters, so we
        // select directly over the rendered list.
        if (selectedRows.size === conversations.length) {
            setSelectedRows(new Set());
        } else {
            setSelectedRows(new Set(conversations.map((c) => c.id)));
        }
    };

    const renderSortIcon = (column: string) => {
        const sort = sorts.find(s => s.column === column);
        const isActive = !!sort;
        const color = isActive ? "text-foreground" : "text-muted-foreground";

        if (!sort) {
            return <div className="w-4 h-4 flex items-center justify-center"><ChevronsUpDown size={14} className={color} /></div>;
        }
        if (sort.direction === "asc") {
            return <div className="w-4 h-4 flex items-center justify-center"><ChevronUp size={14} className={color} /></div>;
        }
        return <div className="w-4 h-4 flex items-center justify-center"><ChevronDown size={14} className={color} /></div>;
    };

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setRowsDropdownOpen(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleColumnSort = (column: string) => {
        const existingSort = sorts.find(s => s.column === column);
        if (existingSort) {
            if (existingSort.direction === "asc") {
                setSorts([{ id: existingSort.id, column, direction: "desc" }]);
            } else {
                setSorts([]);
            }
        } else {
            setSorts([{ id: Date.now().toString(), column, direction: "asc" }]);
        }
    };

    /**
     * Apply local sort only — search / status / date filtering happens
     * server-side (single source of truth). Sorting client-side is fine
     * because the user can only see one page at a time anyway.
     */
    const getFilteredAndSortedData = () => {
        if (sorts.length === 0) return conversations;
        const data = [...conversations];
        data.sort((a, b) => {
            for (const sort of sorts) {
                const aVal = a[sort.column as keyof Conversation];
                const bVal = b[sort.column as keyof Conversation];

                let comparison = 0;
                if (typeof aVal === "string" && typeof bVal === "string") {
                    comparison = sort.direction === "asc" ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
                } else if (typeof aVal === "number" && typeof bVal === "number") {
                    comparison = sort.direction === "asc" ? aVal - bVal : bVal - aVal;
                }
                if (comparison !== 0) return comparison;
            }
            return 0;
        });
        return data;
    };

    const handleExportSelectedAsCSV = () => {
        if (selectedRows.size === 0) {
            return;
        }

        const selectedConversations = conversations.filter(c => selectedRows.has(c.id));

        const escapeCSV = (value: string | number) => {
            const str = String(value);
            if (str.includes(",") || str.includes('"') || str.includes("\n")) {
                return `"${str.replace(/"/g, '""')}"`;
            }
            return str;
        };

        const headers = [
            t("conversation_logs_page.csv_customer_number"),
            t("conversation_logs_page.csv_customer_name"),
            t("conversation_logs_page.csv_started_time"),
            t("conversation_logs_page.csv_duration"),
            t("conversation_logs_page.csv_agent_name"),
            t("conversation_logs_page.csv_agent_id"),
            t("conversation_logs_page.csv_status"),
            t("conversation_logs_page.csv_number_of_messages"),
            t("conversation_logs_page.csv_conversation_timeline"),
            t("conversation_logs_page.csv_sentiment"),
            t("conversation_logs_page.csv_sentiment_summary"),
        ];

        const rows = selectedConversations.map(conv => [
            escapeCSV(conv.customerNumber),
            escapeCSV(conv.customer),
            escapeCSV(conv.startTime),
            escapeCSV(conv.duration),
            escapeCSV(conv.agent),
            escapeCSV(conv.agentId),
            escapeCSV(conv.status),
            escapeCSV(conv.messages),
            escapeCSV(conv.timeline),
            escapeCSV(conv.sentiment),
            escapeCSV(conv.sentimentSummary),
        ]);

        const csvContent = [
            headers.join(","),
            ...rows.map(row => row.join(",")),
        ].join("\n");

        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);

        link.setAttribute("href", url);
        link.setAttribute("download", `conversations_${new Date().toISOString().split("T")[0]}.csv`);
        link.style.visibility = "hidden";

        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleExportSingleAsCSV = (conv: Conversation) => {
        const escapeCSV = (value: string | number) => {
            const str = String(value);
            if (str.includes(",") || str.includes('"') || str.includes("\n")) {
                return `"${str.replace(/"/g, '""')}"`;
            }
            return str;
        };

        const headers = [
            t("conversation_logs_page.csv_customer_number"),
            t("conversation_logs_page.csv_customer_name"),
            t("conversation_logs_page.csv_started_time"),
            t("conversation_logs_page.csv_duration"),
            t("conversation_logs_page.csv_agent_name"),
            t("conversation_logs_page.csv_agent_id"),
            t("conversation_logs_page.csv_status"),
            t("conversation_logs_page.csv_number_of_messages"),
            t("conversation_logs_page.csv_conversation_timeline"),
            t("conversation_logs_page.csv_sentiment"),
            t("conversation_logs_page.csv_sentiment_summary"),
        ];

        const row = [
            escapeCSV(conv.customerNumber),
            escapeCSV(conv.customer),
            escapeCSV(conv.startTime),
            escapeCSV(conv.duration),
            escapeCSV(conv.agent),
            escapeCSV(conv.agentId),
            escapeCSV(conv.status),
            escapeCSV(conv.messages),
            escapeCSV(conv.timeline),
            escapeCSV(conv.sentiment),
            escapeCSV(conv.sentimentSummary),
        ];

        const csvContent = [
            headers.join(","),
            row.join(","),
        ].join("\n");

        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);

        link.setAttribute("href", url);
        link.setAttribute("download", `conversation_${conv.id}_${new Date().toISOString().split("T")[0]}.csv`);
        link.style.visibility = "hidden";

        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    // Backend paginates + filters; we apply only the local sort here.
    const paginatedData = getFilteredAndSortedData();
    const totalPages = Math.max(1, Math.ceil((logsResponse?.total || 0) / rowsPerPage));

    const handleRefresh = () => {
        queryClient.invalidateQueries({ queryKey: ["/api/logs/conversations"] });
        queryClient.invalidateQueries({ queryKey: ["/api/logs/stats"] });
    };

    return (
        <div className="animate-in fade-in duration-700 p-6 space-y-3">
            {/* 1. Branded Header Card — standalone floating card with the
                shared two-layer drop shadow. */}
            <div className="bg-white dark:bg-slate-900/50 rounded-[20px] border border-slate-200/70 dark:border-slate-800 shadow-[0_10px_28px_-8px_rgba(15,23,42,0.18),0_4px_10px_-2px_rgba(15,23,42,0.08)] dark:shadow-[0_10px_28px_-6px_rgba(0,0,0,0.55),0_4px_10px_-2px_rgba(0,0,0,0.35)] overflow-hidden">
                <div className="py-2 px-5 flex items-center justify-between bg-transparent">
                    <div className="flex items-center gap-6">
                        <div className="p-2 rounded-xl bg-primary/10 text-primary border border-primary/10 shadow-inner">
                            <MessageSquare size={20} strokeWidth={2.5} />
                        </div>
                        <div className="space-y-0.5">
                            <h1 className="text-lg font-bold tracking-tight text-slate-900 dark:text-white">
                                {t("conversation_logs_page.title")}
                            </h1>
                            <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                                {t("conversation_logs_page.subtitle")}
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-8 w-8 p-0 rounded-lg border-slate-200 dark:border-slate-800 hover:bg-white dark:hover:bg-slate-800 transition-all shadow-sm"
                                    onClick={handleRefresh}
                                >
                                    <RefreshCw size={14} className={cn("text-slate-500", isLoading && "animate-spin")} />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent className="text-[10px]">{t("conversation_logs_page.refresh_logs")}</TooltipContent>
                        </Tooltip>
                    </div>
                </div>
            </div>

            {/* 2. Content Card — everything else in its own floating card. */}
            <div className="bg-white dark:bg-slate-900/50 rounded-[20px] border border-slate-200/70 dark:border-slate-800 shadow-[0_10px_28px_-8px_rgba(15,23,42,0.18),0_4px_10px_-2px_rgba(15,23,42,0.08)] dark:shadow-[0_10px_28px_-6px_rgba(0,0,0,0.55),0_4px_10px_-2px_rgba(0,0,0,0.35)] flex flex-col overflow-hidden">

                {/* 2. Compact Stats Row (Integrated) */}
                <div className="grid grid-cols-2 md:grid-cols-5 border-b border-slate-200 dark:border-slate-800/80 divide-x divide-slate-100 dark:divide-slate-800/50">
                    <div className="p-4 bg-slate-50/30 dark:bg-transparent">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">{t("conversation_logs_page.stat_total_conversations")}</p>
                        <div className="flex items-baseline gap-2">
                            <p className="text-xl font-bold text-slate-900 dark:text-white">{kpiData.totalConversations}</p>
                            <span className="text-[10px] font-medium text-slate-400">{t("conversation_logs_page.stat_total_suffix")}</span>
                        </div>
                    </div>
                    <div className="p-4">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">{t("conversation_logs_page.stat_queued")}</p>
                        <div className="flex items-baseline gap-2">
                            <p className="text-xl font-bold text-amber-600">{kpiData.queued}</p>
                            <span className="text-[10px] font-medium text-slate-400">{t("conversation_logs_page.stat_waiting_suffix")}</span>
                        </div>
                    </div>
                    <div className="p-4">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">{t("conversation_logs_page.stat_active")}</p>
                        <div className="flex items-baseline gap-2">
                            <p className="text-xl font-bold text-blue-600">{kpiData.active}</p>
                            <span className="text-[10px] font-medium text-slate-400">{t("conversation_logs_page.stat_in_progress_suffix")}</span>
                        </div>
                    </div>
                    <div className="p-4">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">{t("conversation_logs_page.stat_completed")}</p>
                        <div className="flex items-baseline gap-2">
                            <p className="text-xl font-bold text-emerald-600">{kpiData.completed}</p>
                            <span className="text-[10px] font-medium text-slate-400">{t("conversation_logs_page.stat_resolved_suffix")}</span>
                        </div>
                    </div>
                    <div className="p-4">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">{t("conversation_logs_page.stat_resolution_rate")}</p>
                        <div className="flex items-baseline gap-2">
                            <p className="text-xl font-bold text-indigo-600">{kpiData.resolutionRate}</p>
                            <span className="text-[10px] font-medium text-slate-400">{t("conversation_logs_page.stat_success_suffix")}</span>
                        </div>
                    </div>
                </div>

                {/* 3. Unified Filter Row Section */}
                <div className="px-3 py-1.5 border-b border-slate-200 dark:border-slate-800/80 bg-white dark:bg-transparent flex items-center gap-2 flex-wrap">
                    <div className="relative group flex-1 min-w-[200px] max-w-[280px]">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <Search className="h-3.5 w-3.5 text-slate-400 group-focus-within:text-primary transition-colors" />
                        </div>
                        <input
                            type="text"
                            placeholder={t("conversation_logs_page.search_placeholder")}
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="block w-full pl-9 pr-3 h-9 bg-slate-50/50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 rounded-xl text-[12px] font-medium placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/10 focus:border-primary/50 focus:bg-white dark:focus:bg-slate-900 transition-all duration-200 shadow-sm shadow-slate-100/50 dark:shadow-none"
                        />
                    </div>

                    <div className="flex items-center gap-2 ml-auto">
                        <Select value={dateRangePreset} onValueChange={(v) => { setDateRangePreset(v); setPage(1); }}>
                            <SelectTrigger style={{ borderRadius: '6px' }} className="h-9 w-[140px] !rounded-md border border-input bg-white dark:bg-slate-800/50 text-[12px] font-medium shadow-sm hover:bg-slate-50 transition-all">
                                <Calendar className="h-3.5 w-3.5 mr-2 text-slate-400" />
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="rounded-xl border border-input dark:border-slate-800 shadow-xl">
                                <SelectItem value="last-7-days" className="text-xs">{t("conversation_logs_page.range_last_7_days")}</SelectItem>
                                <SelectItem value="last-14-days" className="text-xs">{t("conversation_logs_page.range_last_14_days")}</SelectItem>
                                <SelectItem value="last-30-days" className="text-xs">{t("conversation_logs_page.range_last_30_days")}</SelectItem>
                                <SelectItem value="this-month" className="text-xs">{t("conversation_logs_page.range_this_month")}</SelectItem>
                                <SelectItem value="this-quarter" className="text-xs">{t("conversation_logs_page.range_this_quarter")}</SelectItem>
                                <SelectItem value="custom" className="text-xs text-primary font-bold">{t("conversation_logs_page.range_custom")}</SelectItem>
                            </SelectContent>
                        </Select>

                        {dateRangePreset === "custom" && (
                            <Popover open={isCustomDateOpen} onOpenChange={setIsCustomDateOpen}>
                                <PopoverTrigger asChild>
                                    <Button variant="outline" style={{ borderRadius: '6px' }} className="h-9 px-3 !rounded-md border border-input bg-white dark:bg-slate-800/50 text-[11px] font-medium gap-2 shadow-sm">
                                        <Calendar className="h-3.5 w-3.5 text-slate-400" />
                                        <span>
                                            {customDateRange?.from ? format(customDateRange.from, 'dd/MM') : t("conversation_logs_page.range_start")} - {customDateRange?.to ? format(customDateRange.to, 'dd/MM') : t("conversation_logs_page.range_end")}
                                        </span>
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0 rounded-2xl border border-input dark:border-slate-800 shadow-2xl overflow-hidden" align="end">
                                    <CalendarComponent
                                        mode="range"
                                        selected={customDateRange}
                                        onSelect={setCustomDateRange}
                                        className="bg-white dark:bg-slate-900"
                                    />
                                </PopoverContent>
                            </Popover>
                        )}

                        <CustomDropdown
                            options={statusOptions}
                            selected={selectedStatus}
                            onChange={(v) => { setSelectedStatus(v); setPage(1); }}
                            placeholder={t("conversation_logs_page.status_placeholder")}
                            width="140px"
                            showSelectedOption={true}
                            showSearch={false}
                            className="!w-[140px]"
                            popoutAlign="right"
                            triggerContent={
                                <>
                                    <div className="flex items-center gap-2 truncate">
                                        <Activity className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                                        <span className={cn("truncate text-[12px]", selectedStatus.length > 0 ? "text-slate-900 dark:text-white font-bold" : "text-slate-500 dark:text-slate-400")}>
                                            {selectedStatus.length === 0
                                                ? t("conversation_logs_page.status_placeholder")
                                                : selectedStatus.map(id => statusOptions.find(o => o.id === id)?.name ?? id).join(", ")}
                                        </span>
                                    </div>
                                    <ChevronDown className="h-3.5 w-3.5 text-slate-400/50 shrink-0" />
                                </>
                            }
                        />
                    </div>
                </div>

                {/* 4. Table Content Area */}
                <div className="flex-1 overflow-auto min-h-[300px]">
                    {selectedRows.size > 0 && (
                        <div className="flex items-center gap-3 px-5 py-2 bg-primary/[0.06] dark:bg-primary/5 border-b border-primary/20 dark:border-primary/20 animate-in slide-in-from-top-2">
                            <span className="text-[11px] font-bold text-primary uppercase tracking-widest">{t("conversation_logs_page.selected_count", { count: selectedRows.size })}</span>
                            <div className="flex gap-1 ml-auto">
                                <Button
                                    onClick={handleExportSelectedAsCSV}
                                    variant="outline"
                                    className="h-7 px-3 rounded-md border-primary/30 text-primary gap-2 text-[10px] font-bold hover:bg-primary hover:text-primary-foreground transition-all"
                                >
                                    <Download size={12} />
                                    {t("conversation_logs_page.export_selected")}
                                </Button>
                            </div>
                        </div>
                    )}

                    <table className="w-full text-left border-separate border-spacing-0">
                        <thead className="sticky top-0 z-10 bg-slate-50/80 dark:bg-slate-900/80 backdrop-blur-md">
                            <tr>
                                <th className="px-5 py-3 border-b border-slate-200 dark:border-slate-800 w-10">
                                    <Checkbox
                                        checked={selectedRows.size > 0 && selectedRows.size === getFilteredAndSortedData().length}
                                        onCheckedChange={toggleAllRows}
                                        className="rounded-[4px] border-slate-300 dark:border-slate-700"
                                    />
                                </th>
                                <th
                                    onClick={() => handleColumnSort("customer")}
                                    className="px-5 py-3 text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider border-b border-slate-200 dark:border-slate-800 cursor-pointer hover:bg-slate-100/50 transition-colors"
                                >
                                    <div className="flex items-center gap-2">
                                        {t("conversation_logs_page.col_customer")} {renderSortIcon("customer")}
                                    </div>
                                </th>
                                <th
                                    onClick={() => handleColumnSort("channel")}
                                    className="px-5 py-3 text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider border-b border-slate-200 dark:border-slate-800 cursor-pointer hover:bg-slate-100/50 transition-colors"
                                >
                                    <div className="flex items-center gap-2">
                                        {t("conversation_logs_page.col_channel")} {renderSortIcon("channel")}
                                    </div>
                                </th>
                                <th
                                    onClick={() => handleColumnSort("agent")}
                                    className="px-5 py-3 text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider border-b border-slate-200 dark:border-slate-800 cursor-pointer hover:bg-slate-100/50 transition-colors"
                                >
                                    <div className="flex items-center gap-2">
                                        {t("conversation_logs_page.col_agent")} {renderSortIcon("agent")}
                                    </div>
                                </th>
                                <th 
                                    onClick={() => handleColumnSort("startTime")}
                                    className="px-5 py-3 text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider border-b border-slate-200 dark:border-slate-800 cursor-pointer hover:bg-slate-100/50 transition-colors"
                                >
                                    <div className="flex items-center gap-2">
                                        {t("conversation_logs_page.col_start_time")} {renderSortIcon("startTime")}
                                    </div>
                                </th>
                                <th 
                                    onClick={() => handleColumnSort("duration")}
                                    className="px-5 py-3 text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider border-b border-slate-200 dark:border-slate-800 cursor-pointer hover:bg-slate-100/50 transition-colors"
                                >
                                    <div className="flex items-center gap-2">
                                        {t("conversation_logs_page.col_duration")} {renderSortIcon("duration")}
                                    </div>
                                </th>
                                <th 
                                    onClick={() => handleColumnSort("status")}
                                    className="px-5 py-3 text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider border-b border-slate-200 dark:border-slate-800 cursor-pointer hover:bg-slate-100/50 transition-colors"
                                >
                                    <div className="flex items-center gap-2">
                                        {t("conversation_logs_page.col_status")} {renderSortIcon("status")}
                                    </div>
                                </th>
                                <th 
                                    onClick={() => handleColumnSort("messages")}
                                    className="px-5 py-3 text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider border-b border-slate-200 dark:border-slate-800 cursor-pointer hover:bg-slate-100/50 transition-colors text-center"
                                >
                                    <div className="flex items-center justify-center gap-2">
                                        {t("conversation_logs_page.col_messages")} {renderSortIcon("messages")}
                                    </div>
                                </th>
                                <th className="px-5 py-3 text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider border-b border-slate-200 dark:border-slate-800 w-20">
                                    {t("conversation_logs_page.col_actions")}
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                            {paginatedData.length === 0 ? (
                                <tr>
                                    <td colSpan={9} className="py-20 text-center">
                                        <div className="flex flex-col items-center gap-3">
                                            <div className="p-4 rounded-full bg-slate-50 dark:bg-slate-800">
                                                <Search className="w-8 h-8 text-slate-300" />
                                            </div>
                                            <p className="text-sm font-medium text-slate-400">{t("conversation_logs_page.empty_state")}</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                paginatedData.map((conv) => (
                                    <tr 
                                        key={conv.id} 
                                        className="group hover:bg-primary/[0.06] dark:hover:bg-primary/5 transition-all duration-200"
                                    >
                                        <td className="px-5 py-2.5">
                                            <Checkbox
                                                checked={selectedRows.has(conv.id)}
                                                onCheckedChange={() => toggleRowSelection(conv.id)}
                                                className="rounded-[4px] border-slate-300 dark:border-slate-700"
                                            />
                                        </td>
                                        <td className="px-5 py-2.5">
                                            <div className="flex flex-col">
                                                <span className="text-[13px] font-semibold text-slate-700 dark:text-slate-200 line-clamp-1">{conv.customer}</span>
                                                <span className="text-[10px] text-slate-400">{conv.customerNumber}</span>
                                            </div>
                                        </td>
                                        <td className="px-5 py-2.5">
                                            {/* Channel pill — brand SVG when we have one, else a neutral
                                                badge with the channel name. Keeps the row compact. */}
                                            <div className="flex items-center gap-2">
                                                {["whatsapp", "telegram", "messenger", "instagram"].includes(conv.channel) ? (
                                                    <img
                                                        src={`/images/automations/${conv.channel}.svg`}
                                                        alt={conv.channel}
                                                        className="w-4 h-4"
                                                    />
                                                ) : (
                                                    <div className="w-4 h-4 rounded bg-slate-200 dark:bg-slate-700" />
                                                )}
                                                <span className="text-[11px] font-medium text-slate-600 dark:text-slate-300 capitalize">
                                                    {conv.channel === "sms" ? t("conversation_logs_page.channel_sms") : conv.channel === "zapi" ? "Z-API" : conv.channel}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-5 py-2.5">
                                            <div className="flex items-center gap-2">
                                                <div className="w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-[10px] font-bold text-slate-500 uppercase">
                                                    {(conv.agent ?? '—').substring(0, 1)}
                                                </div>
                                                <span className="text-[12px] font-medium text-slate-600 dark:text-slate-300">{conv.agent ?? t("conversation_logs_page.unassigned")}</span>
                                            </div>
                                        </td>
                                        <td className="px-5 py-2.5 text-[12px] text-slate-500 dark:text-slate-400 font-medium">
                                            {conv.startTime
                                                ? formatInWorkspaceTz(conv.startTime, "dd MMM yyyy, HH:mm", workspaceTz)
                                                : "—"}
                                        </td>
                                        <td className="px-5 py-2.5 text-[12px] text-slate-500 dark:text-slate-400 font-medium">
                                            {conv.duration}
                                        </td>
                                        <td className="px-5 py-2.5">
                                            <span className={cn(
                                                "inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wide uppercase",
                                                conv.status === "Completed" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400" :
                                                conv.status === "Active" ? "bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400" :
                                                conv.status === "Queued" ? "bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400" :
                                                conv.status === "Deleted" ? "bg-rose-100 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400" :
                                                "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                                            )}>
                                                {conv.status}
                                            </span>
                                        </td>
                                        <td className="px-5 py-2.5">
                                            <div className="flex justify-center">
                                                <span className="inline-flex items-center justify-center px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-[11px] font-bold text-slate-600 dark:text-slate-400 min-w-[24px]">
                                                    {conv.messages}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-5 py-2.5">
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button 
                                                        variant="ghost" 
                                                        className="h-8 w-8 p-0 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
                                                    >
                                                        <MoreVertical size={14} className="text-slate-400" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end" className="w-40 p-1 rounded-xl shadow-xl border-slate-200 dark:border-slate-800">
                                                    <DropdownMenuItem
                                                        onClick={() => handleViewDetails(conv)}
                                                        className="flex items-center gap-2 px-2 py-1.5 text-xs font-medium rounded-lg cursor-pointer transition-colors"
                                                    >
                                                        <FileText size={13} className="text-primary" />
                                                        {t("conversation_logs_page.view_details")}
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem
                                                        onClick={() => handleExportSingleAsCSV(conv)}
                                                        className="flex items-center gap-2 px-2 py-1.5 text-xs font-medium rounded-lg cursor-pointer transition-colors"
                                                    >
                                                        <Download size={13} className="text-emerald-500" />
                                                        {t("conversation_logs_page.export_csv")}
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem
                                                        onClick={() => setDeleteConfirmId(conv.id)}
                                                        className="flex items-center gap-2 px-2 py-1.5 text-xs font-medium rounded-lg cursor-pointer transition-colors text-red-500 focus:text-red-500 focus:bg-red-50 dark:focus:bg-red-500/10"
                                                    >
                                                        <Trash2 size={13} className="text-red-500" />
                                                        {t("conversation_logs_page.delete")}
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

                {/* 5. Footer / Pagination Section */}
                <div className="px-5 py-2 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-transparent flex items-center justify-between">
                    <div className="flex items-center gap-4 text-[11px] font-medium text-slate-500">
                        <span>{t("conversation_logs_page.results_found", { count: logsResponse?.total || 0 })}</span>
                        <div className="h-4 w-px bg-slate-300 dark:bg-slate-700" />
                        <div className="flex items-center gap-2">
                            <span>{t("conversation_logs_page.show")}</span>
                            <div className="relative" ref={dropdownRef}>
                                <button
                                    type="button"
                                    className="flex items-center gap-1.5 px-2 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md hover:bg-slate-50 transition-colors"
                                    onClick={() => setRowsDropdownOpen(!rowsDropdownOpen)}
                                >
                                    <span className="font-bold text-slate-700 dark:text-slate-200">{rowsPerPage}</span>
                                    <ChevronDown size={10} className="text-slate-400" />
                                </button>
                                {rowsDropdownOpen && (
                                    <div className="absolute bottom-full left-0 mb-1 z-50 w-16 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl overflow-hidden animate-in slide-in-from-bottom-1">
                                        {[10, 25, 50].map(option => (
                                            <button
                                                key={option}
                                                className="w-full px-3 py-1.5 text-left hover:bg-primary/10 dark:hover:bg-primary/15 text-slate-600 dark:text-slate-300 transition-colors font-medium"
                                                onClick={() => {
                                                    setRowsPerPage(option);
                                                    setPage(1);
                                                    setRowsDropdownOpen(false);
                                                }}
                                            >
                                                {option}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1 text-[11px] font-bold text-slate-500 mr-2">
                            <span>{t("conversation_logs_page.page")}</span>
                            <span className="text-slate-900 dark:text-white">{page}</span>
                            <span>{t("conversation_logs_page.of")}</span>
                            <span>{totalPages || 1}</span>
                        </div>
                        <div className="flex items-center gap-1">
                            <Button
                                variant="outline"
                                size="icon"
                                className="h-7 w-7 rounded-md border-slate-200 dark:border-slate-800 shadow-sm"
                                onClick={() => setPage(1)}
                                disabled={page === 1}
                            >
                                <ChevronsLeft size={12} />
                            </Button>
                            <Button
                                variant="outline"
                                size="icon"
                                className="h-7 w-7 rounded-md border-slate-200 dark:border-slate-800 shadow-sm"
                                onClick={() => setPage(prev => Math.max(1, prev - 1))}
                                disabled={page === 1}
                            >
                                <ChevronLeft size={12} />
                            </Button>
                            <Button
                                variant="outline"
                                size="icon"
                                className="h-7 w-7 rounded-md border-slate-200 dark:border-slate-800 shadow-sm"
                                onClick={() => setPage(prev => Math.min(totalPages, prev + 1))}
                                disabled={page === totalPages}
                            >
                                <ChevronRight size={12} />
                            </Button>
                            <Button
                                variant="outline"
                                size="icon"
                                className="h-7 w-7 rounded-md border-slate-200 dark:border-slate-800 shadow-sm"
                                onClick={() => setPage(totalPages)}
                                disabled={page === totalPages}
                            >
                                <ChevronsRight size={12} />
                            </Button>
                        </div>
                    </div>
                </div>
            </div>

            {/* View Details Dialog */}
            <Dialog open={viewDetailsOpen} onOpenChange={setViewDetailsOpen}>
                <DialogContent className="max-w-4xl">
                    <DialogHeader className="mb-2">
                        <DialogTitle>{t("conversation_logs_page.details_title")}</DialogTitle>
                    </DialogHeader>
                    {selectedConversation && (
                        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                            {/* Left: meta */}
                            <div className="lg:col-span-2 space-y-4">
                                <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                                    <div>
                                        <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{t("conversation_logs_page.field_customer")}</label>
                                        <p className="mt-1 text-sm font-medium">{selectedConversation.customer}</p>
                                        {selectedConversation.customerNumber && (
                                            <p className="text-xs text-slate-500">{selectedConversation.customerNumber}</p>
                                        )}
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{t("conversation_logs_page.field_agent")}</label>
                                        <p className="mt-1 text-sm font-medium">{selectedConversation.agent || t("conversation_logs_page.unassigned")}</p>
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{t("conversation_logs_page.field_channel")}</label>
                                        <div className="mt-1 flex items-center gap-2">
                                            {["whatsapp", "telegram", "messenger", "instagram"].includes(selectedConversation.channel) ? (
                                                <img
                                                    src={`/images/automations/${selectedConversation.channel}.svg`}
                                                    alt={selectedConversation.channel}
                                                    className="w-4 h-4"
                                                />
                                            ) : null}
                                            <span className="text-sm font-medium capitalize">
                                                {selectedConversation.channel === "sms"
                                                    ? t("conversation_logs_page.channel_sms")
                                                    : selectedConversation.channel === "zapi"
                                                        ? "Z-API"
                                                        : selectedConversation.channel}
                                            </span>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{t("conversation_logs_page.field_status")}</label>
                                        <p className="mt-1">
                                            <span className={cn(
                                                "inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wide uppercase",
                                                selectedConversation.status === "Completed" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400" :
                                                    selectedConversation.status === "Active" ? "bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400" :
                                                        selectedConversation.status === "Queued" ? "bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400" :
                                                            "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
                                            )}>
                                                {selectedConversation.status}
                                            </span>
                                        </p>
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{t("conversation_logs_page.field_started")}</label>
                                        <p className="mt-1 text-xs font-medium">
                                            {selectedConversation.startTime
                                                ? formatInWorkspaceTz(selectedConversation.startTime, "dd MMM yyyy, HH:mm", workspaceTz)
                                                : "—"}
                                        </p>
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{t("conversation_logs_page.field_duration")}</label>
                                        <p className="mt-1 text-xs font-medium">{selectedConversation.duration}</p>
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{t("conversation_logs_page.field_messages")}</label>
                                        <p className="mt-1 text-xs font-medium">{selectedConversation.messages}</p>
                                    </div>
                                </div>
                            </div>

                            {/* Right: message thread (last 50, server-sourced). */}
                            <div className="lg:col-span-3 space-y-3">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-[11px] font-bold uppercase tracking-widest text-slate-500">
                                        {t("conversation_logs_page.last_messages")}
                                    </h3>
                                    {detailData?.messages?.length ? (
                                        <span className="text-[10px] font-medium text-slate-400">
                                            {t("conversation_logs_page.showing_latest", { count: detailData.messages.length })}
                                        </span>
                                    ) : null}
                                </div>
                                <div className="space-y-2 max-h-[420px] overflow-y-auto pr-2 bg-slate-50 dark:bg-slate-900/40 rounded-xl p-3 border border-slate-100 dark:border-slate-800/60">
                                    {detailLoading ? (
                                        <p className="text-xs text-slate-400 text-center py-12">{t("conversation_logs_page.loading")}</p>
                                    ) : detailData?.messages && detailData.messages.length > 0 ? (
                                        // Server returns newest-first; reverse so oldest renders at top
                                        // — matches how a person reads a chat.
                                        [...detailData.messages].reverse().map((m) => {
                                            const outgoing = String(m.direction ?? "").toUpperCase() === "OUTGOING";
                                            return (
                                                <div
                                                    key={m.id}
                                                    className={cn("flex", outgoing ? "justify-end" : "justify-start")}
                                                >
                                                    <div
                                                        className={cn(
                                                            "max-w-[80%] rounded-2xl px-3 py-2 text-[12px] font-medium shadow-sm",
                                                            outgoing
                                                                ? "bg-primary text-primary-foreground rounded-br-sm"
                                                                : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-bl-sm border border-slate-100 dark:border-slate-700",
                                                        )}
                                                    >
                                                        <p className="whitespace-pre-wrap break-words">
                                                            {m.text || <em className="opacity-60">[{m.type || "media"}]</em>}
                                                        </p>
                                                        <p className={cn("text-[9px] mt-1", outgoing ? "opacity-70" : "opacity-50")}>
                                                            {m.created_at
                                                                ? formatInWorkspaceTz(m.created_at, "dd MMM HH:mm", workspaceTz)
                                                                : ""}
                                                        </p>
                                                    </div>
                                                </div>
                                            );
                                        })
                                    ) : (
                                        <p className="text-xs text-slate-400 text-center py-12">
                                            {t("conversation_logs_page.no_messages_found")}
                                        </p>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Modal Footer */}
                    <div className="flex gap-2 justify-end mt-2">
                        <Button
                            onClick={() => setViewDetailsOpen(false)}
                            variant="outline"
                            className="border-input [border-color:hsl(var(--input))] font-normal"
                        >
                            {t("conversation_logs_page.close")}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Delete Confirmation Dialog */}
            <Dialog open={!!deleteConfirmId} onOpenChange={(open) => { if (!open) setDeleteConfirmId(null); }}>
                <DialogContent className="max-w-sm">
                    <DialogHeader>
                        <DialogTitle>{t("conversation_logs_page.delete_conversation_title")}</DialogTitle>
                    </DialogHeader>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                        {t("conversation_logs_page.delete_conversation_confirm")}
                    </p>
                    <div className="flex gap-2 justify-end mt-4">
                        <Button
                            variant="outline"
                            onClick={() => setDeleteConfirmId(null)}
                            disabled={deleteMutation.isPending}
                            className="border-input [border-color:hsl(var(--input))] font-normal"
                        >
                            {t("conversation_logs_page.cancel")}
                        </Button>
                        <Button
                            onClick={() => deleteConfirmId && deleteMutation.mutate(deleteConfirmId)}
                            disabled={deleteMutation.isPending}
                            className="bg-red-500 hover:bg-red-600 text-white font-semibold"
                        >
                            {deleteMutation.isPending ? t("conversation_logs_page.deleting") : t("conversation_logs_page.delete")}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
