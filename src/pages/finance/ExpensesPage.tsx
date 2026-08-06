import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Wallet, Plus, Trash2, CreditCard, Check, ThumbsUp, AlertTriangle, Clock,
  Repeat, Pencil,
} from "lucide-react";
import { Timestamp } from "firebase/firestore";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DeleteConfirmModal } from "@/components/DeleteConfirmModal";
import {
  PrimaryButton, Card, LoadingState, EmptyState, Field, inputClass,
  StatusBadge, toneForStatus, StatCard, SearchInput,
} from "@/components/ui/shared";
import { usePageHeader } from "@/lib/page-header-context";
import {
  subscribeExpenses, addExpense, deleteExpense,
  subscribeBills, addBill, updateBill, deleteBill, subscribeSuppliers,
  subscribeSubscriptions, addSubscription, updateSubscription, deleteSubscription,
} from "@/lib/db";
import { cn, formatCurrency, formatDate, toJsDate, dateStringToTimestamp, toDateInputValue } from "@/lib/utils";
import type {
  Expense, Bill, BillStatus, Supplier, Subscription, BillingCycle, SubscriptionStatus, PaymentMethod,
} from "@/types";

type Tab = "expenses" | "bills" | "subscriptions";

const EXPENSE_CATEGORIES = ["Supplies", "Logistics", "Maintenance", "Utilities", "Marketing", "Other"];
const BILL_CATEGORIES = ["Software", "Logistics", "Office", "Utilities", "Professional Services", "Raw Materials", "Other"];
const SUB_CATEGORIES = ["Software", "Hosting", "Marketing", "Utilities", "Professional Services", "Other"];
const CYCLES: BillingCycle[] = ["Weekly", "Monthly", "Quarterly", "Yearly"];
const PAYMENT_METHODS: PaymentMethod[] = ["Cash", "Bank Transfer", "Card", "Cheque", "E-Wallet"];

function isBillOverdue(b: Bill): boolean {
  if (b.status === "Paid") return false;
  const due = toJsDate(b.dueDate);
  return !!due && due.getTime() < Date.now();
}

function inThisMonth(d: Date | null): boolean {
  if (!d) return false;
  const now = new Date();
  return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
}

function monthlyEquivalent(amount: number, cycle: BillingCycle): number {
  switch (cycle) {
    case "Weekly":    return amount * 4.345;
    case "Monthly":   return amount;
    case "Quarterly": return amount / 3;
    case "Yearly":    return amount / 12;
  }
}

function subRenewsSoon(s: Subscription): boolean {
  if (s.status !== "Active") return false;
  const d = toJsDate(s.nextRenewal ?? null);
  if (!d) return false;
  const daysAway = (d.getTime() - Date.now()) / 86400000;
  return daysAway >= 0 && daysAway <= 7;
}

function subIsOverdue(s: Subscription): boolean {
  if (s.status !== "Active") return false;
  const d = toJsDate(s.nextRenewal ?? null);
  return !!d && d.getTime() < Date.now();
}

