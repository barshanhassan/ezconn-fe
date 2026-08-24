import React from 'react';
import {
  ChevronLeft,
  Wallet,
  PhoneCall,
  Info,
  Lock,
  History,
  AlertCircle,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useTheme } from "@/contexts/ThemeContext";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from 'react-i18next';
import { apiRequest } from "@/lib/queryClient";
import { getUserInfo } from "@/lib/auth";
import { formatInWorkspaceTz, useAgencyTimezone } from "@/contexts/WorkspaceTimezoneContext";

interface AgencyVoiceWalletProps {
  workspace: any;
  onBack: () => void;
}

const AgencyVoiceWallet: React.FC<AgencyVoiceWalletProps> = ({ workspace, onBack }) => {
  const { t } = useTranslation();
  const { mode } = useTheme();
  const isDark = mode === 'dark';
  const workspaceTz = useAgencyTimezone();

  const userInfo = React.useMemo(() => {
    try { return getUserInfo(); } catch { return {} as any; }
  }, []);
  const agencyId = userInfo.modelable_id;

  const { data, isLoading } = useQuery({
    queryKey: [`/api/organizations/${agencyId}/workspaces/${workspace?.id}/voice-wallet`],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/organizations/${agencyId}/workspaces/${workspace.id}/voice-wallet`);
      return res.json();
    },
    enabled: !!agencyId && !!workspace?.id,
  });

  const balanceSeconds = data?.balance_seconds ?? 0;
  const transactions = data?.transactions ?? [];

  const minutes = Math.floor(balanceSeconds / 60).toString().padStart(2, '0');
  const seconds = Math.floor(balanceSeconds % 60).toString().padStart(2, '0');

  return (
    <div className={cn("p-6 font-sans transition-colors duration-300", isDark ? "text-white" : "text-slate-900")}>
      {/* Header */}
      <div className={cn("flex items-center justify-between mb-8 p-4 rounded-md border shadow-sm transition-colors",
        isDark ? "bg-[#1e293b] border-slate-700" : "bg-white border-slate-200")}>
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className={cn("p-2 rounded-full transition-colors", isDark ? "hover:bg-slate-700" : "hover:bg-slate-100")}
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <div className={cn("p-2 rounded", isDark ? "bg-[#334155]" : "bg-slate-100")}>
            <Wallet className={cn("w-6 h-6", isDark ? "text-white" : "text-primary")} />
          </div>
          <div>
            <h1 className="text-xl font-semibold">{t("agency.voiceWallet.title", { name: workspace?.name })}</h1>
            <p className="text-gray-400 text-sm">{t("agency.voiceWallet.desc")}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Balance Card */}
        <div className="lg:col-span-4">
          <Card className={cn("border transition-colors h-full", isDark ? "bg-[#1e293b] border-slate-700" : "bg-white border-slate-200")}>
            <CardHeader className="border-b border-slate-700/50 pb-4">
              <CardTitle className="text-lg font-semibold flex items-center gap-2">
                <PhoneCall className="w-5 h-5 text-primary" /> {t("agency.voiceWallet.balance.title")}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-8 flex flex-col items-center justify-center space-y-6">
              {isLoading ? (
                <div className="flex flex-col items-center gap-4 py-8">
                  <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
                  <p className="text-xs text-gray-500 animate-pulse">{t("agency.voiceWallet.balance.fetching")}</p>
                </div>
              ) : (
                <>
                  <div className="flex items-baseline gap-4">
                    <div className="text-center">
                      <span className="text-5xl font-bold">{minutes}</span>
                      <p className="text-xs text-gray-500 font-bold uppercase tracking-widest mt-1">{t("agency.voiceWallet.balance.minutes")}</p>
                    </div>
                    <span className="text-4xl text-gray-600">:</span>
                    <div className="text-center">
                      <span className="text-5xl font-bold">{seconds}</span>
                      <p className="text-xs text-gray-500 font-bold uppercase tracking-widest mt-1">{t("agency.voiceWallet.balance.seconds")}</p>
                    </div>
                  </div>

                  <div className={cn("px-6 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider border",
                    isDark ? "bg-primary/10 text-primary border-primary/20" : "bg-primary/5 text-primary border-primary/10")}>
                    {t("agency.voiceWallet.balance.available")}
                  </div>

                  <div className="flex items-start gap-2 p-4 rounded-lg bg-yellow-500/5 border border-yellow-500/10 text-[11px] text-gray-400 leading-relaxed">
                    <Info className="w-4 h-4 text-yellow-500 shrink-0" />
                    <p>{t("agency.voiceWallet.balance.info")}</p>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right column: locked top-up + real transaction history */}
        <div className="lg:col-span-8 space-y-6">
          <Card className={cn("border transition-colors", isDark ? "bg-[#1e293b] border-slate-700" : "bg-white border-slate-200")}>
            <CardContent className="p-8 flex items-center gap-4">
              <div className={cn("p-3 rounded-full", isDark ? "bg-slate-800" : "bg-slate-100")}>
                <Lock className="w-5 h-5 text-slate-400" />
              </div>
              <div>
                <p className="font-bold text-sm">Top-up unavailable</p>
                <p className="text-xs text-gray-500 mt-0.5">Buying voice credits isn't set up yet — no per-minute pricing or payment flow has been configured for this yet.</p>
              </div>
            </CardContent>
          </Card>

          <Card className={cn("border transition-colors", isDark ? "bg-[#1e293b] border-slate-700" : "bg-white border-slate-200")}>
            <CardHeader className="border-b border-slate-700/50 pb-4">
              <CardTitle className="text-lg font-semibold flex items-center gap-2">
                <History className="w-5 h-5 text-gray-400" /> Transaction History
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="p-8 text-center text-sm text-gray-500">Loading…</div>
              ) : transactions.length === 0 ? (
                <div className="p-8 text-center space-y-2">
                  <AlertCircle className="w-8 h-8 text-gray-600 mx-auto" />
                  <p className="text-sm text-gray-500 font-medium">No voice wallet activity yet</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-700/50">
                  {transactions.map((tx: any) => (
                    <div key={tx.id} className="px-6 py-3 flex items-center justify-between hover:bg-slate-800/10 transition-colors">
                      <div>
                        <p className="text-sm font-semibold">{tx.description === 'PURCHASE' ? 'Purchase' : 'Spent'}</p>
                        <p className="text-xs text-gray-500">{tx.created_at ? formatInWorkspaceTz(tx.created_at, 'MMM d, yyyy p', workspaceTz) : ''}</p>
                      </div>
                      <div className="text-right">
                        <p className={cn("text-sm font-bold", tx.type === 'credit' ? "text-emerald-500" : "text-rose-500")}>
                          {tx.type === 'credit' ? '+' : '-'}{Math.abs(tx.seconds)}s
                        </p>
                        <p className="text-xs text-gray-500">Balance: {tx.balance_after}s</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default AgencyVoiceWallet;
