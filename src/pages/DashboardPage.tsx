import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  TrendingUp, TrendingDown, DollarSign, ListChecks, AlertTriangle, FolderKanban,
  Target, Handshake, ReceiptText, ArrowRight, CalendarClock, Activity as ActivityIcon,
  Plus, FilePlus, Wallet, UserPlus, CreditCard, CalendarDays, HeartPulse,
} from "lucide-react";
import { motion } from "framer-motion";
import {
  Card, LoadingState, StatCard, StatusBadge, toneForStatus, toneForPriority, EmptyState,
} from "@/components/ui/shared";
import {
  subscribeTasks, subscribeProjects, subscribeLeads, subscribeDeals,
  subscribeInvoices, subscribeExpenses, subscribeDepartments, getAuditLogs,
  subscribeLeaveRequests, subscribeBills, subscribeSuppliers, subscribeMonthlyTargets,
} from "@/lib/db";
import { useAuth } from "@/lib/auth-context";
import { cn, formatCurrency, formatDate, toJsDate } from "@/lib/utils";
import type {
  Task, Project, Lead, Deal, Invoice, Expense, Department, AuditLog,
  ProjectStatus, LeadStage, LeaveRequest, Bill, Supplier, MonthlyTarget,
} from "@/types";

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

function invoiceAgingDays(inv: Invoice): number {
  const due = toJsDate(inv.dueDate);
  if (!due) return 0;
  return Math.floor((Date.now() - due.getTime()) / 86400000);
}

function billIsOverdue(b: Bill): boolean {
  if (b.status === "Paid") return false;
  const due = toJsDate(b.dueDate);
  return !!due && due.getTime() < Date.now();
}

const PROJECT_STATUSES: ProjectStatus[] = ["Planning", "Active", "On Hold", "Completed", "Cancelled"];
const LEAD_STAGES: LeadStage[] = ["New", "Contacted", "Qualified", "Proposal", "Negotiation", "Won", "Lost"];

const QUICK_ACTIONS = [
  { label: "New Task", icon: Plus, to: "/tasks?action=new" },
  { label: "New Invoice", icon: FilePlus, to: "/finance/invoices?action=new" },
  { label: "Log Expense", icon: Wallet, to: "/finance/expenses?action=new" },
  { label: "New Lead", icon: UserPlus, to: "/crm/leads?action=new" },
];

