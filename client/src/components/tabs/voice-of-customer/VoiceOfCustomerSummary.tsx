import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useTheme } from "@/contexts/ThemeContext";
import { useDateRange } from "@/contexts/DateRangeContext";
import { cn } from "@/lib/utils";
import { Smile, Meh, Frown, TrendingUp } from "lucide-react";
import { useTranslation } from "react-i18next";

export default function VoiceOfCustomerSummary() {
  const { t } = useTranslation();
  const { from, to } = useDateRange().rangeFor("voice");
  // Real sentiment summary — backend classifies recent incoming messages
  // via keyword matching. No new tables, no NLP API, accuracy approximate
  // but data-driven instead of mocked.
  const { data } = useQuery<any>({
    queryKey: ["/api/statistics/sentiment-summary", from, to],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/statistics/sentiment-summary?from=${from}&to=${to}`);
      return res.json();
    },
    refetchInterval: 300_000,
  });

  const { mode } = useTheme();
  const dark = mode === "dark";

  const card    = dark ? "bg-[#0f1829] border-slate-800" : "bg-white border-slate-200";
  const text    = dark ? "text-white"     : "text-slate-900";
  const sub     = dark ? "text-slate-400" : "text-slate-500";
  const grid    = dark ? "#1e293b" : "#f1f5f9";
  const axis    = dark ? "#64748b" : "#94a3b8";
  const tooltip = dark ? "bg-[#0f1829] border-slate-700 text-white" : "bg-white border-slate-200 text-slate-800";

  const sentimentScore = data?.sentimentScore ?? 0;
  const totalConversations = data?.totalConversations ?? 0;
  const dist = data?.sentimentDistribution ?? { positive: 0, neutral: 0, negative: 0 };
  const sentimentDistribution = [
    { name: t("voice_of_customer_summary.positive"), percentage: dist.positive ?? 0, color: "bg-emerald-500", icon: <Smile size={14} className="text-emerald-500" /> },
    { name: t("voice_of_customer_summary.neutral"),  percentage: dist.neutral ?? 0, color: "bg-orange-500",  icon: <Meh size={14} className="text-orange-500" /> },
    { name: t("voice_of_customer_summary.negative"), percentage: dist.negative ?? 0, color: "bg-rose-500",    icon: <Frown size={14} className="text-rose-500" /> },
  ];
  const sentimentTrendData: Array<{ date: string; positive: number; neutral: number; negative: number }> = data?.sentimentTrendData ?? [];

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
      <div className={cn("px-3 py-2 rounded-xl border shadow-2xl text-[11px]", tooltip)}>
        <p className="font-semibold mb-1 opacity-60">{label}</p>
        {payload.map((e: any, i: number) => (
          <div key={i} className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full" style={{ background: e.color || e.stroke || e.fill }} />
            <span className="opacity-70">{e.name}:</span>
            <span className="font-bold">{e.value}</span>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Sentiment Score Card */}
        <div className={cn("rounded-2xl border p-6 transition-all duration-300 hover:shadow-xl", card)}>
          <div className="flex items-center gap-2.5 mb-6">
            <div className={cn("p-2 rounded-xl", dark ? "bg-primary/15" : "bg-primary/10")}>
              <TrendingUp size={16} className="text-primary" />
            </div>
            <h3 className={cn("text-[13px] font-bold", text)}>{t("voice_of_customer_summary.sentiment_score")}</h3>
          </div>
          <div className="space-y-1">
            <div className={cn("text-4xl font-black tabular-nums", text)}>{sentimentScore}%</div>
            <p className={cn("text-[11px] font-medium opacity-60", sub)}>{t("voice_of_customer_summary.total_conversations", { count: totalConversations.toLocaleString() })}</p>
          </div>
        </div>

        {/* Sentiment Distribution Card */}
        <div className={cn("rounded-2xl border p-6 transition-all duration-300 hover:shadow-xl lg:col-span-3", card)}>
          <h3 className={cn("text-[13px] font-bold mb-6", text)}>{t("voice_of_customer_summary.sentiment_distribution")}</h3>
          <div className="grid grid-cols-1 gap-6">
            {sentimentDistribution.map((item) => (
              <div key={item.name} className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {item.icon}
                    <span className={cn("text-[11px] font-bold opacity-60", sub)}>{item.name}</span>
                  </div>
                  <span className={cn("text-[11px] font-black", text)}>{item.percentage}%</span>
                </div>
                <div className={cn("w-full rounded-full h-2", dark ? "bg-slate-800" : "bg-slate-100")}>
                  <div
                    className={cn("h-2 rounded-full transition-all duration-1000", item.color)}
                    style={{ width: `${item.percentage}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Sentiment Trend Analysis */}
      <div className={cn("rounded-2xl border p-5 transition-all duration-300 hover:shadow-xl", card)}>
        <h3 className={cn("text-[13px] font-bold mb-1", text)}>{t("voice_of_customer_summary.sentiment_trend_analysis")}</h3>
        <p className={cn("text-[11px] mb-6", sub)}>{t("voice_of_customer_summary.trend_subtitle")}</p>
        <ResponsiveContainer width="100%" height={320}>
          <LineChart data={sentimentTrendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={grid} vertical={false} />
            <XAxis dataKey="date" tick={{ fontSize: 10, fill: axis }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 10, fill: axis }} axisLine={false} tickLine={false} />
            <Tooltip content={<CustomTooltip />} cursor={{ stroke: "#6366f1", strokeWidth: 1, strokeDasharray: "4 4" }} />
            <Legend wrapperStyle={{ fontSize: "11px", paddingTop: "12px" }} iconType="circle" />
            <Line type="monotone" dataKey="positive" stroke="#22c55e" strokeWidth={2.5} dot={false} name={t("voice_of_customer_summary.positive_sentiment")} activeDot={{ r: 4, fill: "#22c55e", strokeWidth: 0 }} />
            <Line type="monotone" dataKey="neutral"  stroke="#f97316" strokeWidth={2.5} dot={false} name={t("voice_of_customer_summary.neutral_sentiment")} activeDot={{ r: 4, fill: "#f97316", strokeWidth: 0 }} />
            <Line type="monotone" dataKey="negative" stroke="#ef4444" strokeWidth={2.5} dot={false} name={t("voice_of_customer_summary.negative_sentiment")} activeDot={{ r: 4, fill: "#ef4444", strokeWidth: 0 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
