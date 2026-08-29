import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { BookOpen, Plus, Trash2 } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useTheme } from "@/contexts/ThemeContext";
import { cn } from "@/lib/utils";

/**
 * Main Menu (Persistent Menu) per Instagram account. Mirrors replyagent's
 * "Main Menu" modal in `views/Workspaces/Settings/InstagramNew.vue`.
 *   • Up to 20 items; each is either an automation (postback) or a web URL.
 *   • Save replaces the full set; "Clear all" removes them.
 * Backend: GET/POST/DELETE `/api/instagram/pages/:id/menu`.
 */
interface Props {
  open: boolean;
  account: any | null;
  onClose: () => void;
}

type MenuItem = { text: string; payloadType: "postback" | "web_url"; payload: string; automationId: string | null; _id?: string };

export default function InstagramMainMenuDialog({ open, account, onClose }: Props) {
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
    "h-10 px-3 rounded-xl border text-[11px] font-bold focus:outline-none focus:ring-2 focus:ring-primary/30",
    dark ? "bg-slate-900 border-slate-700 text-white" : "bg-white border-slate-200 text-slate-900",
  );

  const [items, setItems] = useState<MenuItem[]>([]);

  const { data: automationsData } = useQuery({
    queryKey: ["/api/automations"],
    queryFn: async () => (await apiRequest("GET", "/api/automations")).json(),
    enabled: open,
  });
  const automations: any[] = automationsData?.automations ?? automationsData?.data ?? [];

  const { data: menuData, isLoading } = useQuery({
    queryKey: ["/api/instagram/pages", String(account?.id), "menu"],
    queryFn: async () => (await apiRequest("GET", `/api/instagram/pages/${account?.id}/menu`)).json(),
    enabled: open && !!account?.id,
  });

  useEffect(() => {
    if (open && menuData) {
      setItems(
        (Array.isArray(menuData) ? menuData : []).map((f: any) => ({
          text: f.text ?? "",
          payloadType: (f.payload_type as "postback" | "web_url") ?? "postback",
          payload: f.payload ?? "",
          automationId: f.modelable_id ? String(f.modelable_id) : null,
          _id: String(f.id),
        })),
      );
    }
  }, [open, menuData]);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/instagram/pages", String(account?.id), "menu"] });
    queryClient.invalidateQueries({ queryKey: ["/api/integrations/channels"] });
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", `/api/instagram/pages/${account?.id}/menu`, {
        items: items.map((i) => ({ text: i.text, payloadType: i.payloadType, payload: i.payload || null, automationId: i.automationId })),
      });
    },
    onSuccess: () => { invalidate(); toast({ title: t("instagram_main_menu_dialog.saved"), description: t("instagram_main_menu_dialog.updated_description") }); onClose(); },
    onError: () => toast({ title: t("instagram_main_menu_dialog.error"), description: t("instagram_main_menu_dialog.failed_to_save"), variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async () => { await apiRequest("DELETE", `/api/instagram/pages/${account?.id}/menu`); },
    onSuccess: () => { setItems([]); invalidate(); toast({ title: t("instagram_main_menu_dialog.cleared"), description: t("instagram_main_menu_dialog.cleared_description") }); onClose(); },
    onError: () => toast({ title: t("instagram_main_menu_dialog.error"), description: t("instagram_main_menu_dialog.failed_to_clear"), variant: "destructive" }),
  });

  if (!account) return null;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className={cn("rounded-[2rem] border p-0 max-w-3xl overflow-hidden", dark ? "bg-[#0f1829] border-slate-800" : "bg-white border-slate-200")}>
        <div className="p-7 space-y-5">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-pink-500/10 flex items-center justify-center text-pink-500 shrink-0">
              <BookOpen size={20} />
            </div>
            <div className="flex-1 min-w-0">
              <div className={cn("text-[14px] font-semibold", text)}>{t("instagram_main_menu_dialog.title")}</div>
              <p className={cn("text-[11px] font-medium opacity-60 mt-1 leading-relaxed", sub)}>
                {t("instagram_main_menu_dialog.description_prefix")}{" "}
                <span className="font-mono">@{account.username ?? account.name}</span>. {t("instagram_main_menu_dialog.description_suffix")}
              </p>
            </div>
          </div>

          {isLoading ? (
            <div className="flex justify-center py-8"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" /></div>
          ) : items.length === 0 ? (
            <div className={cn("rounded-xl border py-10 flex flex-col items-center justify-center text-center gap-3", dark ? "border-slate-800" : "border-slate-100")}>
              <BookOpen size={24} className="opacity-30" />
              <p className={cn("text-[11px] opacity-50 font-medium", sub)}>{t("instagram_main_menu_dialog.no_items_yet")}</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-1">
              {items.map((item, i) => (
                <div key={i} className={cn("rounded-xl border p-4 space-y-3", dark ? "bg-slate-900/60 border-slate-700" : "bg-white border-slate-200")}>
                  <div className="flex items-center gap-2">
                    <span className={cn("text-[10px] font-semibold opacity-40 w-6 shrink-0", sub)}>{i + 1}</span>
                    <input
                      value={item.text}
                      maxLength={30}
                      onChange={(e) => setItems((p) => p.map((it, idx) => idx === i ? { ...it, text: e.target.value } : it))}
                      placeholder={t("instagram_main_menu_dialog.item_label_placeholder")}
                      className={cn(inputCls, "flex-1")}
                    />
                    <select
                      value={item.payloadType}
                      onChange={(e) => setItems((p) => p.map((it, idx) => idx === i ? { ...it, payloadType: e.target.value as "postback" | "web_url" } : it))}
                      className={cn(selectCls, "w-28 shrink-0")}
                    >
                      <option value="postback">{t("instagram_main_menu_dialog.automation_option")}</option>
                      <option value="web_url">{t("instagram_main_menu_dialog.web_url_option")}</option>
                    </select>
                    <button
                      onClick={() => setItems((p) => p.filter((_, idx) => idx !== i))}
                      className={cn("w-9 h-9 rounded-xl border flex items-center justify-center transition-all text-rose-500 shrink-0", dark ? "border-slate-700 hover:bg-rose-500/10" : "border-slate-200 hover:bg-rose-500/10")}
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                  <div className="pl-8">
                    {item.payloadType === "postback" ? (
                      <>
                        <label className={cn("text-[11px] font-semibold opacity-50 mb-1 block", sub)}>{t("instagram_main_menu_dialog.trigger_automation")}</label>
                        <select
                          value={item.automationId ?? ""}
                          onChange={(e) => setItems((p) => p.map((it, idx) => idx === i ? { ...it, automationId: e.target.value || null } : it))}
                          className={cn(selectCls, "w-full")}
                        >
                          <option value="">{t("instagram_main_menu_dialog.no_automation")}</option>
                          {automations.map((a: any) => (
                            <option key={a.id} value={String(a.id)}>{a.name}</option>
                          ))}
                        </select>
                      </>
                    ) : (
                      <>
                        <label className={cn("text-[11px] font-semibold opacity-50 mb-1 block", sub)}>{t("instagram_main_menu_dialog.url_label")}</label>
                        <input
                          value={item.payload}
                          onChange={(e) => setItems((p) => p.map((it, idx) => idx === i ? { ...it, payload: e.target.value } : it))}
                          placeholder="https://example.com"
                          className={inputCls}
                        />
                      </>
                    )}
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
                  <Trash2 size={12} /> {t("instagram_main_menu_dialog.clear_all")}
                </button>
              )}
              {items.length < 20 && (
                <button
                  onClick={() => setItems((p) => [...p, { text: "", payloadType: "postback", payload: "", automationId: null }])}
                  className="h-10 px-5 rounded-xl border text-[11px] font-semibold transition-all flex items-center gap-2 border-primary text-primary hover:bg-primary hover:text-white"
                >
                  <Plus size={12} /> {t("instagram_main_menu_dialog.add_item")}
                </button>
              )}
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={onClose}
                disabled={saveMutation.isPending || deleteMutation.isPending}
                className={cn("h-10 px-5 rounded-xl border text-[11px] font-semibold transition-all", dark ? "border-slate-700 text-slate-300 hover:border-slate-500" : "border-slate-200 text-slate-700 hover:border-slate-400")}
              >
                {t("instagram_main_menu_dialog.close")}
              </button>
              <button
                onClick={() => saveMutation.mutate()}
                disabled={saveMutation.isPending || items.length === 0}
                className="h-10 px-5 rounded-xl text-[11px] font-semibold transition-all bg-primary text-white hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {saveMutation.isPending ? t("instagram_main_menu_dialog.saving") : t("instagram_main_menu_dialog.save")}
              </button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
