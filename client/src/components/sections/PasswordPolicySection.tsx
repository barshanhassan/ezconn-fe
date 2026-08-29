import React, { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Info, Loader2, ShieldCheck } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { cn } from "@/lib/utils";
import { useTheme } from "@/contexts/ThemeContext";

interface PasswordPolicySettings {
  policyEnabled: boolean;
  policyName: string;
  expirationDays: number;
  reuseCount: number;
  lockoutThreshold: number;
}

const DEFAULT_SETTINGS: PasswordPolicySettings = {
  policyEnabled: false,
  policyName: "",
  expirationDays: 90,
  reuseCount: 5,
  lockoutThreshold: 5,
};

const PasswordPolicySection = () => {
  const { mode } = useTheme();
  const dark = mode === "dark";
  const { toast } = useToast();
  const { t } = useTranslation();
  const [settings, setSettings] = React.useState<PasswordPolicySettings>(DEFAULT_SETTINGS);

  // ── Design tokens ─────────────────────────────────────────
  const card       = dark ? "bg-[#0f1829]"    : "bg-white";
  const border     = dark ? "border-slate-800" : "border-slate-200";
  const text       = dark ? "text-white"      : "text-slate-900";
  const sub        = dark ? "text-slate-500"  : "text-slate-400";
  const softBg     = dark ? "bg-slate-950/40" : "bg-slate-50/50";
  const softBorder = dark ? "border-slate-800" : "border-slate-100";

  const inputCls = cn(
    "w-full h-11 rounded-xl text-[13px] font-bold transition-all px-4 border outline-none",
    "focus:ring-2 focus:ring-primary/30 focus:border-primary/50 disabled:opacity-40 disabled:cursor-not-allowed",
    dark ? "bg-slate-950/50 border-slate-800 text-white" : "bg-white border-slate-200 text-slate-900"
  );

  const primaryBtn =
    "h-11 px-7 rounded-xl bg-primary hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed text-white text-[11px] font-semibold transition-all shadow-lg shadow-primary/20 flex items-center gap-2";

  const labelCls = cn("text-[11px] font-semibold", sub);

  const { isLoading, data: fetchedData } = useQuery<PasswordPolicySettings>({
    queryKey: ["/api/workspaces/password-policy"],
  });

  useEffect(() => {
    if (fetchedData) setSettings(fetchedData);
  }, [fetchedData]);

  const mutation = useMutation({
    mutationFn: async (data: PasswordPolicySettings) => {
      const res = await apiRequest("POST", "/api/workspaces/password-policy", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/workspaces/password-policy"] });
      toast({ title: t("password_policy_section.settings_saved"), description: t("password_policy_section.settings_updated") });
    },
    onError: (error: Error) => {
      toast({ title: t("password_policy_section.error"), description: error.message, variant: "destructive" });
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const InfoTip = ({ tip }: { tip: string }) => (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Info size={13} className={cn("cursor-help", sub)} />
        </TooltipTrigger>
        <TooltipContent className="max-w-xs text-[11px] font-medium">{tip}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );

  const Field = ({
    label,
    tip,
    children,
  }: {
    label: string;
    tip: string;
    children: React.ReactNode;
  }) => (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <label className={labelCls}>{label}</label>
        <InfoTip tip={tip} />
      </div>
      {children}
    </div>
  );

  return (
    <Card className={cn("rounded-[2rem] border overflow-hidden shadow-sm transition-all duration-300", card, border)}>
      <CardContent className="p-0">
        {/* Header */}
        <div className={cn("px-8 py-5 border-b flex items-center justify-between", border)}>
          <div className="flex items-center gap-4">
            <div className={cn("p-2.5 rounded-xl shadow-sm", "bg-primary/10")}>
              <ShieldCheck className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className={cn("text-[16px] font-bold tracking-tight", text)}>{t("password_policy_section.title")}</h1>
              <p className={cn("text-[11px] font-bold mt-0.5 opacity-60 max-w-2xl", sub)}>
                {t("password_policy_section.subtitle")}
              </p>
            </div>
          </div>
          <button
            onClick={() => mutation.mutate(settings)}
            disabled={mutation.isPending}
            className={primaryBtn}
          >
            {mutation.isPending && <Loader2 size={12} className="animate-spin" />}
            {t("password_policy_section.save")}
          </button>
        </div>

        {/* Body */}
        <div className="p-8 space-y-6">
          {/* Enable toggle */}
          <div className={cn("flex items-center justify-between p-5 rounded-[1.5rem] border", softBg, softBorder)}>
            <div>
              <p className={cn("text-[13px] font-black", text)}>{t("password_policy_section.enable_title")}</p>
              <p className={cn("text-[11px] font-medium opacity-60 mt-0.5", sub)}>
                {t("password_policy_section.enable_description")}
              </p>
            </div>
            <Switch
              checked={settings.policyEnabled}
              onCheckedChange={(val) => setSettings((prev) => ({ ...prev, policyEnabled: val }))}
              className="data-[state=checked]:bg-primary"
            />
          </div>

          {/* Settings */}
          <div className={cn("rounded-[1.5rem] border p-6 space-y-5", softBg, softBorder)}>
            <Field label={t("password_policy_section.policy_name_label")} tip={t("password_policy_section.policy_name_tip")}>
              <input
                value={settings.policyName}
                onChange={(e) => setSettings((prev) => ({ ...prev, policyName: e.target.value }))}
                disabled={!settings.policyEnabled}
                placeholder={t("password_policy_section.policy_name_placeholder")}
                className={inputCls}
              />
            </Field>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <Field
                label={t("password_policy_section.expiration_label")}
                tip={t("password_policy_section.expiration_tip")}
              >
                <input
                  type="number"
                  min={1}
                  value={settings.expirationDays}
                  onChange={(e) => setSettings((prev) => ({ ...prev, expirationDays: Number(e.target.value) }))}
                  disabled={!settings.policyEnabled}
                  className={inputCls}
                />
              </Field>

              <Field
                label={t("password_policy_section.reuse_count_label")}
                tip={t("password_policy_section.reuse_count_tip")}
              >
                <input
                  type="number"
                  min={0}
                  value={settings.reuseCount}
                  onChange={(e) => setSettings((prev) => ({ ...prev, reuseCount: Number(e.target.value) }))}
                  disabled={!settings.policyEnabled}
                  className={inputCls}
                />
              </Field>

              <Field
                label={t("password_policy_section.lockout_threshold_label")}
                tip={t("password_policy_section.lockout_threshold_tip")}
              >
                <input
                  type="number"
                  min={1}
                  value={settings.lockoutThreshold}
                  onChange={(e) => setSettings((prev) => ({ ...prev, lockoutThreshold: Number(e.target.value) }))}
                  disabled={!settings.policyEnabled}
                  className={inputCls}
                />
              </Field>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default PasswordPolicySection;
