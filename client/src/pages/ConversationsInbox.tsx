import React, { useState, useRef, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Search, RefreshCw, Eye, EyeOff, Download, Send, Phone, Mail, Plus, Filter, ArrowUp, X, Image, Mic, MicOff, Paperclip, XCircle, Smile, Trash2 } from "react-feather";
import { GripVertical, MoreVertical, ChevronDown, User, ListFilter, CheckCircle, AlertOctagon, UserX, Check, CheckCheck, Clock, CornerUpLeft, Folder as FolderIcon, Bot, FileText, MapPin, Type as TypeIcon, Bold, Italic, Strikethrough, Code, Play, Pause, Copy, MessageSquare, Inbox as InboxIcon, NotebookPen, History } from "lucide-react";
import data from '@emoji-mart/data';
import Picker from '@emoji-mart/react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn, formatConversationTime, formatMessageDate, formatMessageTime } from "@/lib/utils";
import { useWorkspaceTimezone } from "@/contexts/WorkspaceTimezoneContext";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { getUserInfo, hasAnyPerm } from "@/lib/auth";
import { Loader2 } from "lucide-react";
import { useSocket } from "@/hooks/use-socket";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

import { Separator } from "@/components/ui/separator";
import Breadcrumb from "@/components/Breadcrumb";
import CustomDropdown from "@/components/CustomDropdown";
import { AlertCircle } from "lucide-react";
import PreviewV2 from "@/components/PreviewV2";
import { Textarea } from "@/components/ui/textarea";
import { getAvatarColor } from "@/lib/avatar-utils";
import ContactProfileSidebar from "@/components/ContactProfileSidebar";
import MediaGallerySection from "@/components/workspace/MediaGallerySection";

interface Conversation {
  id: number;
  name: string;
  displayName: string;
  phoneNumber: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  lastMessage: string;
  time: string;
  unread: number;
  status: string;
  assignedAgent: string | null;
  assignedAgentName: string | null;
  channel: string;
  isAssigned?: boolean;
  folderId?: string | null;
  // WhatsApp: which number this chat belongs to (per-row badge) + opt-in state (M19).
  channelNumber?: { name: string | null; phone_number: string | null } | null;
  hasOptedIn?: boolean;
}

// WhatsApp Cloud API file-size limits (bytes)
const WA_SIZE_LIMITS: Record<string, number> = {
  image: 5 * 1024 * 1024,   // 5 MB
  video: 16 * 1024 * 1024,  // 16 MB
  audio: 16 * 1024 * 1024,  // 16 MB
};
const WA_DOC_LIMIT = 100 * 1024 * 1024; // 100 MB for documents

// Sticker / Location composer options — hidden from the "+" menu for now.
// Kept (not deleted) so re-enabling later is a one-line flip.
const COMPOSER_STICKER_LOCATION_ENABLED = false;

// Chat-thread message-mode filter (replyagent header dropdown — 5 modes).
// ALL/AUTOMATION/INBOX map to communication_mode; NOTE shows note_action/note
// rows; OLD_DATA shows messages older than 3 months (replyagent archive view).
const CHAT_MODES = [
  { value: "ALL", labelKey: "conversations_inbox.chat_modes.all", icon: MessageSquare },
  { value: "AUTOMATION", labelKey: "conversations_inbox.chat_modes.automation", icon: Bot },
  { value: "INBOX", labelKey: "conversations_inbox.chat_modes.inbox", icon: InboxIcon },
  { value: "NOTE", labelKey: "conversations_inbox.chat_modes.note", icon: NotebookPen },
  { value: "OLD_DATA", labelKey: "conversations_inbox.chat_modes.old_data", icon: History },
] as const;

// Target languages for the AI translate picker (replyagent language list).
const AI_LANGUAGES = [
  "English", "Spanish", "Arabic", "Urdu", "Hindi", "French", "German",
  "Portuguese", "Italian", "Turkish", "Russian", "Chinese", "Japanese",
  "Korean", "Indonesian", "Dutch", "Bengali", "Punjabi",
];

function getWaLimit(file: File): number {
  const category = file.type.split('/')[0];
  return WA_SIZE_LIMITS[category] ?? WA_DOC_LIMIT;
}

function waLimitLabel(file: File): string {
  const limit = getWaLimit(file);
  return limit >= 1024 * 1024 ? `${limit / 1024 / 1024}MB` : `${limit / 1024}KB`;
}

// Outbound delivery state for WhatsApp messages.
//   pending  : queued in backend, not yet ack'd by Meta
//   sent     : Meta accepted (single tick)
//   delivered: phone received (double grey tick)
//   read     : phone read (double blue tick)
//   failed   : send error (red warning)
type MessageStatus = 'pending' | 'sent' | 'delivered' | 'read' | 'failed';

interface Message {
  id: number;
  from: 'agent' | 'user';
  text: string;
  time: string;
  status?: MessageStatus;
  images?: Array<{ url: string; name: string; size: number; thumb?: string | null }>;
  attachments?: Array<{ url: string; name: string; size: number }>;
  video?: { url: string; name: string; size: number; thumbnail?: string };
  audio?: { url: string; name: string; size: number };
  // System messages (replyagent note_action pills): ticket banner, closed, etc.
  kind?: 'system';
  tone?: string;
  // Outgoing sender info — drives the per-bubble agent avatar vs bot icon.
  communicationMode?: string;
  senderName?: string | null;
  // Failed-send error detail (replyagent error tooltip).
  errorData?: string | null;
  // WhatsApp template message → rendered as a preview card.
  template?: { name: string; components: any[]; params: any[] } | null;
  // Tier-3 rich types.
  location?: { latitude?: number; longitude?: number; name?: string; address?: string } | null;
  vcards?: any[] | null;
  // Persisted reply quote — the message this one is replying to (resolved by the
  // backend from `reply_to`), so the quote survives reloads. Mirrors replyagent's
  // WhatsappMessageResource `reply`.
  reply?: { id: number; from: 'agent' | 'user'; text: string } | null;
}

interface Agent {
  id: string;
  name: string;
  icon: React.ReactNode;
}

interface Team {
  id: string;
  name: string;
}

interface Filter {
  id: string;
  column: string;
  operator: string;
  value: string;
}

interface BackendConversation {
  id: number | string;
  contacts?: { full_name?: string; first_name?: string; last_name?: string; mobile_number?: string; email?: string };
  last_message_text?: string;
  updated_at?: string;
  unread_count?: number;
  status?: string;
  users?: { id?: number | string; name?: string; full_name?: string; first_name?: string; last_name?: string };
  modelable_type?: string;
  is_assigned?: number | boolean;
  folder_id?: number | string | null;
}

interface BackendMessage {
  id: number;
  direction: 'OUTGOING' | 'INCOMING';
  // Per-channel tables store the body under different keys: wa_messages uses `text`,
  // older channels use `message_text`. Accept both so the mapper can fall back.
  text?: string;
  message_text?: string;
  status?: string;
  created_at: string;
}

interface SocketData {
  inbox_id: string;
  message?: { text?: string };
}

interface AgentOption {
  id: string;
  name: string;
  icon: React.ReactNode;
}

interface BasicDetails {
  displayName: string;
  number: string;
  email: string;
  gender: string;
  whatsappOptOut: string;
  address: string;
}

interface Contact {
  id: number;
  name: string;
  number: string;
  pfp?: string;
  callConsent: string;
  callsUsed?: number;
  callsMax?: number;
  renewsIn?: string;
  expiryDays?: number;
  expiryHours?: number;
}

interface Template {
  id: number;
  name: string;
  body: string;
  header?: string;
  footer?: string;
  buttons?: any[];
  variables: string[];
}

interface Emoji {
  native: string;
}


// Helper function to get display name - defaults to phone number if displayName not set
const getDisplayName = (conversation?: Conversation | null): string => {
  if (!conversation) return "Unknown";
  return conversation.displayName?.trim() || conversation.phoneNumber || conversation.name || "Unknown";
};

// Two-letter initials for the per-bubble sender/contact avatars.
const getInitials = (name?: string | null): string => {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "U";
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

// Compact WhatsApp-template preview card for template messages in the thread
// (replyagent TemplatePreview). Parses Meta components (HEADER/BODY/FOOTER/
// BUTTONS) and substitutes the sent {{n}} body variables.
const TemplateMessageCard: React.FC<{ template: { name: string; components: any[]; params: any[] } }> = ({ template }) => {
  const { t } = useTranslation();
  const components = Array.isArray(template.components) ? template.components : [];
  const header = components.find((c: any) => c.type === "HEADER");
  const body = components.find((c: any) => c.type === "BODY");
  const footer = components.find((c: any) => c.type === "FOOTER");
  const buttons = components.find((c: any) => c.type === "BUTTONS");

  const bodyParams =
    (template.params || []).find((c: any) => String(c.type || "").toLowerCase() === "body")?.parameters ?? [];
  const bodyText = String(body?.text ?? "").replace(/\{\{(\d+)\}\}/g, (_m: string, n: string) => {
    const p = bodyParams[Number(n) - 1];
    return (p && (p.text ?? p.image?.link ?? "")) || `{{${n}}}`;
  });

  return (
    <div className="rounded-md border border-black/10 dark:border-white/10 bg-white/60 dark:bg-black/20 overflow-hidden min-w-[12rem] max-w-[20rem]">
      <div className="px-2 py-1 bg-black/5 dark:bg-white/5 text-[10px] uppercase tracking-wide text-muted-foreground flex items-center gap-1">
        <FileText size={11} /> {t("conversations_inbox.template_card.label")}{template.name ? ` · ${template.name}` : ""}
      </div>
      {header?.text && <div className="px-3 pt-2 text-sm font-semibold">{header.text}</div>}
      {bodyText && <div className="px-3 py-2 text-sm whitespace-pre-wrap">{bodyText}</div>}
      {footer?.text && <div className="px-3 pb-2 text-xs text-muted-foreground">{footer.text}</div>}
      {Array.isArray(buttons?.buttons) && buttons.buttons.length > 0 && (
        <div className="border-t border-black/10 dark:border-white/10 divide-y divide-black/10 dark:divide-white/10">
          {buttons.buttons.map((b: any, i: number) => (
            <div key={i} className="px-3 py-1.5 text-xs text-center text-blue-600 dark:text-blue-400">{b.text}</div>
          ))}
        </div>
      )}
    </div>
  );
};

// WhatsApp-style delivery tick mark for outgoing messages.
//   pending   -> clock
//   sent      -> single grey ✓
//   delivered -> double grey ✓✓
//   read      -> double blue ✓✓
//   failed    -> red ⚠ (with tooltip)
const MessageStatusTick: React.FC<{ status: MessageStatus }> = ({ status }) => {
  const { t } = useTranslation();
  const size = 12;
  if (status === 'pending') {
    return <Clock size={size} className="text-gray-400 dark:text-slate-500" aria-label={t("conversations_inbox.messages.sending")} />;
  }
  if (status === 'sent') {
    return <Check size={size} className="text-gray-500 dark:text-slate-400" aria-label={t("conversations_inbox.messages.sent")} />;
  }
  if (status === 'delivered') {
    return <CheckCheck size={size} className="text-gray-500 dark:text-slate-400" aria-label={t("conversations_inbox.messages.delivered")} />;
  }
  if (status === 'read') {
    return <CheckCheck size={size} className="text-blue-500 dark:text-blue-400" aria-label={t("conversations_inbox.messages.read")} />;
  }
  if (status === 'failed') {
    return <AlertCircle size={size} className="text-red-500" aria-label={t("conversations_inbox.messages.failed_to_send")} />;
  }
  return null;
};

// WhatsApp-style voice-note player — custom play button + waveform bars
// instead of the plain browser <audio controls> widget. The waveform itself
// is decorative (deterministic per-URL, not decoded from real amplitude
// data — matches how most chat clones approximate this), but play/pause,
// scrubbing and the progress fill are all real, driven by the actual
// <audio> element.
// Module-level (not React state) so every VoiceMessagePlayer instance on the
// page shares one "who's playing" slot — WhatsApp only ever plays one voice
// note at a time; starting a new one pauses whichever was already playing.
let activelyPlayingAudio: HTMLAudioElement | null = null;

const VoiceMessagePlayer: React.FC<{ url: string; timestampSlot?: React.ReactNode }> = ({ url, timestampSlot }) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const bars = useMemo(() => {
    let seed = 0;
    for (let i = 0; i < url.length; i++) seed = (seed * 31 + url.charCodeAt(i)) >>> 0;
    const next = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return (seed % 1000) / 1000; };
    return Array.from({ length: 32 }, () => 0.25 + next() * 0.75);
  }, [url]);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) {
      audio.pause();
    } else {
      if (activelyPlayingAudio && activelyPlayingAudio !== audio) {
        activelyPlayingAudio.pause();
      }
      activelyPlayingAudio = audio;
      audio.play().catch(() => {});
    }
  };

  const seek = (e: React.MouseEvent<HTMLDivElement>) => {
    const audio = audioRef.current;
    if (!audio || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    audio.currentTime = ratio * duration;
  };

  const formatT = (s: number) => {
    if (!isFinite(s) || s < 0) s = 0;
    return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
  };

  const progress = duration > 0 ? currentTime / duration : 0;

  return (
    <div className="min-w-[250px]">
      <audio
        ref={audioRef}
        src={url}
        // <audio> can load and play a cross-origin URL without any CORS
        // headers from the server (fetch()/XHR cannot — that's why an
        // earlier fetch-then-blob attempt here just hung forever against
        // this bucket's CORS setup). preload="auto" tells the browser to
        // buffer the whole file up front instead of only metadata.
        preload="auto"
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onEnded={(e) => {
          setIsPlaying(false);
          e.currentTarget.currentTime = 0;
          setCurrentTime(0);
        }}
        onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
        onError={(e) => {
          const err = e.currentTarget.error;
          console.error('[VoiceMessagePlayer] playback error', err?.code, err?.message, url);
          setIsPlaying(false);
        }}
        onStalled={() => console.warn('[VoiceMessagePlayer] stalled — network could not supply data', url)}
        className="hidden"
      />
      <div className="flex items-center gap-2">
        <button
          onClick={(e) => { e.stopPropagation(); togglePlay(); }}
          className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 bg-black/10 dark:bg-white/10 hover:bg-black/15 dark:hover:bg-white/15 transition-colors"
        >
          {isPlaying ? <Pause size={14} /> : <Play size={14} className="ml-0.5" />}
        </button>
        <div
          onClick={(e) => { e.stopPropagation(); seek(e); }}
          className="flex-1 flex items-end gap-[2px] h-5 cursor-pointer min-w-0"
        >
          {bars.map((h, i) => (
            <div
              key={i}
              className={`flex-1 rounded-full transition-colors ${i / bars.length < progress ? "bg-emerald-700 dark:bg-emerald-300" : "bg-black/20 dark:bg-white/25"}`}
              style={{ height: `${h * 100}%` }}
            />
          ))}
        </div>
      </div>
      {/* Duration (left) + the message's sent-at time/ticks (right) share
          one row below the waveform — matches WhatsApp's own layout. */}
      <div className="flex items-center justify-between mt-0.5 pl-9">
        <span className="text-[11px] tabular-nums opacity-70">
          {formatT(isPlaying || currentTime > 0 ? currentTime : duration)}
        </span>
        {timestampSlot}
      </div>
    </div>
  );
};

