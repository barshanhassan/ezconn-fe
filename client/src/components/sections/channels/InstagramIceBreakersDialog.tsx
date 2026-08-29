import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { MessageSquare, Plus, Trash2 } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useTheme } from "@/contexts/ThemeContext";
import { cn } from "@/lib/utils";

/**
 * Quick Starter (Ice Breakers) per Instagram account. Mirrors replyagent's
 * "Quick Starter" modal in `views/Workspaces/Settings/InstagramNew.vue`.
 *   • Up to 4 starter questions, each may trigger an automation.
 *   • Save replaces the full set; "Clear all" removes them.
 * Backend: GET/POST/DELETE `/api/instagram/pages/:id/ice-breakers`.
 */
interface Props {
  open: boolean;
  account: any | null;
  onClose: () => void;
}

type IceItem = { text: string; automationId: string | null; _id?: string };

export default function InstagramIceBreakersDialog({ open, account, onClose }: Props) {
  const { mode } = useTheme();
  const dark = mode === "dark";
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  const text = dark ? "text-white" : "text-slate-900";
  const sub = dark ? "text-slate-500" : "text-slate-400";
  const inputCls = cn(
    "w-full h-10 px-3 rounded-xl border text-[12px] font-bold transition-all focus:outline-none focus:ring-2 focus:ring-primary/30",
    dark ? "bg-slate-900 border-slate-700 text-white" : "bg-white border-slate-200 text-slate-900",
  );
  const selectCls = cn(
    "w-full h-10 px-3 rounded-xl border text-[12px] font-bold transition-all focus:outline-none focus:ring-2 focus:ring-primary/30",
    dark ? "bg-slate-900 border-slate-700 text-white" : "bg-white border-slate-200 text-slate-900",
  );

  const [items, setItems] = useState<IceItem[]>([]);

  const { data: automationsData } = useQuery({
    queryKey: ["/api/automations"],
    queryFn: async () => (await apiRequest("GET", "/api/automations")).json(),
    enabled: open,
  });
  const automations: any[] = automationsData?.automations ?? automationsData?.data ?? [];

  const { data: iceBreakersData, isLoading } = useQuery({
    queryKey: ["/api/instagram/pages", String(account?.id), "ice-breakers"],
    queryFn: async () => (await apiRequest("GET", `/api/instagram/pages/${account?.id}/ice-breakers`)).json(),
    enabled: open && !!account?.id,
  });

  useEffect(() => {
    if (open && iceBreakersData) {
      setItems(
        (Array.isArray(iceBreakersData) ? iceBreakersData : []).map((f: any) => ({
          text: f.text ?? "",
          automationId: f.modelable_id ? String(f.modelable_id) : null,
          _id: String(f.id),
        })),
      );
    }
  }, [open, iceBreakersData]);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/instagram/pages", String(account?.id), "ice-breakers"] });
    queryClient.invalidateQueries({ queryKey: ["/api/integrations/channels"] });
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", `/api/instagram/pages/${account?.id}/ice-breakers`, {
        items: items.map((i) => ({ text: i.text, automationId: i.automationId })),
      });
    },
    onSuccess: () => { invalidate(); toast({ title: t("instagram_ice_breakers_dialog.saved"), description: t("instagram_ice_breakers_dialog.updated_description") }); onClose(); },
    onError: () => toast({ title: t("instagram_ice_breakers_dialog.error"), description: t("instagram_ice_breakers_dialog.failed_to_save"), variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async () => { await apiRequest("DELETE", `/api/instagram/pages/${account?.id}/ice-breakers`); },
    onSuccess: () => { setItems([]); invalidate(); toast({ title: t("instagram_ice_breakers_dialog.cleared"), description: t("instagram_ice_breakers_dialog.cleared_description") }); onClose(); },
    onError: () => toast({ title: t("instagram_ice_breakers_dialog.error"), description: t("instagram_ice_breakers_dialog.failed_to_clear"), variant: "destructive" }),
  });

  if (!account) return null;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className={cn("rounded-[2rem] border p-0 max-w-3xl overflow-hidden", dark ? "bg-[#0f1829] border-slate-800" : "bg-white border-slate-200")}>
        <div className="p-7 space-y-5">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-pink-500/10 flex items-center justify-center text-pink-500 shrink-0">
              <MessageSquare size={20} />
            </div>
            <div className="flex-1 min-w-0">
              <div className={cn("text-[14px] font-semibold", text)}>{t("instagram_ice_breakers_dialog.title")}</div>
              <p className={cn("text-[11px] font-medium opacity-60 mt-1 leading-relaxed", sub)}>
                {t("instagram_ice_breakers_dialog.description_prefix")}{" "}
                <span className="font-mono">@{account.username ?? account.name}</span>. {t("instagram_ice_breakers_dialog.description_suffix")}
              </p>
            </div>
          </div>

          {isLoading ? (
            <div className="flex justify-center py-8"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" /></div>
          ) : items.length === 0 ? (
            <div className={cn("rounded-xl border py-10 flex flex-col items-center justify-center text-center gap-3", dark ? "border-slate-800" : "border-slate-100")}>
              <MessageSquare size={24} className="opacity-30" />
              <p className={cn("text-[11px] opacity-50 font-medium", sub)}>{t("instagram_ice_breakers_dialog.no_questions_yet")}</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-1">
              {items.map((item, i) => (
                <div key={i} className={cn("rounded-xl border p-4 space-y-3", dark ? "bg-slate-900/60 border-slate-700" : "bg-white border-slate-200")}>
                  <div className="flex items-center gap-2">
                    <span className={cn("text-[10px] font-semibold opacity-40 w-6 shrink-0", sub)}>Q{i + 1}</span>
                    <input
                      value={item.text}
                      maxLength={60}
                      onChange={(e) => setItems((p) => p.map((it, idx) => idx === i ? { ...it, text: e.target.value } : it))}
                      placeholder={t("instagram_ice_breakers_dialog.question_placeholder")}
                      className={cn(inputCls, "flex-1")}
                    />
                    <button
                      onClick={() => setItems((p) => p.filter((_, idx) => idx !== i))}
                      className={cn("w-9 h-9 rounded-xl border flex items-center justify-center transition-all text-rose-500 shrink-0", dark ? "border-slate-700 hover:bg-rose-500/10" : "border-slate-200 hover:bg-rose-500/10")}
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                  <div className="pl-8">
                    <label className={cn("text-[11px] font-semibold opacity-50 mb-1 block", sub)}>{t("instagram_ice_breakers_dialog.trigger_automation")}</label>
                    <select
                      value={item.automationId ?? ""}
                      onChange={(e) => setItems((p) => p.map((it, idx) => idx === i ? { ...it, automationId: e.target.value || null } : it))}
                      className={selectCls}
                    >
                      <option value="">{t("instagram_ice_breakers_dialog.no_automation")}</option>
                      {automations.map((a: any) => (
                        <option key={a.id} value={String(a.id)}>{a.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="flex items-center justify-between pt-2">
            <div className="flex items-center gap-2">
              {items.length > 0 && (
                <button
                  onClick={() => deleteMutation.mutate()}
                  disabled={deleteMutation.isPending}
                  className="h-10 px-5 rounded-xl text-[11px] font-semibold transition-all flex items-center gap-2 bg-rose-500 text-white hover:bg-rose-600 disabled:opacity-50"
                >
                  <Trash2 size={12} /> {t("instagram_ice_breakers_dialog.clear_all")}
                </button>
              )}
              {items.length < 4 && (
                <button
                  onClick={() => setItems((p) => [...p, { text: "", automationId: null }])}
                  className="h-10 px-5 rounded-xl border text-[11px] font-semibold transition-all flex items-center gap-2 border-primary text-primary hover:bg-primary hover:text-white"
                >
                  <Plus size={12} /> {t("instagram_ice_breakers_dialog.add_question")}
                </button>
              )}
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={onClose}
                disabled={saveMutation.isPending || deleteMutation.isPending}
                className={cn("h-10 px-5 rounded-xl border text-[11px] font-semibold transition-all", dark ? "border-slate-700 text-slate-300 hover:border-slate-500" : "border-slate-200 text-slate-700 hover:border-slate-400")}
              >
                {t("instagram_ice_breakers_dialog.close")}
              </button>
              <button
                onClick={() => saveMutation.mutate()}
                disabled={saveMutation.isPending || items.length === 0}
                className="h-10 px-5 rounded-xl text-[11px] font-semibold transition-all bg-primary text-white hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {saveMutation.isPending ? t("instagram_ice_breakers_dialog.saving") : t("instagram_ice_breakers_dialog.save")}
              </button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
