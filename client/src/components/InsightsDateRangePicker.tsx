import { useState } from "react";
import { useTranslation } from "react-i18next";
import { format } from "date-fns";
import { useDateRange, InsightsTabKey } from "@/contexts/DateRangeContext";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Switch } from "@/components/ui/switch";
import { Calendar as CalendarIcon, Link2, Unlink } from "lucide-react";

/**
 * Insights Dashboard's date-range picker — hybrid global/independent.
 * By default every tab shares one global range (set from any tab, applies
 * to all). Flipping the "Independent" switch inside the popover breaks
 * this ONE tab off onto its own range without touching the others —
 * e.g. WhatsApp charges on "this month" while Performance stays on
 * "last 7 days". Overview never renders this (see OverviewTab.tsx).
 */
export default function InsightsDateRangePicker({ tab }: { tab: InsightsTabKey }) {
  const { t } = useTranslation();
  const { globalDate, setGlobalDate, isOverridden, setOverrideEnabled, setOverrideDate, effectiveDate } = useDateRange();
  const [open, setOpen] = useState(false);

  const overridden = isOverridden(tab);
  const shown = effectiveDate(tab);
  const currentDate = overridden ? shown : globalDate;
  const onSelect = overridden ? (d: any) => setOverrideDate(tab, d) : setGlobalDate;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          style={{ borderRadius: "6px" }}
          className="h-9 px-3 bg-white dark:bg-slate-800/50 border border-input shadow-sm hover:bg-slate-50 dark:hover:bg-slate-800 text-[12px] font-medium text-slate-700 dark:text-slate-200 gap-2"
          data-testid={`button-insights-date-range-${tab}`}
        >
          {overridden ? <Unlink className="h-3.5 w-3.5 text-primary shrink-0" /> : <CalendarIcon className="h-3.5 w-3.5 text-slate-400 shrink-0" />}
          <span className="whitespace-nowrap">
            {shown?.from ? format(shown.from, "dd MMM") : t("insights_dashboard.range_start")}
            {" – "}
            {shown?.to ? format(shown.to, "dd MMM") : t("insights_dashboard.range_end")}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0 rounded-2xl border border-input dark:border-slate-800 shadow-2xl overflow-hidden" align="end">
        <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
          <div className="flex items-center gap-2">
            {overridden ? <Unlink className="h-3.5 w-3.5 text-primary" /> : <Link2 className="h-3.5 w-3.5 text-slate-400" />}
            <div>
              <p className="text-[11px] font-bold text-slate-700 dark:text-slate-200">{t("insights_dashboard.independent_range")}</p>
              <p className="text-[10px] text-slate-400">
                {overridden ? t("insights_dashboard.independent_range_on_desc") : t("insights_dashboard.independent_range_off_desc")}
              </p>
            </div>
          </div>
          <Switch
            checked={overridden}
            onCheckedChange={(checked) => setOverrideEnabled(tab, checked)}
            data-testid={`switch-independent-range-${tab}`}
          />
        </div>
        <CalendarComponent
          mode="range"
          selected={currentDate}
          onSelect={onSelect}
          className="bg-white dark:bg-slate-900"
        />
      </PopoverContent>
    </Popover>
  );
}
