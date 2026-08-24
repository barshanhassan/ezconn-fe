import React, { useState } from 'react';
import {
  CreditCard,
  AlertTriangle,
  Star,
  X,
  Ticket,
  BarChart3,
  Check,
  Gift,
  Wallet,
  Zap,
  Building2,
  Lock,
  Download,
  FileText,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useTheme } from "@/contexts/ThemeContext";
import { formatInWorkspaceTz, useAgencyTimezone } from "@/contexts/WorkspaceTimezoneContext";
import { useTranslation } from 'react-i18next';
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { getUserInfo } from "@/lib/auth";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose } from "@/components/ui/dialog";
import PaymentsSection from "@/components/sections/connect/PaymentsSection";

import AgencyPremiumCheckout from './AgencyPremiumCheckout';
import AgencyIgniteCheckout from './AgencyIgniteCheckout';
import AgencyEnterpriseCheckout from './AgencyEnterpriseCheckout';
import AgencySwichCheckout from './AgencySwichCheckout';

// Default (no white-label logo uploaded) mark — same icon used on the auth pages/sidebars.
const BotMark = ({ className = "" }: { className?: string }) => (
  <svg viewBox="0 0 40 52" className={className}>
    <path fillRule="evenodd" clipRule="evenodd" d="M6 3 H34 A4 4 0 0 1 38 7 V17 A4 4 0 0 1 34 21 H6 A4 4 0 0 1 2 17 V7 A4 4 0 0 1 6 3 Z M11 12 a3.2 3.2 0 1 0 6.4 0 a3.2 3.2 0 1 0 -6.4 0 Z M22.6 12 a3.2 3.2 0 1 0 6.4 0 a3.2 3.2 0 1 0 -6.4 0 Z" fill="#25d366" />
    <rect x="4" y="25" width="32" height="5.5" rx="2" fill="#25d366" />
    <rect x="16.5" y="30" width="7" height="20" rx="2" fill="#25d366" />
  </svg>
);

