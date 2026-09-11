import { useState, useEffect } from "react";
import { useTab } from "@/contexts/TabContext";
import CustomDropdown from "@/components/CustomDropdown";
import InsightsDateRangePicker from "@/components/InsightsDateRangePicker";
import MessagesSubTab from "./MessagesSubTab";
import CallsSubTab from "./CallsSubTab";
import { AlertCircle, MessageSquare, Phone, Globe, Filter } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";

const countryOptionDefs = [
  { id: "us", key: "country_us" },
  { id: "gb", key: "country_gb" },
  { id: "de", key: "country_de" },
  { id: "fr", key: "country_fr" },
  { id: "it", key: "country_it" },
  { id: "es", key: "country_es" },
  { id: "nl", key: "country_nl" },
  { id: "in", key: "country_in" },
  { id: "pk", key: "country_pk" },
  { id: "id", key: "country_id" },
  { id: "my", key: "country_my" },
  { id: "mx", key: "country_mx" },
  { id: "br", key: "country_br" },
  { id: "ar", key: "country_ar" },
  { id: "cl", key: "country_cl" },
  { id: "co", key: "country_co" },
  { id: "pe", key: "country_pe" },
  { id: "ru", key: "country_ru" },
  { id: "ng", key: "country_ng" },
  { id: "za", key: "country_za" },
  { id: "ae", key: "country_ae" },
  { id: "sa", key: "country_sa" },
  { id: "tr", key: "country_tr" },
  { id: "eg", key: "country_eg" }
];

// WhatsApp Business Calling API isn't integrated yet (needs Meta capability
// approval per number) — the Calls sub-tab has nothing real to show, so it's
// hidden rather than removed. Flip back to true once that integration lands.
const CALLS_SUBTAB_ENABLED = false;

export default function WhatsAppPricingTab() {
  const { t } = useTranslation();
  const { activeSubTab, setActiveSubTab } = useTab();
  const [whatsappPricingTab, setWhatsappPricingTab] = useState(
    CALLS_SUBTAB_ENABLED && activeSubTab.whatsapp !== "whatsapp-messages" ? "calls" : "messages"
  );
  const [selectedCountries, setSelectedCountries] = useState<string[]>([]);

  // countryOptionDefs' `id` is already a lowercase ISO 3166-1 alpha-2 code
  // (us, gb, de, ...) — same flagcdn.com pattern PhoneInputWithFlag.tsx
  // already relies on elsewhere in the app.
  const countryOptions = countryOptionDefs.map((c) => ({
    id: c.id,
    name: t(`whatsapp_pricing_tab.${c.key}`),
    icon: (
      <img
        src={`https://flagcdn.com/w20/${c.id}.png`}
        alt=""
        className="w-4 h-3 rounded-[2px] object-cover"
      />
    ),
  }));

  // Sync local state with context when context changes
  useEffect(() => {
    setWhatsappPricingTab(CALLS_SUBTAB_ENABLED && activeSubTab.whatsapp !== "whatsapp-messages" ? "calls" : "messages");
  }, [activeSubTab.whatsapp]);

  const handleTabChange = (tab: string) => {
    setWhatsappPricingTab(tab);
    const subTabKey = tab === "messages" ? "whatsapp-messages" : "whatsapp-calls";
    setActiveSubTab({ whatsapp: subTabKey });
  };

  return (
    <div className="space-y-4">
      {/* ── Sub-header: Minimalist Sub-tabs & Country Filter ── */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 p-1.5 rounded-xl bg-slate-100/50 dark:bg-slate-900/40 border border-slate-200/60 dark:border-slate-800/60">
        
        {/* Left: Compact Sub-tabs Switcher */}
        <div className="flex items-center p-1 bg-slate-200/50 dark:bg-slate-800/50 rounded-lg shadow-inner">
          {[
            { id: "messages", label: t("whatsapp_pricing_tab.messages_tab"), icon: <MessageSquare size={12} /> },
            ...(CALLS_SUBTAB_ENABLED ? [{ id: "calls", label: t("whatsapp_pricing_tab.calls_tab"), icon: <Phone size={12} /> }] : []),
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => handleTabChange(tab.id)}
              className={cn(
                "flex items-center gap-2 px-4 py-1.5 rounded-md text-[11px] font-bold transition-all duration-300",
                whatsappPricingTab === tab.id
                  ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm"
                  : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
              )}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {/* Right: High-density Filter */}
        <div className="flex items-center gap-3">
          <InsightsDateRangePicker tab="whatsapp" />
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-slate-200/30 dark:bg-slate-800/30">
            <Globe size={11} className="text-slate-400" />
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{t("whatsapp_pricing_tab.region_label")}</span>
          </div>
          <CustomDropdown
            options={countryOptions}
            selected={selectedCountries}
            onChange={setSelectedCountries}
            placeholder={t("whatsapp_pricing_tab.all_countries")}
            className="h-8 min-w-[130px] text-[10px] rounded-lg border-slate-200 dark:border-slate-800 shadow-sm"
            popoutAlign="right"
          />
        </div>
      </div>

      {/* Note Banner - More Professional */}
      <div className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-primary/5 dark:bg-primary/10 border border-primary/10 transition-all hover:bg-primary/10">
        <AlertCircle className="w-3.5 h-3.5 text-primary" />
        <p className="text-[10px] font-medium text-primary/80 dark:text-primary/80 leading-tight">
          <span className="font-bold uppercase tracking-wider text-[9px] mr-1.5 opacity-70">{t("whatsapp_pricing_tab.note_label")}</span>
          {t("whatsapp_pricing_tab.approximate_data_note")}
        </p>
      </div>

      {/* Filter Summary */}
      {selectedCountries.length > 0 && (
        <div className="flex items-center gap-2 px-1 animate-in fade-in slide-in-from-top-1 duration-300">
          <span className="text-[10px] font-medium text-slate-400">{t("whatsapp_pricing_tab.selected_label")}</span>
          <div className="flex flex-wrap gap-1.5">
            {selectedCountries.map(id => (
              <span key={id} className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-[9px] font-bold border border-slate-200 dark:border-slate-700">
                {countryOptions.find(c => c.id === id)?.name}
              </span>
            ))}
            <button
              onClick={() => setSelectedCountries([])}
              className="text-[9px] font-bold text-slate-400 hover:text-rose-500 transition-colors ml-1"
            >
              {t("whatsapp_pricing_tab.clear")}
            </button>
          </div>
        </div>
      )}

      {/* Tab Content */}
      <div className="mt-2">
        {/* The picker allows multiple countries, but pricing is a per-country
            rate lookup — only the first selection is meaningful, matching
            "All Countries" (undefined → backend's US default) when none is
            picked. */}
        {whatsappPricingTab === "messages" && <MessagesSubTab country={selectedCountries[0]} />}
        {whatsappPricingTab === "calls" && <CallsSubTab />}
      </div>
    </div>
  );
}
