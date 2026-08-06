import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  TrendingUp, TrendingDown, DollarSign, ListChecks, AlertTriangle, FolderKanban,
  Target, Handshake, ReceiptText, ArrowRight, CalendarClock,
  Plus, FilePlus, Wallet, UserPlus, CreditCard, CalendarDays,
} from "lucide-react";
import { motion } from "framer-motion";
import {
  Card, LoadingState, StatCard, StatusBadge, toneForStatus, toneForPriority, EmptyState,
} from "@/components/ui/shared";
import {
  subscribeTasks, subscribeProjects, subscribeLeads, subscribeDeals,
  subscribeInvoices, subscribeExpenses, subscribeDepartments,
  subscribeLeaveRequests, subscribeBills, subscribeSuppliers, subscribeMonthlyTargets,
  subscribeSubscriptions,
} from "@/lib/db";
import { cn, formatCurrency, formatDate, toJsDate } from "@/lib/utils";
import type {
  Task, Project, Lead, Deal, Invoice, Expense, Department,
  ProjectStatus, LeaveRequest, Bill, Supplier, MonthlyTarget, Subscription, BillingCycle,
} from "@/types";

function monthlyEquivalent(amount: number, cycle: BillingCycle): number {
  switch (cycle) {
    case "Weekly":    return amount * 4.345;
    case "Monthly":   return amount;
    case "Quarterly": return amount / 3;
    case "Yearly":    return amount / 12;
  }
}

function isOverdue(t: Task): boolean {
  if (t.status === "Done") return false;
  const d = toJsDate(t.dueDate);
  return !!d && d.getTime() < Date.now();
}

function inThisWeek(d: Date | null): boolean {
  if (!d) return false;
  const now = new Date();
  const weekEnd = new Date();
  weekEnd.setDate(now.getDate() + 7);
  return d >= now && d <= weekEnd;
}

function inThisMonth(d: Date | null): boolean {
  if (!d) return false;
  const now = new Date();
  return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
}

function billIsOverdue(b: Bill): boolean {
  if (b.status === "Paid") return false;
  const due = toJsDate(b.dueDate);
  return !!due && due.getTime() < Date.now();
}

const PROJECT_STATUSES: ProjectStatus[] = ["Planning", "Active", "On Hold", "Completed", "Cancelled"];

const QUICK_ACTIONS = [
  { label: "New Task", icon: Plus, to: "/tasks?action=new" },
  { label: "New Invoice", icon: FilePlus, to: "/finance/transactions?action=new" },
  { label: "Log Expense", icon: Wallet, to: "/finance/expenses?action=new" },
  { label: "New Lead", icon: UserPlus, to: "/crm/leads?action=new" },
];

