import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { Instagram, CheckCircle, XCircle, Loader2 } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

export default function InstagramCallbackPage() {
  const { t } = useTranslation();
  const [, setLocation] = useLocation();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    const errorParam = params.get("error");
    // `state` carries the page id when this is a RECONNECT (re-auth of an
    // existing account) rather than a fresh connect.
    const reconnectPageId = params.get("state");

    if (errorParam) {
      const desc = params.get("error_description") ?? errorParam;
      setStatus("error");
      setMessage(desc);
      setTimeout(() => setLocation("/"), 3000);
      return;
    }

    if (!code) {
      setStatus("error");
      setMessage(t("instagram_callback_page.no_auth_code"));
      setTimeout(() => setLocation("/"), 3000);
      return;
    }

    const redirectUri = `${window.location.origin}/instagram-callback`;

    const endpoint = reconnectPageId
      ? "/api/instagram/reconnect-business"
      : "/api/instagram/connect-business";
    const payload: Record<string, any> = { code, redirect_uri: redirectUri };
    if (reconnectPageId) payload.page_id = reconnectPageId;

    apiRequest("POST", endpoint, payload)
      .then(async (res) => {
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.message ?? t("instagram_callback_page.connection_failed"));
        }
        setStatus("success");
        setMessage(
          reconnectPageId
            ? t("instagram_callback_page.reconnected_success")
            : t("instagram_callback_page.connected_success"),
        );
        setTimeout(() => setLocation("/"), 2500);
      })
      .catch((err) => {
        setStatus("error");
        setMessage(err?.message ?? t("instagram_callback_page.connect_failed"));
        setTimeout(() => setLocation("/"), 3500);
      });
  }, [setLocation]);

  return (
    <div className="min-h-screen bg-[#0f1829] flex items-center justify-center p-6">
      <div className="bg-slate-900 border border-slate-800 rounded-[2rem] p-10 max-w-sm w-full flex flex-col items-center text-center gap-6 shadow-xl">
        <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-yellow-400 via-pink-500 to-purple-600 flex items-center justify-center">
          <Instagram className="w-8 h-8 text-white" />
        </div>

        <div>
          <h2 className="text-[15px] font-black text-white uppercase tracking-widest">Instagram</h2>
          <p className="text-[11px] font-bold text-slate-500 mt-1 uppercase tracking-widest">{t("instagram_callback_page.oauth_callback")}</p>
        </div>

        {status === "loading" && (
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
            <p className="text-[12px] font-bold text-slate-400">{t("instagram_callback_page.connecting")}</p>
          </div>
        )}

        {status === "success" && (
          <div className="flex flex-col items-center gap-3">
            <CheckCircle className="w-8 h-8 text-emerald-500" />
            <p className="text-[12px] font-bold text-emerald-400">{message}</p>
            <p className="text-[10px] text-slate-500">{t("instagram_callback_page.redirecting_settings")}</p>
          </div>
        )}

        {status === "error" && (
          <div className="flex flex-col items-center gap-3">
            <XCircle className="w-8 h-8 text-rose-500" />
            <p className="text-[12px] font-bold text-rose-400">{message}</p>
            <p className="text-[10px] text-slate-500">{t("instagram_callback_page.redirecting_back")}</p>
          </div>
        )}
      </div>
    </div>
  );
}
