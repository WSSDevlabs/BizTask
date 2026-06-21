import { useEffect, useMemo, useState } from "react";
import { BarChart3, TrendingUp, TrendingDown, DollarSign, Target as TargetIcon } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  PageHeader, PrimaryButton, Card, LoadingState, StatCard, EmptyState, Field, inputClass,
} from "@/components/ui/shared";
import {
  subscribeInvoices, subscribeExpenses, subscribeCustomers,
  subscribeMonthlyTargets, setMonthlyTarget,
} from "@/lib/db";
import { formatCurrency, toJsDate } from "@/lib/utils";
import type { Invoice, Expense, Customer, MonthlyTarget } from "@/types";

const DONUT_COLORS = ["#b91c1c", "#ef4444", "#f97316", "#eab308", "#22c55e", "#3b82f6", "#8b5cf6", "#ec4899"];

function monthKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default function ReportsPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [targets, setTargets] = useState<MonthlyTarget[]>([]);
  const [loading, setLoading] = useState(true);

  const now = new Date();
  const [targetOpen, setTargetOpen] = useState(false);
  const [tMonth, setTMonth] = useState(now.getMonth() + 1);
  const [tYear, setTYear] = useState(now.getFullYear());
  const [tRevenue, setTRevenue] = useState(0);
  const [tBudget, setTBudget] = useState(0);

  useEffect(() => {
    const unsubs = [
      subscribeInvoices((rows) => { setInvoices(rows); setLoading(false); }),
      subscribeExpenses(setExpenses),
      subscribeCustomers(setCustomers),
      subscribeMonthlyTargets(setTargets),
    ];
    return () => unsubs.forEach((u) => u());
  }, []);

  const currentTarget = useMemo(
    () => targets.find((t) => t.year === now.getFullYear() && t.month === now.getMonth() + 1),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [targets]
  );

  function openTargetModal() {
    setTMonth(now.getMonth() + 1);
    setTYear(now.getFullYear());
    setTRevenue(currentTarget?.revenueTarget ?? 0);
    setTBudget(currentTarget?.expensesBudget ?? 0);
    setTargetOpen(true);
  }

  async function saveTarget() {
    await setMonthlyTarget({ year: tYear, month: tMonth, revenueTarget: tRevenue, expensesBudget: tBudget });
    setTargetOpen(false);
  }

  const paidInvoices = useMemo(() => invoices.filter((i) => i.status === "Paid"), [invoices]);

  // Revenue by month (last 6 months)
  const revenueByMonth = useMemo(() => {
    const map = new Map<string, number>();
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      map.set(monthKey(d), 0);
    }
    paidInvoices.forEach((inv) => {
      const d = toJsDate(inv.paidDate ?? inv.issueDate);
      if (!d) return;
      const k = monthKey(d);
      if (map.has(k)) map.set(k, map.get(k)! + inv.grandTotal);
    });
    return Array.from(map.entries()).map(([k, v]) => ({ label: k.slice(5), value: v }));
  }, [paidInvoices]);

  const maxRevenue = Math.max(1, ...revenueByMonth.map((r) => r.value));

  // Expense breakdown by category
  const expenseByCategory = useMemo(() => {
    const map = new Map<string, number>();
    expenses.forEach((e) => map.set(e.category, (map.get(e.category) ?? 0) + e.amount));
    return Array.from(map.entries()).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
  }, [expenses]);
  const totalExpenses = expenseByCategory.reduce((s, e) => s + e.value, 0);

  const totalRevenue = paidInvoices.reduce((s, i) => s + i.grandTotal, 0);
  const netProfit = totalRevenue - totalExpenses;

  // Outstanding receivables
  const receivables = invoices.filter((i) => i.status === "Sent" || i.status === "Overdue");
  const outstanding = receivables.reduce((s, i) => s + i.grandTotal, 0);

  // Aging
  const aging = useMemo(() => {
    const buckets = { "Current": 0, "0-30": 0, "31-60": 0, "61-90": 0, "90+": 0 };
    receivables.forEach((inv) => {
      const due = toJsDate(inv.dueDate);
      if (!due) { buckets["Current"] += inv.grandTotal; return; }
      const days = Math.floor((Date.now() - due.getTime()) / 86400000);
      if (days <= 0) buckets["Current"] += inv.grandTotal;
      else if (days <= 30) buckets["0-30"] += inv.grandTotal;
      else if (days <= 60) buckets["31-60"] += inv.grandTotal;
      else if (days <= 90) buckets["61-90"] += inv.grandTotal;
      else buckets["90+"] += inv.grandTotal;
    });
    return buckets;
  }, [receivables]);

  // Top customers
  const topCustomers = useMemo(() => {
    const map = new Map<string, number>();
    paidInvoices.forEach((i) => map.set(i.customerId, (map.get(i.customerId) ?? 0) + i.grandTotal));
    return Array.from(map.entries())
      .map(([id, value]) => ({ name: customers.find((c) => c.id === id)?.company ?? "Unknown", value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);
  }, [paidInvoices, customers]);

  if (loading) return <LoadingState />;

  // build donut segments
  let cumulative = 0;
  const donutSegments = expenseByCategory.map((e, i) => {
    const fraction = totalExpenses === 0 ? 0 : e.value / totalExpenses;
    const seg = { ...e, color: DONUT_COLORS[i % DONUT_COLORS.length], offset: cumulative, fraction };
    cumulative += fraction;
    return seg;
  });
  const circumference = 2 * Math.PI * 40;

  // Current month revenue (last entry in revenueByMonth corresponds to current month)
  const currentMonthRevenue = revenueByMonth.length > 0 ? revenueByMonth[revenueByMonth.length - 1].value : 0;
  const revenueTarget = currentTarget?.revenueTarget ?? 0;
  const targetPct = revenueTarget > 0 ? Math.min(100, (currentMonthRevenue / revenueTarget) * 100) : 0;
  // Target line height as a % of the chart (relative to maxRevenue), capped at 100%
  const targetLinePct = revenueTarget > 0 ? Math.min(100, (revenueTarget / maxRevenue) * 100) : 0;

  return (
    <div className="max-w-6xl mx-auto">
      <PageHeader
        icon={BarChart3}
        title="Financial Reports"
        subtitle="Revenue, expenses and receivables"
        actions={<PrimaryButton onClick={openTargetModal}><TargetIcon size={16} /> Set Monthly Target</PrimaryButton>}
      />

      {/* Revenue vs Target */}
      <Card className="p-5 mb-6">
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-semibold text-black flex items-center gap-2"><TargetIcon size={18} /> Revenue vs Target (This Month)</h2>
          <span className="text-sm text-neutral-500">
            {formatCurrency(currentMonthRevenue)} {revenueTarget > 0 ? `of ${formatCurrency(revenueTarget)}` : "(no target set)"}
          </span>
        </div>
        <div className="h-3 bg-neutral-100 rounded-full overflow-hidden">
          <div className="h-full bg-red-800 rounded-full transition-all" style={{ width: `${targetPct}%` }} />
        </div>
        <p className="text-xs text-neutral-500 mt-1.5">{revenueTarget > 0 ? `${targetPct.toFixed(0)}% of target` : "Set a monthly target to track progress."}</p>
      </Card>

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-6">
        <StatCard label="Revenue" value={formatCurrency(totalRevenue)} icon={TrendingUp} accent />
        <StatCard label="Expenses" value={formatCurrency(totalExpenses)} icon={TrendingDown} />
        <StatCard label="Net Profit" value={formatCurrency(netProfit)} icon={DollarSign} hint={netProfit >= 0 ? "Profit" : "Loss"} />
        <StatCard label="Outstanding" value={formatCurrency(outstanding)} icon={BarChart3} hint={`${receivables.length} invoices`} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Revenue bar chart */}
        <Card className="p-5">
          <h2 className="font-semibold text-black mb-5">Revenue (Last 6 Months)</h2>
          <div className="relative flex items-end justify-between gap-3 h-48">
            {revenueTarget > 0 && (
              <div
                className="absolute left-0 right-0 border-t-2 border-dashed border-red-600 z-10 pointer-events-none"
                style={{ bottom: `${targetLinePct}%` }}
              >
                <span className="absolute -top-4 right-0 text-[10px] font-medium text-red-600 bg-white px-1">
                  Target {formatCurrency(revenueTarget).replace("RM", "").trim()}
                </span>
              </div>
            )}
            {revenueByMonth.map((r) => (
              <div key={r.label} className="flex-1 flex flex-col items-center justify-end h-full">
                <span className="text-[10px] text-neutral-500 mb-1">{r.value > 0 ? formatCurrency(r.value).replace("RM", "").trim() : ""}</span>
                <div className="w-full bg-red-800 rounded-t-md transition-all" style={{ height: `${(r.value / maxRevenue) * 100}%`, minHeight: r.value > 0 ? "4px" : "0" }} />
                <span className="text-xs text-neutral-400 mt-2">{r.label}</span>
              </div>
            ))}
          </div>
        </Card>

        {/* Expense donut */}
        <Card className="p-5">
          <h2 className="font-semibold text-black mb-5">Expense Breakdown</h2>
          {totalExpenses === 0 ? (
            <EmptyState icon={TrendingDown} label="No expenses recorded" />
          ) : (
            <div className="flex items-center gap-6">
              <svg viewBox="0 0 100 100" className="w-32 h-32 -rotate-90">
                {donutSegments.map((s) => (
                  <circle key={s.label} cx="50" cy="50" r="40" fill="none" stroke={s.color} strokeWidth="14"
                    strokeDasharray={`${s.fraction * circumference} ${circumference}`}
                    strokeDashoffset={-s.offset * circumference} />
                ))}
              </svg>
              <div className="space-y-1.5 flex-1">
                {donutSegments.map((s) => (
                  <div key={s.label} className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2 text-neutral-600"><span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: s.color }} />{s.label}</span>
                    <span className="font-medium text-black">{formatCurrency(s.value)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Aging */}
        <Card className="p-5">
          <h2 className="font-semibold text-black mb-4">Invoice Aging</h2>
          <div className="space-y-3">
            {Object.entries(aging).map(([bucket, amount]) => {
              const max = Math.max(1, ...Object.values(aging));
              return (
                <div key={bucket}>
                  <div className="flex justify-between text-sm mb-1"><span className="text-neutral-600">{bucket} days</span><span className="font-medium text-black">{formatCurrency(amount)}</span></div>
                  <div className="h-2 bg-neutral-100 rounded-full overflow-hidden"><div className="h-full bg-red-800 rounded-full" style={{ width: `${(amount / max) * 100}%` }} /></div>
                </div>
              );
            })}
          </div>
        </Card>

        {/* Top customers */}
        <Card className="p-5">
          <h2 className="font-semibold text-black mb-4">Top Customers by Revenue</h2>
          {topCustomers.length === 0 ? (
            <EmptyState icon={TrendingUp} label="No paid invoices yet" />
          ) : (
            <div className="space-y-3">
              {topCustomers.map((c, i) => (
                <div key={c.name} className="flex items-center gap-3">
                  <span className="w-6 h-6 rounded-full bg-red-100 text-red-800 flex items-center justify-center text-xs font-bold">{i + 1}</span>
                  <span className="flex-1 text-sm text-black">{c.name}</span>
                  <span className="text-sm font-semibold text-red-800">{formatCurrency(c.value)}</span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Set monthly target modal */}
      <Dialog open={targetOpen} onOpenChange={setTargetOpen}>
        <DialogContent className="sm:max-w-md bg-white">
          <DialogHeader><DialogTitle>Set Monthly Target</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="grid grid-cols-2 gap-4">
              <Field label="Month">
                <select className={inputClass} value={tMonth} onChange={(e) => setTMonth(parseInt(e.target.value, 10))}>
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                    <option key={m} value={m}>{new Date(2000, m - 1, 1).toLocaleString("en-GB", { month: "long" })}</option>
                  ))}
                </select>
              </Field>
              <Field label="Year"><input type="number" className={inputClass} value={tYear} onChange={(e) => setTYear(parseInt(e.target.value, 10) || now.getFullYear())} /></Field>
            </div>
            <Field label="Revenue Target (RM)"><input type="number" min={0} step="0.01" className={inputClass} value={tRevenue || ""} onChange={(e) => setTRevenue(parseFloat(e.target.value) || 0)} /></Field>
            <Field label="Expenses Budget (RM)"><input type="number" min={0} step="0.01" className={inputClass} value={tBudget || ""} onChange={(e) => setTBudget(parseFloat(e.target.value) || 0)} /></Field>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setTargetOpen(false)} className="px-4 py-2 text-sm font-medium text-neutral-600 hover:bg-neutral-100 rounded-lg">Cancel</button>
              <PrimaryButton onClick={saveTarget}>Save Target</PrimaryButton>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
