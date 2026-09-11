import React, { createContext, useContext, useMemo, useState } from "react";
import { DateRange } from "react-day-picker";

// Default window before the user picks anything — matches every Insights
// Dashboard endpoint's previous hardcoded "last 7 days".
function defaultRange(): DateRange {
  const to = new Date();
  const from = new Date();
  from.setDate(to.getDate() - 6);
  return { from, to };
}

const toIsoDate = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

/**
 * Tab keys that can hold their own independent date-range override,
 * breaking off from the shared global range. One entry per Insights
 * Dashboard tab that has a range picker (Overview is excluded — its
 * cards are deliberately multi-scale and never read this context).
 */
export type InsightsTabKey = "performance" | "whatsapp" | "bot" | "voice" | "csat";

interface DateRangeContextType {
  /** The shared range every tab uses unless it has its own override set. */
  globalDate: DateRange | undefined;
  setGlobalDate: (date: DateRange | undefined) => void;
  /** Per-tab overrides — set when a tab opts out of the global range. */
  overrides: Partial<Record<InsightsTabKey, DateRange | undefined>>;
  isOverridden: (tab: InsightsTabKey) => boolean;
  /** Turn independent mode on/off for a tab. Turning off clears its override
   * and falls back to the global range immediately. */
  setOverrideEnabled: (tab: InsightsTabKey, enabled: boolean) => void;
  /** Update a tab's own override range (only meaningful while enabled). */
  setOverrideDate: (tab: InsightsTabKey, date: DateRange | undefined) => void;
  /** The DateRange currently in effect for a tab (its override, or global). */
  effectiveDate: (tab: InsightsTabKey) => DateRange | undefined;
  /** ISO yyyy-MM-dd from/to for a tab's effective range — always populated
   * (falls back to the last-7-days default), ready for `?from=&to=`. */
  rangeFor: (tab: InsightsTabKey) => { from: string; to: string };
}

const DateRangeContext = createContext<DateRangeContextType | undefined>(undefined);

export function DateRangeProvider({ children }: { children: React.ReactNode }) {
  const [globalDate, setGlobalDate] = useState<DateRange | undefined>(defaultRange());
  const [overrides, setOverrides] = useState<Partial<Record<InsightsTabKey, DateRange | undefined>>>({});

  const isOverridden = (tab: InsightsTabKey) => overrides[tab] !== undefined;

  const setOverrideEnabled = (tab: InsightsTabKey, enabled: boolean) => {
    setOverrides((prev) => {
      const next = { ...prev };
      if (enabled) {
        // Start the override from whatever the global range currently is,
        // so switching to independent mode doesn't silently reset to
        // last-7-days — it just stops following the global one from here.
        next[tab] = globalDate ?? defaultRange();
      } else {
        delete next[tab];
      }
      return next;
    });
  };

  const setOverrideDate = (tab: InsightsTabKey, date: DateRange | undefined) => {
    setOverrides((prev) => ({ ...prev, [tab]: date }));
  };

  const effectiveDate = (tab: InsightsTabKey) => overrides[tab] ?? globalDate;

  const rangeFor = (tab: InsightsTabKey) => {
    const range = effectiveDate(tab);
    const resolved = range?.from && range?.to ? range : defaultRange();
    return { from: toIsoDate(resolved.from!), to: toIsoDate(resolved.to!) };
  };

  const value = useMemo<DateRangeContextType>(
    () => ({
      globalDate,
      setGlobalDate,
      overrides,
      isOverridden,
      setOverrideEnabled,
      setOverrideDate,
      effectiveDate,
      rangeFor,
    }),
    [globalDate, overrides],
  );

  return <DateRangeContext.Provider value={value}>{children}</DateRangeContext.Provider>;
}

export function useDateRange() {
  const context = useContext(DateRangeContext);
  if (!context) {
    throw new Error("useDateRange must be used within DateRangeProvider");
  }
  return context;
}
