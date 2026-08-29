import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Reply, ExternalLink, Trash2 } from "lucide-react";
import { useLocation } from "wouter";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useTheme } from "@/contexts/ThemeContext";
import { cn } from "@/lib/utils";

/**
 * Default auto-reply per Instagram account. Mirrors replyagent's "Default Reply"
 * modal in `views/Workspaces/Settings/InstagramNew.vue`.
 *   • Automation picker (any workspace automation)
 *   • Trigger interval: 0 → once ever, 24 → once per 24h, 247 → always
 *   • "View Automation" link when one is set; Delete clears it.
 * Backend: `POST /api/instagram/pages/:id/auto-reply` { automation_id, interval }.
 */
interface Props {
  open: boolean;
  account: any | null;
  onClose: () => void;
}

export default function InstagramDefaultReplyDialog({ open, account, onClose }: Props) {
  const { mode } = useTheme();
  const dark = mode === "dark";
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const { t } = useTranslation();

  // Labels mirror replyagent (automation.trigger_auto_reply_once / _once_per_24 / _always).
  const INTERVAL_OPTIONS = [
    { value: "0", label: t("instagram_default_reply_dialog.interval_once_label"), description: t("instagram_default_reply_dialog.interval_once_description") },
    { value: "24", label: t("instagram_default_reply_dialog.interval_24h_label"), description: t("instagram_default_reply_dialog.interval_24h_description") },
    { value: "247", label: t("instagram_default_reply_dialog.interval_always_label"), description: t("instagram_default_reply_dialog.interval_always_description") },
  ];

  const initialAutomationId = account?.auto_reply_automation_id ? String(account.auto_reply_automation_id) : "";
  const initialInterval = account?.auto_reply_interval ?? "247";

  const [automationId, setAutomationId] = useState<string>("");
  const [interval, setInterval] = useState<string>("247");

  useEffect(() => {
    if (open) {
      setAutomationId(initialAutomationId);
      setInterval(initialInterval);
    }
  }, [open, initialAutomationId, initialInterval]);

  const { data: automationsData } = useQuery({
    queryKey: ["/api/automations"],
    queryFn: async () => (await apiRequest("GET", "/api/automations")).json(),
    enabled: open,
  });
  const automations: any[] = useMemo(() => {
    const raw = automationsData?.automations ?? automationsData?.data ?? automationsData ?? [];
    return Array.isArray(raw) ? raw : [];
  }, [automationsData]);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/integrations/channels"] });
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", `/api/instagram/pages/${account?.id}/auto-reply`, {
        automation_id: automationId || null,
        interval,
      });
    },
    onSuccess: () => {
      toast({ title: t("instagram_default_reply_dialog.saved"), description: t("instagram_default_reply_dialog.saved_description") });
      invalidate();
      onClose();
    },
    onError: () => toast({ title: t("instagram_default_reply_dialog.error"), description: t("instagram_default_reply_dialog.failed_to_save"), variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", `/api/instagram/pages/${account?.id}/auto-reply`, {
        automation_id: null,
        interval: "247",
      });
    },
    onSuccess: () => {
      toast({ title: t("instagram_default_reply_dialog.cleared") });
      invalidate();
      onClose();
    },
  });

  if (!account) return null;

  const intervalDesc = INTERVAL_OPTIONS.find((o) => o.value === interval)?.description;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className={cn("rounded-[2rem] border p-0 max-w-3xl overflow-hidden", dark ? "bg-[#0f1829] border-slate-800" : "bg-white border-slate-200")}>
        <div className="p-7 space-y-5">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-pink-500/10 flex items-center justify-center text-pink-500 shrink-0">
              <Reply size={20} />
            </div>
            <div className="flex-1 min-w-0">
              <div className={cn("text-[14px] font-semibold", dark ? "text-white" : "text-slate-900")}>{t("instagram_default_reply_dialog.title")}</div>
              <p className={cn("text-[11px] font-medium opacity-60 mt-1 leading-relaxed", dark ? "text-slate-400" : "text-slate-600")}>
                {t("instagram_default_reply_dialog.description_prefix")}{" "}
                <span className="font-mono">@{account.username ?? account.name}</span>.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2 space-y-2">
              <label className={cn("text-[11px] font-semibold", dark ? "text-slate-400" : "text-slate-600")}>{t("instagram_default_reply_dialog.select_automation")}</label>
              <select
                value={automationId}
                onChange={(e) => setAutomationId(e.target.value)}
                className={cn("w-full h-11 px-4 rounded-xl border text-[13px] font-bold focus:ring-2 focus:ring-primary/30 transition-all", dark ? "bg-slate-950/50 border-slate-800 text-white" : "bg-white border-slate-200 text-slate-900")}
              >
                <option value="">{t("instagram_default_reply_dialog.choose_automation")}</option>
                {automations.map((a: any) => (
                  <option key={a.id} value={a.id}>{a.name ?? t("instagram_default_reply_dialog.automation_number", { id: a.id })}</option>
                ))}
              </select>
              {automationId && (
                <button
                  onClick={() => { onClose(); setLocation(`/automations/${automationId}`); }}
                  className="text-[11px] font-bold text-primary inline-flex items-center gap-1 hover:underline"
                >
                  {t("instagram_default_reply_dialog.view_automation")} <ExternalLink size={10} />
                </button>
              )}
            </div>
            <div className="space-y-2">
              <label className={cn("text-[11px] font-semibold", dark ? "text-slate-400" : "text-slate-600")}>{t("instagram_default_reply_dialog.trigger")}</label>
              <select
                value={interval}
                onChange={(e) => setInterval(e.target.value)}
                className={cn("w-full h-11 px-4 rounded-xl border text-[13px] font-bold focus:ring-2 focus:ring-primary/30 transition-all", dark ? "bg-slate-950/50 border-slate-800 text-white" : "bg-white border-slate-200 text-slate-900")}
              >
                {INTERVAL_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
          </div>

          {intervalDesc && (
            <p className={cn("text-[11px] leading-relaxed", dark ? "text-slate-400" : "text-slate-600")}>{intervalDesc}</p>
          )}

          <div className="flex items-center justify-between pt-2">
            <div>
              {initialAutomationId && (
                <button
                  onClick={() => deleteMutation.mutate()}
                  disabled={deleteMutation.isPending}
                  className="h-10 px-5 rounded-xl text-[11px] font-semibold transition-all flex items-center gap-2 bg-rose-500 text-white hover:bg-rose-600 disabled:opacity-50"
                >
                  <Trash2 size={12} /> {deleteMutation.isPending ? t("instagram_default_reply_dialog.deleting") : t("instagram_default_reply_dialog.delete")}
                </button>
              )}
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={onClose}
                disabled={saveMutation.isPending || deleteMutation.isPending}
                className={cn("h-10 px-5 rounded-xl border text-[11px] font-semibold transition-all", dark ? "border-slate-700 text-slate-300 hover:border-slate-500" : "border-slate-200 text-slate-700 hover:border-slate-400")}
              >
                {t("instagram_default_reply_dialog.close")}
              </button>
              <button
                onClick={() => saveMutation.mutate()}
                disabled={!automationId || saveMutation.isPending}
                className="h-10 px-5 rounded-xl text-[11px] font-semibold transition-all bg-primary text-white hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {saveMutation.isPending ? t("instagram_default_reply_dialog.saving") : t("instagram_default_reply_dialog.save")}
              </button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
