import { useState, useRef, useEffect } from "react";
import { Search, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, MoreHorizontal } from "lucide-react";
import { ChevronsUpDown, ChevronDown, ChevronUp } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { apiRequest } from "@/lib/queryClient";
import { useTheme } from "@/contexts/ThemeContext";
import { cn } from "@/lib/utils";

type SortDirection = "asc" | "desc" | "default";

interface SortState {
  column: string | null;
  direction: SortDirection;
}

export default function VoiceOfCustomerDetails() {
  const { t } = useTranslation();
  const { mode } = useTheme();
  const dark = mode === "dark";

  const card    = dark ? "bg-[#0f1829] border-slate-800" : "bg-white border-slate-200";
  const text    = dark ? "text-white"     : "text-slate-900";
  const sub     = dark ? "text-slate-400" : "text-slate-500";
  const divider = dark ? "border-slate-800" : "border-slate-100";
  const rowHover = dark ? "hover:bg-slate-800/50" : "hover:bg-slate-50";
  const thCls   = dark ? "text-slate-500 border-slate-800" : "text-slate-400 border-slate-100";
  const inputCls = dark 
    ? "bg-slate-900/60 border-slate-700 text-white placeholder:text-slate-500 focus:border-slate-600" 
    : "bg-slate-50 border-slate-200 text-slate-900 placeholder:text-slate-400 focus:border-slate-300";

  const [searchAgent, setSearchAgent] = useState("");
  const [searchConversation, setSearchConversation] = useState("");
  const [rowsPerPageAgent, setRowsPerPageAgent] = useState(10);
  const [rowsPerPageConversation, setRowsPerPageConversation] = useState(10);
  const [agentSort, setAgentSort] = useState<SortState>({ column: null, direction: "default" });
  const [conversationSort, setConversationSort] = useState<SortState>({ column: null, direction: "default" });
  
  const [agentDropdownOpen, setAgentDropdownOpen] = useState(false);
  const [conversationDropdownOpen, setConversationDropdownOpen] = useState(false);
  const agentDropdownRef = useRef<HTMLDivElement>(null);
  const conversationDropdownRef = useRef<HTMLDivElement>(null);

  // Real sentiment details. Backend computes per-agent counts + per-conversation
  // sentiment classification (keyword-based, no NLP API).
  const { data: vocDetails } = useQuery<any>({
    queryKey: ["/api/statistics/sentiment-details"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/statistics/sentiment-details");
      return res.json();
    },
    refetchInterval: 300_000,
  });
  const agentPerformanceData: Array<{ agentName: string; agentId: string; team: string; date: string; total: number }> =
    (vocDetails?.agentRows ?? []).map((r: any) => ({
      agentName: r.name,
      agentId: r.id,
      team: r.team,
      date: r.date,
      total: r.total,
    }));
  const customerSentimentData: Array<{ conversationId: string; agent: string; team: string; sentiment: string; date: string; channel: string }> =
    (vocDetails?.customerRows ?? []).map((r: any) => ({
      conversationId: r.id,
      agent: r.agentName,
      team: r.team,
      sentiment: r.sentiment,
      date: r.date,
      channel: r.channel,
    }));

  const handleAgentSort = (column: string) => {
    setAgentSort((prev) => {
      if (prev.column === column) {
        if (prev.direction === "default") return { column, direction: "asc" };
        if (prev.direction === "asc") return { column, direction: "desc" };
        return { column: null, direction: "default" };
      }
      return { column, direction: "asc" };
    });
  };

  const handleConversationSort = (column: string) => {
    setConversationSort((prev) => {
      if (prev.column === column) {
        if (prev.direction === "default") return { column, direction: "asc" };
        if (prev.direction === "asc") return { column, direction: "desc" };
        return { column: null, direction: "default" };
      }
      return { column, direction: "asc" };
    });
  };

  const renderSortIcon = (column: string, currentSort: SortState) => {
    const isActive = currentSort.column === column;
    const color = isActive ? "text-primary" : "opacity-30";

    if (currentSort.column !== column) return <ChevronsUpDown size={12} className={color} />;
    if (currentSort.direction === "asc") return <ChevronUp size={12} className={color} />;
    if (currentSort.direction === "desc") return <ChevronDown size={12} className={color} />;
    return <ChevronsUpDown size={12} className={color} />;
  };

  const getSortedAgentData = () => {
    let sorted = [...agentPerformanceData];
    if (agentSort.column && agentSort.direction !== "default") {
      sorted.sort((a, b) => {
        const aVal = a[agentSort.column as keyof typeof a];
        const bVal = b[agentSort.column as keyof typeof b];
        if (typeof aVal === "string" && typeof bVal === "string") {
          return agentSort.direction === "asc" ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
        }
        if (typeof aVal === "number" && typeof bVal === "number") {
          return agentSort.direction === "asc" ? aVal - bVal : bVal - aVal;
        }
        return 0;
      });
    }
    return sorted.filter(item =>
      searchAgent === "" ||
      item.agentName.toLowerCase().includes(searchAgent.toLowerCase()) ||
      item.agentId.toLowerCase().includes(searchAgent.toLowerCase())
    );
  };

  const getSortedConversationData = () => {
    let sorted = [...customerSentimentData];
    if (conversationSort.column && conversationSort.direction !== "default") {
      sorted.sort((a, b) => {
        const aVal = a[conversationSort.column as keyof typeof a];
        const bVal = b[conversationSort.column as keyof typeof b];
        if (typeof aVal === "string" && typeof bVal === "string") {
          return conversationSort.direction === "asc" ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
        }
        return 0;
      });
    }
    return sorted.filter(item =>
      searchConversation === "" ||
      item.conversationId.toLowerCase().includes(searchConversation.toLowerCase()) ||
      item.agent.toLowerCase().includes(searchConversation.toLowerCase())
    );
  };

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (agentDropdownRef.current && !agentDropdownRef.current.contains(event.target as Node)) setAgentDropdownOpen(false);
      if (conversationDropdownRef.current && !conversationDropdownRef.current.contains(event.target as Node)) setConversationDropdownOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const pagination = (count: number, rows: number, setRows: (v: number) => void, isOpen: boolean, setIsOpen: (v: boolean) => void, ref: any) => (
    <div className="flex items-center justify-between mt-5 px-1">
      <span className={cn("text-[11px] font-semibold opacity-60", sub)}>{t("voice_of_customer_details.results_count", { count })}</span>
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2.5">
          <span className={cn("text-[11px] font-semibold opacity-60", sub)}>{t("voice_of_customer_details.rows_per_page")}</span>
          <div className="relative" ref={ref}>
            <button
              onClick={() => setIsOpen(!isOpen)}
              className={cn("flex items-center gap-2 px-2.5 py-1 rounded-lg border text-[11px] font-bold transition-all", dark ? "bg-slate-900/60 border-slate-700 text-white" : "bg-slate-50 border-slate-200 text-slate-900")}
            >
              {rows} <ChevronDown size={12} className="opacity-50" />
            </button>
            {isOpen && (
              <div className={cn("absolute bottom-full mb-2 left-0 w-full rounded-xl border shadow-2xl overflow-hidden animate-in fade-in zoom-in-95", dark ? "bg-[#0f1829] border-slate-800" : "bg-white border-slate-200")}>
                {[10, 25, 50].map(v => (
                  <div key={v} onClick={() => { setRows(v); setIsOpen(false); }} className={cn("px-3 py-1.5 text-[11px] font-bold cursor-pointer transition-colors", dark ? "hover:bg-slate-800" : "hover:bg-slate-50")}>{v}</div>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <button className={cn("p-1.5 rounded-lg border transition-all disabled:opacity-30", dark ? "border-slate-800 text-white" : "border-slate-200 text-slate-900")} disabled><ChevronsLeft size={14} /></button>
          <button className={cn("p-1.5 rounded-lg border transition-all disabled:opacity-30", dark ? "border-slate-800 text-white" : "border-slate-200 text-slate-900")} disabled><ChevronLeft size={14} /></button>
          <span className={cn("text-[11px] font-bold px-2", text)}>{t("voice_of_customer_details.page_indicator")}</span>
          <button className={cn("p-1.5 rounded-lg border transition-all disabled:opacity-30", dark ? "border-slate-800 text-white" : "border-slate-200 text-slate-900")} disabled><ChevronRight size={14} /></button>
          <button className={cn("p-1.5 rounded-lg border transition-all disabled:opacity-30", dark ? "border-slate-800 text-white" : "border-slate-200 text-slate-900")} disabled><ChevronsRight size={14} /></button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-5">
      {/* Agent Performance Table */}
      <div className={cn("rounded-2xl border p-5 transition-all duration-300 hover:shadow-xl", card)}>
        <div className="flex items-center justify-between mb-5">
          <h3 className={cn("text-[13px] font-bold", text)}>{t("voice_of_customer_details.agent_sentiment_performance")}</h3>
          <div className="relative">
            <Search className={cn("absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5", sub)} />
            <input
              placeholder={t("voice_of_customer_details.search_agent_placeholder")}
              value={searchAgent}
              onChange={(e) => setSearchAgent(e.target.value)}
              className={cn("pl-9 pr-3 h-8 w-64 text-[11px] rounded-lg border outline-none transition-colors", inputCls)}
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className={cn("border-b text-left", divider)}>
                {[
                  { l: t("voice_of_customer_details.header_agent_name_id"), k: "agentName" },
                  { l: t("voice_of_customer_details.header_team"), k: "team" },
                  { l: t("voice_of_customer_details.header_date"), k: "date" },
                  { l: t("voice_of_customer_details.header_total"), k: "total" }
                ].map((h) => (
                  <th 
                    key={h.k} 
                    onClick={() => handleAgentSort(h.k)}
                    className={cn("pb-2 px-3 text-[10px] font-bold cursor-pointer group", thCls)}
                  >
                    <div className="flex items-center gap-1.5">
                      {h.l} {renderSortIcon(h.k, agentSort)}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {getSortedAgentData().length > 0 ? getSortedAgentData().map((item, i) => (
                <tr key={i} className={cn("border-b transition-colors", divider, rowHover)}>
                  <td className={cn("py-3 px-3 text-[12px] font-semibold", text)}>{item.agentName} <span className="opacity-40 font-normal">({item.agentId})</span></td>
                  <td className={cn("py-3 px-3 text-[11px] font-medium", sub)}>{item.team}</td>
                  <td className={cn("py-3 px-3 text-[11px] tabular-nums", sub)}>{item.date}</td>
                  <td className={cn("py-3 px-3 text-[12px] font-black text-primary")}>{item.total}</td>
                </tr>
              )) : <tr><td colSpan={4} className={cn("py-8 text-center text-[11px]", sub)}>{t("voice_of_customer_details.no_results_found")}</td></tr>}
            </tbody>
          </table>
        </div>
        {pagination(getSortedAgentData().length, rowsPerPageAgent, setRowsPerPageAgent, agentDropdownOpen, setAgentDropdownOpen, agentDropdownRef)}
      </div>

      {/* Customer Sentiment Analysis Table */}
      <div className={cn("rounded-2xl border p-5 transition-all duration-300 hover:shadow-xl", card)}>
        <div className="flex items-center justify-between mb-5">
          <h3 className={cn("text-[13px] font-bold", text)}>{t("voice_of_customer_details.customer_sentiment_analysis")}</h3>
          <div className="relative">
            <Search className={cn("absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5", sub)} />
            <input
              placeholder={t("voice_of_customer_details.search_conversation_placeholder")}
              value={searchConversation}
              onChange={(e) => setSearchConversation(e.target.value)}
              className={cn("pl-9 pr-3 h-8 w-64 text-[11px] rounded-lg border outline-none transition-colors", inputCls)}
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className={cn("border-b text-left", divider)}>
                {[
                  { l: t("voice_of_customer_details.header_conversation_id"), k: "conversationId" },
                  { l: t("voice_of_customer_details.header_agent"), k: "agent" },
                  { l: t("voice_of_customer_details.header_team"), k: "team" },
                  { l: t("voice_of_customer_details.header_sentiment"), k: "sentiment" },
                  { l: t("voice_of_customer_details.header_date"), k: "date" },
                  { l: t("voice_of_customer_details.header_channel"), k: "channel" }
                ].map((h) => (
                  <th 
                    key={h.k} 
                    onClick={() => handleConversationSort(h.k)}
                    className={cn("pb-2 px-3 text-[10px] font-bold cursor-pointer group", thCls)}
                  >
                    <div className="flex items-center gap-1.5">
                      {h.l} {renderSortIcon(h.k, conversationSort)}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {getSortedConversationData().length > 0 ? getSortedConversationData().map((item, i) => (
                <tr key={i} className={cn("border-b transition-colors", divider, rowHover)}>
                  <td className={cn("py-3 px-3 text-[12px] font-semibold tabular-nums", text)}>{item.conversationId}</td>
                  <td className={cn("py-3 px-3 text-[11px] font-bold", text)}>{item.agent}</td>
                  <td className={cn("py-3 px-3 text-[11px] font-medium", sub)}>{item.team}</td>
                  <td className="py-3 px-3">
                    <span className={cn(
                      "px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider",
                      item.sentiment === "Positive" ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20" :
                      item.sentiment === "Neutral"  ? "bg-orange-500/10 text-orange-500 border border-orange-500/20" :
                      "bg-rose-500/10 text-rose-500 border border-rose-500/20"
                    )}>
                      {item.sentiment}
                    </span>
                  </td>
                  <td className={cn("py-3 px-3 text-[11px] tabular-nums", sub)}>{item.date}</td>
                  <td className={cn("py-3 px-3 text-[11px] font-bold opacity-70", text)}>{item.channel}</td>
                </tr>
              )) : <tr><td colSpan={6} className={cn("py-8 text-center text-[11px]", sub)}>{t("voice_of_customer_details.no_results_found")}</td></tr>}
            </tbody>
          </table>
        </div>
        {pagination(getSortedConversationData().length, rowsPerPageConversation, setRowsPerPageConversation, conversationDropdownOpen, setConversationDropdownOpen, conversationDropdownRef)}
      </div>
    </div>
  );
}
