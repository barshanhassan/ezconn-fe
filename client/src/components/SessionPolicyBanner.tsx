import { useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { useTranslation } from "react-i18next";
import { apiRequest } from "@/lib/queryClient";
import { getUserInfo } from "@/lib/auth";

/**
 * "Your session ends in N minutes" warning for agents whose account has a login
 * policy (Manage Users → agent → Login policy).
 *
 * This is the counterpart to replyagent's `ForceUserLogoutNotification`, which
 * its 15-minute cron pushes over a websocket before `LogoutUserJob` revokes the
 * agent's token. We have no such cron — the window is enforced on every API call
 * in the backend's JWT guard — so this poll serves both purposes:
 *   - inside the window: surfaces the countdown once it's within the warning
 *     threshold the backend reports;
 *   - once the window closes: the poll itself 401s, and the global API error
 *     handler clears the session and redirects to /login with the reason. That
 *     also means an idle agent gets signed out within one poll interval instead
 *     of lingering until their next click.
 */
const POLL_MS = 60_000;

export default function SessionPolicyBanner() {
  const { t } = useTranslation();
  const [info, setInfo] = useState<{ minutes: number; window: string | null } | null>(null);

  useEffect(() => {
    let cancelled = false;

    const check = async () => {
      if (!localStorage.getItem("auth_token")) {
        if (!cancelled) setInfo(null);
        return;
      }
      // Only workspace agents can have a login policy — never spend a request
      // per minute on agency users.
      if (String(getUserInfo().modelable_type ?? "").toLowerCase().includes("agency")) {
        return;
      }

      try {
        const res = await apiRequest("GET", "/api/auth/session-policy");
        const data = await res.json();
        if (cancelled) return;
        setInfo(
          data?.warn
            ? { minutes: Number(data.minutes_remaining ?? 0), window: data.window ?? null }
            : null,
        );
      } catch {
        // A 401 means the window just closed — the global handler has already
        // cleared the token and is redirecting. Any other failure (offline, 500)
        // must not break the app; drop the banner and retry on the next tick.
        if (!cancelled) setInfo(null);
      }
    };

    void check();
    const timer = setInterval(() => void check(), POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  if (!info) return null;

  return (
    <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-[200] max-w-[92vw]">
      <div className="flex items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 shadow-lg dark:border-amber-700 dark:bg-amber-950">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
        <div className="text-sm">
          <div className="font-semibold text-amber-900 dark:text-amber-200">
            {t("session_policy.warning_title", { minutes: Math.max(0, info.minutes) })}
          </div>
          <div className="text-amber-800 dark:text-amber-300">
            {info.window
              ? t("session_policy.warning_body_window", { window: info.window })
              : t("session_policy.warning_body")}
          </div>
        </div>
      </div>
    </div>
  );
}
