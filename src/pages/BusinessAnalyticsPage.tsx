import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  BarChart3, AlertTriangle, TrendingUp, ShieldAlert, ArrowRight,
} from "lucide-react";
import { Card, LoadingState, EmptyState, useCountUp } from "@/components/ui/shared";
import { usePageHeader } from "@/lib/page-header-context";
import {
  subscribeInvoices, subscribeExpenses, subscribeBills, subscribeSubscriptions,
  subscribeMaintenanceItems,
} from "@/lib/db";
import { cn, formatCurrency, formatDate, toJsDate } from "@/lib/utils";
import type { Invoice, Expense, Bill, Subscription, MaintenanceItem, BillingCycle } from "@/types";

function monthlyEquivalent(amount: number, cycle: BillingCycle): number {
  switch (cycle) {
    case "Weekly":    return amount * 4.345;
    case "Monthly":   return amount;
    case "Quarterly": return amount / 3;
    case "Yearly":    return amount / 12;
  }
}

function inThisMonth(d: Date | null): boolean {
  if (!d) return false;
  const now = new Date();
  return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
}

function monthKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

interface Alert {
  severity: "red" | "amber";
  title: string;
  description: string;
  to: string;
}

function AnimatedCurrency({ value }: { value: number }) {
  return <>{formatCurrency(useCountUp(value))}</>;
}

function AnimatedMonths({ value }: { value: number }) {
  return <>{useCountUp(value).toFixed(1)} months</>;
}

// ── Chart primitives ──────────────────────────────────────────────────────────

function KpiTile({ label, value, delta, positiveIsGood = true }: {
  label: string; value: number; delta: number | null; positiveIsGood?: boolean;
}) {
  const isUp = (delta ?? 0) >= 0;
  const good = positiveIsGood ? isUp : !isUp;
  return (
    <div className="bg-white rounded-2xl border border-neutral-200/80 shadow-sm p-4 transition-all duration-300 hover:shadow-md hover:-translate-y-0.5">
      <p className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wide">{label}</p>
      <p className="text-xl font-bold text-black mt-1 tabular-nums"><AnimatedCurrency value={value} /></p>
      {delta !== null && Number.isFinite(delta) && (
        <p className={cn("text-xs font-semibold mt-1", good ? "text-emerald-600" : "text-red-600")}>
          {isUp ? "▲" : "▼"} {Math.abs(delta).toFixed(1)}% vs last month
        </p>
      )}
    </div>
  );
}

function nearestIndex(e: React.MouseEvent<SVGRectElement>, width: number, padX: number, stepX: number, count: number): number {
  const rect = e.currentTarget.getBoundingClientRect();
  const relX = ((e.clientX - rect.left) / rect.width) * width;
  const idx = Math.round((relX - padX) / (stepX || 1));
  return Math.max(0, Math.min(count - 1, idx));
}

