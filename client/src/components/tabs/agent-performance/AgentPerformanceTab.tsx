import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useTab } from "@/contexts/TabContext";
import CustomDropdown from "@/components/CustomDropdown";
import AgentPerformanceMain from "./AgentPerformanceMain";
import AgentConversion from "./AgentConversion";
import { Users2, Target, Filter } from "lucide-react";
import { cn } from "@/lib/utils";

// Filter options — to be fetched from workspace teams/agents endpoints.
const teams: Array<{ id: string; name: string }> = [];
const agents: Array<{ id: string; name: string }> = [];

export default function AgentPerformanceTab() {
  const { t } = useTranslation();
  const { activeSubTab, setActiveSubTab } = useTab();
  const [agentPerformanceTab, setAgentPerformanceTab] = useState(activeSubTab.agentPerformance);
  const [selectedTeams, setSelectedTeams] = useState<string[]>([]);
  const [selectedAgents, setSelectedAgents] = useState<string[]>([]);

  // Sync local state with context when context changes
  useEffect(() => {
    setAgentPerformanceTab(activeSubTab.agentPerformance);
  }, [activeSubTab.agentPerformance]);

  const handleTabChange = (tab: string) => {
    setAgentPerformanceTab(tab);
    setActiveSubTab({ agentPerformance: tab });
  };

  return (
    <div className="space-y-4">
      {/* ── Sub-header: Minimalist Sub-tabs & Professional Filters ── */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 p-1.5 rounded-xl bg-slate-100/50 dark:bg-slate-900/40 border border-slate-200/60 dark:border-slate-800/60">
        
        {/* Left: Compact Sub-tabs Switcher (Restored original colors) */}
        <div className="flex items-center p-1 bg-slate-200/50 dark:bg-slate-800/50 rounded-lg shadow-inner">
          {[
            { id: "agent-performance-main", label: t("agent_performance_tab.agent_performance"), icon: <Users2 size={12} /> },
            { id: "agent-conversion", label: t("agent_performance_tab.agent_conversion"), icon: <Target size={12} /> },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => handleTabChange(tab.id)}
              className={cn(
                "flex items-center gap-2 px-4 py-1.5 rounded-md text-[11px] font-bold transition-all duration-300",
                agentPerformanceTab === tab.id
                  ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm"
                  : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
              )}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {/* Right: High-density Filters */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-slate-200/30 dark:bg-slate-800/30">
            <Filter size={11} className="text-slate-400" />
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{t("agent_performance_tab.filters")}</span>
          </div>
          <div className="flex items-center gap-2">
            <CustomDropdown
              options={teams}
              selected={selectedTeams}
              onChange={setSelectedTeams}
              placeholder={t("agent_performance_tab.teams")}
              className="h-8 min-w-[100px] text-[10px] rounded-lg border-slate-200 dark:border-slate-800 shadow-sm"
            />
            <CustomDropdown
              options={agents}
              selected={selectedAgents}
              onChange={setSelectedAgents}
              placeholder={t("agent_performance_tab.agents")}
              className="h-8 min-w-[100px] text-[10px] rounded-lg border-slate-200 dark:border-slate-800 shadow-sm"
            />
          </div>
        </div>
      </div>

      {/* Filter Chips / Summary */}
      {(selectedTeams.length > 0 || selectedAgents.length > 0) && (
        <div className="flex items-center gap-2 px-1 animate-in fade-in slide-in-from-top-1 duration-300">
          <span className="text-[10px] font-medium text-slate-400">{t("agent_performance_tab.filtering_by")}</span>
          <div className="flex flex-wrap gap-1.5">
            {selectedTeams.map(id => (
              <span key={id} className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-[9px] font-bold border border-slate-200 dark:border-slate-700">
                {teams.find(t => t.id === id)?.name}
              </span>
            ))}
            {selectedAgents.map(id => (
              <span key={id} className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-[9px] font-bold border border-slate-200 dark:border-slate-700">
                {agents.find(a => a.id === id)?.name}
              </span>
            ))}
            <button 
              onClick={() => { setSelectedTeams([]); setSelectedAgents([]); }}
              className="text-[9px] font-bold text-slate-400 hover:text-rose-500 transition-colors ml-1"
            >
              {t("agent_performance_tab.clear")}
            </button>
          </div>
        </div>
      )}

      {/* Tab Content with Entry Animation */}
      <div className="mt-2">
        {agentPerformanceTab === "agent-performance-main" && <AgentPerformanceMain />}
        {agentPerformanceTab === "agent-conversion" && <AgentConversion />}
      </div>
    </div>
  );
}
