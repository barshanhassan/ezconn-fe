import { Card, CardContent } from "@/components/ui/card";
import { CreditCard, ShieldCheck, Zap, MessageSquare, Info, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { useTranslation } from "react-i18next";

export default function BillingPage() {
  const { t } = useTranslation();
  return (
    <TooltipProvider>
      <div className="animate-in fade-in duration-700 p-6">
        {/* Unified Master Card */}
        <div className="bg-white dark:bg-slate-900/50 rounded-[20px] border border-slate-300 dark:border-slate-800 shadow-xl shadow-slate-200/50 dark:shadow-none overflow-hidden flex flex-col">
          
          {/* 1. Branded Header Section */}
          <div className="py-2.5 px-6 border-b border-slate-200 dark:border-slate-800/80 flex items-center justify-between bg-indigo-50/30 dark:bg-transparent">
            <div className="flex items-center gap-6">
              <div className="p-2.5 rounded-xl bg-indigo-500/10 text-indigo-600 border border-indigo-500/10 shadow-inner">
                <CreditCard size={22} strokeWidth={2.5} />
              </div>
              <div className="space-y-0.5">
                <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
                  {t("billing_page.title")}
                </h1>
                <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                  <Info size={12} className="text-indigo-400" />
                  {t("billing_page.billing_cycle_note")}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
               <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wide uppercase bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400 border border-emerald-200/50 dark:border-emerald-500/20">
                {t("billing_page.active_subscription")}
              </span>
            </div>
          </div>

          <div className="flex-1">
            {/* 2. Current Subscription Section */}
            <div className="p-4 border-b border-slate-100 dark:border-slate-800/50">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-1 h-4 bg-indigo-500 rounded-full" />
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">{t("billing_page.current_subscription_plan")}</h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="p-3 rounded-2xl bg-slate-50/50 dark:bg-slate-800/30 border border-slate-100 dark:border-slate-800/50">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">{t("billing_page.monthly_plan")}</p>
                  <p className="text-lg font-bold text-slate-900 dark:text-white">$200<span className="text-xs text-slate-400 font-medium ml-1">{t("billing_page.per_month")}</span></p>
                </div>
                <div className="p-3 rounded-2xl bg-slate-50/50 dark:bg-slate-800/30 border border-slate-100 dark:border-slate-800/50">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">{t("billing_page.user_tier")}</p>
                  <p className="text-lg font-bold text-slate-900 dark:text-white">5,000<span className="text-xs text-slate-400 font-medium ml-1">{t("billing_page.mau")}</span></p>
                </div>
                <div className="p-3 rounded-2xl bg-slate-50/50 dark:bg-slate-800/30 border border-slate-100 dark:border-slate-800/50">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">{t("billing_page.agent_seats")}</p>
                  <p className="text-lg font-bold text-slate-900 dark:text-white">2<span className="text-xs text-slate-400 font-medium ml-1">{t("billing_page.seats_included")}</span></p>
                </div>
                <div className="p-3 rounded-2xl bg-slate-50/50 dark:bg-slate-800/30 border border-slate-100 dark:border-slate-800/50">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">{t("billing_page.additional_users")}</p>
                  <p className="text-lg font-bold text-slate-900 dark:text-white">$0.25<span className="text-xs text-slate-400 font-medium ml-1">{t("billing_page.per_user_outside_tier")}</span></p>
                </div>
              </div>
            </div>

            {/* 3. Add-ons & Platform Support Section (Horizontal Split) */}
            <div className="grid grid-cols-1 md:grid-cols-2 border-b border-slate-100 dark:border-slate-800/50">
              <div className="p-4 border-r border-slate-100 dark:border-slate-800/50">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-1 h-4 bg-amber-500 rounded-full" />
                  <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">{t("billing_page.service_add_ons")}</h2>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between p-2.5 rounded-xl bg-amber-50/30 dark:bg-amber-500/5 border border-amber-100/50 dark:border-amber-500/10">
                    <div className="flex items-center gap-3">
                      <div className="p-1.5 rounded-lg bg-white dark:bg-slate-900 text-amber-500 shadow-sm">
                        <Zap size={14} />
                      </div>
                      <span className="text-[13px] font-semibold text-slate-700 dark:text-slate-200">{t("billing_page.extra_agent_capacity")}</span>
                    </div>
                    <span className="text-sm font-bold text-slate-900 dark:text-white">$100<span className="text-[10px] text-slate-400 ml-1">{t("billing_page.per_mo")}</span></span>
                  </div>
                  <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50/50 dark:bg-slate-800/30 border border-slate-100 dark:border-slate-800/50">
                    <div className="flex items-center gap-3">
                      <div className="p-1.5 rounded-lg bg-white dark:bg-slate-900 text-slate-400 shadow-sm">
                        <ShieldCheck size={14} />
                      </div>
                      <span className="text-[13px] font-semibold text-slate-700 dark:text-slate-200">{t("billing_page.single_agent_seat")}</span>
                    </div>
                    <span className="text-sm font-bold text-slate-900 dark:text-white">$50<span className="text-[10px] text-slate-400 ml-1">{t("billing_page.per_mo")}</span></span>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-slate-50/20 dark:bg-transparent">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-1 h-4 bg-blue-500 rounded-full" />
                  <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">{t("billing_page.platform_support")}</h2>
                </div>
                <div className="flex items-center justify-between p-3.5 rounded-2xl bg-white dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 shadow-sm">
                  <div className="space-y-1">
                    <p className="text-[13px] font-bold text-slate-800 dark:text-slate-100">{t("billing_page.premium_support_tier")}</p>
                    <p className="text-[10px] text-slate-400">{t("billing_page.premium_support_desc")}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-blue-600">$100<span className="text-xs text-slate-400 font-medium ml-1">{t("billing_page.per_month")}</span></p>
                  </div>
                </div>
              </div>
            </div>

            {/* 4. WhatsApp Conversations Section */}
            <div className="p-4 bg-emerald-50/10 dark:bg-transparent">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-1 h-4 bg-emerald-500 rounded-full" />
                  <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">{t("billing_page.whatsapp_conversations")}</h2>
                </div>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <a
                      href="https://developers.facebook.com/docs/whatsapp/pricing#rate-cards"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-600 uppercase tracking-wide hover:bg-emerald-50 dark:hover:bg-emerald-500/10 px-2 py-1 rounded-md transition-colors"
                    >
                      {t("billing_page.meta_rate_card")}
                      <ExternalLink size={10} />
                    </a>
                  </TooltipTrigger>
                  <TooltipContent className="text-[10px]">{t("billing_page.view_meta_pricing")}</TooltipContent>
                </Tooltip>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="flex items-center gap-4 p-3 rounded-2xl bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 shadow-sm">
                   <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600">
                    <MessageSquare size={16} />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">{t("billing_page.free_usage")}</p>
                    <p className="text-sm font-bold text-slate-900 dark:text-white">1,000<span className="text-xs text-slate-400 font-medium ml-1">{t("billing_page.included")}</span></p>
                  </div>
                </div>

                <div className="flex items-center gap-4 p-3 rounded-2xl bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 shadow-sm">
                   <div className="p-2 rounded-xl bg-blue-500/10 text-blue-600">
                    <Zap size={16} />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">{t("billing_page.additional_usage")}</p>
                    <p className="text-[11px] font-bold text-slate-700 dark:text-slate-300 line-clamp-1">{t("billing_page.based_on_destination")}</p>
                  </div>
                </div>

                <div className="flex items-center gap-4 p-3 rounded-2xl bg-indigo-500 text-white shadow-lg shadow-indigo-500/20">
                  <div className="p-2 rounded-xl bg-white/20 text-white">
                    <CreditCard size={16} />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-indigo-100 uppercase tracking-widest mb-0.5">{t("billing_page.billing_model")}</p>
                    <p className="text-sm font-bold">{t("billing_page.on_actual_usage")}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Footer Section (Optional) */}
          <div className="px-6 py-3 border-t border-slate-200 dark:border-slate-800/80 bg-slate-50/50 dark:bg-transparent flex items-center justify-between">
            <p className="text-[10px] text-slate-400 font-medium italic">
              {t("billing_page.tax_note")}
            </p>
            <div className="flex items-center gap-2">
               <ShieldCheck size={14} className="text-emerald-500" />
               <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{t("billing_page.secure_billing")}</span>
            </div>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}
