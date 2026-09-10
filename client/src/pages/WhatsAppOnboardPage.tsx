import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useTheme } from "@/contexts/ThemeContext";
import { cn } from "@/lib/utils";

/**
 * Meta Embedded Signup return page. Mirrors replyagent's
 * `views/Whatsapp/WhatsappOnboard.vue`.
 *
 * Meta's WhatsApp Embedded Signup popup redirects the user here with the
 * onboarding result in the URL hash:
 *
 *   /settings/whatsapp-onboard#c=<code>&w=<waba_id>&p=<phone_number_id>&u=<user_id>&b=<business_id>&s=<source>
 *
 * Two flows:
 *   1. `code + waba_id + phone_number_id`   → call `/whatsapp/onboard`
 *      (full onboarding — exchange code for token, persist WABA + number,
 *       publish WA_REGISTER, redirect to /settings).
 *   2. `code + user_id`                     → call `/whatsapp/profiles`
 *      (user hasn't picked a phone number yet — fetch their profiles or
 *       fall back to displaying a support code for manual handoff).
 *
 * If the URL hash is missing or `error_1001` (WABA already connected) comes
 * back, show an informative dialog and bounce back to settings.
 *
 * IMPORTANT: this is the *exact* URL Meta sends users to after the popup
 * resolves. Without it, embedded signup is a dead-end — that's the parity
 * piece the user wanted ready before testing.
 */
