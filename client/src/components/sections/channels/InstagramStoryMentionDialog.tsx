import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Image as ImageIcon, Trash2 } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useTheme } from "@/contexts/ThemeContext";
import { cn } from "@/lib/utils";

/**
 * Story Mention automation per Instagram account. Mirrors replyagent's
 * "Story Mention" modal in `views/Workspaces/Settings/InstagramNew.vue`.
 *   • Toggle on → pick an automation that fires whenever someone mentions
 *     this account in their story.
 *   • Toggle off (or Delete) clears it.
 * Backend: GET/POST/DELETE `/api/instagram/pages/:id/story-mention`.
 */
interface Props {
  open: boolean;
  account: any | null;
  onClose: () => void;
}

export default function InstagramStoryMentionDialog({ open, account, onClose }: Props) {
  const { mode } = useTheme();
  const dark = mode === "dark";
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  const text = dark ? "text-white" : "text-slate-900";
  const sub = dark ? "text-slate-500" : "text-slate-400";
  const selectCls = cn(
    "w-full h-11 px-4 rounded-xl border text-[13px] font-bold transition-all focus:outline-none focus:ring-2 focus:ring-primary/30",
    dark ? "bg-slate-950/50 border-slate-800 text-white" : "bg-white border-slate-200 text-slate-900",
  );

  const [enabled, setEnabled] = useState(false);
  const [automationId, setAutomationId] = useState<string | null>(null);

  const { data: automationsData } = useQuery({
    queryKey: ["/api/automations"],
    queryFn: async () => (await apiRequest("GET", "/api/automations")).json(),
    enabled: open,
  });
  const automations: any[] = automationsData?.automations ?? automationsData?.data ?? [];

  const { data: storyData } = useQuery({
    queryKey: ["/api/instagram/pages", String(account?.id), "story-mention"],
    queryFn: async () => (await apiRequest("GET", `/api/instagram/pages/${account?.id}/story-mention`)).json(),
    enabled: open && !!account?.id,
  });

  useEffect(() => {
    if (open && storyData) {
      setEnabled(!!storyData.modelable_id);
      setAutomationId(storyData.modelable_id ? String(storyData.modelable_id) : null);
    }
  }, [open, storyData]);

  const hadAutomation = !!storyData?.modelable_id;

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/instagram/pages", String(account?.id), "story-mention"] });
    queryClient.invalidateQueries({ queryKey: ["/api/integrations/channels"] });
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!enabled || !automationId) {
        await apiRequest("DELETE", `/api/instagram/pages/${account?.id}/story-mention`);
      } else {
        await apiRequest("POST", `/api/instagram/pages/${account?.id}/story-mention`, { automation_id: automationId });
      }
    },
    onSuccess: () => { invalidate(); toast({ title: t("instagram_story_mention_dialog.saved"), description: t("instagram_story_mention_dialog.settings_updated") }); onClose(); },
    onError: () => toast({ title: t("instagram_story_mention_dialog.error"), description: t("instagram_story_mention_dialog.failed_to_save"), variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async () => { await apiRequest("DELETE", `/api/instagram/pages/${account?.id}/story-mention`); },
    onSuccess: () => { setEnabled(false); setAutomationId(null); invalidate(); toast({ title: t("instagram_story_mention_dialog.cleared"), description: t("instagram_story_mention_dialog.automation_removed") }); onClose(); },
    onError: () => toast({ title: t("instagram_story_mention_dialog.error"), description: t("instagram_story_mention_dialog.failed_to_clear"), variant: "destructive" }),
  });

  if (!account) return null;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className={cn("rounded-[2rem] border p-0 max-w-2xl overflow-hidden", dark ? "bg-[#0f1829] border-slate-800" : "bg-white border-slate-200")}>
        <div className="p-7 space-y-5">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-pink-500/10 flex items-center justify-center text-pink-500 shrink-0">
              <ImageIcon size={20} />
            </div>
            <div className="flex-1 min-w-0">
              <div className={cn("text-[14px] font-semibold", text)}>{t("instagram_story_mention_dialog.title")}</div>
              <p className={cn("text-[11px] font-medium opacity-60 mt-1 leading-relaxed", sub)}>
                {t("instagram_story_mention_dialog.description_prefix")}{" "}
                <span className="font-mono">@{account.username ?? account.name}</span>{" "}
                {t("instagram_story_mention_dialog.description_suffix")}
              </p>
            </div>
            <Switch
              checked={enabled}
              onCheckedChange={setEnabled}
              className="data-[state=checked]:bg-primary mt-1"
            />
          </div>

          {enabled && (
            <div className="space-y-2">
              <label className={cn("text-[11px] font-semibold", sub)}>{t("instagram_story_mention_dialog.select_label")}</label>
              <select
                value={automationId ?? ""}
                onChange={(e) => setAutomationId(e.target.value || null)}
                className={selectCls}
              >
                <option value="">{t("instagram_story_mention_dialog.choose_automation")}</option>
                {automations.map((a: any) => (
                  <option key={a.id} value={String(a.id)}>{a.name}</option>
                ))}
              </select>
            </div>
          )}

          <div className="flex items-center justify-between pt-2">
            <div>
              {hadAutomation && (
                <button
                  onClick={() => deleteMutation.mutate()}
                  disabled={deleteMutation.isPending}
                  className="h-10 px-5 rounded-xl text-[11px] font-semibold transition-all flex items-center gap-2 bg-rose-500 text-white hover:bg-rose-600 disabled:opacity-50"
                >
                  <Trash2 size={12} /> {deleteMutation.isPending ? t("instagram_story_mention_dialog.deleting") : t("instagram_story_mention_dialog.delete")}
                </button>
              )}
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={onClose}
                disabled={saveMutation.isPending || deleteMutation.isPending}
                className={cn("h-10 px-5 rounded-xl border text-[11px] font-semibold transition-all", dark ? "border-slate-700 text-slate-300 hover:border-slate-500" : "border-slate-200 text-slate-700 hover:border-slate-400")}
              >
                {t("instagram_story_mention_dialog.close")}
              </button>
              <button
                onClick={() => saveMutation.mutate()}
                disabled={saveMutation.isPending || (enabled && !automationId)}
                className="h-10 px-5 rounded-xl text-[11px] font-semibold transition-all bg-primary text-white hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {saveMutation.isPending ? t("instagram_story_mention_dialog.saving") : t("instagram_story_mention_dialog.save")}
              </button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
