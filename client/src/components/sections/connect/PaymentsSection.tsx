import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  CreditCard,
  ShieldCheck,
  Loader2,
  Check,
  ChevronDown,
  ChevronUp,
  RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useTheme } from "@/contexts/ThemeContext";
import { formatInWorkspaceTz, useWorkspaceTimezone, useAgencyTimezone } from "@/contexts/WorkspaceTimezoneContext";

/**
 * Swich PayIn settings — save the merchant's client_id/client_secret (Section 4
 * of the integration guide), then generate a Landing Page payment link
 * (Section 5) to smoke-test the connection, and browse recent transactions
 * that our backend (src/swich) has recorded.
 */
interface PaymentsSectionProps {
  /** "/api/swich" for workspace scope, "/api/swich/agency" for agency scope. */
  basePath?: string;
}

/** Shows only the first/last few characters — credentials shouldn't be fully visible on screen. */
function maskCredential(value?: string | null): string {
  if (!value) return "";
  if (value.length <= 8) return "•".repeat(value.length);
  return `${value.slice(0, 4)}${"•".repeat(8)}${value.slice(-4)}`;
}

export default function PaymentsSection({ basePath = "/api/swich" }: PaymentsSectionProps) {
  // Agency scope charges agencies on behalf of Agentawk itself, so
  // credentials are a single server-side (.env) account, not something an
  // agency edits — hide the editable form and just show connection status.
  const isAgencyScope = basePath.includes("/agency");
  const { mode } = useTheme();
  const dark = mode === "dark";
  // Agency-scoped transactions span the whole agency, not one workspace — the
  // agency-level session has no "current workspace", so use the agency's own
  // timezone there instead of the (meaningless-when-agency-scoped) workspace one.
  const perWorkspaceTz = useWorkspaceTimezone();
  const perAgencyTz = useAgencyTimezone();
  const workspaceTz = isAgencyScope ? perAgencyTz : perWorkspaceTz;
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [showAdvanced, setShowAdvanced] = useState(false);
  const [credForm, setCredForm] = useState({
    client_id: "",
    client_secret: "",
    pwa_client_id: "",
    pwa_client_secret: "",
    environment: "sandbox" as "sandbox" | "production",
    checksum_secret: "",
    aes_encryption_key: "",
  });
  // ── Design tokens (mirrors IntegrationsSection) ──────────────────────
  const card = dark ? "bg-[#0f1829]" : "bg-white";
  const border = dark ? "border-slate-800" : "border-slate-200";
  const text = dark ? "text-white" : "text-slate-900";
  const sub = dark ? "text-slate-500" : "text-slate-400";
  const softBg = dark ? "bg-slate-950/40" : "bg-slate-50/50";

  const inputCls = cn(
    "w-full h-11 rounded-xl text-[13px] font-bold transition-all px-4 border outline-none",
    "focus:ring-2 focus:ring-primary/30 focus:border-primary/50",
    dark ? "bg-slate-950/50 border-slate-800 text-white" : "bg-white border-slate-200 text-slate-900"
  );

  const primaryBtn =
    "h-11 px-7 rounded-xl bg-primary hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed text-white text-[11px] font-semibold transition-all shadow-lg shadow-primary/20 flex items-center gap-2";

  // ── Data ───────────────────────────────────────────────────────────

  const { data: account, isLoading } = useQuery({
    queryKey: [`${basePath}/credentials`],
    queryFn: async () => {
      const res = await apiRequest("GET", `${basePath}/credentials`);
      return res.json();
    },
  });

  // Pre-fill the non-secret fields once, so "just switching environment"
  // doesn't require retyping Client ID / PWA Client ID that are already
  // saved. Secret fields intentionally stay blank — the backend never
  // echoes them back, and the placeholder already says "leave blank to
  // keep current".
  const prefilledRef = useRef(false);
  useEffect(() => {
    if (account?.connected && !prefilledRef.current) {
      prefilledRef.current = true;
      setCredForm((f) => ({
        ...f,
        client_id: account.client_id || "",
        pwa_client_id: account.pwa_client_id || "",
        environment: account.environment === "production" ? "production" : "sandbox",
      }));
    }
  }, [account]);

  const { data: transactions } = useQuery({
    queryKey: [`${basePath}/transactions`],
    queryFn: async () => {
      const res = await apiRequest("GET", `${basePath}/transactions`);
      return res.json();
    },
    enabled: !!account?.connected,
  });

  const saveMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", `${basePath}/credentials`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`${basePath}/credentials`] });
      toast({ title: "Connected", description: "Swich PayIn credentials saved." });
      setCredForm((f) => ({ ...f, client_secret: "" }));
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to save credentials. Check the values and try again.", variant: "destructive" });
    },
  });

  const disconnectMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", `${basePath}/credentials`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`${basePath}/credentials`] });
      toast({ title: "Disconnected", description: "Swich PayIn credentials removed." });
    },
  });

  // Section 13 — actively ask Swich for a transaction's real status instead
  // of waiting for the callback. Useful right now (local dev can't receive
  // callbacks) and generally useful as a manual refresh.
  const [inquiringId, setInquiringId] = useState<string | null>(null);
  const inquireMutation = useMutation({
    mutationFn: async (customerTransactionId: string) => {
      setInquiringId(customerTransactionId);
      const res = await apiRequest("GET", `${basePath}/inquire/${customerTransactionId}`);
      return res.json();
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: [`${basePath}/transactions`] });
      const status = result?.data?.transaction?.transactionStatus || result?.data?.status;
      toast({ title: "Status checked", description: `Swich reports: ${status || "unknown"}` });
    },
    onError: () => {
      toast({ title: "Error", description: "Could not check status with Swich.", variant: "destructive" });
    },
    onSettled: () => setInquiringId(null),
  });

  const isConnected = !!account?.connected;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ── Credentials card ── */}
      <Card className={cn("rounded-[2rem] border overflow-hidden shadow-sm transition-all duration-300", card, border)}>
        <CardContent className="p-0">
          <div className={cn("px-8 py-5 border-b flex items-center justify-between", border)}>
            <div className="flex items-center gap-4">
              <div className="p-2.5 rounded-xl shadow-sm bg-primary/10">
                <CreditCard className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h1 className={cn("text-[16px] font-bold tracking-tight", text)}>Swich PayIn</h1>
                <p className={cn("text-[11px] font-bold mt-0.5 opacity-60 max-w-2xl", sub)}>
                  Accept E-Wallet, Bank, QR, RTP and Card payments through Swich.
                </p>
              </div>
            </div>
            {isConnected ? (
              <Badge variant="outline" className="h-7 px-3 rounded-md border-emerald-500/30 bg-emerald-500/5 text-emerald-600 dark:text-emerald-400 text-[10px] font-semibold">
                <Check size={10} className="mr-1" /> Connected · {account.environment}
              </Badge>
            ) : (
              <Badge variant="outline" className="h-7 px-3 rounded-md border-slate-300/50 bg-slate-500/5 text-slate-500 text-[10px] font-semibold">
                Not Connected
              </Badge>
            )}
          </div>

          <div className="p-8 space-y-5">
            {isConnected && (
              <div className={cn("rounded-xl border p-4 flex items-center justify-between", softBg, border)}>
                <div className="flex items-center gap-3">
                  <ShieldCheck size={16} className="text-primary" />
                  <div>
                    <p className={cn("text-[12px] font-bold", text)}>Client ID: {maskCredential(account.client_id)}</p>
                    <p className={cn("text-[10px] opacity-60", sub)}>
                      {account.environment === "production" ? "Live" : "Sandbox"} mode
                      {account.has_pwa_credentials ? " · PWA client set" : ""}
                      {account.has_checksum_secret ? " · checksum secret set" : ""}
                      {account.has_aes_key ? " · AES key set" : ""}
                    </p>
                  </div>
                </div>
                {!isAgencyScope && (
                  <button
                    onClick={() => disconnectMutation.mutate()}
                    disabled={disconnectMutation.isPending}
                    className="text-[11px] font-semibold text-red-500 hover:text-red-600"
                  >
                    {disconnectMutation.isPending ? "Removing…" : "Disconnect"}
                  </button>
                )}
              </div>
            )}

            {isAgencyScope && !isConnected && (
              <p className={cn("text-[12px]", sub)}>
                Swich isn't configured on the server yet. This is set once for the whole platform (server config), not per agency.
              </p>
            )}

            {!isAgencyScope && (
              <>
                {/* Swich issues two separate credential pairs — one to call their
                    APIs directly (Bearer token), one to identify the merchant on
                    their hosted Landing Page / PWA checkout. Keep them visually
                    separate so they don't get mixed up. */}
                <div>
                  <p className={cn("text-[11px] font-bold uppercase tracking-wide", sub)}>For API</p>
                  <p className={cn("text-[11px] opacity-70 mb-2", sub)}>
                    Used when we call Swich directly (E-Wallet, Bank, QR, RTP, Refund). Find this in your Swich dashboard under "API Access".
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className={cn("text-[11px] font-semibold mb-1.5 block", sub)}>Client ID</label>
                      <input
                        className={inputCls}
                        placeholder="Provided by Swich"
                        value={credForm.client_id}
                        onChange={(e) => setCredForm({ ...credForm, client_id: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className={cn("text-[11px] font-semibold mb-1.5 block", sub)}>Client Secret</label>
                      <input
                        type="password"
                        className={inputCls}
                        placeholder={isConnected ? "•••••••• (leave blank to keep current)" : "Provided by Swich"}
                        value={credForm.client_secret}
                        onChange={(e) => setCredForm({ ...credForm, client_secret: e.target.value })}
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <p className={cn("text-[11px] font-bold uppercase tracking-wide", sub)}>For PWA (Landing Page)</p>
                  <p className={cn("text-[11px] opacity-70 mb-2", sub)}>
                    Used for the hosted payment page customers see (Section 5 of Swich's guide). Find this under "PWA / Checkout" in your Swich dashboard — it's different from the API credentials above.
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className={cn("text-[11px] font-semibold mb-1.5 block", sub)}>PWA Client ID</label>
                      <input
                        className={inputCls}
                        placeholder="Provided by Swich"
                        value={credForm.pwa_client_id}
                        onChange={(e) => setCredForm({ ...credForm, pwa_client_id: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className={cn("text-[11px] font-semibold mb-1.5 block", sub)}>PWA Client Secret</label>
                      <input
                        type="password"
                        className={inputCls}
                        placeholder={account?.has_pwa_credentials ? "•••••••• (leave blank to keep current)" : "Provided by Swich"}
                        value={credForm.pwa_client_secret}
                        onChange={(e) => setCredForm({ ...credForm, pwa_client_secret: e.target.value })}
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className={cn("text-[11px] font-semibold mb-1.5 block", sub)}>Environment</label>
                  <div className="flex gap-2">
                    {(["sandbox", "production"] as const).map((env) => (
                      <button
                        key={env}
                        onClick={() => setCredForm({ ...credForm, environment: env })}
                        className={cn(
                          "h-10 px-5 rounded-xl border text-[11px] font-semibold transition-all capitalize",
                          credForm.environment === env
                            ? "border-primary bg-primary text-white"
                            : cn(border, sub)
                        )}
                      >
                        {env}
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  onClick={() => setShowAdvanced((v) => !v)}
                  className={cn("flex items-center gap-1.5 text-[11px] font-semibold", sub)}
                >
                  {showAdvanced ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  Advanced (checksum secret, AES key for POST landing page)
                </button>

                {showAdvanced && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className={cn("text-[11px] font-semibold mb-1.5 block", sub)}>Checksum Secret (optional)</label>
                      <input
                        type="password"
                        className={inputCls}
                        placeholder="Falls back to Client Secret if empty"
                        value={credForm.checksum_secret}
                        onChange={(e) => setCredForm({ ...credForm, checksum_secret: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className={cn("text-[11px] font-semibold mb-1.5 block", sub)}>AES Encryption Key (optional)</label>
                      <input
                        type="password"
                        className={inputCls}
                        placeholder="Only needed for the POST landing page"
                        value={credForm.aes_encryption_key}
                        onChange={(e) => setCredForm({ ...credForm, aes_encryption_key: e.target.value })}
                      />
                    </div>
                  </div>
                )}

                <div className="flex justify-end">
                  <button
                    className={primaryBtn}
                    disabled={saveMutation.isPending || (!isConnected && (!credForm.client_id || !credForm.client_secret))}
                    onClick={() => saveMutation.mutate(credForm)}
                  >
                    {saveMutation.isPending && <Loader2 size={14} className="animate-spin" />}
                    {isConnected ? "Update Credentials" : "Connect Swich"}
                  </button>
                </div>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ── Recent transactions ── */}
      {isConnected && (
        <Card className={cn("rounded-[2rem] border overflow-hidden shadow-sm", card, border)}>
          <CardContent className="p-8 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className={cn("text-[14px] font-bold", text)}>Recent Transactions</h2>
              <button
                onClick={() => queryClient.invalidateQueries({ queryKey: [`${basePath}/transactions`] })}
                className={cn("flex items-center gap-1.5 text-[11px] font-semibold", sub)}
              >
                <RefreshCw size={12} /> Refresh
              </button>
            </div>

            {!transactions?.length ? (
              <p className={cn("text-[12px] opacity-60", sub)}>No transactions yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-[11px]">
                  <thead>
                    <tr className={cn("text-left border-b", border, sub)}>
                      <th className="py-2 pr-4 font-semibold">Transaction ID</th>
                      <th className="py-2 pr-4 font-semibold">Plan</th>
                      <th className="py-2 pr-4 font-semibold">Channel</th>
                      <th className="py-2 pr-4 font-semibold">Amount</th>
                      <th className="py-2 pr-4 font-semibold">Method</th>
                      <th className="py-2 pr-4 font-semibold">Account / Number</th>
                      <th className="py-2 pr-4 font-semibold">Status</th>
                      <th className="py-2 pr-4 font-semibold">Created</th>
                      <th className="py-2 pr-4 font-semibold"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {transactions.map((t: any) => (
                      <tr key={t.id} className={cn("border-b last:border-0", border)}>
                        <td className={cn("py-2 pr-4 font-mono", text)}>{t.customer_transaction_id}</td>
                        <td className={cn("py-2 pr-4 font-semibold", text)}>
                          {t.plan_name || <span className="opacity-50 font-normal">—</span>}
                        </td>
                        <td className={cn("py-2 pr-4 capitalize", text)}>{t.channel.replace(/_/g, " ")}</td>
                        <td className={cn("py-2 pr-4", text)}>{t.amount ? `${t.amount} ${t.currency}` : "—"}</td>
                        <td className={cn("py-2 pr-4", text)}>
                          {t.swich_channel_name || <span className="opacity-50">Not confirmed yet</span>}
                        </td>
                        <td className={cn("py-2 pr-4 font-mono", text)}>
                          {t.swich_consumer_number || t.msisdn || "—"}
                        </td>
                        <td className="py-2 pr-4">
                          <Badge
                            variant="outline"
                            className={cn(
                              "h-5 px-2 rounded-md text-[10px] font-semibold capitalize",
                              t.status === "success"
                                ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-600 dark:text-emerald-400"
                                : t.status === "failed"
                                  ? "border-red-500/30 bg-red-500/5 text-red-600 dark:text-red-400"
                                  : "border-amber-500/30 bg-amber-500/5 text-amber-600 dark:text-amber-400"
                            )}
                          >
                            {t.status}
                          </Badge>
                        </td>
                        <td className={cn("py-2 pr-4 opacity-60", sub)}>
                          {t.created_at ? formatInWorkspaceTz(t.created_at, "M/d/yyyy, h:mm:ss a", workspaceTz) : "—"}
                        </td>
                        <td className="py-2 pr-4">
                          {t.status === "pending" && (
                            <button
                              onClick={() => inquireMutation.mutate(t.customer_transaction_id)}
                              disabled={inquiringId === t.customer_transaction_id}
                              className={cn("flex items-center gap-1 text-[10px] font-semibold whitespace-nowrap", sub)}
                            >
                              {inquiringId === t.customer_transaction_id ? (
                                <Loader2 size={11} className="animate-spin" />
                              ) : (
                                <RefreshCw size={11} />
                              )}
                              Check Status
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
