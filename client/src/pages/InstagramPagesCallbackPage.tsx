import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Instagram, CheckCircle, XCircle, Loader2, Users } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";

interface AvailablePage {
  page_id: string;
  page_name: string;
  ig_user_id: string;
  name: string;
  username: string | null;
  followers_count: number;
  follows_count: number;
  media_count: number | null;
  account_type: string;
  access_token: string;
  long_token: string;
  already_connected: boolean;
}

export default function InstagramPagesCallbackPage() {
  const { t } = useTranslation();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [status, setStatus] = useState<"loading" | "pages" | "error">("loading");
  const [errorMsg, setErrorMsg] = useState("");
  const [pages, setPages] = useState<AvailablePage[]>([]);
  const [connecting, setConnecting] = useState<string | null>(null);

  useEffect(() => {
    // Facebook OAuth returns token in URL hash (not query params)
    const hash = window.location.hash.substring(1);
    const hashParams = new URLSearchParams(hash);
    const token = hashParams.get("access_token");
    const errorParam = hashParams.get("error");

    if (errorParam) {
      setStatus("error");
      setErrorMsg(hashParams.get("error_description") ?? errorParam);
      return;
    }

    if (!token) {
      setStatus("error");
      setErrorMsg(t("instagram_pages_callback_page.no_token_error"));
      return;
    }

    apiRequest("GET", `/api/instagram/available-pages?token=${encodeURIComponent(token)}`)
      .then((res) => res.json())
      .then((data: AvailablePage[]) => {
        setPages(data ?? []);
        setStatus("pages");
      })
      .catch((err) => {
        setStatus("error");
        setErrorMsg(err?.message ?? t("instagram_pages_callback_page.fetch_failed_error"));
      });
  }, []);

  async function connectPage(page: AvailablePage) {
    setConnecting(page.ig_user_id);
    try {
      await apiRequest("POST", "/api/instagram/connect-fb-page", {
        access_token: page.access_token,
        ig_user_id: page.ig_user_id,
        page_id: page.page_id,
        name: page.name,
        username: page.username,
        followers_count: page.followers_count,
        follows_count: page.follows_count,
        media_count: page.media_count,
        account_type: page.account_type,
        platform: "facebook",
      });
      setPages((prev) =>
        prev.map((p) => (p.ig_user_id === page.ig_user_id ? { ...p, already_connected: true } : p)),
      );
      toast({
        title: t("instagram_pages_callback_page.connected"),
        description: t("instagram_pages_callback_page.connected_toast_description", {
          name: page.name || page.username || t("instagram_pages_callback_page.default_account_name"),
        }),
      });
    } catch (err: any) {
      toast({
        title: t("instagram_pages_callback_page.error"),
        description: err?.message ?? t("instagram_pages_callback_page.connect_failed_error"),
        variant: "destructive",
      });
    } finally {
      setConnecting(null);
    }
  }

  const igGradient = "bg-gradient-to-tr from-yellow-400 via-pink-500 to-purple-600";

  return (
    <div className="min-h-screen bg-[#0f1829] flex items-center justify-center p-6">
      <div className="bg-slate-900 border border-slate-800 rounded-[2rem] p-8 max-w-lg w-full flex flex-col gap-6 shadow-xl">
        {/* Header */}
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-yellow-400 via-pink-500 to-purple-600 flex items-center justify-center shrink-0">
            <Instagram className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-[14px] font-black text-white uppercase tracking-widest">{t("instagram_pages_callback_page.title")}</h2>
            <p className="text-[11px] font-bold text-slate-500 mt-0.5 uppercase tracking-widest">{t("instagram_pages_callback_page.subtitle")}</p>
          </div>
        </div>

        {/* Loading */}
        {status === "loading" && (
          <div className="flex flex-col items-center gap-3 py-8">
            <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
            <p className="text-[12px] font-bold text-slate-400">{t("instagram_pages_callback_page.fetching")}</p>
          </div>
        )}

        {/* Error */}
        {status === "error" && (
          <div className="flex flex-col items-center gap-3 py-8">
            <XCircle className="w-8 h-8 text-rose-500" />
            <p className="text-[12px] font-bold text-rose-400">{errorMsg}</p>
            <button
              onClick={() => setLocation("/")}
              className="h-9 px-6 rounded-xl border border-slate-700 text-[10px] font-black uppercase tracking-widest text-slate-300 hover:border-primary/40 hover:text-primary transition-all"
            >
              {t("instagram_pages_callback_page.back_to_settings")}
            </button>
          </div>
        )}

        {/* Pages list */}
        {status === "pages" && (
          <>
            {pages.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-8 text-center">
                <Users className="w-8 h-8 text-slate-600" />
                <p className="text-[12px] font-bold text-slate-400">{t("instagram_pages_callback_page.no_accounts_found")}</p>
                <p className="text-[10px] text-slate-500">{t("instagram_pages_callback_page.no_accounts_hint")}</p>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-[11px] font-black uppercase tracking-widest text-slate-500">
                  {t("instagram_pages_callback_page.accounts_found", { count: pages.length })}
                </p>
                {pages.map((p) => (
                  <div
                    key={p.ig_user_id}
                    className="flex items-center gap-4 p-4 rounded-xl border border-slate-800 bg-slate-950/40"
                  >
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${igGradient}`}>
                      <Users className="w-4 h-4 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-black text-white truncate">{p.name || p.username || t("instagram_pages_callback_page.default_account_name")}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        {p.username && (
                          <span className="text-[10px] font-bold text-pink-400">@{p.username}</span>
                        )}
                        <span className="text-[10px] text-slate-500">{p.followers_count?.toLocaleString()} {t("instagram_pages_callback_page.followers")}</span>
                      </div>
                    </div>
                    {p.already_connected ? (
                      <div className="flex items-center gap-1.5 text-emerald-400 shrink-0">
                        <CheckCircle size={14} />
                        <span className="text-[10px] font-black uppercase tracking-widest">{t("instagram_pages_callback_page.connected")}</span>
                      </div>
                    ) : (
                      <button
                        onClick={() => connectPage(p)}
                        disabled={connecting === p.ig_user_id}
                        className="h-8 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-black uppercase tracking-widest transition-all shrink-0 flex items-center gap-1.5 disabled:opacity-60"
                      >
                        {connecting === p.ig_user_id ? <Loader2 size={11} className="animate-spin" /> : null}
                        {t("instagram_pages_callback_page.connect")}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}

            <button
              onClick={() => setLocation("/")}
              className="h-9 px-6 rounded-xl border border-slate-700 text-[10px] font-black uppercase tracking-widest text-slate-300 hover:border-primary/40 hover:text-primary transition-all self-end"
            >
              {t("instagram_pages_callback_page.back_to_settings")}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