function TrendChart({ data }: { data: { label: string; revenue: number; burn: number }[] }) {
  const [hover, setHover] = useState<number | null>(null);
  if (data.length === 0) return <EmptyState icon={TrendingUp} label="Not enough data yet" />;
  const width = 560, height = 200, padX = 24, padY = 20;
  const max = Math.max(1, ...data.map((d) => Math.max(d.revenue, d.burn)));
  const stepX = data.length > 1 ? (width - padX * 2) / (data.length - 1) : 0;
  const scaleY = (v: number) => height - padY - (v / max) * (height - padY * 2);
  const revPts = data.map((d, i) => ({ x: padX + i * stepX, y: scaleY(d.revenue) }));
  const burnPts = data.map((d, i) => ({ x: padX + i * stepX, y: scaleY(d.burn) }));
  const pathFor = (pts: { x: number; y: number }[]) => pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
  const revArea = `${pathFor(revPts)} L ${revPts[revPts.length - 1].x.toFixed(1)} ${height - padY} L ${padX} ${height - padY} Z`;
  const tooltipLeftPct = hover !== null ? (revPts[hover].x / width) * 100 : 0;

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-48" onMouseLeave={() => setHover(null)}>
        <path d={revArea} fill="#10b981" opacity={0.08} />
        <path d={pathFor(revPts)} fill="none" stroke="#10b981" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
        <path d={pathFor(burnPts)} fill="none" stroke="#f59e0b" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" strokeDasharray="5 4" />
        {hover !== null && (
          <>
            <line x1={revPts[hover].x} y1={padY} x2={revPts[hover].x} y2={height - padY} stroke="#cbd5e1" strokeWidth={1} strokeDasharray="3 3" />
            <circle cx={revPts[hover].x} cy={revPts[hover].y} r={5} fill="#10b981" stroke="white" strokeWidth={2} />
            <circle cx={burnPts[hover].x} cy={burnPts[hover].y} r={5} fill="#f59e0b" stroke="white" strokeWidth={2} />
          </>
        )}
        <rect
          x={0} y={0} width={width} height={height} fill="transparent"
          onMouseMove={(e) => setHover(nearestIndex(e, width, padX, stepX, data.length))}
          style={{ cursor: "crosshair" }}
        />
      </svg>
      {hover !== null && (
        <div
          className="absolute bg-neutral-900 text-white text-xs rounded-lg px-3 py-2 pointer-events-none shadow-lg z-10 whitespace-nowrap"
          style={{ left: `${tooltipLeftPct}%`, top: 0, transform: "translate(-50%, -8px)" }}
        >
          <p className="font-semibold mb-0.5">{data[hover].label}</p>
          <p className="text-emerald-300">Revenue: {formatCurrency(data[hover].revenue)}</p>
          <p className="text-amber-300">Burn: {formatCurrency(data[hover].burn)}</p>
        </div>
      )}
      <div className="flex justify-between px-1 mt-1">
        {data.map((d, i) => <span key={i} className={cn("text-[10px] text-neutral-400", hover === i && "text-black font-semibold")}>{d.label}</span>)}
      </div>
      <div className="flex items-center gap-4 mt-2 justify-center text-xs text-neutral-600">
        <span className="flex items-center gap-1.5"><span className="w-3 h-[2px] bg-emerald-500 inline-block rounded-full" /> Revenue</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-[2px] bg-amber-500 inline-block rounded-full" style={{ borderTop: "2px dashed #f59e0b" }} /> Burn</span>
      </div>
    </div>
  );
}

function CashTrendChart({ data }: { data: { label: string; cumulative: number }[] }) {
  const [hover, setHover] = useState<number | null>(null);
  if (data.length === 0) return <EmptyState icon={TrendingUp} label="Not enough data yet" />;
  const width = 560, height = 160, padX = 24, padY = 20;
  const values = data.map((d) => d.cumulative);
  const max = Math.max(...values, 0);
  const min = Math.min(...values, 0);
  const span = Math.max(1, max - min);
  const stepX = data.length > 1 ? (width - padX * 2) / (data.length - 1) : 0;
  const scaleY = (v: number) => height - padY - ((v - min) / span) * (height - padY * 2);
  const zeroY = scaleY(0);
  const pts = data.map((d, i) => ({ x: padX + i * stepX, y: scaleY(d.cumulative) }));
  const path = pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
  const area = `${path} L ${pts[pts.length - 1].x.toFixed(1)} ${zeroY} L ${padX} ${zeroY} Z`;
  const isNeg = data[data.length - 1].cumulative < 0;
  const color = isNeg ? "#dc2626" : "#0284c7";
  const tooltipLeftPct = hover !== null ? (pts[hover].x / width) * 100 : 0;

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-40" onMouseLeave={() => setHover(null)}>
        <line x1={padX} y1={zeroY} x2={width - padX} y2={zeroY} stroke="#e5e7eb" strokeWidth={1} strokeDasharray="3 3" />
        <path d={area} fill={color} opacity={0.08} />
        <path d={path} fill="none" stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
        {hover !== null && (
          <>
            <line x1={pts[hover].x} y1={padY} x2={pts[hover].x} y2={height - padY} stroke="#cbd5e1" strokeWidth={1} strokeDasharray="3 3" />
            <circle cx={pts[hover].x} cy={pts[hover].y} r={5} fill={color} stroke="white" strokeWidth={2} />
          </>
        )}
        <rect
          x={0} y={0} width={width} height={height} fill="transparent"
          onMouseMove={(e) => setHover(nearestIndex(e, width, padX, stepX, data.length))}
          style={{ cursor: "crosshair" }}
        />
      </svg>
      {hover !== null && (
        <div
          className="absolute bg-neutral-900 text-white text-xs rounded-lg px-3 py-2 pointer-events-none shadow-lg z-10 whitespace-nowrap"
          style={{ left: `${tooltipLeftPct}%`, top: 0, transform: "translate(-50%, -8px)" }}
        >
          <p className="font-semibold mb-0.5">{data[hover].label}</p>
          <p style={{ color: isNeg ? "#fca5a5" : "#7dd3fc" }}>{formatCurrency(data[hover].cumulative)}</p>
        </div>
      )}
      <div className="flex justify-between px-1 mt-1">
        {data.map((d, i) => <span key={i} className={cn("text-[10px] text-neutral-400", hover === i && "text-black font-semibold")}>{d.label}</span>)}
      </div>
    </div>
  );
}