export default function DashboardPage() {
  const { role } = useAuth();
  const navigate = useNavigate();

  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [audit, setAudit] = useState<AuditLog[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [bills, setBills] = useState<Bill[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
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
      getAuditLogs((rows) => setAudit(rows.slice(0, 8))),
      subscribeLeaveRequests(setLeaveRequests),
      subscribeBills(setBills),
      subscribeSuppliers(setSuppliers),
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
  const expensesThisMonth = expenses.filter((e) => inThisMonth(toJsDate(e.date))).reduce((s, e) => s + e.amount, 0);
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

  // ── Business Health Score ────────────────────────────────────────────────
  const healthFactors = useMemo(() => {
    const factors: { label: string; delta: number }[] = [];
    let score = 50;
    factors.push({ label: "Base score", delta: 0 });

    const overduePenalty = Math.min(25, overdueTasks.length * 5);
    if (overduePenalty > 0) { score -= overduePenalty; factors.push({ label: `${overdueTasks.length} overdue task(s)`, delta: -overduePenalty }); }

    const has90 = outstandingInvoices.some((i) => invoiceAgingDays(i) > 90);
    const has61 = outstandingInvoices.some((i) => { const d = invoiceAgingDays(i); return d > 60 && d <= 90; });
    if (has90) { score -= 10; factors.push({ label: "Invoices aged 90+ days", delta: -10 }); }
    else if (has61) { score -= 5; factors.push({ label: "Invoices aged 61-90 days", delta: -5 }); }

    if (netProfit > 0) { score += 20; factors.push({ label: "Positive cash position", delta: +20 }); }
    else { score -= 10; factors.push({ label: "Operating at a loss", delta: -10 }); }

    if (pipelineValue > 0) { score += 10; factors.push({ label: "Active sales pipeline", delta: +10 }); }

    const projBonus = Math.min(15, activeProjects.length * 5);
    if (projBonus > 0) { score += projBonus; factors.push({ label: `${activeProjects.length} active project(s)`, delta: +projBonus }); }

    score = Math.max(0, Math.min(100, score));
    return { score, factors };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [overdueTasks.length, outstandingInvoices, netProfit, pipelineValue, activeProjects.length]);

  const score = healthFactors.score;
  const scoreColor = score >= 81 ? "#16a34a" : score >= 61 ? "#ca8a04" : score >= 31 ? "#d97706" : "#dc2626";
  const scoreLabel = score >= 81 ? "Excellent" : score >= 61 ? "Good" : score >= 31 ? "Fair" : "Poor";

  // top 3 factors (largest magnitude, excluding base)
  const topFactors = useMemo(
    () => healthFactors.factors.filter((f) => f.delta !== 0).sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta)).slice(0, 3),
    [healthFactors]
  );

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

  const leadFunnel = LEAD_STAGES.map((s) => ({ stage: s, count: leads.filter((l) => l.stage === s).length }));
  const maxFunnel = Math.max(1, ...leadFunnel.map((f) => f.count));

  // ── Briefing ─────────────────────────────────────────────────────────────
  const hour = now.getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const roleLabel = role ?? "Executive";
  const dateLabel = now.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  // SVG gauge geometry (semicircle): radius 45, half-circumference ≈ 141.5
  const RADIUS = 45;
  const HALF_CIRC = Math.PI * RADIUS;
  const filledArc = (score / 100) * HALF_CIRC;

  if (loading) return <LoadingState />;

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* ── Section 1: Morning Briefing ─────────────────────────────────── */}
      <Card className="border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50 p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-black">{greeting}, {roleLabel}</h1>
            <p className="text-sm text-neutral-500 mt-0.5">{dateLabel}</p>
          </div>
          <span className="text-xs font-medium text-amber-700 bg-amber-100 border border-amber-200 px-3 py-1 rounded-full">CEO Mode</span>
        </div>
        <p className="text-sm text-neutral-700 mt-4 leading-relaxed max-w-3xl">
          You have <span className="font-semibold text-red-800">{overdueTasks.length}</span> overdue task{overdueTasks.length === 1 ? "" : "s"},{" "}
          <span className="font-semibold text-red-800">{formatCurrency(outstandingTotal)}</span> in unpaid invoices,{" "}
          <span className="font-semibold text-red-800">{negotiationLeads.length}</span> lead{negotiationLeads.length === 1 ? "" : "s"} in negotiation, and{" "}
          <span className="font-semibold text-red-800">{pendingLeave.length}</span> pending leave request{pendingLeave.length === 1 ? "" : "s"}.{" "}
          Net profit this month is <span className={cn("font-semibold", netProfit >= 0 ? "text-green-700" : "text-red-700")}>{formatCurrency(netProfit)}</span>.
        </p>
      </Card>

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
        <motion.div variants={{ hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0 } }}>
          <div className="bg-white rounded-2xl shadow-sm border border-neutral-200 p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-neutral-500 uppercase tracking-wide">Revenue (Month)</span>
              <div className="p-2 rounded-lg bg-red-800 text-white"><TrendingUp size={16} /></div>
            </div>
            <p className="text-2xl font-bold text-black">{formatCurrency(revenueThisMonth)}</p>
            {revenueTarget > 0 ? (
              <>
                <div className="h-1.5 bg-neutral-100 rounded-full overflow-hidden mt-2"><div className="h-full bg-red-800 rounded-full" style={{ width: `${revenuePct}%` }} /></div>
                <p className="text-xs text-neutral-400 mt-1">{revenuePct.toFixed(0)}% of {formatCurrency(revenueTarget)} target</p>
              </>
            ) : <p className="text-xs text-neutral-400 mt-1">No target set</p>}
          </div>
        </motion.div>

        <motion.div variants={{ hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0 } }}>
          <div className="bg-white rounded-2xl shadow-sm border border-neutral-200 p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-neutral-500 uppercase tracking-wide">Expenses (Month)</span>
              <div className="p-2 rounded-lg bg-black text-white"><TrendingDown size={16} /></div>
            </div>
            <p className="text-2xl font-bold text-black">{formatCurrency(expensesThisMonth)}</p>
            {expensesBudget > 0 ? (
              <>
                <div className="h-1.5 bg-neutral-100 rounded-full overflow-hidden mt-2"><div className={cn("h-full rounded-full", expensePct >= 100 ? "bg-red-700" : "bg-black")} style={{ width: `${expensePct}%` }} /></div>
                <p className="text-xs text-neutral-400 mt-1">{expensePct.toFixed(0)}% of {formatCurrency(expensesBudget)} budget</p>
              </>
            ) : <p className="text-xs text-neutral-400 mt-1">No budget set</p>}
          </div>
        </motion.div>

        <motion.div variants={{ hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0 } }}>
          <div className="bg-white rounded-2xl shadow-sm border border-neutral-200 p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-neutral-500 uppercase tracking-wide">Net Profit</span>
              <div className={cn("p-2 rounded-lg text-white", netProfit >= 0 ? "bg-green-600" : "bg-red-700")}><DollarSign size={16} /></div>
            </div>
            <p className={cn("text-2xl font-bold", netProfit >= 0 ? "text-green-700" : "text-red-700")}>{formatCurrency(netProfit)}</p>
            <p className="text-xs text-neutral-400 mt-1">{netProfit >= 0 ? "Profit this month" : "Loss this month"}</p>
          </div>
        </motion.div>

        <motion.div variants={{ hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0 } }}>
          <div className="bg-white rounded-2xl shadow-sm border border-neutral-200 p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-neutral-500 uppercase tracking-wide">Outstanding Invoices</span>
              <div className="p-2 rounded-lg bg-black text-white"><ReceiptText size={16} /></div>
            </div>
            <p className="text-2xl font-bold text-black">{formatCurrency(outstandingTotal)}</p>
            <p className="text-xs text-neutral-400 mt-1">{outstandingInvoices.length} invoice{outstandingInvoices.length === 1 ? "" : "s"} unpaid</p>
          </div>
        </motion.div>

        {/* Row 2 — Operations */}
        <motion.div variants={{ hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0 } }}>
          <div className="bg-white rounded-2xl shadow-sm border border-neutral-200 p-5">
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

        <motion.div variants={{ hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0 } }}>
          <div className="bg-white rounded-2xl shadow-sm border border-neutral-200 p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-neutral-500 uppercase tracking-wide">Active Projects</span>
              <div className="p-2 rounded-lg bg-black text-white"><FolderKanban size={16} /></div>
            </div>
            <p className="text-2xl font-bold text-black">{activeProjects.length}</p>
            <p className="text-xs text-neutral-400 mt-1">{projectPct}% of {projects.length} total</p>
          </div>
        </motion.div>

        <motion.div variants={{ hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0 } }}>
          <StatCard label="Pipeline Value" value={formatCurrency(pipelineValue)} icon={Handshake} hint="Active deals" />
        </motion.div>

        <motion.div variants={{ hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0 } }}>
          <StatCard label="Open Leads" value={openLeads.length} icon={Target} hint={`${negotiationLeads.length} in negotiation`} />
        </motion.div>
      </motion.div>

      {/* ── Section 4: Business Health Score ────────────────────────────── */}
      <Card className="p-6">
        <div className="flex flex-col md:flex-row items-center gap-8">
          <div className="flex flex-col items-center shrink-0">
            <div className="relative">
              <svg viewBox="0 0 100 60" className="w-56 h-32">
                {/* track */}
                <path d="M 5 55 A 45 45 0 0 1 95 55" fill="none" stroke="#e5e5e5" strokeWidth="9" strokeLinecap="round" />
                {/* filled arc */}
                <path d="M 5 55 A 45 45 0 0 1 95 55" fill="none" stroke={scoreColor} strokeWidth="9" strokeLinecap="round"
                  strokeDasharray={`${filledArc} ${HALF_CIRC}`} />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-end pb-1">
                <span className="text-4xl font-bold text-black leading-none">{score}</span>
                <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: scoreColor }}>{scoreLabel}</span>
              </div>
            </div>
          </div>
          <div className="flex-1 w-full">
            <h2 className="text-lg font-semibold text-black flex items-center gap-2 mb-1"><HeartPulse size={18} className="text-red-800" /> Business Health Score</h2>
            <p className="text-sm text-neutral-500 mb-4">An at-a-glance pulse of your operations and finances.</p>
            <ul className="space-y-2">
              {topFactors.length === 0 ? (
                <li className="text-sm text-neutral-500">All key indicators are nominal.</li>
              ) : topFactors.map((f, i) => (
                <li key={i} className="flex items-center gap-2 text-sm">
                  <span className={cn("w-1.5 h-1.5 rounded-full", f.delta > 0 ? "bg-green-500" : "bg-red-500")} />
                  <span className="text-neutral-700">{f.label}</span>
                  <span className={cn("ml-auto font-semibold", f.delta > 0 ? "text-green-600" : "text-red-600")}>{f.delta > 0 ? `+${f.delta}` : f.delta}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Card>

      {/* ── Section 5: Two-column layout ────────────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* LEFT COLUMN */}
        <div className="xl:col-span-2 space-y-6">
          {/* Open Tasks by Department */}
          <Card className="overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-200">
              <h2 className="text-lg font-semibold text-black">Open Tasks by Department</h2>
              <Link to="/tasks" className="flex items-center gap-1 text-sm text-red-800 hover:text-red-900 font-medium">View All <ArrowRight size={14} /></Link>
            </div>
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
          </Card>

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

          {/* Upcoming Bills */}
          <Card className="overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-200">
              <h2 className="text-lg font-semibold text-black flex items-center gap-2"><CreditCard size={18} /> Upcoming Bills</h2>
              <Link to="/finance/bills" className="flex items-center gap-1 text-sm text-red-800 hover:text-red-900 font-medium">View All <ArrowRight size={14} /></Link>
            </div>
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
          </Card>
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

          {/* Revenue vs Target */}
          <Card className="p-5">
            <h2 className="text-lg font-semibold text-black mb-3 flex items-center gap-2"><Target size={18} /> Revenue vs Target</h2>
            <div className="flex justify-between text-sm mb-1.5">
              <span className="text-neutral-600">{formatCurrency(revenueThisMonth)}</span>
              <span className="text-neutral-400">{revenueTarget > 0 ? formatCurrency(revenueTarget) : "No target"}</span>
            </div>
            <div className="h-3 bg-neutral-100 rounded-full overflow-hidden">
              <div className="h-full bg-red-800 rounded-full transition-all" style={{ width: `${revenuePct}%` }} />
            </div>
            <p className="text-xs text-neutral-400 mt-1.5">{revenueTarget > 0 ? `${revenuePct.toFixed(0)}% of monthly target` : "Set a target in Reports."}</p>
          </Card>

          {/* Lead Funnel */}
          <Card className="p-5">
            <h2 className="text-lg font-semibold text-black mb-4">Lead Funnel</h2>
            <div className="space-y-2">
              {leadFunnel.map((f) => (
                <div key={f.stage}>
                  <div className="flex justify-between text-xs text-neutral-500 mb-1"><span>{f.stage}</span><span>{f.count}</span></div>
                  <div className="h-2 bg-neutral-100 rounded-full overflow-hidden"><div className="h-full bg-red-800 rounded-full" style={{ width: `${(f.count / maxFunnel) * 100}%` }} /></div>
                </div>
              ))}
            </div>
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

          {/* Recent Activity */}
          <Card className="p-5">
            <h2 className="text-lg font-semibold text-black mb-4 flex items-center gap-2"><ActivityIcon size={18} /> Recent Activity</h2>
            {audit.length === 0 ? (
              <p className="text-sm text-neutral-400">No recent activity.</p>
            ) : (
              <div className="space-y-2.5">
                {audit.map((a) => (
                  <div key={a.id} className="text-sm">
                    <p className="text-neutral-700">{a.description}</p>
                    <p className="text-xs text-neutral-400">{a.module} · {a.createdAt ? formatDate(toJsDate(a.createdAt)!) : ""}</p>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