const AgencyBillingPlans = () => {
  const { t } = useTranslation();
  const { mode } = useTheme();
  const dark = mode === "dark";
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const workspaceTz = useAgencyTimezone();

  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [showManageModal, setShowManageModal] = useState(false);
  const [showUsageModal, setShowUsageModal] = useState(false);
  const [checkoutType, setCheckoutType] = useState<null | 'premium' | 'ignite' | 'enterprise' | 'swich_test'>(null);
  const [cancelCodeInput, setCancelCodeInput] = useState("");
  const [checks, setChecks] = useState({ c1: false, c2: false, c3: false });
  const [couponCode, setCouponCode] = useState("");
  const [couponError, setCouponError] = useState(false);

  const generatedCode = "44399";

  // Section 13 — asks Swich directly for this transaction's real status.
  // Not proof by itself either, but it's Swich's own server answering (not
  // the redirect), so it's the trustworthy check — same data the callback
  // would have delivered, just pulled instead of pushed.
  const autoInquireMutation = useMutation({
    mutationFn: async (customerTransactionId: string) => {
      const res = await apiRequest("GET", `/api/swich/agency/inquire/${customerTransactionId}`);
      return res.json();
    },
    onSuccess: (result) => {
      const status = result?.data?.transaction?.transactionStatus || result?.data?.status;
      if (status === 'success') {
        toast({ title: "Payment confirmed", description: "Swich confirmed your Rs. 1 test payment succeeded." });
      } else if (status === 'failed') {
        toast({ title: "Payment failed", description: "Swich reports this payment did not succeed.", variant: "destructive" });
      } else {
        toast({ title: "Still processing", description: `Swich status: ${status || 'pending'}. Try again shortly.` });
      }
    },
    onError: () => {
      toast({ title: "Could not confirm yet", description: "We'll pick this up once Swich's callback arrives.", variant: "destructive" });
    },
  });

  // Landed back here via Swich's successRedirectUrl (Section 17 — Swich only
  // ever redirects here on a SUCCESSFUL transaction; a failed/rejected
  // payment goes to whatever page is configured on Swich's own merchant
  // dashboard instead, which this app can't override). The swich_status=failed
  // case below is kept as defensive handling in case that ever changes, or
  // someone lands here manually — either way, the redirect itself proves
  // nothing (anyone could hit this URL with any status), so we immediately
  // ask Swich directly (Inquire) for the real status rather than trusting
  // the query param.
  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const customerTransactionId = params.get('customerTransactionId');
    const swichStatus = params.get('swich_status');
    if ((swichStatus === 'success' || swichStatus === 'failed') && customerTransactionId) {
      autoInquireMutation.mutate(customerTransactionId);
      params.delete('swich_status');
      params.delete('customerTransactionId');
      const rest = params.toString();
      window.history.replaceState({}, '', window.location.pathname + (rest ? `?${rest}` : ''));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const bg     = dark ? 'bg-[#0b1120]'  : 'bg-slate-50/80';
  const card   = dark ? 'bg-[#0f1829]'  : 'bg-white';
  const border = dark ? 'border-slate-800' : 'border-slate-200';
  const text   = dark ? 'text-white'    : 'text-slate-900';
  const sub    = dark ? 'text-slate-500' : 'text-slate-400';

  const agencyId = (() => { try { return getUserInfo()?.modelable_id; } catch { return null; } })();

  // Agency logo — used on the Manage-billing modal header (same white-label
  // pattern as everywhere else in the app).
  const { data: agencyResp } = useQuery<any>({
    queryKey: [`/api/organizations/${agencyId}`],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/organizations/${agencyId}`);
      return res.json();
    },
    enabled: !!agencyId,
  });
  const b = agencyResp?.agency?.branding;
  const agencyLogoUrl: string | null = dark
    ? b?.logo_dark_small || b?.logo_light_small || b?.logo_dark || b?.logo_light || null
    : b?.logo_light_small || b?.logo_dark_small || b?.logo_light || b?.logo_dark || null;

  const { data: invoicesResp, isLoading: invoicesLoading } = useQuery<any>({
    queryKey: [`/api/organizations/${agencyId}/invoices`],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/organizations/${agencyId}/invoices`);
      return res.json();
    },
    enabled: !!agencyId,
  });
  const invoices = invoicesResp?.invoices || [];
  const [downloadingInvoiceId, setDownloadingInvoiceId] = useState<string | null>(null);
  const handleDownloadInvoice = async (invoiceId: string) => {
    setDownloadingInvoiceId(invoiceId);
    try {
      const res = await apiRequest("GET", `/api/organizations/${agencyId}/invoices/${invoiceId}/download`);
      const data = await res.json();
      if (data?.url) {
        window.open(data.url, "_blank", "noopener,noreferrer");
      } else {
        toast({ title: "PDF not available", description: "This invoice's PDF couldn't be found.", variant: "destructive" });
      }
    } catch (e: any) {
      toast({ title: "Download failed", description: e?.message || "Please try again.", variant: "destructive" });
    } finally {
      setDownloadingInvoiceId(null);
    }
  };

  // Real usage vs. plan allowance — Workspaces is the only agency-wide
  // resource, so it's the only one with a real dollar overage (see
  // agency.service.ts getCurrentUsage). The rest are per-workspace caps,
  // shown as counts only rather than a misleading aggregate charge.
  const { data: usage } = useQuery<any>({
    queryKey: [`/api/organizations/${agencyId}/current-usage`],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/organizations/${agencyId}/current-usage`);
      return res.json();
    },
    enabled: !!agencyId && showUsageModal,
  });
  const centsToStr = (c: number | null | undefined) => c == null ? "—" : (c / 100).toFixed(2);

  // Real coupons — billing_coupons, applied against the agency's active
  // subscription (billing_subscriptions.coupons). No more local-only state:
  // the applied list here is exactly what getCurrentUsage() discounts by.
  const { data: appliedCoupons } = useQuery<any[]>({
    queryKey: [`/api/organizations/${agencyId}/coupons`],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/organizations/${agencyId}/coupons`);
      return res.json();
    },
    enabled: !!agencyId,
  });
  // Real cancel — status → 'cancelled' on billing_subscriptions
  // (agency.service.ts cancelSubscription). getCurrentPlan() only looks at
  // active/in_trial rows, so the agency shows back on Free automatically.
  const cancelSubscriptionMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/organizations/${agencyId}/cancel-subscription`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/organizations/${agencyId}/current-plan`] });
      queryClient.invalidateQueries({ queryKey: [`/api/organizations/${agencyId}/coupons`] });
      setIsCancelModalOpen(false);
      setChecks({ c1: false, c2: false, c3: false });
      setCancelCodeInput("");
      toast({ title: "Subscription cancelled", description: "You're back on the Free plan." });
    },
    onError: (err: any) => {
      toast({ title: "Could not cancel", description: err?.message || "Something went wrong.", variant: "destructive" });
    },
  });

  const invalidateCoupons = () => {
    queryClient.invalidateQueries({ queryKey: [`/api/organizations/${agencyId}/coupons`] });
    queryClient.invalidateQueries({ queryKey: [`/api/organizations/${agencyId}/current-usage`] });
  };
  const applyCouponMutation = useMutation({
    mutationFn: async (code: string) => {
      const res = await apiRequest("POST", `/api/organizations/${agencyId}/coupons`, { code });
      return res.json();
    },
    onSuccess: (_data, code) => {
      invalidateCoupons();
      toast({ title: t("agency.billing.coupons.applied"), description: t("agency.billing.coupons.appliedDesc", { code: code.toUpperCase() }) });
    },
    onError: (err: any) => {
      toast({ title: "Could not apply coupon", description: err?.message || "That code is invalid or already applied.", variant: "destructive" });
    },
  });
  const removeCouponMutation = useMutation({
    mutationFn: async (code: string) => {
      const res = await apiRequest("DELETE", `/api/organizations/${agencyId}/coupons/${encodeURIComponent(code)}`);
      return res.json();
    },
    onSuccess: (_data, code) => {
      invalidateCoupons();
      toast({ title: t("agency.billing.coupons.removed"), description: t("agency.billing.coupons.removedDesc", { code }) });
    },
  });
  const applyCoupon = () => {
    if (!couponCode.trim()) { setCouponError(true); return; }
    setCouponError(false);
    applyCouponMutation.mutate(couponCode.trim().toUpperCase());
    setCouponCode("");
  };
  const removeCoupon = (code: string) => removeCouponMutation.mutate(code);

  // Real plan catalog — same billing_plans rows the checkout pages and the
  // backend's limit checks read from (see agency.service.ts).
  const { data: realPlans } = useQuery<any[]>({
    queryKey: ["/api/organizations/billing-plans"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/organizations/billing-plans");
      return res.json();
    },
  });
  // The agency's actual active subscription — falls back to "free-plan" when
  // there isn't one yet (new agencies start on Free, not on whatever plan
  // happened to be hardcoded here before).
  const { data: currentPlanResp } = useQuery<any>({
    queryKey: [`/api/organizations/${agencyId}/current-plan`],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/organizations/${agencyId}/current-plan`);
      return res.json();
    },
    enabled: !!agencyId,
  });
  const currentItemId: string = currentPlanResp?.plan?.item_id || "free-plan";
  const activatedAt: string | null = currentPlanResp?.subscription?.activated_at || null;

  // Icon + short tagline per plan — cosmetic-only labels (not billing_plans
  // data), same idea as the reference pricing page's one-line taglines.
  const PLAN_DISPLAY: Record<string, { icon: React.ReactNode; iconBg: string; tagline: string }> = {
    "free-plan": { icon: <Gift className="w-5 h-5 text-amber-500" />, iconBg: dark ? 'bg-amber-500/10' : 'bg-amber-50', tagline: 'Try it out, on us' },
    "premium-plan": { icon: <Wallet className="w-5 h-5 text-emerald-500" />, iconBg: dark ? 'bg-emerald-500/10' : 'bg-emerald-50', tagline: 'For growing businesses' },
    "ignite-plan": { icon: <Zap className="w-5 h-5 text-primary" />, iconBg: dark ? 'bg-primary/10' : 'bg-primary/5', tagline: 'For scaling teams' },
    "enterprise-plan": { icon: <Building2 className="w-5 h-5 text-indigo-500" />, iconBg: dark ? 'bg-indigo-500/10' : 'bg-indigo-50', tagline: 'Built for resellers' },
  };

  const currentPlanOrder = realPlans?.find((p) => p.item_id === currentItemId)?.plan_order ?? 0;

  const plans = (realPlans || []).map((p) => ({
    id: p.item_id,
    name: p.external_name,
    price: p.price_cents == null ? "—" : `$${(p.price_cents / 100).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`,
    priceCents: p.price_cents,
    // One concise line — the old version also showed `description`, which
    // duplicated this almost word-for-word.
    limit: `${p.maximum_workspaces} workspace${p.maximum_workspaces === 1 ? '' : 's'} · ${p.maximum_contacts.toLocaleString()} contacts each`,
    isCurrent: p.item_id === currentItemId,
    // No downgrades — matches the real backend rule (swich.service.ts
    // activatePlanFromTransaction), not just the warning banner's copy.
    isDowngrade: p.plan_order < currentPlanOrder,
    activatedAt,
    ...(PLAN_DISPLAY[p.item_id] || { icon: <CreditCard className="w-5 h-5" />, iconBg: dark ? 'bg-slate-800' : 'bg-slate-100', tagline: '' }),
  }));

  if (checkoutType === 'premium') {
    return <AgencyPremiumCheckout onBack={() => setCheckoutType(null)} />;
  }

  if (checkoutType === 'ignite') {
    return <AgencyIgniteCheckout onBack={() => setCheckoutType(null)} />;
  }

  if (checkoutType === 'enterprise') {
    return <AgencyEnterpriseCheckout onBack={() => setCheckoutType(null)} />;
  }

  if (checkoutType === 'swich_test') {
    return <AgencySwichCheckout onBack={() => setCheckoutType(null)} />;
  }

  return (
    <div className={cn("min-h-full transition-colors flex flex-col font-sans", bg)}>

      {/* ── Header Card ── */}
      <div className={cn('px-8 py-5 border-b flex items-center justify-between', card, border)}>
        <div className="flex items-center gap-4">
          <div className={cn('p-2.5 rounded-xl shadow-sm', dark ? 'bg-primary/15' : 'bg-primary/10')}>
            <CreditCard className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className={cn('text-[15px] font-bold', text)}>Billing & Subscription</h1>
            <p className={cn('text-[11px] mt-0.5', sub)}>Choose a plan and manage your billing, all in one place.</p>
          </div>
        </div>
        {currentPlanResp?.plan?.external_name && (
          <div className={cn("flex items-center gap-2 px-3 py-1.5 rounded-xl border", dark ? "bg-primary/10 border-primary/20" : "bg-primary/5 border-primary/10")}>
            <Star className="w-3.5 h-3.5 text-primary" fill="currentColor" />
            <div>
              <p className="text-[9px] font-black uppercase tracking-widest text-primary">Current Plan</p>
              <p className={cn("text-[12px] font-bold", text)}>
                {currentPlanResp.plan.external_name}
                {(() => {
                  const cents = realPlans?.find((p) => p.item_id === currentItemId)?.price_cents;
                  return cents != null ? ` $${(cents / 100).toFixed(0)}/mo` : '';
                })()}
              </p>
            </div>
          </div>
        )}
      </div>

      <div className="flex-1 p-8 space-y-6">

        {/* Plans Grid */}
        <div className={cn("rounded-2xl border overflow-hidden shadow-sm", card, border)}>
          <div className="p-6">
            {!realPlans ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className={cn("rounded-xl p-6 border-2 animate-pulse", border)}>
                    <div className={cn("w-10 h-10 rounded-lg mb-4", dark ? "bg-slate-800" : "bg-slate-100")} />
                    <div className={cn("h-3 w-2/3 rounded mb-3", dark ? "bg-slate-800" : "bg-slate-100")} />
                    <div className={cn("h-6 w-1/2 rounded mb-4", dark ? "bg-slate-800" : "bg-slate-100")} />
                    <div className={cn("h-3 w-full rounded", dark ? "bg-slate-800" : "bg-slate-100")} />
                  </div>
                ))}
              </div>
            ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {plans.map((plan, i) => {
                return (
                  <div key={i} className={cn(
                    "relative rounded-xl p-6 flex flex-col border-2 transition-all duration-200",
                    plan.isCurrent ? "border-primary shadow-md" : (dark ? "border-slate-800" : "border-slate-200")
                  )}>
                    {plan.isCurrent && (
                      <span className="absolute top-4 right-4 flex items-center gap-1 px-2.5 py-1 rounded-full bg-primary text-white text-[9px] font-black uppercase tracking-wide">
                        <Check className="w-3 h-3" /> Current
                      </span>
                    )}

                    {/* Icon + Name */}
                    <div className={cn("w-11 h-11 rounded-xl flex items-center justify-center mb-4", plan.iconBg)}>
                      {plan.icon}
                    </div>
                    <h3 className={cn("text-[15px] font-bold", text)}>{plan.name}</h3>
                    {plan.tagline && <p className={cn("text-[11px] font-medium mt-0.5", sub)}>{plan.tagline}</p>}

                    {/* Price */}
                    <div className="mt-4 mb-1">
                      <div className="flex items-end gap-1">
                        <span className={cn("text-[32px] font-black tracking-tight leading-none", text)}>{plan.price}</span>
                        <span className={cn("text-[14px] font-bold mb-1", sub)}>/{t("common.month")}</span>
                      </div>
                    </div>

                    {/* Real included quota — one line, no repeated description */}
                    <p className={cn("text-[11px] font-medium mb-6", sub)}>{plan.limit}</p>

                    {/* Actions */}
                    <div className="mt-auto space-y-3">
                      {plan.isCurrent ? (
                        <div className="flex flex-col items-center gap-3">
                          <div className="w-full bg-primary text-white py-2 rounded-lg font-bold text-[12px] text-center shadow-sm flex items-center justify-center gap-1.5">
                            <Check className="w-3.5 h-3.5" /> {t("agency.billing.plans.current_plan")}
                          </div>
                          <div className="text-center space-y-1">
                            {plan.activatedAt && (
                              <p className={cn("text-[10px] font-bold", text)}>
                                Active since {formatInWorkspaceTz(plan.activatedAt, "M/d/yyyy", workspaceTz)}
                              </p>
                            )}
                            {/* Nothing to cancel on Free — no subscription is
                                paying for it, so there's nothing to stop. */}
                            {plan.id !== 'free-plan' && (
                              <button
                                onClick={() => setIsCancelModalOpen(true)}
                                className="text-[11px] font-semibold text-rose-500 hover:text-rose-600 transition-all">
                                {t("agency.billing.plans.cancel_subscription")}
                              </button>
                            )}
                          </div>
                        </div>
                      ) : plan.isDowngrade ? (
                        <button
                          disabled
                          title="Plans don't support downgrades"
                          className={cn(
                            "w-full py-2 rounded-lg font-bold text-[12px] border text-center flex items-center justify-center gap-1.5 cursor-not-allowed",
                            dark ? "border-slate-800 text-slate-600" : "border-slate-200 text-slate-400"
                          )}>
                          <Lock className="w-3 h-3" /> Downgrade unavailable
                        </button>
                      ) : plan.priceCents !== 0 ? (
                        <button
                          onClick={() => {
                            if (plan.id === 'premium-plan') setCheckoutType('premium');
                            if (plan.id === 'ignite-plan') setCheckoutType('ignite');
                            if (plan.id === 'enterprise-plan') setCheckoutType('enterprise');
                            if (plan.id === 'swich_test') setCheckoutType('swich_test');
                          }}
                          className={cn(
                          "w-full py-2 rounded-lg font-bold text-[12px] border transition-all text-center",
                          dark ? "border-slate-700 text-slate-300 hover:bg-primary hover:text-white hover:border-primary"
                               : "border-slate-300/60 text-slate-600 hover:bg-primary hover:text-white hover:border-primary"
                        )}>
                          {t("common.upgrade")}
                        </button>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
            )}
          </div>
        </div>

        {/* Warning Alert Card */}
        <div className={cn("rounded-xl border border-yellow-200 dark:border-yellow-900/50 overflow-hidden", dark ? "bg-yellow-900/10" : "bg-yellow-50/30")}>
          <div className="px-4 py-3 flex gap-3 items-center">
            <div className={cn("p-1.5 rounded-lg shrink-0", dark ? "bg-yellow-900/20" : "bg-yellow-100/50")}>
              <AlertTriangle className="w-3.5 h-3.5 text-yellow-600" strokeWidth={2.5} />
            </div>
            <p className="text-[11px] font-medium leading-snug text-yellow-700/90">
              <span className="font-black uppercase tracking-wide">{t("agency.billing.plans.heads_up")}:</span>{' '}
              {t("agency.billing.plans.downgrade_warning_desc")}
            </p>
          </div>
        </div>

        {/* Manage billing */}
        <div className={cn("rounded-2xl border overflow-hidden shadow-sm", card, border)}>
          <div className={cn("px-6 py-5 border-b", border)}>
            <h2 className={cn("text-[13px] font-black uppercase tracking-widest", text)}>Manage billing</h2>
            <p className={cn("text-[11px] font-medium mt-0.5", sub)}>Coupons, payment details, and usage</p>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">

              {/* ── Coupons & Discounts Box ── */}
              <div className={cn("flex flex-col p-5 rounded-xl border transition-all", border,
                dark ? "bg-slate-900/30" : "bg-slate-50/60")}>
                <div className="flex items-center gap-3 mb-5">
                  <div className={cn("p-2 rounded-lg", dark ? "bg-slate-800" : "bg-white border border-slate-200 shadow-sm")}>
                    <Ticket className="w-4 h-4 text-primary" strokeWidth={1.8} />
                  </div>
                  <div>
                    <h3 className={cn("font-black text-[13px] uppercase tracking-widest", text)}>
                      {t("agency.billing.coupons.title")}
                    </h3>
                    <p className={cn("text-[11px] font-medium mt-0.5", sub)}>
                      {t("agency.billing.coupons.addDesc")}
                    </p>
                  </div>
                </div>

                <div className="flex-1 flex flex-col justify-between gap-5">
                  <div>
                    <p className={cn("text-[11px] font-bold uppercase tracking-widest mb-2", sub)}>
                      {t("agency.billing.coupons.appliedList")}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {(appliedCoupons ?? []).map(coupon => (
                        <Badge
                          key={coupon.coupon_id}
                          className="px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider bg-primary text-white border-none flex items-center gap-1 shadow-sm shadow-primary/20"
                        >
                          {coupon.coupon_id}
                          <X size={11} className="cursor-pointer opacity-70 hover:opacity-100 transition-opacity" onClick={() => removeCoupon(coupon.coupon_id)} />
                        </Badge>
                      ))}
                      {(appliedCoupons ?? []).length === 0 && (
                        <p className={cn("text-[11px] font-medium", sub)}>No coupons applied</p>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <p className={cn("text-[11px] font-bold uppercase tracking-widest", sub)}>
                      {t("agency.billing.coupons.add")}
                    </p>
                    <div className="flex gap-2">
                      <Input
                        placeholder={t("agency.billing.coupons.placeholder")}
                        value={couponCode}
                        onChange={(e) => { setCouponCode(e.target.value); if (e.target.value.trim()) setCouponError(false); }}
                        className={cn("text-[12px] h-9 rounded-lg transition-all shadow-none",
                          dark ? "bg-slate-950/50 border-slate-800 text-white focus-visible:ring-primary/30"
                               : "bg-white border-slate-200 text-slate-900 focus-visible:ring-primary/20",
                          couponError && "border-rose-500")}
                      />
                      <button
                        onClick={applyCoupon}
                        className="px-4 py-1.5 rounded-lg text-[12px] font-bold bg-primary text-white hover:bg-primary/90 transition-all shadow-sm shadow-primary/20">
                        {t("common.add")}
                      </button>
                    </div>
                    {couponError && (
                      <p className="text-[11px] text-rose-500 font-bold">{t("agency.billing.coupons.error")}</p>
                    )}
                  </div>
                </div>
              </div>

              {/* ── Billing & Payment Box ── */}
              <div className={cn("flex flex-col p-5 rounded-xl border transition-all", border,
                dark ? "bg-slate-900/30" : "bg-slate-50/60")}>
                <div className="flex items-center gap-3 mb-5">
                  <div className={cn("p-2 rounded-lg", dark ? "bg-slate-800" : "bg-white border border-slate-200 shadow-sm")}>
                    <CreditCard className="w-4 h-4 text-primary" strokeWidth={1.8} />
                  </div>
                  <div>
                    <h3 className={cn("font-black text-[13px] uppercase tracking-widest", text)}>
                      {t("agency.billing.manage.title")}
                    </h3>
                    <p className={cn("text-[11px] font-medium mt-0.5", sub)}>
                      {t("agency.billing.manage.desc")}
                    </p>
                  </div>
                </div>
                <div className="flex justify-end mt-auto">
                  <button
                    onClick={() => setShowManageModal(true)}
                    className="px-5 py-2 rounded-lg text-[12px] font-bold bg-primary text-white hover:bg-primary/90 transition-all shadow-sm shadow-primary/20">
                    {t("common.manage")}
                  </button>
                </div>
              </div>

              {/* ── Current Usage Box ── */}
              <div className={cn("flex flex-col p-5 rounded-xl border transition-all", border,
                dark ? "bg-slate-900/30" : "bg-slate-50/60")}>
                <div className="flex items-center gap-3 mb-5">
                  <div className={cn("p-2 rounded-lg", dark ? "bg-slate-800" : "bg-white border border-slate-200 shadow-sm")}>
                    <BarChart3 className="w-4 h-4 text-primary" strokeWidth={1.8} />
                  </div>
                  <div>
                    <h3 className={cn("font-black text-[13px] uppercase tracking-widest", text)}>
                      {t("agency.billing.usage.title")}
                    </h3>
                    <p className={cn("text-[11px] font-medium mt-0.5", sub)}>
                      {t("agency.billing.usage.desc")}
                    </p>
                  </div>
                </div>
                <div className="flex justify-end mt-auto">
                  <button
                    onClick={() => setShowUsageModal(true)}
                    className="px-5 py-2 rounded-lg text-[12px] font-bold bg-primary text-white hover:bg-primary/90 transition-all shadow-sm shadow-primary/20">
                    {t("agency.billing.usage.show")}
                  </button>
                </div>
              </div>

            </div>
          </div>
        </div>
      </div>

      {/* ── Invoice History ── */}
      <div className="px-8 pb-8">
        <div className={cn("rounded-2xl border overflow-hidden shadow-sm", card, border)}>
          <div className={cn("px-6 py-4 border-b flex items-center gap-3", border)}>
            <div className={cn("p-2 rounded-lg", dark ? "bg-slate-800" : "bg-white border border-slate-200 shadow-sm")}>
              <FileText className="w-4 h-4 text-primary" strokeWidth={1.8} />
            </div>
            <div>
              <h3 className={cn("font-black text-[13px] uppercase tracking-widest", text)}>Invoice History</h3>
              <p className={cn("text-[11px] font-medium mt-0.5", sub)}>Receipts for every plan payment, generated automatically</p>
            </div>
          </div>

          {invoicesLoading ? (
            <div className="flex items-center justify-center py-10">
              <div className="w-5 h-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
            </div>
          ) : invoices.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 gap-2">
              <FileText className="w-6 h-6 text-slate-300" />
              <p className={cn("text-[12px] font-medium", sub)}>No invoices yet — one will appear here after your next payment.</p>
            </div>
          ) : (
            <div className={cn("divide-y", dark ? "divide-slate-800" : "divide-slate-100")}>
              {invoices.map((inv: any) => (
                <div key={inv.id} className={cn("px-6 py-3.5 flex items-center justify-between transition-colors",
                  dark ? "hover:bg-slate-800/30" : "hover:bg-slate-50")}>
                  <div className="min-w-0">
                    <p className={cn("text-[13px] font-bold truncate", text)}>{inv.invoice_number}</p>
                    <p className={cn("text-[11px] font-medium mt-0.5", sub)}>
                      {inv.plan_name} &middot; {formatInWorkspaceTz(inv.issued_at, "MMM d, yyyy", workspaceTz)}
                    </p>
                  </div>
                  <div className="flex items-center gap-5 shrink-0">
                    <p className={cn("text-[13px] font-bold", text)}>{inv.currency} {Number(inv.amount).toFixed(2)}</p>
                    <button
                      onClick={() => handleDownloadInvoice(inv.id)}
                      disabled={downloadingInvoiceId === inv.id}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold border border-primary/30 text-primary hover:bg-primary hover:text-white transition-all disabled:opacity-50">
                      <Download size={12} /> {downloadingInvoiceId === inv.id ? "..." : "Download"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Current Usage Modal ── */}
      <Dialog open={showUsageModal} onOpenChange={setShowUsageModal}>
        <DialogContent hideClose className={cn("max-w-2xl p-0 rounded-2xl shadow-2xl border overflow-hidden", card, border)}>
          <DialogHeader className={cn("px-6 py-4 border-b", border)}>
            <DialogTitle className={cn("text-[14px] font-black uppercase tracking-widest", text)}>
              {t("agency.billing.usage.title")}
            </DialogTitle>
          </DialogHeader>

          {!usage ? (
            <div className="flex items-center justify-center h-32 text-slate-400 text-[13px]">Loading…</div>
          ) : (
            <>
              <div className={cn("divide-y", dark ? "divide-slate-800" : "divide-slate-100")}>
                {/* Workspaces — the one agency-wide resource, so it's the only
                    row with a real dollar overage (see agency.service.ts). */}
                <div className={cn("px-6 py-3.5 flex items-center justify-between transition-colors",
                  dark ? "hover:bg-slate-800/30" : "hover:bg-slate-50")}>
                  <div className="flex items-center gap-3">
                    <div className="w-1.5 h-1.5 rounded-full bg-primary opacity-60 shrink-0" />
                    <p className={cn("text-[13px] font-semibold", text)}>Workspaces</p>
                  </div>
                  <div className="flex items-center gap-16">
                    <div className="text-center w-24">
                      <p className={cn("text-[13px] font-bold", text)}>{usage.workspaces.used} / {usage.workspaces.included}</p>
                      <p className={cn("text-[9px] uppercase tracking-widest font-bold", sub)}>used / included</p>
                    </div>
                    <div className="text-right w-20">
                      <p className={cn("text-[13px] font-bold", text)}>${centsToStr(usage.workspaces.overage_cents)}</p>
                      <p className={cn("text-[9px] uppercase tracking-widest font-bold", sub)}>overage</p>
                    </div>
                  </div>
                </div>

                {/* Contacts / Agents / AI Assistants / Channels — capped per
                    workspace, not agency-wide, so counts only (no dollar
                    figure — an aggregate charge would misstate how the limit
                    actually applies). */}
                {[
                  { label: "Contacts", data: usage.contacts },
                  { label: "Human Agents", data: usage.agents },
                  { label: "AI Assistants", data: usage.ai_assistants },
                  { label: "Channels", data: usage.channels },
                ].map(({ label, data }) => (
                  <div key={label} className={cn("px-6 py-3.5 flex items-center justify-between transition-colors",
                    dark ? "hover:bg-slate-800/30" : "hover:bg-slate-50")}>
                    <div className="flex items-center gap-3">
                      <div className="w-1.5 h-1.5 rounded-full bg-primary opacity-60 shrink-0" />
                      <p className={cn("text-[13px] font-semibold", text)}>{label}</p>
                    </div>
                    <div className="text-right">
                      <p className={cn("text-[13px] font-bold", text)}>{data.used.toLocaleString()}</p>
                      <p className={cn("text-[9px] uppercase tracking-widest font-bold", sub)}>
                        {data.included_per_workspace != null ? `of ${data.included_per_workspace.toLocaleString()} per workspace` : 'total'}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Totals Footer */}
              <div className={cn("px-6 py-5 border-t space-y-3", border, dark ? "bg-slate-900/30" : "bg-slate-50/60")}>
                <div className="flex justify-between items-center">
                  <span className={cn("text-[12px] font-bold", sub)}>Plan ({usage.plan?.name || '—'})</span>
                  <p className={cn("text-[13px] font-bold", text)}>${centsToStr(usage.plan?.price_cents)}</p>
                </div>
                <div className="flex justify-between items-center">
                  <span className={cn("text-[12px] font-bold", sub)}>Extra workspaces ({usage.workspaces.extra})</span>
                  <p className={cn("text-[13px] font-bold", text)}>${centsToStr(usage.workspaces.overage_cents)}</p>
                </div>
                {(usage.coupons ?? []).map((c: any) => (
                  <div key={c.code} className="flex justify-between items-center text-primary">
                    <span className="text-[12px] font-bold">{c.name} coupon applied</span>
                    <p className="text-[13px] font-bold">-${centsToStr(c.discount_cents)}</p>
                  </div>
                ))}
                <div className={cn("flex justify-between items-center pt-3 border-t", border)}>
                  <span className={cn("text-[14px] font-black", text)}>Total</span>
                  <p className={cn("text-[15px] font-black", text)}>${centsToStr(usage.total_cents ?? usage.subtotal_cents)}<span className="text-[10px] font-medium opacity-60"> /mo</span></p>
                </div>
                <div className="flex justify-end pt-2">
                  <DialogClose asChild>
                    <button className={cn("px-5 py-2 rounded-lg text-[12px] font-bold transition-all border",
                      dark ? "border-slate-700 text-slate-300 hover:bg-slate-800" : "border-slate-200 text-slate-600 hover:bg-slate-100")}>
                      {t("common.close")}
                    </button>
                  </DialogClose>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Manage Billing Modal — real Swich credentials + transactions */}
      <Dialog open={showManageModal} onOpenChange={setShowManageModal}>
        <DialogContent hideClose className={cn("max-w-4xl p-0 overflow-visible border shadow-2xl rounded-2xl", card, border)}>
          <div className="relative">
            <DialogClose className="absolute -right-3 -top-3 z-50">
              <div className={cn("w-7 h-7 rounded-full flex items-center justify-center border-2 shadow-md transition-colors",
                dark ? "bg-slate-700 hover:bg-slate-600 border-slate-900 text-white" : "bg-slate-600 hover:bg-slate-700 border-white text-white")}>
                <X size={13} strokeWidth={3} />
              </div>
            </DialogClose>

            <div className={cn("px-8 py-6 border-b text-center", border)}>
              <div className="flex flex-col items-center gap-1.5 mb-4">
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
                <span className={cn("text-[9px] font-black uppercase tracking-[0.2em]", sub)}>
                  AGEN<span className="text-[#25d366]">TAWK</span>
                </span>
              </div>
              <h2 className={cn("text-[16px] font-black text-primary")}>Billing & payment</h2>
            </div>

            <div className="px-8 py-7 max-h-[75vh] overflow-y-auto">
              <PaymentsSection basePath="/api/swich/agency" />
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Cancel Subscription Modal */}
      {isCancelModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm">
          <div className={cn(
            "w-full max-w-[580px] rounded-2xl shadow-2xl border overflow-hidden",
            card, border
          )}>
            {/* Modal Header */}
            <div className={cn("px-8 py-6 border-b flex items-center gap-4", border)}>
              <div className={cn("p-2.5 rounded-xl", dark ? "bg-rose-900/20" : "bg-rose-50")}>
                <AlertTriangle className="w-5 h-5 text-rose-500" strokeWidth={2} />
              </div>
              <h2 className={cn("text-[15px] font-black uppercase tracking-wide", text)}>
                {t("agency.billing.plans.cancel_modal.title")}
              </h2>
            </div>

            <div className="px-8 py-6 space-y-5">
              <p className={cn("font-bold text-[13px]", text)}>{t("agency.billing.plans.cancel_modal.understand")}</p>
              
              <div className="space-y-4">
                {([
                  { key: 'c1', label: t("agency.billing.plans.cancel_modal.check1") },
                  { key: 'c2', label: t("agency.billing.plans.cancel_modal.check2") },
                  { key: 'c3', label: t("agency.billing.plans.cancel_modal.check3") },
                ] as const).map(({ key, label }) => (
                  <label key={key} className="flex items-start gap-3 cursor-pointer group">
                    <input 
                      type="checkbox"
                      className="mt-1 w-4 h-4 rounded border-slate-300 text-rose-500 focus:ring-rose-400"
                      checked={checks[key]}
                      onChange={(e) => setChecks({ ...checks, [key]: e.target.checked })}
                    />
                    <span className={cn("text-[13px] font-medium leading-snug group-hover:text-rose-500 transition-colors", sub)}>{label}</span>
                  </label>
                ))}
              </div>

              <div className={cn("p-4 rounded-xl border text-[12px] font-medium", 
                dark ? "bg-slate-950 border-slate-800" : "bg-slate-50 border-slate-100", sub)}>
                {t("agency.billing.plans.cancel_modal.renew_warning", { date: "2026-06-11" })}
              </div>

              <div>
                <p className={cn("font-bold text-[13px] mb-3", text)}>
                  {t("agency.billing.plans.cancel_modal.enter_code", { code: generatedCode })}
                </p>
                <div className="flex gap-3">
                  <input 
                    type="text" 
                    placeholder={t("agency.billing.plans.cancel_modal.code_placeholder")}
                    value={cancelCodeInput}
                    onChange={(e) => setCancelCodeInput(e.target.value)}
                    className={cn(
                      "flex-1 px-4 py-2.5 rounded-xl border text-[13px] font-mono outline-none transition-colors",
                      dark ? "bg-slate-950/50 border-slate-800 text-white placeholder-slate-600 focus:border-primary/50" 
                           : "bg-white border-slate-200 text-slate-900 placeholder-slate-400 focus:border-primary/30"
                    )}
                  />
                  <button 
                    onClick={() => setIsCancelModalOpen(false)}
                    className={cn("px-5 py-2.5 rounded-xl border font-bold text-[13px] transition-colors",
                      dark ? "border-slate-700 text-slate-300 hover:bg-slate-800" : "border-slate-200 text-slate-600 hover:bg-slate-50"
                    )}>
                    {t("common.cancel")}
                  </button>
                  <button
                    onClick={() => cancelSubscriptionMutation.mutate()}
                    disabled={!checks.c1 || !checks.c2 || !checks.c3 || cancelCodeInput !== generatedCode || cancelSubscriptionMutation.isPending}
                    className="px-5 py-2.5 rounded-xl bg-rose-500 hover:bg-rose-600 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-[13px] transition-all shadow-lg shadow-rose-500/20">
                    {cancelSubscriptionMutation.isPending ? "Cancelling…" : t("common.delete")}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AgencyBillingPlans;
