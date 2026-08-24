import { useState } from "react";
import { Bell, ArrowLeft, CheckCircle, AlertTriangle, Mail, Send, MessageSquare, Trash2 } from "react-feather";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { formatInWorkspaceTz, useAgencyTimezone } from "@/contexts/WorkspaceTimezoneContext";

function getIcon(slug?: string) {
    const s = (slug || "").toLowerCase();
    if (s.includes("message") || s.includes("mail")) return <Mail className="text-blue-500" size={16} />;
    if (s.includes("campaign") || s.includes("broadcast") || s.includes("send")) return <Send className="text-green-500" size={16} />;
    if (s.includes("approved") || s.includes("complete") || s.includes("success")) return <CheckCircle className="text-emerald-500" size={16} />;
    if (s.includes("warning") || s.includes("alert") || s.includes("maintenance")) return <AlertTriangle className="text-yellow-500" size={16} />;
    if (s.includes("chat") || s.includes("conversation")) return <MessageSquare className="text-purple-500" size={16} />;
    return <Bell className="text-slate-500" size={16} />;
}

function formatRelativeTime(iso: string | Date | null | undefined, workspaceTz: string): string {
    if (!iso) return "";
    const date = typeof iso === "string" ? new Date(iso) : iso;
    const diffSec = Math.floor((Date.now() - date.getTime()) / 1000);
    if (diffSec < 60) return "just now";
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
    if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
    if (diffSec < 604800) return `${Math.floor(diffSec / 86400)}d ago`;
    return formatInWorkspaceTz(date, "M/d/yyyy", workspaceTz);
}

export default function AgencyNotificationsPage() {
    const queryClient = useQueryClient();
    const workspaceTz = useAgencyTimezone();

    const { data: resp, isLoading } = useQuery<any>({
        queryKey: ["/api/notifications", { limit: 100 }],
        queryFn: async () => {
            const res = await apiRequest("GET", "/api/notifications?limit=100");
            return res.json();
        },
        refetchInterval: 30 * 1000,
    });
    const notifications: any[] = resp?.notifications || [];
    const unread: number = resp?.unread || 0;

    const markAllMutation = useMutation({
        mutationFn: async () => {
            await apiRequest("POST", "/api/notifications/read-all", {});
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
        },
    });

    const deleteAllMutation = useMutation({
        mutationFn: async () => {
            await apiRequest("DELETE", "/api/notifications/all");
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
        },
    });

    const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());

    const deleteOne = async (id: string) => {
        if (deletingIds.has(id)) return;
        setDeletingIds((prev) => new Set(prev).add(id));
        try {
            await apiRequest("DELETE", `/api/notifications/${id}`);
        } catch {
            // silently ignore
        } finally {
            setDeletingIds((prev) => { const s = new Set(prev); s.delete(id); return s; });
            queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
        }
    };

    return (
        <div className="p-6 space-y-0">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-sm overflow-hidden">
                {/* Header row */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-700">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => window.history.back()}
                            className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-slate-500 dark:text-slate-400"
                        >
                            <ArrowLeft size={18} />
                        </button>
                        <div>
                            <h1 className="text-base font-bold text-slate-900 dark:text-white leading-none">Notifications</h1>
                            {unread > 0 && (
                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{unread} unread</p>
                            )}
                        </div>
                    </div>
                    {notifications.length > 0 && (
                        <div className="flex items-center gap-3">
                            <button
                                onClick={() => markAllMutation.mutate()}
                                disabled={markAllMutation.isPending}
                                className="text-xs font-semibold text-primary hover:underline disabled:opacity-50 transition-opacity"
                            >
                                {markAllMutation.isPending ? "Marking..." : "Mark all as read"}
                            </button>
                            <button
                                onClick={() => deleteAllMutation.mutate()}
                                disabled={deleteAllMutation.isPending}
                                className="text-xs font-semibold text-red-500 hover:underline disabled:opacity-50 transition-opacity"
                            >
                                {deleteAllMutation.isPending ? "Deleting..." : "Delete all"}
                            </button>
                        </div>
                    )}
                </div>

                {/* Notifications list */}
                <div>
                    <ScrollArea className="h-[calc(100vh-130px)]">
                        {isLoading ? (
                            <div className="p-10 text-center text-sm text-slate-400">Loading...</div>
                        ) : notifications.length === 0 ? (
                            <div className="p-16 text-center space-y-2">
                                <Bell className="mx-auto opacity-20 text-slate-400" size={36} />
                                <p className="text-sm font-medium text-slate-600 dark:text-slate-300">You're all caught up</p>
                                <p className="text-xs text-slate-400">No notifications yet</p>
                            </div>
                        ) : (
                            <div className="divide-y divide-slate-100 dark:divide-slate-800">
                                {notifications.map((n: any) => {
                                    const contactName = n.data?.contact_name;
                                    const title = contactName
                                        ? `Message from ${contactName}`
                                        : n.data?.title || n.data?.message || n.slug || "New Notification";
                                    const body = n.data?.message || n.data?.body || n.data?.description || "";
                                    const displayBody = contactName && n.data?.message ? n.data.message : (contactName ? "" : body);

                                    return (
                                        <div
                                            key={n.id}
                                            className={`flex items-start gap-3 px-5 py-4 transition-colors ${
                                                !n.read
                                                    ? "bg-blue-50/40 dark:bg-blue-900/10 hover:bg-blue-50/70 dark:hover:bg-blue-900/20"
                                                    : "hover:bg-slate-50 dark:hover:bg-slate-800/40"
                                            }`}
                                        >
                                            <div className="mt-0.5 w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0 border border-slate-200 dark:border-slate-700">
                                                {getIcon(n.slug)}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className={`text-sm font-semibold leading-snug ${!n.read ? "text-slate-900 dark:text-white" : "text-slate-600 dark:text-slate-300"}`}>
                                                    {title}
                                                </p>
                                                {displayBody && (
                                                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed line-clamp-2">
                                                        {displayBody}
                                                    </p>
                                                )}
                                                <p className="text-[11px] text-slate-400 mt-1">{formatRelativeTime(n.created_at, workspaceTz)}</p>
                                            </div>
                                            <div className="flex items-center gap-2 shrink-0">
                                                {!n.read && <div className="w-2 h-2 bg-blue-500 rounded-full" />}
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); deleteOne(n.id); }}
                                                    disabled={deletingIds.has(n.id)}
                                                    className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-40"
                                                >
                                                    <Trash2 size={15} />
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </ScrollArea>
                </div>
            </div>
        </div>
    );
}
