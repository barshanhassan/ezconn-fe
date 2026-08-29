import React from 'react';
import { ArrowLeft, ShieldCheck, Wallet, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTheme } from "@/contexts/ThemeContext";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { getUserInfo } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";

interface CheckoutProps {
  onBack: () => void;
}

// Default (no white-label logo uploaded) mark — same icon used on the auth pages/sidebars.
const BotMark = ({ className = "" }: { className?: string }) => (
  <svg viewBox="0 0 40 52" className={className}>
    <path fillRule="evenodd" clipRule="evenodd" d="M6 3 H34 A4 4 0 0 1 38 7 V17 A4 4 0 0 1 34 21 H6 A4 4 0 0 1 2 17 V7 A4 4 0 0 1 6 3 Z M11 12 a3.2 3.2 0 1 0 6.4 0 a3.2 3.2 0 1 0 -6.4 0 Z M22.6 12 a3.2 3.2 0 1 0 6.4 0 a3.2 3.2 0 1 0 -6.4 0 Z" fill="#25d366" />
    <rect x="4" y="25" width="32" height="5.5" rx="2" fill="#25d366" />
    <rect x="16.5" y="30" width="7" height="20" rx="2" fill="#25d366" />
  </svg>
);

/**
 * Same layout/shell as AgencyIgniteCheckout, but for the Swich-settled test
 * plan: a single real line item, no fake credits/coupons, and "Proceed To
 * Checkout" actually calls the backend (agency-scoped Swich credentials) to
 * build a Landing Page URL and redirects there — Chargebee's hosted-page
 * equivalent, just pointed at Swich instead.
 */
