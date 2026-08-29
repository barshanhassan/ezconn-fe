import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ChevronLeft,
  MoreVertical,
  Plus,
  ExternalLink,
  RefreshCw,
  Bot,
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
import { Switch } from "@/components/ui/switch";
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

export default function TelegramSection() {
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

  const bots = channels?.telegram || [];
  const hasBots = bots.length > 0;

  const deleteMutation = useMutation({
    mutationFn: async (id: number | string) => {
      await apiRequest("DELETE", `/api/integrations/channels/telegram/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/integrations/channels"] });
      toast({ title: t("telegram_section.toast_deleted_title"), description: t("telegram_section.toast_deleted_description") });
    },
  });

  const [showToken, setShowToken] = useState<Record<number, boolean>>({});
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [botToDelete, setBotToDelete] = useState<any>(null);

  const handleConnect = () => {
    toast({ title: t("telegram_section.toast_connecting_title"), description: t("telegram_section.toast_connecting_description") });
  };

  const toggleTokenVisibility = (id: number) => {
    setShowToken((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const copyToken = (token: string) => {
    navigator.clipboard.writeText(token);
    toast({ title: t("telegram_section.toast_copied_title"), description: t("telegram_section.toast_copied_description") });
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
              <div className={cn("p-2.5 rounded-xl shadow-sm", dark ? "bg-sky-500/15" : "bg-sky-500/10")}>
                <img src="/images/automations/telegram.svg" alt="Telegram" className="w-5 h-5" />
              </div>
              <div>
                <h1 className={cn("text-[16px] font-bold tracking-tight", text)}>{t("telegram_section.title")}</h1>
                <p className={cn("text-[11px] font-bold mt-0.5 opacity-60 max-w-2xl", sub)}>
                  {view === "list"
                    ? t("telegram_section.subtitle_list")
                    : t("telegram_section.subtitle_manage")}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {view === "manage" && (
                <>
                  <button onClick={handleConnect} className={primaryOutlineBtn}>
                    <Plus size={12} /> {t("telegram_section.add_new")}
                  </button>
                  <button onClick={() => setView("list")} className={outlineBtn}>
                    <ChevronLeft size={12} /> {t("telegram_section.back")}
                  </button>
                </>
              )}
            </div>
          </div>

          {/* ── LIST VIEW ── */}
          {view === "list" && (
            <div className="p-8">
              <div className={cn("p-6 rounded-[1.5rem] border transition-all hover:shadow-md hover:border-sky-500/40 flex flex-col", softBg, softBorder)}>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-sky-500/10 flex items-center justify-center">
                      <img src="/images/automations/telegram.svg" alt="Telegram" className="w-5 h-5" />
                    </div>
                    <h3 className={cn("text-[14px] font-black tracking-tight", text)}>{t("telegram_section.title")}</h3>
                  </div>
                  <a
                    href="https://core.telegram.org/bots"
                    target="_blank"
                    rel="noopener noreferrer"
                    className={cn("w-8 h-8 rounded-lg flex items-center justify-center transition-all", dark ? "hover:bg-slate-800 text-slate-400 hover:text-primary" : "hover:bg-slate-100 text-slate-500 hover:text-primary")}
                  >
                    <ExternalLink size={14} />
                  </a>
                </div>

                <p className={cn("text-[11px] font-medium opacity-70 leading-relaxed mb-5 flex-1", sub)}>
                  {t("telegram_section.list_description")}
                </p>

                <button onClick={() => setView("manage")} className={cn(primaryOutlineBtn, "self-end")}>
                  {t("telegram_section.manage")}
                </button>
              </div>
            </div>
          )}

          {/* ── MANAGE VIEW ── */}
          {view === "manage" && (
            <div className="p-8 space-y-5">
              {!hasBots ? (
                <div className={cn("rounded-[1.5rem] border py-16 px-8 flex flex-col items-center justify-center text-center space-y-5", softBg, softBorder)}>
                  <div className="w-16 h-16 rounded-full bg-sky-500/10 flex items-center justify-center">
                    <img src="/images/automations/telegram.svg" alt="Telegram" className="w-8 h-8" />
                  </div>
                  <div className="space-y-1.5 max-w-sm">
                    <h3 className={cn("text-[14px] font-black tracking-tight", text)}>{t("telegram_section.empty_title")}</h3>
                    <p className={cn("text-[11px] font-medium opacity-60 leading-relaxed", sub)}>
                      {t("telegram_section.empty_description")}
                    </p>
                  </div>
                  <button onClick={handleConnect} className={primaryOutlineBtn}>
                    {t("telegram_section.connect_now")}
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {bots.map((bot: any) => {
                    const tokenVisible = !!showToken[bot.id];
                    const token = bot.token || bot.bot_token || "";
                    const maskedToken = token ? `${token.slice(0, 8)}${"•".repeat(Math.max(0, token.length - 12))}${token.slice(-4)}` : "—";
                    return (
                      <div key={bot.id} className={cn("rounded-[1.5rem] border overflow-hidden", softBorder, softBg)}>
                        {/* Bot Header */}
                        <div className={cn("px-6 py-4 border-b flex items-center justify-between gap-4", softBorder, dark ? "bg-slate-900/40" : "bg-white/60")}>
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-12 h-12 rounded-full bg-sky-500/10 flex items-center justify-center shrink-0">
                              <Bot className="w-5 h-5 text-sky-500" />
                            </div>
                            <div className="min-w-0">
                              <p className={cn("text-[13px] font-black truncate", text)}>{bot.name || bot.username || t("telegram_section.telegram_bot_fallback")}</p>
                              <div className="flex items-center gap-2 mt-0.5">
                                {bot.username && (
                                  <Badge variant="outline" className="h-5 px-2 rounded-md border-sky-500/20 bg-sky-500/5 text-sky-600 dark:text-sky-400 text-[10px] font-semibold">
                                    @{bot.username}
                                  </Badge>
                                )}
                                <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> {t("telegram_section.active")}
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              onClick={() => toast({ title: t("telegram_section.toast_syncing_title"), description: t("telegram_section.toast_syncing_description") })}
                              className={outlineBtn}
                            >
                              <RefreshCw size={12} /> {t("telegram_section.sync")}
                            </button>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <button className={cn("w-10 h-10 rounded-xl border flex items-center justify-center transition-all", dark ? "border-slate-800 hover:border-primary/40 hover:text-primary" : "border-slate-200 hover:border-primary/40 hover:text-primary")}>
                                  <MoreVertical size={14} />
                                </button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className={cn("rounded-xl p-1.5 min-w-[200px]", dark ? "bg-[#0f1829] border-slate-800" : "")}>
                                <DropdownMenuItem
                                  onSelect={(e) => e.preventDefault()}
                                  className="rounded-lg py-2 cursor-pointer gap-2 font-bold text-[11px] flex justify-between"
                                >
                                  <span className="flex items-center gap-2">
                                    <Bot size={12} className="text-primary" /> {t("telegram_section.ai_feeder")}
                                  </span>
                                  <Switch
                                    checked={bot.allow_in_feeder}
                                    onCheckedChange={() => toast({ title: t("telegram_section.toast_updated_title"), description: t("telegram_section.toast_ai_feeder_description") })}
                                    className="data-[state=checked]:bg-primary"
                                  />
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => { setBotToDelete(bot); setShowDeleteConfirm(true); }}
                                  className="rounded-lg py-2 cursor-pointer gap-2 font-bold text-[11px] text-rose-500"
                                >
                                  <Trash2 size={12} /> {t("telegram_section.delete")}
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </div>

                        {/* Bot Token */}
                        <div className="px-6 py-4">
                          <div className="space-y-2">
                            <label className={cn("text-[11px] font-semibold pl-1 block", sub)}>{t("telegram_section.bot_token")}</label>
                            <div className={cn("flex items-center gap-2 px-3 h-11 rounded-xl border", card, border)}>
                              <code className={cn("text-[12px] font-mono font-bold flex-1 truncate", text)}>
                                {tokenVisible ? token : maskedToken}
                              </code>
                              <button
                                onClick={() => toggleTokenVisibility(bot.id)}
                                className={cn("w-8 h-8 rounded-lg flex items-center justify-center transition-all", dark ? "hover:bg-slate-800 text-slate-400 hover:text-primary" : "hover:bg-slate-100 text-slate-500 hover:text-primary")}
                                title={tokenVisible ? t("telegram_section.hide_token") : t("telegram_section.show_token")}
                              >
                                {tokenVisible ? <EyeOff size={14} /> : <Eye size={14} />}
                              </button>
                              <button
                                onClick={() => copyToken(token)}
                                className={cn("w-8 h-8 rounded-lg flex items-center justify-center transition-all", dark ? "hover:bg-slate-800 text-slate-400 hover:text-primary" : "hover:bg-slate-100 text-slate-500 hover:text-primary")}
                                title={t("telegram_section.copy_token")}
                              >
                                <Copy size={14} />
                              </button>
                            </div>
                          </div>
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
                <h2 className={cn("text-[14px] font-semibold", text)}>{t("telegram_section.delete_dialog_title")}</h2>
                <p className={cn("text-[11px] font-medium opacity-60 mt-0.5 leading-relaxed", sub)}>
                  <span className="text-rose-500 font-black">{botToDelete?.name || botToDelete?.username}</span> {t("telegram_section.delete_dialog_suffix")}
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <AlertDialogCancel className={cn(outlineBtn, "m-0")}>{t("telegram_section.cancel")}</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => { deleteMutation.mutate(botToDelete.id); setShowDeleteConfirm(false); }}
                className="h-11 px-7 rounded-xl bg-rose-500 hover:bg-rose-600 text-white text-[11px] font-semibold transition-all shadow-lg shadow-rose-500/20 flex items-center gap-2"
              >
                <Trash2 size={12} /> {t("telegram_section.delete")}
              </AlertDialogAction>
            </div>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
