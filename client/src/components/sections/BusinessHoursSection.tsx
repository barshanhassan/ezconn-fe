import React from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Loader2, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTheme } from "@/contexts/ThemeContext";

interface DayHours {
  enabled: boolean;
  startHour: string;
  startMinute: string;
  startPeriod: string;
  endHour: string;
  endMinute: string;
  endPeriod: string;
}

interface BusinessHoursState {
  allDayAvailability: boolean;
  allDaysSelected: boolean;
  allDays: DayHours;
  perDay: {
    monday: DayHours;
    tuesday: DayHours;
    wednesday: DayHours;
    thursday: DayHours;
    friday: DayHours;
    saturday: DayHours;
    sunday: DayHours;
  };
}

const DEFAULT_DAY: DayHours = {
  enabled: true,
  startHour: "09",
  startMinute: "00",
  startPeriod: "AM",
  endHour: "05",
  endMinute: "00",
  endPeriod: "PM",
};

const DEFAULT_STATE: BusinessHoursState = {
  allDayAvailability: false,
  allDaysSelected: true,
  allDays: { ...DEFAULT_DAY },
  perDay: {
    monday: { ...DEFAULT_DAY },
    tuesday: { ...DEFAULT_DAY },
    wednesday: { ...DEFAULT_DAY },
    thursday: { ...DEFAULT_DAY },
    friday: { ...DEFAULT_DAY },
    saturday: { ...DEFAULT_DAY, enabled: false },
    sunday: { ...DEFAULT_DAY, enabled: false },
  },
};

