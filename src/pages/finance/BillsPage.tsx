import { useEffect, useMemo, useState } from "react";
import {
  CreditCard, Plus, Check, ThumbsUp, Trash2, AlertTriangle, Clock, Wallet,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DeleteConfirmModal } from "@/components/DeleteConfirmModal";
import {
  PageHeader, PrimaryButton, Card, LoadingState, EmptyState, Field, inputClass,
  StatusBadge, toneForStatus, StatCard,
} from "@/components/ui/shared";
import {
  subscribeBills, addBill, updateBill, deleteBill, subscribeSuppliers,
} from "@/lib/db";
import { Timestamp } from "firebase/firestore";
import { cn, formatCurrency, formatDate, toJsDate, dateStringToTimestamp } from "@/lib/utils";
import type { Bill, BillStatus, Supplier } from "@/types";

const CATEGORIES = [
  "Software", "Logistics", "Office", "Utilities",
  "Professional Services", "Raw Materials", "Other",
];

function isOverdue(b: Bill): boolean {
  if (b.status === "Paid") return false;
  const due = toJsDate(b.dueDate);
  return !!due && due.getTime() < Date.now();
}

function inThisMonth(d: Date | null): boolean {
  if (!d) return false;
  const now = new Date();
  return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
}

export default function BillsPage() {
  const [bills, setBills] = useState<Bill[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState("");

  const [formOpen, setFormOpen] = useState(false);
  const [toDelete, setToDelete] = useState<Bill | null>(null);

  const [supplierId, setSupplierId] = useState("");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState(0);
  const [category, setCategory] = useState("Software");
  const [billDate, setBillDate] = useState(new Date().toISOString().slice(0, 10));
  const [dueDate, setDueDate] = useState("");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const unsubs = [
      subscribeBills((rows) => { setBills(rows); setLoading(false); }),
      subscribeSuppliers(setSuppliers),
    ];
    return () => unsubs.forEach((u) => u());
  }, []);

  // Auto-flag overdue
  useEffect(() => {
    bills.forEach((b) => {
      if ((b.status === "Pending" || b.status === "Approved") && isOverdue(b)) {
        updateBill(b.id, { status: "Overdue" });
      }
    });
  }, [bills]);

  const supplierName = (id: string) => suppliers.find((s) => s.id === id)?.name ?? "Unknown";

  const filtered = useMemo(
    () => bills
      .filter((b) => !filterStatus || b.status === filterStatus)
      .sort((a, b) => (toJsDate(a.dueDate)?.getTime() ?? Infinity) - (toJsDate(b.dueDate)?.getTime() ?? Infinity)),
    [bills, filterStatus]
  );

  const totalPending = bills.filter((b) => b.status === "Pending" || b.status === "Approved").reduce((s, b) => s + b.amount, 0);
  const totalOverdue = bills.filter((b) => b.status === "Overdue" || ((b.status === "Pending" || b.status === "Approved") && isOverdue(b))).reduce((s, b) => s + b.amount, 0);
  const paidThisMonth = bills.filter((b) => b.status === "Paid" && inThisMonth(toJsDate(b.paidDate))).reduce((s, b) => s + b.amount, 0);

  function openCreate() {
    setSupplierId(""); setDescription(""); setAmount(0); setCategory("Software");
    setBillDate(new Date().toISOString().slice(0, 10)); setDueDate(""); setReference("");
    setNotes(""); setError(""); setFormOpen(true);
  }

  async function handleSave() {
    if (!supplierId) { setError("Select a supplier"); return; }
    if (!description.trim()) { setError("Description is required"); return; }
    if (!amount || amount <= 0) { setError("Enter a valid amount"); return; }
    try {
      await addBill({
        supplierId, description: description.trim(), amount, category,
        status: "Pending", billDate: dateStringToTimestamp(billDate) ?? Timestamp.now(),
        dueDate: dateStringToTimestamp(dueDate), reference, notes,
      } as Omit<Bill, "id" | "createdAt">);
      setFormOpen(false);
    } catch (err) { setError("Failed to save. " + (err as Error).message); }
  }

  if (loading) return <LoadingState />;

  return (
    <div className="max-w-6xl mx-auto">
      <PageHeader
        icon={CreditCard}
        title="Bills & Payables"
        subtitle="Track money you owe"
        actions={<PrimaryButton onClick={openCreate}><Plus size={16} /> New Bill</PrimaryButton>}
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <StatCard label="Total Pending" value={formatCurrency(totalPending)} icon={Clock} hint="Pending + approved" accent />
        <StatCard label="Total Overdue" value={formatCurrency(totalOverdue)} icon={AlertTriangle} hint="Need payment" />
        <StatCard label="Paid This Month" value={formatCurrency(paidThisMonth)} icon={Wallet} />
      </div>

      <div className="flex flex-wrap gap-3 mb-5">
        <select className={cn(inputClass, "max-w-[180px]")} value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
          <option value="">All Statuses</option>
          {(["Pending", "Approved", "Paid", "Overdue"] as BillStatus[]).map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      <Card className="overflow-hidden">
        {filtered.length === 0 ? (
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
                {filtered.map((b) => (
                  <tr key={b.id} className={cn("hover:bg-neutral-50", isOverdue(b) && "bg-red-50/40")}>
                    <td className="px-5 py-3 font-medium text-black">{b.description}</td>
                    <td className="px-5 py-3 text-neutral-600">{supplierName(b.supplierId)}</td>
                    <td className="px-5 py-3 font-semibold text-black">{formatCurrency(b.amount)}</td>
                    <td className="px-5 py-3 text-neutral-600">{b.billDate ? formatDate(toJsDate(b.billDate)!) : "—"}</td>
                    <td className={cn("px-5 py-3", isOverdue(b) ? "text-red-600 font-medium" : "text-neutral-600")}>{b.dueDate ? formatDate(toJsDate(b.dueDate)!) : "—"}</td>
                    <td className="px-5 py-3"><StatusBadge label={b.status} tone={toneForStatus(b.status)} /></td>
                    <td className="px-5 py-3 text-right">
                      <div className="flex gap-1 justify-end">
                        {b.status === "Pending" && <button onClick={() => updateBill(b.id, { status: "Approved" })} className="px-2 py-1 text-xs rounded bg-blue-50 text-blue-700 hover:bg-blue-100 flex items-center gap-1"><ThumbsUp size={12} /> Approve</button>}
                        {b.status !== "Paid" && <button onClick={() => updateBill(b.id, { status: "Paid", paidDate: Timestamp.now() })} className="px-2 py-1 text-xs rounded bg-green-50 text-green-700 hover:bg-green-100 flex items-center gap-1"><Check size={12} /> Mark Paid</button>}
                        <button onClick={() => setToDelete(b)} className="p-1.5 rounded-md hover:bg-red-50 text-red-600"><Trash2 size={14} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="sm:max-w-lg bg-white max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>New Bill</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <Field label="Description"><input className={inputClass} value={description} onChange={(e) => setDescription(e.target.value)} /></Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Supplier">
                <select className={inputClass} value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
                  <option value="">Select supplier</option>
                  {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </Field>
              <Field label="Amount (RM)"><input type="number" min={0} step="0.01" className={inputClass} value={amount || ""} onChange={(e) => setAmount(parseFloat(e.target.value) || 0)} /></Field>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Category">
                <select className={inputClass} value={category} onChange={(e) => setCategory(e.target.value)}>
                  {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </Field>
              <Field label="Reference"><input className={inputClass} value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Supplier invoice #" /></Field>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Bill Date"><input type="date" className={inputClass} value={billDate} onChange={(e) => setBillDate(e.target.value)} /></Field>
              <Field label="Due Date"><input type="date" className={inputClass} value={dueDate} onChange={(e) => setDueDate(e.target.value)} /></Field>
            </div>
            <Field label="Notes"><textarea className={inputClass} rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
            {error && <p className="text-red-700 text-sm">{error}</p>}
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setFormOpen(false)} className="px-4 py-2 text-sm font-medium text-neutral-600 hover:bg-neutral-100 rounded-lg">Cancel</button>
              <PrimaryButton onClick={handleSave}>Create Bill</PrimaryButton>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <DeleteConfirmModal
        isOpen={!!toDelete}
        onClose={() => setToDelete(null)}
        onConfirm={async () => { if (toDelete) await deleteBill(toDelete.id); setToDelete(null); }}
        title="Delete Bill"
        description={`Delete bill "${toDelete?.description}"?`}
      />
    </div>
  );
}
