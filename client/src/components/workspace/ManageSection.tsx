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
  Clock,
  Calendar,
  Lock,
  Info,
  CheckCircle2,
  AlertCircle,
  LayoutGrid,
  Globe,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useTheme } from "@/contexts/ThemeContext";
import { cn } from "@/lib/utils";
import { TIMEZONES } from "@/lib/timezones";
import { getUserInfo, hasAnyPerm } from "@/lib/auth";

export default function ManageSection() {
  const { mode } = useTheme();
  const { toast } = useToast();
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
  const softBg = dark ? "bg-slate-950/40" : "bg-slate-50/50";
  const softBorder = dark ? "border-slate-800" : "border-slate-100";

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
      toast({ title: "Saved", description: "Workspace settings saved successfully." });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update workspace",
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
    toast({ title: "Copied!", description: "Copied to clipboard." });
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
        <p className="text-rose-500 font-black text-sm">Failed to load workspace settings</p>
      </div>
    );
  }

  const inputCls = cn(
    "h-11 rounded-xl text-[13px] font-bold transition-all px-4",
    "focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:border-primary/50",
    dark ? "bg-slate-950/50 border-slate-800 text-white" : "bg-white border-slate-200 text-slate-900"
  );

  return (
    <Card className={cn("rounded-[2rem] border overflow-hidden shadow-sm transition-all duration-300", card, border)}>
      <CardContent className="p-0">
        {/* ── Header ── */}
        <div className={cn("px-8 py-4 border-b flex items-center justify-between", border)}>
          <div className="flex items-center gap-4">
            <div className={cn("p-2.5 rounded-xl shadow-sm", dark ? "bg-primary/15" : "bg-primary/10")}>
              <Settings className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className={cn("text-[16px] font-bold tracking-tight", text)}>Workspace settings</h1>
              <p className={cn("text-[11px] font-medium mt-0.5 opacity-60", sub)}>
                Manage your workspace settings
              </p>
            </div>
          </div>
          <button
            onClick={() => handleCopy(workspaceId)}
            className={cn(
              "h-10 px-5 rounded-xl border text-[11px] font-semibold transition-all flex items-center gap-2",
              dark
                ? "border-slate-800 text-slate-200 hover:border-primary/40 hover:text-primary"
                : "border-slate-200 text-slate-700 hover:border-primary/40 hover:text-primary"
            )}
          >
            <Copy size={12} /> Copy ID
          </button>
        </div>

        <div>

          {/* Workspace ID */}
          <FieldRow
            dark={dark}
            label="Workspace ID"
            // Kept "ID" in caps since it's an initialism — everything
            // else in this section reads as sentence case now.
            icon={<LayoutGrid size={14} />}
            description="Unique identifier for your workspace"
          >
            <div className="relative">
              <Input readOnly value={workspaceId} className={cn(inputCls, "pr-11 cursor-default opacity-90 font-black")} />
              <Lock className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 opacity-40" />
            </div>
            <div className="flex items-center gap-2 text-[11px] font-semibold text-emerald-500 mt-2">
              <CheckCircle2 size={12} /> Configured
            </div>
          </FieldRow>

          {/* Workspace Name */}
          <FieldRow
            dark={dark}
            label="Workspace name"
            icon={<Settings size={14} />}
            description="Your workspace display name"
            required
          >
            <div className="relative">
              <Input
                value={workspaceName}
                onChange={(e) => setWorkspaceName(e.target.value)}
                maxLength={100}
                disabled={!canManage}
                className={cn(inputCls, "pr-14", !canManage && "opacity-60 cursor-not-allowed")}
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[11px] font-semibold opacity-40">
                {workspaceName.length}/100
              </span>
            </div>
          </FieldRow>

          {/* Timezone */}
          <FieldRow
            dark={dark}
            label="Timezone"
            icon={<Globe size={14} />}
            description="Used for automation triggers and scheduling"
            required
          >
            <Select value={timezone} onValueChange={setTimezone} disabled={!canManage}>
              <SelectTrigger className={cn(inputCls, !canManage && "opacity-60 cursor-not-allowed")}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent className={cn("rounded-xl border shadow-2xl max-h-72", dark ? "bg-[#0f1829] border-slate-800 text-white" : "bg-white border-slate-200")}>
                {TIMEZONES.map((tz) => (
                  <SelectItem key={tz.id} value={tz.id} className="text-[12px] font-bold">
                    {tz.name} ({tz.id})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className={cn("mt-3 p-4 rounded-[1.25rem] border flex items-center justify-between", softBg, softBorder)}>
              <div className="flex items-center gap-4">
                <div className="p-2 rounded-xl bg-primary/10 text-primary">
                  <Clock size={18} />
                </div>
                <div>
                  <p className={cn("text-[11px] font-semibold opacity-60", sub)}>Current time</p>
                  <p className={cn("text-[18px] font-black tracking-tight mt-0.5", text)}>{getCurrentTime()}</p>
                </div>
              </div>
              <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-500">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                Live
              </span>
            </div>
          </FieldRow>

          {/* First Day of Week */}
          <FieldRow
            dark={dark}
            label="First day of week"
            icon={<Calendar size={14} />}
            description="Recommended for business: Monday"
            required
          >
            <Select value={firstDayOfWeek} onValueChange={setFirstDayOfWeek} disabled={!canManage}>
              <SelectTrigger className={cn(inputCls, !canManage && "opacity-60 cursor-not-allowed")}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent className={cn("rounded-xl border shadow-2xl", dark ? "bg-[#0f1829] border-slate-800 text-white" : "bg-white border-slate-200")}>
                <SelectItem value="sunday" className="text-[12px] font-bold">Sunday</SelectItem>
                <SelectItem value="monday" className="text-[12px] font-bold">Monday</SelectItem>
                <SelectItem value="tuesday" className="text-[12px] font-bold">Tuesday</SelectItem>
                <SelectItem value="wednesday" className="text-[12px] font-bold">Wednesday</SelectItem>
                <SelectItem value="thursday" className="text-[12px] font-bold">Thursday</SelectItem>
                <SelectItem value="friday" className="text-[12px] font-bold">Friday</SelectItem>
                <SelectItem value="saturday" className="text-[12px] font-bold">Saturday</SelectItem>
              </SelectContent>
            </Select>

            <div className={cn("mt-3 p-4 rounded-[1.25rem] border", softBg, softBorder)}>
              <p className={cn("text-[11px] font-semibold opacity-60 mb-2", sub)}>Calendar preview</p>
              <div className="flex gap-2">
                {(() => {
                  const WEEK = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
                  const LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
                  const start = Math.max(0, WEEK.indexOf((firstDayOfWeek || "sunday").slice(0, 3)));
                  return [...LABELS.slice(start), ...LABELS.slice(0, start)];
                })().map((d, i) => {
                  const active = i === 0;
                  return (
                    <div
                      key={d}
                      className={cn(
                        "flex-1 h-9 rounded-lg flex items-center justify-center text-[11px] font-semibold transition-all",
                        active
                          ? "bg-primary text-white shadow-lg shadow-primary/20"
                          : dark
                            ? "bg-slate-900/50 text-slate-500"
                            : "bg-white border border-slate-200 text-slate-400"
                      )}
                    >
                      {d}
                    </div>
                  );
                })}
              </div>
            </div>
          </FieldRow>

          {/* Login URL */}
          <FieldRow
            dark={dark}
            label="Login URL"
            // "URL" stays capitalised as an initialism.
            icon={<Globe size={14} />}
            description="Optional — custom login URL for your workspace"
            optional
            last
          >
            <div className="flex gap-2">
              <Input readOnly value={loginUrl || "No login URL configured"} className={cn(inputCls, "flex-1 cursor-default", !loginUrl && "opacity-60")} />
              <button
                onClick={() => handleCopy(loginUrl)}
                className={cn(
                  "h-11 px-5 rounded-xl border text-[11px] font-semibold transition-all flex items-center gap-2 shrink-0",
                  dark
                    ? "border-slate-800 text-slate-200 hover:border-primary/40 hover:text-primary"
                    : "border-slate-200 text-slate-700 hover:border-primary/40 hover:text-primary"
                )}
              >
                <Copy size={12} /> Copy
              </button>
            </div>
            {loginUrl ? (
              <div className="flex items-center gap-2 text-[11px] font-semibold text-emerald-500 mt-2">
                <CheckCircle2 size={12} /> Configured
              </div>
            ) : (
              <div className="flex items-center gap-2 text-[11px] font-semibold text-amber-500 mt-2">
                <div className="w-1.5 h-1.5 rounded-full bg-amber-500" /> Not configured
              </div>
            )}
          </FieldRow>

          {/* Save Footer — owners + agents with workspace.settings.manage only
              (replyagent hides the whole footer otherwise). */}
          {canManage && (
            <div className={cn("px-8 py-4 border-t flex justify-end items-center gap-3", border)}>
              <p className={cn("text-[11px] font-bold opacity-50 mr-auto", sub)}>
                <Info size={12} className="inline-block mr-1.5 -mt-0.5" />
                Changes save instantly across all sessions
              </p>
              <button
                onClick={handleDiscard}
                disabled={updateMutation.isPending}
                className={cn(
                  "h-11 px-6 rounded-xl border text-[11px] font-semibold transition-all disabled:opacity-50",
                  dark
                    ? "border-slate-800 text-slate-200 hover:border-slate-700"
                    : "border-slate-200 text-slate-700 hover:border-slate-300"
                )}
              >
                Discard
              </button>
              <button
                onClick={handleSave}
                disabled={updateMutation.isPending}
                className="h-11 px-8 rounded-xl bg-primary hover:bg-primary/90 disabled:opacity-50 text-white text-[11px] font-semibold transition-all shadow-lg shadow-primary/20"
              >
                {updateMutation.isPending ? "Saving..." : "Save Changes"}
              </button>
            </div>
          )}

        </div>
      </CardContent>
    </Card>
  );
}

/* ── Field Row Helper ── */
type FieldRowProps = {
  dark: boolean;
  label: string;
  description?: string;
  icon?: React.ReactNode;
  required?: boolean;
  optional?: boolean;
  last?: boolean;
  children: React.ReactNode;
};

function FieldRow({ dark, label, description, icon, required, optional, last, children }: FieldRowProps) {
  const border = dark ? "border-slate-800" : "border-slate-100";
  const text   = dark ? "text-white"       : "text-slate-900";
  const sub    = dark ? "text-slate-500"   : "text-slate-400";

  return (
    // Tightened row: gap-2 vertical (was gap-6) so mobile stack has no
    // extra breathing room between label and field. Padding trimmed
    // (py-4 instead of py-7) so the row reads compact. Label styling
    // shifts from small-caps chip to plain sentence-case text — the
    // treatment made every field feel like a
    // header, which competed with the section title.
    <div className={cn("grid grid-cols-1 md:grid-cols-12 gap-2 md:gap-6 px-8 py-3", !last && "border-b", border)}>
      <div className="md:col-span-4 space-y-0.5">
        <div className="flex items-center gap-2">
          {icon && <div className="p-1.5 rounded-lg bg-primary/10 text-primary">{icon}</div>}
          <h4 className={cn("text-[13px] font-semibold", text)}>{label}</h4>
          {required && <span className="text-rose-500 text-sm leading-none">*</span>}
          {optional && (
            <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-md", dark ? "bg-slate-800 text-slate-400" : "bg-slate-100 text-slate-500")}>
              Optional
            </span>
          )}
        </div>
        {description && (
          <p className={cn("text-[11px] font-medium leading-relaxed opacity-60 pl-1", sub)}>
            {description}
          </p>
        )}
      </div>
      <div className="md:col-span-8">
        {children}
      </div>
    </div>
  );
}
