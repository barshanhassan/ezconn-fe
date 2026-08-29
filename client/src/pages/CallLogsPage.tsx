import { useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { Search, RefreshCw, MoreVertical, Download, FileText } from "react-feather";
import { Calendar, ChevronsUpDown, ChevronDown, ChevronUp, ChevronsLeft, ChevronLeft, ChevronRight, ChevronsRight, MessageSquare, Mic, Play, Pause, SkipForward, SkipBack, X, Activity } from "lucide-react";
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
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { formatInWorkspaceTz, useWorkspaceTimezone } from "@/contexts/WorkspaceTimezoneContext";

/**
 * Convert a date-range preset (or custom range) into ISO `date_from` /
 * `date_to` strings the backend `/api/logs/*` endpoints consume. Mirrors the
 * helper in ConversationLogsPage — kept inline so both files stay
 * self-contained and easy to grep.
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


interface SortEntry {
    id: string;
    column: string;
    direction: "asc" | "desc";
}

interface CallLog {
    id: string;
    contact: string;
    contactNumber: string;
    contactId?: string | null;
    agent: string;
    agentId: string;
    direction: "Inbound" | "Outbound";
    startTime: string;
    duration: string;
    duration_seconds?: number;
    status: "Completed" | "Missed" | "Declined" | "Failed" | "In Progress";
    status_raw?: string | null;
    sentiment: string;
    sentimentSummary: string;
    recording: boolean;
    recordingUrl?: string | null;
    from_number?: string;
    to_number?: string;
    call_sid?: string | null;
}


export default function CallLogsPage() {
    const { t } = useTranslation();
    const queryClient = useQueryClient();
    const workspaceTz = useWorkspaceTimezone();

    const [search, setSearch] = useState("");
    const [selectedStatus, setSelectedStatus] = useState<string[]>([]);
    const [selectedDirection, setSelectedDirection] = useState<string[]>([]);
    const [page, setPage] = useState(1);
    const [rowsPerPage, setRowsPerPage] = useState(10);
    const [dateRangePreset, setDateRangePreset] = useState("last-7-days");
    const [customDateRange, setCustomDateRange] = useState<DateRange | undefined>(undefined);
    const [isCustomDateOpen, setIsCustomDateOpen] = useState(false);

    // Translate filter state into URL params backend understands.
    const dateQuery = rangeToQuery(dateRangePreset, customDateRange);
    const directionParam = selectedDirection.filter(s => s && s !== "__all__").join(",");
    const statusParam = selectedStatus.filter(s => s && s !== "__all__").join(",");

    const { data: logsResponse, isLoading } = useQuery<{ logs: CallLog[]; total: number }>({
        queryKey: [
            "/api/logs/calls",
            { page, limit: rowsPerPage, search, direction: directionParam, status: statusParam, dateRangePreset, customDateRange },
        ],
        queryFn: async () => {
            const params = new URLSearchParams({
                page: page.toString(),
                limit: rowsPerPage.toString(),
            });
            if (search) params.set("search", search);
            if (directionParam) params.set("direction", directionParam);
            if (statusParam) params.set("status", statusParam);
            if (dateQuery.date_from) params.set("date_from", dateQuery.date_from);
            if (dateQuery.date_to) params.set("date_to", dateQuery.date_to);
            const res = await apiRequest("GET", `/api/logs/calls?${params.toString()}`);
            return res.json();
        },
    });

    const { data: statsResponse } = useQuery<{ calls: any }>({
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

    const handleRefresh = () => {
        queryClient.invalidateQueries({ queryKey: ["/api/logs/calls"] });
        queryClient.invalidateQueries({ queryKey: ["/api/logs/stats"] });
    };

    const callLogs = logsResponse?.logs || [];
    const stats = statsResponse?.calls || {
        total: 0,
        completed: 0,
        inbound: 0,
        outbound: 0,
        avgDuration: "0m 0s"
    };
    const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
    const [callSorts, setCallSorts] = useState<SortEntry[]>([]);
    const [rowsDropdownOpen, setRowsDropdownOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);


    const [speedDropdownOpen, setSpeedDropdownOpen] = useState(false);
    const speedDropdownRef = useRef<HTMLDivElement>(null);

    // Modal State — opens via row "View details" action; fetches the full
    // call detail (recording url + parsed metadata) from
    // `/api/logs/calls/:id`.
    const [selectedCallLog, setSelectedCallLog] = useState<CallLog | null>(null);
    const [viewDetailsOpen, setViewDetailsOpen] = useState(false);

    const handleViewDetails = (call: CallLog) => {
        setSelectedCallLog(call);
        setViewDetailsOpen(true);
    };

    // Lazy fetch — only fires after the user opens the modal.
    const { data: detailData, isLoading: detailLoading } = useQuery<{
        call: CallLog;
        metadata: any;
        twilio_metadata: any;
    }>({
        queryKey: ["/api/logs/calls", selectedCallLog?.id, "detail"],
        queryFn: async () => {
            if (!selectedCallLog) return { call: null as any, metadata: null, twilio_metadata: null };
            const res = await apiRequest("GET", `/api/logs/calls/${selectedCallLog.id}`);
            return res.json();
        },
        enabled: !!selectedCallLog && viewDetailsOpen,
    });
    const [expandedCallId, setExpandedCallId] = useState<string | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentPlayingCallId, setCurrentPlayingCallId] = useState<string | null>(null);
    const audioRef = useRef<HTMLAudioElement>(null);
    const [playbackSpeed, setPlaybackSpeed] = useState(1);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);

    const directionOptions = [
        { id: "Inbound", name: t("call_logs_page.direction_inbound") },
        { id: "Outbound", name: t("call_logs_page.direction_outbound") },
    ];

    const callStatusOptions = [
        { id: "__all__", name: t("call_logs_page.status_all") },
        { id: "Completed", name: t("call_logs_page.status_completed") },
        { id: "Missed", name: t("call_logs_page.status_missed") },
        { id: "Declined", name: t("call_logs_page.status_declined") },
        { id: "Failed", name: t("call_logs_page.status_failed") },
        { id: "In Progress", name: t("call_logs_page.status_in_progress") },
    ];

    const callKpiData = {
        totalCalls: stats.total,
        completed: stats.completed,
        inboundCalls: stats.inbound,
        outboundCalls: stats.outbound,
        avgDuration: stats.avgDuration,
    };

    /**
     * Resolve the recording URL for a call row. Backend's `projectCall()`
     * populates `recordingUrl` from twilio metadata (RecordingUrl) when
     * available. If the row has no recording the audio controls fall back
     * to a disabled state via `call.recording`.
     */
    const getAudioUrl = (callId: string) => {
        const log = callLogs.find((c) => c.id === callId);
        return log?.recordingUrl ?? "";
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
        const data = getFilteredAndSortedCallLogs();
        if (selectedRows.size === data.length) {
            setSelectedRows(new Set());
        } else {
            setSelectedRows(new Set(data.map(c => c.id)));
        }
    };

    const renderCallSortIcon = (column: string) => {
        const sort = callSorts.find(s => s.column === column);
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

    // Audio Player Logic
    useEffect(() => {
        const audio = audioRef.current;
        if (!audio) {
            return;
        }

        const setAudioData = () => {
            setDuration(audio.duration);
            setCurrentTime(audio.currentTime);
        };

        const setAudioTime = () => {
            setCurrentTime(audio.currentTime);
        };
        const setAudioEnded = () => {
            setIsPlaying(false);
        };

        audio.addEventListener('loadedmetadata', setAudioData);
        audio.addEventListener('timeupdate', setAudioTime);
        audio.addEventListener('ended', setAudioEnded);

        return () => {
            audio.removeEventListener('loadedmetadata', setAudioData);
            audio.removeEventListener('timeupdate', setAudioTime);
            audio.removeEventListener('ended', setAudioEnded);
        };
    }, []);

    const playAudio = (callId: string) => {
        const audio = audioRef.current;
        if (audio) {
            const url = getAudioUrl(callId);
            if (audio.src !== url) {
                audio.src = url;
                audio.load();
            }
            audio.playbackRate = playbackSpeed;
            audio.play().then(() => {
                setIsPlaying(true);
                setCurrentPlayingCallId(callId);
            }).catch(error => {
                console.error("Error playing audio:", error);
                setIsPlaying(false);
            });
        }
    };

    const pauseAudio = () => {
        const audio = audioRef.current;
        if (audio) {
            audio.pause();
            setIsPlaying(false);
        }
    };

    const resetPlayerState = () => {
        pauseAudio();
        setCurrentPlayingCallId(null);
        setExpandedCallId(null);
        setCurrentTime(0);
        if (audioRef.current) {
            audioRef.current.currentTime = 0;
        }
    };

    const handlePlayPauseClick = (call: CallLog) => {
        if (expandedCallId === call.id) {
            if (isPlaying) {
                pauseAudio();
            } else {
                playAudio(call.id);
            }
        } else {
            if (currentPlayingCallId) {
                resetPlayerState();
            }
            setExpandedCallId(call.id);
            playAudio(call.id);
        }
    };

    const handleNext = () => {
        const currentCallLogs = getFilteredAndSortedCallLogs();
        const currentIndex = currentCallLogs.findIndex(call => call.id === currentPlayingCallId);
        if (currentIndex !== -1 && currentIndex < currentCallLogs.length - 1) {
            const nextCall = currentCallLogs[currentIndex + 1];
            if (nextCall.recording) {
                playAudio(nextCall.id);
            } else {
                for (let i = currentIndex + 1; i < currentCallLogs.length; i++) {
                    if (currentCallLogs[i].recording) {
                        playAudio(currentCallLogs[i].id);
                        return;
                    }
                }
                pauseAudio();
                setCurrentPlayingCallId(null);
            }
        } else {
            pauseAudio();
            setCurrentPlayingCallId(null);
        }
    };

    const handlePrevious = () => {
        const currentCallLogs = getFilteredAndSortedCallLogs();
        const currentIndex = currentCallLogs.findIndex(call => call.id === currentPlayingCallId);
        if (currentIndex > 0) {
            const prevCall = currentCallLogs[currentIndex - 1];
            if (prevCall.recording) {
                playAudio(prevCall.id);
            } else {
                for (let i = currentIndex - 1; i >= 0; i--) {
                    if (currentCallLogs[i].recording) {
                        playAudio(currentCallLogs[i].id);
                        return;
                    }
                }
                pauseAudio();
                setCurrentPlayingCallId(null);
            }
        } else {
            pauseAudio();
            setCurrentPlayingCallId(null);
        }
    };

    const handleSpeedChange = (speed: number) => {
        setPlaybackSpeed(speed);
        if (audioRef.current) {
            audioRef.current.playbackRate = speed;
        }
    };

    const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
        const audio = audioRef.current;
        if (audio) {
            audio.currentTime = parseFloat(e.target.value);
            setCurrentTime(audio.currentTime);
        }
    };

    const formatTime = (time: number) => {
        const minutes = Math.floor(time / 60);
        const seconds = Math.floor(time % 60);
        return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
    };

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setRowsDropdownOpen(false);
            }
            if (speedDropdownRef.current && !speedDropdownRef.current.contains(event.target as Node)) {
                setSpeedDropdownOpen(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleCallColumnSort = (column: string) => {
        const existingSort = callSorts.find(s => s.column === column);
        if (existingSort) {
            if (existingSort.direction === "asc") {
                setCallSorts([{ id: existingSort.id, column, direction: "desc" }]);
            } else {
                setCallSorts([]);
            }
        } else {
            setCallSorts([{ id: Date.now().toString(), column, direction: "asc" }]);
        }
    };

    /**
     * Apply local sort only — search / direction / status / date filtering
     * all happen server-side (single source of truth). Local sort is fine
     * because the visible page is what's sortable.
     */
    const getFilteredAndSortedCallLogs = () => {
        if (callSorts.length === 0) return callLogs;
        const data = [...callLogs];
        data.sort((a, b) => {
            for (const sort of callSorts) {
                const aVal = a[sort.column as keyof CallLog];
                const bVal = b[sort.column as keyof CallLog];
                let comparison = 0;
                if (typeof aVal === "string" && typeof bVal === "string") {
                    comparison = sort.direction === "asc" ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
                } else if (typeof aVal === "number" && typeof bVal === "number") {
                    comparison = sort.direction === "asc" ? aVal - bVal : bVal - aVal;
                } else if (typeof aVal === "boolean" && typeof bVal === "boolean") {
                    comparison = sort.direction === "asc" ? (aVal === bVal ? 0 : aVal ? 1 : -1) : (aVal === bVal ? 0 : aVal ? -1 : 1);
                }
                if (comparison !== 0) return comparison;
            }
            return 0;
        });
        return data;
    };

    const handleExportSelectedCallLogsAsCSV = () => {
        if (selectedRows.size === 0) return;

        const selectedCallLogs = callLogs.filter(c => selectedRows.has(c.id));

        const escapeCSV = (value: string | number | boolean) => {
            const str = String(value);
            if (str.includes(",") || str.includes('"') || str.includes("\n")) {
                return `"${str.replace(/"/g, '""')}"`;
            }
            return str;
        };

        const headers = [
            t("call_logs_page.csv_contact_number"),
            t("call_logs_page.csv_contact_name"),
            t("call_logs_page.csv_started_time"),
            t("call_logs_page.csv_duration"),
            t("call_logs_page.csv_agent_name"),
            t("call_logs_page.csv_agent_id"),
            t("call_logs_page.csv_direction"),
            t("call_logs_page.csv_status"),
            t("call_logs_page.csv_sentiment"),
            t("call_logs_page.csv_sentiment_summary"),
            t("call_logs_page.csv_recording"),
        ];

        const rows = selectedCallLogs.map(call => [
            escapeCSV(call.contactNumber),
            escapeCSV(call.contact),
            escapeCSV(call.startTime),
            escapeCSV(call.duration),
            escapeCSV(call.agent),
            escapeCSV(call.agentId),
            escapeCSV(call.direction),
            escapeCSV(call.status),
            escapeCSV(call.sentiment),
            escapeCSV(call.sentimentSummary),
            escapeCSV(call.recording),
        ]);

        const csvContent = [
            headers.join(","),
            ...rows.map(row => row.join(",")),
        ].join("\n");

        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", `call_logs_${new Date().toISOString().split("T")[0]}.csv`);
        link.style.visibility = "hidden";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleExportSingleCallLogAsCSV = (call: CallLog) => {
        const escapeCSV = (value: string | number | boolean) => {
            const str = String(value);
            if (str.includes(",") || str.includes('"') || str.includes("\n")) {
                return `"${str.replace(/"/g, '""')}"`;
            }
            return str;
        };

        const headers = [
            t("call_logs_page.csv_contact_number"),
            t("call_logs_page.csv_contact_name"),
            t("call_logs_page.csv_started_time"),
            t("call_logs_page.csv_duration"),
            t("call_logs_page.csv_agent_name"),
            t("call_logs_page.csv_agent_id"),
            t("call_logs_page.csv_direction"),
            t("call_logs_page.csv_status"),
            t("call_logs_page.csv_sentiment"),
            t("call_logs_page.csv_sentiment_summary"),
            t("call_logs_page.csv_recording"),
        ];

        const row = [
            escapeCSV(call.contactNumber),
            escapeCSV(call.contact),
            escapeCSV(call.startTime),
            escapeCSV(call.duration),
            escapeCSV(call.agent),
            escapeCSV(call.agentId),
            escapeCSV(call.direction),
            escapeCSV(call.status),
            escapeCSV(call.sentiment),
            escapeCSV(call.sentimentSummary),
            escapeCSV(call.recording),
        ];

        const csvContent = [headers.join(","), row.join(",")].join("\n");
        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", `call_log_${call.id}_${new Date().toISOString().split("T")[0]}.csv`);
        link.style.visibility = "hidden";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const paginatedCallLogs = callLogs; // Backend already paginates
    const totalPages = Math.ceil((logsResponse?.total || 0) / rowsPerPage);

    return (
        <>
            <audio ref={audioRef} className="hidden" />
        <div className="animate-in fade-in duration-700 p-6 space-y-3">
            {/* 1. Branded Header Card — standalone floating card with the
                shared two-layer drop shadow. */}
            <div className="bg-white dark:bg-slate-900/50 rounded-[20px] border border-slate-200/70 dark:border-slate-800 shadow-[0_10px_28px_-8px_rgba(15,23,42,0.18),0_4px_10px_-2px_rgba(15,23,42,0.08)] dark:shadow-[0_10px_28px_-6px_rgba(0,0,0,0.55),0_4px_10px_-2px_rgba(0,0,0,0.35)] overflow-hidden">
                <div className="py-1.5 px-5 flex items-center justify-between bg-transparent">
                    <div className="flex items-center gap-6">
                        <div className="p-2 rounded-xl bg-primary/10 text-primary border border-primary/10 shadow-inner">
                            <Mic size={20} strokeWidth={2.5} />
                        </div>
                        <div className="space-y-0.5">
                            <h1 className="text-lg font-bold tracking-tight text-slate-900 dark:text-white">
                                {t("call_logs_page.title")}
                            </h1>
                            <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                                {t("call_logs_page.subtitle")}
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
                            <TooltipContent className="text-[10px]">{t("call_logs_page.refresh_logs")}</TooltipContent>
                        </Tooltip>
                    </div>
                </div>
            </div>

            {/* 2. Content Card — stats + filters + table + pagination in
                their own floating card. */}
            <div className="bg-white dark:bg-slate-900/50 rounded-[20px] border border-slate-200/70 dark:border-slate-800 shadow-[0_10px_28px_-8px_rgba(15,23,42,0.18),0_4px_10px_-2px_rgba(15,23,42,0.08)] dark:shadow-[0_10px_28px_-6px_rgba(0,0,0,0.55),0_4px_10px_-2px_rgba(0,0,0,0.35)] flex flex-col overflow-hidden">

                <div className="grid grid-cols-2 md:grid-cols-5 border-b border-slate-200 dark:border-slate-800/80 divide-x divide-slate-100 dark:divide-slate-800/50">
                    <div className="p-3 bg-slate-50/30 dark:bg-transparent">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">{t("call_logs_page.kpi_total_calls")}</p>
                        <div className="flex items-baseline gap-2">
                            <p className="text-lg font-bold text-slate-900 dark:text-white">{callKpiData.totalCalls}</p>
                            <span className="text-[10px] font-medium text-slate-400">{t("call_logs_page.kpi_total")}</span>
                        </div>
                    </div>
                    <div className="p-3">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">{t("call_logs_page.kpi_completed")}</p>
                        <div className="flex items-baseline gap-2">
                            <p className="text-lg font-bold text-emerald-600">{callKpiData.completed}</p>
                            <span className="text-[10px] font-medium text-slate-400">{t("call_logs_page.kpi_successful")}</span>
                        </div>
                    </div>
                    <div className="p-3">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">{t("call_logs_page.kpi_inbound")}</p>
                        <div className="flex items-baseline gap-2">
                            <p className="text-lg font-bold text-blue-600">{callKpiData.inboundCalls}</p>
                            <span className="text-[10px] font-medium text-slate-400">{t("call_logs_page.kpi_received")}</span>
                        </div>
                    </div>
                    <div className="p-3">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">{t("call_logs_page.kpi_outbound")}</p>
                        <div className="flex items-baseline gap-2">
                            <p className="text-lg font-bold text-amber-600">{callKpiData.outboundCalls}</p>
                            <span className="text-[10px] font-medium text-slate-400">{t("call_logs_page.kpi_initiated")}</span>
                        </div>
                    </div>
                    <div className="p-3">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">{t("call_logs_page.kpi_avg_duration")}</p>
                        <div className="flex items-baseline gap-2">
                            <p className="text-lg font-bold text-indigo-600">{callKpiData.avgDuration}</p>
                            <span className="text-[10px] font-medium text-slate-400">{t("call_logs_page.kpi_per_call")}</span>
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
                            placeholder={t("call_logs_page.search_placeholder")}
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
                                <SelectItem value="last-7-days" className="text-xs">{t("call_logs_page.date_last_7_days")}</SelectItem>
                                <SelectItem value="last-14-days" className="text-xs">{t("call_logs_page.date_last_14_days")}</SelectItem>
                                <SelectItem value="last-30-days" className="text-xs">{t("call_logs_page.date_last_30_days")}</SelectItem>
                                <SelectItem value="this-month" className="text-xs">{t("call_logs_page.date_this_month")}</SelectItem>
                                <SelectItem value="this-quarter" className="text-xs">{t("call_logs_page.date_this_quarter")}</SelectItem>
                                <SelectItem value="custom" className="text-xs text-primary font-bold">{t("call_logs_page.date_custom_range")}</SelectItem>
                            </SelectContent>
                        </Select>

                        {dateRangePreset === "custom" && (
                            <Popover open={isCustomDateOpen} onOpenChange={setIsCustomDateOpen}>
                                <PopoverTrigger asChild>
                                    <Button variant="outline" style={{ borderRadius: '6px' }} className="h-9 px-3 !rounded-md border border-input bg-white dark:bg-slate-800/50 text-[11px] font-medium gap-2 shadow-sm">
                                        <Calendar className="h-3.5 w-3.5 text-slate-400" />
                                        <span>
                                            {customDateRange?.from ? format(customDateRange.from, 'dd/MM') : t("call_logs_page.date_start")} - {customDateRange?.to ? format(customDateRange.to, 'dd/MM') : t("call_logs_page.date_end")}
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
                            options={directionOptions}
                            selected={selectedDirection}
                            onChange={(v) => { setSelectedDirection(v); setPage(1); }}
                            placeholder={t("call_logs_page.direction_placeholder")}
                            width="140px"
                            className="!w-[140px]"
                            showSelectedOption={true}
                            showSearch={false}
                            triggerContent={
                                <>
                                    <div className="flex items-center gap-2 truncate">
                                        <ChevronsUpDown className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                                        <span className={cn("truncate text-[12px]", selectedDirection.length > 0 ? "text-slate-900 dark:text-white font-bold" : "text-slate-500 dark:text-slate-400")}>
                                            {selectedDirection.length === 0 ? t("call_logs_page.direction_placeholder") : selectedDirection[0]}
                                        </span>
                                    </div>
                                    <ChevronDown className="h-3.5 w-3.5 text-slate-400/50 shrink-0" />
                                </>
                            }
                        />

                        <CustomDropdown
                            options={callStatusOptions}
                            selected={selectedStatus}
                            onChange={(v) => { setSelectedStatus(v); setPage(1); }}
                            placeholder={t("call_logs_page.status_placeholder")}
                            width="140px"
                            className="!w-[140px]"
                            popoutAlign="right"
                            showSelectedOption={true}
                            showSearch={false}
                            triggerContent={
                                <>
                                    <div className="flex items-center gap-2 truncate">
                                        <Activity className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                                        <span className={cn("truncate text-[12px]", selectedStatus.length > 0 && !selectedStatus.includes("__all__") ? "text-slate-900 dark:text-white font-bold" : "text-slate-500 dark:text-slate-400")}>
                                            {selectedStatus.length === 0 || selectedStatus.includes("__all__")
                                                ? t("call_logs_page.status_placeholder")
                                                : callStatusOptions.find(o => o.id === selectedStatus[0])?.name ?? selectedStatus[0]}
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
                            <span className="text-[11px] font-bold text-primary uppercase tracking-widest">{t("call_logs_page.selected_count", { count: selectedRows.size })}</span>
                            <div className="flex gap-1 ml-auto">
                                <Button
                                    onClick={handleExportSelectedCallLogsAsCSV}
                                    variant="outline"
                                    className="h-7 px-3 rounded-md border-primary/30 text-primary gap-2 text-[10px] font-bold hover:bg-primary hover:text-primary-foreground transition-all"
                                >
                                    <Download size={12} />
                                    {t("call_logs_page.export_selected")}
                                </Button>
                            </div>
                        </div>
                    )}

                    <table className="w-full text-left border-separate border-spacing-0">
                        <thead className="sticky top-0 z-10 bg-slate-50/80 dark:bg-slate-900/80 backdrop-blur-md">
                            <tr>
                                <th className="px-5 py-2.5 border-b border-slate-200 dark:border-slate-800 w-10">
                                    <Checkbox
                                        checked={selectedRows.size > 0 && selectedRows.size === getFilteredAndSortedCallLogs().length}
                                        onCheckedChange={toggleAllRows}
                                        className="rounded-[4px] border-slate-300 dark:border-slate-700"
                                    />
                                </th>
                                <th 
                                    onClick={() => handleCallColumnSort("contact")}
                                    className="px-5 py-2.5 text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider border-b border-slate-200 dark:border-slate-800 cursor-pointer hover:bg-slate-100/50 transition-colors"
                                >
                                    <div className="flex items-center gap-2">
                                        {t("call_logs_page.col_contact")} {renderCallSortIcon("contact")}
                                    </div>
                                </th>
                                <th
                                    onClick={() => handleCallColumnSort("agent")}
                                    className="px-5 py-2.5 text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider border-b border-slate-200 dark:border-slate-800 cursor-pointer hover:bg-slate-100/50 transition-colors"
                                >
                                    <div className="flex items-center gap-2">
                                        {t("call_logs_page.col_agent")} {renderCallSortIcon("agent")}
                                    </div>
                                </th>
                                <th
                                    onClick={() => handleCallColumnSort("direction")}
                                    className="px-5 py-2.5 text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider border-b border-slate-200 dark:border-slate-800 cursor-pointer hover:bg-slate-100/50 transition-colors"
                                >
                                    <div className="flex items-center gap-2">
                                        {t("call_logs_page.col_direction")} {renderCallSortIcon("direction")}
                                    </div>
                                </th>
                                <th
                                    onClick={() => handleCallColumnSort("startTime")}
                                    className="px-5 py-2.5 text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider border-b border-slate-200 dark:border-slate-800 cursor-pointer hover:bg-slate-100/50 transition-colors"
                                >
                                    <div className="flex items-center gap-2">
                                        {t("call_logs_page.col_start_time")} {renderCallSortIcon("startTime")}
                                    </div>
                                </th>
                                <th
                                    onClick={() => handleCallColumnSort("duration")}
                                    className="px-5 py-2.5 text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider border-b border-slate-200 dark:border-slate-800 cursor-pointer hover:bg-slate-100/50 transition-colors"
                                >
                                    <div className="flex items-center gap-2">
                                        {t("call_logs_page.col_duration")} {renderCallSortIcon("duration")}
                                    </div>
                                </th>
                                <th
                                    onClick={() => handleCallColumnSort("status")}
                                    className="px-5 py-2.5 text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider border-b border-slate-200 dark:border-slate-800 cursor-pointer hover:bg-slate-100/50 transition-colors"
                                >
                                    <div className="flex items-center gap-2">
                                        {t("call_logs_page.col_status")} {renderCallSortIcon("status")}
                                    </div>
                                </th>
                                <th className="px-5 py-2.5 text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider border-b border-slate-200 dark:border-slate-800 w-20">
                                    {t("call_logs_page.col_actions")}
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                            {paginatedCallLogs.length === 0 ? (
                                <tr>
                                    <td colSpan={8} className="py-20 text-center">
                                        <div className="flex flex-col items-center gap-3">
                                            <div className="p-4 rounded-full bg-slate-50 dark:bg-slate-800">
                                                <Mic className="w-8 h-8 text-slate-300" />
                                            </div>
                                            <p className="text-sm font-medium text-slate-400">{t("call_logs_page.empty_state")}</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                paginatedCallLogs.map((call) => (
                                    <tr 
                                        key={call.id} 
                                        className="group hover:bg-primary/[0.06] dark:hover:bg-primary/5 transition-all duration-200"
                                    >
                                        <td className="px-5 py-2">
                                            <Checkbox
                                                checked={selectedRows.has(call.id)}
                                                onCheckedChange={() => toggleRowSelection(call.id)}
                                                className="rounded-[4px] border-slate-300 dark:border-slate-700"
                                            />
                                        </td>
                                        <td className="px-5 py-2">
                                            <div className="flex flex-col">
                                                <span className="text-[13px] font-semibold text-slate-700 dark:text-slate-200 line-clamp-1">{call.contact}</span>
                                                <span className="text-[10px] text-slate-400">{call.contactNumber}</span>
                                            </div>
                                        </td>
                                        <td className="px-5 py-2">
                                            <div className="flex items-center gap-2">
                                                <div className="w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-[10px] font-bold text-slate-500 uppercase">
                                                    {call.agent.substring(0, 1)}
                                                </div>
                                                <span className="text-[12px] font-medium text-slate-600 dark:text-slate-300">{call.agent}</span>
                                            </div>
                                        </td>
                                        <td className="px-5 py-2 text-[12px] text-slate-500 dark:text-slate-400 font-medium">
                                            {call.direction}
                                        </td>
                                        <td className="px-5 py-2 text-[12px] text-slate-500 dark:text-slate-400 font-medium">
                                            {call.startTime
                                                ? formatInWorkspaceTz(call.startTime, "dd MMM yyyy, HH:mm", workspaceTz)
                                                : "—"}
                                        </td>
                                        <td className="px-5 py-2 text-[12px] text-slate-500 dark:text-slate-400 font-medium">
                                            {call.duration}
                                        </td>
                                        <td className="px-5 py-2">
                                            <span className={cn(
                                                "inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wide uppercase",
                                                call.status === "Completed" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400" :
                                                call.status === "In Progress" ? "bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400" :
                                                call.status === "Missed" || call.status === "Failed" ? "bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-400" :
                                                "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                                            )}>
                                                {call.status}
                                            </span>
                                        </td>
                                        <td className="px-5 py-2">
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
                                                        onClick={() => handleViewDetails(call)}
                                                        className="flex items-center gap-2 px-2 py-1.5 text-xs font-medium rounded-lg cursor-pointer transition-colors"
                                                    >
                                                        <FileText size={13} className="text-primary" />
                                                        {t("call_logs_page.action_view_details")}
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem
                                                        onClick={() => handleExportSingleCallLogAsCSV(call)}
                                                        className="flex items-center gap-2 px-2 py-1.5 text-xs font-medium rounded-lg cursor-pointer transition-colors"
                                                    >
                                                        <Download size={13} className="text-emerald-500" />
                                                        {t("call_logs_page.action_export_csv")}
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
                        <span>{t("call_logs_page.results_found", { count: logsResponse?.total || 0 })}</span>
                        <div className="h-4 w-px bg-slate-300 dark:bg-slate-700" />
                        <div className="flex items-center gap-2">
                            <span>{t("call_logs_page.show_label")}</span>
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
                            <span>{t("call_logs_page.page_label")}</span>
                            <span className="text-slate-900 dark:text-white">{page}</span>
                            <span>{t("call_logs_page.of_label")}</span>
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
        </div>

                {/* View Details Dialog */}
                <Dialog open={viewDetailsOpen} onOpenChange={setViewDetailsOpen}>
                    <DialogContent className="max-w-lg">
                        <DialogHeader className="mb-2">
                            <DialogTitle>{t("call_logs_page.dialog_title")}</DialogTitle>
                        </DialogHeader>
                        {selectedCallLog && (
                            <div className="space-y-5">
                                <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                                    <div>
                                        <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{t("call_logs_page.field_contact")}</label>
                                        <p className="mt-1 text-sm font-medium">{selectedCallLog.contact || t("call_logs_page.unknown")}</p>
                                        {selectedCallLog.contactNumber && (
                                            <p className="text-xs text-slate-500">{selectedCallLog.contactNumber}</p>
                                        )}
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{t("call_logs_page.field_direction")}</label>
                                        <p className="mt-1">
                                            <span className={cn(
                                                "inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wide uppercase",
                                                selectedCallLog.direction === "Inbound"
                                                    ? "bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400"
                                                    : "bg-purple-100 text-purple-700 dark:bg-purple-500/10 dark:text-purple-400",
                                            )}>
                                                {selectedCallLog.direction}
                                            </span>
                                        </p>
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{t("call_logs_page.field_started")}</label>
                                        <p className="mt-1 text-xs font-medium">
                                            {selectedCallLog.startTime
                                                ? formatInWorkspaceTz(selectedCallLog.startTime, "dd MMM yyyy, HH:mm", workspaceTz)
                                                : "—"}
                                        </p>
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{t("call_logs_page.field_duration")}</label>
                                        <p className="mt-1 text-xs font-medium">{selectedCallLog.duration}</p>
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{t("call_logs_page.field_status")}</label>
                                        <p className="mt-1">
                                            <span className={cn(
                                                "inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wide uppercase",
                                                selectedCallLog.status === "Completed" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400" :
                                                    selectedCallLog.status === "In Progress" ? "bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400" :
                                                        selectedCallLog.status === "Missed" || selectedCallLog.status === "Declined" || selectedCallLog.status === "Failed"
                                                            ? "bg-rose-100 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400"
                                                            : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
                                            )}>
                                                {selectedCallLog.status}
                                            </span>
                                        </p>
                                    </div>
                                    {selectedCallLog.call_sid && (
                                        <div>
                                            <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{t("call_logs_page.field_call_sid")}</label>
                                            <p className="mt-1 text-[10px] font-mono text-slate-500 truncate" title={selectedCallLog.call_sid}>
                                                {selectedCallLog.call_sid}
                                            </p>
                                        </div>
                                    )}
                                </div>

                                {/* Recording — only renders if backend resolved a real RecordingUrl. */}
                                <div className="border-t pt-4">
                                    <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{t("call_logs_page.recording_label")}</label>
                                    <div className="mt-2">
                                        {detailLoading ? (
                                            <p className="text-xs text-slate-400">{t("call_logs_page.recording_loading")}</p>
                                        ) : (detailData?.call?.recordingUrl ?? selectedCallLog.recordingUrl) ? (
                                            <audio
                                                controls
                                                className="w-full h-12"
                                                src={detailData?.call?.recordingUrl ?? selectedCallLog.recordingUrl ?? undefined}
                                            >
                                                {t("call_logs_page.audio_not_supported")}
                                            </audio>
                                        ) : (
                                            <p className="text-sm text-muted-foreground">{t("call_logs_page.recording_unavailable")}</p>
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
                                {t("call_logs_page.close")}
                            </Button>
                        </div>
                    </DialogContent>
                </Dialog>
        </>
    );
}
