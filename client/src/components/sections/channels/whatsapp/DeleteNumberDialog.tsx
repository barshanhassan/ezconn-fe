import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { AlertTriangle, Trash2 } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useTheme } from "@/contexts/ThemeContext";
import { cn } from "@/lib/utils";
import DeletionGuard from "./DeletionGuard";

/**
 * Replyagent-parity confirmation for deleting a single WhatsApp phone number.
 *
 * Three mandatory checkboxes + type-to-confirm guard before Delete enables —
 * matches the safety flow in `views/Workspaces/Settings/Whatsapp.vue`:
 *   1. I understand removing this number breaks any flows / broadcasts using it
 *   2. I understand archived conversations will remain but no new ones will route here
 *   3. I understand this cannot be undone
 *
 * Backend route: `POST /api/whatsapp/delete-number/:number_id`.
 */
interface Props {
  open: boolean;
  number: any | null;
  onClose: () => void;
}

export default function DeleteNumberDialog({ open, number, onClose }: Props) {
  const { mode } = useTheme();
  const dark = mode === "dark";
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  const [cb1, setCb1] = useState(false);
  const [cb2, setCb2] = useState(false);
  const [cb3, setCb3] = useState(false);
  const [guardOk, setGuardOk] = useState(false);

  useEffect(() => {
    if (!open) {
      setCb1(false);
      setCb2(false);
      setCb3(false);
      setGuardOk(false);
    }
  }, [open]);

  const valid = cb1 && cb2 && cb3 && guardOk;

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/whatsapp/delete-number/${number?.id}`);
      return res.json();
    },
    onSuccess: (data: any) => {
      toast({
        title: data?.success ? t("delete_number_dialog.number_deleted") : t("delete_number_dialog.could_not_delete"),
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
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-orange-500/10 text-orange-500 mb-4">
              <AlertTriangle size={32} />
            </div>
            <div className={cn("text-base font-black tracking-tight", dark ? "text-white" : "text-slate-900")}>
              {t("delete_number_dialog.title")}
            </div>
            <div className={cn("mt-2 text-[13px] font-mono", dark ? "text-emerald-400" : "text-emerald-600")}>
              {number.display_phone_number}
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <Checkbox id="dn1" checked={cb1} onCheckedChange={(c) => setCb1(!!c)} className="mt-1" />
              <label htmlFor="dn1" className={cn("text-[12px] leading-relaxed cursor-pointer", dark ? "text-slate-300" : "text-slate-700")}>
                {t("delete_number_dialog.checkbox1_label")}
              </label>
            </div>
            <div className="flex items-start gap-3">
              <Checkbox id="dn2" checked={cb2} onCheckedChange={(c) => setCb2(!!c)} className="mt-1" />
              <label htmlFor="dn2" className={cn("text-[12px] leading-relaxed cursor-pointer", dark ? "text-slate-300" : "text-slate-700")}>
                {t("delete_number_dialog.checkbox2_label")}
              </label>
            </div>
            <div className="flex items-start gap-3">
              <Checkbox id="dn3" checked={cb3} onCheckedChange={(c) => setCb3(!!c)} className="mt-1" />
              <label htmlFor="dn3" className={cn("text-[12px] leading-relaxed cursor-pointer", dark ? "text-slate-300" : "text-slate-700")}>
                {t("delete_number_dialog.checkbox3_label")}
              </label>
            </div>

            <p className="text-[11px] text-rose-500 font-bold leading-relaxed pt-1">
              {t("delete_number_dialog.reconnect_warning")}
            </p>

            <DeletionGuard onValid={setGuardOk} />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              onClick={onClose}
              className={cn(
                "h-10 px-5 rounded-xl border text-[11px] font-semibold transition-all",
                dark ? "border-slate-700 text-slate-300 hover:border-slate-500" : "border-slate-200 text-slate-700 hover:border-slate-400",
              )}
            >
              {t("delete_number_dialog.cancel")}
            </button>
            <button
              onClick={() => mutation.mutate()}
              disabled={!valid || mutation.isPending}
              className="h-10 px-5 rounded-xl text-[11px] font-semibold transition-all flex items-center gap-2 bg-rose-500 text-white hover:bg-rose-600 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Trash2 size={12} /> {mutation.isPending ? t("delete_number_dialog.deleting") : t("delete_number_dialog.delete")}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
