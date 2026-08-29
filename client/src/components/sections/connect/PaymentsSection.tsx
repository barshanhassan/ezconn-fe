import { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
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
  const { t } = useTranslation();
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
      toast({ title: t("payments_section.toast_connected_title"), description: t("payments_section.toast_credentials_saved_description") });
      setCredForm((f) => ({ ...f, client_secret: "" }));
    },
    onError: () => {
      toast({ title: t("payments_section.toast_error_title"), description: t("payments_section.toast_save_error_description"), variant: "destructive" });
    },
  });

  const disconnectMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", `${basePath}/credentials`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`${basePath}/credentials`] });
      toast({ title: t("payments_section.toast_disconnected_title"), description: t("payments_section.toast_credentials_removed_description") });
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
      toast({ title: t("payments_section.toast_status_checked_title"), description: t("payments_section.toast_swich_reports_description", { status: status || t("payments_section.unknown") }) });
    },
    onError: () => {
      toast({ title: t("payments_section.toast_error_title"), description: t("payments_section.toast_status_check_error_description"), variant: "destructive" });
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
                <h1 className={cn("text-[16px] font-bold tracking-tight", text)}>{t("payments_section.title")}</h1>
                <p className={cn("text-[11px] font-bold mt-0.5 opacity-60 max-w-2xl", sub)}>
                  {t("payments_section.subtitle")}
                </p>
              </div>
            </div>
            {isConnected ? (
              <Badge variant="outline" className="h-7 px-3 rounded-md border-emerald-500/30 bg-emerald-500/5 text-emerald-600 dark:text-emerald-400 text-[10px] font-semibold">
                <Check size={10} className="mr-1" /> {t("payments_section.connected_env", { env: account.environment })}
              </Badge>
            ) : (
              <Badge variant="outline" className="h-7 px-3 rounded-md border-slate-300/50 bg-slate-500/5 text-slate-500 text-[10px] font-semibold">
                {t("payments_section.not_connected")}
              </Badge>
            )}
          </div>

          <div className="p-8 space-y-5">
            {isConnected && (
              <div className={cn("rounded-xl border p-4 flex items-center justify-between", softBg, border)}>
                <div className="flex items-center gap-3">
                  <ShieldCheck size={16} className="text-primary" />
                  <div>
                    <p className={cn("text-[12px] font-bold", text)}>{t("payments_section.client_id_label", { value: maskCredential(account.client_id) })}</p>
                    <p className={cn("text-[10px] opacity-60", sub)}>
                      {account.environment === "production" ? t("payments_section.live") : t("payments_section.sandbox")} {t("payments_section.mode")}
                      {account.has_pwa_credentials ? ` · ${t("payments_section.pwa_client_set")}` : ""}
                      {account.has_checksum_secret ? ` · ${t("payments_section.checksum_secret_set")}` : ""}
                      {account.has_aes_key ? ` · ${t("payments_section.aes_key_set")}` : ""}
                    </p>
                  </div>
                </div>
                {!isAgencyScope && (
                  <button
                    onClick={() => disconnectMutation.mutate()}
                    disabled={disconnectMutation.isPending}
                    className="text-[11px] font-semibold text-red-500 hover:text-red-600"
                  >
                    {disconnectMutation.isPending ? t("payments_section.removing") : t("payments_section.disconnect")}
                  </button>
                )}
              </div>
            )}

            {isAgencyScope && !isConnected && (
              <p className={cn("text-[12px]", sub)}>
                {t("payments_section.agency_not_configured")}
              </p>
            )}

            {!isAgencyScope && (
              <>
                {/* Swich issues two separate credential pairs — one to call their
                    APIs directly (Bearer token), one to identify the merchant on
                    their hosted Landing Page / PWA checkout. Keep them visually
                    separate so they don't get mixed up. */}
                <div>
                  <p className={cn("text-[11px] font-bold uppercase tracking-wide", sub)}>{t("payments_section.for_api")}</p>
                  <p className={cn("text-[11px] opacity-70 mb-2", sub)}>
                    {t("payments_section.for_api_description")}
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className={cn("text-[11px] font-semibold mb-1.5 block", sub)}>{t("payments_section.client_id")}</label>
                      <input
                        className={inputCls}
                        placeholder={t("payments_section.provided_by_swich")}
                        value={credForm.client_id}
                        onChange={(e) => setCredForm({ ...credForm, client_id: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className={cn("text-[11px] font-semibold mb-1.5 block", sub)}>{t("payments_section.client_secret")}</label>
                      <input
                        type="password"
                        className={inputCls}
                        placeholder={isConnected ? t("payments_section.leave_blank_keep_current") : t("payments_section.provided_by_swich")}
                        value={credForm.client_secret}
                        onChange={(e) => setCredForm({ ...credForm, client_secret: e.target.value })}
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <p className={cn("text-[11px] font-bold uppercase tracking-wide", sub)}>{t("payments_section.for_pwa")}</p>
                  <p className={cn("text-[11px] opacity-70 mb-2", sub)}>
                    {t("payments_section.for_pwa_description")}
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className={cn("text-[11px] font-semibold mb-1.5 block", sub)}>{t("payments_section.pwa_client_id")}</label>
                      <input
                        className={inputCls}
                        placeholder={t("payments_section.provided_by_swich")}
                        value={credForm.pwa_client_id}
                        onChange={(e) => setCredForm({ ...credForm, pwa_client_id: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className={cn("text-[11px] font-semibold mb-1.5 block", sub)}>{t("payments_section.pwa_client_secret")}</label>
                      <input
                        type="password"
                        className={inputCls}
                        placeholder={account?.has_pwa_credentials ? t("payments_section.leave_blank_keep_current") : t("payments_section.provided_by_swich")}
                        value={credForm.pwa_client_secret}
                        onChange={(e) => setCredForm({ ...credForm, pwa_client_secret: e.target.value })}
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className={cn("text-[11px] font-semibold mb-1.5 block", sub)}>{t("payments_section.environment")}</label>
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
                        {env === "sandbox" ? t("payments_section.sandbox") : t("payments_section.production")}
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  onClick={() => setShowAdvanced((v) => !v)}
                  className={cn("flex items-center gap-1.5 text-[11px] font-semibold", sub)}
                >
                  {showAdvanced ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  {t("payments_section.advanced_toggle")}
                </button>

                {showAdvanced && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className={cn("text-[11px] font-semibold mb-1.5 block", sub)}>{t("payments_section.checksum_secret_optional")}</label>
                      <input
                        type="password"
                        className={inputCls}
                        placeholder={t("payments_section.checksum_secret_placeholder")}
                        value={credForm.checksum_secret}
                        onChange={(e) => setCredForm({ ...credForm, checksum_secret: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className={cn("text-[11px] font-semibold mb-1.5 block", sub)}>{t("payments_section.aes_key_optional")}</label>
                      <input
                        type="password"
                        className={inputCls}
                        placeholder={t("payments_section.aes_key_placeholder")}
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
                    {isConnected ? t("payments_section.update_credentials") : t("payments_section.connect_swich")}
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
              <h2 className={cn("text-[14px] font-bold", text)}>{t("payments_section.recent_transactions")}</h2>
              <button
                onClick={() => queryClient.invalidateQueries({ queryKey: [`${basePath}/transactions`] })}
                className={cn("flex items-center gap-1.5 text-[11px] font-semibold", sub)}
              >
                <RefreshCw size={12} /> {t("payments_section.refresh")}
              </button>
            </div>

            {!transactions?.length ? (
              <p className={cn("text-[12px] opacity-60", sub)}>{t("payments_section.no_transactions_yet")}</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-[11px]">
                  <thead>
                    <tr className={cn("text-left border-b", border, sub)}>
                      <th className="py-2 pr-4 font-semibold">{t("payments_section.column_transaction_id")}</th>
                      <th className="py-2 pr-4 font-semibold">{t("payments_section.column_plan")}</th>
                      <th className="py-2 pr-4 font-semibold">{t("payments_section.column_channel")}</th>
                      <th className="py-2 pr-4 font-semibold">{t("payments_section.column_amount")}</th>
                      <th className="py-2 pr-4 font-semibold">{t("payments_section.column_method")}</th>
                      <th className="py-2 pr-4 font-semibold">{t("payments_section.column_account_number")}</th>
                      <th className="py-2 pr-4 font-semibold">{t("payments_section.column_status")}</th>
                      <th className="py-2 pr-4 font-semibold">{t("payments_section.column_created")}</th>
                      <th className="py-2 pr-4 font-semibold"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {transactions.map((txn: any) => (
                      <tr key={txn.id} className={cn("border-b last:border-0", border)}>
                        <td className={cn("py-2 pr-4 font-mono", text)}>{txn.customer_transaction_id}</td>
                        <td className={cn("py-2 pr-4 font-semibold", text)}>
                          {txn.plan_name || <span className="opacity-50 font-normal">—</span>}
                        </td>
                        <td className={cn("py-2 pr-4 capitalize", text)}>{txn.channel.replace(/_/g, " ")}</td>
                        <td className={cn("py-2 pr-4", text)}>{txn.amount ? `${txn.amount} ${txn.currency}` : "—"}</td>
                        <td className={cn("py-2 pr-4", text)}>
                          {txn.swich_channel_name || <span className="opacity-50">{t("payments_section.not_confirmed_yet")}</span>}
                        </td>
                        <td className={cn("py-2 pr-4 font-mono", text)}>
                          {txn.swich_consumer_number || txn.msisdn || "—"}
                        </td>
                        <td className="py-2 pr-4">
                          <Badge
                            variant="outline"
                            className={cn(
                              "h-5 px-2 rounded-md text-[10px] font-semibold capitalize",
                              txn.status === "success"
                                ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-600 dark:text-emerald-400"
                                : txn.status === "failed"
                                  ? "border-red-500/30 bg-red-500/5 text-red-600 dark:text-red-400"
                                  : "border-amber-500/30 bg-amber-500/5 text-amber-600 dark:text-amber-400"
                            )}
                          >
                            {txn.status}
                          </Badge>
                        </td>
                        <td className={cn("py-2 pr-4 opacity-60", sub)}>
                          {txn.created_at ? formatInWorkspaceTz(txn.created_at, "M/d/yyyy, h:mm:ss a", workspaceTz) : "—"}
                        </td>
                        <td className="py-2 pr-4">
                          {txn.status === "pending" && (
                            <button
                              onClick={() => inquireMutation.mutate(txn.customer_transaction_id)}
                              disabled={inquiringId === txn.customer_transaction_id}
                              className={cn("flex items-center gap-1 text-[10px] font-semibold whitespace-nowrap", sub)}
                            >
                              {inquiringId === txn.customer_transaction_id ? (
                                <Loader2 size={11} className="animate-spin" />
                              ) : (
                                <RefreshCw size={11} />
                              )}
                              {t("payments_section.check_status")}
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
