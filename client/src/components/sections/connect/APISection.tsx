import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Code2,
  Copy,
  Eye,
  EyeOff,
  RefreshCw,
  Trash2,
  ShieldCheck,
  Lock,
  Key,
  Plus,
  AlertCircle,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
} from "@/components/ui/alert-dialog";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { useTheme } from "@/contexts/ThemeContext";

export default function APISection() {
  const { mode } = useTheme();
  const dark = mode === "dark";
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { t } = useTranslation();

  const [showKey, setShowKey] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // ── Design tokens ─────────────────────────────────────────
  const card       = dark ? "bg-[#0f1829]"    : "bg-white";
  const border     = dark ? "border-slate-800" : "border-slate-200";
  const text       = dark ? "text-white"      : "text-slate-900";
  const sub        = dark ? "text-slate-500"  : "text-slate-400";
  const softBg     = dark ? "bg-slate-950/40" : "bg-slate-50/50";
  const softBorder = dark ? "border-slate-800" : "border-slate-100";

  const outlineBtn = cn(
    "h-11 px-6 rounded-xl border text-[11px] font-semibold transition-all flex items-center gap-2",
    dark ? "border-slate-800 text-slate-300 hover:border-primary/40 hover:text-primary" : "border-slate-200 text-slate-700 hover:border-primary/40 hover:text-primary"
  );

  const primaryOutlineBtn = cn(
    "h-10 px-6 rounded-xl border text-[11px] font-semibold transition-all flex items-center gap-2",
    "border-primary text-primary hover:bg-primary hover:text-white"
  );

  const primaryBtn =
    "h-11 px-7 rounded-xl bg-primary hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed text-white text-[11px] font-semibold transition-all shadow-lg shadow-primary/20 flex items-center gap-2";

  const { data: apiKeys, isLoading } = useQuery({
    queryKey: ["/api/integrations/api-keys"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/integrations/api-keys");
      return res.json();
    },
  });

  const generateMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/integrations/api-keys", { name: "Default API Key" });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/integrations/api-keys"] });
      toast({ title: t("api_section.authorized"), description: t("api_section.key_created") });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number | string) => {
      await apiRequest("DELETE", `/api/integrations/api-keys/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/integrations/api-keys"] });
      toast({ title: t("api_section.revoked"), description: t("api_section.key_removed") });
    },
  });

  const handleCopy = (val: string) => {
    navigator.clipboard.writeText(val);
    toast({ title: t("api_section.copied"), description: t("api_section.token_copied") });
  };

  const currentKey = apiKeys?.[0];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <>
      <Card className={cn("rounded-[2rem] border overflow-hidden shadow-sm transition-all duration-300", card, border)}>
        <CardContent className="p-0">
          {/* Header */}
          <div className={cn("px-8 py-5 border-b flex items-center justify-between", border)}>
            <div className="flex items-center gap-4">
              <div className={cn("p-2.5 rounded-xl shadow-sm", "bg-primary/10")}>
                <Code2 className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h1 className={cn("text-[16px] font-bold tracking-tight", text)}>{t("api_section.title")}</h1>
                <p className={cn("text-[11px] font-bold mt-0.5 opacity-60 max-w-2xl", sub)}>
                  {t("api_section.subtitle")}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <div className={cn("px-3 py-1.5 rounded-lg border flex items-center gap-2", softBorder, dark ? "bg-slate-900/50" : "bg-white")}>
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className={cn("text-[11px] font-semibold", sub)}>{t("api_section.production_active")}</span>
              </div>
            </div>
          </div>

          {/* Body */}
          <div className="p-8">
            {currentKey ? (
              <div className={cn("rounded-[1.5rem] border p-8 space-y-6", softBg, softBorder)}>
                {/* Status header */}
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-500 shrink-0">
                    <ShieldCheck size={22} />
                  </div>
                  <div className="flex-1">
                    <h3 className={cn("text-[14px] font-black tracking-tight", text)}>{t("api_section.active_gateway")}</h3>
                    <p className={cn("text-[11px] font-medium opacity-60", sub)}>
                      {t("api_section.active_gateway_description")}
                    </p>
                  </div>
                  <Badge variant="outline" className="h-6 px-2 rounded-md border-emerald-500/30 bg-emerald-500/5 text-emerald-600 dark:text-emerald-400 text-[10px] font-semibold">
                    {t("api_section.active")}
                  </Badge>
                </div>

                {/* Token row */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Lock size={12} className="text-primary" />
                    <span className={cn("text-[11px] font-semibold", sub)}>
                      {t("api_section.private_token")}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <input
                        type={showKey ? "text" : "password"}
                        value={currentKey.token}
                        readOnly
                        className={cn(
                          "w-full h-11 pl-4 pr-12 rounded-xl font-mono text-[12px] border outline-none transition-all",
                          dark ? "bg-slate-950/50 border-slate-800 text-white" : "bg-white border-slate-200 text-slate-900"
                        )}
                      />
                      <button
                        onClick={() => setShowKey(!showKey)}
                        className={cn("absolute right-3 top-1/2 -translate-y-1/2 transition-colors", sub, "hover:text-primary")}
                      >
                        {showKey ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    </div>
                    <button
                      onClick={() => handleCopy(currentKey.token)}
                      className={cn("w-11 h-11 rounded-xl border flex items-center justify-center transition-all", dark ? "border-slate-800 hover:border-primary/40 text-primary" : "border-slate-200 hover:border-primary/40 text-primary")}
                      title={t("api_section.copy")}
                    >
                      <Copy size={15} />
                    </button>
                    <button
                      onClick={() => setShowDeleteConfirm(true)}
                      className={cn("w-11 h-11 rounded-xl border flex items-center justify-center transition-all", dark ? "border-slate-800 hover:border-rose-500/40 hover:text-rose-500 text-slate-400" : "border-slate-200 hover:border-rose-500/40 hover:text-rose-500 text-slate-500")}
                      title={t("api_section.revoke")}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>

                {/* Security notice */}
                <div className={cn("flex items-center gap-3 p-4 rounded-xl border", "border-primary/20 bg-primary/5")}>
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0">
                    <Key size={13} />
                  </div>
                  <p className={cn("text-[11px] font-medium leading-relaxed", sub)}>
                    <span className={cn("font-semibold", text)}>{t("api_section.security_notice_label")}</span>{" "}
                    {t("api_section.security_notice_description")}
                  </p>
                </div>

                {/* Renew */}
                <div className={cn("flex justify-end pt-4 border-t", softBorder)}>
                  <button
                    onClick={() => generateMutation.mutate()}
                    disabled={generateMutation.isPending}
                    className={outlineBtn}
                  >
                    <RefreshCw size={12} className={cn(generateMutation.isPending && "animate-spin")} />
                    {t("api_section.renew_token")}
                  </button>
                </div>
              </div>
            ) : (
              <div className={cn("rounded-[1.5rem] border py-16 px-8 flex flex-col items-center justify-center text-center space-y-5", softBg, softBorder)}>
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                  <Key className="w-8 h-8 text-primary" />
                </div>
                <div className="space-y-1.5 max-w-sm">
                  <h3 className={cn("text-[14px] font-black tracking-tight", text)}>{t("api_section.auth_required")}</h3>
                  <p className={cn("text-[11px] font-medium opacity-60 leading-relaxed", sub)}>
                    {t("api_section.auth_required_description")}
                  </p>
                </div>
                <button
                  onClick={() => generateMutation.mutate()}
                  disabled={generateMutation.isPending}
                  className={primaryBtn}
                >
                  {generateMutation.isPending ? <RefreshCw size={12} className="animate-spin" /> : <Plus size={12} />}
                  {generateMutation.isPending ? t("api_section.generating") : t("api_section.generate_api_key")}
                </button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ── Delete Dialog ── */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent className={cn("rounded-[2rem] border p-0 max-w-md overflow-hidden", card, border)}>
          <div className="p-6 space-y-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-500/10 flex items-center justify-center text-rose-500">
                <AlertCircle size={18} />
              </div>
              <div>
                <h2 className={cn("text-[14px] font-semibold", text)}>{t("api_section.revoke_dialog_title")}</h2>
                <p className={cn("text-[11px] font-medium opacity-60 mt-0.5 leading-relaxed", sub)}>
                  {t("api_section.revoke_dialog_description")}
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <AlertDialogCancel className={cn(outlineBtn, "m-0")}>{t("api_section.cancel")}</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => { deleteMutation.mutate(currentKey.id); setShowDeleteConfirm(false); }}
                className="h-11 px-7 rounded-xl bg-rose-500 hover:bg-rose-600 text-white text-[11px] font-semibold transition-all shadow-lg shadow-rose-500/20 flex items-center gap-2"
              >
                <Trash2 size={12} /> {t("api_section.revoke")}
              </AlertDialogAction>
            </div>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