const AgencySwichCheckout: React.FC<CheckoutProps> = ({ onBack }) => {
  const { mode } = useTheme();
  const dark = mode === "dark";
  const { toast } = useToast();
  const { t } = useTranslation();

  const agencyId = (() => { try { return getUserInfo()?.modelable_id; } catch { return null; } })();
  const agencyEmail = (() => { try { return getUserInfo()?.email || ""; } catch { return ""; } })();
  const { data: agencyResp } = useQuery<any>({
    queryKey: [`/api/organizations/${agencyId}`],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/organizations/${agencyId}`);
      return res.json();
    },
    enabled: !!agencyId,
  });
  const agencyName: string = agencyResp?.agency?.name || t("agency_swich_checkout.agency_owner_fallback");
  // Swich's own record of "who paid" is the msisdn — we don't have the
  // agency owner's mobile number stored anywhere on the frontend, so unlike
  // name/email (pulled from the session) it has to be typed here.
  const [msisdn, setMsisdn] = React.useState("");
  const b = agencyResp?.agency?.branding;
  const agencyLogoUrl: string | null = dark
    ? b?.logo_dark_small || b?.logo_light_small || b?.logo_dark || b?.logo_light || null
    : b?.logo_light_small || b?.logo_dark_small || b?.logo_light || b?.logo_dark || null;

  const bg     = dark ? 'bg-[#0b1120]'  : 'bg-slate-50/80';
  const card   = dark ? 'bg-[#0f1829]'  : 'bg-white';
  const border = dark ? 'border-slate-800' : 'border-slate-200';
  const text   = dark ? 'text-white'    : 'text-slate-900';
  const sub    = dark ? 'text-slate-500' : 'text-slate-400';

  const checkoutMutation = useMutation({
    mutationFn: async () => {
      // Generated client-side (not server-side) so it can be embedded in
      // successRedirectUrl below — we need the id *before* the request goes
      // out, since Swich bakes successRedirectUrl into the checkout page it
      // builds and won't let us change it afterwards.
      const customerTransactionId = `AGW${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`.slice(0, 50);
      const res = await apiRequest("POST", "/api/swich/agency/landing-page", {
        customerTransactionId,
        item: t("agency_swich_checkout.plan_name"),
        amount: 1,
        description: "Agentawk agency test plan",
        payeeName: agencyName,
        email: agencyEmail,
        msisdn,
        // Section 17 — brings the customer back to our app after a successful
        // payment instead of leaving them on Swich's generic "Done" page.
        // Carries the transaction id so we can auto-Inquire (Section 13) on
        // landing, instead of the customer having to do anything manually.
        // Still display-only: the real success/failure is decided by
        // whatever Inquire/the callback reports, never by this redirect
        // firing, since anyone could hit this URL directly.
        successRedirectUrl: `${window.location.origin}/org/billing/plans?swich_status=success&customerTransactionId=${customerTransactionId}`,
      });
      return res.json();
    },
    onSuccess: (data) => {
      window.location.href = data.url;
    },
    onError: () => {
      toast({
        title: t("agency_swich_checkout.error_title"),
        description: t("agency_swich_checkout.error_desc"),
        variant: "destructive",
      });
    },
  });

  return (
    <div className={cn("min-h-screen transition-colors flex flex-col font-sans", bg)}>
      {/* ── Header ── */}
      <div className={cn('px-8 py-5 border-b flex items-center justify-between', card, border)}>
        <div className="flex items-center gap-3">
          {agencyLogoUrl ? (
            <img
              src={agencyLogoUrl}
              alt="Organization logo"
              className="w-9 h-9 object-contain"
              onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
            />
          ) : (
            <BotMark className="w-9 h-9 shrink-0" />
          )}
          <span className={cn("font-bold text-[18px] tracking-tight", text)}>
            AGEN<span className="text-[#25d366]">TAWK</span>
          </span>
        </div>
        <button
          onClick={onBack}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-[12px] font-semibold bg-primary hover:opacity-90 text-primary-foreground transition-colors shadow-sm"
        >
          <ArrowLeft size={14} /> {t("agency_swich_checkout.back")}
        </button>
      </div>

      <div className="w-full max-w-[1400px] px-8 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
          {/* Left Column: single line item */}
          <div className="lg:col-span-7">
            <div className={cn("rounded-[20px] border shadow-sm overflow-hidden", card, border)}>
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                <div className="p-5 flex items-center justify-between hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shrink-0", dark ? "bg-slate-800/50" : "bg-slate-100/50")}>
                      <Wallet className="w-4 h-4 text-teal-500" />
                    </div>
                    <div className="flex flex-col">
                      <div className="flex items-center gap-2">
                        <span className={cn("text-[13px] font-bold", text)}>{t("agency_swich_checkout.plan_name")}</span>
                        <span className={cn("text-[8px] font-black tracking-widest px-1.5 py-0.5 rounded uppercase", dark ? "bg-slate-800 text-slate-500" : "bg-slate-100 text-slate-400")}>
                          {t("agency_swich_checkout.plan_badge")}
                        </span>
                      </div>
                      <p className={cn("text-[11px] font-medium mt-0.5", sub)}>{t("agency_swich_checkout.plan_desc")}</p>
                    </div>
                  </div>
                  <span className={cn("text-[14px] font-bold", text)}>Rs. 1.00</span>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Order Summary */}
          <div className="lg:col-span-5">
            <div className={cn("rounded-[20px] border p-8 sticky top-8 shadow-xl", card, border)}>
              <h3 className={cn("text-[16px] font-bold mb-8", text)}>{t("agency_swich_checkout.order_summary")}</h3>

              <div className="space-y-4 mb-8">
                <div className="flex justify-between items-start">
                  <div>
                    <p className={cn("text-[12px] font-bold", text)}>{t("agency_swich_checkout.plan_name")}</p>
                    <p className={cn("text-[10px] font-medium", sub)}>{t("agency_swich_checkout.one_time")}</p>
                  </div>
                  <span className={cn("text-[12px] font-bold", text)}>Rs. 1.00</span>
                </div>
              </div>

              <div className={cn("pt-6 border-t space-y-3", border)}>
                <div className="flex justify-between items-center">
                  <span className={cn("text-[12px] font-medium", sub)}>{t("agency_swich_checkout.subtotal")}</span>
                  <span className={cn("text-[12px] font-bold", text)}>Rs. 1.00</span>
                </div>
                <div className="flex justify-between items-center pt-4">
                  <span className={cn("text-[18px] font-black", text)}>{t("agency_swich_checkout.total")}</span>
                  <span className={cn("text-[20px] font-black", text)}>Rs. 1.00</span>
                </div>
              </div>

              {/* Swich requires the actual payer's mobile — we don't have it
                  on file, so it's collected here rather than faked. */}
              <div className="mt-6">
                <label className={cn("text-[11px] font-semibold mb-1.5 block", sub)}>{t("agency_swich_checkout.mobile_label")}</label>
                <input
                  className={cn(
                    "w-full h-11 rounded-xl text-[13px] font-bold transition-all px-4 border outline-none",
                    "focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500/50",
                    dark ? "bg-slate-950/50 border-slate-800 text-white" : "bg-white border-slate-200 text-slate-900"
                  )}
                  placeholder="03xxxxxxxxx"
                  value={msisdn}
                  onChange={(e) => setMsisdn(e.target.value)}
                />
                <p className={cn("text-[10px] font-medium mt-1.5 leading-relaxed", sub)}>
                  {t("agency_swich_checkout.mobile_help")}
                </p>
              </div>

              <div className={cn("mt-4 p-4 rounded-xl border flex items-start gap-3", dark ? "bg-slate-800/50 border-slate-700" : "bg-slate-50 border-slate-100")}>
                <div className="w-4 h-4 rounded-full bg-slate-400 flex items-center justify-center shrink-0 mt-0.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-white" />
                </div>
                <p className={cn("text-[10px] font-medium leading-relaxed", sub)}>
                  {t("agency_swich_checkout.redirect_note")}
                </p>
              </div>

              <button
                onClick={() => checkoutMutation.mutate()}
                disabled={checkoutMutation.isPending || !msisdn.trim()}
                className="w-full bg-teal-600 hover:bg-teal-700 disabled:opacity-60 text-white py-3.5 rounded-xl font-black text-[14px] mt-8 transition-all shadow-lg shadow-teal-600/20 active:scale-[0.98] flex items-center justify-center gap-2"
              >
                {checkoutMutation.isPending && <Loader2 size={16} className="animate-spin" />}
                {t("agency_swich_checkout.proceed_btn")}
              </button>

              <div className="mt-6 flex items-center justify-center gap-2">
                <ShieldCheck className="w-4 h-4 text-slate-400" />
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  {t("agency_swich_checkout.secure_checkout")}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AgencySwichCheckout;