export default function WhatsAppOnboardPage() {
  const { t } = useTranslation();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { mode } = useTheme();
  const dark = mode === "dark";

  const [error, setError] = useState<string | null>(null);
  const [supportCode, setSupportCode] = useState<string | null>(null);
  const [showCode, setShowCode] = useState(false);
  const [source, setSource] = useState<string | null>(null);

  // Determine where to redirect when we're done — Coex signup ("?s=aka")
  // lands the user on the Coex Manage tab; everything else goes to the API tab.
  // The SettingsPage reads `?tab=WhatsApp` to activate the section, and the
  // WhatsAppSection reads `?view=coex|api|qr` to open the right Manage panel.
  const redirectBack = (sourceArg?: string | null) => {
    const s = sourceArg ?? source;
    setLocation(s === "aka" ? "/settings?tab=WhatsApp&view=coex" : "/settings?tab=WhatsApp&view=api");
  };

  useEffect(() => {
    // Meta passes the result in the URL hash: #c=...&w=...&p=...
    const hash = (window.location.hash ?? "").replace(/^#/, "");
    const params = new URLSearchParams(hash);
    const code = params.get("c");
    const wabaId = params.get("w");
    const phoneNumberId = params.get("p");
    const userId = params.get("u");
    const businessId = params.get("b");
    const src = params.get("s");
    setSource(src);

    if (code && phoneNumberId && wabaId) {
      runOnboard({ code, wabaId, phoneNumberId, userId, businessId, src });
    } else if (code && userId) {
      runFetchProfiles({ code, userId });
    } else {
      // No usable params — likely the user cancelled the popup.
      toast({
        title: t("whats_app_onboard_page.signup_cancelled_title"),
        description: t("whats_app_onboard_page.signup_cancelled_description"),
        variant: "destructive",
      });
      redirectBack(src);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const runOnboard = async (args: {
    code: string;
    wabaId: string;
    phoneNumberId: string;
    userId: string | null;
    businessId: string | null;
    src: string | null;
  }) => {
    try {
      const res = await apiRequest("POST", "/api/whatsapp/onboard", {
        _c: args.code,
        _w: args.wabaId,
        _p: args.phoneNumberId,
        _u: args.userId,
        _b: args.businessId,
        _s: args.src,
      });
      const data = await res.json();
      if (data?.success) {
        // WhatsAppSection's own account list/limits queries have no polling —
        // without this, a freshly-connected number is invisible there until
        // a hard refresh, same as its manualOnboardMutation already handles.
        queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/accounts", "phoneNumbers,capi"] });
        queryClient.invalidateQueries({ queryKey: ["/api/integrations/channels"] });
        queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/limits"] });
        toast({
          title: t("whats_app_onboard_page.connected_title"),
          description: data?.message ?? t("whats_app_onboard_page.connected_description"),
        });
        redirectBack(args.src);
        return;
      }
      // Backend returned success=false (unusual)
      setError(data?.message ?? t("whats_app_onboard_page.signup_incomplete_error"));
    } catch (e: any) {
      const code = e?.error_code ?? e?.response?.data?.error_code;
      if (code === "error_1001") {
        toast({
          title: t("whats_app_onboard_page.already_connected_title"),
          description: t("whats_app_onboard_page.already_connected_description"),
          variant: "destructive",
        });
        redirectBack(args.src);
        return;
      }
      setError(e?.message ?? t("whats_app_onboard_page.generic_error"));
    }
  };

  const runFetchProfiles = async (args: { code: string; userId: string }) => {
    try {
      const res = await apiRequest("POST", "/api/whatsapp/profiles", {
        _c: args.code,
        _u: args.userId,
      });
      const data = await res.json();
      if (data?.t) {
        // Replyagent contract — backend handed us a token but no profile picker
        // path. Show it as a support code so the user can paste it to support.
        setSupportCode(data.t);
      } else if (data?.profiles?.length) {
        // Future: render a profile picker. For now, surface as error so the
        // user knows they need to retry through Embedded Signup.
        setError(t("whats_app_onboard_page.multiple_profiles_error"));
      } else {
        setError(data?.message ?? t("whats_app_onboard_page.no_profiles_error"));
      }
    } catch (e: any) {
      setError(e?.message ?? t("whats_app_onboard_page.generic_error"));
    }
  };

  return (
    <div className={cn("min-h-screen flex items-center justify-center px-4", dark ? "bg-slate-950" : "bg-slate-50")}>
      <div className={cn("max-w-md w-full rounded-2xl border p-10 text-center", dark ? "bg-[#0f1829] border-slate-800" : "bg-white border-slate-200")}>
        {/* WhatsApp icon */}
        <svg
          width="60"
          height="60"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          preserveAspectRatio="xMidYMid meet"
          className="mx-auto"
        >
          <path
            d="M24 12C24 18.6274 18.6274 24 12 24C5.37258 24 0 18.6274 0 12C0 5.37258 5.37258 0 12 0C18.6274 0 24 5.37258 24 12Z"
            fill="url(#waOnboardGrad)"
          />
          <path
            fillRule="evenodd"
            clipRule="evenodd"
            d="M5 11.5065C5 7.91278 8.11522 5 11.958 5C15.8008 5 18.916 7.91278 18.916 11.5065C18.916 15.1003 15.8008 18.0131 11.958 18.0131C11.2635 18.0131 10.5926 17.9179 9.9597 17.7405L7.58508 19.0578V16.5675C6.00817 15.3749 5 13.5509 5 11.5065ZM15.7569 12.9568C15.7548 12.9336 15.7529 12.9136 15.7521 12.897C15.7441 12.7389 15.6021 12.7147 15.6021 12.7147C15.6021 12.7147 14.4386 12.1511 14.1994 12.0415C13.9605 11.932 13.8388 12.1107 13.8388 12.1107C13.8388 12.1107 13.486 12.5566 13.3724 12.7024C13.363 12.7145 13.354 12.7264 13.3452 12.7381C13.2468 12.8683 13.1697 12.9702 12.8982 12.8808C12.6022 12.7834 12.0087 12.4639 11.5237 12.0294C11.0391 11.595 10.6684 11.0201 10.5632 10.8458C10.4578 10.6712 10.5794 10.562 10.5794 10.562C10.5794 10.562 10.8864 10.2082 11.0333 10.0187C11.1771 9.83334 11.0925 9.62678 11.0559 9.5377C11.0551 9.53575 11.0536 9.53202 11.0536 9.53202C11.0186 9.44684 10.5468 8.3386 10.4779 8.18234C10.4092 8.02594 10.2592 8 10.2592 8H9.69973C9.59967 8 9.40786 8.12164 9.40786 8.12164C8.83294 8.48961 8.73552 9.34836 8.71867 9.53373C8.70182 9.71909 8.68497 10.1125 8.98829 10.7753C9.29161 11.4379 10.0331 12.3368 10.9488 13.1908C11.8315 14.0141 13.1685 14.385 13.6436 14.5168C13.6612 14.5217 13.6776 14.5263 13.6928 14.5305C14.1175 14.6491 15.0143 14.4385 15.4359 13.9831C15.8133 13.5759 15.7749 13.1541 15.7569 12.9568Z"
            fill="white"
          />
          <defs>
            <linearGradient id="waOnboardGrad" x1="12" y1="32" x2="-4.5" y2="0" gradientUnits="userSpaceOnUse">
              <stop stopColor="#1EBF5A" />
              <stop offset="0.922652" stopColor="#2CE979" />
            </linearGradient>
          </defs>
        </svg>

        {error === null && supportCode === null && (
          <>
            <h1 className={cn("font-bold text-2xl mt-5", dark ? "text-white" : "text-slate-900")}>{t("whats_app_onboard_page.please_wait")}</h1>
            <p className={cn("mt-3 text-sm leading-relaxed", dark ? "text-slate-400" : "text-slate-600")}>
              {t("whats_app_onboard_page.checking_number")}
            </p>
            <div className="mt-6 flex justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500" />
            </div>
          </>
        )}

        {supportCode && (
          <div className="space-y-4">
            <div className={cn("font-bold text-lg mt-5", dark ? "text-white" : "text-slate-900")}>
              {t("whats_app_onboard_page.signup_not_finished")}
            </div>
            <p className={cn("text-sm leading-relaxed", dark ? "text-slate-400" : "text-slate-600")}>
              {t("whats_app_onboard_page.support_code_description")}
            </p>
            <div className="space-y-3">
              <input
                type={showCode ? "text" : "password"}
                value={supportCode}
                readOnly
                className={cn(
                  "w-full h-11 px-4 rounded-lg border text-sm font-mono",
                  dark ? "bg-slate-950 border-slate-700 text-white" : "bg-white border-slate-300 text-slate-900",
                )}
              />
              <button
                onClick={() => setShowCode((s) => !s)}
                className="h-10 px-5 rounded-lg border text-[10px] font-black uppercase tracking-widest border-primary text-primary hover:bg-primary hover:text-white transition-all"
              >
                {showCode ? t("whats_app_onboard_page.hide_code") : t("whats_app_onboard_page.show_code")}
              </button>
            </div>
            <button
              onClick={() => redirectBack()}
              className={cn(
                "mt-4 text-[11px] font-bold uppercase tracking-widest",
                dark ? "text-slate-400 hover:text-white" : "text-slate-600 hover:text-slate-900",
              )}
            >
              {t("whats_app_onboard_page.back_to_settings")}
            </button>
          </div>
        )}

        {error && (
          <div className="space-y-4">
            <div className={cn("font-bold text-lg mt-5", dark ? "text-white" : "text-slate-900")}>
              {t("whats_app_onboard_page.signup_failed")}
            </div>
            <p className={cn("text-sm leading-relaxed", dark ? "text-slate-400" : "text-slate-600")}>{error}</p>
            <button
              onClick={() => redirectBack()}
              className="h-10 px-5 rounded-lg border text-[10px] font-black uppercase tracking-widest border-primary text-primary hover:bg-primary hover:text-white transition-all"
            >
              {t("whats_app_onboard_page.back_to_settings")}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
