import { AlertCircle } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { useTheme } from "@/contexts/ThemeContext";
import { cn } from "@/lib/utils";

/**
 * Workspace WhatsApp channel limit dialog. Mirrors replyagent's
 * "Limit Reached" prompt — shown when the user tries to add a new WhatsApp
 * channel but has already hit the workspace's `whatsapp_channels_limit`.
 */
interface Props {
  open: boolean;
  limit: number | null;
  onClose: () => void;
}

export default function LimitReachedDialog({ open, limit, onClose }: Props) {
  const { mode } = useTheme();
  const dark = mode === "dark";
  const { t } = useTranslation();
  const channelWord =
    limit === 1
      ? t("limit_reached_dialog.channel_singular")
      : t("limit_reached_dialog.channel_plural");

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className={cn("rounded-[2rem] border p-0 max-w-md overflow-hidden", dark ? "bg-[#0f1829] border-slate-800" : "bg-white border-slate-200")}>
        <div className="p-7 space-y-5 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-orange-500/10 text-orange-500">
            <AlertCircle size={32} />
          </div>
          <div>
            <div className={cn("text-base font-black tracking-tight mb-2", dark ? "text-white" : "text-slate-900")}>
              {t("limit_reached_dialog.title")}
            </div>
            <p className={cn("text-[12px] leading-relaxed", dark ? "text-slate-400" : "text-slate-600")}>
              {t("limit_reached_dialog.description", {
                limit: limit ?? "—",
                channelWord,
              })}
            </p>
          </div>
          <div className="flex justify-center pt-2">
            <button
              onClick={onClose}
              className="h-10 px-6 rounded-xl text-[11px] font-semibold transition-all bg-primary text-white hover:bg-primary/90"
            >
              {t("limit_reached_dialog.ok")}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
