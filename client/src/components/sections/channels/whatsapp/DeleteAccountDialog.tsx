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

/**
 * Confirm-delete dialog for a whole WABA account.
 *
 * Mirrors replyagent's `ConfirmChannelDelete` flow:
 *   - WhatsApp icon + account name in the header
 *   - Two optional checkboxes:
 *       1. delete_folder    — drop the workspace Gallery folder bound to this account
 *       2. delete_templates — instruct Meta to delete templates we created
 *   - Cancel + Delete buttons (Delete always enabled — these are *optional*
 *     cleanups, not safety gates)
 *
 * Backend route: `POST /api/whatsapp/delete/:account_id` with body
 * `{ delete_folder, delete_templates }`.
 */
interface Props {
  open: boolean;
  account: any | null;
  onClose: () => void;
}

export default function DeleteAccountDialog({ open, account, onClose }: Props) {
  const { mode } = useTheme();
  const dark = mode === "dark";
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  const [deleteFolder, setDeleteFolder] = useState(false);
  const [deleteTemplates, setDeleteTemplates] = useState(false);

  useEffect(() => {
    // Reset when the dialog closes or switches account.
    if (!open) {
      setDeleteFolder(false);
      setDeleteTemplates(false);
    }
  }, [open]);

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/whatsapp/delete/${account?.id}`, {
        delete_folder: deleteFolder,
        delete_templates: deleteTemplates,
      });
      return res.json();
    },
    onSuccess: (data: any) => {
      toast({
        title: data?.success ? t("delete_account_dialog.deletion_requested") : t("delete_account_dialog.could_not_delete"),
        description: data?.message ?? "",
        variant: data?.success ? "default" : "destructive",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/accounts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/integrations/channels"] });
      // Deleting an account frees a channel slot — without this the cached
      // /limits response (fetched once, never refetched on its own) keeps
      // reporting the pre-delete used/can_add values, so "Add new" keeps
      // showing "Channel limit reached" even though a slot just opened up.
      queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/limits"] });
      onClose();
    },
  });

  if (!account) return null;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className={cn("rounded-[2rem] border p-0 max-w-xl overflow-hidden", dark ? "bg-[#0f1829] border-slate-800" : "bg-white border-slate-200")}>
        <div className="p-7 space-y-5">
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-orange-500/10 text-orange-500 mb-4">
              <AlertTriangle size={32} />
            </div>
            <div className={cn("text-base font-black tracking-tight", dark ? "text-white" : "text-slate-900")}>
              {t("delete_account_dialog.title")}
            </div>
            <div className="flex justify-center items-center gap-3 mt-3">
              <img src="/images/automations/whatsapp.svg" alt="WA" className="w-5 h-5" />
              <span className={cn("text-[12px] font-bold", dark ? "text-slate-300" : "text-slate-700")}>{account.name}</span>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <Checkbox id="del_folder" checked={deleteFolder} onCheckedChange={(c) => setDeleteFolder(!!c)} className="mt-1" />
              <label htmlFor="del_folder" className={cn("text-[12px] leading-relaxed cursor-pointer", dark ? "text-slate-300" : "text-slate-700")}>
                {t("delete_account_dialog.delete_folder_label")}
              </label>
            </div>
            <div className="flex items-start gap-3">
              <Checkbox id="del_tpl" checked={deleteTemplates} onCheckedChange={(c) => setDeleteTemplates(!!c)} className="mt-1" />
              <label htmlFor="del_tpl" className={cn("text-[12px] leading-relaxed cursor-pointer", dark ? "text-slate-300" : "text-slate-700")}>
                {t("delete_account_dialog.delete_templates_label")}
              </label>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              onClick={onClose}
              className={cn(
                "h-10 px-5 rounded-xl border text-[11px] font-semibold transition-all",
                dark ? "border-slate-700 text-slate-300 hover:border-slate-500" : "border-slate-200 text-slate-700 hover:border-slate-400",
              )}
            >
              {t("delete_account_dialog.cancel")}
            </button>
            <button
              onClick={() => mutation.mutate()}
              disabled={mutation.isPending}
              className="h-10 px-5 rounded-xl text-[11px] font-semibold transition-all flex items-center gap-2 bg-rose-500 text-white hover:bg-rose-600 disabled:opacity-50"
            >
              <Trash2 size={12} /> {mutation.isPending ? t("delete_account_dialog.deleting") : t("delete_account_dialog.delete")}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
