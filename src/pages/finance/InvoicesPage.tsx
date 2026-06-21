import { useEffect, useMemo, useState } from "react";
import {
  ReceiptText, Plus, Send, Check, Trash2, Eye, AlertTriangle,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DeleteConfirmModal } from "@/components/DeleteConfirmModal";
import {
  PageHeader, PrimaryButton, Card, LoadingState, EmptyState, Field, inputClass,
  StatusBadge, toneForStatus, SearchInput, StatCard,
} from "@/components/ui/shared";
import LineItemEditor, { computeTotals, emptyLine } from "@/components/finance/LineItemEditor";
import {
  subscribeInvoices, addInvoice, updateInvoice, deleteInvoice, subscribeCustomers, addPayment,
} from "@/lib/db";
import { Timestamp } from "firebase/firestore";
import { cn, formatCurrency, formatDate, toJsDate, dateStringToTimestamp } from "@/lib/utils";
import type { Invoice, InvoiceLine, InvoiceStatus, Customer, PaymentMethod, Order } from "@/types";

const PAY_METHODS: PaymentMethod[] = ["Cash", "Bank Transfer", "Card", "Cheque", "E-Wallet"];

function isOverdue(inv: Invoice): boolean {
  if (inv.status === "Paid" || inv.status === "Cancelled") return false;
  const due = toJsDate(inv.dueDate);
  return !!due && due.getTime() < Date.now();
}

