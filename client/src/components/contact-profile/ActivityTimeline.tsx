/**
 * Activity Timeline — replyagent parity for CompanyProfile.vue's middle
 * `preview_company` view. Combines CRM notes + every channel's messages
 * into one date-sorted feed, with date range / channel / search filters.
 */
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Search,
  Filter,
  Calendar as CalendarIcon,
  MessageSquare,
  StickyNote,
  Send,
  ArrowDown,
  ArrowUp,
  Loader2,
  Phone as PhoneIcon,
  Mail,
  X,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { apiRequest } from "@/lib/queryClient";

const apiGet = async (url: string) => (await apiRequest("GET", url)).json();

const CHANNEL_LABELS: Record<string, string> = {
  whatsapp: "WhatsApp",
  telegram: "Telegram",
  instagram: "Instagram",
  messenger: "Messenger",
  evolution: "Evolution",
  webchat: "Web chat",
  sms: "SMS",
  unknown: "Other",
};

const CHANNEL_COLORS: Record<string, string> = {
  whatsapp: "bg-emerald-100 text-emerald-700",
  telegram: "bg-sky-100 text-sky-700",
  instagram: "bg-fuchsia-100 text-fuchsia-700",
  messenger: "bg-blue-100 text-blue-700",
  evolution: "bg-violet-100 text-violet-700",
  webchat: "bg-orange-100 text-orange-700",
  sms: "bg-amber-100 text-amber-700",
  unknown: "bg-muted text-muted-foreground",
};

interface TimelineItem {
  kind: "note" | "message";
  id: string;
  created_at: string | null;
  text: string | null;
  type: string;
  channel: string | null;
  direction?: string;
  author?: { name?: string; email?: string } | null;
  author_id?: string | null;
  media?: any;
}

