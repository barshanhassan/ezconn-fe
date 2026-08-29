import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ChevronLeft,
  MoreVertical,
  Plus,
  ExternalLink,
  RefreshCw,
  Phone,
  Trash2,
  AlertCircle,
  Eye,
  EyeOff,
  Copy,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { cn } from "@/lib/utils";
import { useTheme } from "@/contexts/ThemeContext";

export default function SmsCallsSection() {
  const { t } = useTranslation();
  const { mode } = useTheme();
  const dark = mode === "dark";
  const { toast } = useToast();
  const [view, setView] = useState<"list" | "manage">("list");
  const queryClient = useQueryClient();

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

  const { data: channels, isLoading } = useQuery({
    queryKey: ["/api/integrations/channels"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/integrations/channels");
      return res.json();
    },
  });

  const accounts = channels?.twilio || [];
  const hasAccounts = accounts.length > 0;

  const deleteMutation = useMutation({
    mutationFn: async (id: number | string) => {
      await apiRequest("DELETE", `/api/integrations/channels/twilio/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/integrations/channels"] });
      toast({ title: t("sms_calls_section.toast_deleted_title"), description: t("sms_calls_section.toast_deleted_description") });
    },
  });

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [accountToDelete, setAccountToDelete] = useState<any>(null);
  const [showSecret, setShowSecret] = useState<Record<number, boolean>>({});

  const toggleSecret = (id: number) => setShowSecret((p) => ({ ...p, [id]: !p[id] }));

  const handleConnect = () => {
    toast({ title: t("sms_calls_section.toast_connecting_title"), description: t("sms_calls_section.toast_connecting_description") });
  };

  const copyToken = (val: string) => {
    if (!val) return;
    navigator.clipboard.writeText(val);
    toast({ title: t("sms_calls_section.toast_copied_title"), description: t("sms_calls_section.toast_copied_description") });
  };

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
          {/* Header — dynamic per view */}
          <div className={cn("px-8 py-5 border-b flex items-center justify-between", border)}>
            <div className="flex items-center gap-4">
              <div className={cn("p-2.5 rounded-xl shadow-sm", dark ? "bg-red-500/15" : "bg-red-500/10")}>
                <img src="/images/automations/sms.svg" alt="Twilio" className="w-5 h-5" />
              </div>
              <div>
                <h1 className={cn("text-[16px] font-bold tracking-tight", text)}>{t("sms_calls_section.title")}</h1>
                <p className={cn("text-[11px] font-bold mt-0.5 opacity-60 max-w-2xl", sub)}>
                  {view === "list"
                    ? t("sms_calls_section.subtitle_list")
                    : t("sms_calls_section.subtitle_manage")}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {view === "manage" && (
                <>
                  <button onClick={handleConnect} className={primaryOutlineBtn}>
                    <Plus size={12} /> {t("sms_calls_section.add_new")}
                  </button>
                  <button onClick={() => setView("list")} className={outlineBtn}>
                    <ChevronLeft size={12} /> {t("sms_calls_section.back")}
                  </button>
                </>
              )}
            </div>
          </div>

          {/* ── LIST VIEW ── */}
          {view === "list" && (
            <div className="p-8">
              <div className={cn("p-6 rounded-[1.5rem] border transition-all hover:shadow-md hover:border-red-500/40 flex flex-col", softBg, softBorder)}>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center">
                      <img src="/images/automations/sms.svg" alt="Twilio" className="w-5 h-5" />
                    </div>
                    <h3 className={cn("text-[14px] font-black tracking-tight", text)}>{t("sms_calls_section.title")}</h3>
                  </div>
                  <a
                    href="https://www.twilio.com/docs"
                    target="_blank"
                    rel="noopener noreferrer"
                    className={cn("w-8 h-8 rounded-lg flex items-center justify-center transition-all", dark ? "hover:bg-slate-800 text-slate-400 hover:text-primary" : "hover:bg-slate-100 text-slate-500 hover:text-primary")}
                  >
                    <ExternalLink size={14} />
                  </a>
                </div>

                <p className={cn("text-[11px] font-medium opacity-70 leading-relaxed mb-5 flex-1", sub)}>
                  {t("sms_calls_section.list_description")}
                </p>

                <button onClick={() => setView("manage")} className={cn(primaryOutlineBtn, "self-end")}>
                  {t("sms_calls_section.manage")}
                </button>
              </div>
            </div>
          )}

          {/* ── MANAGE VIEW ── */}
          {view === "manage" && (
            <div className="p-8 space-y-5">
              {!hasAccounts ? (
                <div className={cn("rounded-[1.5rem] border py-16 px-8 flex flex-col items-center justify-center text-center space-y-5", softBg, softBorder)}>
                  <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center">
                    <img src="/images/automations/sms.svg" alt="Twilio" className="w-8 h-8" />
                  </div>
                  <div className="space-y-1.5 max-w-sm">
                    <h3 className={cn("text-[14px] font-black tracking-tight", text)}>{t("sms_calls_section.empty_title")}</h3>
                    <p className={cn("text-[11px] font-medium opacity-60 leading-relaxed", sub)}>
                      {t("sms_calls_section.empty_description")}
                    </p>
                  </div>
                  <button onClick={handleConnect} className={primaryOutlineBtn}>
                    {t("sms_calls_section.connect_now")}
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {accounts.map((account: any) => {
                    const sidVisible = !!showSecret[account.id];
                    const sid = account.account_sid || account.sid || "";
                    const maskedSid = sid ? `${sid.slice(0, 6)}${"•".repeat(Math.max(0, sid.length - 10))}${sid.slice(-4)}` : "—";
                    return (
                      <div key={account.id} className={cn("rounded-[1.5rem] border overflow-hidden", softBorder, softBg)}>
                        {/* Account Header */}
                        <div className={cn("px-6 py-4 border-b flex items-center justify-between gap-4", softBorder, dark ? "bg-slate-900/40" : "bg-white/60")}>
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center shrink-0">
                              <img src="/images/automations/sms.svg" alt="Twilio" className="w-6 h-6" />
                            </div>
                            <div className="min-w-0">
                              <p className={cn("text-[13px] font-black truncate", text)}>{account.name || t("sms_calls_section.twilio_account_fallback")}</p>
                              <div className="flex items-center gap-2 mt-0.5">
                                {account.phone_number && (
                                  <Badge variant="outline" className="h-5 px-2 rounded-md border-red-500/20 bg-red-500/5 text-red-600 dark:text-red-400 text-[10px] font-semibold">
                                    {account.phone_number}
                                  </Badge>
                                )}
                                <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> {t("sms_calls_section.active")}
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              onClick={() => toast({ title: t("sms_calls_section.toast_syncing_title"), description: t("sms_calls_section.toast_syncing_description") })}
                              className={outlineBtn}
                            >
                              <RefreshCw size={12} /> {t("sms_calls_section.sync")}
                            </button>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <button className={cn("w-10 h-10 rounded-xl border flex items-center justify-center transition-all", dark ? "border-slate-800 hover:border-primary/40 hover:text-primary" : "border-slate-200 hover:border-primary/40 hover:text-primary")}>
                                  <MoreVertical size={14} />
                                </button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className={cn("rounded-xl p-1.5 min-w-[180px]", dark ? "bg-[#0f1829] border-slate-800" : "")}>
                                <DropdownMenuItem
                                  onClick={() => { setAccountToDelete(account); setShowDeleteConfirm(true); }}
                                  className="rounded-lg py-2 cursor-pointer gap-2 font-bold text-[11px] text-rose-500"
                                >
                                  <Trash2 size={12} /> {t("sms_calls_section.delete")}
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </div>

                        {/* Credentials */}
                        <div className="px-6 py-4 space-y-3">
                          <div className="space-y-2">
                            <label className={cn("text-[11px] font-semibold pl-1 block", sub)}>{t("sms_calls_section.account_sid")}</label>
                            <div className={cn("flex items-center gap-2 px-3 h-11 rounded-xl border", card, border)}>
                              <code className={cn("text-[12px] font-mono font-bold flex-1 truncate", text)}>
                                {sidVisible ? sid : maskedSid}
                              </code>
                              <button
                                onClick={() => toggleSecret(account.id)}
                                className={cn("w-8 h-8 rounded-lg flex items-center justify-center transition-all", dark ? "hover:bg-slate-800 text-slate-400 hover:text-primary" : "hover:bg-slate-100 text-slate-500 hover:text-primary")}
                              >
                                {sidVisible ? <EyeOff size={14} /> : <Eye size={14} />}
                              </button>
                              <button
                                onClick={() => copyToken(sid)}
                                className={cn("w-8 h-8 rounded-lg flex items-center justify-center transition-all", dark ? "hover:bg-slate-800 text-slate-400 hover:text-primary" : "hover:bg-slate-100 text-slate-500 hover:text-primary")}
                              >
                                <Copy size={14} />
                              </button>
                            </div>
                          </div>

                          {account.phone_number && (
                            <div className="space-y-2">
                              <label className={cn("text-[11px] font-semibold pl-1 block", sub)}>{t("sms_calls_section.phone_number")}</label>
                              <div className={cn("flex items-center gap-2 px-3 h-11 rounded-xl border", card, border)}>
                                <Phone size={14} className="text-red-500 shrink-0" />
                                <code className={cn("text-[12px] font-mono font-bold flex-1 truncate", text)}>{account.phone_number}</code>
                                <button
                                  onClick={() => copyToken(account.phone_number)}
                                  className={cn("w-8 h-8 rounded-lg flex items-center justify-center transition-all", dark ? "hover:bg-slate-800 text-slate-400 hover:text-primary" : "hover:bg-slate-100 text-slate-500 hover:text-primary")}
                                >
                                  <Copy size={14} />
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
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
                <h2 className={cn("text-[14px] font-semibold", text)}>{t("sms_calls_section.delete_dialog_title")}</h2>
                <p className={cn("text-[11px] font-medium opacity-60 mt-0.5 leading-relaxed", sub)}>
                  <span className="text-rose-500 font-black">{accountToDelete?.name || accountToDelete?.phone_number}</span> {t("sms_calls_section.delete_dialog_suffix")}
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <AlertDialogCancel className={cn(outlineBtn, "m-0")}>{t("sms_calls_section.cancel")}</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => { deleteMutation.mutate(accountToDelete.id); setShowDeleteConfirm(false); }}
                className="h-11 px-7 rounded-xl bg-rose-500 hover:bg-rose-600 text-white text-[11px] font-semibold transition-all shadow-lg shadow-rose-500/20 flex items-center gap-2"
              >
                <Trash2 size={12} /> {t("sms_calls_section.delete")}
              </AlertDialogAction>
            </div>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