export default function DashboardPage() {
  const navigate = useNavigate();

  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [bills, setBills] = useState<Bill[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [targets, setTargets] = useState<MonthlyTarget[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubs = [
      subscribeTasks((rows) => { setTasks(rows); setLoading(false); }),
      subscribeProjects(setProjects),
      subscribeLeads(setLeads),
      subscribeDeals(setDeals),
      subscribeInvoices(setInvoices),
      subscribeExpenses(setExpenses),
      subscribeDepartments(setDepartments),
      subscribeLeaveRequests(setLeaveRequests),
      subscribeBills(setBills),
      subscribeSuppliers(setSuppliers),
      subscribeSubscriptions(setSubscriptions),
      subscribeMonthlyTargets(setTargets),
    ];
    return () => unsubs.forEach((u) => u());
  }, []);

  const deptName = (id?: string) => departments.find((d) => d.id === id)?.name ?? "Unassigned";
  const deptColor = (id?: string) => departments.find((d) => d.id === id)?.color ?? "#9ca3af";
  const supplierName = (id: string) => suppliers.find((s) => s.id === id)?.name ?? "Unknown";

  // ── Financial KPIs ───────────────────────────────────────────────────────
  const now = new Date();
  const currentTarget = targets.find((t) => t.year === now.getFullYear() && t.month === now.getMonth() + 1);

  const revenueThisMonth = invoices.filter((i) => i.status === "Paid" && inThisMonth(toJsDate(i.paidDate ?? i.issueDate))).reduce((s, i) => s + i.grandTotal, 0);
  // Total Expenses = one-off Expenses + pending Bills/Payables + active Subscriptions
  // (normalized to a monthly figure) — the same three sources rolled into one
  // "Total Outflow" number on the Expenses page.
  const rawExpensesThisMonth = expenses.filter((e) => inThisMonth(toJsDate(e.date))).reduce((s, e) => s + e.amount, 0);
  const billsPending = bills.filter((b) => b.status === "Pending" || b.status === "Approved").reduce((s, b) => s + b.amount, 0);
  const subscriptionsMonthly = subscriptions.filter((s) => s.status === "Active").reduce((s, sub) => s + monthlyEquivalent(sub.amount, sub.billingCycle), 0);
  const expensesThisMonth = rawExpensesThisMonth + billsPending + subscriptionsMonthly;
  const netProfit = revenueThisMonth - expensesThisMonth;

  const outstandingInvoices = invoices.filter((i) => i.status === "Sent" || i.status === "Overdue");
  const outstandingTotal = outstandingInvoices.reduce((s, i) => s + i.grandTotal, 0);

  const revenueTarget = currentTarget?.revenueTarget ?? 0;
  const expensesBudget = currentTarget?.expensesBudget ?? 0;
  const revenuePct = revenueTarget > 0 ? Math.min(100, (revenueThisMonth / revenueTarget) * 100) : 0;
  const expensePct = expensesBudget > 0 ? Math.min(100, (expensesThisMonth / expensesBudget) * 100) : 0;

  // ── Operational KPIs ─────────────────────────────────────────────────────
  const openTasks = tasks.filter((t) => t.status !== "Done");
  const overdueTasks = tasks.filter(isOverdue);
  const activeProjects = projects.filter((p) => p.status === "Active");
  const projectPct = projects.length > 0 ? Math.round((activeProjects.length / projects.length) * 100) : 0;
  const openLeads = leads.filter((l) => l.stage !== "Won" && l.stage !== "Lost");
  const negotiationLeads = leads.filter((l) => l.stage === "Negotiation");
  const pipelineValue = deals.filter((d) => d.stage !== "Won" && d.stage !== "Lost").reduce((s, d) => s + d.value, 0);
  const pendingLeave = leaveRequests.filter((l) => l.status === "Pending");

  // ── Composite views ──────────────────────────────────────────────────────
  const tasksByDept = useMemo(() => {
    const map = new Map<string, Task[]>();
    openTasks.forEach((t) => {
      const key = t.departmentId ?? "none";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(t);
    });
    return Array.from(map.entries());
  }, [openTasks]);

  const dueThisWeek = useMemo(
    () => openTasks.filter((t) => inThisWeek(toJsDate(t.dueDate))).sort((a, b) => (toJsDate(a.dueDate)?.getTime() ?? 0) - (toJsDate(b.dueDate)?.getTime() ?? 0)),
    [openTasks]
  );

  const upcomingBills = useMemo(
    () => bills
      .filter((b) => b.status !== "Paid")
      .sort((a, b) => (toJsDate(a.dueDate)?.getTime() ?? Infinity) - (toJsDate(b.dueDate)?.getTime() ?? Infinity))
      .slice(0, 5),
    [bills]
  );

  if (loading) return <LoadingState />;

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* ── Section 2: Quick Actions ────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {QUICK_ACTIONS.map((qa) => (
          <button
            key={qa.label}
            onClick={() => navigate(qa.to)}
            className="flex items-center gap-3 bg-white rounded-2xl border border-neutral-200 hover:border-red-800 shadow-sm p-4 text-left transition group"
          >
            <span className="p-2.5 rounded-xl bg-red-800 text-white group-hover:bg-red-900 transition">
              <qa.icon size={18} />
            </span>
            <span className="text-sm font-semibold text-black">{qa.label}</span>
          </button>
        ))}
      </div>

      {/* ── Section 3: KPI Cards ────────────────────────────────────────── */}
      <motion.div
        className="grid grid-cols-2 lg:grid-cols-4 gap-4"
        initial="hidden" animate="show"
        variants={{ hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.04 } } }}
      >
        {/* Row 1 — Financial */}
        <motion.div className="h-full" variants={{ hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0 } }}>
          <div className="bg-white rounded-2xl shadow-sm border border-neutral-200 p-5 h-full flex flex-col">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-neutral-500 uppercase tracking-wide">Revenue (Month)</span>
              <div className="p-2 rounded-lg bg-red-800 text-white"><TrendingUp size={16} /></div>
            </div>
            <p className="text-2xl font-bold text-black">{formatCurrency(revenueThisMonth)}</p>
            {revenueTarget > 0 && (
              <>
                <div className="h-1.5 bg-neutral-100 rounded-full overflow-hidden mt-2"><div className="h-full bg-emerald-500 rounded-full" style={{ width: `${revenuePct}%` }} /></div>
                <p className="text-xs text-neutral-400 mt-1">{revenuePct.toFixed(0)}% of {formatCurrency(revenueTarget)} target</p>
              </>
            )}
          </div>
        </motion.div>

        <motion.div className="h-full" variants={{ hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0 } }}>
          <div className="bg-white rounded-2xl shadow-sm border border-neutral-200 p-5 h-full flex flex-col">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-neutral-500 uppercase tracking-wide">Total Expenses (Month)</span>
              <div className="p-2 rounded-lg bg-black text-white"><TrendingDown size={16} /></div>
            </div>
            <p className="text-2xl font-bold text-black">{formatCurrency(expensesThisMonth)}</p>
            {expensesBudget > 0 && (
              <>
                <div className="h-1.5 bg-neutral-100 rounded-full overflow-hidden mt-2"><div className={cn("h-full rounded-full", expensePct >= 100 ? "bg-red-700" : "bg-amber-500")} style={{ width: `${expensePct}%` }} /></div>
                <p className="text-xs text-neutral-400 mt-1">{expensePct.toFixed(0)}% of {formatCurrency(expensesBudget)} budget</p>
              </>
            )}
          </div>
        </motion.div>

        <motion.div className="h-full" variants={{ hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0 } }}>
          <div className="bg-white rounded-2xl shadow-sm border border-neutral-200 p-5 h-full flex flex-col">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-neutral-500 uppercase tracking-wide">Net Profit</span>
              <div className={cn("p-2 rounded-lg text-white", netProfit >= 0 ? "bg-green-600" : "bg-red-700")}><DollarSign size={16} /></div>
            </div>
            <p className={cn("text-2xl font-bold", netProfit >= 0 ? "text-green-700" : "text-red-700")}>{formatCurrency(netProfit)}</p>
            <p className="text-xs text-neutral-400 mt-1">{netProfit >= 0 ? "Profit this month" : "Loss this month"}</p>
          </div>
        </motion.div>

        <motion.div className="h-full" variants={{ hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0 } }}>
          <div className="bg-white rounded-2xl shadow-sm border border-neutral-200 p-5 h-full flex flex-col">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-neutral-500 uppercase tracking-wide">Outstanding Invoices</span>
              <div className="p-2 rounded-lg bg-black text-white"><ReceiptText size={16} /></div>
            </div>
            <p className="text-2xl font-bold text-black">{formatCurrency(outstandingTotal)}</p>
            <p className="text-xs text-neutral-400 mt-1">{outstandingInvoices.length} invoice{outstandingInvoices.length === 1 ? "" : "s"} unpaid</p>
          </div>
        </motion.div>

        {/* Row 2 — Operations */}
        <motion.div className="h-full" variants={{ hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0 } }}>
          <div className="bg-white rounded-2xl shadow-sm border border-neutral-200 p-5 h-full flex flex-col">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-neutral-500 uppercase tracking-wide">Open Tasks</span>
              <div className="p-2 rounded-lg bg-black text-white"><ListChecks size={16} /></div>
            </div>
            <p className="text-2xl font-bold text-black flex items-center gap-2">
              {openTasks.length}
              {overdueTasks.length > 0 && <span className="text-[10px] font-bold bg-red-700 text-white rounded-full px-2 py-0.5">{overdueTasks.length} overdue</span>}
            </p>
            <p className="text-xs text-neutral-400 mt-1">Across all departments</p>
          </div>
        </motion.div>

        <motion.div className="h-full" variants={{ hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0 } }}>
          <div className="bg-white rounded-2xl shadow-sm border border-neutral-200 p-5 h-full flex flex-col">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-neutral-500 uppercase tracking-wide">Active Projects</span>
              <div className="p-2 rounded-lg bg-black text-white"><FolderKanban size={16} /></div>
            </div>
            <p className="text-2xl font-bold text-black">{activeProjects.length}</p>
            <p className="text-xs text-neutral-400 mt-1">{projectPct}% of {projects.length} total</p>
          </div>
        </motion.div>

        <motion.div className="h-full" variants={{ hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0 } }}>
          <StatCard label="Pipeline Value" value={formatCurrency(pipelineValue)} icon={Handshake} hint="Active deals" tone="blue" />
        </motion.div>

        <motion.div className="h-full" variants={{ hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0 } }}>
          <StatCard label="Open Leads" value={openLeads.length} icon={Target} hint={`${negotiationLeads.length} in negotiation`} tone="amber" />
        </motion.div>
      </motion.div>

      {/* ── Section 5: Two-column layout ────────────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* LEFT COLUMN */}
        <div className="xl:col-span-2 space-y-6">
          {/* Open Tasks by Department + Upcoming Bills — one row, square cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <Card className="overflow-hidden aspect-square flex flex-col">
              <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-200 shrink-0">
                <h2 className="text-lg font-semibold text-black">Open Tasks by Department</h2>
                <Link to="/tasks?status=open" className="flex items-center gap-1 text-sm text-red-800 hover:text-red-900 font-medium">View All <ArrowRight size={14} /></Link>
              </div>
              <div className="flex-1 overflow-y-auto">
                {tasksByDept.length === 0 ? (
                  <EmptyState icon={ListChecks} label="No open tasks. You're all caught up." />
                ) : (
                  <div className="divide-y divide-neutral-100">
                    {tasksByDept.map(([deptId, deptTasks]) => (
                      <div key={deptId} className="px-6 py-4">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: deptId === "none" ? "#9ca3af" : deptColor(deptId) }} />
                          <h3 className="text-sm font-semibold text-neutral-700">{deptId === "none" ? "Unassigned" : deptName(deptId)}</h3>
                          <span className="text-xs text-neutral-400">({deptTasks.length})</span>
                        </div>
                        <div className="space-y-1.5">
                          {deptTasks.slice(0, 4).map((t) => (
                            <div key={t.id} className={cn("flex items-center justify-between text-sm rounded-lg px-3 py-2", isOverdue(t) ? "bg-red-50" : "bg-neutral-50")}>
                              <span className="text-black truncate">{t.title}</span>
                              <div className="flex items-center gap-2 shrink-0">
                                <StatusBadge label={t.priority} tone={toneForPriority(t.priority)} dot={false} />
                                {t.dueDate && <span className={cn("text-xs", isOverdue(t) ? "text-red-600 font-medium" : "text-neutral-400")}>{formatDate(toJsDate(t.dueDate)!)}</span>}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </Card>

            <Card className="overflow-hidden aspect-square flex flex-col">
              <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-200 shrink-0">
                <h2 className="text-lg font-semibold text-black flex items-center gap-2"><CreditCard size={18} /> Upcoming Bills</h2>
                <Link to="/finance/expenses" className="flex items-center gap-1 text-sm text-red-800 hover:text-red-900 font-medium">View All <ArrowRight size={14} /></Link>
              </div>
              <div className="flex-1 overflow-y-auto">
                {upcomingBills.length === 0 ? (
                  <EmptyState icon={CreditCard} label="No upcoming bills" />
                ) : (
                  <div className="divide-y divide-neutral-100">
                    {upcomingBills.map((b) => (
                      <div key={b.id} className={cn("flex items-center justify-between px-6 py-3 text-sm", billIsOverdue(b) && "bg-red-50/40")}>
                        <div className="min-w-0">
                          <p className="text-black truncate">{b.description}</p>
                          <p className="text-xs text-neutral-400">{supplierName(b.supplierId)}{b.dueDate ? ` · due ${formatDate(toJsDate(b.dueDate)!)}` : ""}</p>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <span className="font-semibold text-black">{formatCurrency(b.amount)}</span>
                          <StatusBadge label={b.status} tone={toneForStatus(b.status)} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </Card>
          </div>

          {/* Overdue Items */}
          {overdueTasks.length > 0 && (
            <Card className="overflow-hidden border-red-200">
              <div className="px-6 py-4 border-b border-neutral-200 flex items-center gap-2">
                <AlertTriangle size={18} className="text-red-600" />
                <h2 className="text-lg font-semibold text-black">Overdue Items ({overdueTasks.length})</h2>
              </div>
              <div className="divide-y divide-neutral-100">
                {overdueTasks.slice(0, 6).map((t) => (
                  <div key={t.id} className="flex items-center justify-between px-6 py-3 text-sm">
                    <span className="text-black truncate">{t.title}</span>
                    <div className="flex items-center gap-2">
                      <StatusBadge label={t.priority} tone={toneForPriority(t.priority)} dot={false} />
                      <span className="text-xs text-red-600 font-medium">{t.dueDate ? formatDate(toJsDate(t.dueDate)!) : ""}</span>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>

        {/* RIGHT COLUMN */}
        <div className="space-y-6">
          {/* Due This Week */}
          <Card className="p-5">
            <h2 className="text-lg font-semibold text-black mb-4 flex items-center gap-2"><CalendarClock size={18} /> Due This Week</h2>
            {dueThisWeek.length === 0 ? (
              <p className="text-sm text-neutral-400">Nothing due this week.</p>
            ) : (
              <div className="space-y-2">
                {dueThisWeek.slice(0, 6).map((t) => (
                  <div key={t.id} className="flex items-center justify-between text-sm">
                    <span className="text-black truncate">{t.title}</span>
                    <span className="text-xs text-neutral-500 shrink-0 ml-2">{formatDate(toJsDate(t.dueDate)!)}</span>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Pending Leave Requests */}
          <Card className="p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-black flex items-center gap-2"><CalendarDays size={18} /> Pending Leave</h2>
              <Link to="/hr/leave" className="flex items-center gap-1 text-sm text-red-800 hover:text-red-900 font-medium">Review <ArrowRight size={14} /></Link>
            </div>
            <p className="text-3xl font-bold text-black mt-3">{pendingLeave.length}</p>
            <p className="text-xs text-neutral-400 mt-1">request{pendingLeave.length === 1 ? "" : "s"} awaiting approval</p>
          </Card>
        </div>
      </div>
    </div>
  );
}
