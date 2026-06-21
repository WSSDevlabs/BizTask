import { useEffect, useMemo, useState } from "react";
import {
  FileSpreadsheet, Plus, Send, Check, X, Trash2, Eye, ArrowUpRight,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DeleteConfirmModal } from "@/components/DeleteConfirmModal";
import {
  PageHeader, PrimaryButton, Card, LoadingState, EmptyState, Field, inputClass,
  StatusBadge, toneForStatus, SearchInput,
} from "@/components/ui/shared";
import LineItemEditor, { computeTotals, emptyLine } from "@/components/finance/LineItemEditor";
import {
  subscribeQuotations, addQuotation, updateQuotation, deleteQuotation,
  subscribeCustomers, addInvoice,
} from "@/lib/db";
import { Timestamp } from "firebase/firestore";
import { cn, formatCurrency, formatDate, toJsDate, dateStringToTimestamp } from "@/lib/utils";
import type { Quotation, InvoiceLine, QuotationStatus, Customer, Order, Invoice } from "@/types";

export default function QuotationsPage() {
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("");

  const [formOpen, setFormOpen] = useState(false);
  const [toDelete, setToDelete] = useState<Quotation | null>(null);

  const [customerId, setCustomerId] = useState("");
  const [validUntil, setValidUntil] = useState("");
  const [notes, setNotes] = useState("");
  const [discount, setDiscount] = useState(0);
  const [lines, setLines] = useState<InvoiceLine[]>([emptyLine()]);
  const [error, setError] = useState("");

  useEffect(() => {
    const unsubs = [
      subscribeQuotations((rows) => { setQuotations(rows); setLoading(false); }),
      subscribeCustomers(setCustomers),
    ];
    return () => unsubs.forEach((u) => u());
  }, []);

  const custName = (id: string) => customers.find((c) => c.id === id)?.company ?? "Unknown";

  const filtered = useMemo(
    () => quotations.filter((q) =>
      (q.number.toLowerCase().includes(search.toLowerCase()) || custName(q.customerId).toLowerCase().includes(search.toLowerCase())) &&
      (!filterStatus || q.status === filterStatus)
    ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [quotations, customers, search, filterStatus]
  );

  function nextNumber(): string {
    const year = new Date().getFullYear().toString().slice(-2);
    const nums = quotations.map((q) => {
      const parts = q.number.split("/");
      return parseInt(parts[parts.length - 1] ?? "0", 10);
    });
    const seq = (nums.length > 0 ? Math.max(...nums) : 0) + 1;
    return `BZT/QT/${year}/${String(seq).padStart(3, "0")}`;
  }

  function openCreate() {
    setCustomerId(""); setValidUntil(""); setNotes(""); setDiscount(0); setLines([emptyLine()]); setError(""); setFormOpen(true);
  }

  async function handleSave() {
    if (!customerId) { setError("Select a customer"); return; }
    const valid = lines.filter((l) => l.description.trim());
    if (valid.length === 0) { setError("Add at least one line item"); return; }
    const totals = computeTotals(valid, discount);
    try {
      await addQuotation({
        number: nextNumber(), customerId, lines: valid,
        subtotal: totals.subtotal, discount, taxTotal: totals.taxTotal, grandTotal: totals.grandTotal,
        notes, status: "Draft", issueDate: Timestamp.now(),
        validUntil: dateStringToTimestamp(validUntil),
      } as Omit<Quotation, "id" | "createdAt">);
      setFormOpen(false);
    } catch (err) { setError("Failed to save. " + (err as Error).message); }
  }

  async function convertToInvoice(q: Quotation) {
    const year = new Date().getFullYear().toString().slice(-2);
    const invId = await addInvoice({
      number: `BZT/INV/${year}/${String(Date.now()).slice(-3)}`,
      customerId: q.customerId, lines: q.lines, subtotal: q.subtotal, discount: q.discount,
      taxTotal: q.taxTotal, grandTotal: q.grandTotal, notes: q.notes, status: "Draft",
      issueDate: Timestamp.now(),
    } as Omit<Invoice, "id" | "createdAt">);
    await updateQuotation(q.id, { convertedInvoiceId: invId });
  }

  async function viewPdf(q: Quotation) {
    const customer = customers.find((c) => c.id === q.customerId);
    if (!customer) { alert("Customer not found"); return; }
    const order: Order = {
      id: q.id, customerId: q.customerId, status: "Quoted",
      items: q.lines.map((l) => ({ id: l.id, description: l.description, quantity: l.quantity, unitPrice: l.unitPrice, total: l.total })),
      subtotal: q.subtotal, discount: q.discount, grandTotal: q.grandTotal,
      dateIssued: toJsDate(q.issueDate) ?? new Date(),
    };
    try {
      const { pdf } = await import("@react-pdf/renderer");
      const { QuotationDocument } = await import("@/components/pdf/DocumentTemplates");
      const blob = await pdf(<QuotationDocument order={order} customer={customer} />).toBlob();
      window.open(URL.createObjectURL(blob), "_blank");
    } catch (err) { console.error(err); alert("Failed to generate PDF"); }
  }

  if (loading) return <LoadingState />;

  return (
    <div className="max-w-6xl mx-auto">
      <PageHeader
        icon={FileSpreadsheet}
        title="Quotations"
        subtitle="Quotes and proposals"
        actions={<PrimaryButton onClick={openCreate}><Plus size={16} /> New Quotation</PrimaryButton>}
      />

      <div className="flex flex-wrap gap-3 mb-5">
        <SearchInput value={search} onChange={setSearch} placeholder="Search quotations..." />
        <select className={cn(inputClass, "max-w-[180px]")} value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
          <option value="">All Statuses</option>
          {(["Draft", "Sent", "Accepted", "Rejected", "Expired"] as QuotationStatus[]).map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      <Card className="overflow-hidden">
        {filtered.length === 0 ? (
          <EmptyState icon={FileSpreadsheet} label="No quotations found" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-neutral-50 text-neutral-500 uppercase text-xs border-b border-neutral-200">
                <tr>
                  <th className="px-5 py-3 font-medium">Number</th>
                  <th className="px-5 py-3 font-medium">Customer</th>
                  <th className="px-5 py-3 font-medium">Amount</th>
                  <th className="px-5 py-3 font-medium">Valid Until</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {filtered.map((q) => (
                  <tr key={q.id} className="hover:bg-neutral-50">
                    <td className="px-5 py-3 font-mono font-semibold text-red-800">{q.number}</td>
                    <td className="px-5 py-3 font-medium text-black">{custName(q.customerId)}</td>
                    <td className="px-5 py-3 font-semibold text-black">{formatCurrency(q.grandTotal)}</td>
                    <td className="px-5 py-3 text-neutral-600">{q.validUntil ? formatDate(toJsDate(q.validUntil)!) : "—"}</td>
                    <td className="px-5 py-3"><StatusBadge label={q.status} tone={toneForStatus(q.status)} /></td>
                    <td className="px-5 py-3 text-right">
                      <div className="flex gap-1 justify-end">
                        {q.status === "Draft" && <button onClick={() => updateQuotation(q.id, { status: "Sent" })} className="px-2 py-1 text-xs rounded bg-blue-50 text-blue-700 hover:bg-blue-100 flex items-center gap-1"><Send size={12} /> Send</button>}
                        {q.status === "Sent" && <>
                          <button onClick={() => updateQuotation(q.id, { status: "Accepted" })} className="px-2 py-1 text-xs rounded bg-green-50 text-green-700 hover:bg-green-100"><Check size={12} /></button>
                          <button onClick={() => updateQuotation(q.id, { status: "Rejected" })} className="px-2 py-1 text-xs rounded bg-red-50 text-red-600 hover:bg-red-100"><X size={12} /></button>
                        </>}
                        {q.status === "Accepted" && !q.convertedInvoiceId && <button onClick={() => convertToInvoice(q)} className="px-2 py-1 text-xs rounded bg-black text-white hover:bg-neutral-800 flex items-center gap-1"><ArrowUpRight size={12} /> To Invoice</button>}
                        <button onClick={() => viewPdf(q)} className="p-1.5 rounded-md hover:bg-neutral-100 text-neutral-500"><Eye size={14} /></button>
                        <button onClick={() => setToDelete(q)} className="p-1.5 rounded-md hover:bg-red-50 text-red-600"><Trash2 size={14} /></button>
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
        <DialogContent className="sm:max-w-2xl bg-white max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>New Quotation</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="grid grid-cols-2 gap-4">
              <Field label="Customer">
                <select className={inputClass} value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
                  <option value="">Select customer</option>
                  {customers.map((c) => <option key={c.id} value={c.id}>{c.company}</option>)}
                </select>
              </Field>
              <Field label="Valid Until"><input type="date" className={inputClass} value={validUntil} onChange={(e) => setValidUntil(e.target.value)} /></Field>
            </div>
            <LineItemEditor lines={lines} discount={discount} onLinesChange={setLines} onDiscountChange={setDiscount} />
            <Field label="Notes"><textarea className={inputClass} rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
            {error && <p className="text-red-700 text-sm">{error}</p>}
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setFormOpen(false)} className="px-4 py-2 text-sm font-medium text-neutral-600 hover:bg-neutral-100 rounded-lg">Cancel</button>
              <PrimaryButton onClick={handleSave}>Create Quotation</PrimaryButton>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <DeleteConfirmModal
        isOpen={!!toDelete}
        onClose={() => setToDelete(null)}
        onConfirm={async () => { if (toDelete) await deleteQuotation(toDelete.id); setToDelete(null); }}
        title="Delete Quotation"
        description={`Delete "${toDelete?.number}"?`}
      />
    </div>
  );
}
