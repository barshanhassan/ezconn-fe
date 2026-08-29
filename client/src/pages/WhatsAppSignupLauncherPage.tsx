import { useEffect, useRef, useState } from "react";
import { useTheme } from "@/contexts/ThemeContext";
import { cn } from "@/lib/utils";
import { loadFacebookSdk, launchEmbeddedSignup } from "@/lib/metaEmbeddedSignup";
import { useTranslation } from "react-i18next";

/**
 * Self-hosted WhatsApp Embedded Signup launcher — replyagent parity.
 *
 * replyagent redirects the browser to an external "metaconnect" service
 * (`VITE_FB_DOMAIN`, e.g. stagemetaconnect.com) at:
 *   - `/coexistence?r=<returnUrl>`  → WhatsApp Business App (Coexistence)
 *   - `/whatsapp?r=<returnUrl>`     → standard Cloud / Business API
 * That service runs the Meta `FB.login` dialog, then redirects the browser to
 * `<returnUrl>#c=<code>&w=<waba_id>&p=<phone_number_id>&b=<business_id>&u=<user_id>&s=<source>`.
 *
 * EZCONN self-hosts that service on its own origin: this page IS mounted at
 * `/coexistence` and `/whatsapp`, so no third-party domain is required. Set
 * `VITE_FB_DOMAIN` to point the launch URLs at a real external metaconnect to
 * match replyagent exactly.
 *
 * Browsers only allow `FB.login`'s popup from a genuine user gesture (a page
 * that auto-opens a popup on load is blocked), so — like a hosted metaconnect
 * — we show a "Continue" button that triggers the dialog on click.
 */