export default function ExpensesPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [tab, setTab] = useState<Tab>("expenses");

  // ── Expenses ───────────────────────────────────────────────────────────────
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [expLoaded, setExpLoaded] = useState(false);
  const [expFormOpen, setExpFormOpen] = useState(false);
  const [expToDelete, setExpToDelete] = useState<Expense | null>(null);

  const [expCategory, setExpCategory] = useState(EXPENSE_CATEGORIES[0]);
  const [expAmount, setExpAmount] = useState("");
  const [expDescription, setExpDescription] = useState("");
  const [expError, setExpError] = useState("");
  const [expSaving, setExpSaving] = useState(false);

  useEffect(() => subscribeExpenses((rows) => {
    setExpenses([...rows].sort((a, b) => (toJsDate(b.date)?.getTime() ?? 0) - (toJsDate(a.date)?.getTime() ?? 0)));
    setExpLoaded(true);
  }), []);

  const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0);
  const expensesThisMonth = expenses.filter((e) => inThisMonth(toJsDate(e.date))).reduce((s, e) => s + e.amount, 0);

  function expOpenCreate() {
    setExpCategory(EXPENSE_CATEGORIES[0]); setExpAmount(""); setExpDescription(""); setExpError(""); setExpFormOpen(true);
  }

  useEffect(() => {
    if (searchParams.get("action") === "new") {
      setTab("expenses");
      expOpenCreate();
      setSearchParams((p) => { p.delete("action"); return p; }, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  async function expHandleSave() {
    const amt = parseFloat(expAmount);
    if (!amt || amt <= 0) { setExpError("Enter a valid amount"); return; }
    if (!expDescription.trim()) { setExpError("Description is required"); return; }
    setExpSaving(true); setExpError("");
    try {
      await addExpense({ category: expCategory, amount: amt, description: expDescription.trim() });
      setExpFormOpen(false);
    } catch (err) {
      setExpError("Failed to save. " + (err as Error).message);
    } finally {
      setExpSaving(false);
    }
  }

  // ── Bills & Payables ──────────────────────────────────────────────────────
  const [bills, setBills] = useState<Bill[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [billsLoaded, setBillsLoaded] = useState(false);
  const [suppliersLoaded, setSuppliersLoaded] = useState(false);
  const [billFilterStatus, setBillFilterStatus] = useState("");

  const [billFormOpen, setBillFormOpen] = useState(false);
  const [billToDelete, setBillToDelete] = useState<Bill | null>(null);

  const [billSupplierId, setBillSupplierId] = useState("");
  const [billDescription, setBillDescription] = useState("");
  const [billAmount, setBillAmount] = useState(0);
  const [billCategory, setBillCategory] = useState(BILL_CATEGORIES[0]);
  const [billDate, setBillDate] = useState(new Date().toISOString().slice(0, 10));
  const [billDueDate, setBillDueDate] = useState("");
  const [billReference, setBillReference] = useState("");
  const [billNotes, setBillNotes] = useState("");
  const [billError, setBillError] = useState("");

  useEffect(() => {
    const unsubs = [
      subscribeBills((rows) => { setBills(rows); setBillsLoaded(true); }),
      subscribeSuppliers((rows) => { setSuppliers(rows); setSuppliersLoaded(true); }),
    ];
    return () => unsubs.forEach((u) => u());
  }, []);

  // Auto-flag overdue
  useEffect(() => {
    bills.forEach((b) => {
      if ((b.status === "Pending" || b.status === "Approved") && isBillOverdue(b)) {
        updateBill(b.id, { status: "Overdue" });
      }
    });
  }, [bills]);

  const supplierName = (id: string) => suppliers.find((s) => s.id === id)?.name ?? "Unknown";

  const billsFiltered = useMemo(
    () => bills
      .filter((b) => !billFilterStatus || b.status === billFilterStatus)
      .sort((a, b) => (toJsDate(a.dueDate)?.getTime() ?? Infinity) - (toJsDate(b.dueDate)?.getTime() ?? Infinity)),
    [bills, billFilterStatus]
  );

  const totalPending = bills.filter((b) => b.status === "Pending" || b.status === "Approved").reduce((s, b) => s + b.amount, 0);
  const totalOverdue = bills.filter((b) => b.status === "Overdue" || ((b.status === "Pending" || b.status === "Approved") && isBillOverdue(b))).reduce((s, b) => s + b.amount, 0);
  const paidThisMonth = bills.filter((b) => b.status === "Paid" && inThisMonth(toJsDate(b.paidDate))).reduce((s, b) => s + b.amount, 0);

  function billOpenCreate() {
    setBillSupplierId(""); setBillDescription(""); setBillAmount(0); setBillCategory(BILL_CATEGORIES[0]);
    setBillDate(new Date().toISOString().slice(0, 10)); setBillDueDate(""); setBillReference("");
    setBillNotes(""); setBillError(""); setBillFormOpen(true);
  }

  async function billHandleSave() {
    if (!billSupplierId) { setBillError("Select a supplier"); return; }
    if (!billDescription.trim()) { setBillError("Description is required"); return; }
    if (!billAmount || billAmount <= 0) { setBillError("Enter a valid amount"); return; }
    try {
      await addBill({
        supplierId: billSupplierId, description: billDescription.trim(), amount: billAmount, category: billCategory,
        status: "Pending", billDate: dateStringToTimestamp(billDate) ?? Timestamp.now(),
        reference: billReference, notes: billNotes,
        ...(billDueDate ? { dueDate: dateStringToTimestamp(billDueDate) } : {}),
      } as Omit<Bill, "id" | "createdAt">);
      setBillFormOpen(false);
    } catch (err) { setBillError("Failed to save. " + (err as Error).message); }
  }

  // ── Subscriptions ──────────────────────────────────────────────────────────
  const [subs, setSubs] = useState<Subscription[]>([]);
  const [subsLoaded, setSubsLoaded] = useState(false);
  const [subSearch, setSubSearch] = useState("");

  const [subFormOpen, setSubFormOpen] = useState(false);
  const [subEditing, setSubEditing] = useState<Subscription | null>(null);
  const [subToDelete, setSubToDelete] = useState<Subscription | null>(null);

  const [subName, setSubName] = useState("");
  const [subVendor, setSubVendor] = useState("");
  const [subAmount, setSubAmount] = useState("");
  const [subBillingCycle, setSubBillingCycle] = useState<BillingCycle>("Monthly");
  const [subCategory, setSubCategory] = useState(SUB_CATEGORIES[0]);
  const [subStatus, setSubStatus] = useState<SubscriptionStatus>("Active");
  const [subNextRenewal, setSubNextRenewal] = useState(new Date().toISOString().slice(0, 10));
  const [subPaymentMethod, setSubPaymentMethod] = useState<PaymentMethod>("Card");
  const [subNotes, setSubNotes] = useState("");
  const [subError, setSubError] = useState("");

  useEffect(() => subscribeSubscriptions((rows) => { setSubs(rows); setSubsLoaded(true); }), []);

  const subsFiltered = useMemo(
    () => subs.filter((s) =>
      s.name.toLowerCase().includes(subSearch.toLowerCase()) ||
      (s.vendor ?? "").toLowerCase().includes(subSearch.toLowerCase())
    ),
    [subs, subSearch]
  );

  const activeSubs = subs.filter((s) => s.status === "Active");
  const monthlySpend = activeSubs.reduce((sum, s) => sum + monthlyEquivalent(s.amount, s.billingCycle), 0);
  const renewingSoonCount = subs.filter(subRenewsSoon).length;

  function subOpenCreate() {
    setSubEditing(null);
    setSubName(""); setSubVendor(""); setSubAmount(""); setSubBillingCycle("Monthly");
    setSubCategory(SUB_CATEGORIES[0]); setSubStatus("Active");
    setSubNextRenewal(new Date().toISOString().slice(0, 10));
    setSubPaymentMethod("Card"); setSubNotes(""); setSubError("");
    setSubFormOpen(true);
  }

  function subOpenEdit(s: Subscription) {
    setSubEditing(s);
    setSubName(s.name); setSubVendor(s.vendor ?? ""); setSubAmount(String(s.amount)); setSubBillingCycle(s.billingCycle);
    setSubCategory(s.category ?? SUB_CATEGORIES[0]); setSubStatus(s.status);
    setSubNextRenewal(s.nextRenewal ? toDateInputValue(s.nextRenewal) : new Date().toISOString().slice(0, 10));
    setSubPaymentMethod(s.paymentMethod ?? "Card"); setSubNotes(s.notes ?? ""); setSubError("");
    setSubFormOpen(true);
  }

  async function subHandleSave() {
    if (!subName.trim()) { setSubError("Name is required"); return; }
    const amt = parseFloat(subAmount);
    if (!amt || amt <= 0) { setSubError("Enter a valid amount"); return; }
    const payload = {
      name: subName.trim(), amount: amt, billingCycle: subBillingCycle,
      category: subCategory, status: subStatus,
      nextRenewal: dateStringToTimestamp(subNextRenewal) ?? Timestamp.now(),
      paymentMethod: subPaymentMethod,
      ...(subVendor.trim() ? { vendor: subVendor.trim() } : {}),
      ...(subNotes.trim() ? { notes: subNotes.trim() } : {}),
    };
    try {
      if (subEditing) await updateSubscription(subEditing.id, payload);
      else await addSubscription(payload);
      setSubFormOpen(false);
    } catch (err) {
      setSubError("Failed to save. " + (err as Error).message);
    }
  }

  const loading = !(expLoaded && billsLoaded && suppliersLoaded && subsLoaded);

  usePageHeader({
    actions: tab === "expenses" ? (
      <PrimaryButton onClick={expOpenCreate}><Plus size={16} /> Add Expense</PrimaryButton>
    ) : tab === "bills" ? (
      <PrimaryButton onClick={billOpenCreate}><Plus size={16} /> New Bill</PrimaryButton>
    ) : (
      <PrimaryButton onClick={subOpenCreate}><Plus size={16} /> New Subscription</PrimaryButton>
    ),
  });

  if (loading) return <LoadingState />;

  return (
    <div className="max-w-6xl mx-auto">
      <div className="inline-flex items-center gap-1 bg-neutral-100 rounded-xl p-1 mb-6">
        <button onClick={() => setTab("expenses")} className={cn("px-4 py-2 rounded-lg text-sm font-semibold transition", tab === "expenses" ? "bg-white text-black shadow-sm" : "text-neutral-500 hover:text-black")}>Expenses</button>
        <button onClick={() => setTab("bills")} className={cn("px-4 py-2 rounded-lg text-sm font-semibold transition", tab === "bills" ? "bg-white text-black shadow-sm" : "text-neutral-500 hover:text-black")}>Bills & Payables</button>
        <button onClick={() => setTab("subscriptions")} className={cn("px-4 py-2 rounded-lg text-sm font-semibold transition", tab === "subscriptions" ? "bg-white text-black shadow-sm" : "text-neutral-500 hover:text-black")}>Subscriptions</button>
      </div>

      {tab === "expenses" && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
            <StatCard label="Total Spent" value={formatCurrency(totalExpenses)} icon={Wallet} tone="blue" />
            <StatCard label="This Month" value={formatCurrency(expensesThisMonth)} icon={Wallet} tone="amber" />
          </div>

          <Card className="overflow-hidden">
            {expenses.length === 0 ? (
              <EmptyState icon={Wallet} label="No expenses recorded yet" />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-neutral-50 text-neutral-500 uppercase text-xs border-b border-neutral-200">
                    <tr>
                      <th className="px-5 py-3 font-medium">Date</th>
                      <th className="px-5 py-3 font-medium">Category</th>
                      <th className="px-5 py-3 font-medium">Description</th>
                      <th className="px-5 py-3 font-medium">Amount</th>
                      <th className="px-5 py-3 font-medium text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {expenses.map((exp) => (
                      <tr key={exp.id} className="hover:bg-neutral-50">
                        <td className="px-5 py-3 text-neutral-500 whitespace-nowrap">{exp.date ? formatDate(toJsDate(exp.date)!) : "—"}</td>
                        <td className="px-5 py-3"><span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-neutral-100 text-neutral-700 border border-neutral-200">{exp.category}</span></td>
                        <td className="px-5 py-3 text-neutral-600">{exp.description}</td>
                        <td className="px-5 py-3 font-semibold text-red-800">-{formatCurrency(exp.amount)}</td>
                        <td className="px-5 py-3 text-right">
                          <button onClick={() => setExpToDelete(exp)} className="p-1.5 rounded-md hover:bg-red-50 text-red-600"><Trash2 size={14} /></button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </>
      )}

      {tab === "bills" && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            <StatCard label="Total Pending" value={formatCurrency(totalPending)} icon={Clock} hint="Pending + approved" tone="amber" />
            <StatCard label="Total Overdue" value={formatCurrency(totalOverdue)} icon={AlertTriangle} hint="Need payment" tone="red" />
            <StatCard label="Paid This Month" value={formatCurrency(paidThisMonth)} icon={Wallet} tone="emerald" />
          </div>

          <div className="flex flex-wrap gap-3 mb-5">
            <select className={cn(inputClass, "max-w-[180px]")} value={billFilterStatus} onChange={(e) => setBillFilterStatus(e.target.value)}>
              <option value="">All Statuses</option>
              {(["Pending", "Approved", "Paid", "Overdue"] as BillStatus[]).map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          <Card className="overflow-hidden">
            {billsFiltered.length === 0 ? (
              <EmptyState icon={CreditCard} label="No bills found" />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-neutral-50 text-neutral-500 uppercase text-xs border-b border-neutral-200">
                    <tr>
                      <th className="px-5 py-3 font-medium">Description</th>
                      <th className="px-5 py-3 font-medium">Supplier</th>
                      <th className="px-5 py-3 font-medium">Amount</th>
                      <th className="px-5 py-3 font-medium">Bill Date</th>
                      <th className="px-5 py-3 font-medium">Due Date</th>
                      <th className="px-5 py-3 font-medium">Status</th>
                      <th className="px-5 py-3 font-medium text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {billsFiltered.map((b) => (
                      <tr key={b.id} className={cn("hover:bg-neutral-50", isBillOverdue(b) && "bg-red-50/40")}>
                        <td className="px-5 py-3 font-medium text-black">{b.description}</td>
                        <td className="px-5 py-3 text-neutral-600">{supplierName(b.supplierId)}</td>
                        <td className="px-5 py-3 font-semibold text-black">{formatCurrency(b.amount)}</td>
                        <td className="px-5 py-3 text-neutral-600">{b.billDate ? formatDate(toJsDate(b.billDate)!) : "—"}</td>
                        <td className={cn("px-5 py-3", isBillOverdue(b) ? "text-red-600 font-medium" : "text-neutral-600")}>{b.dueDate ? formatDate(toJsDate(b.dueDate)!) : "—"}</td>
                        <td className="px-5 py-3"><StatusBadge label={b.status} tone={toneForStatus(b.status)} /></td>
                        <td className="px-5 py-3 text-right">
                          <div className="flex gap-1 justify-end">
                            {b.status === "Pending" && <button onClick={() => updateBill(b.id, { status: "Approved" })} className="px-2 py-1 text-xs rounded bg-blue-50 text-blue-700 hover:bg-blue-100 flex items-center gap-1"><ThumbsUp size={12} /> Approve</button>}
                            {b.status !== "Paid" && <button onClick={() => updateBill(b.id, { status: "Paid", paidDate: Timestamp.now() })} className="px-2 py-1 text-xs rounded bg-green-50 text-green-700 hover:bg-green-100 flex items-center gap-1"><Check size={12} /> Mark Paid</button>}
                            <button onClick={() => setBillToDelete(b)} className="p-1.5 rounded-md hover:bg-red-50 text-red-600"><Trash2 size={14} /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </>
      )}

      {tab === "subscriptions" && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            <StatCard label="Active Subscriptions" value={activeSubs.length} icon={Repeat} tone="blue" />
            <StatCard label="Monthly Spend (est.)" value={formatCurrency(monthlySpend)} icon={Repeat} tone="amber" />
            <StatCard label="Renewing This Week" value={renewingSoonCount} icon={Repeat} tone="amber" />
          </div>

          <div className="flex flex-wrap gap-3 mb-5">
            <SearchInput value={subSearch} onChange={setSubSearch} placeholder="Search subscriptions..." />
          </div>

          <Card className="overflow-hidden">
            {subsFiltered.length === 0 ? (
              <EmptyState icon={Repeat} label="No subscriptions tracked yet" />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-neutral-50 text-neutral-500 uppercase text-xs border-b border-neutral-200">
                    <tr>
                      <th className="px-5 py-3 font-medium">Name</th>
                      <th className="px-5 py-3 font-medium">Category</th>
                      <th className="px-5 py-3 font-medium">Amount</th>
                      <th className="px-5 py-3 font-medium">Cycle</th>
                      <th className="px-5 py-3 font-medium">Next Renewal</th>
                      <th className="px-5 py-3 font-medium">Status</th>
                      <th className="px-5 py-3 font-medium text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {subsFiltered.map((s) => (
                      <tr key={s.id} className="hover:bg-neutral-50">
                        <td className="px-5 py-3">
                          <p className="font-medium text-black">{s.name}</p>
                          {s.vendor && <p className="text-xs text-neutral-400">{s.vendor}</p>}
                        </td>
                        <td className="px-5 py-3 text-neutral-600">{s.category ?? "—"}</td>
                        <td className="px-5 py-3 text-neutral-600">{formatCurrency(s.amount)}</td>
                        <td className="px-5 py-3 text-neutral-600">{s.billingCycle}</td>
                        <td className={cn("px-5 py-3", subIsOverdue(s) ? "text-red-600 font-medium" : subRenewsSoon(s) ? "text-amber-600 font-medium" : "text-neutral-600")}>
                          {s.nextRenewal ? formatDate(toJsDate(s.nextRenewal)!) : "—"}
                        </td>
                        <td className="px-5 py-3"><StatusBadge label={s.status} tone={toneForStatus(s.status)} /></td>
                        <td className="px-5 py-3 text-right">
                          <div className="flex gap-1 justify-end">
                            <button onClick={() => subOpenEdit(s)} className="p-1.5 rounded-md hover:bg-neutral-100 text-neutral-500"><Pencil size={14} /></button>
                            <button onClick={() => setSubToDelete(s)} className="p-1.5 rounded-md hover:bg-red-50 text-red-600"><Trash2 size={14} /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </>
      )}

      {/* ── Expense dialog ────────────────────────────────────────────────── */}
      <Dialog open={expFormOpen} onOpenChange={setExpFormOpen}>
        <DialogContent className="sm:max-w-lg bg-white">
          <DialogHeader><DialogTitle>Add Expense</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="grid grid-cols-2 gap-4">
              <Field label="Category">
                <select className={inputClass} value={expCategory} onChange={(e) => setExpCategory(e.target.value)}>
                  {EXPENSE_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </Field>
              <Field label="Amount (RM)"><input type="number" min="0" step="0.01" className={inputClass} value={expAmount} onChange={(e) => setExpAmount(e.target.value)} placeholder="0.00" /></Field>
            </div>
            <Field label="Description"><textarea className={inputClass} rows={3} value={expDescription} onChange={(e) => setExpDescription(e.target.value)} placeholder="What was this expense for?" /></Field>
            {expError && <p className="text-red-700 text-sm">{expError}</p>}
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setExpFormOpen(false)} className="px-4 py-2 text-sm font-medium text-neutral-600 hover:bg-neutral-100 rounded-lg">Cancel</button>
              <PrimaryButton onClick={expHandleSave} disabled={expSaving}>{expSaving ? "Saving..." : "Save Expense"}</PrimaryButton>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <DeleteConfirmModal
        isOpen={!!expToDelete}
        onClose={() => setExpToDelete(null)}
        onConfirm={async () => { if (expToDelete) await deleteExpense(expToDelete.id); setExpToDelete(null); }}
        title="Delete Expense"
        description={`Delete this expense record (${formatCurrency(expToDelete?.amount ?? 0)})?`}
      />

      {/* ── Bill dialog ───────────────────────────────────────────────────── */}
      <Dialog open={billFormOpen} onOpenChange={setBillFormOpen}>
        <DialogContent className="sm:max-w-lg bg-white max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>New Bill</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <Field label="Description"><input className={inputClass} value={billDescription} onChange={(e) => setBillDescription(e.target.value)} /></Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Supplier">
                <select className={inputClass} value={billSupplierId} onChange={(e) => setBillSupplierId(e.target.value)}>
                  <option value="">Select supplier</option>
                  {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </Field>
              <Field label="Amount (RM)"><input type="number" min={0} step="0.01" className={inputClass} value={billAmount || ""} onChange={(e) => setBillAmount(parseFloat(e.target.value) || 0)} /></Field>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Category">
                <select className={inputClass} value={billCategory} onChange={(e) => setBillCategory(e.target.value)}>
                  {BILL_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </Field>
              <Field label="Reference"><input className={inputClass} value={billReference} onChange={(e) => setBillReference(e.target.value)} placeholder="Supplier invoice #" /></Field>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Bill Date"><input type="date" className={inputClass} value={billDate} onChange={(e) => setBillDate(e.target.value)} /></Field>
              <Field label="Due Date"><input type="date" className={inputClass} value={billDueDate} onChange={(e) => setBillDueDate(e.target.value)} /></Field>
            </div>
            <Field label="Notes"><textarea className={inputClass} rows={2} value={billNotes} onChange={(e) => setBillNotes(e.target.value)} /></Field>
            {billError && <p className="text-red-700 text-sm">{billError}</p>}
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setBillFormOpen(false)} className="px-4 py-2 text-sm font-medium text-neutral-600 hover:bg-neutral-100 rounded-lg">Cancel</button>
              <PrimaryButton onClick={billHandleSave}>Create Bill</PrimaryButton>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <DeleteConfirmModal
        isOpen={!!billToDelete}
        onClose={() => setBillToDelete(null)}
        onConfirm={async () => { if (billToDelete) await deleteBill(billToDelete.id); setBillToDelete(null); }}
        title="Delete Bill"
        description={`Delete bill "${billToDelete?.description}"?`}
      />

      {/* ── Subscription dialog ───────────────────────────────────────────── */}
      <Dialog open={subFormOpen} onOpenChange={setSubFormOpen}>
        <DialogContent className="sm:max-w-lg bg-white max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{subEditing ? "Edit Subscription" : "New Subscription"}</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="grid grid-cols-2 gap-4">
              <Field label="Name"><input className={inputClass} value={subName} onChange={(e) => setSubName(e.target.value)} placeholder="e.g. Google Workspace" /></Field>
              <Field label="Vendor"><input className={inputClass} value={subVendor} onChange={(e) => setSubVendor(e.target.value)} /></Field>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Amount (RM)"><input type="number" min="0" step="0.01" className={inputClass} value={subAmount} onChange={(e) => setSubAmount(e.target.value)} /></Field>
              <Field label="Billing Cycle">
                <select className={inputClass} value={subBillingCycle} onChange={(e) => setSubBillingCycle(e.target.value as BillingCycle)}>
                  {CYCLES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Category">
                <select className={inputClass} value={subCategory} onChange={(e) => setSubCategory(e.target.value)}>
                  {SUB_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </Field>
              <Field label="Status">
                <select className={inputClass} value={subStatus} onChange={(e) => setSubStatus(e.target.value as SubscriptionStatus)}>
                  <option value="Active">Active</option>
                  <option value="Cancelled">Cancelled</option>
                </select>
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Next Renewal"><input type="date" className={inputClass} value={subNextRenewal} onChange={(e) => setSubNextRenewal(e.target.value)} /></Field>
              <Field label="Payment Method">
                <select className={inputClass} value={subPaymentMethod} onChange={(e) => setSubPaymentMethod(e.target.value as PaymentMethod)}>
                  {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
              </Field>
            </div>
            <Field label="Notes"><textarea className={inputClass} rows={2} value={subNotes} onChange={(e) => setSubNotes(e.target.value)} /></Field>
            {subError && <p className="text-red-700 text-sm">{subError}</p>}
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setSubFormOpen(false)} className="px-4 py-2 text-sm font-medium text-neutral-600 hover:bg-neutral-100 rounded-lg">Cancel</button>
              <PrimaryButton onClick={subHandleSave}>{subEditing ? "Save Changes" : "Create Subscription"}</PrimaryButton>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <DeleteConfirmModal
        isOpen={!!subToDelete}
        onClose={() => setSubToDelete(null)}
        onConfirm={async () => { if (subToDelete) await deleteSubscription(subToDelete.id); setSubToDelete(null); }}
        title="Delete Subscription"
        description={`Delete "${subToDelete?.name}"?`}
      />
    </div>
  );
}