export default function ConversationsInbox() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const workspaceTz = useWorkspaceTimezone();

  const [activeTab, setActiveTab] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  // Chat thread message-mode filter (replyagent header dropdown).
  // ALL = Smart flow & Inbox · AUTOMATION = Smart flow · INBOX = Inbox messages.
  const [chatMode, setChatMode] = useState<string>("ALL");
  const [selectedConversation, setSelectedConversation] = useState<number | null>(() => {
    try {
      const saved = sessionStorage.getItem("inbox_selected_conv");
      return saved ? parseInt(saved, 10) : null;
    } catch { return null; }
  });

  // Persist selected conversation so page refresh restores it
  useEffect(() => {
    try {
      if (selectedConversation != null) {
        sessionStorage.setItem("inbox_selected_conv", String(selectedConversation));
      } else {
        sessionStorage.removeItem("inbox_selected_conv");
      }
    } catch {}
  }, [selectedConversation]);

  // WebSocket Integration. Pull workspace_id from the JWT-backed user_info blob
  // (set at login) instead of hardcoding 1 — otherwise multi-workspace agents see
  // events from the wrong workspace room.
  const workspaceId = useMemo(() => {
    try {
      const raw = localStorage.getItem("user_info");
      if (!raw) return 1;
      const parsed = JSON.parse(raw);
      const wsId = parsed?.workspace_id ?? parsed?.modelable_id ?? 1;
      return Number(wsId) || 1;
    } catch {
      return 1;
    }
  }, []);
  const socket = useSocket(workspaceId);

  useEffect(() => {
    if (!socket) return;

    const handleNewMessage = (data: SocketData) => {
      const msg = data.message as any;

      queryClient.invalidateQueries({ queryKey: ["/api/inbox/list"] });

      if (selectedConversation && data.inbox_id === selectedConversation.toString()) {
        if (msg?.id && msg?.direction === 'OUTGOING') {
          // Outgoing: replace optimistic placeholder with real message from socket
          // (socket fires before HTTP response returns — no need to wait for API)
          queryClient.setQueryData(["/api/inbox/messages", selectedConversation], (old: any) => {
            if (!old?.messages) return old;
            const withoutOptimistic = old.messages.filter((m: any) => !String(m.id).startsWith('opt_'));
            const alreadyThere = withoutOptimistic.some((m: any) => String(m.id) === String(msg.id));
            if (alreadyThere) return { ...old, messages: withoutOptimistic };
            return {
              ...old,
              messages: [...withoutOptimistic, {
                ...msg,
                parsed_files: Array.isArray(msg.parsed_files) ? msg.parsed_files : [],
                reactions: [],
              }],
            };
          });
        } else if (msg?.id) {
          // Incoming: add directly from socket — no HTTP refetch needed
          // For media/voice, parsed_files arrive later via message_media_ready
          queryClient.setQueryData(["/api/inbox/messages", selectedConversation], (old: any) => {
            if (!old?.messages) return old;
            const alreadyThere = old.messages.some((m: any) => String(m.id) === String(msg.id));
            if (alreadyThere) return old;
            return {
              ...old,
              messages: [...old.messages, {
                ...msg,
                parsed_files: Array.isArray(msg.parsed_files) ? msg.parsed_files : [],
                reactions: msg.reactions ?? [],
              }],
            };
          });
        }
        // New message in the open conversation — jump to the bottom like
        // WhatsApp does, instead of leaving the agent to scroll manually.
        setTimeout(() => {
          const el = messagesEndRef.current;
          if (el) el.scrollTop = el.scrollHeight;
        }, 50);

        // Conversation is already open when this arrives, so the normal
        // "mark seen on select" flow never re-fires for it — call it here too
        // so the WhatsApp blue tick still goes out for a message that lands
        // while the agent is already looking at the thread.
        if (msg?.direction !== 'OUTGOING') {
          apiRequest("POST", `/api/inbox/seen/${selectedConversation}`).catch(() => {});
        }
      }

      if (msg?.direction !== 'OUTGOING') {
        toast({ description: msg?.text || t("conversations_inbox.toasts.new_message_received") });
      }
    };

    // Delivery state delta for outgoing WhatsApp messages.
    //   { wa_message_id, wamid, status: 'sent'|'delivered'|'read'|'failed' }
    // Patches the cached messages list in-place so the tick mark updates without
    // a full refetch (4 round-trips per send otherwise: pending → sent → delivered → read).
    const handleMessageStatus = (data: {
      wa_message_id?: string;
      insta_message_id?: string;
      wamid?: string;
      status: MessageStatus;
    }) => {
      if (!selectedConversation) return;
      const rawId = data.wa_message_id ?? data.insta_message_id;
      const targetId = Number(rawId);
      if (!Number.isFinite(targetId)) return;

      const key = ["/api/inbox/messages", selectedConversation];
      queryClient.setQueryData<any>(key, (prev: any) => {
        if (!prev?.messages) return prev;
        let mutated = false;
        const next = prev.messages.map((m: BackendMessage) => {
          if (Number(m.id) === targetId && m.status !== data.status) {
            mutated = true;
            return { ...m, status: data.status };
          }
          return m;
        });
        return mutated ? { ...prev, messages: next } : prev;
      });
    };

    // Another agent / another tab opening a conversation marks it read on the
    // server, which then emits `inbox_read`. Refresh the list + counts so the
    // unread badge here also clears without a manual refresh.
    const handleInboxRead = (_data: { inbox_id: string }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/inbox/list"] });
      queryClient.invalidateQueries({ queryKey: ["/api/inbox/count"] });
    };

    const handleMessageReaction = (data: any) => {
      if (!selectedConversation || data.inbox_id !== selectedConversation.toString()) return;
      if (data.message_id) {
        queryClient.setQueryData(["/api/inbox/messages", selectedConversation], (old: any) => {
          if (!old?.messages) return old;
          return {
            ...old,
            messages: old.messages.map((m: any) => {
              if (String(m.id) !== String(data.message_id)) return m;
              const existing: any[] = Array.isArray(m.reactions) ? m.reactions : [];
              if (data.action === 'unreact' || !data.reaction) {
                return { ...m, reactions: existing.filter((r: any) => r.direction !== 'INCOMING') };
              }
              const withoutIncoming = existing.filter((r: any) => r.direction !== 'INCOMING');
              return { ...m, reactions: [...withoutIncoming, { reaction: data.reaction, direction: 'INCOMING' }] };
            }),
          };
        });
      } else {
        queryClient.invalidateQueries({ queryKey: ["/api/inbox/messages", selectedConversation] });
      }
    };

    // WhatsApp media ready — patch parsed_files onto the message without full refetch
    const handleMediaReady = (data: { inbox_id: string; wa_message_id: string; parsed_files: any[] }) => {
      if (!selectedConversation || data.inbox_id !== selectedConversation.toString()) return;
      const targetId = Number(data.wa_message_id);
      if (!Number.isFinite(targetId)) return;
      queryClient.setQueryData<any>(["/api/inbox/messages", selectedConversation], (prev: any) => {
        if (!prev?.messages) return prev;
        return {
          ...prev,
          messages: prev.messages.map((m: any) =>
            Number(m.id) === targetId ? { ...m, parsed_files: data.parsed_files } : m
          ),
        };
      });
    };

    socket.on("new_message", handleNewMessage);
    socket.on("message_status", handleMessageStatus);
    socket.on("inbox_read", handleInboxRead);
    socket.on("message_reaction", handleMessageReaction);
    socket.on("message_media_ready", handleMediaReady);
    return () => {
      socket.off("new_message", handleNewMessage);
      socket.off("message_status", handleMessageStatus);
      socket.off("inbox_read", handleInboxRead);
      socket.off("message_reaction", handleMessageReaction);
      socket.off("message_media_ready", handleMediaReady);
    };
  }, [socket, selectedConversation, queryClient, toast]);

  // Phase 2/3 filter state — must declare BEFORE the inbox list query that
  // reads them, otherwise React's TDZ throws "Cannot access X before
  // initialization" on first render.
  const [selectedChannels, setSelectedChannels] = useState<string[]>([]);
  const [activeFolderId, setActiveFolderId] = useState<string | null>(null);

  // WhatsApp numbers for the per-number channel filter (multi-number ISOLATION).
  // Selecting a specific number scopes the inbox to that number's chats only,
  // so a workspace with 2+ numbers can view one number in isolation.
  const { data: waAccountsForFilter } = useQuery<any>({
    queryKey: ["/api/whatsapp/accounts", "filter-numbers"],
    queryFn: async () => {
      // `onboard_platform=all` — the endpoint defaults to Business API only
      // (replyagent parity). The inbox pools Coexistence and Business API
      // numbers exactly as replyagent's getChannels() does, so it must opt out
      // of that default or Coex numbers would vanish from the channel filter.
      const res = await apiRequest("GET", "/api/whatsapp/accounts?with=phoneNumbers&onboard_platform=all");
      return res.json();
    },
    staleTime: 60_000,
  });
  const waFilterNumbers = useMemo(() => {
    const accounts = waAccountsForFilter?.wa ?? waAccountsForFilter?.accounts ?? waAccountsForFilter ?? [];
    const list: Array<{ id: string; label: string }> = [];
    if (Array.isArray(accounts)) {
      for (const acc of accounts) {
        const numbers = acc?.phone_numbers ?? acc?.phoneNumbers ?? [];
        for (const n of numbers) {
          if (n?.id == null) continue;
          const label = n.verified_name
            ? `${n.verified_name} (${n.display_phone_number ?? n.phone_number ?? ""})`
            : (n.display_phone_number ?? n.phone_number ?? t("conversations_inbox.search.number_fallback", { id: n.id }));
          list.push({ id: String(n.id), label });
        }
      }
    }
    return list;
  }, [waAccountsForFilter]);

  // Split the unified channel selection into channel-type ids and WhatsApp
  // number ids (per-number chips are stored as "wa_num:<id>" in selectedChannels).
  const channelTypesParam = useMemo(
    () => selectedChannels.filter((s) => !s.startsWith("wa_num:")),
    [selectedChannels],
  );
  const waNumberIdsParam = useMemo(
    () => selectedChannels.filter((s) => s.startsWith("wa_num:")).map((s) => s.slice("wa_num:".length)),
    [selectedChannels],
  );
  // Header "Agents" dropdown (replyagent UserFilter). Declared here — before the
  // list/count queries that read it — to avoid the same TDZ trap as above.
  const [selectedFilterAgents, setSelectedFilterAgents] = useState<string[]>([]);
  // Sort menu (replyagent sort_list). Declared early — the list query reads it.
  const SORT_OPTIONS = [
    { column: "last_updated", order: "desc", text: `${t("conversations_inbox.sort.latest_message")} ↓` },
    { column: "last_updated", order: "asc", text: `${t("conversations_inbox.sort.latest_message")} ↑` },
    { column: "queued_at", order: "asc", text: t("conversations_inbox.sort.queue_order") },
  ] as const;
  const [sortBy, setSortBy] = useState<{ column: string; order: string; text: string }>({
    ...SORT_OPTIONS[0],
  });
  // Search-box type selector (replyagent listItems). Default = broad name match
  // so the plain box keeps working. The list query sends `search_type`.
  const SEARCH_TYPES = [
    { slug: "full_name", name: t("conversations_inbox.search.types.full_name") },
    { slug: "first_name", name: t("conversations_inbox.search.types.first_name") },
    { slug: "last_name", name: t("conversations_inbox.search.types.last_name") },
    { slug: "phone", name: t("conversations_inbox.search.types.phone") },
    { slug: "email", name: t("conversations_inbox.search.types.email") },
    { slug: "whatsapp", name: t("conversations_inbox.search.types.whatsapp_number") },
    { slug: "instagram", name: t("conversations_inbox.search.types.instagram_handle") },
    { slug: "telegram", name: t("conversations_inbox.search.types.telegram_handle") },
    { slug: "messenger", name: t("conversations_inbox.search.types.messenger_handle") },
    { slug: "support-ticket", name: t("conversations_inbox.search.types.support_ticket") },
    { slug: "id", name: t("conversations_inbox.search.types.contact_id") },
  ] as const;
  const [searchType, setSearchType] = useState<string>("full_name");
  const searchMinChars = searchType === "whatsapp" ? 4 : 3;
  // Pagination — grows by a page each "Load more" (replyagent next_page). Reset
  // to one page whenever the visible set changes.
  const [listLimit, setListLimit] = useState(20);
  // Advanced filter rows (filter-popover). Declared early — the list query sends
  // them as `advanced_filters` so filtering runs server-side over the full set.
  const [filters, setFilters] = useState<Filter[]>([]);
  // Only complete rows are sent (value present unless an empty/not-empty op).
  const appliedFilters = useMemo(
    () =>
      filters
        .filter((f) => ["is empty", "is not empty"].includes(f.operator) || (f.value ?? "").trim() !== "")
        .map((f) => ({ column: f.column, operator: f.operator, value: f.value })),
    [filters],
  );

  // Global tab counts — must come from a SEPARATE call (`/inbox/count`) so
  // they stay correct regardless of which tab is active. Otherwise the counts
  // shown on Read / Unread / Queue / etc. all "go to zero" the moment you
  // switch to that tab because they were computed from the page's filtered
  // result set instead of the workspace-wide totals.
  const { data: countsResponse } = useQuery<any>({
    queryKey: ["/api/inbox/count", { activeFolderId, selectedChannels, selectedFilterAgents }],
    queryFn: async () => {
      const res = await apiRequest("POST", "/api/inbox/count", {
        folder_id: activeFolderId ? activeFolderId : undefined,
        channel_types: channelTypesParam.length ? channelTypesParam : undefined,
        wa_number_ids: waNumberIdsParam.length ? waNumberIdsParam : undefined,
        users: selectedFilterAgents.length ? selectedFilterAgents : undefined,
      });
      return res.json();
    },
    refetchInterval: 30_000,
  });
  const tabCounts = useMemo(() => {
    const c = countsResponse?.counts ?? {};
    const inboxTotal = (c.inbox ?? 0) + (c.unassigned ?? 0);
    return {
      all: inboxTotal,
      read: c.read ?? 0,
      unread: c.unread ?? 0,
      queue: c.unassigned ?? 0,
      upcoming: c.future ?? 0,
      completed: c.completed ?? 0,
    };
  }, [countsResponse]);

  // Per-folder chat counts (replyagent folder badge). Keyed by folder id.
  const folderCountMap = useMemo(() => {
    const m: Record<string, number> = {};
    for (const fc of (countsResponse?.folder_counts ?? [])) {
      m[String(fc.folder_id)] = fc.chat_count ?? 0;
    }
    return m;
  }, [countsResponse]);

  // Fetch inbox list. The backend list endpoint accepts the lowercase tab
  // names and maps them internally to the schema enum (ACTIVE / COMPLETED /
  // UNASSIGNED). "my_chats" is purely client-side filtering (we ask the
  // backend for "all" and then filter to assignedAgent === me).
  const { data: inboxResponse, isLoading: isLoadingInbox } = useQuery({
    queryKey: ["/api/inbox/list", { activeTab, searchQuery, searchType, activeFolderId, selectedChannels, selectedFilterAgents, sortBy, listLimit, appliedFilters }],
    queryFn: async () => {
      // Map the replyagent tab vocab onto the backend filter params.
      // - Read / Unread → `is_read` (1 / 0)
      // - Queue          → status = 'queued' (UNASSIGNED)
      // - Upcoming       → `is_upcoming: true` (snooze > NOW)
      // - Done           → status = 'completed' (COMPLETED)
      let status: string | undefined;
      let is_read: number | undefined;
      let is_upcoming: boolean | undefined;
      if (activeTab === "queue") status = "queued";
      else if (activeTab === "completed") status = "completed";
      else if (activeTab === "read") is_read = 1;
      else if (activeTab === "unread") is_read = 0;
      else if (activeTab === "upcoming") is_upcoming = true;
      // 'all' → no status / is_read / is_upcoming filter

      const res = await apiRequest("POST", "/api/inbox/list", {
        status,
        is_read,
        is_upcoming,
        // Only send the term once it clears the min-char threshold (replyagent:
        // WhatsApp=4, others=3) so single keystrokes don't fire wide queries.
        search: searchQuery.trim().length >= searchMinChars ? searchQuery : "",
        search_type: searchType,
        folder_id: activeFolderId ? activeFolderId : undefined,
        channel_types: channelTypesParam.length ? channelTypesParam : undefined,
        wa_number_ids: waNumberIdsParam.length ? waNumberIdsParam : undefined,
        users: selectedFilterAgents.length ? selectedFilterAgents : undefined,
        sort: { column: sortBy.column, order: sortBy.order },
        limit: listLimit,
        advanced_filters: appliedFilters.length ? appliedFilters : undefined,
      });
      return res.json();
    },
  });

  const backendConversations = inboxResponse?.inbox || [];

  // Detect channel from the polymorphic `modelable_type`. Replyagent supports
  // 6+ channel types; the previous version of this mapper only handled
  // WhatsApp + Facebook + (anything-else → Instagram), so Telegram, Z-API,
  // SMS (Twilio), and Webchat conversations were mis-labelled in the list.
  const detectChannel = (modelableType?: string): string => {
    const t = (modelableType || '').toLowerCase();
    if (t.includes('whatsapp')) return 'whatsapp';
    if (t.includes('zapi')) return 'zapi';
    if (t.includes('telegram')) return 'telegram';
    if (t.includes('insta')) return 'instagram';
    if (t.includes('messenger') || t.includes('fb') || t.includes('facebook')) return 'messenger';
    if (t.includes('twilio') || t.includes('sms')) return 'sms';
    if (t.includes('webchat') || t.includes('wc')) return 'webchat';
    return 'unknown';
  };

  // Map backend status enum (UPPERCASE in schema) to the lowercase vocab the
  // tabs/filters/badges use throughout this page. UNASSIGNED is rendered as
  // the "queue" bucket — replyagent uses the same wording.
  const mapStatus = (raw?: string): string => {
    const s = String(raw ?? '').toUpperCase();
    if (s === 'COMPLETED') return 'completed';
    if (s === 'UNASSIGNED') return 'queue';
    if (s === 'ACTIVE') return 'active';
    if (s === 'DELETED') return 'deleted';
    return s.toLowerCase() || 'active';
  };

  // Map backend conversations to frontend format
  const conversations: Conversation[] = backendConversations.map((item: BackendConversation) => {
    const rawName = item.contacts?.full_name || item.contacts?.first_name || '';
    // If the stored name is a numeric Instagram user ID (profile fetch failed), show a friendlier label
    const resolvedName = rawName && /^\d+$/.test(rawName) ? 'Instagram User' : rawName;
    return {
      id: Number(item.id),
      name: resolvedName || 'Unknown',
      displayName: resolvedName,
      phoneNumber: item.contacts?.mobile_number || '',
      email: item.contacts?.email || '',
      firstName: item.contacts?.first_name || '',
      lastName: item.contacts?.last_name || '',
      lastMessage: item.last_message_text || '',
      time: item.updated_at || new Date().toISOString(),
      unread: item.unread_count || 0,
      status: mapStatus(item.status),
      assignedAgent: item.users?.id?.toString() || null,
      assignedAgentName: item.users
        ? (item.users.full_name || `${item.users.first_name || ''} ${item.users.last_name || ''}`.trim() || item.users.name || null)
        : null,
      channel: detectChannel(item.modelable_type),
      isAssigned: !!item.is_assigned,
      folderId: item.folder_id != null ? String(item.folder_id) : null,
      // WhatsApp per-row badge data (M19) — which number the chat belongs to + opt-in.
      channelNumber: item.phoneNumber ?? null,
      hasOptedIn: !!item.has_opted_in,
    };
  });

  // Deep-link from the Contact profile "Live Chat" link: ?contact_id=X →
  // auto-select that contact's conversation, then strip the param so a refresh
  // or back-nav doesn't re-trigger it.
  const deepLinkedRef = useRef(false);
  useEffect(() => {
    if (deepLinkedRef.current) return;
    let cid: string | null = null;
    try { cid = new URLSearchParams(window.location.search).get("contact_id"); } catch {}
    if (!cid) return;
    const match = backendConversations.find(
      (it: any) => String(it.contacts?.id) === String(cid),
    );
    if (match) {
      setSelectedConversation(Number(match.id));
      deepLinkedRef.current = true;
      try { window.history.replaceState({}, "", window.location.pathname); } catch {}
    }
  }, [backendConversations]);

  const [showContactPanel, setShowContactPanel] = useState(false);
  const [agentStatus, setAgentStatus] = useState<"available" | "away">("available");
  const [sidebarWidth, setSidebarWidth] = useState(384);
  const [isDragging, setIsDragging] = useState(false);
  // Composer box height — drag the handle at the top of the reply/note box
  // to make it taller/shorter. null = default (min/max-height classes drive it).
  const [composerHeight, setComposerHeight] = useState<number | null>(null);
  const [isResizingComposer, setIsResizingComposer] = useState(false);
  const composerResizeStartRef = useRef<{ y: number; height: number } | null>(null);
  const [assignedAgent, setAssignedAgent] = useState<string | null>(null);
  const [selectedAgents, setSelectedAgents] = useState<string[]>([]);
  const [isSearchFocused, setIsSearchFocused] = useState(false);

  // ─── Bulk select + actions (replyagent select-all + actions menu) ───
  // IDs of conversations ticked in the list. Drives the select-all checkbox,
  // the "N selected" toolbar, and the bulk actions menu.
  const [selectedInboxIds, setSelectedInboxIds] = useState<number[]>([]);
  const [bulkSnoozeOpen, setBulkSnoozeOpen] = useState(false);
  const [bulkSnoozeUntil, setBulkSnoozeUntil] = useState("");
  const [bulkAssignOpen, setBulkAssignOpen] = useState(false);
  const [bulkAssignAgent, setBulkAssignAgent] = useState<string>("");

  // Filter State (`filters` is declared earlier with the query-driving state.)
  const [showFilter, setShowFilter] = useState(false);
  const [draggedFilterId, setDraggedFilterId] = useState<string | null>(null);
  const [openFilterColumnDropdown, setOpenFilterColumnDropdown] = useState<string | null>(null);
  const [openFilterOperatorDropdown, setOpenFilterOperatorDropdown] = useState<string | null>(null);
  const filterDropdownRef = useRef<HTMLDivElement>(null);

  // (selectedFilterAgents is declared above with the other query-driving filter
  // state. The header "Channels" dropdown binds directly to `selectedChannels`,
  // so there's no separate selectedFilterChannels state anymore.)

  // Full channel set (replyagent supports all of these). The header Channels
  // dropdown drives `selectedChannels`, which is wired into the list/count API.
  const channelImg = (src: string, alt: string) =>
    React.createElement("img", { src, alt, className: "w-3.5 h-3.5" });
  const channelOptions = useMemo(() => {
    const base = [
      { id: "whatsapp", name: "WhatsApp", icon: channelImg("/images/automations/whatsapp.svg", "WhatsApp") },
      { id: "instagram", name: "Instagram", icon: channelImg("/images/automations/instagram.svg", "Instagram") },
      { id: "messenger", name: "Messenger", icon: channelImg("/images/automations/messenger.svg", "Messenger") },
      { id: "telegram", name: "Telegram", icon: channelImg("/images/automations/telegram.svg", "Telegram") },
      { id: "sms", name: "SMS", icon: channelImg("/images/automations/sms.svg", "SMS") },
      { id: "zapi", name: "Z-API", icon: channelImg("/images/automations/whatsapp.svg", "Z-API") },
      { id: "webchat", name: "Webchat", icon: React.createElement(Mail, { size: 14 }) },
    ];
    // Per-number WhatsApp filter chips (multi-number isolation). Only shown when
    // more than one number exists — with a single number there is nothing to
    // isolate and the plain "WhatsApp" chip already covers it.
    if (waFilterNumbers.length > 1) {
      for (const n of waFilterNumbers) {
        base.push({
          id: `wa_num:${n.id}`,
          name: `WhatsApp · ${n.label}`,
          icon: channelImg("/images/automations/whatsapp.svg", "WhatsApp number"),
        });
      }
    }
    return base;
  }, [waFilterNumbers]);

  // Fetch messages for selected conversation
  const { data: messagesResponse, isLoading: isLoadingMessages } = useQuery({
    // NB: chatMode is intentionally NOT in the queryKey — the socket handlers and
    // optimistic mutations patch this cache via the 2-element key, so changing the
    // key per mode would silently break live updates. Mode switches force a
    // refetch through an explicit invalidate effect below instead.
    queryKey: ["/api/inbox/messages", selectedConversation],
    queryFn: async () => {
      if (!selectedConversation) return null;
      try {
        const res = await apiRequest("POST", `/api/inbox/messages/${selectedConversation}`, { communication_mode: chatMode, old_data: chatMode === "OLD_DATA" }, { silentStatuses: [404] });
        return res.json();
      } catch (e: any) {
        // The selected conversation was deleted (e.g. its contact was deleted).
        // Clear the stale selection so we fall back to the empty state instead of
        // looping a scary "Inbox not found" error every refetch.
        const msg = String(e?.message ?? "");
        if (/not found/i.test(msg) || /\b404\b/.test(msg)) {
          setSelectedConversation(null);
          try { sessionStorage.removeItem("inbox_selected_conv"); } catch {}
          return null;
        }
        throw e;
      }
    },
    enabled: !!selectedConversation,
    staleTime: 0,
    refetchInterval: 3000,
  });

  // Flag to scroll only on conversation switch / initial load, not on every 5s refetch
  useEffect(() => {
    shouldScrollToBottomRef.current = true;
    setIsChatVisible(false);
    setChatMode("ALL"); // reset thread mode-filter on conversation switch

    // Opening this conversation means the agent has seen its messages —
    // clear any unread bell notifications tied to it so the badge count
    // doesn't keep including messages already visible in the thread.
    if (selectedConversation) {
      apiRequest("POST", `/api/notifications/read-by-inbox/${selectedConversation}`)
        .then(() => queryClient.invalidateQueries({ queryKey: ["/api/notifications"] }))
        .catch(() => {});
    }
  }, [selectedConversation]);

  // Mode-filter changes the same cache entry (key stays 2-element), so force a
  // refetch when the agent switches modes. staleTime:0 means the new mode's
  // payload is sent on the refetch.
  useEffect(() => {
    if (selectedConversation) {
      queryClient.invalidateQueries({ queryKey: ["/api/inbox/messages", selectedConversation] });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatMode]);

  useEffect(() => {
    const convLoaded = conversations.some((c: any) => c.id === selectedConversation);
    if (!shouldScrollToBottomRef.current || !messagesResponse || !convLoaded) return;
    const timer = setTimeout(() => {
      shouldScrollToBottomRef.current = false;
      const el = messagesEndRef.current;
      if (el) el.scrollTop = el.scrollHeight;
      setIsChatVisible(true);
    }, 100);
    return () => clearTimeout(timer);
  }, [messagesResponse, conversations, selectedConversation]);

  const normalizeStatus = (s?: string): MessageStatus | undefined => {
    if (!s) return undefined;
    const k = s.toLowerCase();
    if (k === 'pending' || k === 'sent' || k === 'delivered' || k === 'read' || k === 'failed') {
      return k;
    }
    return undefined;
  };

  // Wrapped in useMemo so this only recomputes when the fetched data actually
  // changes — without it, every render (composer keystrokes, the 3s message
  // poll ticking, socket events) rebuilt brand-new message/audio objects,
  // which was the likely cause of voice-note playback stopping mid-way: any
  // re-render landing during playback recreated the audio element's props.
  const messages: Message[] = useMemo(() => (messagesResponse?.messages || []).map((m: BackendMessage, index: number) => {
    const raw = m as any;

    // System messages (replyagent note_action pills) — rendered as centered
    // dividers, not bubbles. Negative synthetic id keeps Message.id numeric.
    if (raw.kind === 'system') {
      return {
        id: -(index + 1),
        from: 'user',
        kind: 'system',
        tone: raw.tone,
        text: raw.text || '',
        time: raw.created_at || new Date().toISOString(),
      } as Message;
    }

    // Separate image / video / audio / other uploads from parsed_files.
    // `thumb` (from the media_gallery row) drives image previews + video posters.
    const parsedFiles: Array<{ url: string; name: string; size: number; mime: string; thumb?: string | null }> = raw.parsed_files || [];
    const imageFiles = parsedFiles.filter((f) => f.mime?.startsWith('image/'));
    const videoFiles = parsedFiles.filter((f) => f.mime?.startsWith('video/'));
    const audioFiles = parsedFiles.filter((f) =>
      f.mime?.startsWith('audio/') || f.name?.toLowerCase().startsWith('voice-message')
    );
    const otherFiles = parsedFiles.filter((f) =>
      !f.mime?.startsWith('image/') &&
      !f.mime?.startsWith('video/') &&
      !f.mime?.startsWith('audio/') &&
      !f.name?.toLowerCase().startsWith('voice-message')
    );

    let rawText = (m.text ?? m.message_text ?? '').toString().trim();
    const msgType = ((m as any).type ?? '').toLowerCase();

    // Interactive replies (button/list) are stored as the raw interactive JSON
    // in `text` — extract the human-readable title the customer picked instead
    // of dumping the JSON into the bubble.
    if (msgType === 'interactive' && rawText.startsWith('{')) {
      try {
        const inter = JSON.parse(rawText);
        rawText = inter?.button_reply?.title ?? inter?.list_reply?.title
          ?? inter?.list_reply?.description ?? inter?.nfm_reply?.name ?? '';
      } catch { rawText = ''; }
    }

    // Location → parsed from `media` (EZCONN stores it there, not `data`).
    let location: Message['location'] = null;
    if (msgType === 'location') {
      try { location = JSON.parse((m as any).media ?? (m as any).data ?? '{}'); } catch {}
    }
    // Contacts (vCard) → array under `data`.
    let vcards: any[] | null = null;
    if (msgType === 'contacts') {
      try {
        const parsed = JSON.parse((m as any).data ?? (m as any).text ?? '[]');
        vcards = Array.isArray(parsed) ? parsed : null;
      } catch {}
    }

    // Persisted reply quote — backend resolves `reply_to` into a compact preview
    // of the quoted message. Derive a human label the same way the main bubble does.
    let reply: Message['reply'] = null;
    if (raw.reply) {
      const rp = raw.reply;
      const rpType = (rp.type ?? '').toLowerCase();
      let rpText = (rp.text ?? '').toString().trim();
      if (!rpText) {
        const pf = Array.isArray(rp.parsed_files) ? rp.parsed_files : [];
        const isImg = pf.some((f: any) => f.mime?.startsWith('image/')) || rpType === 'image';
        const isAud = pf.some((f: any) => f.mime?.startsWith('audio/') || f.name?.toLowerCase().startsWith('voice-message')) || rpType === 'audio' || rpType === 'voice';
        rpText = isAud ? '🎤 Voice message'
          : isImg ? '🖼 Image'
          : rpType === 'video' ? '🎥 Video'
          : rpType === 'document' ? '📄 Document'
          : rpType === 'sticker' ? '🌟 Sticker'
          : '(media)';
      }
      reply = { id: Number(rp.id), from: rp.direction === 'OUTGOING' ? 'agent' : 'user', text: rpText };
    }

    const hasMediaContent = imageFiles.length > 0 || videoFiles.length > 0 || audioFiles.length > 0 || otherFiles.length > 0;
    const displayText = rawText ? rawText : (!hasMediaContent ? (
      msgType === 'audio' || msgType === 'voice' ? '🎤 Voice message' :
      msgType === 'image' ? '🖼 Image' :
      msgType === 'video' ? '🎥 Video' :
      msgType === 'document' ? '📄 Document' :
      msgType === 'sticker' ? '🌟 Sticker' :
      msgType === 'call' ? '📞 Missed call' :
      ''
    ) : '');

    return {
      id: m.id,
      from: m.direction === 'OUTGOING' ? 'agent' : 'user',
      text: raw.template ? '' : displayText,
      time: m.created_at || new Date().toISOString(),
      status: normalizeStatus(m.status),
      images: imageFiles.length > 0 ? imageFiles : undefined,
      video: videoFiles.length > 0 ? { url: videoFiles[0].url, name: videoFiles[0].name, size: videoFiles[0].size, thumbnail: videoFiles[0].thumb ?? undefined } : undefined,
      attachments: otherFiles.length > 0 ? otherFiles : undefined,
      audio: audioFiles.length > 0 ? { url: audioFiles[0].url, name: audioFiles[0].name, size: audioFiles[0].size } : undefined,
      reactions: Array.isArray(raw.reactions) ? raw.reactions : [],
      communicationMode: raw.communication_mode,
      senderName: raw.sender_name ?? null,
      errorData: raw.error_data ?? raw.error_code ?? null,
      template: raw.template ?? null,
      location: location && (location.latitude || location.longitude) ? location : null,
      vcards: vcards && vcards.length ? vcards : null,
      reply,
    };
  }), [messagesResponse]);

  // Send message mutation
  // Mark a conversation read on the backend (mirrors replyagent's
  // `POST /inbox/seen/{inbox_id}`). Fires when the agent opens the thread so
  // the unread badge clears immediately and other tabs of the same workspace
  // see the change via the `inbox_read` socket event.
  const markSeenMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("POST", `/api/inbox/seen/${id}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/inbox/list"] });
    },
  });

  // ─── Phase 2 dialog state + mutations ─────────────────────────────

  const [snoozeDialogOpen, setSnoozeDialogOpen] = useState(false);
  const [snoozeUntil, setSnoozeUntil] = useState("");

  const [reminderDialogOpen, setReminderDialogOpen] = useState(false);
  const [reminderAt, setReminderAt] = useState("");
  const [reminderText, setReminderText] = useState("");

  // Reply / Note tab toggle for the compose area (replyagent has a Note tab
  // for internal annotations that aren't sent to the customer).
  const [composeMode, setComposeMode] = useState<"reply" | "note">("reply");
  // Agent @mentions collected in a Note (replyagent). Sent with the note so the
  // backend can notify the mentioned agents.
  const [mentions, setMentions] = useState<string[]>([]);
  // Composer "+" menu dialogs (replyagent: media gallery + start automation).
  const [galleryDialogOpen, setGalleryDialogOpen] = useState(false);
  const [automationDialogOpen, setAutomationDialogOpen] = useState(false);
  const [stickerDialogOpen, setStickerDialogOpen] = useState(false);
  // Location composer (replyagent type:'location' send).
  const [locationDialogOpen, setLocationDialogOpen] = useState(false);
  const [locLat, setLocLat] = useState("");
  const [locLng, setLocLng] = useState("");
  const [locName, setLocName] = useState("");
  const [locAddress, setLocAddress] = useState("");
  const [locGeoLoading, setLocGeoLoading] = useState(false);

  // AI transform popover state. Selects translate/correct/expand/shorten.
  const [aiTransformOpen, setAiTransformOpen] = useState(false);

  // Which message's reaction picker is open. Only one at a time so the picker
  // doesn't double-render (and so clicking another bubble closes the previous
  // one). null = no picker shown.
  const [reactionPickerFor, setReactionPickerFor] = useState<number | null>(null);

  // "Reply to specific message" state. Replyagent shows a small reply arrow
  // next to each bubble on hover — clicking captures the message and shows a
  // mini reply-to preview above the compose input.
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);

  // (selectedChannels + activeFolderId are declared earlier — before the
  // inbox list query that consumes them.)

  // Template-send dialog (24h-window CTA opens this) + channels chip dropdown
  // + folders CRUD modals state.
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
  const [channelsDropdownOpen, setChannelsDropdownOpen] = useState(false);
  const [folderModalOpen, setFolderModalOpen] = useState(false);
  const [folderEditing, setFolderEditing] = useState<any | null>(null);
  const [folderName, setFolderName] = useState("");

  // Approved WhatsApp templates for the template dialog.
  const { data: waTemplatesResponse } = useQuery<any>({
    queryKey: ["/api/broadcasts/templates", "inbox-template-send"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/broadcasts/templates");
      return res.json();
    },
    enabled: templateDialogOpen,
  });
  const waTemplates: any[] = waTemplatesResponse?.templates ?? [];
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");

  const sendTemplateMutation = useMutation({
    mutationFn: async (templateId: string) => {
      const res = await apiRequest("POST", `/api/inbox/send-message/${selectedConversation}`, {
        wa_template_id: templateId,
        type: "template",
      });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: t("conversations_inbox.toasts.template_sent_title"), description: t("conversations_inbox.toasts.template_sent_desc") });
      setTemplateDialogOpen(false);
      setSelectedTemplateId("");
      queryClient.invalidateQueries({ queryKey: ["/api/inbox/messages", selectedConversation] });
    },
    onError: (err: Error) => {
      toast({ title: t("conversations_inbox.toasts.send_failed"), description: err.message, variant: "destructive" });
    },
  });

  const folderCreateMutation = useMutation({
    mutationFn: async (name: string) => {
      const res = await apiRequest("POST", "/api/inbox/folders", { name });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: t("conversations_inbox.toasts.folder_created") });
      setFolderModalOpen(false);
      setFolderName("");
      queryClient.invalidateQueries({ queryKey: ["/api/inbox/folders"] });
    },
  });

  const folderUpdateMutation = useMutation({
    mutationFn: async (vars: { id: string; name: string }) => {
      const res = await apiRequest("PATCH", `/api/inbox/folders/${vars.id}`, { name: vars.name });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: t("conversations_inbox.toasts.folder_renamed") });
      setFolderModalOpen(false);
      setFolderEditing(null);
      setFolderName("");
      queryClient.invalidateQueries({ queryKey: ["/api/inbox/folders"] });
    },
  });

  const folderDeleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("DELETE", `/api/inbox/folders/${id}`);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: t("conversations_inbox.toasts.folder_deleted") });
      if (activeFolderId === folderEditing?.id?.toString()) setActiveFolderId(null);
      queryClient.invalidateQueries({ queryKey: ["/api/inbox/folders"] });
    },
  });

  const snoozeMutation = useMutation({
    mutationFn: async ({ id, until }: { id: number; until: string }) => {
      const res = await apiRequest("PATCH", `/api/inbox/snooze/${id}`, { until });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: t("conversations_inbox.toasts.snoozed_title"), description: t("conversations_inbox.toasts.snoozed_desc") });
      setSnoozeDialogOpen(false);
      setSnoozeUntil("");
      queryClient.invalidateQueries({ queryKey: ["/api/inbox/list"] });
      queryClient.invalidateQueries({ queryKey: ["/api/inbox/count"] });
    },
  });

  const reminderMutation = useMutation({
    mutationFn: async (vars: { inbox_id: number; schedule_at: string; text_message: string }) => {
      const res = await apiRequest("POST", "/api/inbox/reminder", vars);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: t("conversations_inbox.toasts.reminder_scheduled_title"), description: t("conversations_inbox.toasts.reminder_scheduled_desc") });
      setReminderDialogOpen(false);
      setReminderAt("");
      setReminderText("");
      if (selectedConversation) {
        queryClient.invalidateQueries({ queryKey: ["/api/inbox/messages", selectedConversation] });
      }
    },
    onError: (err: Error) => {
      toast({ title: t("conversations_inbox.toasts.couldnt_schedule"), description: err.message, variant: "destructive" });
    },
  });

  const deleteInboxMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("POST", `/api/inbox/delete/${id}`);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: t("conversations_inbox.toasts.deleted_title"), description: t("conversations_inbox.toasts.deleted_conversation_desc") });
      setSelectedConversation(null);
      queryClient.invalidateQueries({ queryKey: ["/api/inbox/list"] });
      queryClient.invalidateQueries({ queryKey: ["/api/inbox/count"] });
    },
  });

  // Automations for the composer "+" → Start automation (replyagent).
  const { data: automationsData } = useQuery<any>({
    queryKey: ["/api/automations", "inbox-composer"],
    queryFn: async () => (await apiRequest("GET", "/api/automations")).json(),
    enabled: automationDialogOpen,
  });
  const composerAutomations = useMemo(() => {
    const rows: any[] = automationsData?.automations ?? [];
    return rows.map((a) => ({ id: String(a.id), name: a.name ?? t("conversations_inbox.composer.untitled"), status: a.status }));
  }, [automationsData]);

  const automateMutation = useMutation({
    mutationFn: async (automationId: string) => {
      const res = await apiRequest("POST", "/api/inbox/automate", {
        inbox_id: selectedConversation,
        automation_id: automationId,
      });
      return res.json();
    },
    onSuccess: () => {
      setAutomationDialogOpen(false);
      toast({ title: t("conversations_inbox.toasts.automation_dispatched") });
      if (selectedConversation) {
        queryClient.invalidateQueries({ queryKey: ["/api/inbox/messages", selectedConversation] });
      }
    },
    onError: (err: Error) => toast({ title: t("conversations_inbox.toasts.couldnt_run_automation"), description: err.message, variant: "destructive" }),
  });

  // Media gallery for the composer "+" → Media gallery (replyagent Gallery).
  const { data: galleryListingData } = useQuery<any>({
    queryKey: ["/api/gallery/listings", "inbox-composer"],
    queryFn: async () => (await apiRequest("GET", "/api/gallery/listings?limit=60")).json(),
    enabled: galleryDialogOpen || stickerDialogOpen,
  });
  const galleryFiles = useMemo(() => {
    const data: any[] = galleryListingData?.file_folders?.data ?? [];
    return data.map((f) => ({
      id: String(f.id),
      file_url: f.file_url,
      thumb: f.thumb_200 || f.file_url,
      name: f.object_name || t("conversations_inbox.dialogs.gallery.media_fallback"),
      media_type: f.media_type,
      mime_type: f.mime_type,
      extension: f.extension,
    }));
  }, [galleryListingData]);

  // Stickers are webp images in the gallery (replyagent is_sticker + webp).
  const stickerFiles = useMemo(
    () => galleryFiles.filter((f) => f.extension === "webp" || f.mime_type === "image/webp"),
    [galleryFiles],
  );

  // Send a picked sticker straight out (fetch webp → File → send as sticker).
  const sendSticker = async (f: any) => {
    if (!f?.file_url) return;
    try {
      const res = await fetch(f.file_url);
      const blob = await res.blob();
      const file = new File([blob], f.name || "sticker.webp", { type: "image/webp" });
      sendMessageMutation.mutate({ text: "", files: [file], is_sticker: true } as any);
      setStickerDialogOpen(false);
    } catch {
      toast({ title: t("conversations_inbox.toasts.couldnt_send_sticker"), variant: "destructive" });
    }
  };

  // Fill the location form from the browser's geolocation (best-effort).
  const useCurrentLocation = () => {
    if (!navigator.geolocation) {
      toast({ title: t("conversations_inbox.toasts.geolocation_not_supported"), variant: "destructive" });
      return;
    }
    setLocGeoLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocLat(String(pos.coords.latitude));
        setLocLng(String(pos.coords.longitude));
        setLocGeoLoading(false);
      },
      (err) => {
        setLocGeoLoading(false);
        toast({ title: t("conversations_inbox.toasts.couldnt_get_location"), description: err.message, variant: "destructive" });
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  // Send a WhatsApp location message (replyagent type:'location').
  const sendLocation = () => {
    const latitude = parseFloat(locLat);
    const longitude = parseFloat(locLng);
    if (Number.isNaN(latitude) || Number.isNaN(longitude)) {
      toast({ title: t("conversations_inbox.toasts.enter_valid_lat_lng"), variant: "destructive" });
      return;
    }
    sendMessageMutation.mutate({
      text: "",
      type: "location",
      location: {
        latitude,
        longitude,
        name: locName.trim() || undefined,
        address: locAddress.trim() || undefined,
      },
    } as any);
    setLocationDialogOpen(false);
    setLocLat(""); setLocLng(""); setLocName(""); setLocAddress("");
  };


  // Attaches a picked gallery item BY REFERENCE — no download here at all.
  // The file is already sitting on S3; downloading it into the browser just
  // to re-upload it on send was a redundant round trip through S3 twice,
  // which is what made this feel slow. The backend re-signs the same S3 key
  // when the message actually sends (see gallery_media_ids in sendMessage).
  const attachFromMediaGallerySection = (item: any) => {
    if (!item?.id || item.type === "folder") return;
    setAttachedGalleryItems((prev) => [...prev, {
      id: item.id,
      name: item.name || "gallery-media",
      size: typeof item.size === "string" ? parseFloat(item.size) * 1024 : Number(item.size ?? 0),
      mime: item.mime_type || "application/octet-stream",
      thumb: item.thumb ?? (item.media_type === "IMAGE" ? item.url : null),
    }]);
    setGalleryDialogOpen(false);
    toast({ description: t("conversations_inbox.toasts.media_attached") });
  };

  const transformAiMutation = useMutation({
    mutationFn: async (vars: { text: string; mode: string; language?: string }) => {
      const res = await apiRequest("POST", "/api/inbox/transform-ai", vars);
      return res.json();
    },
    onSuccess: (data: any) => {
      if (data?.output) setMessageText(data.output);
      setAiTransformOpen(false);
    },
  });

  const reactMutation = useMutation({
    mutationFn: async (vars: { inboxId: number; messageId: number; reaction: string; message_type?: string }) => {
      const res = await apiRequest(
        "POST",
        `/api/inbox/react/${vars.inboxId}/${vars.messageId}`,
        { reaction: vars.reaction, message_type: vars.message_type },
      );
      return res.json();
    },
    onMutate: async (vars) => {
      // Optimistic reaction — update cache immediately without waiting for server
      if (!selectedConversation) return;
      await queryClient.cancelQueries({ queryKey: ["/api/inbox/messages", selectedConversation] });
      const prev = queryClient.getQueryData(["/api/inbox/messages", selectedConversation]);
      queryClient.setQueryData(["/api/inbox/messages", selectedConversation], (old: any) => {
        if (!old?.messages) return old;
        return {
          ...old,
          messages: old.messages.map((m: any) => {
            if (Number(m.id) !== Number(vars.messageId)) return m;
            const existing: any[] = Array.isArray(m.reactions) ? m.reactions : [];
            const outgoing = existing.find((r: any) => r.direction === 'OUTGOING');
            // Toggle off if same emoji, otherwise replace
            const newReactions = outgoing?.reaction === vars.reaction
              ? existing.filter((r: any) => r.direction !== 'OUTGOING')
              : [...existing.filter((r: any) => r.direction !== 'OUTGOING'), { reaction: vars.reaction, direction: 'OUTGOING' }];
            return { ...m, reactions: newReactions };
          }),
        };
      });
      return { prev };
    },
    onError: (_err, _vars, context: any) => {
      if (context?.prev !== undefined && selectedConversation) {
        queryClient.setQueryData(["/api/inbox/messages", selectedConversation], context.prev);
      }
    },
  });

  // Delete a single sent message (replyagent ZapiMessages deleteMessage). Gated
  // in the UI by `canDeleteMessage`. Backend: POST /api/inbox/message/delete.
  const deleteMessageMutation = useMutation({
    mutationFn: async (vars: { messageId: number; channel: string }) => {
      const res = await apiRequest("POST", `/api/inbox/message/delete`, {
        message_id: vars.messageId,
        channel: vars.channel,
      });
      return res.json();
    },
    onSuccess: () => {
      if (selectedConversation) {
        queryClient.invalidateQueries({ queryKey: ["/api/inbox/messages", selectedConversation] });
      }
      toast({ title: t("conversations_inbox.toasts.message_deleted") });
    },
    onError: (err: any) =>
      toast({ title: t("conversations_inbox.toasts.couldnt_delete_message"), description: err?.message ?? "", variant: "destructive" }),
  });

  // ─── Folders sidebar (uses already-existing /folders endpoints) ───

  const { data: foldersResponse } = useQuery<any>({
    queryKey: ["/api/inbox/folders"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/inbox/folders");
      return res.json();
    },
  });
  const folders: any[] = useMemo(() => {
    if (Array.isArray(foldersResponse)) return foldersResponse;
    if (Array.isArray(foldersResponse?.folders)) return foldersResponse.folders;
    return [];
  }, [foldersResponse]);

  // ─── Real profile data (replaces hardcoded "Support Number 0123-123") ──

  const { data: profileData, refetch: refetchProfileData } = useQuery<any>({
    queryKey: ["/api/inbox/get-profile-data", selectedConversation],
    queryFn: async () => {
      if (!selectedConversation) return null;
      try {
        const res = await apiRequest("GET", `/api/inbox/get-profile-data/${selectedConversation}`, undefined, { silentStatuses: [404] });
        return res.json();
      } catch (e: any) {
        // Selected conversation deleted — swallow the not-found so it doesn't toast
        // (the messages query clears the stale selection).
        const msg = String(e?.message ?? "");
        if (/not found/i.test(msg) || /\b404\b/.test(msg)) return null;
        throw e;
      }
    },
    enabled: !!selectedConversation,
  });

  // Contact ID derived from profileData for notes / custom-field API calls
  const selectedContactId: number | null = profileData?.contact?.id ? Number(profileData.contact.id) : null;

  // Fetch notes for the selected contact
  const { data: notesResponse, refetch: refetchNotes } = useQuery<any>({
    queryKey: ["/api/notes", selectedContactId],
    queryFn: async () => {
      if (!selectedContactId) return null;
      const res = await apiRequest("GET", `/api/notes/${selectedContactId}`);
      return res.json();
    },
    enabled: !!selectedContactId,
  });

  // Sync real notes into per-conversation state
  useEffect(() => {
    if (!selectedConversation || !notesResponse) return;
    const texts = (notesResponse.notes || notesResponse || []).map((n: any) => n.text || n.content || "").filter(Boolean);
    setNotesByConv((prev) => ({ ...prev, [selectedConversation]: texts }));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notesResponse, selectedConversation]);

  // Sync real profileData (tags + custom_fields) into per-conversation state
  // whenever the profile query resolves for the selected conversation.
  useEffect(() => {
    if (!selectedConversation || !profileData) return;

    // Workspace-defined custom fields — store full objects (including null values)
    if (Array.isArray(profileData.custom_fields)) {
      setProfileFieldsByConv((prev) => ({ ...prev, [selectedConversation]: profileData.custom_fields }));
      // Also keep manual customAttributes for non-null values (chips)
      const attrs: Record<string, string> = {};
      for (const f of profileData.custom_fields) {
        if (f.label && f.value != null) attrs[f.label] = String(f.value);
      }
      setCustomAttributesByConv((prev) => ({ ...prev, [selectedConversation]: attrs }));
    }

    // Tags → array of tag IDs (CustomDropdown uses IDs for selection state)
    if (Array.isArray(profileData.tags)) {
      const tagIds = profileData.tags.map((t: any) => String(t.id)).filter(Boolean);
      setTagsByConv((prev) => ({ ...prev, [selectedConversation]: tagIds }));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileData, selectedConversation]);

  useEffect(() => {
    if (!selectedConversation) return;
    const conv = conversations.find((c) => c.id === selectedConversation);
    if (conv && conv.unread > 0) {
      markSeenMutation.mutate(selectedConversation);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedConversation]);

  // On page refresh, selectedConversation is restored from sessionStorage but
  // handleSelectConversation is never called, so assignedAgent stays null.
  // This effect re-syncs assignedAgent whenever conversations list loads/changes.
  useEffect(() => {
    if (!selectedConversation || assignedAgent !== null) return;
    const conv = conversations.find((c: Conversation) => c.id === selectedConversation);
    if (!conv) return;
    const agentId = conv.assignedAgent || null;
    setAssignedAgent(agentId && currentUser.id && agentId === currentUser.id ? "self" : agentId);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversations, selectedConversation]);

  // Auto-clear the right-pane selection when the currently selected
  // conversation is no longer in the visible list (e.g. tab/filter switch
  // moved it out, or it was deleted). Without this the thread keeps showing
  // the previous chat with a "Unknown" header because `selectedConversation`
  // doesn't map to anything in `conversations`. Wait until the new list has
  // actually loaded before clearing — otherwise the in-flight refetch
  // momentarily looks empty and we'd kick the user out of every chat on tab
  // change.
  useEffect(() => {
    if (isLoadingInbox) return;
    if (!selectedConversation) return;
    const rows: any[] = (inboxResponse?.inbox ?? []) as any[];
    const inList = rows.some((item) => Number(item.id) === selectedConversation);
    if (!inList) {
      setSelectedConversation(null);
    }
  }, [inboxResponse, isLoadingInbox, selectedConversation]);

  const sendMessageMutation = useMutation({
    mutationFn: async (input: string | { text: string; compose_mode?: string; reply_to_message_id?: number | null; files?: File[]; gallery_media_ids?: string[]; audio?: Blob | null; mentions?: string[]; is_sticker?: boolean; type?: string; location?: any; gif?: any }) => {
      const hasFiles = typeof input !== "string" && ((input.files && input.files.length > 0) || input.audio);

      if (hasFiles && typeof input !== "string") {
        // Use FormData for multipart uploads
        const form = new FormData();
        form.append("message_text", input.text || "");
        form.append("compose_mode", input.compose_mode ?? "reply");
        if (input.reply_to_message_id != null) form.append("reply_to_message_id", String(input.reply_to_message_id));
        if (input.mentions && input.mentions.length) form.append("mentions", input.mentions.join(","));
        if (input.is_sticker) form.append("is_sticker", "true");
        if (input.gallery_media_ids && input.gallery_media_ids.length) form.append("gallery_media_ids", JSON.stringify(input.gallery_media_ids));
        if (input.files) {
          for (const f of input.files) form.append("files", f);
        }
        if (input.audio) {
          form.append("files", new File([input.audio], "voice-message.webm", { type: "audio/webm" }));
          // Distinguishes a live mic recording from a regular audio-file
          // attachment — only this one should render as a WhatsApp voice
          // note (waveform bubble) instead of a generic audio-file player.
          form.append("is_voice_note", "true");
        }
        const res = await fetch(`/api/inbox/send-message/${selectedConversation}`, {
          method: "POST",
          headers: { Authorization: `Bearer ${localStorage.getItem("auth_token") || ""}` },
          body: form,
        });
        if (!res.ok) throw new Error(await res.text());
        return res.json();
      }

      const payload =
        typeof input === "string"
          ? { message_text: input }
          : {
              message_text: input.text,
              compose_mode: input.compose_mode ?? "reply",
              reply_to_message_id: input.reply_to_message_id ?? null,
              mentions: input.mentions && input.mentions.length ? input.mentions : undefined,
              // Location / GIF sends (replyagent type:'location' / type:'gif').
              ...(input.type ? { type: input.type } : {}),
              ...(input.location ? { location: JSON.stringify(input.location) } : {}),
              ...(input.gif ? { gif: JSON.stringify(input.gif) } : {}),
              ...(input.gallery_media_ids && input.gallery_media_ids.length ? { gallery_media_ids: JSON.stringify(input.gallery_media_ids) } : {}),
            };
      const res = await apiRequest("POST", `/api/inbox/send-message/${selectedConversation}`, payload);
      return res.json();
    },
    onMutate: async (input) => {
      // Cancel any in-flight refetch so it doesn't overwrite the optimistic message
      await queryClient.cancelQueries({ queryKey: ["/api/inbox/messages", selectedConversation] });
      const previousData = queryClient.getQueryData(["/api/inbox/messages", selectedConversation]);
      const text = typeof input === "string" ? input : (input.text || "");
      const hasFiles = typeof input !== "string" && ((input.files && input.files.length > 0) || input.audio || (input.gallery_media_ids && input.gallery_media_ids.length > 0));
      const tempId = `opt_${Date.now()}`;
      const optimisticMsg = {
        id: tempId,
        direction: "OUTGOING",
        text,
        message_text: text,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        status: "pending",
        type: hasFiles ? (input as any).audio ? "audio" : "image" : "text",
        reactions: [],
        parsed_files: [],
      };
      if (selectedConversation && previousData) {
        queryClient.setQueryData(["/api/inbox/messages", selectedConversation], (old: any) => ({
          ...old,
          messages: [...(old?.messages || []), optimisticMsg],
        }));
      }
      setMessageText("");
      setAttachedFiles([]);
      setRecordedAudio(null);
      return { previousData, tempId };
    },
    onSuccess: (data: any, input, context: any) => {
      const realMsg = data?.data;
      const hasFiles = typeof input !== "string" && ((input.files && input.files.length > 0) || input.audio);
      queryClient.setQueryData(["/api/inbox/messages", selectedConversation], (prev: any) => {
        if (!prev?.messages) return prev;
        // Remove optimistic placeholder (may already be gone if socket replaced it)
        const withoutOptimistic = prev.messages.filter((m: any) => m.id !== context?.tempId);
        if (realMsg) {
          // Socket may have already added the real message — skip if present
          const alreadyThere = withoutOptimistic.some((m: any) => String(m.id) === String(realMsg.id));
          if (!alreadyThere) {
            return { ...prev, messages: [...withoutOptimistic, { ...realMsg, parsed_files: realMsg.parsed_files ?? [], reactions: realMsg.reactions ?? [] }] };
          }
        }
        return { ...prev, messages: withoutOptimistic };
      });
      queryClient.invalidateQueries({ queryKey: ["/api/inbox/list"] });
    },
    onError: (err: Error, _input, context: any) => {
      if (context?.previousData !== undefined) {
        queryClient.setQueryData(["/api/inbox/messages", selectedConversation], context.previousData);
      }
      setMessageText(typeof _input === "string" ? _input : (_input as any).text || "");
      toast({ title: t("conversations_inbox.toasts.send_failed"), description: err.message, variant: "destructive" });
    },
  });

  // Update status mutation
  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number, status: string }) => {
      const res = await apiRequest("PATCH", `/api/inbox/status/${id}`, { status });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/inbox/list"] });
      queryClient.invalidateQueries({ queryKey: ["/api/inbox/count"] });
      toast({
        title: t("conversations_inbox.toasts.status_updated_title"),
        description: t("conversations_inbox.toasts.status_updated_desc"),
      });
    }
  });

  // Assign agent mutation
  const assignAgentMutation = useMutation({
    mutationFn: async ({ agentId }: { agentId: string | null }) => {
      const res = await apiRequest("PATCH", `/api/inbox/assign/${selectedConversation}`, {
        assigned_to: agentId === "null" || agentId === null ? null : (agentId === "self" ? "me" : agentId)
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/inbox/list"] });
      queryClient.invalidateQueries({ queryKey: ["/api/inbox/count"] });
      // Surface the new assigned/unassigned system pill in the thread at once.
      if (selectedConversation) {
        queryClient.invalidateQueries({ queryKey: ["/api/inbox/messages", selectedConversation] });
      }
      toast({
        title: t("conversations_inbox.toasts.agent_assigned_title"),
        description: t("conversations_inbox.toasts.agent_assigned_desc"),
      });
    }
  });

  // ─── Bulk action mutations (list select-all + actions menu) ───
  // All clear the selection + refresh list/counts on success so the toolbar
  // collapses and the badges re-sync.
  const bulkStatusMutation = useMutation({
    mutationFn: async (vars: { ids: number[]; action: string }) => {
      const res = await apiRequest("POST", "/api/inbox/update-status-bulk", {
        inbox_ids: vars.ids,
        action: vars.action,
      });
      return res.json();
    },
    onSuccess: (_d, vars) => {
      setSelectedInboxIds([]);
      queryClient.invalidateQueries({ queryKey: ["/api/inbox/list"] });
      queryClient.invalidateQueries({ queryKey: ["/api/inbox/count"] });
      toast({ title: t("conversations_inbox.toasts.done_title"), description: t("conversations_inbox.toasts.bulk_updated_desc", { count: vars.ids.length }) });
    },
    onError: (err: Error) => toast({ title: t("conversations_inbox.toasts.action_failed"), description: err.message, variant: "destructive" }),
  });

  const bulkSnoozeMutation = useMutation({
    mutationFn: async (vars: { ids: number[]; until: string }) => {
      const res = await apiRequest("POST", "/api/inbox/snooze-bulk", {
        inbox_ids: vars.ids,
        until: vars.until,
      });
      return res.json();
    },
    onSuccess: () => {
      setSelectedInboxIds([]);
      setBulkSnoozeOpen(false);
      setBulkSnoozeUntil("");
      queryClient.invalidateQueries({ queryKey: ["/api/inbox/list"] });
      queryClient.invalidateQueries({ queryKey: ["/api/inbox/count"] });
      toast({ title: t("conversations_inbox.toasts.snoozed_title") });
    },
    onError: (err: Error) => toast({ title: t("conversations_inbox.toasts.snooze_failed"), description: err.message, variant: "destructive" }),
  });

  const bulkAssignMutation = useMutation({
    mutationFn: async (vars: { ids: number[]; assignedTo: string | null }) => {
      const res = await apiRequest("POST", "/api/inbox/assign-conversation-bulk", {
        inbox_ids: vars.ids,
        assigned_to: vars.assignedTo,
      });
      return res.json();
    },
    onSuccess: () => {
      setSelectedInboxIds([]);
      setBulkAssignOpen(false);
      setBulkAssignAgent("");
      queryClient.invalidateQueries({ queryKey: ["/api/inbox/list"] });
      queryClient.invalidateQueries({ queryKey: ["/api/inbox/count"] });
      if (selectedConversation) {
        queryClient.invalidateQueries({ queryKey: ["/api/inbox/messages", selectedConversation] });
      }
      toast({ title: t("conversations_inbox.toasts.assigned_title") });
    },
    onError: (err: Error) => toast({ title: t("conversations_inbox.toasts.assign_failed"), description: err.message, variant: "destructive" }),
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: async (ids: number[]) => {
      const res = await apiRequest("DELETE", "/api/inbox/chats", { inbox_ids: ids });
      return res.json();
    },
    onSuccess: (_d, ids) => {
      // Drop the open thread if it was among the deleted set.
      if (selectedConversation && ids.includes(selectedConversation)) setSelectedConversation(null);
      setSelectedInboxIds([]);
      queryClient.invalidateQueries({ queryKey: ["/api/inbox/list"] });
      queryClient.invalidateQueries({ queryKey: ["/api/inbox/count"] });
      toast({ title: t("conversations_inbox.toasts.deleted_title"), description: t("conversations_inbox.toasts.bulk_deleted_desc", { count: ids.length }) });
    },
    onError: (err: Error) => toast({ title: t("conversations_inbox.toasts.delete_failed"), description: err.message, variant: "destructive" }),
  });

  // Clear any ticked rows when the visible set changes (tab / folder / channel /
  // search) so a bulk action never hits conversations the agent can no longer see.
  useEffect(() => {
    setSelectedInboxIds([]);
    setListLimit(20); // collapse back to one page when the visible set changes
  }, [activeTab, activeFolderId, selectedChannels, selectedFilterAgents, searchQuery, searchType, sortBy, appliedFilters]);

  // "Queue order" sort only makes sense on the Queue tab — reset to the default
  // (Latest message ↓) when navigating away so other tabs aren't sorted by queued_at.
  useEffect(() => {
    if (activeTab !== "queue" && sortBy.column === "queued_at") {
      setSortBy({ ...SORT_OPTIONS[0] });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  // Move the open conversation into / out of a folder (replyagent header
  // "Folder" dropdown → folderUpdated). folderId null clears the folder.
  const moveToFolderMutation = useMutation({
    mutationFn: async (vars: { id: number; folderId: string | null }) => {
      const res = await apiRequest("POST", "/api/inbox/move-to-folder", {
        inbox_ids: [vars.id],
        folder_id: vars.folderId,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/inbox/list"] });
      queryClient.invalidateQueries({ queryKey: ["/api/inbox/count"] });
      toast({ title: t("conversations_inbox.toasts.folder_updated") });
    },
    onError: (err: Error) => toast({ title: t("conversations_inbox.toasts.couldnt_move"), description: err.message, variant: "destructive" }),
  });

  // Toggle a single row's checkbox without opening the conversation.
  const toggleInboxSelection = (id: number) => {
    setSelectedInboxIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  // Filter Handlers
  const addFilter = () => {
    setFilters([...filters, { id: Date.now().toString(), column: "name", operator: "contains", value: "" }]);
  };

  const removeFilter = (id: string) => {
    setFilters(filters.filter(f => f.id !== id));
  };

  const updateFilter = (id: string, column: string, operator: string, value: string) => {
    setFilters(filters.map(f => f.id === id ? { ...f, column, operator, value } : f));
  };

  const handleFilterDragStart = (id: string) => {
    setDraggedFilterId(id);
  };

  const handleFilterDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleFilterDrop = (targetId: string) => {
    if (!draggedFilterId || draggedFilterId === targetId) return;

    const draggedIndex = filters.findIndex(f => f.id === draggedFilterId);
    const targetIndex = filters.findIndex(f => f.id === targetId);

    const newFilters = [...filters];
    [newFilters[draggedIndex], newFilters[targetIndex]] = [newFilters[targetIndex], newFilters[draggedIndex]];
    setFilters(newFilters);
    setDraggedFilterId(null);
  };

  // Current user — real identity from localStorage (set at login by auth.service).
  const currentUser = useMemo(() => {
    try {
      const info = JSON.parse(localStorage.getItem('user_info') || '{}');
      return {
        id: info.id?.toString() || null,
        name: `${info.first_name || ''} ${info.last_name || ''}`.trim() || info.name || info.email || 'Me',
      };
    } catch { return { id: null, name: 'Me' }; }
  }, []);

  // ─── Reply permission gate (replyagent MessageComposer parity) ───
  // The reply composer is shown only when the agent may message this chat:
  //   isAssigned (has `send_message` perm OR the chat is assigned to ME)
  //   || canMessageUnassignedConversations (has `message_unassigned` perm)
  // Otherwise the composer is replaced with an "assign this chat" prompt.
  // Owners hold `workspace.*`, so this is always true for them (no regression).
  const userPerms = (getUserInfo().permissions as string[] | undefined) ?? [];
  const canSendWithoutAssignment = hasAnyPerm(userPerms, ["workspace.inbox.user.can.send_message"]);
  const canMessageUnassigned = hasAnyPerm(userPerms, ["workspace.inbox.message_unassigned_conversations"]);
  const assignedToMe = !!currentUser.id && assignedAgent === currentUser.id;
  const canReply = canSendWithoutAssignment || assignedToMe || canMessageUnassigned;
  // Whether the agent may (re)assign conversations (replyagent: v-can on the
  // assign action). Owners hold `workspace.*` so this is always true for them.
  const canAssignConversations = hasAnyPerm(userPerms, ["workspace.inbox.user.can.assign_conversations"]);
  // "Block" permissions hide a folder when the agent HAS them (replyagent
  // getSystemFolders). These use an EXACT slug match — NOT hasAnyPerm — so a
  // `workspace.*` owner (who lacks the literal block slug) is never blocked.
  const blockQueueFolder = userPerms.includes("workspace.inbox.user.queue_blocked");
  const blockDoneFolder = userPerms.includes("workspace.inbox.block_done_folder");
  // Block the delete-conversation action when the agent holds this "block"
  // permission (replyagent hasBlockedDeleting). Exact match → owners aren't blocked.
  const blockDeletingChats = userPerms.includes("workspace.inbox.user.block_deleting_chats");
  // "Allow" permission — agent may delete individual sent messages (replyagent
  // ZapiMessages canDeleteMessages). Owners pass via the `workspace.*` wildcard.
  const canDeleteMessage = hasAnyPerm(userPerms, ["workspace.inbox.qr.delete_message"]);
  // "Hide" permission — when the agent HOLDS `contact.view_channel`, the contact's
  // channel info (phone/whatsapp/email) is hidden (replyagent canSeeChannels).
  // Exact match → owners (no literal slug) keep seeing channel info.
  const canSeeChannels = !userPerms.includes("workspace.inbox.contact.view_channel");
  // "Block" permission — when the agent HOLDS `contact.view_profile`, the button
  // that opens the full contact profile is hidden (replyagent: Profile button is
  // wrapped in v-if="!includes('...view_profile')"). Exact match → owners (no
  // literal slug) keep access to the full profile.
  const canViewProfile = !userPerms.includes("workspace.inbox.contact.view_profile");

  // Fetch workspace members — inbox is workspace-scoped. Workspace users lack
  // agency.users.* permission, so calling /agencies/:id/members would 403.
  const { data: membersResponse } = useQuery({
    queryKey: ["/api/workspaces/members"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/workspaces/members");
      return res.json();
    }
  });

  // Backend returns a plain array; older callers wrapped it under .users / .members.
  // Handle both shapes so future API changes don't silently empty this dropdown.
  const membersList: any[] = Array.isArray(membersResponse)
    ? membersResponse
    : (membersResponse?.users || membersResponse?.members || []);

  const agentOptions: AgentOption[] = membersList.map((m: { id: number; first_name?: string; last_name?: string; email: string }) => ({
    id: m.id.toString(),
    name: `${m.first_name || ''} ${m.last_name || ''}`.trim() || m.email,
    icon: React.createElement("div", { 
      className: `w-5 h-5 rounded-full ${getAvatarColor(m.first_name || m.email)} flex items-center justify-center text-[10px] font-semibold text-white` 
    }, (m.first_name?.[0] || m.email?.[0] || "U").toUpperCase())
  }));

  // Add "Unassigned" option if needed or handle it in the UI
  
  // Helper function to get agent name by ID
  const getAgentName = (agentId: string | null) => {
    if (!agentId) return t("conversations_inbox.list.unassigned");
    const agent = agentOptions.find((a: AgentOption) => a.id === agentId);
    return agent?.name || agentId;
  };

  // Toggle contact panel visibility
  const handleToggleContactPanel = () => {
    const newShowState = !showContactPanel;
    setShowContactPanel(newShowState);

    if (selectedConversation) {
      const closedProfiles = JSON.parse(localStorage.getItem('closed_contact_profiles') || '[]');
      if (!newShowState) {
        // User closed it, remember this
        if (!closedProfiles.includes(selectedConversation)) {
          closedProfiles.push(selectedConversation);
          localStorage.setItem('closed_contact_profiles', JSON.stringify(closedProfiles));
        }
      } else {
        // User opened it, remove from closed list
        const newClosedProfiles = closedProfiles.filter((id: number) => id !== selectedConversation);
        localStorage.setItem('closed_contact_profiles', JSON.stringify(newClosedProfiles));
      }
    }
  };

  // Restore profile state when conversation changes
  useEffect(() => {
    if (selectedConversation) {
      const closedProfiles = JSON.parse(localStorage.getItem('closed_contact_profiles') || '[]');
      // Default is OPEN (true), so if it's in the closed list, set to false.
      setShowContactPanel(!closedProfiles.includes(selectedConversation));
    } else {
      setShowContactPanel(false);
    }
  }, [selectedConversation]);

  // Calculate pending messages count
  const getPendingMessagesCount = (conv: Conversation): number => {
    // We can use unread_count from the backend conversation object
    return conv.unread || 0;
  };

  // Filter and sort conversations
  const getFilteredConversations = (): Conversation[] => {
    let filtered: Conversation[] = conversations;

    // Tab filtering is handled server-side — backend already returns the correct
    // subset for each tab (read/unread/queue/upcoming/completed). Local filtering
    // here was incorrectly matching conv.status === "read" etc. which never worked.

    // Search is server-side + type-aware now (the list API receives `search` +
    // `search_type`), so no client-side text filter — doing one here would drop
    // valid rows whose match is on a field not present in the list item (e.g. a
    // WhatsApp wa_id or support-ticket number).

    // Agents + Channels filtering is now server-side (the list/count API receive
    // `users` + `channel_types`), so no client-side pass is needed here.

    // Advanced filters run server-side now (the list API receives
    // `advanced_filters`), resolved across all contacts — not just the loaded
    // page — so there's no client-side pass here.

    // Filter by teams (Legacy/Existing)
    if (filterTeams.length > 0) {
      filtered = filtered.filter((conv: Conversation) => {
        const convTeams = involvedTeamsByConv[conv.id] || [];
        return filterTeams.some(teamId => convTeams.includes(teamId));
      });
    }

    // Filter by agents (Legacy/Existing - usually superceded by Select Agents above)
    if (filterAgents.length > 0) {
      filtered = filtered.filter((conv: Conversation) => {
        return filterAgents.includes(conv.assignedAgent || "");
      });
    }

    // Sorting is server-side now (the list API receives `sort`), so the backend
    // already returns rows in the chosen order — no client re-sort needed.
    return filtered;
  };

  // Mark messages as read when conversation is selected
  const handleSelectConversation = (convId: number) => {
    setSelectedConversation(convId);
    const conv = conversations.find((c: Conversation) => c.id === convId);
    const agentId = conv?.assignedAgent || null;
    setAssignedAgent(agentId && currentUser.id && agentId === currentUser.id ? "self" : agentId);

    apiRequest("POST", `/api/inbox/seen/${convId}`).catch(() => {});
  };

  // Handle assignment - changes status to active and assigns agent
  const handleAssignAgent = (agentId: string) => {
    if (selectedConversation) {
      assignAgentMutation.mutate({ agentId });
      setAssignedAgent(agentId === "self" || agentId === currentUser.id ? "self" : agentId);
    }
  };

  const handleExportConversations = () => {
    // Export the REAL messages of the selected conversation
    const convStatus = selectedConvObj?.status || "";
    const contactName = selectedConvObj?.displayName || selectedConvObj?.name || "Customer";

    const headers = ["Number", "Status", "Inbound/Outbound", "Sender Name", "Messages Content", "Messages Status"];
    const rows = messages.map((msg, i) => [
      i + 1,
      convStatus,
      msg.from === "agent" ? "Outbound" : "Inbound",
      msg.from === "agent" ? (assignedAgent || "Agent") : contactName,
      `"${(msg.text || "").replace(/"/g, '""')}"`, // escape quotes & wrap for commas
      "",
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map(row => row.join(",")),
    ].join("\n");

    // Download CSV
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `conversations-export-${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleMouseDown = () => {
    setIsDragging(true);
  };

  // Composer resize — drag the handle bar at the top of the reply/note box
  // up (bigger) or down (smaller). Bounded so it can't disappear or take
  // over the whole thread.
  const handleComposerResizeStart = (e: React.MouseEvent) => {
    e.preventDefault();
    composerResizeStartRef.current = { y: e.clientY, height: composerHeight ?? 80 };
    setIsResizingComposer(true);
  };

  React.useEffect(() => {
    if (!isResizingComposer) return;
    const onMove = (e: MouseEvent) => {
      const start = composerResizeStartRef.current;
      if (!start) return;
      const delta = start.y - e.clientY; // dragging up increases height
      const next = Math.min(Math.max(start.height + delta, 40), 320);
      setComposerHeight(next);
    };
    const onUp = () => setIsResizingComposer(false);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [isResizingComposer]);

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isDragging) return;

    const newWidth = e.clientX - (document.querySelector('[data-sidebar]')?.getBoundingClientRect().left || 0);
    const minWidth = 345;
    const maxWidth = 600;

    if (newWidth >= minWidth && newWidth <= maxWidth) {
      setSidebarWidth(newWidth);
    }
  };

  React.useEffect(() => {
    if (isDragging) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
      return () => {
        window.removeEventListener("mousemove", handleMouseMove);
        window.removeEventListener("mouseup", handleMouseUp);
      };
    }
  }, [isDragging]);
  const [customAttributesByConv, setCustomAttributesByConv] = useState<Record<number, Record<string, string>>>({});
  const [profileFieldsByConv, setProfileFieldsByConv] = useState<Record<number, any[]>>({});

  // Basic details EDIT BUFFER per conversation (starts empty — real values come from the conversation's contact)
  const [basicDetailsByConv, setBasicDetailsByConv] = useState<Record<number, BasicDetails>>({});

  // Real contact details for the selected conversation; the edit buffer wins once the user changes something.
  const selectedConvObj = conversations.find((c: Conversation) => c.id === selectedConversation);
  const currentBasicDetails: BasicDetails =
    (selectedConversation != null && basicDetailsByConv[selectedConversation]) || {
      displayName: selectedConvObj?.displayName || selectedConvObj?.name || "",
      number: selectedConvObj?.phoneNumber || "",
      email: "",
      gender: "",
      whatsappOptOut: "No",
      address: "",
    };

  // Involved teams state per conversation
  const [involvedTeamsByConv, setInvolvedTeamsByConv] = useState<Record<number, string[]>>({});

  // Team options
  // Real teams (replaces hardcoded options)
  const { data: teamsData } = useQuery({
    queryKey: ["/api/teams/get-all"],
    queryFn: async () => (await apiRequest("GET", "/api/teams/get-all")).json(),
  });
  const teamOptions = (Array.isArray(teamsData) ? teamsData : []).map((t: any) => ({ id: String(t.id), name: t.name }));

  // Tags state per conversation (keyed by conv id, values are tag names)
  const [tagsByConv, setTagsByConv] = useState<Record<number, string[]>>({});

  // Tag options
  // Real tags (replaces hardcoded options)
  const { data: tagsData } = useQuery({
    queryKey: ["/api/tags/list"],
    queryFn: async () => (await apiRequest("GET", "/api/tags/list")).json(),
  });
  const tagOptions = (tagsData?.tags || []).map((t: any) => ({ id: String(t.id), name: t.name }));

  // WhatsApp templates from broadcasts endpoint
  const { data: templatesData } = useQuery({
    queryKey: ["/api/broadcasts/templates"],
    queryFn: async () => (await apiRequest("GET", "/api/broadcasts/templates")).json(),
  });
  const broadcastTemplates: Template[] = useMemo(() => {
    const raw: any[] = templatesData?.templates || [];
    return raw.map((t: any, idx: number) => {
      const components: any[] = Array.isArray(t.components) ? t.components : [];
      const headerComp = components.find((c: any) => c.type === "HEADER");
      const bodyComp = components.find((c: any) => c.type === "BODY");
      const footerComp = components.find((c: any) => c.type === "FOOTER");
      const buttonsComp = components.find((c: any) => c.type === "BUTTONS");
      const bodyText: string = bodyComp?.text || "";
      const varMatches = [...bodyText.matchAll(/\{\{(\d+)\}\}/g)];
      const variables = varMatches.map((m) => m[1]);
      const buttons = (buttonsComp?.buttons || []).map((b: any, bi: number) => {
        if (b.type === "QUICK_REPLY") return { id: bi + 1, type: "quick-reply", buttonText: b.text };
        if (b.type === "URL") return { id: bi + 1, type: "visit-website", buttonText: b.text, websiteUrl: b.url };
        if (b.type === "PHONE_NUMBER") return { id: bi + 1, type: "call-phone", buttonText: b.text, phoneNumber: b.phone_number };
        return { id: bi + 1, type: b.type?.toLowerCase() || "quick-reply", buttonText: b.text };
      });
      return {
        id: idx + 1,
        name: t.name,
        header: headerComp?.text || "",
        body: bodyText,
        footer: footerComp?.text || "",
        variables,
        buttons,
      } as Template;
    });
  }, [templatesData]);

  // Canned / quick responses (replyagent "/" canned). Real data from
  // GET /quick-response — replaces the old hardcoded chips.
  const { data: quickResponsesData } = useQuery<any>({
    queryKey: ["/api/quick-response"],
    queryFn: async () => (await apiRequest("GET", "/api/quick-response")).json(),
  });
  const cannedMessages = useMemo(() => {
    const rows: any[] = quickResponsesData?.responses ?? [];
    return rows
      .filter((r) => r.parent_id != null && (r.text || r.title || (r.mediaList?.length ?? 0) > 0))
      .map((r) => ({
        id: String(r.id),
        title: r.title ?? "",
        text: r.text ?? "",
        media: Array.isArray(r.mediaList) ? r.mediaList.map((m: any) => m.media).filter(Boolean) : [],
      }));
  }, [quickResponsesData]);

  // Apply a canned reply (replyagent messageSelected): set the text + attach any
  // media (fetched from its gallery URL into a File so the normal multipart send
  // handles it). Clears the "/" trigger when the canned has no text.
  const applyCanned = async (c: { text: string; media?: any[] }) => {
    setMessageText(c.text || "");
    const medias = c.media ?? [];
    if (!medias.length) return;
    const files: File[] = [];
    for (const m of medias) {
      if (!m?.file_url) continue;
      try {
        const res = await fetch(m.file_url);
        const blob = await res.blob();
        const ext = m.extension ? `.${m.extension}` : "";
        const name = m.object_name || `canned-media${ext}`;
        files.push(new File([blob], name, { type: m.mime_type || blob.type || "application/octet-stream" }));
      } catch { /* skip unreachable media */ }
    }
    if (files.length) setAttachedFiles((prev) => [...prev, ...files]);
  };

  // Notes state per conversation
  const [notesByConv, setNotesByConv] = useState<Record<number, string[]>>({});

  // Update handlers for ContactProfileSidebar
  const handleUpdateBasicDetails = (details: BasicDetails) => {
    if (selectedConversation) {
      setBasicDetailsByConv({ ...basicDetailsByConv, [selectedConversation]: details });
      const contactId = (profileData as any)?.contact?.id;
      if (contactId) {
        apiRequest("PATCH", `/api/contacts/${contactId}`, {
          full_name: details.displayName,
          email: details.email,
          address: details.address,
          gender: details.gender,
        }).catch(() => {});
      }
    }
  };

  const handleUpdateInvolvedTeams = (teams: string[]) => {
    if (selectedConversation) {
      setInvolvedTeamsByConv({ ...involvedTeamsByConv, [selectedConversation]: teams });
    }
  };

  const handleUpdateTags = async (newTags: string[]) => {
    if (!selectedConversation) return;
    const current = tagsByConv[selectedConversation] || [];
    const added = newTags.filter((t) => !current.includes(t));
    const removed = current.filter((t) => !newTags.includes(t));

    // Optimistic update (IDs)
    setTagsByConv({ ...tagsByConv, [selectedConversation]: newTags });

    // Backend profile-action expects tag NAME — resolve from tagOptions
    for (const tagId of added) {
      const tagName = tagOptions.find((t) => t.id === tagId)?.name;
      if (!tagName) continue;
      try {
        await apiRequest("POST", `/api/inbox/profile-action/${selectedConversation}`, { action: "apply_tag", tag: tagName });
      } catch (e) {
        console.error("Failed to apply tag:", tagName, e);
      }
    }
    for (const tagId of removed) {
      const tagName = tagOptions.find((t) => t.id === tagId)?.name;
      if (!tagName) continue;
      try {
        await apiRequest("POST", `/api/inbox/profile-action/${selectedConversation}`, { action: "remove_tag", tag: tagName });
      } catch (e) {
        console.error("Failed to remove tag:", tagName, e);
      }
    }
  };

  const handleUpdateCustomAttributes = (attributes: Record<string, string>) => {
    if (selectedConversation) {
      setCustomAttributesByConv({ ...customAttributesByConv, [selectedConversation]: attributes });
    }
  };

  const handleSaveCustomFieldValue = async (fieldId: string, value: string) => {
    const contactId = (profileData as any)?.contact?.id;
    if (!contactId) return;
    try {
      await apiRequest('POST', `/api/custom-fields/contact/${contactId}/value`, { field_id: fieldId, value });
      refetchProfileData();
    } catch (_e) {}
  };

  const handleUpdateNotes = async (notes: string[]) => {
    if (!selectedConversation) return;
    const current = notesByConv[selectedConversation] || [];
    const added = notes.filter((n) => !current.includes(n));

    // Optimistic update
    setNotesByConv({ ...notesByConv, [selectedConversation]: notes });

    // Persist new notes via POST /api/notes/chat
    const conv = conversations.find((c: Conversation) => c.id === selectedConversation);
    for (const text of added) {
      if (!text.trim()) continue;
      try {
        await apiRequest("POST", "/api/notes/chat", {
          text,
          contact_id: selectedContactId,
          modelable_type: (profileData?.inbox?.modelable_type) ?? null,
          modelable_id: (profileData?.inbox?.modelable_id) ? Number(profileData.inbox.modelable_id) : null,
        });
        refetchNotes();
      } catch (e) {
        console.error("Failed to save note:", e);
      }
    }
  };

  // Filter modal state
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [filterTeams, setFilterTeams] = useState<string[]>([]);
  const [filterAgents, setFilterAgents] = useState<string[]>([]);
  const [selectedTeamsForModal, setSelectedTeamsForModal] = useState<string[]>([]);
  const [filterStatus, setFilterStatus] = useState<string[]>([]);

  // Image Preview State
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  // Add conversation modals
  const [isAddMenuOpen, setIsAddMenuOpen] = useState(false);
  const [isMakeCallModalOpen, setIsMakeCallModalOpen] = useState(false);
  const [isTemplateMessageModalOpen, setIsTemplateMessageModalOpen] = useState(false);
  const [makeCallTab, setMakeCallTab] = useState<"make-call" | "search-contacts">("make-call");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [callPermissionChecked, setCallPermissionChecked] = useState(false);
  const [hasCallPermission, setHasCallPermission] = useState(false);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);

  const [searchContactsQuery, setSearchContactsQuery] = useState("");
  const [limitReached, setLimitReached] = useState(false);

  // Contacts search for "Make a Call" modal — declared after searchContactsQuery state
  const { data: callContactsData } = useQuery({
    queryKey: ["/api/contacts", searchContactsQuery],
    queryFn: async () => {
      const params = searchContactsQuery.trim() ? `?search=${encodeURIComponent(searchContactsQuery)}` : "";
      return (await apiRequest("GET", `/api/contacts${params}`)).json();
    },
    enabled: isMakeCallModalOpen,
  });
  const callContacts: any[] = callContactsData?.contacts || callContactsData || [];

  // Template message state
  const [templatePhoneNumbers, setTemplatePhoneNumbers] = useState<string[]>([""]); // Start with just one empty input

  // Message input state
  const [messageText, setMessageText] = useState("");
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
  // Files picked from the Media Gallery — referenced by id, not downloaded
  // into a local File object. They're already on S3; sending by reference
  // (gallery_media_ids) skips the download-then-re-upload round trip that
  // used to make gallery attachments feel slow.
  const [attachedGalleryItems, setAttachedGalleryItems] = useState<{ id: string; name: string; size: number; mime: string; thumb?: string | null }[]>([]);
  // Local object-URL thumbnails for image attachments in the composer
  // preview — shows the actual picture instead of a generic paperclip icon.
  // Recomputed (and old URLs revoked) whenever the attached-file list changes.
  const [attachedImagePreviews, setAttachedImagePreviews] = useState<(string | null)[]>([]);
  useEffect(() => {
    const urls = attachedFiles.map((f) => (f.type.startsWith("image/") ? URL.createObjectURL(f) : null));
    setAttachedImagePreviews(urls);
    return () => { urls.forEach((u) => u && URL.revokeObjectURL(u)); };
  }, [attachedFiles]);
  const [isRecording, setIsRecording] = useState(false);
  const [recordedAudio, setRecordedAudio] = useState<Blob | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const shouldScrollToBottomRef = useRef(false);
  const [isChatVisible, setIsChatVisible] = useState(false);
  const emojiPickerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const composerTextareaRef = useRef<HTMLTextAreaElement>(null);

  // WhatsApp-markdown text styling (replyagent addBodyStyle): wrap the selected
  // text in the composer with the formatting marker.
  const applyTextStyle = (marker: string) => {
    const ta = composerTextareaRef.current;
    if (!ta) return;
    const start = ta.selectionStart ?? 0;
    const end = ta.selectionEnd ?? 0;
    const sel = messageText.slice(start, end).trim();
    if (!sel) return;
    const next = messageText.slice(0, start) + marker + sel + marker + messageText.slice(end);
    setMessageText(next);
  };
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // Close emoji picker when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(event.target as Node)) {
        setShowEmojiPicker(false);
      }
    };

    if (showEmojiPicker) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [showEmojiPicker]);

  // Close filter popout when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (filterDropdownRef.current && !filterDropdownRef.current.contains(event.target as Node)) {
        setShowFilter(false);
      }
    };

    if (showFilter) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [showFilter]);

  // Handle emoji selection from emoji-mart
  const handleEmojiSelect = (emoji: Emoji) => {
    setMessageText(messageText + emoji.native);
    setShowEmojiPicker(false);
  };

  // Handle file attachment
  const handleFileAttach = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.currentTarget.files;
    if (files && files.length > 0) {
      const isInstagram = selectedConvObj?.channel === 'instagram';
      const isWhatsApp = selectedConvObj?.channel === 'whatsapp';

      if (isInstagram) {
        const unsupported = Array.from(files).filter((f) => {
          const m = f.type;
          return !m.startsWith('image/') && !m.startsWith('video/') && !m.startsWith('audio/');
        });
        if (unsupported.length > 0) {
          toast({ title: t("conversations_inbox.composer.instagram_unsupported_files"), variant: 'destructive' });
          if (fileInputRef.current) fileInputRef.current.value = '';
          return;
        }
      }

      if (isWhatsApp) {
        const tooBig = Array.from(files).filter(f => f.size > getWaLimit(f));
        const valid = Array.from(files).filter(f => f.size <= getWaLimit(f));
        if (tooBig.length > 0) {
          const labels = tooBig.map(f => `${f.name} (${(f.size / 1024 / 1024).toFixed(1)}MB — limit ${waLimitLabel(f)})`).join(', ');
          toast({ title: t("conversations_inbox.composer.file_size_limit_exceeded", { labels }), variant: 'destructive' });
        }
        if (valid.length > 0) setAttachedFiles(prev => [...prev, ...valid]);
        if (fileInputRef.current) fileInputRef.current.value = '';
        return;
      }

      setAttachedFiles([...attachedFiles, ...Array.from(files)]);
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // Handle image attachment
  const handleImageAttach = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.currentTarget.files;
    if (files && files.length > 0) {
      const isWhatsApp = selectedConvObj?.channel === 'whatsapp';

      if (isWhatsApp) {
        const tooBig = Array.from(files).filter(f => f.size > getWaLimit(f));
        const valid = Array.from(files).filter(f => f.size <= getWaLimit(f));
        if (tooBig.length > 0) {
          const labels = tooBig.map(f => `${f.name} (${(f.size / 1024 / 1024).toFixed(1)}MB — limit ${waLimitLabel(f)})`).join(', ');
          toast({ title: t("conversations_inbox.composer.file_size_limit_exceeded", { labels }), variant: 'destructive' });
        }
        if (valid.length > 0) setAttachedFiles(prev => [...prev, ...valid]);
        if (imageInputRef.current) imageInputRef.current.value = '';
        return;
      }

      setAttachedFiles([...attachedFiles, ...Array.from(files)]);
    }
    if (imageInputRef.current) imageInputRef.current.value = "";
  };

  // Handle voice recording
  const handleStartRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        setRecordedAudio(audioBlob);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (error) {
      console.error("Error accessing microphone:", error);
    }
  };

  // Handle stop recording
  const handleStopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  // Handle send message. Wraps the bare text + the composer's mode/reply
  // context so the backend can persist this as a real reply, an internal note
  // (Note tab), or a reply-quoted message.
  const handleSendMessage = () => {
    const hasContent = messageText.trim() || attachedFiles.length > 0 || attachedGalleryItems.length > 0 || recordedAudio;
    if (!hasContent) return;
    sendMessageMutation.mutate({
      text: messageText,
      compose_mode: composeMode,
      reply_to_message_id: replyingTo?.id ?? null,
      files: attachedFiles.length > 0 ? attachedFiles : undefined,
      gallery_media_ids: attachedGalleryItems.length > 0 ? attachedGalleryItems.map((g) => g.id) : undefined,
      audio: recordedAudio ?? undefined,
      mentions: composeMode === "note" && mentions.length > 0 ? mentions : undefined,
    } as any);
    setAttachedGalleryItems([]);
    setReplyingTo(null);
    setMentions([]);
  };

  // Insert the picked agent's name at the active "@" token + track the mention.
  const insertMention = (a: AgentOption) => {
    const at = messageText.lastIndexOf("@");
    if (at === -1) return;
    const after = messageText.slice(at + 1);
    const word = after.split(/\s/)[0];
    const name = a.name.replace(/\s+/g, "_");
    setMessageText(messageText.slice(0, at + 1) + name + " " + messageText.slice(at + 1 + word.length));
    setMentions((prev) => (prev.includes(a.id) ? prev : [...prev, a.id]));
  };

  // Remove attached file
  const removeAttachedFile = (index: number) => {
    setAttachedFiles(attachedFiles.filter((_, i) => i !== index));
  };

  // Call UI state
  const [isCallActive, setIsCallActive] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [callPhoneNumber, setCallPhoneNumber] = useState("");
  const [callContactName, setCallContactName] = useState("");
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeakerOn, setIsSpeakerOn] = useState(false);

  // Call timer
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isCallActive) {
      interval = setInterval(() => {
        setCallDuration(prev => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isCallActive]);

  // Format call duration
  const formatCallDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
    }
    return `${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  };


  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [templateVariables, setTemplateVariables] = useState<Record<string, string>>({});

  // Helper to split text by newlines and insert <br /> tags
  const splitByNewlines = (text: string, startKey: number) => {
    const lines = text.split('\n');
    const result: React.ReactNode[] = [];

    lines.forEach((line, index) => {
      // Check if line starts with "- " for bullet points
      if (line.trim().startsWith('- ')) {
        const bulletText = line.replace(/^\s*-\s/, '');
        result.push(
          <span key={startKey + index * 2}>
            <span className="inline-block mr-1">•</span>
            {bulletText}
          </span>
        );
      } else {
        result.push(<span key={startKey + index * 2}>{line}</span>);
      }

      if (index < lines.length - 1) {
        result.push(<br key={startKey + index * 2 + 1} />);
      }
    });

    return result;
  };

  // WhatsApp-style text formatter with nested formatting support
  const formatWhatsAppText = (text: string): React.ReactNode => {
    const parts: React.ReactNode[] = [];
    let currentIndex = 0;
    let key = 0;

    // Process text character by character to handle WhatsApp formatting
    // WhatsApp uses: *bold*, _italic_, ~strikethrough~
    const regex = /(\*[^*]+\*|_[^_]+_|~[^~]+~)/g;
    let match;

    while ((match = regex.exec(text)) !== null) {
      // Add text before the match
      if (match.index > currentIndex) {
        const beforeText = text.substring(currentIndex, match.index);
        parts.push(...splitByNewlines(beforeText, key));
        key += beforeText.split('\n').length;
      }

      const matchedText = match[0];
      const innerText = matchedText.substring(1, matchedText.length - 1);
      const formatChar = matchedText[0];

      // Recursively format the inner text to support nested formatting
      const formattedInner = formatWhatsAppText(innerText);

      // Apply formatting based on WhatsApp syntax
      if (formatChar === '*') {
        parts.push(<strong key={key++}>{formattedInner}</strong>);
      } else if (formatChar === '_') {
        parts.push(<em key={key++}>{formattedInner}</em>);
      } else if (formatChar === '~') {
        parts.push(<s key={key++}>{formattedInner}</s>);
      }

      currentIndex = match.index + matchedText.length;
    }

    // Add remaining text
    if (currentIndex < text.length) {
      const remainingText = text.substring(currentIndex);
      parts.push(...splitByNewlines(remainingText, key));
    }

    return parts.length > 0 ? parts : text;
  };

  // Handle sending template message
  const handleSendTemplateMessage = () => {
    if (!selectedTemplate || templatePhoneNumbers.filter(p => p.trim()).length === 0) {
      return;
    }

    // Check if all variables are filled
    if (selectedTemplate.variables && selectedTemplate.variables.length > 0) {
      const allVariablesFilled = selectedTemplate.variables.every(
        (variable: string) => templateVariables[variable]?.trim()
      );
      if (!allVariablesFilled) {
        return;
      }
    }

    // Get valid phone numbers
    const validPhoneNumbers = templatePhoneNumbers.filter(p => p.trim());

    // Create a new conversation for each phone number
    const newConversations = validPhoneNumbers.map((phoneNumber, index) => {
      const newId = Math.max(...conversations.map((c: Conversation) => c.id), 0) + index + 1;

      // Replace variables in template body
      let messageText = selectedTemplate.body;
      selectedTemplate.variables.forEach((variable: string) => {
        messageText = messageText.replace(`{{${variable}}}`, templateVariables[variable] || `{{${variable}}}`);
      });

      return {
        id: newId,
        phoneNumber: phoneNumber,
        displayName: "", // Will default to phoneNumber via getDisplayName()
        lastMessage: messageText,
        time: new Date().toISOString(),
        unread: 0,
        channel: "whatsapp",
        status: "queued",
        assignedAgent: null
      };
    });

    // Add phone numbers to basic details
    const newBasicDetails = { ...basicDetailsByConv };
    newConversations.forEach(conv => {
      newBasicDetails[conv.id] = { displayName: conv.displayName, number: conv.phoneNumber, email: "", gender: "", whatsappOptOut: "No", address: "" };
    });
    setBasicDetailsByConv(newBasicDetails);

    // Reset form and close modal
    setTemplatePhoneNumbers([""]);
    setSelectedTemplate(null);
    setTemplateVariables({});
    setIsTemplateMessageModalOpen(false);

    // Select the first new conversation
    if (newConversations.length > 0) {
      setSelectedConversation(newConversations[0].id);
    }
  };


  const handleCheckPermission = async () => {
    if (!phoneNumber.trim()) return;
    setCallPermissionChecked(false);
    try {
      const res = await apiRequest("GET", `/api/contacts?search=${encodeURIComponent(phoneNumber.trim())}`);
      const data = await res.json();
      const contacts: any[] = data?.contacts || data || [];
      const match = contacts.find((c: any) => {
        const num = (c.full_mobile_number || c.mobile_number || "").replace(/\s+/g, "");
        return num === phoneNumber.replace(/\s+/g, "") || num.endsWith(phoneNumber.replace(/\D/g, "").slice(-8));
      });
      const name = match
        ? (match.full_name || `${match.first_name || ""} ${match.last_name || ""}`.trim() || phoneNumber)
        : phoneNumber;
      setHasCallPermission(!!match);
      setSelectedContact(match ? {
        id: Number(match.id),
        name,
        number: phoneNumber,
        callConsent: "Active",
      } : null);
    } catch {
      setHasCallPermission(false);
      setSelectedContact(null);
    }
    setCallPermissionChecked(true);
  };

  // Helper to handle file downloads
  const handleDownload = async (url: string, filename: string) => {
    toast({
      description: t("conversations_inbox.toasts.downloading"),
      duration: 2000,
    });

    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);

      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    } catch (error) {
      console.error('Download failed:', error);
      // Fallback
      window.open(url, '_blank');
    }
  };

  // Function to check if there are any agent messages in the current conversation
  const hasAgentMessages = () => {
    return (messages || []).some((msg: Message) => msg.from === "agent");
  };

  // Handle scroll to message from Contact Profile Sidebar
  const handleScrollToMessage = (messageId: number) => {
    const element = document.getElementById(`message-${messageId}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      const container = element.closest('[data-radix-scroll-area-viewport]') || element.closest('.overflow-y-auto');

      if (container && container instanceof HTMLElement) {
        const elementRect = element.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();
        const relativeTop = elementRect.top - containerRect.top;
        const currentScroll = container.scrollTop;
        const targetScroll = currentScroll + relativeTop - (container.clientHeight / 2) + (element.clientHeight / 2);

        container.scrollTo({
          top: targetScroll,
          behavior: 'smooth'
        });
      }

      element.style.transition = 'background-color 0.5s';
      element.classList.add('ring-2', 'ring-primary', 'ring-offset-2');

      setTimeout(() => {
        element.classList.remove('ring-2', 'ring-primary', 'ring-offset-2');
      }, 2000);
    }
  };


  return (
    <div className="h-full flex flex-col font-sans" data-testid="conversations-inbox">

      <div className="flex-1 flex gap-0 px-6 py-6 max-h-full">
        {/* Left Sidebar */}
        <div className="relative group h-full" data-sidebar>
          <Card className="flex flex-col border-r rounded-r-none h-full" style={{ width: `${sidebarWidth}px` }}>
            <CardHeader className="px-3 space-y-3 pb-3 flex-shrink-0">
              {/* Tabs — replyagent left-nav set, exact order + counts.
                  All / Read / Unread / Queue / Upcoming / Done.
                  Counts come from /inbox/count (workspace-global) so they
                  don't change when you switch tabs. */}
              <div className="px-3 flex justify-between border-b pb-0 w-full">
                {[
                  { key: "all",       label: t("conversations_inbox.tabs.all"),       count: tabCounts.all },
                  { key: "read",      label: t("conversations_inbox.tabs.read"),      count: tabCounts.read },
                  { key: "unread",    label: t("conversations_inbox.tabs.unread"),    count: tabCounts.unread },
                  { key: "queue",     label: t("conversations_inbox.tabs.queue"),     count: tabCounts.queue },
                  { key: "upcoming",  label: t("conversations_inbox.tabs.upcoming"),  count: tabCounts.upcoming },
                  { key: "completed", label: t("conversations_inbox.tabs.done"),      count: tabCounts.completed },
                ].filter(({ key }) =>
                  !(key === "queue" && blockQueueFolder) &&
                  !(key === "completed" && blockDoneFolder)
                ).map(({ key, label, count }) => (
                  <button
                    key={key}
                    onClick={() => setActiveTab(key)}
                    className={`flex flex-col items-center flex-1 px-1.5 py-2 text-xs font-medium border-b-2 transition-colors ${
                      activeTab === key
                        ? "border-b-primary text-foreground"
                        : "border-b-transparent text-muted-foreground hover:text-foreground dark:text-slate-400 dark:hover:text-slate-200"
                    }`}
                  >
                    <span className="whitespace-nowrap">{label}</span>
                    <span className="text-[10px] opacity-60">{count}</span>
                  </button>
                ))}
              </div>

              {/* Search and Action Buttons */}
              <div className="flex gap-1 items-center">
                <div className="relative flex-1 flex items-center gap-1">
                  {/* Search-type selector (replyagent's in-search Listbox). Shown
                      while the box is focused; picks which field to search. */}
                  {isSearchFocused && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-9 px-2 text-xs shrink-0 border border-input dark:border-slate-700 bg-white dark:bg-background hover:bg-accent dark:hover:bg-slate-700"
                          data-testid="search-type-trigger"
                        >
                          {SEARCH_TYPES.find((st) => st.slug === searchType)?.name ?? t("conversations_inbox.search.types.full_name")}
                          <ChevronDown size={12} className="ml-1" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start" className="bg-white dark:bg-background max-h-72 overflow-auto">
                        {SEARCH_TYPES.map((st) => (
                          <DropdownMenuItem
                            key={st.slug}
                            className={searchType === st.slug ? "font-semibold text-primary" : ""}
                            onClick={() => setSearchType(st.slug)}
                          >
                            {st.name}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
                    <Input
                      placeholder={
                        isSearchFocused
                          ? t("conversations_inbox.search.search_by", { field: (SEARCH_TYPES.find((st) => st.slug === searchType)?.name ?? t("conversations_inbox.search.name_fallback")).toLowerCase(), min: searchMinChars })
                          : t("conversations_inbox.search.placeholder")
                      }
                      className="pl-10 border-input h-9 text-xs"
                      data-testid="input-search"
                      onFocus={() => setIsSearchFocused(true)}
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>
                </div>

                {!isSearchFocused && (
                  <>
                    {/* Select Agents Dropdown */}
                    <div className="relative">
                      <CustomDropdown
                        options={agentOptions.map((a: Agent) => ({ id: a.id, name: a.name, icon: a.icon }))}
                        selected={selectedFilterAgents}
                        onChange={setSelectedFilterAgents}
                        placeholder={t("conversations_inbox.search.agents")}
                        width="auto"
                        className="h-9 w-9 px-[0.5rem] justify-center bg-white dark:bg-background border border-input dark:border-slate-700 hover:bg-accent dark:hover:bg-slate-700"
                        triggerContent={<User size={16} />}
                        popoutWidth="200px"
                        popoutAlign="left"
                      />
                    </div>

                    {/* Select Channels Dropdown */}
                    <div className="relative">
                      <CustomDropdown
                        options={channelOptions}
                        selected={selectedChannels}
                        onChange={setSelectedChannels}
                        placeholder={t("conversations_inbox.search.channels")}
                        width="auto"
                        className="h-9 w-9 px-[0.5rem] justify-center bg-white dark:bg-background border border-input dark:border-slate-700 hover:bg-accent dark:hover:bg-slate-700"
                        triggerContent={<ListFilter size={16} />}
                        popoutWidth="200px"
                        popoutAlign="right"
                      />
                    </div>

                    {/* Advanced Filter Popout */}
                    <div className="relative" ref={filterDropdownRef}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className={`h-9 w-9 bg-white dark:bg-background border border-input dark:border-slate-700 hover:bg-accent dark:hover:bg-slate-700 ${showFilter ? 'bg-accent dark:bg-slate-700' : ''}`}
                            onClick={() => setShowFilter(!showFilter)}
                          >
                            <Filter size={16} />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>{t("conversations_inbox.search.filter")}</TooltipContent>
                      </Tooltip>

                      {/* Filter Popover Content */}
                      {showFilter && (
                        <div className="absolute z-[10] bg-white dark:bg-background border border-border dark:border-slate-700 rounded-md shadow-[0_-3px_6px_rgba(0,0,0,0.04),-3px_0_6px_rgba(0,0,0,0.04),3px_0_6px_rgba(0,0,0,0.04),0_4px_6px_rgba(0,0,0,0.1)] p-3 top-full mt-2 left-0" style={{
                          minWidth: '320px',
                          marginLeft: '-140px' // Center align somewhat or adjust to keep on screen
                        }}>
                          {/* Folders chip section. "+" creates; right-click renames/deletes. */}
                          <div className="mb-3 pb-3 border-b border-border/60">
                            <div className="flex items-center justify-between mb-1.5">
                              <p className="text-[10px] font-semibold uppercase text-muted-foreground">{t("conversations_inbox.folders.title")}</p>
                              <button
                                className="text-[10px] font-bold text-muted-foreground hover:text-foreground"
                                onClick={() => {
                                  setFolderEditing(null);
                                  setFolderName("");
                                  setFolderModalOpen(true);
                                }}
                                title={t("conversations_inbox.folders.create_folder_tooltip")}
                              >
                                {t("conversations_inbox.folders.new")}
                              </button>
                            </div>
                            <div className="flex flex-wrap gap-1">
                              <button
                                className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${
                                  activeFolderId === null
                                    ? "bg-primary/10 border-primary/30 text-primary"
                                    : "border-slate-200 dark:border-slate-700 text-muted-foreground"
                                }`}
                                onClick={() => setActiveFolderId(null)}
                              >
                                {t("conversations_inbox.folders.all_folders")}
                              </button>
                              {folders.map((f: any) => (
                                <button
                                  key={String(f.id)}
                                  className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${
                                    activeFolderId === String(f.id)
                                      ? "bg-primary/10 border-primary/30 text-primary"
                                      : "border-slate-200 dark:border-slate-700 text-muted-foreground hover:border-primary/30"
                                  }`}
                                  onClick={() => setActiveFolderId(String(f.id))}
                                  onContextMenu={(e) => {
                                    e.preventDefault();
                                    setFolderEditing(f);
                                    setFolderName(f.name ?? "");
                                    setFolderModalOpen(true);
                                  }}
                                  title={t("conversations_inbox.folders.rename_hint", { name: f.name })}
                                >
                                  {f.name}
                                  <span className="ml-1 opacity-60">({folderCountMap[String(f.id)] ?? 0})</span>
                                </button>
                              ))}
                            </div>
                          </div>

                          {filters.length === 0 ? (
                            <div className="text-center py-6">
                              <h3 className="font-semibold text-sm mb-1">{t("conversations_inbox.filters.no_filters_title")}</h3>
                              <p className="text-xs text-muted-foreground mb-4">{t("conversations_inbox.filters.no_filters_desc")}</p>
                              <Button onClick={addFilter} className="btn-outline-primary" variant="outline">{t("conversations_inbox.filters.add_filter")}</Button>
                            </div>
                          ) : (
                            <div className="space-y-3">
                              {filters.map((filter) => (
                                <div
                                  key={filter.id}
                                  className="flex gap-2 items-center"
                                  draggable
                                  onDragStart={() => handleFilterDragStart(filter.id)}
                                  onDragOver={handleFilterDragOver}
                                  onDrop={() => handleFilterDrop(filter.id)}
                                >
                                  <div className="relative flex-1">
                                    <button
                                      type="button"
                                      onClick={() => setOpenFilterColumnDropdown(openFilterColumnDropdown === filter.id ? null : filter.id)}
                                      className="w-[140px] flex items-center justify-between px-3 py-2 text-left bg-white dark:bg-background border border-input dark:border-slate-700 rounded-md shadow-sm hover:bg-accent dark:hover:bg-slate-700 focus:outline-none text-foreground dark:text-white transition-colors w-full"
                                    >
                                      <span className="truncate text-sm font-normal">{
                                        filter.column === "name" ? t("conversations_inbox.filters.column_full_name") :
                                        filter.column === "firstName" ? t("conversations_inbox.filters.column_first_name") :
                                        filter.column === "lastName" ? t("conversations_inbox.filters.column_last_name") :
                                        filter.column === "phoneNumber" ? t("conversations_inbox.filters.column_phone_number") :
                                        filter.column === "email" ? t("conversations_inbox.filters.column_email") :
                                        t("conversations_inbox.filters.column_tags")
                                      }</span>
                                      <ChevronDown className="h-3 w-3 ml-2 text-muted-foreground" />
                                    </button>
                                    {openFilterColumnDropdown === filter.id && (
                                      <div className="absolute z-10 w-full mt-2 bg-white dark:bg-background rounded-md shadow-md border border-border dark:border-slate-700">
                                        <ul className="py-1">
                                          {[
                                            { key: "name", label: t("conversations_inbox.filters.column_full_name") },
                                            { key: "firstName", label: t("conversations_inbox.filters.column_first_name") },
                                            { key: "lastName", label: t("conversations_inbox.filters.column_last_name") },
                                            { key: "phoneNumber", label: t("conversations_inbox.filters.column_phone_number") },
                                            { key: "email", label: t("conversations_inbox.filters.column_email") },
                                            { key: "tags", label: t("conversations_inbox.filters.column_tags") },
                                          ].map(({ key, label }) => {
                                            const isCurrentOption = key === filter.column;
                                            return (
                                              <li
                                                key={key}
                                                className={`px-3 py-2 text-sm ${isCurrentOption ? "opacity-40 text-muted-foreground cursor-not-allowed" : "cursor-pointer hover:bg-muted"}`}
                                                onClick={() => {
                                                  if (!isCurrentOption) {
                                                    updateFilter(filter.id, key, filter.operator, filter.value);
                                                    setOpenFilterColumnDropdown(null);
                                                  }
                                                }}
                                              >
                                                {label}
                                              </li>
                                            );
                                          })}
                                        </ul>
                                      </div>
                                    )}
                                  </div>
                                  <div className="relative">
                                    <button
                                      type="button"
                                      onClick={() => setOpenFilterOperatorDropdown(openFilterOperatorDropdown === filter.id ? null : filter.id)}
                                      className="w-[170px] flex items-center justify-between px-3 py-2 text-left bg-white dark:bg-background border border-input dark:border-slate-700 rounded-md shadow-sm hover:bg-accent dark:hover:bg-slate-700 focus:outline-none text-foreground dark:text-white transition-colors"
                                    >
                                      <span className="truncate text-sm font-normal">{filter.operator}</span>
                                      <ChevronDown className="h-3 w-3 ml-2 text-muted-foreground" />
                                    </button>
                                    {openFilterOperatorDropdown === filter.id && (
                                      <div className="absolute z-10 w-full mt-2 bg-white dark:bg-background rounded-md shadow-md border border-border dark:border-slate-700">
                                        <ul className="py-1">
                                          {[
                                            { value: "contains", label: t("conversations_inbox.filters.op_contains") },
                                            { value: "does not contain", label: t("conversations_inbox.filters.op_not_contains") },
                                            { value: "is", label: t("conversations_inbox.filters.op_is") },
                                            { value: "is not", label: t("conversations_inbox.filters.op_is_not") },
                                            { value: "is empty", label: t("conversations_inbox.filters.op_is_empty") },
                                            { value: "is not empty", label: t("conversations_inbox.filters.op_is_not_empty") },
                                          ].map(option => (
                                            <li
                                              key={option.value}
                                              className="px-3 py-2 text-sm cursor-pointer hover:bg-muted"
                                              onClick={() => {
                                                updateFilter(filter.id, filter.column, option.value, filter.value);
                                                setOpenFilterOperatorDropdown(null);
                                              }}
                                            >
                                              {option.label}
                                            </li>
                                          ))}
                                        </ul>
                                      </div>
                                    )}
                                  </div>
                                  <input
                                    type="text"
                                    placeholder={t("conversations_inbox.filters.value_placeholder")}
                                    value={filter.value}
                                    onChange={(e) => updateFilter(filter.id, filter.column, filter.operator, e.target.value)}
                                    className="px-3 py-2 text-sm border border-input rounded-md flex-1 focus:outline-none transition-colors bg-card"
                                  />
                                  <button onClick={() => removeFilter(filter.id)} className="p-2 hover:bg-muted rounded"><Trash2 size={14} /></button>
                                  <GripVertical size={14} className="text-muted-foreground cursor-grab" />
                                </div>
                              ))}
                              <div className="flex gap-2 pt-2 border-t">
                                <Button onClick={addFilter} className="btn-outline-primary flex-1" variant="outline">{t("conversations_inbox.filters.add_filter")}</Button>
                                <Button onClick={() => setFilters([])} variant="outline" className="flex-1 border-input [border-color:hsl(var(--input))]">{t("conversations_inbox.filters.reset")}</Button>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    {/* Sort menu (replyagent sort_list): Latest message ↓/↑ +
                        Queue order (only on the Queue tab). Server-side sort. */}
                    <DropdownMenu>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-9 w-9 bg-white dark:bg-background border border-input dark:border-slate-700 hover:bg-accent dark:hover:bg-slate-700"
                              data-testid="sort-trigger"
                            >
                              <ArrowUp size={16} style={{ transform: sortBy.order === "asc" ? "rotate(0deg)" : "rotate(180deg)" }} />
                            </Button>
                          </DropdownMenuTrigger>
                        </TooltipTrigger>
                        <TooltipContent>{sortBy.text}</TooltipContent>
                      </Tooltip>
                      <DropdownMenuContent align="end" className="bg-white dark:bg-background">
                        {SORT_OPTIONS.filter(
                          (o) => o.column !== "queued_at" || activeTab === "queue",
                        ).map((o) => (
                          <DropdownMenuItem
                            key={`${o.column}-${o.order}`}
                            className={
                              sortBy.column === o.column && sortBy.order === o.order
                                ? "font-semibold text-primary"
                                : ""
                            }
                            onClick={() => setSortBy({ ...o })}
                          >
                            {o.text}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </>
                )}

                {isSearchFocused ? (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 bg-white dark:bg-background border border-input dark:border-slate-700 hover:bg-accent dark:hover:bg-slate-700"
                        onClick={() => {
                          setSearchQuery("");
                          setIsSearchFocused(false);
                        }}
                      >
                        <X size={16} />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>{t("conversations_inbox.search.clear_search")}</TooltipContent>
                  </Tooltip>
                ) : (
                  <DropdownMenu open={isAddMenuOpen} onOpenChange={setIsAddMenuOpen}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-9 w-9 bg-white dark:bg-background border border-input dark:border-slate-700 hover:bg-accent dark:hover:bg-slate-700">
                            <Plus size={16} />
                          </Button>
                        </DropdownMenuTrigger>
                      </TooltipTrigger>
                      <TooltipContent>{t("conversations_inbox.search.call_or_message")}</TooltipContent>
                    </Tooltip>
                    <DropdownMenuContent align="end" className="bg-white dark:bg-background">
                      <DropdownMenuItem onClick={() => {
                        setIsMakeCallModalOpen(true);
                        setIsAddMenuOpen(false);
                      }}>
                        {t("conversations_inbox.add_menu.make_call")}
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => {
                        setIsTemplateMessageModalOpen(true);
                        setIsAddMenuOpen(false);
                      }}>
                        {t("conversations_inbox.add_menu.send_template_message")}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
            </CardHeader>

            {/* Select-all + bulk actions toolbar (replyagent select-all + actions
                menu). Only shown when the list has rows. */}
            {getFilteredConversations().length > 0 && (
              <div className="flex items-center gap-2 px-4 py-1.5 border-b flex-shrink-0">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-input text-primary cursor-pointer"
                  aria-label={t("conversations_inbox.list.select_all_aria")}
                  checked={
                    selectedInboxIds.length > 0 &&
                    selectedInboxIds.length === getFilteredConversations().length
                  }
                  ref={(el) => {
                    if (el)
                      el.indeterminate =
                        selectedInboxIds.length > 0 &&
                        selectedInboxIds.length < getFilteredConversations().length;
                  }}
                  onChange={(e) => {
                    if (e.target.checked)
                      setSelectedInboxIds(getFilteredConversations().map((c) => c.id));
                    else setSelectedInboxIds([]);
                  }}
                  data-testid="select-all-conversations"
                />
                {selectedInboxIds.length > 0 ? (
                  <>
                    <span className="text-xs text-muted-foreground">
                      {t("conversations_inbox.list.selected_count", { count: selectedInboxIds.length })}
                    </span>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-7 px-2 text-xs ml-auto" data-testid="bulk-actions-trigger">
                          <ListFilter size={12} className="mr-1" /> {t("conversations_inbox.list.actions")}
                          <ChevronDown size={12} className="ml-1" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start" className="bg-white dark:bg-background">
                        {(activeTab === "all" || activeTab === "queue" || activeTab === "upcoming") && (
                          <DropdownMenuItem
                            onClick={() => bulkStatusMutation.mutate({ ids: selectedInboxIds, action: "COMPLETED" })}
                          >
                            <CheckCircle size={14} className="mr-2" /> {t("conversations_inbox.list.mark_as_done")}
                          </DropdownMenuItem>
                        )}
                        {(activeTab === "all" || activeTab === "upcoming") && (
                          <DropdownMenuItem
                            onClick={() => {
                              setBulkSnoozeUntil("");
                              setBulkSnoozeOpen(true);
                            }}
                          >
                            <Clock size={14} className="mr-2" /> {t("conversations_inbox.list.snooze")}
                          </DropdownMenuItem>
                        )}
                        {canAssignConversations && (
                          <DropdownMenuItem
                            onClick={() => {
                              setBulkAssignAgent("");
                              setBulkAssignOpen(true);
                            }}
                          >
                            <User size={14} className="mr-2" /> {t("conversations_inbox.list.assign_conversations")}
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem
                          onClick={() => bulkStatusMutation.mutate({ ids: selectedInboxIds, action: "READ" })}
                        >
                          <Eye size={14} className="mr-2" /> {t("conversations_inbox.list.mark_read")}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => bulkStatusMutation.mutate({ ids: selectedInboxIds, action: "UNREAD" })}
                        >
                          <EyeOff size={14} className="mr-2" /> {t("conversations_inbox.list.mark_unread")}
                        </DropdownMenuItem>
                        {!blockDeletingChats && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-red-600 focus:text-red-600"
                              onClick={() => {
                                if (window.confirm(t("conversations_inbox.list.delete_confirm", { count: selectedInboxIds.length })))
                                  bulkDeleteMutation.mutate(selectedInboxIds);
                              }}
                            >
                              <Trash2 size={14} className="mr-2" /> {t("conversations_inbox.list.delete_chat")}
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </>
                ) : (
                  <span className="text-xs text-muted-foreground">{t("conversations_inbox.list.select_all")}</span>
                )}
              </div>
            )}

            <ScrollArea className="flex-1 overflow-auto">
              <div className="space-y-1 px-2 pb-4">
                {getFilteredConversations().length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <Search className="w-8 h-8 text-muted-foreground mb-2" />
                    <p className="text-sm text-muted-foreground">{t("conversations_inbox.list.no_conversations")}</p>
                  </div>
                ) : (
                  getFilteredConversations().map((conv: Conversation) => (
                    <div
                      key={conv.id}
                      className={`group p-3 rounded-md cursor-pointer transition-colors ${selectedConversation === conv.id ? "bg-accent" : "hover:bg-muted/50"
                        }`}
                      onClick={() => handleSelectConversation(conv.id)}
                      data-testid={`conversation-${conv.id}`}
                    >
                      <div className="flex items-start gap-4">
                        {/* Bulk-select checkbox — visible on hover, or always once
                            selection mode is active (replyagent per-item checkbox). */}
                        <div className="self-center" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            className={`h-4 w-4 rounded border-input text-primary cursor-pointer transition-opacity ${
                              selectedInboxIds.length > 0 || selectedInboxIds.includes(conv.id)
                                ? "opacity-100"
                                : "opacity-0 group-hover:opacity-100"
                            }`}
                            checked={selectedInboxIds.includes(conv.id)}
                            onChange={() => toggleInboxSelection(conv.id)}
                            data-testid={`select-conversation-${conv.id}`}
                          />
                        </div>
                        <div className="w-10 h-10 relative">
                          <Avatar className="absolute">
                            <AvatarFallback className={getAvatarColor(getDisplayName(conv))}>
                              {(() => {
                                const displayName = getDisplayName(conv);
                                const parts = displayName.trim().split(/\s+/).filter((p: string) => p.length > 0);
                                if (parts.length === 0) return "U";
                                if (parts.length === 1) return parts[0][0].toUpperCase();
                                return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
                              })()}
                            </AvatarFallback>
                          </Avatar>
                          {/* Channel Icon Badge */}
                          <span className="absolute bottom-0 -right-1 block">
                            {conv.channel === "whatsapp" && (
                              <img src="/images/automations/whatsapp.svg" alt="WhatsApp" className="w-4 h-4" />
                            )}
                            {conv.channel === "instagram" && (
                              <img src="/images/automations/instagram.svg" alt="Instagram" className="w-4 h-4" />
                            )}
                            {conv.channel === "messenger" && (
                              <img src="/images/automations/messenger.svg" alt="Messenger" className="w-4 h-4" />
                            )}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1 gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className={`text-sm truncate ${getPendingMessagesCount(conv) > 0 ? "font-bold" : " font-semibold"}`}>{getDisplayName(conv)}</span>
                              {activeTab === "all" && (
                                <Badge
                                  variant="outline"
                                  className={`text-xs flex-shrink-0 ${conv.status === "queued" ? "bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-300 dark:border-yellow-800" :
                                    conv.status === "active" ? "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800" :
                                      conv.status === "completed" ? "bg-green-50 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800" :
                                        "bg-red-50 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800"
                                    }`}
                                >
                                  {conv.status}
                                </Badge>
                              )}
                            </div>
                            <span className="text-xs text-muted-foreground flex-shrink-0">{formatConversationTime(conv.time, workspaceTz)}</span>
                          </div>
                          <p className="text-sm truncate mb-1 font-normal text-muted-foreground" style={{ maxWidth: `${sidebarWidth - 96}px` }}>{conv.lastMessage}</p>
                          {/* Per-row WhatsApp number badge (M19) — only when the
                              workspace has more than one number, so the agent can
                              tell which number a chat arrived on. */}
                          {conv.channelNumber?.phone_number && waFilterNumbers.length > 1 && (
                            <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground bg-muted/60 rounded px-1.5 py-0.5 mb-1 max-w-full truncate">
                              <img src="/images/automations/whatsapp.svg" alt="WA" className="w-3 h-3 flex-shrink-0" />
                              <span className="truncate">{conv.channelNumber.name || conv.channelNumber.phone_number}</span>
                            </span>
                          )}
                          {/* Footer row (replyagent): assignee on the left
                              ("Waiting for assistance" when unassigned) + a
                              New/Transferred badge on the right. */}
                          <div className="flex items-center justify-between gap-2">
                            {conv.assignedAgent ? (
                              <p className="text-xs text-muted-foreground truncate">
                                {t("conversations_inbox.list.assigned_to")} <span className="font-medium">{conv.assignedAgentName || getAgentName(conv.assignedAgent)}</span>
                              </p>
                            ) : (
                              <span className="flex items-center gap-1 text-xs text-red-600">
                                <span className="h-1.5 w-1.5 rounded-full bg-red-600" />
                                {t("conversations_inbox.list.waiting_for_assistance")}
                              </span>
                            )}
                            {conv.unread > 0 ? (
                              <span className="flex items-center gap-1 text-[11px] text-red-600 flex-shrink-0">
                                <span className="h-1.5 w-1.5 rounded-full bg-red-600" /> {t("conversations_inbox.list.new")}
                              </span>
                            ) : conv.isAssigned ? (
                              <span className="text-[11px] text-amber-600 flex-shrink-0">{t("conversations_inbox.list.transferred")}</span>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                )}

                {/* Load more (replyagent next_page) — grows the page size while
                    the workspace total exceeds what we've fetched. */}
                {(inboxResponse?.total ?? 0) > listLimit && (
                  <button
                    onClick={() => setListLimit((l) => l + 20)}
                    className="w-full py-2 text-center text-xs text-muted-foreground hover:text-foreground hover:underline"
                    data-testid="load-more-conversations"
                  >
                    {isLoadingInbox ? t("conversations_inbox.list.loading") : t("conversations_inbox.list.load_more")}
                  </button>
                )}
              </div>
            </ScrollArea>
          </Card>

          {/* Resize handle — a thin bar, same minimal style as the composer's
              drag handle, not a chunky dotted button. */}
          <div
            onMouseDown={handleMouseDown}
            className={`absolute w-1.5 h-10 rounded-full transition-colors z-10 ${isDragging
              ? "bg-primary"
              : "bg-slate-300 dark:bg-slate-700 hover:bg-slate-400 dark:hover:bg-slate-600"
              }`}
            style={{ cursor: "col-resize", right: "-4px", top: "50%", transform: "translateY(-50%)" }}
            title={t("conversations_inbox.list.drag_to_resize")}
          />
        </div>

        {/* Main Content Area */}
        {
          selectedConversation ? (
            isLoadingInbox && !selectedConvObj ? (
              // Conversations still loading after refresh — show skeleton to avoid "Unknown" flash
              <Card className="flex-1 flex flex-col border-l-0 rounded-none items-center justify-center">
                <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
              </Card>
            ) : (
            <Card className="flex-1 flex flex-col border-l-0 rounded-none">
              <CardHeader className="flex-row items-center justify-between space-y-0 pb-4">
                <div className="flex items-center gap-2">
                  {/* Folder ▾ — move THIS conversation into / out of a folder
                      (replyagent header Folder dropdown). */}
                  <DropdownMenu>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="hover-elevate gap-1.5" data-testid="button-folder">
                            <FolderIcon size={16} />
                            <span className="text-xs font-medium">{t("conversations_inbox.header.folder")}</span>
                            <ChevronDown size={12} />
                          </Button>
                        </DropdownMenuTrigger>
                      </TooltipTrigger>
                      <TooltipContent>{t("conversations_inbox.header.move_to_folder")}</TooltipContent>
                    </Tooltip>
                    <DropdownMenuContent align="end" className="bg-white dark:bg-background max-h-72 overflow-auto">
                      <DropdownMenuItem
                        className={!selectedConvObj?.folderId ? "font-semibold text-primary" : ""}
                        onClick={() =>
                          selectedConversation &&
                          moveToFolderMutation.mutate({ id: selectedConversation, folderId: null })
                        }
                      >
                        {t("conversations_inbox.header.no_folder")}
                      </DropdownMenuItem>
                      {folders.length === 0 ? (
                        <DropdownMenuItem disabled>{t("conversations_inbox.header.no_folders_yet")}</DropdownMenuItem>
                      ) : (
                        folders.map((f: any) => (
                          <DropdownMenuItem
                            key={String(f.id)}
                            className={selectedConvObj?.folderId === String(f.id) ? "font-semibold text-primary" : ""}
                            onClick={() =>
                              selectedConversation &&
                              moveToFolderMutation.mutate({ id: selectedConversation, folderId: String(f.id) })
                            }
                          >
                            {f.name}
                          </DropdownMenuItem>
                        ))
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                  {/* Message-mode filter ▾ (replyagent): Smart flow & Inbox /
                      Smart flow messages / Inbox messages. */}
                  <DropdownMenu>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="hover-elevate gap-1.5" data-testid="button-chat-mode">
                            <ListFilter size={16} />
                            <span className="text-xs font-medium">
                              {t(CHAT_MODES.find((m) => m.value === chatMode)?.labelKey ?? CHAT_MODES[0].labelKey)}
                            </span>
                            <ChevronDown size={12} />
                          </Button>
                        </DropdownMenuTrigger>
                      </TooltipTrigger>
                      <TooltipContent>{t("conversations_inbox.header.filter_messages")}</TooltipContent>
                    </Tooltip>
                    <DropdownMenuContent align="end" className="bg-white dark:bg-background">
                      {CHAT_MODES.map((m) => (
                        <DropdownMenuItem
                          key={m.value}
                          className={chatMode === m.value ? "font-semibold text-primary gap-2" : "gap-2"}
                          onClick={() => setChatMode(m.value)}
                        >
                          <m.icon size={16} />
                          {t(m.labelKey)}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                <div className="flex items-center gap-2">
                  {/* Mark as Done / Move to Inbox toggle — mirrors replyagent behaviour:
                      active/unassigned → "Mark as done" (COMPLETED)
                      completed         → "Move to Inbox" (ACTIVE)         */}
                  {selectedConversation && (() => {
                    const conv = conversations.find((c: Conversation) => c.id === selectedConversation);
                    const isDone = conv?.status === "completed";
                    const hasAgent = !!conv?.assignedAgent;
                    // replyagent reopen: done + agent → back to Inbox (ACTIVE);
                    // done + no agent → back to the unassigned queue.
                    const reopenStatus = hasAgent ? "active" : "unassigned";
                    const reopenLabel = hasAgent ? t("conversations_inbox.header.move_to_inbox") : t("conversations_inbox.header.move_to_unassigned");
                    return (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className={isDone
                              ? "hover-elevate gap-1.5 text-slate-500 dark:text-slate-400"
                              : "hover-elevate gap-1.5 text-emerald-600 dark:text-emerald-400"}
                            disabled={updateStatusMutation.isPending}
                            onClick={() => {
                              if (isDone) {
                                updateStatusMutation.mutate({ id: selectedConversation, status: reopenStatus });
                              } else {
                                updateStatusMutation.mutate({ id: selectedConversation, status: "completed" });
                                setAssignedAgent(null);
                              }
                            }}
                            data-testid="button-mark-done"
                          >
                            {isDone ? <CornerUpLeft size={16} /> : <CheckCircle size={16} />}
                            <span className="text-xs font-medium">{isDone ? reopenLabel : t("conversations_inbox.header.mark_as_done")}</span>
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>{isDone ? t("conversations_inbox.header.reopen_conversation") : t("conversations_inbox.header.close_conversation")}</TooltipContent>
                      </Tooltip>
                    );
                  })()}

                  {selectedConversation && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="hover-elevate" data-testid="button-more-options">
                          <MoreVertical size={18} />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="bg-white dark:bg-background">
                        {/* Unassign — read current user from auth instead of the
                            broken `=== "self"` sentinel. Available when the chat
                            is assigned to me. */}
                        {(() => {
                          const conv = conversations.find((c: Conversation) => c.id === selectedConversation);
                          // Compare by user ID (assignedAgent now stores the user's numeric ID string)
                          const isMine = !!currentUser.id && conv?.assignedAgent === currentUser.id;
                          return (
                            <DropdownMenuItem
                              onClick={() => {
                                if (selectedConversation) {
                                  assignAgentMutation.mutate({ agentId: "null" });
                                  setAssignedAgent(null);
                                }
                              }}
                              disabled={!isMine}
                              className={!isMine ? "opacity-50 cursor-not-allowed" : ""}
                            >
                              <UserX size={16} className="mr-2" />
                              {t("conversations_inbox.header.unassign_chat")}
                            </DropdownMenuItem>
                          );
                        })()}
                        <DropdownMenuSeparator />

                        {/* Snooze — opens datetime picker dialog */}
                        <DropdownMenuItem
                          onClick={() => setSnoozeDialogOpen(true)}
                        >
                          <Clock size={16} className="mr-2" />
                          {t("conversations_inbox.header.snooze_conversation")}
                        </DropdownMenuItem>

                        {/* Schedule Reminder — opens reminder dialog */}
                        <DropdownMenuItem
                          onClick={() => setReminderDialogOpen(true)}
                        >
                          <Clock size={16} className="mr-2" />
                          {t("conversations_inbox.header.schedule_reminder")}
                        </DropdownMenuItem>

                        {/* Delete conversation (soft delete) — hidden when the agent
                            holds `block_deleting_chats` (replyagent parity). */}
                        {!blockDeletingChats && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => {
                                if (selectedConversation) {
                                  deleteInboxMutation.mutate(selectedConversation);
                                }
                              }}
                              className="text-red-600 dark:text-red-400"
                            >
                              <Trash2 size={16} className="mr-2" />
                              {t("conversations_inbox.header.delete_conversation")}
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              </CardHeader>
              <Separator />



              <div
                ref={messagesEndRef}
                className={`flex-1 min-h-0 p-4 overflow-y-auto transition-opacity duration-150 bg-slate-50 dark:bg-slate-950 ${isChatVisible ? "opacity-100" : "opacity-0"}`}
                style={{ backgroundImage: "url(/images/chat-doodle-bg.svg)", backgroundRepeat: "repeat" }}
              >
                <div className="space-y-4">
                  {(messages || []).map((msg: Message, index: number, allMessages: Message[]) => {
                    // System message (replyagent note_action): centered divider pill.
                    if (msg.kind === "system") {
                      const toneClass =
                        msg.tone === "red" ? "text-red-600"
                        : msg.tone === "orange" ? "text-orange-500"
                        : msg.tone === "success" ? "text-emerald-600"
                        : "text-blue-600";
                      return (
                        <div key={msg.id} className="flex items-center gap-3 my-4" data-testid={`system-message-${msg.id}`}>
                          <div className="flex-1 border-t border-border" />
                          <span className={`px-1 text-xs text-center ${toneClass}`}>{msg.text}</span>
                          <div className="flex-1 border-t border-border" />
                        </div>
                      );
                    }
                    const showDateDivider = index === 0 || formatMessageDate(msg.time, workspaceTz) !== formatMessageDate(allMessages[index - 1].time, workspaceTz);
                    // Plain text (no media/template/location/etc) gets the
                    // WhatsApp treatment of the timestamp sitting inline at
                    // the end of the text instead of on its own line below.
                    const isPlainTextOnly = !!msg.text &&
                      !(msg.images && msg.images.length) &&
                      !(msg.attachments && msg.attachments.length) &&
                      !msg.video && !msg.audio && !msg.location &&
                      !(msg as any).vcards && !(msg as any).template && !msg.reply;
                    // Voice messages show their own sent-at time inline with
                    // the duration (inside VoiceMessagePlayer), so the bubble's
                    // separate bottom timestamp row is skipped for them too.
                    const hideBottomTimestamp = isPlainTextOnly || !!msg.audio;
                    const statusAndReactions = (
                      <>
                        {msg.from === "agent" && msg.status && (
                          msg.status === "failed" ? (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <a
                                  href="https://developers.facebook.com/docs/whatsapp/cloud-api/support/error-codes"
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <MessageStatusTick status={msg.status} />
                                </a>
                              </TooltipTrigger>
                              <TooltipContent className="max-w-xs break-words">
                                {msg.errorData || t("conversations_inbox.messages.failed_to_send")}
                              </TooltipContent>
                            </Tooltip>
                          ) : (
                            <MessageStatusTick status={msg.status} />
                          )
                        )}
                        {Array.isArray((msg as any).reactions) && (msg as any).reactions.map((r: any, ri: number) => (
                          <span key={ri} className="text-base leading-none">{r.reaction ?? r.emoji ?? ''}</span>
                        ))}
                      </>
                    );
                    return (
                      <React.Fragment key={msg.id}>
                        {showDateDivider && (
                          <div className="flex justify-center my-4">
                            <span className="bg-muted text-muted-foreground text-xs px-3 py-1 rounded-full">{formatMessageDate(msg.time, workspaceTz)}</span>
                          </div>
                        )}
                        <div className={`group/msg flex items-center gap-2 ${msg.from === "agent" ? "justify-end" : "justify-start"}`}>
                          {/* Incoming: contact avatar on the LEFT (replyagent). */}
                          {msg.from === "user" && (
                            <div className="self-end mb-5 flex-shrink-0">
                              <div className={`h-7 w-7 rounded-full flex items-center justify-center text-[10px] font-semibold text-white ${getAvatarColor(getDisplayName(selectedConvObj))}`} title={getDisplayName(selectedConvObj)}>
                                {getInitials(getDisplayName(selectedConvObj))}
                              </div>
                            </div>
                          )}

                          {/* Quick-react emoji — sits OUTSIDE the bubble on
                              hover, on whichever side has room (left of the
                              bubble for our own messages, right of it for the
                              customer's) — matches WhatsApp's own pattern.
                              Everything else (reply/copy/save/delete) lives in
                              the in-bubble chevron menu below. */}
                          {msg.from === "agent" && selectedConversation && (
                            <Popover open={reactionPickerFor === msg.id} onOpenChange={(open) => setReactionPickerFor(open ? msg.id : null)}>
                              <PopoverTrigger asChild>
                                <button
                                  onClick={(e) => e.stopPropagation()}
                                  className="opacity-0 group-hover/msg:opacity-100 transition-opacity h-7 w-7 flex items-center justify-center rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm hover:scale-110 transition-transform shrink-0 self-center"
                                  title={t("conversations_inbox.messages.add_reaction")}
                                  data-testid={`button-react-${msg.id}`}
                                >
                                  <Smile size={13} className="text-muted-foreground" />
                                </button>
                              </PopoverTrigger>
                              <PopoverContent side="top" align="end" sideOffset={8} collisionPadding={16} className="p-0 border-0 bg-transparent shadow-none w-auto">
                                <Picker
                                  data={data}
                                  onEmojiSelect={(emoji: any) => {
                                    reactMutation.mutate({ inboxId: selectedConversation, messageId: msg.id, reaction: emoji.native });
                                    setReactionPickerFor(null);
                                  }}
                                  theme="light"
                                  previewPosition="none"
                                  skinTonePosition="search"
                                  maxFrequentRows={1}
                                  perLine={8}
                                  set="native"
                                />
                              </PopoverContent>
                            </Popover>
                          )}

                          {/* WhatsApp-style bubble colors: our outgoing messages
                              (agent) are light green, the customer's incoming
                              messages are white — matching WhatsApp itself so
                              the two are visually unmistakable at a glance.
                              Compact padding/text (WhatsApp-tight, not roomy). */}
                          <div id={`message-${msg.id}`} className={`relative max-w-[70%] rounded-lg px-2.5 py-1.5 text-[14px] leading-snug ${msg.from === "user" ? "bg-white text-gray-900 dark:bg-slate-800 dark:text-slate-100 border border-black/5 dark:border-white/10" : "bg-[#dcf8c6] text-gray-900 dark:bg-emerald-900/40 dark:text-emerald-50"}`} data-testid={`message-${msg.id}`}>
                            {/* Message options — a single chevron trigger inside
                                the bubble corner (WhatsApp pattern), instead of
                                separate floating icons. Opens quick-react emojis
                                + Reply/Copy/Save as/Delete, whichever apply. */}
                            {selectedConversation && (
                              <div className="absolute top-1 right-1.5 opacity-0 group-hover/msg:opacity-100 transition-opacity z-10">
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <button
                                      onClick={(e) => e.stopPropagation()}
                                      className="h-5 w-5 flex items-center justify-center rounded-full hover:bg-black/10 dark:hover:bg-white/15"
                                      title={t("conversations_inbox.messages.more_options")}
                                      data-testid={`button-message-options-${msg.id}`}
                                    >
                                      <ChevronDown size={14} className="opacity-70" />
                                    </button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end" className="w-48 bg-white dark:bg-background">
                                    <div className="flex items-center justify-around px-1 py-1.5">
                                      {["👍", "❤️", "😂", "😮", "😢", "🙏"].map((emoji) => (
                                        <button
                                          key={emoji}
                                          onClick={() => reactMutation.mutate({ inboxId: selectedConversation, messageId: msg.id, reaction: emoji })}
                                          className="text-base leading-none hover:scale-125 transition-transform"
                                        >
                                          {emoji}
                                        </button>
                                      ))}
                                    </div>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem onClick={() => setReplyingTo(msg)}>
                                      <CornerUpLeft size={14} className="mr-2" /> {t("conversations_inbox.messages.reply_to_this")}
                                    </DropdownMenuItem>
                                    {msg.text && (
                                      <DropdownMenuItem
                                        onClick={() => {
                                          navigator.clipboard.writeText(msg.text || "");
                                          toast({ description: t("conversations_inbox.messages.copied") });
                                        }}
                                      >
                                        <Copy size={14} className="mr-2" /> {t("conversations_inbox.messages.copy")}
                                      </DropdownMenuItem>
                                    )}
                                    {msg.audio && (
                                      <DropdownMenuItem onClick={() => handleDownload(msg.audio!.url, msg.audio!.name || `voice-message-${msg.id}`)}>
                                        <Download size={14} className="mr-2" /> {t("conversations_inbox.messages.save_as")}
                                      </DropdownMenuItem>
                                    )}
                                    {canDeleteMessage && (
                                      <DropdownMenuItem
                                        className="text-red-600 focus:text-red-600"
                                        onClick={() => {
                                          const ch = conversations.find((c: Conversation) => c.id === selectedConversation)?.channel || "whatsapp";
                                          deleteMessageMutation.mutate({ messageId: msg.id, channel: ch });
                                        }}
                                      >
                                        <Trash2 size={14} className="mr-2" /> {t("conversations_inbox.messages.delete_message")}
                                      </DropdownMenuItem>
                                    )}
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </div>
                            )}

                            {/* Quoted reply — the message this one is replying to.
                                Click scrolls to the original bubble. */}
                            {msg.reply && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  document.getElementById(`message-${msg.reply!.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
                                }}
                                className="mb-2 w-full text-left rounded-md border-l-4 border-emerald-500 bg-black/5 dark:bg-white/10 px-2 py-1"
                                data-testid={`reply-quote-${msg.id}`}
                              >
                                <span className="block text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                                  {msg.reply.from === "agent" ? t("conversations_inbox.messages.you") : t("conversations_inbox.messages.customer")}
                                </span>
                                <span className="block text-[11px] text-muted-foreground truncate">{msg.reply.text}</span>
                              </button>
                            )}

                            {/* WhatsApp template preview card */}
                            {msg.template && <TemplateMessageCard template={msg.template} />}

                            {/* Location → Google Maps link card */}
                            {msg.location && (
                              <a
                                href={
                                  msg.location.name || msg.location.address
                                    ? `https://maps.google.com/maps/search/${encodeURIComponent([msg.location.name, msg.location.address].filter(Boolean).join(", "))}/@${msg.location.latitude},${msg.location.longitude},17z`
                                    : `https://maps.google.com/?q=${msg.location.latitude},${msg.location.longitude}`
                                }
                                target="_blank"
                                rel="noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="flex items-start gap-2 text-sm rounded-md border border-black/10 dark:border-white/10 bg-white/60 dark:bg-black/20 p-2 hover:bg-black/5 dark:hover:bg-white/5 min-w-[12rem] max-w-[18rem]"
                              >
                                <MapPin size={16} className="mt-0.5 text-red-500 flex-shrink-0" />
                                <span className="min-w-0">
                                  <span className="font-medium block truncate">{msg.location.name || t("conversations_inbox.messages.shared_location")}</span>
                                  {msg.location.address && <span className="text-xs text-muted-foreground block truncate">{msg.location.address}</span>}
                                  <span className="text-xs text-blue-600 dark:text-blue-400">{t("conversations_inbox.messages.open_in_maps")}</span>
                                </span>
                              </a>
                            )}

                            {/* Contacts (vCard) card(s) */}
                            {msg.vcards && (
                              <div className="space-y-2 min-w-[12rem] max-w-[18rem]">
                                {msg.vcards.map((c: any, ci: number) => (
                                  <div key={ci} className="rounded-md border border-black/10 dark:border-white/10 bg-white/60 dark:bg-black/20 p-2 text-sm">
                                    <div className="font-semibold flex items-center gap-2">
                                      <User size={14} />
                                      {c.name?.formatted_name ?? c.name?.first_name ?? t("conversations_inbox.messages.contact_fallback")}
                                    </div>
                                    {(c.phones || []).map((p: any, pi: number) => p?.phone && (
                                      <div key={pi} className="text-xs flex items-center gap-2 mt-1"><Phone size={11} />{p.phone}</div>
                                    ))}
                                    {(c.emails || []).map((e: any, ei: number) => e?.email && (
                                      <div key={ei} className="text-xs flex items-center gap-2 mt-1"><Mail size={11} />{e.email}</div>
                                    ))}
                                  </div>
                                ))}
                              </div>
                            )}

                            {isPlainTextOnly ? (
                              <p className="text-sm [overflow-wrap:anywhere]">
                                {msg.text}
                                <span className="inline-block w-14" />
                                <span className={`float-right inline-flex items-center gap-1 text-[11px] translate-y-1 ${msg.from === "agent" ? "text-gray-700 dark:text-slate-400" : "text-gray-600 dark:text-slate-500"}`}>
                                  {formatMessageTime(msg.time, workspaceTz)}
                                  {statusAndReactions}
                                </span>
                              </p>
                            ) : (
                              msg.text && <p className="text-sm">{msg.text}</p>
                            )}

                            {/* Images */}
                            {msg.images && msg.images.length > 0 && (
                              <div className="mt-2 space-y-2">
                                {msg.images.map((image: { url: string; name: string; size: number; thumb?: string | null }, idx: number) => (
                                  <div key={idx} className="space-y-1">
                                    <img
                                      src={image.thumb || image.url}
                                      alt={image.name}
                                      loading="lazy"
                                      className="max-w-full h-auto rounded max-h-64 object-cover cursor-pointer hover:opacity-90 transition-opacity"
                                      onClick={() => setPreviewImage(image.url)}
                                    />
                                    <div className="flex items-center justify-between gap-2 text-xs bg-black/10 dark:bg-white/10 rounded p-2">
                                      <div className="flex items-center gap-1 flex-1 min-w-0">
                                        <span className="truncate">{image.name}</span>
                                        <span className="opacity-70 flex-shrink-0">({(image.size / 1024).toFixed(1)}KB)</span>
                                      </div>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleDownload(image.url, image.name);
                                        }}
                                        className="text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
                                        title={t("conversations_inbox.messages.download_image")}
                                      >
                                        <Download size={14} />
                                      </button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}

                            {/* Attachments */}
                            {msg.attachments && msg.attachments.length > 0 && (
                              <div className="mt-2 space-y-1">
                                {msg.attachments.map((attachment: { url: string; name: string; size: number }, idx: number) => (
                                  <div key={idx} className="flex items-center justify-between gap-2 text-xs bg-black/10 dark:bg-white/10 rounded p-2">
                                    <div className="flex items-center gap-2 flex-1 min-w-0">
                                      <Paperclip size={12} className="flex-shrink-0" />
                                      <span className="truncate">{attachment.name}</span>
                                      <span className="opacity-70 flex-shrink-0">({(attachment.size / 1024).toFixed(1)}KB)</span>
                                    </div>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleDownload(attachment.url, attachment.name);
                                      }}
                                      className="text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
                                      title={t("conversations_inbox.messages.download_file")}
                                    >
                                      <Download size={14} />
                                    </button>
                                  </div>
                                ))}
                              </div>
                            )}

                            {/* Video */}
                            {msg.video && (
                              <div className="mt-2 text-xs bg-black/10 dark:bg-white/10 rounded overflow-hidden">
                                <video src={msg.video!.url} controls className="p-1 w-full max-h-64 object-contain bg-black/5" poster={msg.video!.thumbnail} />
                                <div className="flex items-center gap-2 p-2">
                                  <div className="flex items-center gap-1 flex-1 min-w-0">
                                    <div className="p-1 bg-black/10 rounded-full">
                                      <div className="ml-0.5 w-0 h-0 border-t-[3px] border-t-transparent border-l-[6px] border-l-current border-b-[3px] border-b-transparent"></div>
                                    </div>
                                    <span className="truncate">{msg.video!.name}</span>
                                    <span className="opacity-70 flex-shrink-0">({(msg.video!.size / 1024 / 1024).toFixed(1)}MB)</span>
                                  </div>
                                </div>
                              </div>
                            )}

                            {/* Voice message — custom WhatsApp-style waveform
                                player, sitting directly in the bubble. */}
                            {msg.audio && (
                              <div className="mt-1">
                                <VoiceMessagePlayer
                                  url={msg.audio!.url}
                                  timestampSlot={
                                    <span className={`flex items-center gap-1 text-[11px] ${msg.from === "agent" ? "text-gray-700 dark:text-slate-400" : "text-gray-600 dark:text-slate-500"}`}>
                                      {formatMessageTime(msg.time, workspaceTz)}
                                      {statusAndReactions}
                                    </span>
                                  }
                                />
                              </div>
                            )}

                            {!hideBottomTimestamp && (
                              <p className={`text-xs mt-1 flex items-center gap-1 flex-wrap ${msg.from === "agent" ? "justify-end text-gray-700 dark:text-slate-400" : "justify-end text-gray-600 dark:text-slate-500"}`}>
                                <span>{formatMessageTime(msg.time, workspaceTz)}</span>
                                {statusAndReactions}
                              </p>
                            )}
                          </div>

                          {/* Quick-react emoji for INCOMING (user) bubbles —
                              mirrors the agent-side one above, on the right. */}
                          {msg.from === "user" && selectedConversation && (
                            <Popover open={reactionPickerFor === msg.id} onOpenChange={(open) => setReactionPickerFor(open ? msg.id : null)}>
                              <PopoverTrigger asChild>
                                <button
                                  onClick={(e) => e.stopPropagation()}
                                  className="opacity-0 group-hover/msg:opacity-100 transition-opacity h-7 w-7 flex items-center justify-center rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm hover:scale-110 transition-transform shrink-0 self-center"
                                  title={t("conversations_inbox.messages.add_reaction")}
                                  data-testid={`button-react-${msg.id}`}
                                >
                                  <Smile size={13} className="text-muted-foreground" />
                                </button>
                              </PopoverTrigger>
                              <PopoverContent side="top" align="start" sideOffset={8} collisionPadding={16} className="p-0 border-0 bg-transparent shadow-none w-auto">
                                <Picker
                                  data={data}
                                  onEmojiSelect={(emoji: any) => {
                                    reactMutation.mutate({ inboxId: selectedConversation, messageId: msg.id, reaction: emoji.native });
                                    setReactionPickerFor(null);
                                  }}
                                  theme="light"
                                  previewPosition="none"
                                  skinTonePosition="search"
                                  maxFrequentRows={1}
                                  perLine={8}
                                  set="native"
                                />
                              </PopoverContent>
                            </Popover>
                          )}

                          {/* Outgoing: agent avatar (INBOX) or bot icon
                              (automation) on the RIGHT (replyagent). */}
                          {msg.from === "agent" && (
                            <div className="self-end mb-5 flex-shrink-0">
                              {msg.communicationMode && msg.communicationMode !== "INBOX" ? (
                                <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center" title={t("conversations_inbox.messages.sent_by_automation")}>
                                  <Bot size={14} className="text-primary" />
                                </div>
                              ) : (
                                <div className={`h-7 w-7 rounded-full flex items-center justify-center text-[10px] font-semibold text-white ${getAvatarColor(msg.senderName || t("conversations_inbox.messages.agent_fallback"))}`} title={msg.senderName || t("conversations_inbox.messages.agent_fallback")}>
                                  {getInitials(msg.senderName || t("conversations_inbox.messages.agent_fallback"))}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </React.Fragment>
                    );
                  })}
                </div>
              </div>
              <Separator />

              {/* Message Input or Assignment Prompt — gated by reply permission
                  (replyagent: isAssigned || canMessageUnassignedConversations) */}
              {profileData?.has_opted_in === false ? (
                /* Opted-out state (replyagent inbox.contact_opted_out) — the
                   contact has no channel_opts row, so no free-form messaging. */
                <div className="p-6 flex-shrink-0 bg-muted/30 flex flex-col items-center justify-center gap-3">
                  <AlertCircle className="w-6 h-6 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground text-center max-w-md">
                    {t("conversations_inbox.composer.opted_out")}
                  </p>
                </div>
              ) : canReply ? (
                <div className="p-4 flex-shrink-0 relative">
                  {/* Attached files preview */}
                  {(attachedFiles.length > 0 || attachedGalleryItems.length > 0 || recordedAudio) && (
                    <div className="mb-3 p-3 bg-muted rounded-lg space-y-2">
                      {attachedGalleryItems.map((item, index) => (
                        <div key={item.id} className="flex items-center justify-between gap-2 text-sm">
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            {item.thumb ? (
                              <img src={item.thumb} alt={item.name} className="w-7 h-7 rounded object-cover flex-shrink-0" />
                            ) : (
                              <Paperclip size={14} className="text-muted-foreground flex-shrink-0" />
                            )}
                            <span className="truncate text-foreground">{item.name}</span>
                            {item.size > 0 && <span className="text-xs text-muted-foreground flex-shrink-0">({(item.size / 1024).toFixed(1)}KB)</span>}
                          </div>
                          <button
                            onClick={() => setAttachedGalleryItems((prev) => prev.filter((_, i) => i !== index))}
                            className="text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
                          >
                            <X size={16} />
                          </button>
                        </div>
                      ))}
                      {attachedFiles.map((file, index) => (
                        <div key={index} className="flex items-center justify-between gap-2 text-sm">
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            {attachedImagePreviews[index] ? (
                              <img
                                src={attachedImagePreviews[index]!}
                                alt={file.name}
                                className="w-7 h-7 rounded object-cover flex-shrink-0"
                              />
                            ) : (
                              <Paperclip size={14} className="text-muted-foreground flex-shrink-0" />
                            )}
                            <span className="truncate text-foreground">{file.name}</span>
                            <span className="text-xs text-muted-foreground flex-shrink-0">({(file.size / 1024).toFixed(1)}KB)</span>
                          </div>
                          <button
                            onClick={() => removeAttachedFile(index)}
                            className="text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
                          >
                            <X size={16} />
                          </button>
                        </div>
                      ))}
                      {recordedAudio && (
                        <div className="flex items-center justify-between gap-2 text-sm">
                          <div className="flex items-center gap-2 flex-1">
                            <Mic size={14} className="text-muted-foreground" />
                            <span className="text-foreground">{t("conversations_inbox.messages.voice_message")}</span>
                            <span className="text-xs text-muted-foreground">({(recordedAudio.size / 1024).toFixed(1)}KB)</span>
                          </div>
                          <button
                            onClick={() => setRecordedAudio(null)}
                            className="text-muted-foreground hover:text-foreground transition-colors"
                          >
                            <X size={16} />
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Canned / quick responses (replyagent): no chips row — type
                      "/" to search all canned replies (popup below). */}

                  {/* "/" command popup — type "/" to search all canned replies. */}
                  {composeMode === "reply" && messageText.startsWith("/") && (() => {
                    const q = messageText.slice(1).toLowerCase();
                    const matches = cannedMessages.filter(
                      (c) => c.title.toLowerCase().includes(q) || c.text.toLowerCase().includes(q),
                    );
                    if (matches.length === 0) return null;
                    return (
                      <div className="absolute bottom-[5.5rem] left-4 right-4 z-40 max-h-60 overflow-auto rounded-md border bg-white dark:bg-slate-900 shadow-lg divide-y">
                        <div className="px-3 py-1.5 text-[10px] uppercase tracking-wide text-muted-foreground sticky top-0 bg-white dark:bg-slate-900">
                          {t("conversations_inbox.composer.canned_responses")}
                        </div>
                        {matches.map((c) => (
                          <button
                            key={c.id}
                            className="w-full text-left px-3 py-2 hover:bg-muted"
                            onClick={() => applyCanned(c)}
                            data-testid={`canned-option-${c.id}`}
                          >
                            <div className="text-sm font-medium truncate flex items-center gap-1">
                              {c.title || t("conversations_inbox.composer.untitled")}
                              {c.media.length > 0 && <Paperclip size={11} className="opacity-60" />}
                            </div>
                            {c.text && <div className="text-xs text-muted-foreground truncate">{c.text}</div>}
                          </button>
                        ))}
                      </div>
                    );
                  })()}

                  {/* WhatsApp 24h-window CTA. Meta only allows free-form
                      replies within 24h of the last INCOMING message; outside
                      that window agents must send an approved template. We
                      look at the most recent inbound message timestamp and
                      show the template CTA when > 24h have passed (and only
                      for WhatsApp conversations). */}
                  {(() => {
                    const conv = conversations.find((c: Conversation) => c.id === selectedConversation);
                    if (!conv || conv.channel !== 'whatsapp') return null;
                    const lastInbound = [...(messages ?? [])]
                      .reverse()
                      .find((m: Message) => m.from === 'user');
                    if (!lastInbound) return null;
                    const hoursSince = (Date.now() - new Date(lastInbound.time).getTime()) / (1000 * 60 * 60);
                    if (hoursSince <= 24) return null;
                    return (
                      <div className="mb-2 p-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50 rounded-md flex items-center gap-2">
                        <AlertCircle size={14} className="text-amber-600 flex-shrink-0" />
                        <p className="text-[11px] text-amber-700 dark:text-amber-300 flex-1">
                          {t("conversations_inbox.composer.whatsapp_window_notice", { hours: Math.floor(hoursSince) })}
                        </p>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs border-amber-300 hover:bg-amber-100"
                          onClick={() => setTemplateDialogOpen(true)}
                          data-testid="button-send-template"
                        >
                          {t("conversations_inbox.composer.send_template")}
                        </Button>
                      </div>
                    );
                  })()}

                  {/* Reply-to preview banner — shows when a specific message
                      was selected via the reply-arrow button. Click X to
                      cancel. The selected message snippet is sent along with
                      the next outbound so the recipient sees a reply quote. */}
                  {replyingTo && (
                    <div className="mb-2 p-2 bg-slate-50 dark:bg-slate-800/50 border-l-4 border-primary rounded-r flex items-start gap-2">
                      <CornerUpLeft size={14} className="text-primary flex-shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] font-semibold text-primary">
                          {replyingTo.from === "agent" ? t("conversations_inbox.composer.replying_to_your_message") : t("conversations_inbox.composer.replying_to_this_message")}
                        </p>
                        <p className="text-[11px] text-muted-foreground truncate">{replyingTo.text || t("conversations_inbox.composer.media_placeholder")}</p>
                      </div>
                      <button
                        onClick={() => setReplyingTo(null)}
                        className="text-muted-foreground hover:text-foreground flex-shrink-0"
                        title={t("conversations_inbox.composer.cancel_reply")}
                      >
                        <X size={14} />
                      </button>
                    </div>
                  )}

                  {/* Reply / Note tabs (mirrors replyagent). Note mode tags
                      the outgoing record with type='note' so it shows on the
                      thread as an internal annotation without sending to the
                      customer. */}
                  <div className="flex items-center gap-1.5 mb-2 text-xs font-semibold">
                    {(["reply", "note"] as const).map((m) => (
                      <button
                        key={m}
                        onClick={() => setComposeMode(m)}
                        className={`px-3 py-1.5 rounded-full transition-colors ${
                          composeMode === m
                            ? "bg-primary/10 text-primary"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                        data-testid={`tab-compose-${m}`}
                      >
                        {m === "reply" ? t("conversations_inbox.composer.reply_tab") : t("conversations_inbox.composer.note_tab")}
                      </button>
                    ))}
                    {composeMode === "note" && (
                      <span className="text-[10px] text-amber-600 ml-auto">
                        {t("conversations_inbox.composer.note_internal_hint")}
                      </span>
                    )}
                  </div>

                  {/* @mention popup — Note mode only. Shows while typing an
                      "@token" (no trailing space yet); picking inserts @Name. */}
                  {composeMode === "note" && (() => {
                    const at = messageText.lastIndexOf("@");
                    if (at === -1) return null;
                    const seg = messageText.slice(at + 1);
                    if (/\s/.test(seg)) return null; // token finished
                    const q = seg.toLowerCase();
                    const matches = agentOptions.filter((a) => a.name.toLowerCase().includes(q));
                    if (!matches.length) return null;
                    return (
                      <div className="absolute bottom-[3.5rem] left-4 z-40 w-64 max-h-48 overflow-auto rounded-md border bg-white dark:bg-slate-900 shadow-lg divide-y">
                        <div className="px-3 py-1.5 text-[10px] uppercase tracking-wide text-muted-foreground sticky top-0 bg-white dark:bg-slate-900">
                          {t("conversations_inbox.composer.mention_agent")}
                        </div>
                        {matches.slice(0, 8).map((a) => (
                          <button
                            key={a.id}
                            className="w-full text-left px-3 py-2 hover:bg-muted flex items-center gap-2"
                            onClick={() => insertMention(a)}
                            data-testid={`mention-option-${a.id}`}
                          >
                            {a.icon}
                            <span className="text-sm">{a.name}</span>
                          </button>
                        ))}
                      </div>
                    );
                  })()}

                  <div className={cn(
                    "relative border rounded-2xl transition-colors",
                    "[border-color:hsl(var(--input))]"
                  )}>
                    {/* Drag handle — grab and move up/down to resize the box. */}
                    <div
                      onMouseDown={handleComposerResizeStart}
                      title={t("conversations_inbox.composer.drag_to_resize")}
                      className="absolute -top-[3px] left-1/2 -translate-x-1/2 w-10 h-1.5 rounded-full bg-slate-300 dark:bg-slate-700 hover:bg-slate-400 dark:hover:bg-slate-600 cursor-row-resize z-10"
                    />

                    <Textarea
                      ref={composerTextareaRef}
                      placeholder={composeMode === "note" ? t("conversations_inbox.composer.note_placeholder") : t("conversations_inbox.composer.reply_placeholder")}
                      rows={1}
                      style={composerHeight ? { height: `${composerHeight}px` } : undefined}
                      className={cn(
                        "w-full !border-0 !shadow-none !ring-0 !ring-offset-0 focus-visible:!outline-none resize-none rounded-2xl rounded-b-none px-4 pt-4 pb-1 bg-transparent",
                        !composerHeight && "min-h-[2.5rem] max-h-40"
                      )}
                      data-testid="input-message"
                      value={messageText}
                      onChange={(e) => setMessageText(e.target.value)}
                      onPaste={(e) => {
                        const files = Array.from(e.clipboardData?.files ?? []);
                        if (files.length) {
                          e.preventDefault();
                          setAttachedFiles((prev) => [...prev, ...files]);
                        }
                      }}
                      onDrop={(e) => {
                        const files = Array.from(e.dataTransfer?.files ?? []);
                        if (files.length) {
                          e.preventDefault();
                          setAttachedFiles((prev) => [...prev, ...files]);
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          if (!sendMessageMutation.isPending) handleSendMessage();
                        }
                      }}
                    />

                    <div className="flex items-center justify-between px-2.5 pb-2 pt-0.5">
                      <div className="flex items-center gap-0.5">
                        {composeMode === "reply" ? (
                          <>
                            {/* "+" menu — attachments, gallery, sticker/location, start automation. */}
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-9 w-9" title={t("conversations_inbox.composer.more")} data-testid="composer-plus">
                                  <Plus size={18} />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="start" side="top" className="bg-white dark:bg-background">
                                <DropdownMenuItem onClick={() => fileInputRef.current?.click()}>
                                  <Paperclip size={14} className="mr-2" /> {t("conversations_inbox.composer.attach_file")}
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => setGalleryDialogOpen(true)}>
                                  <Image size={14} className="mr-2" /> {t("conversations_inbox.composer.media_gallery")}
                                </DropdownMenuItem>
                                {/* Sticker / Location — hidden for now (COMPOSER_STICKER_LOCATION_ENABLED),
                                    not deleted, so they're easy to re-enable later. */}
                                {COMPOSER_STICKER_LOCATION_ENABLED && selectedConvObj?.channel === "whatsapp" && (
                                  <DropdownMenuItem onClick={() => setStickerDialogOpen(true)}>
                                    <Smile size={14} className="mr-2" /> {t("conversations_inbox.composer.sticker")}
                                  </DropdownMenuItem>
                                )}
                                {COMPOSER_STICKER_LOCATION_ENABLED && selectedConvObj?.channel === "whatsapp" && (
                                  <DropdownMenuItem onClick={() => setLocationDialogOpen(true)}>
                                    <MapPin size={14} className="mr-2" /> {t("conversations_inbox.composer.location")}
                                  </DropdownMenuItem>
                                )}
                                <DropdownMenuItem onClick={() => setAutomationDialogOpen(true)}>
                                  <Bot size={14} className="mr-2" /> {t("conversations_inbox.composer.start_automation")}
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>

                            {/* Emoji */}
                            <div className="relative">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-9 w-9"
                                title={t("conversations_inbox.composer.add_emoji")}
                                onClick={() => setShowEmojiPicker((v) => !v)}
                              >
                                <Smile size={18} />
                              </Button>
                              {showEmojiPicker && (
                                <div ref={emojiPickerRef} className="absolute bottom-12 left-0 z-50">
                                  <Picker
                                    data={data}
                                    onEmojiSelect={handleEmojiSelect}
                                    theme="light"
                                    previewPosition="none"
                                    skinTonePosition="none"
                                    maxFrequentRows={1}
                                    perLine={8}
                                    set="native"
                                  />
                                </div>
                              )}
                            </div>

                            {/* AI helper — translate / correct / expand / shorten */}
                            <div className="relative">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-9 w-9"
                                title={t("conversations_inbox.composer.ai_helper")}
                                disabled={!messageText.trim() || transformAiMutation.isPending}
                                onClick={() => setAiTransformOpen((v) => !v)}
                              >
                                {transformAiMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <span className="text-xs font-bold">AI</span>}
                              </Button>
                              {aiTransformOpen && (
                                <div className="absolute bottom-12 left-0 z-50 bg-white dark:bg-slate-900 border rounded-md shadow-lg p-1 w-48">
                                  {[
                                    { mode: "correct", label: t("conversations_inbox.composer.correct") },
                                    { mode: "expand", label: t("conversations_inbox.composer.expand") },
                                    { mode: "shorten", label: t("conversations_inbox.composer.shorten") },
                                  ].map((opt) => (
                                    <button
                                      key={opt.mode}
                                      onClick={() => transformAiMutation.mutate({ text: messageText, mode: opt.mode })}
                                      className="w-full text-left text-xs px-2 py-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded"
                                    >
                                      {opt.label}
                                    </button>
                                  ))}
                                  <div className="border-t my-1" />
                                  <div className="px-2 py-1 text-[10px] uppercase tracking-wide text-muted-foreground">{t("conversations_inbox.composer.translate_to")}</div>
                                  <div className="max-h-44 overflow-auto">
                                    {AI_LANGUAGES.map((lang) => (
                                      <button
                                        key={lang}
                                        onClick={() => transformAiMutation.mutate({ text: messageText, mode: "translate", language: lang })}
                                        className="w-full text-left text-xs px-2 py-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded"
                                        data-testid={`ai-translate-${lang}`}
                                      >
                                        {lang}
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>

                            {/* Format text — bold / italic / strikethrough / monospace */}
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-9 w-9" title={t("conversations_inbox.composer.format_text")} data-testid="composer-format">
                                  <TypeIcon size={18} />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="start" className="bg-white dark:bg-background">
                                <DropdownMenuItem onClick={() => applyTextStyle("*")}><Bold size={14} className="mr-2" /> {t("conversations_inbox.composer.bold")}</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => applyTextStyle("_")}><Italic size={14} className="mr-2" /> {t("conversations_inbox.composer.italic")}</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => applyTextStyle("~")}><Strikethrough size={14} className="mr-2" /> {t("conversations_inbox.composer.strikethrough")}</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => applyTextStyle("```")}><Code size={14} className="mr-2" /> {t("conversations_inbox.composer.monospace")}</DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </>
                        ) : (
                          <>
                            {/* Note mode — lighter action set: emoji, picture, upload. No +/AI/mic. */}
                            <div className="relative">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-9 w-9"
                                title={t("conversations_inbox.composer.add_emoji")}
                                onClick={() => setShowEmojiPicker((v) => !v)}
                              >
                                <Smile size={18} />
                              </Button>
                              {showEmojiPicker && (
                                <div ref={emojiPickerRef} className="absolute bottom-12 left-0 z-50">
                                  <Picker
                                    data={data}
                                    onEmojiSelect={handleEmojiSelect}
                                    theme="light"
                                    previewPosition="none"
                                    skinTonePosition="none"
                                    maxFrequentRows={1}
                                    perLine={8}
                                    set="native"
                                  />
                                </div>
                              )}
                            </div>
                            <Button variant="ghost" size="icon" className="h-9 w-9" title={t("conversations_inbox.composer.send_picture")} onClick={() => imageInputRef.current?.click()}>
                              <Image size={18} />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-9 w-9" title={t("conversations_inbox.composer.attach_file")} onClick={() => fileInputRef.current?.click()}>
                              <Paperclip size={18} />
                            </Button>
                          </>
                        )}
                      </div>

                      <div className="flex items-center gap-1">
                        {composeMode === "reply" && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className={`h-9 w-9 ${isRecording ? "bg-red-100 text-red-600" : ""}`}
                            title={isRecording ? t("conversations_inbox.composer.stop_recording") : t("conversations_inbox.composer.send_voice_message")}
                            onClick={isRecording ? handleStopRecording : handleStartRecording}
                          >
                            <Mic size={18} />
                          </Button>
                        )}
                        <Button
                          size="sm"
                          className="gap-1.5 rounded-full"
                          data-testid="button-send"
                          onClick={handleSendMessage}
                          disabled={!messageText.trim() && attachedFiles.length === 0 && !recordedAudio}
                        >
                          <Send size={14} color="white" />
                          {composeMode === "note" ? t("conversations_inbox.composer.add_note_button") : t("conversations_inbox.composer.send_button")}
                        </Button>
                      </div>
                    </div>

                    {/* File / image attachment inputs — shared by both modes' menus. */}
                    <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleFileAttach} />
                    <input ref={imageInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleImageAttach} />
                  </div>
                </div>
              ) : (() => {
                // Locked state (replyagent): chat is held by ANOTHER agent and
                // we lack the unassigned-message permission → show who locked it.
                const lockedByOther =
                  !!selectedConvObj?.assignedAgent &&
                  !!currentUser.id &&
                  selectedConvObj.assignedAgent !== currentUser.id;
                const lockName = selectedConvObj?.assignedAgentName || getAgentName(selectedConvObj?.assignedAgent ?? null);
                return (
                  <div className="p-6 flex-shrink-0 bg-muted/30 flex flex-col items-center justify-center gap-3">
                    <AlertCircle className="w-6 h-6 text-muted-foreground" />
                    <div className="text-center">
                      {lockedByOther ? (
                        <>
                          <p className="text-sm font-medium text-foreground">
                            {t("conversations_inbox.locked.assigned_to_other", { name: lockName })}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {t("conversations_inbox.locked.only_assigned_can_reply")}
                          </p>
                        </>
                      ) : (
                        <>
                          <p className="text-sm font-medium text-foreground">{t("conversations_inbox.locked.assign_prompt_title")}</p>
                          <p className="text-xs text-muted-foreground mt-1">{t("conversations_inbox.locked.assign_prompt_desc")}</p>
                        </>
                      )}
                    </div>
                  </div>
                );
              })()}
            </Card>
            )
          ) : (
            <Card className="flex-1 flex flex-col items-center justify-center border-l-0 rounded-none">
              <div className="text-center">
                <h3 className="text-lg font-semibold mb-2">{t("conversations_inbox.header.select_conversation_title")}</h3>
                <p className="text-sm text-muted-foreground">{t("conversations_inbox.header.select_conversation_desc")}</p>
              </div>
            </Card>
          )
        }

        {/* Image Preview Modal */}
        <Dialog open={!!previewImage} onOpenChange={(open) => !open && setPreviewImage(null)}>
          <DialogContent className="[&>button]:hidden w-auto h-auto max-w-none p-0 overflow-hidden bg-transparent border-none shadow-none flex items-center justify-center">
            {previewImage && (
              <div className="relative">
                <img
                  src={previewImage}
                  alt="Preview"
                  className="max-w-[80vw] max-h-[80vh] w-auto h-auto object-contain rounded-lg shadow-2xl"
                />
                <button
                  onClick={() => setPreviewImage(null)}
                  className="absolute top-2 right-2 p-2 bg-black/50 hover:bg-black/70 rounded-full text-white transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {
          selectedConversation && (
            <ContactProfileSidebar
              collapsed={!showContactPanel}
              conversation={conversations.find((c: Conversation) => c.id === selectedConversation)}
              conversations={conversations}
              basicDetails={currentBasicDetails}
              onUpdateBasicDetails={handleUpdateBasicDetails}
              assignedAgent={assignedAgent}
              onAssignAgent={handleAssignAgent}
              canAssignConversations={canAssignConversations}
              canSeeChannels={canSeeChannels}
              canViewProfile={canViewProfile}
              agentOptions={agentOptions}
              involvedTeams={involvedTeamsByConv[selectedConversation || 0]}
              onUpdateInvolvedTeams={handleUpdateInvolvedTeams}
              teamOptions={teamOptions}
              tags={tagsByConv[conversations.find((c: Conversation) => c.id === selectedConversation)?.id || 0] || []}
              onUpdateTags={handleUpdateTags}
              tagOptions={tagOptions}
              profileCustomFields={profileFieldsByConv[selectedConversation || 0] || []}
              onSaveCustomFieldValue={handleSaveCustomFieldValue}
              customAttributes={customAttributesByConv[conversations.find((c: Conversation) => c.id === selectedConversation)?.id || 0] || {}}
              onUpdateCustomAttributes={handleUpdateCustomAttributes}
              notes={notesByConv[conversations.find((c: Conversation) => c.id === selectedConversation)?.id || 0] || []}
              onUpdateNotes={handleUpdateNotes}
              messages={messages || []}
              onScrollToMessage={handleScrollToMessage}
              profileData={profileData}
              onRefreshProfile={() => refetchProfileData()}
              onClose={handleToggleContactPanel}
            />
          )
        }







        {/* Filter Modal */}
        <Dialog open={isFilterModalOpen} onOpenChange={setIsFilterModalOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader className="mb-2">
              <DialogTitle>{t("conversations_inbox.dialogs.filter.title")}</DialogTitle>
            </DialogHeader>

            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">{t("conversations_inbox.dialogs.filter.team")}</label>
                <CustomDropdown
                  options={teamOptions}
                  selected={filterTeams}
                  onChange={setFilterTeams}
                  placeholder={t("conversations_inbox.dialogs.filter.select_teams")}
                  width="100%"
                />
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">{t("conversations_inbox.dialogs.filter.agent")}</label>
                <CustomDropdown
                  options={agentOptions}
                  selected={filterAgents}
                  onChange={setFilterAgents}
                  placeholder={t("conversations_inbox.dialogs.filter.select_agents")}
                  width="100%"
                />
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">{t("conversations_inbox.dialogs.filter.status")}</label>
                <CustomDropdown
                  options={[]}
                  selected={filterStatus}
                  onChange={setFilterStatus}
                  placeholder={t("conversations_inbox.dialogs.filter.select_status")}
                  width="100%"
                />
              </div>
            </div>

            <DialogFooter className="mt-2">
              <Button variant="ghost" onClick={() => setIsFilterModalOpen(false)} className="bg-white dark:bg-background border border-input dark:border-slate-700 hover:bg-accent dark:hover:bg-slate-700 font-normal">
                {t("conversations_inbox.dialogs.filter.cancel")}
              </Button>
              <Button onClick={() => setIsFilterModalOpen(false)} className="btn-outline-primary font-normal" variant="outline">
                {t("conversations_inbox.dialogs.filter.apply")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Make Outbound Call Modal */}
        <Dialog open={isMakeCallModalOpen} onOpenChange={setIsMakeCallModalOpen}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader className="mb-2">
              <DialogTitle>{t("conversations_inbox.dialogs.make_call.title")}</DialogTitle>
            </DialogHeader>

            {/* Tabs */}
            <div className="flex gap-4 border-b">
              <button
                onClick={() => {
                  setMakeCallTab("make-call");
                }}
                className={`pb-2 px-1 text-sm font-medium border-b-2 transition-colors ${makeCallTab === "make-call"
                  ? "border-b-primary text-foreground"
                  : "border-b-transparent text-muted-foreground hover:text-foreground"
                  }`}
              >
                {t("conversations_inbox.dialogs.make_call.make_call_tab")}
              </button>
              <button
                onClick={() => setMakeCallTab("search-contacts")}
                className={`pb-2 px-1 text-sm font-medium border-b-2 transition-colors ${makeCallTab === "search-contacts"
                  ? "border-b-primary text-foreground"
                  : "border-b-transparent text-muted-foreground hover:text-foreground"
                  }`}
              >
                {t("conversations_inbox.dialogs.make_call.search_contacts_tab")}
              </button>
            </div>

            {/* Make Call Tab */}
            {makeCallTab === "make-call" && (
              <div>
                <div>
                  <p className="text-sm text-muted-foreground mb-4">
                    {t("conversations_inbox.dialogs.make_call.description")}{" "}
                    <a href="https://developers.facebook.com/docs/whatsapp/cloud-api/calling/pricing" target="_blank" rel="noopener noreferrer" className="underline text-primary hover:text-primary/80">
                      {t("conversations_inbox.dialogs.make_call.meta_pricing_policies")}
                    </a>
                  </p>
                </div>

                {!(hasCallPermission && selectedContact) && (
                  <div>
                    <label className="text-sm font-medium">{t("conversations_inbox.dialogs.make_call.phone_label")}</label>
                    <div className="flex gap-2 mt-1 mb-4">
                      <Input
                        placeholder="+1 (555) 000-0000"
                        value={phoneNumber}
                        onChange={(e) => setPhoneNumber(e.target.value)}
                        className="border-input w-full"
                      />

                      <Button onClick={handleCheckPermission} className="h-9 btn-outline-primary font-normal" variant="outline" disabled={!phoneNumber.trim()}>
                        {t("conversations_inbox.dialogs.make_call.check_permission")}
                      </Button>
                    </div>
                  </div>
                )}

                {callPermissionChecked && (
                  <div className="space-y-4">
                    {hasCallPermission && selectedContact ? (
                      <div className="border border-input rounded-lg p-4 space-y-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <Avatar>
                              <AvatarFallback className={getAvatarColor(selectedContact.name)}>
                                {selectedContact.name.split(" ").map((n: string) => n[0]).join("").toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="font-medium text-sm">{selectedContact.name}</p>
                              <p className="text-xs text-muted-foreground">{selectedContact.number}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-xs font-medium text-green-600">{t("conversations_inbox.dialogs.make_call.contact_found")}</p>
                          </div>
                        </div>
                      </div>
                    ) : (

                      <div className="p-4 bg-red-50 border border-red-200 rounded-lg dark:bg-red-900/30 dark:border-red-800">
                        <p className="text-sm text-red-800 dark:text-red-300">
                          <strong>{t("conversations_inbox.dialogs.make_call.contact_not_found")}</strong> - {t("conversations_inbox.dialogs.make_call.contact_not_found_desc")}
                        </p>
                      </div>
                    )}
                  </div>
                )}

                <div className="flex items-center justify-between pt-4 border-t">
                  <Button variant="outline" onClick={() => {
                    setPhoneNumber("");
                    setCallPermissionChecked(false);
                    setHasCallPermission(false);
                    setSelectedContact(null);
                    setLimitReached(false);
                  }} className="[border-color:hsl(var(--input))]">
                    {t("conversations_inbox.dialogs.make_call.clear")}
                  </Button>
                  <Button
                    disabled={!hasCallPermission || !callPermissionChecked || limitReached}
                    onClick={() => {
                      setIsCallActive(true);
                      setCallPhoneNumber(selectedContact?.number || phoneNumber);
                      setCallContactName(selectedContact?.name || "");
                      setCallDuration(0);
                      setIsMuted(false);
                      setIsSpeakerOn(false);
                      setIsMakeCallModalOpen(false);
                    }}
                    className="btn-outline-primary font-normal" variant="outline"
                  >
                    {t("conversations_inbox.dialogs.make_call.call")}
                  </Button>
                </div>
              </div>
            )}

            {/* Search Contacts Tab */}
            {makeCallTab === "search-contacts" && (
              <div className="space-y-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder={t("conversations_inbox.dialogs.make_call.search_placeholder")}
                    value={searchContactsQuery}
                    onChange={(e) => setSearchContactsQuery(e.target.value)}
                    className="border-input pl-9"
                  />
                </div>

                <ScrollArea className="h-64 border border-input rounded-lg">
                  <div className="space-y-2 p-3">
                    {callContacts.length === 0 && (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        {searchContactsQuery.trim() ? t("conversations_inbox.dialogs.make_call.no_contacts_found") : t("conversations_inbox.dialogs.make_call.type_to_search")}
                      </p>
                    )}
                    {callContacts.map((contact: any) => {
                        const name = contact.full_name || `${contact.first_name || ""} ${contact.last_name || ""}`.trim() || "Unknown";
                        const number = contact.full_mobile_number || contact.mobile_number || "";
                        const initials = name.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2) || "?";
                        return (
                        <div
                          key={contact.id}
                          onClick={() => {
                            setSelectedContact({ id: Number(contact.id), name, number, callConsent: "Active" });
                            setPhoneNumber(number);
                            setCallPermissionChecked(true);
                            setHasCallPermission(true);
                          }}
                          className={`p-4 border rounded-lg cursor-pointer hover:bg-muted/50 transition-colors ${selectedContact?.id === Number(contact.id)
                            ? "border-primary bg-primary/10"
                            : "border-input"
                            }`}
                        >
                          <div className="flex gap-2">
                            {/* Left: Avatar */}
                            <Avatar className="h-11 w-11 flex-shrink-0">
                              <AvatarFallback className={getAvatarColor(name)}>
                                {initials}
                              </AvatarFallback>
                            </Avatar>

                            {/* Right: Name/Badge and Tries/Expires */}
                            <div className="flex-1 space-y-1">
                              {/* Row 1: Name and Badge */}
                              <div className="flex items-center justify-between">
                                <p className="font-medium text-sm">{name}</p>
                                <div className="px-2 py-1 rounded text-xs font-medium bg-green-100 text-green-700">
                                  {t("conversations_inbox.dialogs.make_call.found_badge")}
                                </div>
                              </div>
                              <p className="text-xs text-muted-foreground">{number || t("conversations_inbox.dialogs.make_call.no_number_on_file")}</p>
                            </div>
                          </div>
                        </div>
                        );
                      })}
                  </div>
                </ScrollArea>

                <div className="flex items-center justify-between pt-4 border-t">
                  <Button variant="outline" onClick={() => {
                    setPhoneNumber("");
                    setCallPermissionChecked(false);
                    setHasCallPermission(false);
                    setSelectedContact(null);
                    setSearchContactsQuery("");
                    setLimitReached(false);
                  }} className="[border-color:hsl(var(--input))]">
                    {t("conversations_inbox.dialogs.make_call.clear")}
                  </Button>
                  <Button
                    disabled={!selectedContact}
                    onClick={() => {
                      if (selectedContact) {
                        setIsCallActive(true);
                        setCallPhoneNumber(selectedContact.number);
                        setCallContactName(selectedContact.name);
                        setCallDuration(0);
                        setIsMuted(false);
                        setIsSpeakerOn(false);
                        setIsMakeCallModalOpen(false);
                      }
                    }}
                    className="btn-outline-primary font-normal" variant="outline"
                  >
                    {t("conversations_inbox.dialogs.make_call.call")}
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Send Template Message Modal */}
        <Dialog open={isTemplateMessageModalOpen} onOpenChange={setIsTemplateMessageModalOpen}>
          <DialogContent className="sm:max-w-3xl flex flex-col">
            <DialogHeader className="mb-2">
              <DialogTitle>{t("conversations_inbox.dialogs.template_message.title")}</DialogTitle>
            </DialogHeader>

            <div className="flex-1 overflow-y-auto -ml-1">
              <div className="grid grid-cols-2 gap-6">
                {/* Left: Phone Numbers and Template Selection */}
                <div className="space-y-4 pl-1">
                  <div>
                    <label className="text-sm font-medium mb-2 block">{t("conversations_inbox.dialogs.template_message.recipients_label")}<span className="text-red-500 pl-0.5">*</span></label>
                    <div className="space-y-2">
                      {templatePhoneNumbers.map((phone, index) => (
                        <div key={index} className="flex gap-2 items-center">
                          <Input
                            placeholder={`+1 (555) 000-${String(index).padStart(4, "0")}`}
                            value={phone}
                            onChange={(e) => {
                              const newNumbers = [...templatePhoneNumbers];
                              newNumbers[index] = e.target.value;
                              setTemplatePhoneNumbers(newNumbers);
                            }}
                            className="border-input flex-1"
                          />
                          {templatePhoneNumbers.length > 1 && (
                            <button
                              onClick={() => {
                                const newNumbers = templatePhoneNumbers.filter((_, i) => i !== index);
                                setTemplatePhoneNumbers(newNumbers);
                              }}
                              className="text-muted-foreground hover:text-foreground transition-colors border-[]"
                            >
                              <X size={18} />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>

                    {/* Add another recipient button */}
                    {templatePhoneNumbers.length < 5 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="mt-2 text-xs"
                        disabled={templatePhoneNumbers.some(p => p.trim() === "")}
                        onClick={() => {
                          setTemplatePhoneNumbers([...templatePhoneNumbers, ""]);
                        }}
                      >
                        <Plus size={14} className="mr-1" />
                        {t("conversations_inbox.dialogs.template_message.add_recipient")}
                      </Button>
                    )}
                  </div>

                  <div>
                    <label className="text-sm font-medium mb-2 block">{t("conversations_inbox.dialogs.template_message.template_label")}<span className="text-red-500 pl-0.5">*</span></label>
                    <div className="space-y-3">
                      <CustomDropdown
                        options={broadcastTemplates.map(t => ({ id: String(t.id), name: t.name }))}
                        selected={selectedTemplate ? [String(selectedTemplate.id)] : []}
                        onChange={(selected) => {
                          if (selected.length > 0) {
                            const template = broadcastTemplates.find(t => String(t.id) === selected[0]);
                            if (template) {
                              setSelectedTemplate(template);
                              setTemplateVariables({});
                            }
                          }
                        }}
                        placeholder={t("conversations_inbox.dialogs.template_message.select_template")}
                        width="100%"
                        showSelectedOption={true}
                      />
                      {broadcastTemplates.length === 0 && (
                        <p className="text-sm text-muted-foreground">
                          {t("conversations_inbox.dialogs.template_message.no_templates")}{" "}
                          <a
                            href="/template-manager"
                            className="text-primary underline hover:no-underline"
                          >
                            {t("conversations_inbox.dialogs.template_message.go_to_template_manager")}
                          </a>
                          {" "}{t("conversations_inbox.dialogs.template_message.to_create_one")}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Variable inputs */}
                  {selectedTemplate && selectedTemplate.variables && selectedTemplate.variables.length > 0 && (
                    <div>
                      <label className="text-sm font-medium block pt-2">{t("conversations_inbox.dialogs.template_message.customize_variables")}</label>
                      <div className="space-y-2">
                        {selectedTemplate.variables.map((variable: string, index: number) => (
                          <div key={index} className="space-y-1">
                            <label className="text-xs font-medium text-gray-600">{variable}</label>
                            <Input
                              placeholder={t("conversations_inbox.dialogs.template_message.enter_variable", { variable })}
                              value={templateVariables[variable] || ""}
                              onChange={(e) => {
                                setTemplateVariables({
                                  ...templateVariables,
                                  [variable]: e.target.value
                                });
                              }}
                              className="border-input text-sm h-9"
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Right: Template Preview */}
                <div className="flex flex-col items-center">
                  <label className="text-sm font-medium mb-3 block self-start">{t("conversations_inbox.dialogs.template_message.preview_label")}</label>
                  <div className="h-full max-h-[62vh] w-full max-w-[31vh]">
                    <PreviewV2
                      mode="chat"
                      headerText={selectedTemplate?.header || ""}
                      bodyText={selectedTemplate?.body || ""}
                      footerText={selectedTemplate?.footer || ""}
                      templateButtons={selectedTemplate?.buttons || []}
                      variableSamples={templateVariables}
                      placeholderText={t("conversations_inbox.dialogs.template_message.preview_placeholder")}
                    />
                  </div>
                  <p className="text-[10px] py-1">{t("conversations_inbox.dialogs.template_message.preview_disclaimer")}</p>
                </div>
              </div>
            </div>

            <div className="border-t pt-4 px-4 flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                {t("conversations_inbox.dialogs.template_message.message_rates")}{" "}
                <a
                  href="https://developers.facebook.com/docs/whatsapp/cloud-api/calling/pricing"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  {t("conversations_inbox.dialogs.template_message.whatsapp_pricing")}
                </a>
                {" "}{t("conversations_inbox.dialogs.template_message.for_details")}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsTemplateMessageModalOpen(false);
                    setTemplatePhoneNumbers([""]);
                    setSelectedTemplate(null);
                    setTemplateVariables({});
                  }}
                  className="[border-color:hsl(var(--input))]"
                >
                  {t("conversations_inbox.dialogs.template_message.cancel")}
                </Button>
                <Button
                  disabled={
                    !selectedTemplate ||
                    templatePhoneNumbers.some(p => p.trim() === "") ||
                    (selectedTemplate?.variables && selectedTemplate.variables.length > 0 &&
                      !selectedTemplate.variables.every((v: string) => templateVariables[v]?.trim()))
                  }
                  onClick={handleSendTemplateMessage}
                  className="btn-outline-primary font-normal" variant="outline"
                >
                  {t("conversations_inbox.dialogs.template_message.send")}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Call UI Overlay */}
        {
          isCallActive && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60]">
              <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-sm w-full mx-4 space-y-6">
                {/* Avatar */}
                <div className="flex justify-center">
                  <div className="w-24 h-24 rounded-full bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center">
                    <Phone size={48} className="text-white" />
                  </div>
                </div>

                {/* Contact Info */}
                <div className="text-center space-y-2">
                  <p className="text-sm text-muted-foreground">{t("conversations_inbox.call_ui.calling")}</p>
                  {callContactName && <p className="text-2xl font-bold">{callContactName}</p>}
                  <p className="text-lg font-semibold text-muted-foreground">{callPhoneNumber}</p>
                </div>

                {/* Call Duration */}
                <div className="text-center">
                  <p className="text-4xl font-bold text-primary font-mono">{formatCallDuration(callDuration)}</p>
                </div>

                {/* Call Controls */}
                <div className="flex items-center justify-center gap-4">
                  {/* Mute Button */}
                  <button
                    onClick={() => setIsMuted(!isMuted)}
                    className={`w-14 h-14 rounded-full flex items-center justify-center transition-colors ${isMuted
                      ? "bg-red-100 hover:bg-red-200"
                      : "bg-muted hover:bg-muted/80"
                      }`}
                    title={isMuted ? t("conversations_inbox.call_ui.unmute") : t("conversations_inbox.call_ui.mute")}
                  >
                    {isMuted ? (
                      <MicOff size={20} className={isMuted ? "text-red-600" : "text-foreground"} />
                    ) : (
                      <Mic size={20} className="text-foreground" />
                    )}
                  </button>

                  {/* Speaker Button */}
                  <button
                    onClick={() => setIsSpeakerOn(!isSpeakerOn)}
                    className={`w-14 h-14 rounded-full flex items-center justify-center transition-colors ${isSpeakerOn
                      ? "bg-primary/15 hover:bg-primary/25"
                      : "bg-muted hover:bg-muted/80"
                      }`}
                    title={isSpeakerOn ? t("conversations_inbox.call_ui.speaker_off") : t("conversations_inbox.call_ui.speaker_on")}
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={isSpeakerOn ? "text-primary" : "text-foreground"}>
                      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
                      <path d="M15.54 8.46a6.5 6.5 0 0 1 0 9.07"></path>
                      <path d="M19.07 4.93a10 10 0 0 1 0 14.14"></path>
                    </svg>
                  </button>

                  {/* End Call Button */}
                  <button
                    onClick={() => {
                      setIsCallActive(false);
                      setCallDuration(0);
                      setCallPhoneNumber("");
                      setCallContactName("");
                      setIsMuted(false);
                      setIsSpeakerOn(false);
                      setIsMakeCallModalOpen(false);
                    }}
                    className="w-14 h-14 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center transition-colors"
                    title={t("conversations_inbox.call_ui.end_call")}
                  >
                    <Phone size={20} className="text-white rotate-135" />
                  </button>
                </div>

                {/* Call Status */}
                <div className="text-center">
                  <p className="text-sm text-muted-foreground">{t("conversations_inbox.call_ui.connected")}</p>
                </div>
              </div>
            </div>
          )
        }

      </div>

      {/* Snooze dialog — pick a future datetime; sending empty unsnoozes. */}
      <Dialog open={snoozeDialogOpen} onOpenChange={setSnoozeDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("conversations_inbox.dialogs.snooze.title")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-xs text-muted-foreground">
              {t("conversations_inbox.dialogs.snooze.description")}
            </p>
            <Input
              type="datetime-local"
              value={snoozeUntil}
              onChange={(e) => setSnoozeUntil(e.target.value)}
              data-testid="input-snooze-until"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSnoozeDialogOpen(false)}>
              {t("conversations_inbox.dialogs.snooze.cancel")}
            </Button>
            <Button
              onClick={() =>
                selectedConversation &&
                snoozeMutation.mutate({
                  id: selectedConversation,
                  until: new Date(snoozeUntil).toISOString(),
                })
              }
              disabled={!snoozeUntil || snoozeMutation.isPending}
            >
              {snoozeMutation.isPending ? t("conversations_inbox.dialogs.snooze.snoozing") : t("conversations_inbox.dialogs.snooze.snooze")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Composer "+" → Start automation (replyagent select_automation_popup). */}
      <Dialog open={automationDialogOpen} onOpenChange={setAutomationDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("conversations_inbox.dialogs.automation.title")}</DialogTitle>
          </DialogHeader>
          <div className="max-h-80 overflow-auto divide-y">
            {composerAutomations.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">{t("conversations_inbox.dialogs.automation.no_automations")}</p>
            ) : (
              composerAutomations.map((a) => (
                <button
                  key={a.id}
                  className="w-full text-left px-2 py-2.5 hover:bg-muted flex items-center justify-between gap-2 disabled:opacity-50"
                  onClick={() => automateMutation.mutate(a.id)}
                  disabled={automateMutation.isPending}
                  data-testid={`automation-option-${a.id}`}
                >
                  <span className="text-sm truncate flex items-center gap-2"><Bot size={14} />{a.name}</span>
                  {a.status && a.status !== "active" && (
                    <span className="text-[10px] uppercase text-muted-foreground flex-shrink-0">{a.status}</span>
                  )}
                </button>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Composer "+" → Media gallery picker — the real gallery (folders,
          filters, upload) reused here via onSelect instead of the old
          bare-bones grid, so the agent picks straight from the actual
          workspace media library. */}
      <Dialog open={galleryDialogOpen} onOpenChange={setGalleryDialogOpen}>
        <DialogContent className="max-w-5xl h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>{t("conversations_inbox.dialogs.gallery.title")}</DialogTitle>
          </DialogHeader>
          <div className="flex-1 min-h-0 overflow-auto">
            <MediaGallerySection onSelect={attachFromMediaGallerySection} />
          </div>
        </DialogContent>
      </Dialog>

      {/* Composer "+" → Sticker picker (replyagent sticker gallery — webp). */}
      <Dialog open={stickerDialogOpen} onOpenChange={setStickerDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("conversations_inbox.dialogs.sticker.title")}</DialogTitle>
          </DialogHeader>
          <div className="max-h-[55vh] overflow-auto">
            {stickerFiles.length === 0 ? (
              <p className="text-sm text-muted-foreground py-10 text-center">
                {t("conversations_inbox.dialogs.sticker.empty")}
              </p>
            ) : (
              <div className="grid grid-cols-5 gap-2">
                {stickerFiles.map((f) => (
                  <button
                    key={f.id}
                    className="aspect-square rounded-md overflow-hidden border hover:ring-2 hover:ring-primary p-1"
                    onClick={() => sendSticker(f)}
                    title={f.name}
                    data-testid={`sticker-item-${f.id}`}
                  >
                    <img src={f.thumb} alt={f.name} className="w-full h-full object-contain" />
                  </button>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Composer "+" → Location share (replyagent type:'location' send). */}
      <Dialog open={locationDialogOpen} onOpenChange={setLocationDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("conversations_inbox.dialogs.location.title")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Button variant="outline" size="sm" onClick={useCurrentLocation} disabled={locGeoLoading} className="w-full">
              <MapPin size={14} className="mr-2" /> {locGeoLoading ? t("conversations_inbox.dialogs.location.getting_location") : t("conversations_inbox.dialogs.location.use_current")}
            </Button>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-muted-foreground">{t("conversations_inbox.dialogs.location.latitude")}</label>
                <Input value={locLat} onChange={(e) => setLocLat(e.target.value)} placeholder="e.g. 24.8607" />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-muted-foreground">{t("conversations_inbox.dialogs.location.longitude")}</label>
                <Input value={locLng} onChange={(e) => setLocLng(e.target.value)} placeholder="e.g. 67.0011" />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-muted-foreground">{t("conversations_inbox.dialogs.location.name")}</label>
              <Input value={locName} onChange={(e) => setLocName(e.target.value)} placeholder={t("conversations_inbox.dialogs.location.name_placeholder")} />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-muted-foreground">{t("conversations_inbox.dialogs.location.address")}</label>
              <Input value={locAddress} onChange={(e) => setLocAddress(e.target.value)} placeholder={t("conversations_inbox.dialogs.location.address_placeholder")} />
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="ghost" size="sm" onClick={() => setLocationDialogOpen(false)}>{t("conversations_inbox.dialogs.location.cancel")}</Button>
              <Button size="sm" onClick={sendLocation} disabled={sendMessageMutation.isPending || !locLat.trim() || !locLng.trim()}>
                <MapPin size={14} className="mr-2" /> {t("conversations_inbox.dialogs.location.send_location")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Bulk snooze dialog (select-all → Actions → Snooze). */}
      <Dialog open={bulkSnoozeOpen} onOpenChange={setBulkSnoozeOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("conversations_inbox.dialogs.bulk_snooze.title", { count: selectedInboxIds.length })}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-xs text-muted-foreground">
              {t("conversations_inbox.dialogs.bulk_snooze.description")}
            </p>
            <Input
              type="datetime-local"
              value={bulkSnoozeUntil}
              onChange={(e) => setBulkSnoozeUntil(e.target.value)}
              data-testid="input-bulk-snooze-until"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkSnoozeOpen(false)}>
              {t("conversations_inbox.dialogs.bulk_snooze.cancel")}
            </Button>
            <Button
              onClick={() =>
                bulkSnoozeMutation.mutate({
                  ids: selectedInboxIds,
                  until: new Date(bulkSnoozeUntil).toISOString(),
                })
              }
              disabled={!bulkSnoozeUntil || bulkSnoozeMutation.isPending}
            >
              {bulkSnoozeMutation.isPending ? t("conversations_inbox.dialogs.bulk_snooze.snoozing") : t("conversations_inbox.dialogs.bulk_snooze.snooze")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk assign dialog (select-all → Actions → Assign conversations). */}
      <Dialog open={bulkAssignOpen} onOpenChange={setBulkAssignOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("conversations_inbox.dialogs.bulk_assign.title", { count: selectedInboxIds.length })}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Select value={bulkAssignAgent} onValueChange={setBulkAssignAgent}>
              <SelectTrigger data-testid="select-bulk-assign-agent">
                <SelectValue placeholder={t("conversations_inbox.dialogs.bulk_assign.choose_agent")} />
              </SelectTrigger>
              <SelectContent className="bg-white dark:bg-background">
                <SelectItem value="null">{t("conversations_inbox.dialogs.bulk_assign.unassign_option")}</SelectItem>
                {agentOptions.map((a: AgentOption) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkAssignOpen(false)}>
              {t("conversations_inbox.dialogs.bulk_assign.cancel")}
            </Button>
            <Button
              onClick={() =>
                bulkAssignMutation.mutate({
                  ids: selectedInboxIds,
                  assignedTo: bulkAssignAgent === "null" ? null : bulkAssignAgent,
                })
              }
              disabled={!bulkAssignAgent || bulkAssignMutation.isPending}
            >
              {bulkAssignMutation.isPending ? t("conversations_inbox.dialogs.bulk_assign.assigning") : t("conversations_inbox.dialogs.bulk_assign.assign")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Template-send dialog (WhatsApp 24h-window CTA). Lists workspace's
          approved templates from /api/broadcasts/templates and POSTs to the
          existing send endpoint with type='template' + wa_template_id. */}
      <Dialog open={templateDialogOpen} onOpenChange={setTemplateDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("conversations_inbox.dialogs.send_template.title")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-xs text-muted-foreground">
              {t("conversations_inbox.dialogs.send_template.description")}
            </p>
            <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
              <SelectTrigger>
                <SelectValue placeholder={t("conversations_inbox.dialogs.send_template.choose_template")} />
              </SelectTrigger>
              <SelectContent>
                {waTemplates.length === 0 ? (
                  <div className="px-2 py-1 text-xs text-muted-foreground">{t("conversations_inbox.dialogs.send_template.no_approved_templates")}</div>
                ) : (
                  waTemplates.map((t: any) => (
                    <SelectItem key={String(t.id)} value={String(t.id)}>
                      {t.name} <span className="text-muted-foreground">({t.language})</span>
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTemplateDialogOpen(false)}>
              {t("conversations_inbox.dialogs.send_template.cancel")}
            </Button>
            <Button
              onClick={() => sendTemplateMutation.mutate(selectedTemplateId)}
              disabled={!selectedTemplateId || sendTemplateMutation.isPending}
            >
              {sendTemplateMutation.isPending ? t("conversations_inbox.dialogs.send_template.sending") : t("conversations_inbox.dialogs.send_template.send")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Folder create / rename / delete dialog. Reuses the same modal for
          both flows — when folderEditing is set, we're renaming; otherwise
          we're creating. Delete button only shows in the rename mode. */}
      <Dialog open={folderModalOpen} onOpenChange={setFolderModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{folderEditing ? t("conversations_inbox.dialogs.folder.rename_title") : t("conversations_inbox.dialogs.folder.new_title")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Input
              placeholder={t("conversations_inbox.dialogs.folder.placeholder")}
              value={folderName}
              onChange={(e) => setFolderName(e.target.value)}
              maxLength={30}
            />
          </div>
          <DialogFooter className="flex items-center justify-between">
            {folderEditing && (
              <Button
                variant="destructive"
                size="sm"
                onClick={() => folderDeleteMutation.mutate(String(folderEditing.id))}
              >
                {t("conversations_inbox.dialogs.folder.delete")}
              </Button>
            )}
            <div className="flex gap-2 ml-auto">
              <Button variant="outline" onClick={() => setFolderModalOpen(false)}>
                {t("conversations_inbox.dialogs.folder.cancel")}
              </Button>
              <Button
                onClick={() =>
                  folderEditing
                    ? folderUpdateMutation.mutate({ id: String(folderEditing.id), name: folderName })
                    : folderCreateMutation.mutate(folderName)
                }
                disabled={!folderName.trim()}
              >
                {folderEditing ? t("conversations_inbox.dialogs.folder.save") : t("conversations_inbox.dialogs.folder.create")}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reminder dialog — schedule a future outbound reminder. Backend writes
          remind_at on a pending message row; existing cron picks it up. */}
      <Dialog open={reminderDialogOpen} onOpenChange={setReminderDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("conversations_inbox.dialogs.reminder.title")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-xs text-muted-foreground">
              {t("conversations_inbox.dialogs.reminder.description")}
            </p>
            <div>
              <label className="text-xs font-medium">{t("conversations_inbox.dialogs.reminder.when_label")}</label>
              <Input
                type="datetime-local"
                value={reminderAt}
                onChange={(e) => setReminderAt(e.target.value)}
                data-testid="input-reminder-at"
              />
            </div>
            <div>
              <label className="text-xs font-medium">{t("conversations_inbox.dialogs.reminder.message_label")}</label>
              <Textarea
                placeholder={t("conversations_inbox.dialogs.reminder.message_placeholder")}
                value={reminderText}
                onChange={(e) => setReminderText(e.target.value)}
                rows={3}
                data-testid="input-reminder-text"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReminderDialogOpen(false)}>
              {t("conversations_inbox.dialogs.reminder.cancel")}
            </Button>
            <Button
              onClick={() =>
                selectedConversation &&
                reminderMutation.mutate({
                  inbox_id: selectedConversation,
                  schedule_at: new Date(reminderAt).toISOString(),
                  text_message: reminderText,
                })
              }
              disabled={!reminderAt || !reminderText.trim() || reminderMutation.isPending}
            >
              {reminderMutation.isPending ? t("conversations_inbox.dialogs.reminder.scheduling") : t("conversations_inbox.dialogs.reminder.schedule")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
