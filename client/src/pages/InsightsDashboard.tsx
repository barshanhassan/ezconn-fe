"use client";

import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

import { DateRangeProvider } from "@/contexts/DateRangeContext";
import { TabProvider, useTab } from "@/contexts/TabContext";
import { ExportProvider } from "@/contexts/ExportContext";

import OverviewTab from "@/components/tabs/OverviewTab";
import AgentPerformanceTab from "@/components/tabs/agent-performance/AgentPerformanceTab";
import WhatsAppPricingTab from "@/components/tabs/whatsapp-pricing/WhatsAppPricingTab";
import BotDashboardTab from "@/components/tabs/BotDashboardTab";
import VoiceOfCustomerTab from "@/components/tabs/voice-of-customer/VoiceOfCustomerTab";
import CSATDashboardTab from "@/components/tabs/csat-dashboard/CSATDashboardTab";

import {
  Gauge,
  Activity,
  MessageCircle,
  Bot,
  AudioLines,
  Smile,
  TrendingUp,
} from "lucide-react";

function InsightsDashboardContent() {
  const { t } = useTranslation();
  const { activeTab, setActiveTab } = useTab();
  const [localActiveTab, setLocalActiveTab] = useState(activeTab);

  const tabs = [
    { id: "overview",          label: t("insights_dashboard.overview"),    ctx: "overview",        icon: <Gauge         size={15} strokeWidth={2.25} className="shrink-0" /> },
    { id: "agent-performance", label: t("insights_dashboard.performance"), ctx: "agentPerformance", icon: <Activity     size={15} strokeWidth={2.25} className="shrink-0" /> },
    { id: "whatsapp-pricing",  label: t("insights_dashboard.whatsapp"),    ctx: "whatsapp",        icon: <MessageCircle size={15} strokeWidth={2.25} className="shrink-0" /> },
    { id: "bot-dashboard",     label: t("insights_dashboard.bot"),         ctx: "botDashboard",    icon: <Bot          size={15} strokeWidth={2.25} className="shrink-0" /> },
    { id: "voice-of-customer", label: t("insights_dashboard.voice"),       ctx: "voiceOfCustomer", icon: <AudioLines   size={15} strokeWidth={2.25} className="shrink-0" /> },
    { id: "csat-dashboard",    label: t("insights_dashboard.csat"),        ctx: "csatDashboard",   icon: <Smile        size={15} strokeWidth={2.25} className="shrink-0" /> },
  ];

  return (
    // Outer floating card — mirrors the header + settings treatment so
    // the Insights page reads as its own rounded panel with visible
    // gap and shadow, not an edge-to-edge sheet flush against the
    // header. m-3 keeps a consistent 12px inset on ALL sides — matches
    // the settings p-3 wrapper so the vertical gap above the card
    // (below the header) reads the same across pages.
    <div
      className="m-3 p-6 space-y-8 rounded-2xl border border-slate-200/70 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-[0_10px_28px_-8px_rgba(15,23,42,0.18),0_4px_10px_-2px_rgba(15,23,42,0.08)] dark:shadow-[0_10px_28px_-6px_rgba(0,0,0,0.55),0_4px_10px_-2px_rgba(0,0,0,0.35)] animate-in fade-in slide-in-from-bottom-4 duration-700 ease-out"
      data-testid="insights-dashboard"
    >
      {/* Header: Title (left) + Tabs pill (right, slightly shifted away from the right edge
          via mr-* so it doesn't crowd the page edge — actions panel is portaled into the
          global header next to the bell, separately). */}
      <div className="flex items-center justify-between pb-6 border-b border-slate-200 dark:border-slate-700">
        {/* Title Section */}
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-2xl bg-primary/10 text-primary border border-primary/10 shadow-inner">
            <TrendingUp size={24} strokeWidth={2.5} />
          </div>
          <div className="space-y-0.5">
            <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
              {t("insights_dashboard.insights")} <span className="text-primary font-bold opacity-90">{t("insights_dashboard.dashboard")}</span>
            </h1>
            <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 opacity-80">
              {t("insights_dashboard.subtitle")}
            </p>
          </div>
        </div>

        {/* Tabs pill — pushed all the way to the right edge */}
        <div className="flex items-center gap-1 bg-slate-100/50 dark:bg-slate-800/40 backdrop-blur-md rounded-2xl p-1 border border-slate-200/50 dark:border-slate-700/50 w-fit shadow-sm">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                setLocalActiveTab(tab.id);
                setActiveTab(tab.ctx);
              }}
              className={cn(
                "px-4 py-2 rounded-xl text-[12px] font-bold transition-all duration-300 whitespace-nowrap flex items-center gap-2 relative group",
                localActiveTab === tab.id
                  ? "bg-primary text-primary-foreground shadow-lg shadow-primary/25 scale-[1.02]"
                  : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white/80 dark:hover:bg-slate-700/50 shadow-none hover:shadow-sm"
              )}
              data-testid={`tab-${tab.id}`}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content with Entry Animation - Increased Spacing for Better Alignment */}
      <div className="mt-10 space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
        {localActiveTab === "overview" && <OverviewTab />}
        {localActiveTab === "agent-performance" && <AgentPerformanceTab />}
        {localActiveTab === "whatsapp-pricing" && <WhatsAppPricingTab />}
        {localActiveTab === "bot-dashboard" && <BotDashboardTab />}
        {localActiveTab === "voice-of-customer" && <VoiceOfCustomerTab />}
        {localActiveTab === "csat-dashboard" && <CSATDashboardTab />}
      </div>
    </div>
  );
}

export default function InsightsDashboard() {
  return (
    <DateRangeProvider>
      <TabProvider>
        <ExportProvider>
          <InsightsDashboardContent />
        </ExportProvider>
      </TabProvider>
    </DateRangeProvider>
  );
}