export default function WhatsAppSignupLauncherPage() {
  const { t } = useTranslation();
  const { mode } = useTheme();
  const dark = mode === "dark";

  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Derived once from the URL — `/coexistence` = Coexistence (source "aka"),
  // anything else = standard Business API (source "api").
  const coexRef = useRef(/coexistence/i.test(window.location.pathname));
  const sourceRef = useRef<"aka" | "api">(coexRef.current ? "aka" : "api");
  const returnUrlRef = useRef<string>(
    new URLSearchParams(window.location.search).get("r") ||
      `${window.location.origin}/settings/whatsapp-onboard`,
  );

  const appId = import.meta.env.VITE_META_APP_ID as string | undefined;
  const configId = import.meta.env.VITE_META_ES_CONFIG_ID as string | undefined;
  const graphVersion = (import.meta.env.VITE_META_GRAPH_VERSION as string | undefined) ?? "v22.0";

  useEffect(() => {
    if (!appId || !configId) {
      setError(t("whatsapp_signup_launcher_page.missing_config"));
      return;
    }
    // Warm up the SDK so the dialog opens instantly on the first click.
    loadFacebookSdk(appId, graphVersion).catch(() => {
      /* surfaced on click */
    });
  }, [appId, configId, graphVersion]);

  // Full navigation to the onboard return page (mirrors the metaconnect
  // `r#…` redirect); the onboard page parses the hash and POSTs to the backend.
  const redirectToReturn = (hash: string) => {
    window.location.href = `${returnUrlRef.current}${hash}`;
  };

  const handleContinue = async () => {
    if (!appId || !configId) return;
    setError(null);
    setBusy(true);
    try {
      await loadFacebookSdk(appId, graphVersion);
      const d = await launchEmbeddedSignup(configId, coexRef.current);
      const parts: string[] = [`c=${encodeURIComponent(d.code)}`];
      if (d.waba_id) parts.push(`w=${encodeURIComponent(d.waba_id)}`);
      if (d.phone_number_id) parts.push(`p=${encodeURIComponent(d.phone_number_id)}`);
      if (d.business_id) parts.push(`b=${encodeURIComponent(d.business_id)}`);
      if (d.user_id) parts.push(`u=${encodeURIComponent(d.user_id)}`);
      parts.push(`s=${sourceRef.current}`);
      redirectToReturn(`#${parts.join("&")}`);
    } catch (err: any) {
      if (err?.code === "USER_CANCELLED") {
        // Bounce back with just the source so the onboard page returns to the
        // right tab and shows the "cancelled" notice.
        redirectToReturn(`#s=${sourceRef.current}`);
        return;
      }
      setError(err?.message ?? t("whatsapp_signup_launcher_page.launch_error"));
      setBusy(false);
    }
  };

  return (
    <div className={cn("min-h-screen flex items-center justify-center px-4", dark ? "bg-slate-950" : "bg-white")}>
      <div className="max-w-2xl w-full text-center flex flex-col items-center">
        {/* WhatsApp icon */}
        <svg width="88" height="88" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="mx-auto">
          <path
            d="M24 12C24 18.6274 18.6274 24 12 24C5.37258 24 0 18.6274 0 12C0 5.37258 5.37258 0 12 0C18.6274 0 24 5.37258 24 12Z"
            fill="url(#waLaunchGrad)"
          />
          <path
            fillRule="evenodd"
            clipRule="evenodd"
            d="M5 11.5065C5 7.91278 8.11522 5 11.958 5C15.8008 5 18.916 7.91278 18.916 11.5065C18.916 15.1003 15.8008 18.0131 11.958 18.0131C11.2635 18.0131 10.5926 17.9179 9.9597 17.7405L7.58508 19.0578V16.5675C6.00817 15.3749 5 13.5509 5 11.5065ZM15.7569 12.9568C15.7548 12.9336 15.7529 12.9136 15.7521 12.897C15.7441 12.7389 15.6021 12.7147 15.6021 12.7147C15.6021 12.7147 14.4386 12.1511 14.1994 12.0415C13.9605 11.932 13.8388 12.1107 13.8388 12.1107C13.8388 12.1107 13.486 12.5566 13.3724 12.7024C13.363 12.7145 13.354 12.7264 13.3452 12.7381C13.2468 12.8683 13.1697 12.9702 12.8982 12.8808C12.6022 12.7834 12.0087 12.4639 11.5237 12.0294C11.0391 11.595 10.6684 11.0201 10.5632 10.8458C10.4578 10.6712 10.5794 10.562 10.5794 10.562C10.5794 10.562 10.8864 10.2082 11.0333 10.0187C11.1771 9.83334 11.0925 9.62678 11.0559 9.5377C11.0551 9.53575 11.0536 9.53202 11.0536 9.53202C11.0186 9.44684 10.5468 8.3386 10.4779 8.18234C10.4092 8.02594 10.2592 8 10.2592 8H9.69973C9.59967 8 9.40786 8.12164 9.40786 8.12164C8.83294 8.48961 8.73552 9.34836 8.71867 9.53373C8.70182 9.71909 8.68497 10.1125 8.98829 10.7753C9.29161 11.4379 10.0331 12.3368 10.9488 13.1908C11.8315 14.0141 13.1685 14.385 13.6436 14.5168C13.6612 14.5217 13.6776 14.5263 13.6928 14.5305C14.1175 14.6491 15.0143 14.4385 15.4359 13.9831C15.8133 13.5759 15.7749 13.1541 15.7569 12.9568Z"
            fill="white"
          />
          <defs>
            <linearGradient id="waLaunchGrad" x1="12" y1="32" x2="-4.5" y2="0" gradientUnits="userSpaceOnUse">
              <stop stopColor="#1EBF5A" />
              <stop offset="0.922652" stopColor="#2CE979" />
            </linearGradient>
          </defs>
        </svg>

        {error ? (
          <>
            <h1 className={cn("mt-8 font-bold text-3xl", dark ? "text-white" : "text-slate-900")}>
              {t("whatsapp_signup_launcher_page.could_not_start")}
            </h1>
            <p className={cn("mt-4 text-base leading-normal max-w-lg", dark ? "text-slate-400" : "text-slate-600")}>
              {error}
            </p>
          </>
        ) : (
          <>
            <h1 className={cn("mt-8 font-bold text-4xl md:text-5xl", dark ? "text-white" : "text-slate-900")}>
              {coexRef.current ? t("whatsapp_signup_launcher_page.connect_business_app") : t("whatsapp_signup_launcher_page.connect_business_account")}
            </h1>
            <p className={cn("mt-4 text-base", dark ? "text-slate-400" : "text-slate-500")}>
              {t("whatsapp_signup_launcher_page.follow_instructions")}
            </p>
            <p className={cn("mt-8 text-lg leading-relaxed max-w-xl", dark ? "text-slate-300" : "text-slate-700")}>
              {t("whatsapp_signup_launcher_page.permissions_note")}
            </p>
          </>
        )}

        <button
          onClick={handleContinue}
          disabled={busy || !!error}
          className={cn(
            "mt-8 px-8 h-12 rounded-lg text-base font-bold text-white transition-all disabled:opacity-60",
            "bg-[#1EBF5A] hover:bg-[#17a34c]",
          )}
        >
          {busy ? t("whatsapp_signup_launcher_page.waiting_for_facebook") : t("whatsapp_signup_launcher_page.continue_with_facebook")}
        </button>

        <button
          onClick={() => (window.location.href = `${window.location.origin}/settings?tab=WhatsApp`)}
          className={cn("mt-5 text-sm font-medium", dark ? "text-slate-400 hover:text-white" : "text-slate-600 hover:text-slate-900")}
        >
          {t("whatsapp_signup_launcher_page.cancel")}
        </button>
      </div>
    </div>
  );
}
