import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { UserCog, Users } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useTheme } from "@/contexts/ThemeContext";
import { cn } from "@/lib/utils";

/**
 * Page Users (access control) per Instagram account. Mirrors replyagent's
 * "Page Users" modal in `views/Workspaces/Settings/InstagramNew.vue`.
 *   • Pick which workspace agents can manage / respond from this account.
 *   • Save replaces the assignment set.
 * Backend: GET/POST `/api/instagram/pages/:id/users`; members from
 * `/api/workspaces/members`.
 */
interface Props {
  open: boolean;
  account: any | null;
  onClose: () => void;
}

const igGradient = "bg-gradient-to-tr from-yellow-400 via-pink-500 to-purple-600";

export default function InstagramPageUsersDialog({ open, account, onClose }: Props) {
  const { mode } = useTheme();
  const dark = mode === "dark";
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  const text = dark ? "text-white" : "text-slate-900";
  const sub = dark ? "text-slate-500" : "text-slate-400";

  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set());

  const { data: membersData } = useQuery({
    queryKey: ["/api/workspaces/members"],
    queryFn: async () => (await apiRequest("GET", "/api/workspaces/members")).json(),
    enabled: open,
  });
  const members: any[] = membersData?.members ?? membersData ?? [];

  const { data: pageUsersData } = useQuery({
    queryKey: ["/api/instagram/pages", String(account?.id), "users"],
    queryFn: async () => (await apiRequest("GET", `/api/instagram/pages/${account?.id}/users`)).json(),
    enabled: open && !!account?.id,
  });

  useEffect(() => {
    if (open && pageUsersData) {
      setSelectedUserIds(new Set((Array.isArray(pageUsersData) ? pageUsersData : []).map((u: any) => String(u.user_id))));
    }
  }, [open, pageUsersData]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", `/api/instagram/pages/${account?.id}/users`, {
        user_ids: Array.from(selectedUserIds),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/instagram/pages", String(account?.id), "users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/integrations/channels"] });
      toast({ title: t("instagram_page_users_dialog.saved"), description: t("instagram_page_users_dialog.page_users_updated") });
      onClose();
    },
    onError: () => toast({ title: t("instagram_page_users_dialog.error"), description: t("instagram_page_users_dialog.failed_to_save"), variant: "destructive" }),
  });

  function toggleUser(id: string) {
    setSelectedUserIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  if (!account) return null;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className={cn("rounded-[2rem] border p-0 max-w-2xl overflow-hidden", dark ? "bg-[#0f1829] border-slate-800" : "bg-white border-slate-200")}>
        <div className="p-7 space-y-5">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-pink-500/10 flex items-center justify-center text-pink-500 shrink-0">
              <UserCog size={20} />
            </div>
            <div className="flex-1 min-w-0">
              <div className={cn("text-[14px] font-semibold", text)}>{t("instagram_page_users_dialog.title")}</div>
              <p className={cn("text-[11px] font-medium opacity-60 mt-1 leading-relaxed", sub)}>
                {t("instagram_page_users_dialog.description_prefix")}{" "}
                <span className="font-mono">@{account.username ?? account.name}</span>.
              </p>
            </div>
          </div>

          {members.length === 0 ? (
            <div className={cn("rounded-xl border py-10 flex flex-col items-center justify-center text-center gap-3", dark ? "border-slate-800" : "border-slate-100")}>
              <Users size={24} className="opacity-30" />
              <p className={cn("text-[11px] opacity-50 font-medium", sub)}>{t("instagram_page_users_dialog.no_members_found")}</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1">
              {members.map((m: any) => {
                const uid = String(m.id);
                const checked = selectedUserIds.has(uid);
                return (
                  <div
                    key={uid}
                    onClick={() => toggleUser(uid)}
                    className={cn(
                      "flex items-center gap-4 px-4 py-3 rounded-xl border cursor-pointer transition-all",
                      checked
                        ? dark ? "border-primary/40 bg-primary/10" : "border-primary/30 bg-primary/5"
                        : dark ? "border-slate-800 hover:border-slate-700" : "border-slate-200 hover:border-slate-300",
                    )}
                  >
                    <div className={cn("w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-black shrink-0 text-white", igGradient)}>
                      {(m.name || m.email || "?")[0].toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={cn("text-[12px] font-black truncate", text)}>{m.name || "—"}</p>
                      <p className={cn("text-[10px] opacity-50 truncate", sub)}>{m.email}</p>
                    </div>
                    <div className={cn("w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-all", checked ? "bg-primary border-primary" : dark ? "border-slate-600" : "border-slate-300")}>
                      {checked && (
                        <svg viewBox="0 0 10 8" fill="none" className="w-3 h-3">
                          <path d="M1 4l2.5 2.5L9 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              onClick={onClose}
              disabled={saveMutation.isPending}
              className={cn("h-10 px-5 rounded-xl border text-[11px] font-semibold transition-all", dark ? "border-slate-700 text-slate-300 hover:border-slate-500" : "border-slate-200 text-slate-700 hover:border-slate-400")}
            >
              {t("instagram_page_users_dialog.close")}
            </button>
            <button
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending || members.length === 0}
              className="h-10 px-5 rounded-xl text-[11px] font-semibold transition-all bg-primary text-white hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {saveMutation.isPending ? t("instagram_page_users_dialog.saving") : t("instagram_page_users_dialog.save")}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