const BusinessHoursSection: React.FC = () => {
  const { t } = useTranslation();
  const { mode } = useTheme();
  const dark = mode === "dark";
  const { toast } = useToast();
  const [state, setState] = React.useState<BusinessHoursState>(DEFAULT_STATE);

  // ── Design tokens ─────────────────────────────────────────
  const card       = dark ? "bg-[#0f1829]"    : "bg-white";
  const border     = dark ? "border-slate-800" : "border-slate-200";
  const text       = dark ? "text-white"      : "text-slate-900";
  const sub        = dark ? "text-slate-500"  : "text-slate-400";
  const softBg     = dark ? "bg-slate-950/40" : "bg-slate-50/50";
  const softBorder = dark ? "border-slate-800" : "border-slate-100";

  const selectCls = cn(
    "h-10 rounded-xl text-[12px] font-bold transition-all px-3 pr-8 border outline-none appearance-none cursor-pointer bg-no-repeat",
    "focus:ring-2 focus:ring-primary/30 focus:border-primary/50 disabled:opacity-40 disabled:cursor-not-allowed",
    dark ? "bg-slate-950/50 border-slate-800 text-white" : "bg-white border-slate-200 text-slate-900",
    dark
      ? "bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2210%22 height=%2210%22 viewBox=%220 0 24 24%22 fill=%22none%22 stroke=%22%2394a3b8%22 stroke-width=%222%22><polyline points=%226 9 12 15 18 9%22/></svg>')]"
      : "bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2210%22 height=%2210%22 viewBox=%220 0 24 24%22 fill=%22none%22 stroke=%22%2364748b%22 stroke-width=%222%22><polyline points=%226 9 12 15 18 9%22/></svg>')]",
    "[background-position:right_0.6rem_center]"
  );

  const primaryBtn =
    "h-11 px-7 rounded-xl bg-primary hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed text-white text-[11px] font-semibold transition-all shadow-lg shadow-primary/20 flex items-center gap-2";

  const labelCls = cn("block text-[11px] font-semibold", sub);

  const { isLoading, data: fetchedData } = useQuery<BusinessHoursState | null>({
    queryKey: ["/api/workspaces/business-hours"],
  });

  React.useEffect(() => {
    if (fetchedData) setState(fetchedData);
  }, [fetchedData]);

  const mutation = useMutation({
    mutationFn: async (data: BusinessHoursState) => {
      const res = await apiRequest("POST", "/api/workspaces/business-hours", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/workspaces/business-hours"] });
      toast({ title: t("business_hours_section.toast_success_title"), description: t("business_hours_section.toast_success_description") });
    },
    onError: (error: Error) => {
      toast({ title: t("business_hours_section.toast_error_title"), description: error.message, variant: "destructive" });
    },
  });

  const handleAllDaysHoursChange = (part: keyof DayHours, value: string) => {
    setState((prev) => ({ ...prev, allDays: { ...prev.allDays, [part]: value } }));
  };

  const handlePerDayHoursChange = (day: keyof BusinessHoursState["perDay"], part: keyof DayHours, value: string) => {
    setState((prev) => ({ ...prev, perDay: { ...prev.perDay, [day]: { ...prev.perDay[day], [part]: value } } }));
  };

  const handlePerDayEnabledChange = (day: keyof BusinessHoursState["perDay"], enabled: boolean) => {
    setState((prev) => ({ ...prev, perDay: { ...prev.perDay, [day]: { ...prev.perDay[day], enabled } } }));
  };

  const daysOfWeek = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];

  const TimePicker = ({
    hours,
    onChange,
    prefix,
    disabled,
  }: {
    hours: DayHours;
    onChange: (part: keyof DayHours, value: string) => void;
    prefix: "start" | "end";
    disabled?: boolean;
  }) => {
    const h = prefix === "start" ? hours.startHour : hours.endHour;
    const m = prefix === "start" ? hours.startMinute : hours.endMinute;
    const p = prefix === "start" ? hours.startPeriod : hours.endPeriod;
    const hKey = (prefix === "start" ? "startHour" : "endHour") as keyof DayHours;
    const mKey = (prefix === "start" ? "startMinute" : "endMinute") as keyof DayHours;
    const pKey = (prefix === "start" ? "startPeriod" : "endPeriod") as keyof DayHours;
    return (
      <div className="flex gap-2">
        <select value={h} onChange={(e) => onChange(hKey, e.target.value)} disabled={disabled} className={cn(selectCls, "w-[68px]")}>
          {Array.from({ length: 12 }, (_, i) => `${i + 1}`.padStart(2, "0")).map((v) => (
            <option key={v} value={v}>{v}</option>
          ))}
        </select>
        <select value={m} onChange={(e) => onChange(mKey, e.target.value)} disabled={disabled} className={cn(selectCls, "w-[68px]")}>
          {["00", "15", "30", "45"].map((v) => (
            <option key={v} value={v}>{v}</option>
          ))}
        </select>
        <select value={p} onChange={(e) => onChange(pKey, e.target.value)} disabled={disabled} className={cn(selectCls, "w-[78px]")}>
          <option value="AM">AM</option>
          <option value="PM">PM</option>
        </select>
      </div>
    );
  };

  const RadioRow = ({ value, current, onSelect, label }: { value: string; current: string; onSelect: () => void; label: string }) => (
    <div
      onClick={onSelect}
      className={cn(
        "flex items-center gap-3 px-5 py-3 rounded-xl border cursor-pointer transition-all",
        current === value ? "border-primary bg-primary/5" : cn(softBorder, dark ? "bg-slate-900/40 hover:border-primary/40" : "bg-white hover:border-primary/40")
      )}
    >
      <div className={cn("w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0", current === value ? "border-primary" : sub)}>
        {current === value && <div className="w-2 h-2 rounded-full bg-primary" />}
      </div>
      <span className={cn("text-[13px] font-semibold", text)}>{label}</span>
    </div>
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const currentMode = state.allDaysSelected ? "allDays" : "perDay";

  return (
    <Card className={cn("rounded-[2rem] border overflow-hidden shadow-sm transition-all duration-300", card, border)}>
      <CardContent className="p-0">
        {/* Header */}
        <div className={cn("px-8 py-5 border-b flex items-center justify-between", border)}>
          <div className="flex items-center gap-4">
            <div className={cn("p-2.5 rounded-xl shadow-sm", "bg-primary/10")}>
              <Clock className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className={cn("text-[16px] font-bold tracking-tight", text)}>{t("business_hours_section.title")}</h1>
              <p className={cn("text-[11px] font-medium mt-0.5 opacity-60 max-w-2xl", sub)}>
                {t("business_hours_section.subtitle")}
              </p>
            </div>
          </div>
          <button
            onClick={() => mutation.mutate(state)}
            disabled={mutation.isPending}
            className={primaryBtn}
          >
            {mutation.isPending && <Loader2 size={12} className="animate-spin" />}
            {t("business_hours_section.save")}
          </button>
        </div>

        {/* Body */}
        <div className="p-8 space-y-6">
          {/* 24/7 toggle */}
          <div className={cn("flex items-center justify-between p-5 rounded-[1.5rem] border", softBg, softBorder)}>
            <div>
              <p className={cn("text-[13px] font-black", text)}>{t("business_hours_section.enable_24_7")}</p>
              <p className={cn("text-[11px] font-medium opacity-60 mt-0.5", sub)}>
                {t("business_hours_section.enable_24_7_desc")}
              </p>
            </div>
            <Switch
              checked={state.allDayAvailability}
              onCheckedChange={(val) => setState((p) => ({ ...p, allDayAvailability: val }))}
              className="data-[state=checked]:bg-primary"
            />
          </div>

          {!state.allDayAvailability && (
            <>
              {/* Mode selector */}
              <div className="space-y-3">
                <label className={labelCls}>{t("business_hours_section.schedule_type")}</label>
                <div className="grid grid-cols-2 gap-3 max-w-md">
                  <RadioRow value="allDays" current={currentMode} onSelect={() => setState((p) => ({ ...p, allDaysSelected: true }))} label={t("business_hours_section.all_days")} />
                  <RadioRow value="perDay" current={currentMode} onSelect={() => setState((p) => ({ ...p, allDaysSelected: false }))} label={t("business_hours_section.per_day")} />
                </div>
              </div>

              {state.allDaysSelected ? (
                <div className={cn("rounded-[1.5rem] border p-6 space-y-5 max-w-md", softBg, softBorder)}>
                  <p className={cn("text-[12px] font-semibold text-primary")}>{t("business_hours_section.all_days")}</p>
                  <div className="space-y-2">
                    <label className={labelCls}>{t("business_hours_section.start_time")}</label>
                    <TimePicker hours={state.allDays} onChange={handleAllDaysHoursChange} prefix="start" />
                  </div>
                  <div className="space-y-2">
                    <label className={labelCls}>{t("business_hours_section.end_time")}</label>
                    <TimePicker hours={state.allDays} onChange={handleAllDaysHoursChange} prefix="end" />
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {daysOfWeek.map((dayString) => {
                    const day = dayString as keyof BusinessHoursState["perDay"];
                    const hours = state.perDay[day];
                    return (
                      <div
                        key={day}
                        className={cn(
                          "rounded-[1.5rem] border p-5 space-y-4 transition-all",
                          hours.enabled ? "border-primary/30 bg-primary/5" : cn(softBg, softBorder)
                        )}
                      >
                        <div className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            id={`cb-${day}`}
                            checked={hours.enabled}
                            onChange={(e) => handlePerDayEnabledChange(day, e.target.checked)}
                            className="rounded accent-[hsl(var(--primary))] w-4 h-4"
                          />
                          <label htmlFor={`cb-${day}`} className={cn("text-[13px] font-semibold cursor-pointer", text)}>
                            {t(`business_hours_section.days.${day}`)}
                          </label>
                        </div>
                        <div className="space-y-2">
                          <label className={labelCls}>{t("business_hours_section.start_time")}</label>
                          <TimePicker hours={hours} onChange={(part, val) => handlePerDayHoursChange(day, part, val)} prefix="start" disabled={!hours.enabled} />
                        </div>
                        <div className="space-y-2">
                          <label className={labelCls}>{t("business_hours_section.end_time")}</label>
                          <TimePicker hours={hours} onChange={(part, val) => handlePerDayHoursChange(day, part, val)} prefix="end" disabled={!hours.enabled} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default BusinessHoursSection;