function agingBucket(inv: Invoice): string {
  const due = toJsDate(inv.dueDate);
  if (!due) return "—";
  const days = Math.floor((Date.now() - due.getTime()) / 86400000);
  if (days <= 0) return "Current";
  if (days <= 30) return "0-30";
  if (days <= 60) return "31-60";
  if (days <= 90) return "61-90";
  return "90+";
}

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("");

  const [formOpen, setFormOpen] = useState(false);
  const [payFor, setPayFor] = useState<Invoice | null>(null);
  const [toDelete, setToDelete] = useState<Invoice | null>(null);

  const [customerId, setCustomerId] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [notes, setNotes] = useState("");
  const [discount, setDiscount] = useState(0);
  const [lines, setLines] = useState<InvoiceLine[]>([emptyLine()]);
  const [error, setError] = useState("");

  const [payMethod, setPayMethod] = useState<PaymentMethod>("Bank Transfer");
  const [payDate, setPayDate] = useState(new Date().toISOString().slice(0, 10));

  useEffect(() => {
    const unsubs = [
      subscribeInvoices((rows) => { setInvoices(rows); setLoading(false); }),
      subscribeCustomers(setCustomers),
    ];
    return () => unsubs.forEach((u) => u());
  }, []);

  // Auto-flag overdue on load
  useEffect(() => {
    invoices.forEach((inv) => {
      if (inv.status === "Sent" && isOverdue(inv)) updateInvoice(inv.id, { status: "Overdue" });
    });
  }, [invoices]);

  const custName = (id: string) => customers.find((c) => c.id === id)?.company ?? "Unknown";

  const filtered = useMemo(
    () => invoices.filter((i) =>
      (i.number.toLowerCase().includes(search.toLowerCase()) || custName(i.customerId).toLowerCase().includes(search.toLowerCase())) &&
      (!filterStatus || i.status === filterStatus)
    ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [invoices, customers, search, filterStatus]
  );

  const outstanding = invoices.filter((i) => i.status === "Sent" || i.status === "Overdue").reduce((s, i) => s + i.grandTotal, 0);
  const paidTotal = invoices.filter((i) => i.status === "Paid").reduce((s, i) => s + i.grandTotal, 0);
  const overdueCount = invoices.filter((i) => i.status === "Overdue").length;

  function nextNumber(): string {
    const year = new Date().getFullYear().toString().slice(-2);
    const nums = invoices.map((i) => {
      const parts = i.number.split("/");
      return parseInt(parts[parts.length - 1] ?? "0", 10);
    });
    const seq = (nums.length > 0 ? Math.max(...nums) : 0) + 1;
    return `BZT/INV/${year}/${String(seq).padStart(3, "0")}`;
  }

  function openCreate() {
    setCustomerId(""); setDueDate(""); setNotes(""); setDiscount(0); setLines([emptyLine()]); setError(""); setFormOpen(true);
  }

  async function handleSave() {
    if (!customerId) { setError("Select a customer"); return; }
    const valid = lines.filter((l) => l.description.trim());
    if (valid.length === 0) { setError("Add at least one line item"); return; }
    const totals = computeTotals(valid, discount);
    try {
      await addInvoice({
        number: nextNumber(), customerId, lines: valid,
        subtotal: totals.subtotal, discount, taxTotal: totals.taxTotal, grandTotal: totals.grandTotal,
        notes, status: "Draft", issueDate: Timestamp.now(),
        dueDate: dateStringToTimestamp(dueDate),
      } as Omit<Invoice, "id" | "createdAt">);
      setFormOpen(false);
    } catch (err) { setError("Failed to save. " + (err as Error).message); }
  }

  async function markPaid() {
    if (!payFor) return;
    await updateInvoice(payFor.id, {
      status: "Paid", paidDate: dateStringToTimestamp(payDate), paymentMethod: payMethod,
    });
    await addPayment({
      invoiceId: payFor.id, amount: payFor.grandTotal, method: payMethod,
      paidDate: dateStringToTimestamp(payDate)!,
    } as Omit<import("@/types").Payment, "id" | "createdAt">);
    setPayFor(null);
  }

  // Map an invoice to the existing Order/PDF shape for the receipt template
  async function viewPdf(inv: Invoice) {
    const customer = customers.find((c) => c.id === inv.customerId);
    if (!customer) { alert("Customer not found"); return; }
    const order: Order = {
      id: inv.id, customerId: inv.customerId,
      status: inv.status === "Paid" ? "Paid" : "Quoted",
      items: inv.lines.map((l) => ({ id: l.id, description: l.description, quantity: l.quantity, unitPrice: l.unitPrice, total: l.total })),
      subtotal: inv.subtotal, discount: inv.discount, grandTotal: inv.grandTotal,
      dateIssued: toJsDate(inv.issueDate) ?? new Date(),
    };
    try {
      const { pdf } = await import("@react-pdf/renderer");
      const { ReceiptDocument } = await import("@/components/pdf/DocumentTemplates");
      const blob = await pdf(<ReceiptDocument order={order} customer={customer} />).toBlob();
      window.open(URL.createObjectURL(blob), "_blank");
    } catch (err) {
      console.error(err);
      alert("Failed to generate PDF");
    }
  }

  if (loading) return <LoadingState />;

  return (
    <div className="max-w-6xl mx-auto">
      <PageHeader
        icon={ReceiptText}
        title="Invoices"
        subtitle="Billing and receivables"
        actions={<PrimaryButton onClick={openCreate}><Plus size={16} /> New Invoice</PrimaryButton>}
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <StatCard label="Outstanding" value={formatCurrency(outstanding)} icon={ReceiptText} hint="Sent + overdue" accent />
        <StatCard label="Collected" value={formatCurrency(paidTotal)} icon={Check} hint="Paid invoices" />
        <StatCard label="Overdue" value={overdueCount} icon={AlertTriangle} hint="Need follow-up" />
      </div>

      <div className="flex flex-wrap gap-3 mb-5">
        <SearchInput value={search} onChange={setSearch} placeholder="Search invoices..." />
        <select className={cn(inputClass, "max-w-[180px]")} value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
          <option value="">All Statuses</option>
          {(["Draft", "Sent", "Paid", "Overdue", "Cancelled"] as InvoiceStatus[]).map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      <Card className="overflow-hidden">
        {filtered.length === 0 ? (
          <EmptyState icon={ReceiptText} label="No invoices found" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-neutral-50 text-neutral-500 uppercase text-xs border-b border-neutral-200">
                <tr>
                  <th className="px-5 py-3 font-medium">Number</th>
                  <th className="px-5 py-3 font-medium">Customer</th>
                  <th className="px-5 py-3 font-medium">Amount</th>
                  <th className="px-5 py-3 font-medium">Due</th>
                  <th className="px-5 py-3 font-medium">Aging</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {filtered.map((inv) => (
                  <tr key={inv.id} className={cn("hover:bg-neutral-50", isOverdue(inv) && "bg-red-50/40")}>
                    <td className="px-5 py-3 font-mono font-semibold text-red-800">{inv.number}</td>
                    <td className="px-5 py-3 font-medium text-black">{custName(inv.customerId)}</td>
                    <td className="px-5 py-3 font-semibold text-black">{formatCurrency(inv.grandTotal)}</td>
                    <td className="px-5 py-3 text-neutral-600">{inv.dueDate ? formatDate(toJsDate(inv.dueDate)!) : "—"}</td>
                    <td className="px-5 py-3 text-neutral-600">{agingBucket(inv)}</td>
                    <td className="px-5 py-3"><StatusBadge label={inv.status} tone={toneForStatus(inv.status)} /></td>
                    <td className="px-5 py-3 text-right">
                      <div className="flex gap-1 justify-end">
                        {inv.status === "Draft" && <button onClick={() => updateInvoice(inv.id, { status: "Sent" })} className="px-2 py-1 text-xs rounded bg-blue-50 text-blue-700 hover:bg-blue-100 flex items-center gap-1"><Send size={12} /> Send</button>}
                        {inv.status !== "Paid" && inv.status !== "Cancelled" && <button onClick={() => { setPayFor(inv); setPayDate(new Date().toISOString().slice(0, 10)); }} className="px-2 py-1 text-xs rounded bg-green-50 text-green-700 hover:bg-green-100 flex items-center gap-1"><Check size={12} /> Paid</button>}
                        <button onClick={() => viewPdf(inv)} className="p-1.5 rounded-md hover:bg-neutral-100 text-neutral-500"><Eye size={14} /></button>
                        <button onClick={() => setToDelete(inv)} className="p-1.5 rounded-md hover:bg-red-50 text-red-600"><Trash2 size={14} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Create form */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="sm:max-w-2xl bg-white max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>New Invoice</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="grid grid-cols-2 gap-4">
              <Field label="Customer">
                <select className={inputClass} value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
                  <option value="">Select customer</option>
                  {customers.map((c) => <option key={c.id} value={c.id}>{c.company}</option>)}
                </select>
              </Field>
              <Field label="Due Date"><input type="date" className={inputClass} value={dueDate} onChange={(e) => setDueDate(e.target.value)} /></Field>
            </div>
            <LineItemEditor lines={lines} discount={discount} onLinesChange={setLines} onDiscountChange={setDiscount} />
            <Field label="Notes"><textarea className={inputClass} rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
            {error && <p className="text-red-700 text-sm">{error}</p>}
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setFormOpen(false)} className="px-4 py-2 text-sm font-medium text-neutral-600 hover:bg-neutral-100 rounded-lg">Cancel</button>
              <PrimaryButton onClick={handleSave}>Create Invoice</PrimaryButton>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Mark paid */}
      <Dialog open={!!payFor} onOpenChange={(o) => !o && setPayFor(null)}>
        <DialogContent className="sm:max-w-md bg-white">
          <DialogHeader><DialogTitle>Mark as Paid — {payFor?.number}</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <p className="text-sm text-neutral-600">Amount: <span className="font-semibold text-black">{payFor && formatCurrency(payFor.grandTotal)}</span></p>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Payment Date"><input type="date" className={inputClass} value={payDate} onChange={(e) => setPayDate(e.target.value)} /></Field>
              <Field label="Method">
                <select className={inputClass} value={payMethod} onChange={(e) => setPayMethod(e.target.value as PaymentMethod)}>
                  {PAY_METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
              </Field>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setPayFor(null)} className="px-4 py-2 text-sm font-medium text-neutral-600 hover:bg-neutral-100 rounded-lg">Cancel</button>
              <PrimaryButton onClick={markPaid}>Confirm Payment</PrimaryButton>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <DeleteConfirmModal
        isOpen={!!toDelete}
        onClose={() => setToDelete(null)}
        onConfirm={async () => { if (toDelete) await deleteInvoice(toDelete.id); setToDelete(null); }}
        title="Delete Invoice"
        description={`Delete invoice "${toDelete?.number}"?`}
      />
    </div>
  );
}
