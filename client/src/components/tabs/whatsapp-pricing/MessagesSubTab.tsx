import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useTheme } from "@/contexts/ThemeContext";
import { useDateRange } from "@/contexts/DateRangeContext";
import { cn } from "@/lib/utils";
import { Mail, Truck, Gift, CreditCard, DollarSign } from "lucide-react";
import { useTranslation } from "react-i18next";

const LINES = [
  { key: "marketing", labelKey: "marketing", stroke: "#22c55e" },
  { key: "marketingLite", labelKey: "marketing_lite", stroke: "#3b82f6" },
  { key: "utility", labelKey: "utility", stroke: "#f59e0b" },
  { key: "authentication", labelKey: "authentication", stroke: "#8b5cf6" },
  { key: "authenticationIntl", labelKey: "auth_intl", stroke: "#ec4899" },
  { key: "service", labelKey: "service", stroke: "#6366f1" },
];
const LINES_FREE = [
  { key: "freeEntryPoint", labelKey: "free_entry_point", stroke: "#94a3b8" },
  { key: "freeCustomerService", labelKey: "free_customer_service", stroke: "#22c55e" },
];
const LINES_PAID = LINES.filter(l => l.key !== "service");

export default function MessagesSubTab() {
  const { t } = useTranslation();
  const lbl = (labelKey: string) => t(`messages_sub_tab.labels.${labelKey}`);
  const { from, to } = useDateRange().rangeFor("whatsapp");
  // Real WhatsApp Messages analytics. Backend aggregates wa_messages joined
  // with wa_templates.category, applies the Meta pricing matrix in
  // statistics.service for approximate $ charges.
  const { data } = useQuery<any>({
    queryKey: ["/api/statistics/whatsapp-messages", from, to],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/statistics/whatsapp-messages?from=${from}&to=${to}`);
      return res.json();
    },
    refetchInterval: 300_000,
  });

  const k = data?.kpi ?? {};

  const { mode } = useTheme();
  const dark = mode === "dark";
  const card = dark ? "bg-[#0f1829] border-slate-800" : "bg-white border-slate-200";
  const text = dark ? "text-white" : "text-slate-900";
  const sub = dark ? "text-slate-400" : "text-slate-500";
  const grid = dark ? "#1e293b" : "#f1f5f9";
  const axis = dark ? "#64748b" : "#94a3b8";
  const tip = dark ? "bg-[#0f1829] border-slate-700 text-white" : "bg-white border-slate-200 text-slate-800";

  const ChartTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
      <div className={cn("px-3 py-2 rounded-xl border shadow-2xl text-[11px]", tip)}>
        <p className="font-semibold mb-1 opacity-60">{label}</p>
        {payload.map((e: any, i: number) => (
          <div key={i} className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full" style={{ background: e.stroke || e.color }} />
            <span className="opacity-70">{e.name}:</span>
            <span className="font-bold">{e.value}</span>
          </div>
        ))}
      </div>
    );
  };

  const kpi = {
    allMessages: [
      { l: t("messages_sub_tab.labels.message_sent"), v: k.allMessages?.messageSent ?? 0 },
      { l: t("messages_sub_tab.labels.message_delivered"), v: k.allMessages?.messageDelivered ?? 0 },
      { l: t("messages_sub_tab.labels.message_received"), v: k.allMessages?.messageReceived ?? 0 },
    ],
    allDeliv: [
      { l: lbl("marketing"), v: k.allDeliveries?.marketing ?? 0 },
      { l: lbl("marketing_lite"), v: k.allDeliveries?.marketingLite ?? 0 },
      { l: lbl("utility"), v: k.allDeliveries?.utility ?? 0 },
      { l: lbl("authentication"), v: k.allDeliveries?.authentication ?? 0 },
      { l: t("messages_sub_tab.labels.auth_intl"), v: k.allDeliveries?.authIntl ?? 0 },
      { l: lbl("service"), v: k.allDeliveries?.service ?? 0 },
    ],
    freeDeliv: [
      { l: lbl("free_customer_service"), v: k.freeDeliveries?.freeCustomerService ?? 0 },
      { l: lbl("free_entry_point"), v: k.freeDeliveries?.freeEntryPoint ?? 0 },
    ],
    paidDeliv: [
      { l: lbl("marketing"), v: k.paidDeliveries?.marketing ?? 0 },
      { l: lbl("marketing_lite"), v: k.paidDeliveries?.marketingLite ?? 0 },
      { l: lbl("utility"), v: k.paidDeliveries?.utility ?? 0 },
      { l: lbl("authentication"), v: k.paidDeliveries?.authentication ?? 0 },
      { l: t("messages_sub_tab.labels.auth_intl"), v: k.paidDeliveries?.authIntl ?? 0 },
    ],
    approxCharge: [
      { l: lbl("marketing"), v: k.approxCharges?.marketing ?? "$0" },
      { l: lbl("marketing_lite"), v: k.approxCharges?.marketingLite ?? "$0" },
      { l: lbl("utility"), v: k.approxCharges?.utility ?? "$0" },
      { l: lbl("authentication"), v: k.approxCharges?.authentication ?? "$0" },
      { l: t("messages_sub_tab.labels.auth_intl"), v: k.approxCharges?.authIntl ?? "$0" },
    ],
  };

  const kpiCards = [
    { title: t("messages_sub_tab.all_messages"), icon: <Mail size={14} className="text-primary" />, rows: kpi.allMessages },
    { title: t("messages_sub_tab.all_deliveries"), icon: <Truck size={14} className="text-primary" />, rows: kpi.allDeliv },
    { title: t("messages_sub_tab.free_deliveries"), icon: <Gift size={14} className="text-primary" />, rows: kpi.freeDeliv },
    { title: t("messages_sub_tab.paid_deliveries"), icon: <CreditCard size={14} className="text-primary" />, rows: kpi.paidDeliv },
    { title: t("messages_sub_tab.approximate_charges"), icon: <DollarSign size={14} className="text-primary" />, rows: kpi.approxCharge },
  ];

  // Real chart series from backend (zero-filled for fresh workspaces so the
  // Recharts renderer still draws the axes/legend with a stable baseline).
  const allDelData: Array<any> = data?.allDeliveriesTrend ?? [];
  const freeData: Array<any> = data?.freeDeliveriesTrend ?? [];
  const paidData: Array<any> = data?.paidDeliveriesTrend ?? [];
  const chargesData: Array<any> = data?.chargesTrend ?? [];

  const charts = [
    { title: t("messages_sub_tab.all_deliveries"), data: allDelData, lines: LINES },
    { title: t("messages_sub_tab.free_deliveries"), data: freeData, lines: LINES_FREE },
    { title: t("messages_sub_tab.paid_deliveries"), data: paidData, lines: LINES_PAID },
    { title: t("messages_sub_tab.approximate_charges"), data: chargesData, lines: LINES_PAID },
  ];

  return (
    <div className="space-y-5">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        {kpiCards.map((kpi, i) => (
          <div key={i} className={cn("rounded-2xl border p-5 transition-all duration-300 hover:shadow-xl hover:-translate-y-1", card, dark ? "hover:border-primary/30" : "hover:border-primary/20")}>
            <div className="flex items-center gap-2.5 mb-4">
              <div className={cn("p-2 rounded-xl", dark ? "bg-primary/15" : "bg-primary/10")}>{kpi.icon}</div>
              <h3 className={cn("text-[13px] font-bold", text)}>{kpi.title}</h3>
            </div>
            <div className="space-y-2">
              {kpi.rows.map((r: any, ri: number) => (
                <div key={ri} className="flex justify-between items-center">
                  <span className={cn("text-[11px]", sub)}>{r.l}</span>
                  <span className={cn("text-[13px] font-bold tabular-nums", text)}>{r.v}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Charts — paired 2-up, matching the Daily/Monthly Active Users layout. */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {charts.map((ch, i) => (
          <div key={i} className={cn("rounded-2xl border p-5 transition-all duration-300 hover:shadow-xl", card)}>
            <h3 className={cn("text-[13px] font-bold mb-1", text)}>{ch.title}</h3>
            <p className={cn("text-[11px] mb-4", sub)}>{t("messages_sub_tab.trend_over_time")}</p>
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={ch.data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={grid} />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: axis }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: axis }} axisLine={false} tickLine={false} />
                <Tooltip content={<ChartTooltip />} cursor={{ stroke: "#6366f1", strokeWidth: 1, strokeDasharray: "4 4" }} />
                <Legend wrapperStyle={{ fontSize: "11px", paddingTop: "12px" }} iconType="circle" />
                {ch.lines.map(l => <Line key={l.key} type="monotone" dataKey={l.key} stroke={l.stroke} strokeWidth={2.5} dot={false} name={lbl(l.labelKey)} activeDot={{ r: 4, fill: l.stroke, strokeWidth: 0 }} />)}
              </LineChart>
            </ResponsiveContainer>
          </div>
        ))}
      </div>
    </div>
  );
}