// ── Page ─────────────────────────────────────────────────────────────────────

export default function BusinessAnalyticsPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [bills, setBills] = useState<Bill[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [maintenance, setMaintenance] = useState<MaintenanceItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubs = [
      subscribeInvoices((rows) => { setInvoices(rows); setLoading(false); }),
      subscribeExpenses(setExpenses),
      subscribeBills(setBills),
      subscribeSubscriptions(setSubscriptions),
      subscribeMaintenanceItems(setMaintenance),
    ];
    return () => unsubs.forEach((u) => u());
  }, []);

  usePageHeader({ icon: BarChart3, title: "Business Analytics" });

  // ── Financial health ───────────────────────────────────────────────────────
  const paidInvoices = useMemo(() => invoices.filter((i) => i.status === "Paid"), [invoices]);
  const allTimeRevenue = paidInvoices.reduce((s, i) => s + i.grandTotal, 0);
  const allTimeExpensePaid = expenses.reduce((s, e) => s + e.amount, 0)
    + bills.filter((b) => b.status === "Paid").reduce((s, b) => s + b.amount, 0);
  const cashPosition = allTimeRevenue - allTimeExpensePaid;

  const revenueThisMonth = paidInvoices.filter((i) => inThisMonth(toJsDate(i.paidDate ?? i.issueDate))).reduce((s, i) => s + i.grandTotal, 0);
  const rawExpensesThisMonth = expenses.filter((e) => inThisMonth(toJsDate(e.date))).reduce((s, e) => s + e.amount, 0);
  const billsPending = bills.filter((b) => b.status === "Pending" || b.status === "Approved").reduce((s, b) => s + b.amount, 0);
  const subscriptionsMonthly = subscriptions.filter((s) => s.status === "Active").reduce((s, sub) => s + monthlyEquivalent(sub.amount, sub.billingCycle), 0);
  const monthlyBurn = rawExpensesThisMonth + billsPending + subscriptionsMonthly;
  const netMonthly = revenueThisMonth - monthlyBurn;

  const runwayZeroRevenue = monthlyBurn > 0 ? cashPosition / monthlyBurn : Infinity;
  const runwayCurrentTrend = netMonthly < 0 ? cashPosition / -netMonthly : Infinity;
  const isSustainable = netMonthly >= 0;
  const runwayCritical = !isSustainable && runwayCurrentTrend <= 3;
  const runwayWarning = !isSustainable && runwayCurrentTrend > 3 && runwayCurrentTrend <= 6;

  // 6-month revenue/burn/cash trend
  const trend = useMemo(() => {
    const revMap = new Map<string, number>();
    const burnMap = new Map<string, number>();
    const months: string[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(); d.setMonth(d.getMonth() - i);
      const k = monthKey(d);
      months.push(k);
      revMap.set(k, 0); burnMap.set(k, 0);
    }
    paidInvoices.forEach((inv) => {
      const d = toJsDate(inv.paidDate ?? inv.issueDate); if (!d) return;
      const k = monthKey(d); if (revMap.has(k)) revMap.set(k, revMap.get(k)! + inv.grandTotal);
    });
    expenses.forEach((e) => {
      const d = toJsDate(e.date); if (!d) return;
      const k = monthKey(d); if (burnMap.has(k)) burnMap.set(k, burnMap.get(k)! + e.amount);
    });
    bills.forEach((b) => {
      const d = toJsDate(b.billDate); if (!d) return;
      const k = monthKey(d); if (burnMap.has(k)) burnMap.set(k, burnMap.get(k)! + b.amount);
    });
    const netLast6 = months.reduce((s, k) => s + (revMap.get(k)! - burnMap.get(k)!), 0);
    let running = cashPosition - netLast6;
    return months.map((k) => {
      const revenue = revMap.get(k)!;
      const burn = burnMap.get(k)!;
      running += revenue - burn;
      return { label: k.slice(5), revenue, burn, cumulative: running };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paidInvoices, expenses, bills]);

  const lastMonthTrend = trend[trend.length - 2];
  const revenueDelta = lastMonthTrend && lastMonthTrend.revenue > 0 ? ((revenueThisMonth - lastMonthTrend.revenue) / lastMonthTrend.revenue) * 100 : null;
  const burnDelta = lastMonthTrend && lastMonthTrend.burn > 0 ? ((trend[trend.length - 1].burn - lastMonthTrend.burn) / lastMonthTrend.burn) * 100 : null;

  // ── Finance detail ───────────────────────────────────────────────────────
  const overdueInvoices = invoices.filter((i) => i.status === "Overdue" || (i.status === "Sent" && !!toJsDate(i.dueDate) && toJsDate(i.dueDate)!.getTime() < Date.now()));
  const overdueInvoiceTotal = overdueInvoices.reduce((s, i) => s + i.grandTotal, 0);
  const overdueBills = bills.filter((b) => b.status !== "Paid" && !!toJsDate(b.dueDate) && toJsDate(b.dueDate)!.getTime() < Date.now());
  const overdueMaintenance = maintenance.filter((m) => m.status === "Active" && toJsDate(m.dueDate)!.getTime() < Date.now());
  const dueSoonMaintenance = maintenance.filter((m) => {
    if (m.status !== "Active") return false;
    const daysAway = (toJsDate(m.dueDate)!.getTime() - Date.now()) / 86400000;
    return daysAway >= 0 && daysAway <= 7;
  });

  // ── Alerts / SLA (financial only) ─────────────────────────────────────────
  const alerts: Alert[] = useMemo(() => {
    const list: Alert[] = [];
    if (cashPosition <= 0) {
      list.push({ severity: "red", title: "Cash position is at or below zero", description: `Estimated cash position: ${formatCurrency(cashPosition)}.`, to: "/finance/reports" });
    } else if (runwayCritical) {
      list.push({ severity: "red", title: "Critical: runway under 3 months", description: `At the current burn rate, funds run out in ~${runwayCurrentTrend.toFixed(1)} months.`, to: "/finance/reports" });
    } else if (runwayWarning) {
      list.push({ severity: "amber", title: "Runway under 6 months", description: `At the current burn rate, funds run out in ~${runwayCurrentTrend.toFixed(1)} months.`, to: "/finance/reports" });
    }
    if (overdueInvoices.length > 0) {
      list.push({ severity: "red", title: `${overdueInvoices.length} overdue invoice${overdueInvoices.length > 1 ? "s" : ""}`, description: `${formatCurrency(overdueInvoiceTotal)} outstanding past due date.`, to: "/finance/transactions" });
    }
    if (overdueBills.length > 0) {
      list.push({ severity: "amber", title: `${overdueBills.length} overdue bill${overdueBills.length > 1 ? "s" : ""}`, description: "Supplier bills are past their due date.", to: "/finance/expenses" });
    }
    if (overdueMaintenance.length > 0) {
      list.push({ severity: "red", title: `${overdueMaintenance.length} overdue renewal${overdueMaintenance.length > 1 ? "s" : ""}`, description: "Maintenance items (e.g. domain/hosting renewals) are past due.", to: "/maintenance" });
    } else if (dueSoonMaintenance.length > 0) {
      list.push({ severity: "amber", title: `${dueSoonMaintenance.length} renewal${dueSoonMaintenance.length > 1 ? "s" : ""} due this week`, description: "Upcoming maintenance renewals need action soon.", to: "/maintenance" });
    }
    const sevOrder = { red: 0, amber: 1 };
    return list.sort((a, b) => sevOrder[a.severity] - sevOrder[b.severity]);
  }, [cashPosition, runwayCritical, runwayWarning, runwayCurrentTrend, overdueInvoices, overdueInvoiceTotal, overdueBills, overdueMaintenance, dueSoonMaintenance]);

  if (loading) return <LoadingState />;

  const container = { hidden: {}, show: { transition: { staggerChildren: 0.08 } } };
  const item = { hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: "easeOut" as const } } };

  return (
    <motion.div className="max-w-6xl mx-auto space-y-6" variants={container} initial="hidden" animate="show">
      {/* Runway / bankruptcy banner */}
      <motion.div variants={item}>
      <Card className={cn(
        "p-6 border-l-4 transition-all duration-300 hover:shadow-md",
        cashPosition <= 0 || runwayCritical ? "border-l-red-600 bg-red-50/40" : runwayWarning ? "border-l-amber-500 bg-amber-50/40" : "border-l-emerald-500"
      )}>
        <div className="flex items-start gap-4">
          <div className={cn(
            "p-3 rounded-xl shrink-0",
            cashPosition <= 0 || runwayCritical ? "bg-red-100 text-red-700" : runwayWarning ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"
          )}>
            {isSustainable ? <TrendingUp size={22} /> : <ShieldAlert size={22} />}
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-bold text-black">
              {isSustainable ? "Sustainable — revenue currently covers expenses" : "Runway Warning"}
            </h2>
            <p className="text-sm text-neutral-600 mt-1">
              This month: <span className="font-semibold text-black tabular-nums"><AnimatedCurrency value={revenueThisMonth} /></span> revenue vs <span className="font-semibold text-black tabular-nums"><AnimatedCurrency value={monthlyBurn} /></span> burn
              {" "}({netMonthly >= 0 ? "surplus" : "deficit"} of <span className="tabular-nums"><AnimatedCurrency value={Math.abs(netMonthly)} /></span>/month).
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
              <div className="bg-white rounded-xl border border-neutral-200 p-3 transition-all duration-300 hover:shadow-sm">
                <p className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wide">Runway if revenue stops entirely</p>
                <p className="text-lg font-bold text-black mt-0.5 tabular-nums">
                  {cashPosition <= 0 ? "Already depleted" : Number.isFinite(runwayZeroRevenue) ? <AnimatedMonths value={runwayZeroRevenue} /> : "No burn"}
                </p>
              </div>
              <div className="bg-white rounded-xl border border-neutral-200 p-3 transition-all duration-300 hover:shadow-sm">
                <p className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wide">Runway at current trend</p>
                <p className="text-lg font-bold text-black mt-0.5 tabular-nums">
                  {isSustainable ? "Not depleting — profitable" : cashPosition <= 0 ? "Already depleted" : <AnimatedMonths value={runwayCurrentTrend} />}
                </p>
              </div>
            </div>
          </div>
        </div>
      </Card>
      </motion.div>

      {/* KPI strip */}
      <motion.div variants={item} className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <KpiTile label="Cash Position (est.)" value={cashPosition} delta={null} />
        <KpiTile label="Revenue (MTD)" value={revenueThisMonth} delta={revenueDelta} positiveIsGood />
        <KpiTile label="Burn (MTD)" value={monthlyBurn} delta={burnDelta} positiveIsGood={false} />
        <KpiTile label="Net (MTD)" value={netMonthly} delta={null} />
      </motion.div>

      {/* Financial trend charts */}
      <motion.div variants={item} className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-5 transition-all duration-300 hover:shadow-md">
          <h2 className="font-semibold text-black mb-4">Revenue vs Burn (Last 6 Months)</h2>
          <TrendChart data={trend} />
        </Card>
        <Card className="p-5 transition-all duration-300 hover:shadow-md">
          <h2 className="font-semibold text-black mb-4">Cash Position Trend</h2>
          <CashTrendChart data={trend} />
        </Card>
      </motion.div>

      {/* Alerts / SLA */}
      <motion.div variants={item}>
      <Card className="p-5 transition-all duration-300 hover:shadow-md">
        <h2 className="font-semibold text-black mb-4 flex items-center gap-2"><AlertTriangle size={17} className="text-amber-600" /> Alerts & SLA</h2>
        {alerts.length === 0 ? (
          <EmptyState icon={ShieldAlert} label="All clear" description="No overdue items, SLA breaches, or financial risks detected." />
        ) : (
          <div className="space-y-2">
            {alerts.map((a, i) => (
              <Link
                key={i}
                to={a.to}
                className={cn(
                  "flex items-center justify-between gap-3 p-3 rounded-xl border-l-4 transition-all duration-200 hover:shadow-sm hover:-translate-y-0.5",
                  a.severity === "red" ? "bg-red-50/60 border-l-red-600" : "bg-amber-50/60 border-l-amber-500"
                )}
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-black">{a.title}</p>
                  <p className="text-xs text-neutral-500 mt-0.5">{a.description}</p>
                </div>
                <ArrowRight size={15} className="text-neutral-400 shrink-0" />
              </Link>
            ))}
          </div>
        )}
      </Card>
      </motion.div>

      <motion.p variants={item} className="text-[11px] text-neutral-400 text-center pb-2">
        Cash position is an estimate derived from recorded revenue and expenses in BizTask — it is not synced with an actual bank account.
        Last computed {formatDate(new Date())}.
      </motion.p>
    </motion.div>
  );
}
