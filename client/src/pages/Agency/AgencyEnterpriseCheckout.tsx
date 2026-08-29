import React from 'react';
import {
  ArrowLeft,
  ShieldCheck,
  Crown,
  Sparkles,
  Building2,
  Users,
  MessageSquare,
  Bot,
  Loader2
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useTheme } from "@/contexts/ThemeContext";
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { getUserInfo } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";

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

const formatUsd = (cents: number | null | undefined) =>
  cents == null ? "—" : `$${(cents / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;

const AgencyEnterpriseCheckout: React.FC<CheckoutProps> = ({ onBack }) => {
  const { t } = useTranslation();
  const { mode } = useTheme();
  const dark = mode === "dark";
  const { toast } = useToast();

  // White-label aware header: agency logo replaces the default BotMark + "AGENTAWK" when uploaded.
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
  const agencyName: string = agencyResp?.agency?.name || "Agency Owner";

  // Real plan data — same billing_plans row the backend enforces limits
  // against, so this page can never drift from what actually happens after
  // checkout (see agentawk-core/src/agency/agency.service.ts).
  const { data: plans } = useQuery<any[]>({
    queryKey: ["/api/organizations/billing-plans"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/organizations/billing-plans");
      return res.json();
    },
  });
  const plan = plans?.find((p) => p.item_id === "enterprise-plan");

  // Swich requires the payer's mobile number — not on file, so collected here
  // the same way the Test Plan checkout does.
  const [msisdn, setMsisdn] = React.useState("");

  // Coupon — read-only sync from Billing → Manage (billing_subscriptions.coupons).
  // No apply/remove here; that's Manage's job. Doesn't touch what Swich
  // actually charges (still the Rs. 1 test amount below) — just the displayed rate.
  const [appliedCoupons, setAppliedCoupons] = React.useState<Array<{ code: string; name: string; discount_percentage: number | null }>>([]);
  const { data: accountCoupons } = useQuery<any[]>({
    queryKey: [`/api/organizations/${agencyId}/coupons`],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/organizations/${agencyId}/coupons`);
      return res.json();
    },
    enabled: !!agencyId,
  });
  React.useEffect(() => {
    setAppliedCoupons(
      (accountCoupons ?? []).map((c) => ({
        code: c.coupon_id,
        name: c.invoice_name || c.coupon_id,
        discount_percentage: c.discount_percentage != null ? Number(c.discount_percentage) : null,
      })),
    );
  }, [accountCoupons]);

  // Each coupon knocks its own % off the base price independently (matches
  // Billing → Manage's Current Usage calc) — not compounded.
  const totalDiscountPct = appliedCoupons.reduce((sum, c) => sum + (c.discount_percentage || 0), 0);
  const discountedPriceCents = plan?.price_cents != null && totalDiscountPct > 0
    ? Math.max(0, Math.round(plan.price_cents * (1 - totalDiscountPct / 100)))
    : plan?.price_cents ?? null;

  const checkoutMutation = useMutation({
    mutationFn: async () => {
      const customerTransactionId = `AGW${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`.slice(0, 50);
      const res = await apiRequest("POST", "/api/swich/agency/landing-page", {
        customerTransactionId,
        item: "Enterprise Plan",
        planItemId: "enterprise-plan",
        amount: 1,
        description: "Agentawk agency Enterprise plan (test pricing)",
        payeeName: agencyName,
        email: agencyEmail,
        msisdn,
        successRedirectUrl: `${window.location.origin}/org/billing/plans?swich_status=success&customerTransactionId=${customerTransactionId}`,
      });
      return res.json();
    },
    onSuccess: (data) => {
      window.location.href = data.url;
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Could not start checkout. Connect Swich under Billing → Manage first.",
        variant: "destructive",
      });
    },
  });
  // Theme-aware logo selection (replyagent parity). Small/square variant preferred for 36x36 badge.
  const b = agencyResp?.agency?.branding;
  const agencyLogoUrl: string | null = dark
    ? b?.logo_dark_small || b?.logo_light_small || b?.logo_dark || b?.logo_light || null
    : b?.logo_light_small || b?.logo_dark_small || b?.logo_light || b?.logo_dark || null;

  const bg     = dark ? 'bg-[#0b1120]'  : 'bg-slate-50/80';
  const card   = dark ? 'bg-[#0f1829]'  : 'bg-white';
  const border = dark ? 'border-slate-800' : 'border-slate-200';
  const text   = dark ? 'text-white'    : 'text-slate-900';
  const sub    = dark ? 'text-slate-500' : 'text-slate-400';

  // Every row here reads straight off `plan` — the same billing_plans
  // columns the backend caps workspaces against, so this list can't say
  // "50 workspaces" while the server actually allows a different number.
  const features = plan ? [
    { name: 'Workspaces', sub: `${plan.maximum_workspaces} included`, icon: <Building2 className="w-4 h-4 text-sky-500" /> },
    { name: 'Contacts', sub: `${plan.maximum_contacts.toLocaleString()} per workspace`, icon: <MessageSquare className="w-4 h-4 text-emerald-500" /> },
    { name: 'Human Agents', sub: `${plan.free_agents} per workspace`, icon: <Users className="w-4 h-4 text-violet-500" /> },
    { name: 'AI Assistants', sub: `${plan.free_ai_agents} per workspace`, icon: <Bot className="w-4 h-4 text-indigo-500" /> },
    { name: 'Communication Channels', sub: `${plan.free_channels} of each included`, icon: <Sparkles className="w-4 h-4 text-amber-500" /> },
  ] : [];

  return (
    <div className={cn("min-h-screen transition-colors flex flex-col font-sans", bg)}>
      {/* ── Header (Users-style full-width top bar) ── */}
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
          <ArrowLeft size={14} /> Back
        </button>
      </div>

      <div className="w-full max-w-[1400px] px-8 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
          {/* Left Column: real plan features */}
          <div className="lg:col-span-7">
            <div className={cn("rounded-[20px] border shadow-sm overflow-hidden", card, border)}>
              <div className={cn("px-5 py-4 border-b flex items-center gap-3", border)}>
                <div className="p-2 rounded-lg bg-primary/10"><Crown className="w-4 h-4 text-primary" /></div>
                <div>
                  <p className={cn("text-[14px] font-bold", text)}>{plan?.external_name || "Enterprise plan"}</p>
                  <p className={cn("text-[11px] font-medium", sub)}>What's included, straight from your account's plan data</p>
                </div>
              </div>
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {features.map((item, idx) => (
                  <div
                    key={idx}
                    className="p-5 flex items-center gap-4 hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors"
                  >
                    <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shrink-0",
                      dark ? "bg-slate-800/50" : "bg-slate-100/50")}>
                      {item.icon}
                    </div>
                    <div className="flex flex-col">
                      <span className={cn("text-[13px] font-bold", text)}>{item.name}</span>
                      <p className={cn("text-[11px] font-medium mt-0.5", sub)}>{item.sub}</p>
                    </div>
                  </div>
                ))}
                {!plan && (
                  <div className="p-5">
                    <p className={cn("text-[12px]", sub)}>Loading plan details…</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right Column: Order Summary */}
          <div className="lg:col-span-5">
            <div className={cn("rounded-[20px] border p-8 sticky top-8 shadow-xl", card, border)}>
              <h3 className={cn("text-[16px] font-bold mb-6", text)}>Order summary</h3>

              <div className="pb-6 border-b border-dashed border-slate-200 dark:border-slate-700">
                <div className="flex justify-between items-center">
                  <span className={cn("text-[13px] font-bold", text)}>{plan?.external_name || "Enterprise plan"} — monthly</span>
                  <span className={cn("text-[18px] font-black", text)}>{formatUsd(plan?.price_cents)}</span>
                </div>
                {plan && (
                  <p className={cn("text-[10px] font-medium mt-1.5 leading-relaxed", sub)}>
                    Includes: {plan.maximum_workspaces} workspaces · {plan.maximum_contacts.toLocaleString()} contacts/workspace · {plan.free_agents} agents/workspace · {plan.free_ai_agents} AI assistants/workspace · {plan.free_channels} channel/workspace
                  </p>
                )}
              </div>

              {appliedCoupons.length > 0 && (
                <div className="mt-4">
                  <label className={cn("text-[11px] font-semibold mb-1.5 block", sub)}>
                    {appliedCoupons.length > 1 ? "Coupons" : "Coupon"} (from Billing → Manage)
                  </label>
                  <div className="space-y-1.5">
                    {appliedCoupons.map((c) => (
                      <div key={c.code} className={cn("flex items-center px-3 py-2 rounded-lg border text-[12px] font-bold", dark ? "bg-primary/10 border-primary/20 text-primary" : "bg-primary/5 border-primary/10 text-primary")}>
                        {c.code} — {c.discount_percentage}% off
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {appliedCoupons.length > 0 && (
                <div className="flex justify-between items-center pt-4 text-primary">
                  <span className="text-[12px] font-bold">
                    {appliedCoupons.length > 1 ? `${appliedCoupons.length} coupons applied` : `${appliedCoupons[0].code} coupon applied`}
                  </span>
                  <span className="text-[13px] font-bold">-{formatUsd((plan?.price_cents ?? 0) - (discountedPriceCents ?? 0))}</span>
                </div>
              )}

              <div className="flex justify-between items-center pt-6">
                <span className={cn("text-[16px] font-black", text)}>Total</span>
                <span className={cn("text-[20px] font-black", text)}>{formatUsd(discountedPriceCents)} <span className="text-[11px] font-medium opacity-60">/month</span></span>
              </div>

              <div className={cn("mt-6 p-4 rounded-xl border", dark ? "bg-amber-500/10 border-amber-500/20" : "bg-amber-50 border-amber-200")}>
                <p className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wide mb-1">Test Mode</p>
                <p className={cn("text-[10px] font-medium leading-relaxed", sub)}>
                  The price above is the real monthly rate. This button only charges a real <span className={text}>Rs. 1.00</span> via Swich for now — used to confirm the plan and payment details record correctly.
                </p>
              </div>

              <div className="mt-4">
                <label className={cn("text-[11px] font-semibold mb-1.5 block", sub)}>Your Mobile Number</label>
                <input
                  className={cn(
                    "w-full h-11 rounded-xl text-[13px] font-bold transition-all px-4 border outline-none",
                    "focus:ring-2 focus:ring-primary/30 focus:border-primary/50",
                    dark ? "bg-slate-950/50 border-slate-800 text-white" : "bg-white border-slate-200 text-slate-900"
                  )}
                  placeholder="03xxxxxxxxx"
                  value={msisdn}
                  onChange={(e) => setMsisdn(e.target.value)}
                />
                <p className={cn("text-[10px] font-medium mt-1.5 leading-relaxed", sub)}>
                  Required — Swich sends a confirmation SMS to this number to complete the payment.
                </p>
              </div>

              <button
                onClick={() => checkoutMutation.mutate()}
                disabled={checkoutMutation.isPending || !msisdn.trim()}
                className="w-full bg-primary hover:opacity-90 disabled:opacity-60 text-white py-3.5 rounded-xl font-black text-[14px] mt-6 transition-all shadow-lg shadow-primary/20 active:scale-[0.98] flex items-center justify-center gap-2"
              >
                {checkoutMutation.isPending && <Loader2 size={16} className="animate-spin" />}
                Proceed To Checkout (Rs. 1.00 test charge)
              </button>

              <div className="mt-6 flex items-center justify-center gap-2">
                <ShieldCheck className="w-4 h-4 text-slate-400" />
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  Secure Checkout by Swich
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AgencyEnterpriseCheckout;
