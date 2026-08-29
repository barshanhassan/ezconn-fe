

import React, { useState, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
import {
    X,
    ChevronDown,
    User,
    Image as ImageIcon,
    NotebookPen,
    BarChart3,
    Tag,
    ClipboardList,
    Headset,
    RefreshCw,
    PauseCircle,
    StopCircle,
    Plus,
    ExternalLink,
    Zap
} from "lucide-react";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import CustomDropdown from "@/components/CustomDropdown";
import { getAvatarColor } from "@/lib/avatar-utils";
import ContactProfileModal from "./ContactProfileModal";
import { formatInWorkspaceTz, useWorkspaceTimezone } from "@/contexts/WorkspaceTimezoneContext";

interface ContactProfileSidebarProps {
    // Conversation Data
    conversation: any;
    conversations: any[]; // Needed specifically for displayName helper context if needed, but ideally we pass resolved values

    // Basic Details
    basicDetails: any;
    onUpdateBasicDetails: (details: any) => void;

    // Chat Assignment
    assignedAgent: string | null;
    onAssignAgent: (agentId: string) => void;
    // Whether the current agent may (re)assign — gates the assign controls
    // (replyagent: v-can="'workspace.inbox.user.can.assign_conversations'").
    canAssignConversations?: boolean;
    // Whether the agent may see the contact's channel info (phone/whatsapp/email).
    // False = `contact.view_channel` held → hide it (replyagent canSeeChannels).
    canSeeChannels?: boolean;
    // Whether the agent may open the full contact profile. False = `contact.view_profile`
    // held → the avatar/name trigger no longer opens the profile modal (replyagent:
    // the "Profile" button is hidden via v-if="!includes('...view_profile')").
    canViewProfile?: boolean;
    agentOptions: { id: string; name: string }[];

    // Teams
    involvedTeams: string[];
    onUpdateInvolvedTeams: (teams: string[]) => void;
    teamOptions: { id: string; name: string }[];

    // Tags
    tags: string[];
    onUpdateTags: (tags: string[]) => void;
    tagOptions: { id: string; name: string }[];

    // Workspace-defined custom fields (from Settings → Custom Fields)
    profileCustomFields?: Array<{ id: string; label: string; slug: string; content_type: string; input_type: string; has_properties: number; properties: Array<{ name: string; value: string }>; value: string | null }>;
    onSaveCustomFieldValue?: (fieldId: string, value: string) => void;

    // Custom Attributes
    customAttributes: Record<string, string>;
    onUpdateCustomAttributes: (attributes: Record<string, string>) => void;

    // Notes
    notes: string[];
    onUpdateNotes: (notes: string[]) => void;

    // Messages for Media Tab
    messages?: any[];
    onScrollToMessage?: (messageId: number) => void;

    // Live profile data from the backend `/api/inbox/get-profile-data/:id` —
    // replaces the previously-hardcoded support number / smart-flow stub.
    profileData?: {
        support_number?: string | null;
        smart_flow?: { name?: string; paused?: boolean } | null;
        channel?: { type?: string; name?: string; number?: string } | null;
        opportunities?: Array<{
            id: string; title: string | null; value: number; currency: string;
            status: string; closing_date: string | null; probability: number;
            step: { name: string; bg_color: string; txt_color: string } | null;
            pipeline: { name: string; currency: string } | null;
        }> | null;
    } | null;

    onRefreshProfile?: () => void;
}

// Helper function to get display name - defaults to phone number if displayName not set
const getDisplayName = (conversation: any): string => {
    return conversation?.displayName?.trim() || conversation?.phoneNumber || conversation?.name || "Unknown";
};

export default function ContactProfileSidebar({
    conversation,
    conversations, // optional if we strictly use passed conversation
    basicDetails,
    onUpdateBasicDetails,
    assignedAgent,
    onAssignAgent,
    canAssignConversations = true,
    canSeeChannels = true,
    canViewProfile = true,
    agentOptions,
    involvedTeams,
    onUpdateInvolvedTeams,
    teamOptions,
    tags,
    onUpdateTags,
    tagOptions,
    profileCustomFields = [],
    onSaveCustomFieldValue,
    customAttributes,
    onUpdateCustomAttributes,
    notes,
    onUpdateNotes,
    messages = [],
    onScrollToMessage,
    profileData,
    onRefreshProfile,
}: ContactProfileSidebarProps) {
    const { t } = useTranslation();
    const workspaceTz = useWorkspaceTimezone();

    // Edit basic details modal state
    const [isEditBasicDetailsOpen, setIsEditBasicDetailsOpen] = useState(false);
    const [editedBasicDetails, setEditedBasicDetails] = useState(basicDetails || {});
    const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);

    // Add teams modal state
    const [isAddTeamsModalOpen, setIsAddTeamsModalOpen] = useState(false);
    const [selectedTeamsForModal, setSelectedTeamsForModal] = useState<string[]>([]);

    // Add tags modal state
    const [isAddTagsModalOpen, setIsAddTagsModalOpen] = useState(false);
    const [selectedTagsForModal, setSelectedTagsForModal] = useState<string[]>([]);

    // Add custom attribute modal state
    const [isAddAttributeModalOpen, setIsAddAttributeModalOpen] = useState(false);
    const [newAttributeKey, setNewAttributeKey] = useState("");
    const [newAttributeValue, setNewAttributeValue] = useState("");

    // Add note modal state
    const [isAddNoteModalOpen, setIsAddNoteModalOpen] = useState(false);
    const [newNote, setNewNote] = useState("");

    // Add opportunity modal state
    const [isAddOpportunityModalOpen, setIsAddOpportunityModalOpen] = useState(false);
    const [newOpportunity, setNewOpportunity] = useState({
        pipeline: "",
        stage: "",
        title: "",
        value: "",
        currency: "USD",
        closingDate: "",
        confidence: "5",
        agent: "",
        contact: "",
        tags: [] as string[],
        note: ""
    });

    // Add task modal state
    const [isAddTaskModalOpen, setIsAddTaskModalOpen] = useState(false);
    const [newTask, setNewTask] = useState({ note: "", date: "", time: "", agent: "", contact: "" });

    // Active Tab State
    const [activeTab, setActiveTab] = useState("details");

    // Pause Smart Flow State
    const [isFlowPaused, setIsFlowPaused] = useState(false);
    const [flowPauseTimer, setFlowPauseTimer] = useState(900); // 15 minutes
    const [maxTime, setMaxTime] = useState(900); // Track max time for progress circle

    useEffect(() => {
        let interval: NodeJS.Timeout;
        if (isFlowPaused && flowPauseTimer > 0) {
            interval = setInterval(() => {
                setFlowPauseTimer((prev) => prev - 1);
            }, 1000);
        } else if (flowPauseTimer === 0) {
            setIsFlowPaused(false);
            setFlowPauseTimer(900);
            setMaxTime(900);
        }
        return () => clearInterval(interval);
    }, [isFlowPaused, flowPauseTimer]);

    // Restore the paused state from the backend (contacts.automations_paused_till)
    // so reopening / refreshing the conversation shows the live countdown — not a
    // reset 15-min timer (replyagent drives the CountDownCircle off this field).
    useEffect(() => {
        const till = (profileData as any)?.automations_paused_till;
        if (till) {
            const ms = new Date(till).getTime() - Date.now();
            if (ms > 0) {
                const secs = Math.ceil(ms / 1000);
                setIsFlowPaused(true);
                setFlowPauseTimer(secs);
                setMaxTime(Math.max(secs, 900));
                return;
            }
        }
        setIsFlowPaused(false);
        setFlowPauseTimer(900);
        setMaxTime(900);
    }, [(profileData as any)?.automations_paused_till]);

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    const handleAdd15Minutes = () => {
        const maxLimit = 9999 * 60;
        const addedAmount = 900;
        let amountToAdd = addedAmount;
        if (flowPauseTimer + addedAmount > maxLimit) {
            amountToAdd = maxLimit - flowPauseTimer;
        }
        if (amountToAdd > 0) {
            const newTimer = flowPauseTimer + amountToAdd;
            setFlowPauseTimer(newTimer);
            setMaxTime((prevMax) => prevMax + amountToAdd);
            // Sync updated duration to backend
            pauseAutomationMutation.mutate({ action: 'pause_automation', minutes: Math.ceil(newTimer / 60) });
        }
    };

    const handleStopPause = () => {
        setIsFlowPaused(false);
        setFlowPauseTimer(900);
        setMaxTime(900);
        pauseAutomationMutation.mutate({ action: 'resume_automation' });
    };

    const handleStartPause = () => {
        setIsFlowPaused(true);
        setMaxTime(Math.max(900, flowPauseTimer));
        pauseAutomationMutation.mutate({ action: 'pause_automation', minutes: Math.ceil(flowPauseTimer / 60) });
    };

    const handleSaveBasicDetails = () => {
        onUpdateBasicDetails(editedBasicDetails);
        setIsEditBasicDetailsOpen(false);
    };

    const handleClearField = (field: string) => {
        setEditedBasicDetails({ ...editedBasicDetails, [field]: "" });
    };

    const handleOpenTeamsModal = () => {
        setSelectedTeamsForModal(involvedTeams || []);
        setIsAddTeamsModalOpen(true);
    };

    const handleSaveTeams = () => {
        onUpdateInvolvedTeams(selectedTeamsForModal);
        setIsAddTeamsModalOpen(false);
    };

    const handleOpenTagsModal = () => {
        setSelectedTagsForModal(tags || []);
        setIsAddTagsModalOpen(true);
    };

    const handleSaveTags = () => {
        onUpdateTags(selectedTagsForModal);
        setIsAddTagsModalOpen(false);
    };

    const handleAddAttribute = () => {
        if (newAttributeKey.trim() && newAttributeValue.trim()) {
            onUpdateCustomAttributes({ ...customAttributes, [newAttributeKey]: newAttributeValue });
            setNewAttributeKey("");
            setNewAttributeValue("");
            setIsAddAttributeModalOpen(false);
        }
    };

    const handleAddNote = () => {
        const currentNotes = notes || [];
        let updatedNotes: string[];

        if (newNote.trim()) {
            // If there's a new note, replace the last one or add it
            if (currentNotes.length > 0) {
                updatedNotes = [...currentNotes.slice(0, currentNotes.length - 1), newNote.trim()];
            } else {
                updatedNotes = [newNote.trim()];
            }
        } else {
            // If newNote is empty, clear all notes
            updatedNotes = [];
        }

        onUpdateNotes(updatedNotes);
        setNewNote("");
        setIsAddNoteModalOpen(false);
    };

    // Real pipelines from API
    const { data: pipelinesData } = useQuery({
        queryKey: ["/api/pipelines"],
        queryFn: async () => (await apiRequest("GET", "/api/pipelines")).json(),
    });
    const pipelines: any[] = pipelinesData?.pipelines || [];

    // Stages for the selected pipeline
    const selectedPipelineSteps: any[] = useMemo(() => {
        const pl = pipelines.find((p: any) => String(p.id) === newOpportunity.pipeline);
        return pl?.pipeline_steps || [];
    }, [pipelines, newOpportunity.pipeline]);

    // contact_id from profileData (full backend response shape)
    const contactId: string | null = (profileData as any)?.contact?.id
        ? String((profileData as any).contact.id)
        : null;

    // Mutation: create opportunity
    const createOpportunityMutation = useMutation({
        mutationFn: async (data: any) => {
            const res = await apiRequest("POST", "/api/pipelines/opportunities", data);
            if (!res.ok) throw new Error("Failed to create opportunity");
            return res.json();
        },
        onSuccess: () => {
            setIsAddOpportunityModalOpen(false);
            setNewOpportunity({ pipeline: "", stage: "", title: "", value: "", currency: "USD", closingDate: "", confidence: "5", agent: "", contact: "", tags: [], note: "" });
            // Refetch so the new opportunity appears in the tab immediately
            // (replyagent re-pulls the profile after opportunityUpdated).
            onRefreshProfile?.();
        },
    });

    const handleSaveOpportunity = () => {
        if (!newOpportunity.title || !newOpportunity.pipeline || !newOpportunity.stage) return;
        createOpportunityMutation.mutate({
            title: newOpportunity.title,
            pl_id: newOpportunity.pipeline,
            pl_step_id: newOpportunity.stage,
            contact_id: contactId,
            value: newOpportunity.value || 0,
            currency: newOpportunity.currency || "USD",
            // form stores 1–10 "confidence"; opportunity probability is a percentage.
            probability: newOpportunity.confidence ? Number(newOpportunity.confidence) * 10 : undefined,
            closing_date: newOpportunity.closingDate || undefined,
        });
    };

    // Fetch tasks for the current contact (query declared first so refetchTasks
    // is in scope for createTaskMutation.onSuccess below).
    const { data: tasksData, refetch: refetchTasks } = useQuery({
        queryKey: ["/api/tasks", { contact_id: contactId }],
        queryFn: async () => {
            if (!contactId) return { tasks: [] };
            const res = await apiRequest("GET", `/api/tasks?contact_id=${contactId}`);
            return res.json();
        },
        enabled: !!contactId && activeTab === "tasks",
    });
    const contactTasks: any[] = tasksData?.tasks || [];

    // Pause / resume automation mutation — persists to backend so it
    // survives page refresh (updates contacts.automations_paused_till).
    const pauseAutomationMutation = useMutation({
        mutationFn: async ({ action, minutes }: { action: string; minutes?: number }) => {
            const res = await apiRequest("POST", `/api/inbox/profile-action/${conversation.id}`, { action, minutes });
            return res.json();
        },
        // Refetch so the paused state stays driven by the backend paused_till.
        onSuccess: () => onRefreshProfile?.(),
    });

    // Remove the contact from a queued smart-flow / pending chat-input
    // (replyagent contactProfileAction automation_queue / chat_inputs).
    const removeAutomationMutation = useMutation({
        mutationFn: async (vars: { action: string; action_table_id: string }) => {
            const res = await apiRequest("POST", `/api/inbox/profile-action/${conversation.id}`, vars);
            return res.json();
        },
        onSuccess: () => onRefreshProfile?.(),
    });

    // Mutation: create task
    const createTaskMutation = useMutation({
        mutationFn: async (data: any) => {
            const res = await apiRequest("POST", "/api/tasks", data);
            if (!res.ok) throw new Error("Failed to create task");
            return res.json();
        },
        onSuccess: () => {
            setIsAddTaskModalOpen(false);
            setNewTask({ note: "", date: "", time: "", agent: "", contact: "" });
            refetchTasks();
        },
    });

    const handleSaveTask = () => {
        if (!newTask.note || !newTask.date || !newTask.time || !contactId) return;
        createTaskMutation.mutate({
            description: newTask.note,
            date: newTask.date,
            time: newTask.time,
            user_id: newTask.agent || undefined,
            contact_id: contactId,
        });
    };

    if (!conversation) return null;

    const displayName = getDisplayName(conversation);
    const getInitials = (name: string) => {
        const parts = name.trim().split(/\s+/).filter((p: string) => p.length > 0);
        if (parts.length === 0) return "U";
        if (parts.length === 1) return parts[0][0].toUpperCase();
        return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    };
    const initials = getInitials(displayName);

    return (
        <>
            <Card className="w-[28rem] border-l-0 rounded-l-none" data-testid="contact-panel">
                <CardContent className="space-y-3 pt-5">
                    {/* Header — replyagent: rounded-square avatar, name, handle,
                        then a bordered "Profile" button (opens the full contact modal). */}
                    <div className="flex flex-col items-center gap-1.5">
                        <div className={`h-16 w-16 rounded-lg flex items-center justify-center text-xl font-semibold text-white ${getAvatarColor(displayName)}`}>
                            {initials}
                        </div>
                        <div className="text-center">
                            <h3 className="font-semibold text-lg">{displayName}</h3>
                            {canSeeChannels && (
                                <p className="text-sm text-muted-foreground">{conversation?.phoneNumber}</p>
                            )}
                        </div>
                        {canViewProfile && (
                            <Button
                                variant="outline"
                                size="sm"
                                className="h-7 text-xs gap-1.5 mt-1 btn-outline-primary font-normal"
                                onClick={() => { if ((profileData as any)?.contact?.id) setIsDetailsModalOpen(true); }}
                                data-testid="button-open-profile"
                            >
                                <ExternalLink size={13} /> {t("contact_profile_sidebar.profile_button")}
                            </Button>
                        )}
                    </div>

                    <div className="space-y-4">
                        {/* Tabs — replyagent: plain icon row (no container box),
                            active icon coloured. */}
                        <div className="flex items-center justify-around w-full border-b pb-2">
                            {[
                                { id: "details", icon: User, label: t("contact_profile_sidebar.tabs.details") },
                                { id: "media", icon: ImageIcon, label: t("contact_profile_sidebar.tabs.media") },
                                { id: "custom-fields", icon: NotebookPen, label: t("contact_profile_sidebar.tabs.custom_fields") },
                                { id: "opportunities", icon: BarChart3, label: t("contact_profile_sidebar.tabs.opportunities") },
                                { id: "tags", icon: Tag, label: t("contact_profile_sidebar.tabs.tags") },
                                { id: "tasks", icon: ClipboardList, label: t("contact_profile_sidebar.tabs.tasks") },
                            ].map((tab) => (
                                <TooltipProvider key={tab.id}>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <button
                                                onClick={() => setActiveTab(tab.id)}
                                                className={`p-1.5 transition-colors ${activeTab === tab.id
                                                    ? "text-primary"
                                                    : "text-muted-foreground hover:text-foreground dark:text-slate-400 dark:hover:text-slate-200"
                                                    }`}
                                            >
                                                <tab.icon size={18} />
                                            </button>
                                        </TooltipTrigger>
                                        <TooltipContent>
                                            <p>{tab.label}</p>
                                        </TooltipContent>
                                    </Tooltip>
                                </TooltipProvider>
                            ))}
                        </div>

                        {/* Chat Assignment Section - Only visible in "details" tab */}
                        {activeTab === "details" && (
                            <>
                                {/* Assigned to — replyagent: label + "Assign to myself"
                                    on the right, then agent avatar + name + picker. */}
                                <div>
                                    <div className="flex items-center justify-between mb-2">
                                        <label className="text-sm font-semibold">{t("contact_profile_sidebar.details.assigned_to")}</label>
                                        {canAssignConversations && (!assignedAgent || assignedAgent !== "self") && (
                                            <button
                                                onClick={() => onAssignAgent("self")}
                                                className="text-xs text-primary flex items-center gap-1 hover:underline"
                                                data-testid="button-assign-self"
                                            >
                                                <Zap size={12} /> {t("contact_profile_sidebar.details.assign_to_myself")}
                                            </button>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {(() => {
                                            const assignedName = !assignedAgent
                                                ? t("contact_profile_sidebar.details.unassigned")
                                                : (assignedAgent === "self" ? t("contact_profile_sidebar.details.you") : (agentOptions.find((a: any) => a.id === assignedAgent)?.name || assignedAgent));
                                            return (
                                                <div className="flex items-center gap-2 flex-1 min-w-0">
                                                    {assignedAgent && (
                                                        <div className={`h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-semibold text-white flex-shrink-0 ${getAvatarColor(assignedName)}`}>
                                                            {getInitials(assignedName)}
                                                        </div>
                                                    )}
                                                    <span className={`text-sm truncate ${assignedAgent ? "font-medium" : "text-muted-foreground"}`}>{assignedName}</span>
                                                </div>
                                            );
                                        })()}
                                        {canAssignConversations && (
                                            <CustomDropdown
                                                options={agentOptions}
                                                selected={assignedAgent && assignedAgent !== "self" ? [assignedAgent] : []}
                                                onChange={(selected) => { if (selected.length > 0) onAssignAgent(selected[0]); }}
                                                placeholder=""
                                                width="auto"
                                                className="h-8 w-8 px-[0.5rem] justify-center btn-outline-primary border-primary text-primary hover:bg-primary hover:text-white dark:border-primary dark:text-primary dark:hover:bg-primary dark:hover:text-white"
                                                triggerContent={<ChevronDown size={14} />}
                                                popoutWidth="220px"
                                                popoutAlign="right"
                                            />
                                        )}
                                    </div>
                                </div>

                                <Separator className="my-2" />

                                {/* Support Number — real value from backend. The
                                    hardcoded "0123-123" was placeholder and is
                                    replaced by `profileData.support_number`. */}
                                <div>
                                    <h4 className="font-semibold text-sm mb-3">{t("contact_profile_sidebar.details.support_number")}</h4>
                                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                        <Headset size={16} />
                                        <span>{profileData?.support_number ?? "—"}</span>
                                    </div>
                                </div>

                                <Separator className="my-2" />

                                {/* Chatting with channel (replyagent shows this
                                    next to the Smart Flow section). */}
                                {profileData?.channel?.name && (
                                  <>
                                    <div>
                                        <h4 className="font-semibold text-sm mb-3">{t("contact_profile_sidebar.details.chatting_with_channel")}</h4>
                                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                            <span className="capitalize">{profileData.channel.type ?? t("contact_profile_sidebar.details.channel_fallback")}</span>
                                            <span>·</span>
                                            <span>{profileData.channel.name}</span>
                                            {profileData.channel.number && (
                                              <span className="opacity-60">({profileData.channel.number})</span>
                                            )}
                                        </div>
                                    </div>
                                    <Separator className="my-2" />
                                  </>
                                )}

                                {/* In Smart Flow — name + paused state come from
                                    backend so the UI reflects the real running
                                    automation instead of the static placeholder. */}
                                <div>
                                    <div className="flex items-center justify-between mb-3">
                                        <h4 className="font-semibold text-sm">{t("contact_profile_sidebar.details.in_smart_flow")}</h4>
                                        <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-foreground" onClick={() => onRefreshProfile?.()}>
                                            <RefreshCw size={14} />
                                        </Button>
                                    </div>
                                    {(() => {
                                        const contactAutos: any[] = (profileData as any)?.contact_automations ?? [];
                                        const inputAutos: any[] = (profileData as any)?.input_automations ?? [];
                                        if (contactAutos.length === 0 && inputAutos.length === 0) {
                                            return (
                                                <p className="text-sm text-muted-foreground">
                                                    {t("contact_profile_sidebar.details.not_in_smart_flow")}
                                                </p>
                                            );
                                        }
                                        return (
                                            <div className="space-y-2">
                                                {contactAutos.map((a: any) => (
                                                    <div key={`q${a.id}`} className="flex items-center justify-between gap-2 text-sm">
                                                        <span className="truncate">{a.name}</span>
                                                        <button
                                                            className="text-xs text-red-600 hover:underline flex-shrink-0"
                                                            onClick={() => removeAutomationMutation.mutate({ action: "automation_queue", action_table_id: String(a.id) })}
                                                            data-testid={`remove-automation-${a.id}`}
                                                        >
                                                            {t("contact_profile_sidebar.details.remove")}
                                                        </button>
                                                    </div>
                                                ))}
                                                {inputAutos.map((a: any) => (
                                                    <div key={`i${a.id}`} className="flex items-center justify-between gap-2 text-sm">
                                                        <span className="truncate">
                                                            {a.name} <span className="text-[10px] text-muted-foreground">(input)</span>
                                                        </span>
                                                        <button
                                                            className="text-xs text-red-600 hover:underline flex-shrink-0"
                                                            onClick={() => removeAutomationMutation.mutate({ action: "chat_inputs", action_table_id: String(a.id) })}
                                                            data-testid={`remove-input-${a.id}`}
                                                        >
                                                            {t("contact_profile_sidebar.details.remove")}
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        );
                                    })()}
                                </div>

                                <Separator className="my-2" />

                                {/* Pause Automated Messages */}
                                <div>
                                    <h4 className="font-semibold text-sm mb-3">{t("contact_profile_sidebar.details.pause_automated_messages")}</h4>
                                    {!isFlowPaused ? (
                                        <Button
                                            variant="outline"
                                            className="w-full justify-start gap-2 btn-outline-primary"
                                            onClick={handleStartPause}
                                        >
                                            <PauseCircle size={16} />
                                            {t("contact_profile_sidebar.details.pause_smart_flow")}
                                        </Button>
                                    ) : (
                                        <div className="flex flex-col items-center gap-4 py-2">
                                            {/* Timer Circle */}
                                            <div className="relative h-32 w-32 flex items-center justify-center">
                                                {/* Ensure transform is applied correctly to reverse direction */}
                                                <svg
                                                    className="h-full w-full"
                                                    viewBox="0 0 100 100"
                                                    style={{ transform: "rotate(90deg) scaleX(-1)" }}
                                                >
                                                    {/* Background circle */}
                                                    <circle
                                                        className="text-muted/20"
                                                        strokeWidth="8"
                                                        stroke="currentColor"
                                                        fill="transparent"
                                                        r="42"
                                                        cx="50"
                                                        cy="50"
                                                    />
                                                    {/* Progress circle */}
                                                    <circle
                                                        className="text-green-500 transition-all duration-1000 ease-linear"
                                                        strokeWidth="8"
                                                        strokeDasharray={264}
                                                        strokeDashoffset={264 - (264 * flowPauseTimer) / maxTime}
                                                        strokeLinecap="round"
                                                        stroke="currentColor"
                                                        fill="transparent"
                                                        r="42"
                                                        cx="50"
                                                        cy="50"
                                                    />
                                                </svg>
                                                <span className="absolute text-xl font-bold font-mono">
                                                    {formatTime(flowPauseTimer)}
                                                </span>
                                            </div>

                                            <div className="flex gap-2 w-full">
                                                <Button
                                                    variant="outline"
                                                    className="flex-1 gap-2 btn-outline-destructive"
                                                    onClick={handleStopPause}
                                                >
                                                    <StopCircle size={16} />
                                                    {t("contact_profile_sidebar.details.stop")}
                                                </Button>
                                                <Button
                                                    variant="outline"
                                                    className="flex-1 gap-2 btn-outline-primary"
                                                    onClick={handleAdd15Minutes}
                                                >
                                                    <Plus size={16} />
                                                    {t("contact_profile_sidebar.details.add_15_minutes")}
                                                </Button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </>
                        )}

                        {/* Media Tab Content */}
                        {activeTab === "media" && (
                            <div className="space-y-4">
                                {(() => {
                                    // Prefer the backend's full media history (replyagent
                                    // profile.media_items) — covers media older than the
                                    // loaded thread page + includes audio. Falls back to
                                    // aggregating the loaded messages when not yet available.
                                    const backendMedia: any[] = (profileData as any)?.media ?? [];
                                    let mediaItems: any[] = [];

                                    if (backendMedia.length > 0) {
                                        mediaItems = backendMedia.map((m: any) => {
                                            const mt = String(m.media_type || "").toLowerCase();
                                            return {
                                                url: m.url,
                                                thumbnail: m.thumb,
                                                name: m.name,
                                                size: 0,
                                                type: mt === "video" ? "video" : mt === "audio" ? "audio" : mt === "image" ? "image" : "document",
                                                time: m.created_at,
                                                from: m.direction === "OUTGOING" ? "agent" : "user",
                                                messageId: Number(m.message_id),
                                            };
                                        });
                                    } else {
                                        messages.forEach(msg => {
                                            if (msg.images && msg.images.length > 0) {
                                                msg.images.forEach((img: any) => {
                                                    mediaItems.push({ ...img, type: 'image', time: msg.time, from: msg.from, messageId: msg.id });
                                                });
                                            }
                                            if (msg.video) {
                                                mediaItems.push({ ...msg.video, type: 'video', time: msg.time, from: msg.from, messageId: msg.id });
                                            }
                                            if ((msg as any).audio) {
                                                mediaItems.push({ ...(msg as any).audio, type: 'audio', time: msg.time, from: msg.from, messageId: msg.id });
                                            }
                                            if (msg.attachments && msg.attachments.length > 0) {
                                                msg.attachments.forEach((att: any) => {
                                                    mediaItems.push({ ...att, type: 'document', time: msg.time, from: msg.from, messageId: msg.id });
                                                });
                                            }
                                        });
                                        // Reverse to show newest first
                                        mediaItems.reverse();
                                    }

                                    if (mediaItems.length === 0) {
                                        return (
                                            <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
                                                <ImageIcon size={32} className="mb-2 opacity-50" />
                                                <p className="text-sm">{t("contact_profile_sidebar.media.no_media_found")}</p>
                                            </div>
                                        );
                                    }

                                    return (
                                        <div className="grid grid-cols-2 gap-2">
                                            {mediaItems.map((item, index) => (
                                                <div
                                                    key={index}
                                                    className="relative group border rounded-md overflow-hidden bg-muted/30 hover:bg-muted/50 transition-colors cursor-pointer"
                                                    onClick={() => onScrollToMessage?.(item.messageId)}
                                                >
                                                    {item.type === 'image' && (
                                                        <div className="aspect-square relative">
                                                            <img src={item.url} alt={item.name} className="w-full h-full object-cover" />
                                                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                                                <div className="p-2 bg-white/20 rounded-full text-white backdrop-blur-sm">
                                                                    <ImageIcon size={16} />
                                                                </div>
                                                            </div>
                                                        </div>
                                                    )}
                                                    {item.type === 'video' && (
                                                        <div className="aspect-square relative flex items-center justify-center bg-black/5">
                                                            {item.thumbnail ? (
                                                                <img src={item.thumbnail} alt={item.name} className="w-full h-full object-cover" />
                                                            ) : (
                                                                <div className="w-full h-full bg-slate-900 flex items-center justify-center">
                                                                    <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center text-white/50">
                                                                        <div className="ml-1 w-0 h-0 border-t-[6px] border-t-transparent border-l-[10px] border-l-current border-b-[6px] border-b-transparent"></div>
                                                                    </div>
                                                                </div>
                                                            )}
                                                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                                                <div className="p-2 bg-black/50 rounded-full text-white backdrop-blur-sm">
                                                                    <div className="ml-1 w-0 h-0 border-t-[6px] border-t-transparent border-l-[10px] border-l-white border-b-[6px] border-b-transparent"></div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    )}
                                                    {item.type === 'audio' && (
                                                        <div className="aspect-square flex flex-col items-center justify-center p-3 relative">
                                                            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary mb-2">
                                                                <div className="ml-1 w-0 h-0 border-t-[5px] border-t-transparent border-l-[8px] border-l-current border-b-[5px] border-b-transparent"></div>
                                                            </div>
                                                            <span className="text-xs text-center font-medium truncate w-full">{t("contact_profile_sidebar.media.audio")}</span>
                                                            <span className="text-[10px] text-muted-foreground">{item.duration || "0:05"}</span>
                                                        </div>
                                                    )}
                                                    {item.type === 'document' && (
                                                        <div className="aspect-square flex flex-col items-center justify-center p-3 text-center">
                                                            <div className="w-10 h-10 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center mb-2">
                                                                <NotebookPen size={20} />
                                                            </div>
                                                            <span className="text-xs font-medium truncate w-full px-1" title={item.name}>{item.name}</span>
                                                            <span className="text-[10px] text-muted-foreground">{(item.size / 1024).toFixed(0)} KB</span>
                                                        </div>
                                                    )}

                                                    <div className="absolute bottom-0 left-0 right-0 p-1 bg-gradient-to-t from-black/60 to-transparent text-white text-[10px] opacity-0 group-hover:opacity-100 transition-opacity truncate px-2">
                                                        {item.time} • {item.from === 'agent' ? t("contact_profile_sidebar.details.you") : t("contact_profile_sidebar.media.user")}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    );
                                })()}
                            </div>
                        )}

                        {/* Custom Fields Tab */}
                        {activeTab === "custom-fields" && (
                            <div className="space-y-4">
                                {/* Workspace-defined custom fields */}
                                {profileCustomFields && profileCustomFields.length > 0 ? (
                                    <div className="space-y-3">
                                        {profileCustomFields.map((field) => (
                                            <div key={field.slug} className="space-y-1">
                                                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                                                    {field.label}
                                                </label>
                                                {field.has_properties && field.properties?.length > 0 ? (
                                                    <select
                                                        defaultValue={field.value ?? ''}
                                                        onBlur={(e) => onSaveCustomFieldValue?.(field.id, e.target.value)}
                                                        className="w-full text-sm border rounded-md px-2 py-1.5 bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                                                    >
                                                        <option value="">{t("contact_profile_sidebar.custom_fields.select_placeholder")}</option>
                                                        {field.properties.map((p) => (
                                                            <option key={p.value} value={p.value}>{p.name}</option>
                                                        ))}
                                                    </select>
                                                ) : (
                                                    <input
                                                        type={field.content_type === 'NUMBER' ? 'number' : field.content_type === 'EMAIL' ? 'email' : 'text'}
                                                        defaultValue={field.value ?? ''}
                                                        placeholder={t("contact_profile_sidebar.custom_fields.enter_field_placeholder", { field: field.label.toLowerCase() })}
                                                        onBlur={(e) => onSaveCustomFieldValue?.(field.id, e.target.value)}
                                                        className="w-full text-sm border rounded-md px-2 py-1.5 bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                                                    />
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center justify-center py-6 text-center text-muted-foreground">
                                        <NotebookPen size={28} className="mb-2 opacity-40" />
                                        <p className="text-sm">{t("contact_profile_sidebar.custom_fields.no_fields_defined")}</p>
                                        <p className="text-xs mt-1 opacity-70">{t("contact_profile_sidebar.custom_fields.go_to_settings")}</p>
                                    </div>
                                )}

                                {/* Manual attributes (key-value chips) */}
                                {customAttributes && Object.keys(customAttributes).length > 0 && (
                                    <div className="pt-2 border-t">
                                        <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">{t("contact_profile_sidebar.custom_fields.manual_attributes")}</p>
                                        <div className="flex flex-wrap gap-2">
                                            {Object.entries(customAttributes).map(([key, value]) => (
                                                <div
                                                    key={key}
                                                    className="flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs max-w-full"
                                                >
                                                    <span className="truncate max-w-[calc(100%-20px)]">{key}: {value}</span>
                                                    <button
                                                        onClick={() => {
                                                            const newAttrs = { ...customAttributes };
                                                            delete newAttrs[key];
                                                            onUpdateCustomAttributes(newAttrs);
                                                        }}
                                                        className="hover:text-blue-900 flex-shrink-0 border rounded"
                                                    >
                                                        <X size={14} />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                                <Button variant="outline" size="sm" onClick={() => setIsAddAttributeModalOpen(true)} className="w-full btn-outline-primary">
                                    <Plus size={14} className="mr-2" /> {t("contact_profile_sidebar.custom_fields.add_attribute_button")}
                                </Button>
                            </div>
                        )}

                        {/* Opportunities Tab */}
                        {activeTab === "opportunities" && (
                            <div className="space-y-3">
                                <Button variant="outline" size="sm" className="w-full btn-outline-primary" onClick={() => setIsAddOpportunityModalOpen(true)}>
                                    <Plus size={14} className="mr-2" /> {t("contact_profile_sidebar.opportunities.add")}
                                </Button>
                                {(profileData?.opportunities ?? []).length === 0 ? (
                                    <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
                                        <BarChart3 size={32} className="mb-2 opacity-50" />
                                        <p className="text-sm">{t("contact_profile_sidebar.opportunities.none_found")}</p>
                                    </div>
                                ) : (
                                    <div className="space-y-2">
                                        {(profileData?.opportunities ?? []).map((opp) => (
                                            <div key={opp.id} className="border rounded-md p-3 space-y-1.5 text-xs">
                                                <p className="font-semibold text-sm truncate">{opp.title ?? "Untitled"}</p>
                                                <div className="flex items-center gap-2 text-muted-foreground">
                                                    <span className="font-medium text-foreground">{opp.currency} {Number(opp.value).toLocaleString()}</span>
                                                    <span>·</span>
                                                    <span>{t("contact_profile_sidebar.opportunities.probability", { value: opp.probability })}</span>
                                                </div>
                                                <div className="flex flex-wrap gap-1">
                                                    {opp.pipeline && (
                                                        <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-muted-foreground">
                                                            {opp.pipeline.name}
                                                        </span>
                                                    )}
                                                    {opp.step && (
                                                        <span
                                                            className="px-1.5 py-0.5 rounded font-medium"
                                                            style={{ backgroundColor: opp.step.bg_color, color: opp.step.txt_color }}
                                                        >
                                                            {opp.step.name}
                                                        </span>
                                                    )}
                                                </div>
                                                {opp.closing_date && (
                                                    <p className="text-muted-foreground">
                                                        {t("contact_profile_sidebar.opportunities.closes", { date: formatInWorkspaceTz(opp.closing_date, "M/d/yyyy", workspaceTz) })}
                                                    </p>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}


                        {/* Assigned Tags Tab */}
                        {activeTab === "tags" && (
                            <div className="space-y-3">
                                <CustomDropdown
                                    options={tagOptions}
                                    selected={tags || []}
                                    onChange={onUpdateTags}
                                    placeholder={t("contact_profile_sidebar.tags.select_tags")}
                                    width="100%"
                                    triggerContent={
                                        <span className="flex items-center justify-between w-full">
                                            <span className="flex items-center gap-1 flex-wrap flex-1 min-w-0">
                                                {(tags || []).length === 0 ? (
                                                    <span className="text-slate-500 text-[12px]">{t("contact_profile_sidebar.tags.select_tags")}</span>
                                                ) : (
                                                    (tags || []).map((id) => {
                                                        const tagObj = tagOptions.find((o) => o.id === id);
                                                        return tagObj ? (
                                                            <span key={id} className="bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded text-xs truncate max-w-[120px]">{tagObj.name}</span>
                                                        ) : null;
                                                    })
                                                )}
                                            </span>
                                            <ChevronDown className="h-3.5 w-3.5 text-slate-400 flex-shrink-0 ml-2" />
                                        </span>
                                    }
                                />
                                {tags && tags.length > 0 && (
                                    <div className="flex flex-wrap gap-2">
                                        {tags.map((tagId) => {
                                            const tag = tagOptions.find(opt => opt.id === tagId);
                                            return (
                                                <div
                                                    key={tagId}
                                                    className="flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs max-w-full"
                                                >
                                                    <span className="truncate max-w-[calc(100%-20px)]">{tag?.name}</span>
                                                    <button
                                                        onClick={() => onUpdateTags(tags.filter(existing => existing !== tagId))}
                                                        className="hover:text-blue-900 flex-shrink-0"
                                                    >
                                                        <X size={12} />
                                                    </button>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Create Task Tab */}
                        {activeTab === "tasks" && (
                            <div className="space-y-3">
                                <Button variant="outline" size="sm" className="w-full btn-outline-primary" onClick={() => setIsAddTaskModalOpen(true)}>
                                    <Plus size={14} className="mr-2" /> {t("contact_profile_sidebar.tasks.add")}
                                </Button>
                                {contactTasks.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
                                        <ClipboardList size={32} className="mb-2 opacity-50" />
                                        <p className="text-sm">{t("contact_profile_sidebar.tasks.none_found")}</p>
                                    </div>
                                ) : (
                                    <div className="space-y-2">
                                        {contactTasks.map((task: any) => (
                                            <div key={task.id} className="border rounded-md p-3 space-y-1 text-xs">
                                                <p className="text-sm font-medium leading-snug">{task.description}</p>
                                                <div className="flex items-center gap-2 text-muted-foreground">
                                                    {task.datetime && (
                                                        <span>{formatInWorkspaceTz(task.datetime, "M/d/yyyy, h:mm:ss a", workspaceTz)}</span>
                                                    )}
                                                    {task.status && (
                                                        <span className={`capitalize px-1.5 py-0.5 rounded font-medium ${
                                                            task.status === 'COMPLETED'
                                                                ? 'bg-green-100 text-green-700'
                                                                : 'bg-yellow-100 text-yellow-700'
                                                        }`}>{task.status.toLowerCase()}</span>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* 
                            NOTE: Do not delete these commented out sections as their code might be reusable later.
                        */}

                        {/*
                        <Separator />
                        
                        <div>
                            <div className="flex items-center justify-between mb-3">
                                <h4 className="font-semibold text-sm">Basic Details</h4>
                                <Button variant="ghost" size="sm" onClick={() => {
                                    setEditedBasicDetails(basicDetails || {});
                                    setIsEditBasicDetailsOpen(true);
                                }} className="h-7 bg-white dark:bg-background border border-input dark:border-slate-700 hover:bg-accent dark:hover:bg-slate-700 hover-elevate text-xs" data-testid="button-edit-basic-details">
                                    Edit
                                </Button>
                            </div>
                            <div className="space-y-1 text-sm">
                                {basicDetails && (
                                    <>
                                        {basicDetails.displayName && (
                                            <div className="flex items-center justify-between gap-3">
                                                <span className="text-xs text-muted-foreground">Name</span>
                                                <span className="text-sm font-semibold truncate">{basicDetails.displayName}</span>
                                            </div>
                                        )}
                                        {canSeeChannels && basicDetails.number && (
                                            <div className="flex items-center justify-between gap-3">
                                                <span className="text-xs text-muted-foreground">Number</span>
                                                <span className="text-sm font-semibold truncate">{basicDetails.number}</span>
                                            </div>
                                        )}
                                        {canSeeChannels && basicDetails.email && (
                                            <div className="flex items-center justify-between gap-3">
                                                <span className="text-xs text-muted-foreground">Email</span>
                                                <span className="text-sm font-semibold truncate">{basicDetails.email}</span>
                                            </div>
                                        )}
                                        {basicDetails.gender && (
                                            <div className="flex items-center justify-between gap-3">
                                                <span className="text-xs text-muted-foreground">Gender</span>
                                                <span className="text-sm font-semibold truncate">{basicDetails.gender}</span>
                                            </div>
                                        )}
                                        {canSeeChannels && basicDetails.whatsappOptOut && (
                                            <div className="flex items-center justify-between gap-3">
                                                <span className="text-xs text-muted-foreground">WhatsApp Opt-out</span>
                                                <span className="text-sm font-semibold truncate">{basicDetails.whatsappOptOut}</span>
                                            </div>
                                        )}
                                        {basicDetails.address && (
                                            <div className="flex items-center justify-between gap-3">
                                                <span className="text-xs text-muted-foreground">Address</span>
                                                <span className="text-sm font-semibold truncate">{basicDetails.address}</span>
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>
                        </div>

                        <Separator />

                        <div>
                            <div className="flex items-center justify-between mb-3">
                                <h4 className="font-semibold text-sm">Involved Teams</h4>
                                <Button variant="ghost" size="sm" onClick={handleOpenTeamsModal} className="h-7 bg-white dark:bg-background border border-input dark:border-slate-700 hover:bg-accent dark:hover:bg-slate-700 hover-elevate text-xs" data-testid="button-add-teams">
                                    Add
                                </Button>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {involvedTeams?.map((teamId) => {
                                    const team = teamOptions.find(t => t.id === teamId);
                                    return (
                                        <div
                                            key={teamId}
                                            className="flex items-center gap-1 px-2 py-1 bg-purple-100 text-purple-700 rounded-full text-xs max-w-full"
                                        >
                                            <span className="truncate max-w-[calc(100%-20px)]">{team?.name}</span>
                                            <button
                                                onClick={() => {
                                                    const newTeams = involvedTeams.filter(t => t !== teamId);
                                                    onUpdateInvolvedTeams(newTeams);
                                                }}
                                                className="hover:text-purple-900 flex-shrink-0 border rounded"
                                            >
                                                <X size={14} />
                                            </button>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        <Separator />

                        <div>
                            <div className="flex items-center justify-between mb-3">
                                <h4 className="font-semibold text-sm">Tags</h4>
                                <Button variant="ghost" size="sm" onClick={handleOpenTagsModal} className="h-7 bg-white dark:bg-background border border-input dark:border-slate-700 hover:bg-accent dark:hover:bg-slate-700 hover-elevate text-xs" data-testid="button-add-tags">
                                    Add
                                </Button>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {tags?.map((tagId) => {
                                    const tag = tagOptions.find(t => t.id === tagId);
                                    return (
                                        <div
                                            key={tagId}
                                            className="flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs max-w-full"
                                        >
                                            <span className="truncate max-w-[calc(100%-20px)]">{tag?.name}</span>
                                            <button
                                                onClick={() => {
                                                    const newTags = tags.filter(t => t !== tagId);
                                                    onUpdateTags(newTags);
                                                }}
                                                className="hover:text-green-900 flex-shrink-0 border rounded"
                                            >
                                                <X size={14} />
                                            </button>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        <Separator />
                        <div>
                            <div className="flex items-center justify-between mb-3">
                                <h4 className="font-semibold text-sm">Custom Attributes</h4>
                                <Button variant="ghost" size="sm" onClick={() => setIsAddAttributeModalOpen(true)} className="h-7 bg-white dark:bg-background border border-input dark:border-slate-700 hover:bg-accent dark:hover:bg-slate-700 hover-elevate text-xs" data-testid="button-add-attribute">
                                    Add
                                </Button>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {customAttributes && Object.entries(customAttributes).map(([key, value]) => (
                                    <div
                                        key={key}
                                        className="flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs max-w-full"
                                    >
                                        <span className="truncate max-w-[calc(100%-20px)]">{key}: {value}</span>
                                        <button
                                            onClick={() => {
                                                const newAttrs = { ...customAttributes };
                                                delete newAttrs[key];
                                                onUpdateCustomAttributes(newAttrs);
                                            }}
                                            className="hover:text-blue-900 flex-shrink-0 border rounded"
                                        >
                                            <X size={14} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <Separator />

                        <div>
                            <div className="flex items-center justify-between mb-3">
                                <h4 className="font-semibold text-sm">Notes</h4>
                                <Button variant="ghost" size="sm" onClick={() => {
                                    const currentNotes = notes || [];
                                    setNewNote(currentNotes[currentNotes.length - 1] || ""); // Prefill with last note
                                    setIsAddNoteModalOpen(true);
                                }} className="h-7 bg-white dark:bg-background border border-input dark:border-slate-700 hover:bg-accent dark:hover:bg-slate-700 hover-elevate text-xs" data-testid="button-set-note">
                                    Set
                                </Button>
                            </div>
                            <div className="space-y-2">
                                {notes?.map((note, index) => (
                                    <div key={index} className="text-xs bg-slate-200/75 dark:bg-slate-800 p-2 rounded">
                                        {note}
                                    </div>
                                ))}
                            </div>
                        </div>
                        */}
                    </div>
                </CardContent>
            </Card >

            {/* Edit Basic Details Modal */}
            < Dialog open={isEditBasicDetailsOpen} onOpenChange={setIsEditBasicDetailsOpen} >
                <DialogContent className="sm:max-w-md max-h-[90vh] flex flex-col">
                    <DialogHeader className="px-1 mb-2">
                        <DialogTitle>{t("contact_profile_sidebar.edit_basic_details.title")}</DialogTitle>
                    </DialogHeader>

                    <div className="px-1 space-y-4 overflow-y-auto flex-1">
                        {/* Name */}
                        <div>
                            <label className="text-sm font-medium mb-2 block">{t("contact_profile_sidebar.edit_basic_details.name")}</label>
                            <div className="flex gap-2 items-center">
                                <Input
                                    value={editedBasicDetails.displayName || ""}
                                    onChange={(e) => setEditedBasicDetails({ ...editedBasicDetails, displayName: e.target.value })}
                                    placeholder={t("contact_profile_sidebar.edit_basic_details.enter_name")}
                                />
                                <button
                                    onClick={() => handleClearField("displayName")}
                                    className="text-muted-foreground hover:text-foreground transition-colors"
                                >
                                    <X size={18} />
                                </button>
                            </div>
                        </div>

                        {/* Number */}
                        <div>
                            <label className="text-sm font-medium mb-2 block">{t("contact_profile_sidebar.edit_basic_details.number")}</label>
                            <div className="flex gap-2">
                                <Input
                                    value={editedBasicDetails.number}
                                    disabled
                                    placeholder={t("contact_profile_sidebar.edit_basic_details.enter_number")}
                                    className="bg-muted text-muted-foreground cursor-not-allowed mr-6"
                                />
                            </div>
                        </div>

                        {/* Email */}
                        <div>
                            <label className="text-sm font-medium mb-2 block">{t("contact_profile_sidebar.edit_basic_details.email")}</label>
                            <div className="flex gap-2 items-center">
                                <Input
                                    value={editedBasicDetails.email}
                                    onChange={(e) => setEditedBasicDetails({ ...editedBasicDetails, email: e.target.value })}
                                    placeholder={t("contact_profile_sidebar.edit_basic_details.enter_email")}
                                />
                                <button
                                    onClick={() => handleClearField("email")}
                                    className="text-muted-foreground hover:text-foreground transition-colors"
                                >
                                    <X size={18} />
                                </button>
                            </div>
                        </div>

                        {/* Gender */}
                        <div>
                            <label className="text-sm font-medium mb-2 block">{t("contact_profile_sidebar.edit_basic_details.gender")}</label>
                            <div className="flex gap-2 items-center">
                                <Select value={editedBasicDetails.gender} onValueChange={(value) => setEditedBasicDetails({ ...editedBasicDetails, gender: value })}>
                                    <SelectTrigger className="flex-1">
                                        <SelectValue placeholder={t("contact_profile_sidebar.edit_basic_details.select_gender")} />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="Male">{t("contact_profile_sidebar.edit_basic_details.male")}</SelectItem>
                                        <SelectItem value="Female">{t("contact_profile_sidebar.edit_basic_details.female")}</SelectItem>
                                    </SelectContent>
                                </Select>
                                <button
                                    onClick={() => handleClearField("gender")}
                                    className="text-muted-foreground hover:text-foreground transition-colors"
                                >
                                    <X size={18} />
                                </button>
                            </div>
                        </div>

                        {/* WhatsApp Opt-out */}
                        <div>
                            <label className="text-sm font-medium mb-2 block">{t("contact_profile_sidebar.edit_basic_details.whatsapp_opt_out")}</label>
                            <div className="flex gap-2 items-center">
                                <Select value={editedBasicDetails.whatsappOptOut} onValueChange={(value) => setEditedBasicDetails({ ...editedBasicDetails, whatsappOptOut: value })}>
                                    <SelectTrigger className="flex-1">
                                        <SelectValue placeholder={t("contact_profile_sidebar.edit_basic_details.select_option")} />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="Yes">{t("contact_profile_sidebar.edit_basic_details.yes")}</SelectItem>
                                        <SelectItem value="No">{t("contact_profile_sidebar.edit_basic_details.no")}</SelectItem>
                                    </SelectContent>
                                </Select>
                                <button
                                    onClick={() => handleClearField("whatsappOptOut")}
                                    className="text-muted-foreground hover:text-foreground transition-colors"
                                >
                                    <X size={18} />
                                </button>
                            </div>
                        </div>

                        {/* Address */}
                        <div>
                            <label className="text-sm font-medium mb-2 block">{t("contact_profile_sidebar.edit_basic_details.address")}</label>
                            <div className="flex gap-2 items-center">
                                <Input
                                    value={editedBasicDetails.address}
                                    onChange={(e) => setEditedBasicDetails({ ...editedBasicDetails, address: e.target.value })}
                                    placeholder={t("contact_profile_sidebar.edit_basic_details.enter_address")}
                                />
                                <button
                                    onClick={() => handleClearField("address")}
                                    className="text-muted-foreground hover:text-foreground transition-colors"
                                >
                                    <X size={18} />
                                </button>
                            </div>
                        </div>
                    </div>
                    <div className="flex justify-end pt-2 px-1">
                        <Button onClick={handleSaveBasicDetails}>{t("contact_profile_sidebar.edit_basic_details.save_changes")}</Button>
                    </div>
                </DialogContent>
            </Dialog >

            {/* Add Teams Modal */}
            < Dialog open={isAddTeamsModalOpen} onOpenChange={setIsAddTeamsModalOpen} >
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>{t("contact_profile_sidebar.teams_modal.title")}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="flex flex-col gap-3">
                            {teamOptions.map(team => (
                                <div key={team.id} className="flex items-center space-x-2">
                                    <input
                                        type="checkbox"
                                        id={`team-${team.id}`}
                                        className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                                        checked={selectedTeamsForModal.includes(team.id)}
                                        onChange={(e) => {
                                            if (e.target.checked) {
                                                setSelectedTeamsForModal([...selectedTeamsForModal, team.id]);
                                            } else {
                                                setSelectedTeamsForModal(selectedTeamsForModal.filter(id => id !== team.id));
                                            }
                                        }}
                                    />
                                    <label htmlFor={`team-${team.id}`} className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                                        {team.name}
                                    </label>
                                </div>
                            ))}
                        </div>
                    </div>
                    <div className="flex justify-end">
                        <Button onClick={handleSaveTeams}>{t("contact_profile_sidebar.edit_basic_details.save_changes")}</Button>
                    </div>
                </DialogContent>
            </Dialog >

            {/* Add Tags Modal */}
            < Dialog open={isAddTagsModalOpen} onOpenChange={setIsAddTagsModalOpen} >
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>{t("contact_profile_sidebar.tags_modal.title")}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="flex flex-col gap-3">
                            {tagOptions.map(tag => (
                                <div key={tag.id} className="flex items-center space-x-2">
                                    <input
                                        type="checkbox"
                                        id={`tag-${tag.id}`}
                                        className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                                        checked={selectedTagsForModal.includes(tag.id)}
                                        onChange={(e) => {
                                            if (e.target.checked) {
                                                setSelectedTagsForModal([...selectedTagsForModal, tag.id]);
                                            } else {
                                                setSelectedTagsForModal(selectedTagsForModal.filter(id => id !== tag.id));
                                            }
                                        }}
                                    />
                                    <label htmlFor={`tag-${tag.id}`} className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                                        {tag.name}
                                    </label>
                                </div>
                            ))}
                        </div>
                    </div>
                    <div className="flex justify-end">
                        <Button onClick={handleSaveTags}>{t("contact_profile_sidebar.edit_basic_details.save_changes")}</Button>
                    </div>
                </DialogContent>
            </Dialog >

            {/* Add Custom Attribute Modal */}
            < Dialog open={isAddAttributeModalOpen} onOpenChange={setIsAddAttributeModalOpen} >
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>{t("contact_profile_sidebar.attribute_modal.title")}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium">{t("contact_profile_sidebar.attribute_modal.name_label")}</label>
                            <Input
                                placeholder={t("contact_profile_sidebar.attribute_modal.name_placeholder")}
                                value={newAttributeKey}
                                onChange={(e) => setNewAttributeKey(e.target.value)}
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">{t("contact_profile_sidebar.attribute_modal.value_label")}</label>
                            <Input
                                placeholder={t("contact_profile_sidebar.attribute_modal.value_placeholder")}
                                value={newAttributeValue}
                                onChange={(e) => setNewAttributeValue(e.target.value)}
                            />
                        </div>
                    </div>
                    <div className="flex justify-end">
                        <Button onClick={handleAddAttribute} disabled={!newAttributeKey.trim() || !newAttributeValue.trim()}>
                            {t("contact_profile_sidebar.attribute_modal.add_button")}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog >

            {/* Add Note Modal */}
            < Dialog open={isAddNoteModalOpen} onOpenChange={setIsAddNoteModalOpen} >
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>{t("contact_profile_sidebar.note_modal.title")}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium">{t("contact_profile_sidebar.note_modal.content_label")}</label>
                            <Input
                                placeholder={t("contact_profile_sidebar.note_modal.content_placeholder")}
                                value={newNote}
                                onChange={(e) => setNewNote(e.target.value)}
                            />
                            <p className="text-xs text-muted-foreground">{t("contact_profile_sidebar.note_modal.helper_text")}</p>
                        </div>
                    </div>
                    <div className="flex justify-end">
                        <Button onClick={handleAddNote}>
                            {t("contact_profile_sidebar.note_modal.save_button")}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog >

            {/* Add Opportunity Modal */}
            <Dialog open={isAddOpportunityModalOpen} onOpenChange={setIsAddOpportunityModalOpen}>
                <DialogContent className="bg-white dark:bg-background">
                    <DialogHeader>
                        <DialogTitle>{t("contact_profile_sidebar.opportunities.add")}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 max-h-[60vh] overflow-y-auto">
                        <div>
                            <label className="text-sm font-medium">{t("contact_profile_sidebar.opportunity_modal.pipeline")}</label>
                            <Select value={newOpportunity.pipeline} onValueChange={(value) => setNewOpportunity({ ...newOpportunity, pipeline: value, stage: "" })}>
                                <SelectTrigger>
                                    <SelectValue placeholder={t("contact_profile_sidebar.opportunity_modal.select_pipeline")} />
                                </SelectTrigger>
                                <SelectContent>
                                    {pipelines.map((p: any) => (
                                        <SelectItem key={String(p.id)} value={String(p.id)}>{p.name}</SelectItem>
                                    ))}
                                    {pipelines.length === 0 && <SelectItem value="" disabled>{t("contact_profile_sidebar.opportunity_modal.no_pipelines_found")}</SelectItem>}
                                </SelectContent>
                            </Select>
                        </div>
                        {newOpportunity.pipeline && (
                            <div>
                                <label className="text-sm font-medium">{t("contact_profile_sidebar.opportunity_modal.stage")}</label>
                                <Select value={newOpportunity.stage} onValueChange={(value) => setNewOpportunity({ ...newOpportunity, stage: value })}>
                                    <SelectTrigger>
                                        <SelectValue placeholder={t("contact_profile_sidebar.opportunity_modal.select_stage")} />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {selectedPipelineSteps.map((s: any) => (
                                            <SelectItem key={String(s.id)} value={String(s.id)}>{s.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        )}
                        <div>
                            <label className="text-sm font-medium">{t("contact_profile_sidebar.opportunity_modal.title_label")}</label>
                            <Input
                                placeholder={t("contact_profile_sidebar.opportunity_modal.title_placeholder")}
                                value={newOpportunity.title}
                                onChange={(e) => setNewOpportunity({ ...newOpportunity, title: e.target.value })}
                            />
                        </div>
                        <div>
                            <label className="text-sm font-medium">{t("contact_profile_sidebar.opportunity_modal.value_label")}</label>
                            <div className="flex gap-2">
                                <Input
                                    type="number"
                                    placeholder={t("contact_profile_sidebar.opportunity_modal.value_placeholder")}
                                    value={newOpportunity.value}
                                    onChange={(e) => setNewOpportunity({ ...newOpportunity, value: e.target.value })}
                                    className="flex-1"
                                />
                                <Select value={newOpportunity.currency} onValueChange={(value) => setNewOpportunity({ ...newOpportunity, currency: value })}>
                                    <SelectTrigger className="w-24">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="USD">USD</SelectItem>
                                        <SelectItem value="EUR">EUR</SelectItem>
                                        <SelectItem value="GBP">GBP</SelectItem>
                                        <SelectItem value="PKR">PKR</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <div>
                            <label className="text-sm font-medium">{t("contact_profile_sidebar.opportunity_modal.closing_date")}</label>
                            <Input
                                type="date"
                                value={newOpportunity.closingDate}
                                onChange={(e) => setNewOpportunity({ ...newOpportunity, closingDate: e.target.value })}
                            />
                        </div>
                        <div>
                            <label className="text-sm font-medium">{t("contact_profile_sidebar.opportunity_modal.confidence")}</label>
                            <div className="flex items-center gap-2">
                                <Input
                                    type="range"
                                    min="0"
                                    max="100"
                                    step="5"
                                    value={newOpportunity.confidence}
                                    onChange={(e) => setNewOpportunity({ ...newOpportunity, confidence: e.target.value })}
                                    className="flex-1"
                                />
                                <span className="text-sm font-medium w-12 text-right">{newOpportunity.confidence}%</span>
                            </div>
                        </div>
                        <div>
                            <label className="text-sm font-medium">{t("contact_profile_sidebar.opportunity_modal.agent")}</label>
                            <Select
                                value={newOpportunity.agent}
                                onValueChange={(value) => setNewOpportunity({ ...newOpportunity, agent: value })}
                                disabled={!newOpportunity.pipeline}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder={newOpportunity.pipeline ? t("contact_profile_sidebar.opportunity_modal.select_agent") : t("contact_profile_sidebar.opportunity_modal.select_pipeline_first")}>
                                        {newOpportunity.agent && (() => {
                                            const agent = agentOptions.find(a => a.id === newOpportunity.agent);
                                            const getAgentColor = (id: string) => {
                                                if (id === "self") return "bg-primary";
                                                if (id === "agent-1") return "bg-blue-500";
                                                if (id === "agent-2") return "bg-green-500";
                                                if (id === "agent-3") return "bg-purple-500";
                                                if (id === "agent-4") return "bg-orange-500";
                                                return "bg-gray-500";
                                            };
                                            return agent ? (
                                                <div className="flex items-center gap-2">
                                                    <div className={`w-5 h-5 rounded-full ${getAgentColor(agent.id)} flex items-center justify-center text-[10px] font-semibold text-white`}>
                                                        {agent.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                                                    </div>
                                                    <span>{agent.name}</span>
                                                </div>
                                            ) : null;
                                        })()}
                                    </SelectValue>
                                </SelectTrigger>
                                <SelectContent>
                                    {agentOptions.map((agent) => {
                                        const getAgentColor = (id: string) => {
                                            if (id === "self") return "bg-primary";
                                            if (id === "agent-1") return "bg-blue-500";
                                            if (id === "agent-2") return "bg-green-500";
                                            if (id === "agent-3") return "bg-purple-500";
                                            if (id === "agent-4") return "bg-orange-500";
                                            return "bg-gray-500";
                                        };
                                        return (
                                            <SelectItem key={agent.id} value={agent.id}>
                                                <div className="flex items-center gap-2">
                                                    <div className={`w-5 h-5 rounded-full ${getAgentColor(agent.id)} flex items-center justify-center text-[10px] font-semibold text-white`}>
                                                        {agent.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                                                    </div>
                                                    <span>{agent.name}</span>
                                                </div>
                                            </SelectItem>
                                        );
                                    })}
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <label className="text-sm font-medium">{t("contact_profile_sidebar.opportunity_modal.contact")}</label>
                            <div className="text-xs text-muted-foreground mb-1">{t("contact_profile_sidebar.opportunity_modal.whatsapp_number")}</div>
                            <Input
                                placeholder={t("contact_profile_sidebar.opportunity_modal.select_contact")}
                                value={newOpportunity.contact}
                                onChange={(e) => setNewOpportunity({ ...newOpportunity, contact: e.target.value })}
                            />
                        </div>
                        <div>
                            <label className="text-sm font-medium">{t("contact_profile_sidebar.opportunity_modal.assigned_tags")}</label>
                            <CustomDropdown
                                options={tagOptions}
                                selected={newOpportunity.tags}
                                onChange={(tags) => setNewOpportunity({ ...newOpportunity, tags })}
                                placeholder={t("contact_profile_sidebar.tags.select_tags")}
                                width="100%"
                            />
                        </div>
                        <div>
                            <label className="text-sm font-medium">{t("contact_profile_sidebar.opportunity_modal.note")}</label>
                            <Textarea
                                placeholder={t("contact_profile_sidebar.opportunity_modal.enter_note")}
                                value={newOpportunity.note}
                                onChange={(e) => setNewOpportunity({ ...newOpportunity, note: e.target.value })}
                                rows={3}
                            />
                        </div>
                    </div>
                    <div className="flex justify-end gap-2">
                        <Button variant="outline" onClick={() => {
                            setIsAddOpportunityModalOpen(false);
                            setNewOpportunity({ pipeline: "", stage: "", title: "", value: "", currency: "USD", closingDate: "", confidence: "5", agent: "", contact: "", tags: [], note: "" });
                        }} disabled={createOpportunityMutation.isPending}>
                            {t("contact_profile_sidebar.opportunity_modal.cancel")}
                        </Button>
                        <Button
                            onClick={handleSaveOpportunity}
                            disabled={!newOpportunity.title || !newOpportunity.pipeline || !newOpportunity.stage || createOpportunityMutation.isPending}
                        >
                            {createOpportunityMutation.isPending ? t("contact_profile_sidebar.opportunity_modal.saving") : t("contact_profile_sidebar.opportunity_modal.save")}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Add Task Modal */}
            <Dialog open={isAddTaskModalOpen} onOpenChange={setIsAddTaskModalOpen}>
                <DialogContent className="bg-white dark:bg-background">
                    <DialogHeader>
                        <DialogTitle>{t("contact_profile_sidebar.tasks.add")}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div>
                            <label className="text-sm font-medium">{t("contact_profile_sidebar.task_modal.note")}</label>
                            <Textarea
                                placeholder={t("contact_profile_sidebar.task_modal.enter_note")}
                                value={newTask.note}
                                onChange={(e) => setNewTask({ ...newTask, note: e.target.value })}
                                rows={3}
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-sm font-medium">{t("contact_profile_sidebar.task_modal.select_date")}</label>
                                <Input
                                    type="date"
                                    value={newTask.date}
                                    onChange={(e) => setNewTask({ ...newTask, date: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="text-sm font-medium">{t("contact_profile_sidebar.task_modal.select_time")}</label>
                                <Input
                                    type="time"
                                    value={newTask.time}
                                    onChange={(e) => setNewTask({ ...newTask, time: e.target.value })}
                                />
                            </div>
                        </div>
                        <div>
                            <label className="text-sm font-medium">{t("contact_profile_sidebar.task_modal.agent")}</label>
                            <Select value={newTask.agent} onValueChange={(value) => setNewTask({ ...newTask, agent: value })}>
                                <SelectTrigger>
                                    <SelectValue placeholder={t("contact_profile_sidebar.task_modal.select_agent")}>
                                        {newTask.agent && (() => {
                                            const agent = agentOptions.find(a => a.id === newTask.agent);
                                            const getAgentColor = (id: string) => {
                                                if (id === "self") return "bg-primary";
                                                if (id === "agent-1") return "bg-blue-500";
                                                if (id === "agent-2") return "bg-green-500";
                                                if (id === "agent-3") return "bg-purple-500";
                                                if (id === "agent-4") return "bg-orange-500";
                                                return "bg-gray-500";
                                            };
                                            return agent ? (
                                                <div className="flex items-center gap-2">
                                                    <div className={`w-5 h-5 rounded-full ${getAgentColor(agent.id)} flex items-center justify-center text-[10px] font-semibold text-white`}>
                                                        {agent.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                                                    </div>
                                                    <span>{agent.name}</span>
                                                </div>
                                            ) : null;
                                        })()}
                                    </SelectValue>
                                </SelectTrigger>
                                <SelectContent>
                                    {agentOptions.map((agent) => {
                                        const getAgentColor = (id: string) => {
                                            if (id === "self") return "bg-primary";
                                            if (id === "agent-1") return "bg-blue-500";
                                            if (id === "agent-2") return "bg-green-500";
                                            if (id === "agent-3") return "bg-purple-500";
                                            if (id === "agent-4") return "bg-orange-500";
                                            return "bg-gray-500";
                                        };
                                        return (
                                            <SelectItem key={agent.id} value={agent.id}>
                                                <div className="flex items-center gap-2">
                                                    <div className={`w-5 h-5 rounded-full ${getAgentColor(agent.id)} flex items-center justify-center text-[10px] font-semibold text-white`}>
                                                        {agent.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                                                    </div>
                                                    <span>{agent.name}</span>
                                                </div>
                                            </SelectItem>
                                        );
                                    })}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <div className="flex justify-end gap-2">
                        <Button variant="outline" onClick={() => {
                            setIsAddTaskModalOpen(false);
                            setNewTask({ note: "", date: "", time: "", agent: "", contact: "" });
                        }}>
                            {t("contact_profile_sidebar.task_modal.cancel")}
                        </Button>
                        <Button
                            onClick={handleSaveTask}
                            disabled={!newTask.note || !newTask.date || !newTask.time || !contactId || createTaskMutation.isPending}
                        >
                            {createTaskMutation.isPending ? t("contact_profile_sidebar.task_modal.saving") : t("contact_profile_sidebar.task_modal.save")}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            <ContactProfileModal
                open={isDetailsModalOpen}
                onOpenChange={setIsDetailsModalOpen}
                contact={((profileData as any)?.contact ?? conversation) as any}
            />
        </>
    );
}
