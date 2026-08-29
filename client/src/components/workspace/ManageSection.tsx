import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Settings,
  Copy,
  Lock,
  AlertCircle,
  LayoutGrid,
  Globe,
  Calendar,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useTheme } from "@/contexts/ThemeContext";
import { cn } from "@/lib/utils";
import { TIMEZONES } from "@/lib/timezones";
import { getUserInfo, hasAnyPerm } from "@/lib/auth";
import { useTranslation } from "react-i18next";

export default function ManageSection() {
  const { mode } = useTheme();
  const { toast } = useToast();
  const { t } = useTranslation();
  const dark = mode === "dark";

  // Replyagent parity (AccountSettings.vue): editing workspace settings needs
  // `workspace.settings.manage`. Owners always pass (they implicitly hold
  // workspace.*); newly-created agents are gated by their role's permission —
  // without it the fields are read-only and the Save button is hidden. The
  // backend PATCH enforces the same slug, so this is UI affordance only.
  const me = getUserInfo();
  const canManage = me.is_owner === true || hasAnyPerm(me.permissions, ["workspace.settings.manage"]);

  const bg     = dark ? "bg-[#0b1120]"   : "bg-slate-50/80";
  const card   = dark ? "bg-[#0f1829]"   : "bg-white";
  const border = dark ? "border-slate-800" : "border-slate-200";
  const text   = dark ? "text-white"     : "text-slate-900";
  const sub    = dark ? "text-slate-500" : "text-slate-400";

  const { data: workspaceData, isLoading, isError } = useQuery<any>({
    queryKey: ["/api/workspaces/current"],
  });

  const updateMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("PATCH", "/api/workspaces/current", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/workspaces/current"] });
      toast({ title: t("settings.workspace.manage_section.success_title"), description: t("settings.workspace.manage_section.success_desc") });
    },
    onError: (error: any) => {
      toast({
        title: t("settings.workspace.manage_section.error_title"),
        description: error.message || t("settings.workspace.manage_section.error_desc"),
        variant: "destructive",
      });
    },
  });

  const workspaceId = workspaceData?.id?.toString() || "1";
  // replyagent shows `{activeDomain.domain}/login`. In workspace mode the current host IS the
  // workspace domain, so origin + /login mirrors that exactly.
  const loginUrl = typeof window !== "undefined" ? `${window.location.origin}/login` : "";

  const [workspaceName, setWorkspaceName] = useState("");
  const [timezone, setTimezone] = useState("America/Fortaleza");
  const [firstDayOfWeek, setFirstDayOfWeek] = useState("sunday");

  useEffect(() => {
    if (workspaceData) {
      setWorkspaceName(workspaceData.name || "");
      if (workspaceData.timezone) setTimezone(workspaceData.timezone);
      if (workspaceData.first_day_week) setFirstDayOfWeek(workspaceData.first_day_week.toLowerCase());
    }
  }, [workspaceData]);

  const getCurrentTime = () => {
    try {
      return new Date().toLocaleTimeString("en-US", {
        timeZone: timezone || "UTC",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      });
    } catch {
      return "—";
    }
  };

  const handleCopy = (val: string) => {
    if (!val) return;
    navigator.clipboard.writeText(val);
    toast({ title: t("settings.workspace.manage_section.copied_title"), description: t("settings.workspace.manage_section.copied_desc") });
  };

  const handleSave = () => {
    updateMutation.mutate({ name: workspaceName, timezone, firstDayOfWeek });
  };

  const handleDiscard = () => {
    if (!workspaceData) return;
    setWorkspaceName(workspaceData.name || "");
    setTimezone(workspaceData.timezone || "America/Fortaleza");
    setFirstDayOfWeek(workspaceData.first_day_week ? workspaceData.first_day_week.toLowerCase() : "sunday");
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className={cn("p-8 text-center rounded-[2rem] border border-rose-500/20 bg-rose-500/5")}>
        <AlertCircle className="w-10 h-10 text-rose-500 mx-auto mb-3" />
        <p className="text-rose-500 font-black text-sm">{t("settings.workspace.manage_section.load_error")}</p>
      </div>
    );
  }

  const inputCls = cn(
    "h-11 rounded-lg text-[13px] font-medium transition-all px-4",
    "focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:border-primary/50",
    dark ? "bg-slate-950/50 border-slate-800 text-white" : "bg-white border-slate-200 text-slate-900"
  );

  return (
    <Card className={cn("rounded-2xl border overflow-hidden shadow-sm transition-all duration-300", card, border)}>
      <CardContent className="p-0">
        {/* ── Header ── */}
        <div className={cn("px-8 py-5 border-b flex items-center gap-3", border)}>
          <Settings className={cn("w-5 h-5", text)} />
          <div>
            <h1 className={cn("text-[16px] font-bold tracking-tight", text)}>{t("settings.workspace.manage_section.title")}</h1>
            <p className={cn("text-[12px] font-medium mt-0.5 opacity-60", sub)}>
              {t("settings.workspace.manage_section.description")}
            </p>
          </div>
        </div>

        {/* ── Flat field list — one simple row per setting ── */}
        <div className="px-8 py-6">

          <PlainRow dark={dark} label={t("settings.workspace.manage_section.workspace_id")} icon={<LayoutGrid size={14} />} description={t("settings.workspace.manage_section.workspace_id_help")}>
            <div className="relative">
              <Input readOnly value={workspaceId} className={cn(inputCls, "pr-11 cursor-default opacity-90")} />
              <Lock className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 opacity-40" />
            </div>
          </PlainRow>

          <PlainRow dark={dark} label={t("settings.workspace.manage_section.workspace_name")} icon={<Settings size={14} />} description={t("settings.workspace.manage_section.workspace_name_help")}>
            <Input
              value={workspaceName}
              onChange={(e) => setWorkspaceName(e.target.value)}
              maxLength={100}
              disabled={!canManage}
              className={cn(inputCls, !canManage && "opacity-60 cursor-not-allowed")}
            />
          </PlainRow>

          <PlainRow dark={dark} label={t("settings.workspace.manage_section.timezone")} icon={<Globe size={14} />} description={t("settings.workspace.manage_section.timezone_help")}>
            <Select value={timezone} onValueChange={setTimezone} disabled={!canManage}>
              <SelectTrigger className={cn(inputCls, !canManage && "opacity-60 cursor-not-allowed")}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent className={cn("rounded-xl border shadow-2xl max-h-72", dark ? "bg-[#0f1829] border-slate-800 text-white" : "bg-white border-slate-200")}>
                {TIMEZONES.map((tz) => (
                  <SelectItem key={tz.id} value={tz.id} className="text-[12px] font-medium">
                    {tz.name} ({tz.id})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className={cn("text-[11px] font-medium mt-1.5 opacity-60", sub)}>
              {t("settings.workspace.manage_section.current_time")}: <span className={cn("font-semibold", text)}>{getCurrentTime()}</span>
            </p>
          </PlainRow>

          <PlainRow dark={dark} label={t("settings.workspace.manage_section.first_day")} icon={<Calendar size={14} />} description={t("settings.workspace.manage_section.first_day_info")}>
            <Select value={firstDayOfWeek} onValueChange={setFirstDayOfWeek} disabled={!canManage}>
              <SelectTrigger className={cn(inputCls, !canManage && "opacity-60 cursor-not-allowed")}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent className={cn("rounded-xl border shadow-2xl", dark ? "bg-[#0f1829] border-slate-800 text-white" : "bg-white border-slate-200")}>
                <SelectItem value="sunday" className="text-[12px] font-medium">{t("settings.workspace.manage_section.sunday")}</SelectItem>
                <SelectItem value="monday" className="text-[12px] font-medium">{t("settings.workspace.manage_section.monday")}</SelectItem>
                <SelectItem value="tuesday" className="text-[12px] font-medium">{t("settings.workspace.manage_section.tuesday")}</SelectItem>
                <SelectItem value="wednesday" className="text-[12px] font-medium">{t("settings.workspace.manage_section.wednesday")}</SelectItem>
                <SelectItem value="thursday" className="text-[12px] font-medium">{t("settings.workspace.manage_section.thursday")}</SelectItem>
                <SelectItem value="friday" className="text-[12px] font-medium">{t("settings.workspace.manage_section.friday")}</SelectItem>
                <SelectItem value="saturday" className="text-[12px] font-medium">{t("settings.workspace.manage_section.saturday")}</SelectItem>
              </SelectContent>
            </Select>
          </PlainRow>

          <PlainRow dark={dark} label={t("settings.workspace.manage_section.login_url")} icon={<Globe size={14} />} description={t("settings.workspace.manage_section.login_url_help")} last>
            <div className="flex gap-2">
              <Input readOnly value={loginUrl || t("settings.workspace.manage_section.no_login_url")} className={cn(inputCls, "flex-1 cursor-default", !loginUrl && "opacity-60")} />
              <button
                onClick={() => handleCopy(loginUrl)}
                className={cn(
                  "h-11 px-5 rounded-lg border text-[12px] font-semibold transition-all flex items-center gap-2 shrink-0",
                  dark
                    ? "border-slate-800 text-slate-200 hover:border-primary/40 hover:text-primary"
                    : "border-slate-200 text-slate-700 hover:border-primary/40 hover:text-primary"
                )}
              >
                <Copy size={12} /> {t("settings.workspace.manage_section.copy")}
              </button>
            </div>
          </PlainRow>

        </div>

        {/* Save Footer — owners + agents with workspace.settings.manage only
            (replyagent hides the whole footer otherwise). */}
        {canManage && (
          <div className={cn("px-8 py-4 border-t flex justify-end items-center gap-3", border)}>
            <button
              onClick={handleDiscard}
              disabled={updateMutation.isPending}
              className={cn(
                "h-10 px-5 rounded-lg border text-[12px] font-semibold transition-all disabled:opacity-50",
                dark
                  ? "border-slate-800 text-slate-200 hover:border-slate-700"
                  : "border-slate-200 text-slate-700 hover:border-slate-300"
              )}
            >
              {t("settings.workspace.manage_section.discard")}
            </button>
            <button
              onClick={handleSave}
              disabled={updateMutation.isPending}
              className="h-10 px-6 rounded-lg bg-primary hover:bg-primary/90 disabled:opacity-50 text-white text-[12px] font-semibold transition-all"
            >
              {updateMutation.isPending ? t("settings.workspace.manage_section.saving") : t("settings.workspace.manage_section.save_changes")}
            </button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/* ── Plain Row Helper — label and field side-by-side in the same row,
   thin divider between rows, matching ReplyAgent's flat Workspace
   Settings card, with a small colored icon badge + helper description
   under the label. */
type PlainRowProps = {
  dark: boolean;
  label: string;
  icon?: React.ReactNode;
  description?: string;
  last?: boolean;
  children: React.ReactNode;
};

function PlainRow({ dark, label, icon, description, last, children }: PlainRowProps) {
  const border = dark ? "border-slate-800" : "border-slate-100";
  const text   = dark ? "text-white"       : "text-slate-900";
  const sub    = dark ? "text-slate-500"   : "text-slate-400";

  return (
    <div className={cn("grid grid-cols-1 md:grid-cols-12 items-center gap-2 md:gap-6 pb-5", !last && "mb-5 border-b", border)}>
      <div className="md:col-span-3 space-y-0.5">
        <div className="flex items-center gap-2">
          {icon && <div className="p-1.5 rounded-lg bg-primary/10 text-primary">{icon}</div>}
          <h4 className={cn("text-[13px] font-semibold", text)}>{label}</h4>
        </div>
        {description && (
          <p className={cn("text-[11px] font-medium leading-relaxed opacity-60 pl-1", sub)}>
            {description}
          </p>
        )}
      </div>
      <div className="md:col-span-9">{children}</div>
    </div>
  );
}