export function ActivityTimeline({ contactId }: { contactId: string | null }) {
  const { t } = useTranslation();
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [enabledChannels, setEnabledChannels] = useState<Set<string>>(
    new Set(Object.keys(CHANNEL_LABELS)),
  );
  const [enabledKinds, setEnabledKinds] = useState<Set<"note" | "message">>(
    new Set<"note" | "message">(["note", "message"]),
  );
  const [page, setPage] = useState(1);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [debounced, dateFrom, dateTo, enabledChannels, enabledKinds, contactId]);

  const { data, isLoading } = useQuery({
    queryKey: [
      "/api/notes/timeline",
      contactId,
      { search: debounced, dateFrom, dateTo, page },
    ],
    queryFn: () => {
      const params = new URLSearchParams();
      if (debounced) params.set("search", debounced);
      if (dateFrom) params.set("date_from", dateFrom);
      if (dateTo) params.set("date_to", dateTo);
      params.set("page", String(page));
      params.set("limit", "30");
      return apiGet(`/api/notes/timeline/${contactId}?${params.toString()}`);
    },
    enabled: !!contactId,
  });

  const items: TimelineItem[] = useMemo(() => data?.timeline ?? [], [data]);

  const filtered = useMemo(() => {
    return items.filter((it) => {
      if (!enabledKinds.has(it.kind)) return false;
      if (it.kind === "message") {
        const ch = (it.channel ?? "unknown").toLowerCase();
        if (!enabledChannels.has(ch)) return false;
      }
      return true;
    });
  }, [items, enabledChannels, enabledKinds]);

  if (!contactId) return null;

  return (
    <div className="h-full flex flex-col">
      {/* Filter bar */}
      <div className="border-b px-4 py-2 flex items-center gap-2 shrink-0">
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm">
              <Filter className="h-3.5 w-3.5 mr-1" />
              {t("activity_timeline.activities")}
              <Badge variant="outline" className="ml-2 h-5 text-[10px]">
                {enabledChannels.size + enabledKinds.size}
              </Badge>
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-72 p-3">
            <h6 className="text-xs font-semibold uppercase tracking-wider mb-2">
              {t("activity_timeline.standard")}
            </h6>
            <div className="space-y-1 mb-3">
              {(["note", "message"] as const).map((k) => (
                <label
                  key={k}
                  className="flex items-center gap-2 text-sm cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={enabledKinds.has(k)}
                    onChange={(e) => {
                      const next = new Set(enabledKinds);
                      e.target.checked ? next.add(k) : next.delete(k);
                      setEnabledKinds(next);
                    }}
                  />
                  <span className="capitalize">
                    {k === "note" ? t("activity_timeline.kind_note") : t("activity_timeline.kind_message")}
                  </span>
                </label>
              ))}
            </div>
            <h6 className="text-xs font-semibold uppercase tracking-wider mb-2">
              {t("activity_timeline.channels")}
            </h6>
            <div className="space-y-1">
              {Object.entries(CHANNEL_LABELS).map(([k, label]) => (
                <label
                  key={k}
                  className="flex items-center gap-2 text-sm cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={enabledChannels.has(k)}
                    onChange={(e) => {
                      const next = new Set(enabledChannels);
                      e.target.checked ? next.add(k) : next.delete(k);
                      setEnabledChannels(next);
                    }}
                  />
                  <span>{label}</span>
                </label>
              ))}
            </div>
          </PopoverContent>
        </Popover>

        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm">
              <CalendarIcon className="h-3.5 w-3.5 mr-1" />
              {t("activity_timeline.date")}
              {(dateFrom || dateTo) && (
                <Badge variant="outline" className="ml-2 h-5 text-[10px]">
                  {t("activity_timeline.set")}
                </Badge>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-64 p-3 space-y-2">
            <div>
              <label className="text-xs">{t("activity_timeline.from")}</label>
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs">{t("activity_timeline.to")}</label>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
              />
            </div>
            {(dateFrom || dateTo) && (
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => {
                  setDateFrom("");
                  setDateTo("");
                }}
              >
                {t("activity_timeline.clear")}
              </Button>
            )}
          </PopoverContent>
        </Popover>

        <div className="relative flex-1 max-w-sm">
          <Search className="h-3.5 w-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("activity_timeline.search_timeline_placeholder")}
            className="pl-7 h-8 text-sm"
          />
          {search && (
            <button
              type="button"
              className="absolute right-2 top-1/2 -translate-y-1/2"
              onClick={() => setSearch("")}
            >
              <X className="h-3 w-3 text-muted-foreground" />
            </button>
          )}
        </div>
      </div>

      {/* Feed */}
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-3">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-sm text-muted-foreground">
              <StickyNote className="h-8 w-8 mx-auto mb-2 opacity-40" />
              <p>{t("activity_timeline.no_activity_matches")}</p>
              <Button
                variant="link"
                size="sm"
                onClick={() => {
                  setSearch("");
                  setDateFrom("");
                  setDateTo("");
                  setEnabledChannels(new Set(Object.keys(CHANNEL_LABELS)));
                  setEnabledKinds(new Set<"note" | "message">(["note", "message"]));
                }}
              >
                {t("activity_timeline.reset_filters")}
              </Button>
            </div>
          ) : (
            filtered.map((it) => <TimelineRow key={`${it.kind}-${it.id}`} item={it} />)
          )}
          {data?.has_more && (
            <div className="text-center">
              <Button variant="outline" size="sm" onClick={() => setPage((p) => p + 1)}>
                {t("activity_timeline.view_more")}
              </Button>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

function TimelineRow({ item }: { item: TimelineItem }) {
  const { t } = useTranslation();
  const date = item.created_at
    ? format(parseISO(item.created_at), "MMM d, yyyy HH:mm")
    : "—";

  if (item.kind === "note") {
    return (
      <div className="border-l-2 border-amber-300 pl-3 py-1">
        <div className="flex items-center gap-2 mb-1">
          <StickyNote className="h-3.5 w-3.5 text-amber-600" />
          <span className="text-xs font-medium">
            {item.author?.name ?? t("activity_timeline.note_fallback_author")}
          </span>
          <span className="text-xs text-muted-foreground ml-auto">{date}</span>
        </div>
        <p className="text-sm whitespace-pre-wrap">{item.text ?? t("activity_timeline.empty_note")}</p>
      </div>
    );
  }

  // message
  const channel = (item.channel ?? "unknown").toLowerCase();
  const colorClass = CHANNEL_COLORS[channel] ?? CHANNEL_COLORS.unknown;
  const Icon =
    item.direction === "outgoing" || item.direction === "outbound"
      ? ArrowUp
      : ArrowDown;
  const ChannelIcon = channel === "sms" ? PhoneIcon : MessageSquare;

  return (
    <div className="border-l-2 border-slate-200 pl-3 py-1">
      <div className="flex items-center gap-2 mb-1">
        <ChannelIcon className="h-3.5 w-3.5 text-muted-foreground" />
        <Badge className={`text-[10px] ${colorClass}`} variant="outline">
          {CHANNEL_LABELS[channel] ?? channel}
        </Badge>
        <Icon className="h-3 w-3 text-muted-foreground" />
        <span className="text-xs text-muted-foreground ml-auto">{date}</span>
      </div>
      <div className="text-sm whitespace-pre-wrap">
        {renderMessageBody(item, t)}
      </div>
    </div>
  );
}

function renderMessageBody(it: TimelineItem, t: (key: string) => string) {
  const msgType = String(it.type ?? "").toLowerCase();
  if (it.media && (msgType === "image" || msgType === "photo")) {
    const url = (it.media as any).url ?? (it.media as any).thumb_url;
    if (url)
      return (
        <img
          src={url}
          alt=""
          className="max-w-xs rounded border"
          loading="lazy"
        />
      );
  }
  if (it.media && (msgType === "audio" || msgType === "voice")) {
    const url = (it.media as any).url;
    if (url) return <audio controls src={url} className="max-w-xs" />;
  }
  if (it.media && msgType === "video") {
    const url = (it.media as any).url;
    if (url) return <video controls src={url} className="max-w-xs rounded" />;
  }
  if (it.media && msgType === "document") {
    const url = (it.media as any).url;
    const name = (it.media as any).object_name ?? t("activity_timeline.document_fallback_name");
    if (url)
      return (
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className="text-sm text-primary underline"
        >
          📎 {name}
        </a>
      );
  }
  return it.text ?? t("activity_timeline.no_content");
}
