import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useTheme } from "@/contexts/ThemeContext";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";

/**
 * Alternative connect page for 360Dialog / FB SDK driven onboarding flows.
 * Mirrors replyagent's `views/Whatsapp/WhatsappConnect.vue`.
 *
 * Two query-param shapes:
 *   - `?channels=<id>&client=<id>` — 360Dialog hosted onboarding completion;
 *      we POST `/whatsapp/waba/on-boarding` (or `/whatsapp/onboard` if not
 *      yet exposed) so the backend can persist the partner-owned WABA.
 *   - `#t=<token>` (hash) — direct FB SDK token return; we POST
 *     `/whatsapp/onboard` with `_t=<token>` (rare; kept for replyagent parity).
 *
 * If neither shape is present we bounce back to the settings page.
 */
export default function WhatsAppConnectPage() {
  const { t } = useTranslation();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { mode } = useTheme();
  const dark = mode === "dark";

  const [status, setStatus] = useState<"verifying" | "success" | "error">("verifying");
  const [message, setMessage] = useState<string | null>(null);

  const backToSettings = () => setLocation("/settings?tab=WhatsApp");

  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    const hash = (window.location.hash ?? "").replace(/^#/, "");
    const hashParams = new URLSearchParams(hash);

    const channels = query.get("channels");
    const client = query.get("client");
    const token = hashParams.get("t");

    if (channels && client) {
      run360DialogOnboard({ channels, client });
    } else if (token) {
      runDirectOnboard({ token });
    } else {
      // Nothing to do — go home.
      backToSettings();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const run360DialogOnboard = async (args: { channels: string; client: string }) => {
    try {
      const res = await apiRequest("POST", "/api/whatsapp/onboard", {
        partner: "360dialog",
        channels: args.channels,
        client: args.client,
      });
      const data = await res.json();
      if (data?.success) {
        setStatus("success");
        setMessage(data?.message ?? t("whatsapp_connect_page.account_connected"));
        toast({ title: t("whatsapp_connect_page.whatsapp_connected") });
        backToSettings();
      } else {
        setStatus("error");
        setMessage(data?.message ?? t("whatsapp_connect_page.request_failed"));
      }
    } catch (e: any) {
      setStatus("error");
      setMessage(e?.message ?? t("whatsapp_connect_page.something_went_wrong"));
    }
  };

  const runDirectOnboard = async (args: { token: string }) => {
    try {
      const res = await apiRequest("POST", "/api/whatsapp/onboard", { _t: args.token });
      const data = await res.json();
      if (data?.success) {
        setStatus("success");
        toast({ title: t("whatsapp_connect_page.whatsapp_connected") });
        backToSettings();
      } else if (data?.error_code === "ACCOUNT_EXISTS") {
        setStatus("error");
        setMessage(t("whatsapp_connect_page.account_already_connected"));
      } else if (data?.error_code === "INTERNAL_SERVER_ERROR") {
        setStatus("error");
        setMessage(t("whatsapp_connect_page.internal_error"));
      } else {
        setStatus("error");
        setMessage(data?.message ?? t("whatsapp_connect_page.signup_incomplete"));
      }
    } catch (e: any) {
      setStatus("error");
      setMessage(e?.response?.data?.message ?? e?.message ?? t("whatsapp_connect_page.something_went_wrong"));
    }
  };

  return (
    <div className={cn("min-h-screen flex items-center justify-center px-4", dark ? "bg-slate-950" : "bg-slate-50")}>
      <div className={cn("max-w-md w-full rounded-2xl border p-10 text-center space-y-5", dark ? "bg-[#0f1829] border-slate-800" : "bg-white border-slate-200")}>
        <img src="/images/automations/whatsapp.svg" alt="WhatsApp" className="w-10 h-10 mx-auto" />
        {status === "verifying" && (
          <>
            <h2 className={cn("text-xl font-medium", dark ? "text-white" : "text-slate-900")}>
              {t("whatsapp_connect_page.verifying_business")}
            </h2>
            <div className="flex justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500" />
            </div>
          </>
        )}
        {status === "success" && (
          <p className={cn("text-sm", dark ? "text-slate-300" : "text-slate-700")}>{message ?? t("whatsapp_connect_page.connected")}</p>
        )}
        {status === "error" && (
          <>
            <h2 className={cn("text-lg font-bold", dark ? "text-white" : "text-slate-900")}>{t("whatsapp_connect_page.could_not_connect")}</h2>
            <p className={cn("text-sm", dark ? "text-slate-400" : "text-slate-600")}>{message}</p>
          </>
        )}
        <div>
          <button
            onClick={backToSettings}
            className={cn(
              "text-[11px] font-bold uppercase tracking-widest",
              dark ? "text-slate-400 hover:text-white" : "text-slate-600 hover:text-slate-900",
            )}
          >
            {t("whatsapp_connect_page.go_back")}
          </button>
        </div>
      </div>
    </div>
  );
}
