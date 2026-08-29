import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Info, RotateCw } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useTheme } from "@/contexts/ThemeContext";
import { cn } from "@/lib/utils";
import DeletionGuard from "./DeletionGuard";

/**
 * Reconnect / refresh dialog for numbers stuck in LOCKED / FAILED /
 * DISCONNECTED state. Mirrors the replyagent flow that walks the admin
 * through Meta-side checks before re-syncing.
 *
 * Backend route: `POST /api/whatsapp/reconnect/:number_id`.
 *
 * The dialog uses the DeletionGuard component because reconnecting a number
 * can clobber a manual payment-method fix the user just did on Meta's side
 * — typing the phrase makes that explicit.
 */
interface Props {
  open: boolean;
  number: any | null;
  onClose: () => void;
}

export default function ReconnectNumberDialog({ open, number, onClose }: Props) {
  const { mode } = useTheme();
  const dark = mode === "dark";
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  const [confirmation, setConfirmation] = useState(false);
  const [guardOk, setGuardOk] = useState(false);

  useEffect(() => {
    if (!open) {
      setConfirmation(false);
      setGuardOk(false);
    }
  }, [open]);

  const valid = confirmation && guardOk;

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/whatsapp/reconnect/${number?.id}`);
      return res.json();
    },
    onSuccess: (data: any) => {
      toast({
        title: data?.success ? t("reconnect_number_dialog.reconnect_requested") : t("reconnect_number_dialog.could_not_reconnect"),
        description: data?.message ?? "",
        variant: data?.success ? "default" : "destructive",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/accounts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/integrations/channels"] });
      onClose();
    },
  });

  if (!number) return null;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className={cn("rounded-[2rem] border p-0 max-w-2xl overflow-hidden", dark ? "bg-[#0f1829] border-slate-800" : "bg-white border-slate-200")}>
        <div className="p-7 space-y-5">
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-sky-500/10 text-sky-500 mb-4">
              <Info size={32} />
            </div>
            <div className={cn("text-base font-black tracking-tight", dark ? "text-white" : "text-slate-900")}>
              {t("reconnect_number_dialog.title")}
            </div>
            <div className={cn("mt-2 text-[13px] font-mono", dark ? "text-emerald-400" : "text-emerald-600")}>
              {number.display_phone_number}
            </div>
          </div>

          <p className={cn("text-[12px] font-bold leading-relaxed", dark ? "text-orange-400" : "text-orange-600")}>
            {t("reconnect_number_dialog.refresh_warning")}
          </p>

          <ul className={cn("text-[12px] leading-relaxed space-y-2 list-disc list-inside", dark ? "text-slate-300" : "text-slate-700")}>
            <li>
              {t("reconnect_number_dialog.bullet1_prefix")} <strong>{t("reconnect_number_dialog.blocked")}</strong>
              {t("reconnect_number_dialog.bullet1_middle")}{" "}
              <a
                href="https://business.facebook.com/latest/settings/whatsapp_account"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary font-black underline-offset-2 hover:underline"
              >
                {t("reconnect_number_dialog.meta_business_account")}
              </a>{" "}
              {t("reconnect_number_dialog.bullet1_suffix")}
            </li>
            <li>
              {t("reconnect_number_dialog.bullet2")}
            </li>
          </ul>

          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <Checkbox
                id="reconnect_confirm"
                checked={confirmation}
                onCheckedChange={(c) => setConfirmation(!!c)}
                className="mt-1"
              />
              <label
                htmlFor="reconnect_confirm"
                className={cn("text-[12px] leading-relaxed cursor-pointer", dark ? "text-slate-300" : "text-slate-700")}
              >
                {t("reconnect_number_dialog.confirm_label")}
              </label>
            </div>
            <DeletionGuard phrase="REFRESH" onValid={setGuardOk} />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              onClick={onClose}
              className={cn(
                "h-10 px-5 rounded-xl border text-[11px] font-semibold transition-all",
                dark ? "border-slate-700 text-slate-300 hover:border-slate-500" : "border-slate-200 text-slate-700 hover:border-slate-400",
              )}
            >
              {t("reconnect_number_dialog.cancel")}
            </button>
            <button
              onClick={() => mutation.mutate()}
              disabled={!valid || mutation.isPending}
              className="h-10 px-5 rounded-xl text-[11px] font-semibold transition-all flex items-center gap-2 bg-primary text-white hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <RotateCw size={12} className={mutation.isPending ? "animate-spin" : ""} />{" "}
              {mutation.isPending ? t("reconnect_number_dialog.refreshing") : t("reconnect_number_dialog.refresh")}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
