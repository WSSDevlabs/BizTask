import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  ArrowLeftRight, Plus, Send, Check, X, Trash2, Eye, ArrowUpRight, AlertTriangle, Receipt,
} from "lucide-react";
import { Timestamp } from "firebase/firestore";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DeleteConfirmModal } from "@/components/DeleteConfirmModal";
import {
  PrimaryButton, Card, LoadingState, EmptyState, Field, inputClass,
  StatusBadge, toneForStatus, SearchInput, StatCard,
} from "@/components/ui/shared";
import { usePageHeader } from "@/lib/page-header-context";
import LineItemEditor, { computeTotals, emptyLine } from "@/components/finance/LineItemEditor";
import {
  subscribeQuotations, addQuotation, updateQuotation, deleteQuotation,
  subscribeInvoices, addInvoice, updateInvoice, deleteInvoice,
  subscribeCustomers, addPayment, subscribePayments, deletePayment, subscribeProducts,
} from "@/lib/db";
import { cn, formatCurrency, formatDate, toJsDate, dateStringToTimestamp } from "@/lib/utils";
import type {
  Quotation, Invoice, InvoiceLine, QuotationStatus, InvoiceStatus, Customer,
  Order, PaymentMethod, Payment, Product,
} from "@/types";

const PAY_METHODS: PaymentMethod[] = ["Cash", "Bank Transfer", "Card", "Cheque", "E-Wallet"];

type Tab = "quotations" | "invoices" | "settlement";

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

function inThisMonth(d: Date | null): boolean {
  if (!d) return false;
  const now = new Date();
  return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
}

export default function TransactionPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [tab, setTab] = useState<Tab>("quotations");

  // ── Shared ─────────────────────────────────────────────────────────────────
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [custLoaded, setCustLoaded] = useState(false);
  const custName = (id: string) => customers.find((c) => c.id === id)?.company ?? "Unknown";
  const [products, setProducts] = useState<Product[]>([]);

  useEffect(() => subscribeCustomers((rows) => { setCustomers(rows); setCustLoaded(true); }), []);
  useEffect(() => subscribeProducts(setProducts), []);

  // ── Quotations ─────────────────────────────────────────────────────────────
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [qtLoaded, setQtLoaded] = useState(false);
  const [qtSearch, setQtSearch] = useState("");
  const [qtFilterStatus, setQtFilterStatus] = useState("");
  const [qtFormOpen, setQtFormOpen] = useState(false);
  const [qtToDelete, setQtToDelete] = useState<Quotation | null>(null);

  const [qtCustomerId, setQtCustomerId] = useState("");
  const [qtValidUntil, setQtValidUntil] = useState("");
  const [qtNotes, setQtNotes] = useState("");
  const [qtDiscount, setQtDiscount] = useState(0);
  const [qtLines, setQtLines] = useState<InvoiceLine[]>([emptyLine()]);
  const [qtError, setQtError] = useState("");

  useEffect(() => subscribeQuotations((rows) => { setQuotations(rows); setQtLoaded(true); }), []);

  const qtAcceptedCount = quotations.filter((q) => q.status === "Accepted").length;
  const qtConvertedCount = quotations.filter((q) => q.convertedInvoiceId).length;
  const qtConversionRate = qtAcceptedCount === 0 ? 0 : Math.round((qtConvertedCount / qtAcceptedCount) * 100);
  const qtTotalValue = quotations.reduce((s, q) => s + q.grandTotal, 0);

  const qtFiltered = useMemo(
    () => quotations.filter((q) =>
      (q.number.toLowerCase().includes(qtSearch.toLowerCase()) || custName(q.customerId).toLowerCase().includes(qtSearch.toLowerCase())) &&
      (!qtFilterStatus || q.status === qtFilterStatus)
    ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [quotations, customers, qtSearch, qtFilterStatus]
  );

  function qtNextNumber(): string {
    const year = new Date().getFullYear().toString().slice(-2);
    const nums = quotations.map((q) => {
      const parts = q.number.split("/");
      return parseInt(parts[parts.length - 1] ?? "0", 10);
    });
    const seq = (nums.length > 0 ? Math.max(...nums) : 0) + 1;
    return `BZT/QT/${year}/${String(seq).padStart(3, "0")}`;
  }

  function qtOpenCreate() {
    setQtCustomerId(""); setQtValidUntil(""); setQtNotes(""); setQtDiscount(0);
    setQtLines([emptyLine()]); setQtError(""); setQtFormOpen(true);
  }

  async function qtHandleSave() {
    if (!qtCustomerId) { setQtError("Select a customer"); return; }
    const valid = qtLines.filter((l) => l.description.trim());
    if (valid.length === 0) { setQtError("Add at least one line item"); return; }
    const totals = computeTotals(valid, qtDiscount);
    try {
      await addQuotation({
        number: qtNextNumber(), customerId: qtCustomerId, lines: valid,
        subtotal: totals.subtotal, discount: qtDiscount, taxTotal: totals.taxTotal, grandTotal: totals.grandTotal,
        notes: qtNotes, status: "Draft", issueDate: Timestamp.now(),
        ...(qtValidUntil ? { validUntil: dateStringToTimestamp(qtValidUntil) } : {}),
      } as Omit<Quotation, "id" | "createdAt">);
      setQtFormOpen(false);
    } catch (err) { setQtError("Failed to save. " + (err as Error).message); }
  }

  async function qtConvertToInvoice(q: Quotation) {
    const year = new Date().getFullYear().toString().slice(-2);
    const invId = await addInvoice({
      number: `BZT/INV/${year}/${String(Date.now()).slice(-3)}`,
      customerId: q.customerId, lines: q.lines, subtotal: q.subtotal, discount: q.discount,
      taxTotal: q.taxTotal, grandTotal: q.grandTotal, notes: q.notes, status: "Draft",
      issueDate: Timestamp.now(),
    } as Omit<Invoice, "id" | "createdAt">);
    await updateQuotation(q.id, { convertedInvoiceId: invId });
  }

  // Accepting a quotation immediately moves it to Invoices — sending happens
  // manually outside the app, so there's no separate "Send" step in-app.
  async function qtAcceptAndConvert(q: Quotation) {
    await updateQuotation(q.id, { status: "Accepted" });
    await qtConvertToInvoice(q);
  }

  async function qtViewPdf(q: Quotation) {
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

  // ── Invoices ───────────────────────────────────────────────────────────────
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [invLoaded, setInvLoaded] = useState(false);
  const [invSearch, setInvSearch] = useState("");
  const [invFilterStatus, setInvFilterStatus] = useState("");
  const [invFormOpen, setInvFormOpen] = useState(false);
  const [invPayFor, setInvPayFor] = useState<Invoice | null>(null);
  const [invToDelete, setInvToDelete] = useState<Invoice | null>(null);

  const [invCustomerId, setInvCustomerId] = useState("");
  const [invDueDate, setInvDueDate] = useState("");
  const [invNotes, setInvNotes] = useState("");
  const [invDiscount, setInvDiscount] = useState(0);
  const [invLines, setInvLines] = useState<InvoiceLine[]>([emptyLine()]);
  const [invError, setInvError] = useState("");

  const [invPayMethod, setInvPayMethod] = useState<PaymentMethod>("Bank Transfer");
  const [invPayDate, setInvPayDate] = useState(new Date().toISOString().slice(0, 10));

  useEffect(() => subscribeInvoices((rows) => { setInvoices(rows); setInvLoaded(true); }), []);

  // Auto-flag overdue on load
  useEffect(() => {
    invoices.forEach((inv) => {
      if (inv.status === "Sent" && isOverdue(inv)) updateInvoice(inv.id, { status: "Overdue" });
    });
  }, [invoices]);

  const invFiltered = useMemo(
    () => invoices.filter((i) =>
      (i.number.toLowerCase().includes(invSearch.toLowerCase()) || custName(i.customerId).toLowerCase().includes(invSearch.toLowerCase())) &&
      (!invFilterStatus || i.status === invFilterStatus)
    ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [invoices, customers, invSearch, invFilterStatus]
  );

  const outstanding = invoices.filter((i) => i.status === "Sent" || i.status === "Overdue").reduce((s, i) => s + i.grandTotal, 0);
  const paidTotal = invoices.filter((i) => i.status === "Paid").reduce((s, i) => s + i.grandTotal, 0);
  const overdueCount = invoices.filter((i) => i.status === "Overdue").length;

  function invNextNumber(): string {
    const year = new Date().getFullYear().toString().slice(-2);
    const nums = invoices.map((i) => {
      const parts = i.number.split("/");
      return parseInt(parts[parts.length - 1] ?? "0", 10);
    });
    const seq = (nums.length > 0 ? Math.max(...nums) : 0) + 1;
    return `BZT/INV/${year}/${String(seq).padStart(3, "0")}`;
  }

  function invOpenCreate() {
    setInvCustomerId(""); setInvDueDate(""); setInvNotes(""); setInvDiscount(0);
    setInvLines([emptyLine()]); setInvError(""); setInvFormOpen(true);
  }

  useEffect(() => {
    if (searchParams.get("action") === "new") {
      setTab("invoices");
      invOpenCreate();
      setSearchParams((p) => { p.delete("action"); return p; }, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  async function invHandleSave() {
    if (!invCustomerId) { setInvError("Select a customer"); return; }
    const valid = invLines.filter((l) => l.description.trim());
    if (valid.length === 0) { setInvError("Add at least one line item"); return; }
    const totals = computeTotals(valid, invDiscount);
    try {
      await addInvoice({
        number: invNextNumber(), customerId: invCustomerId, lines: valid,
        subtotal: totals.subtotal, discount: invDiscount, taxTotal: totals.taxTotal, grandTotal: totals.grandTotal,
        notes: invNotes, status: "Draft", issueDate: Timestamp.now(),
        ...(invDueDate ? { dueDate: dateStringToTimestamp(invDueDate) } : {}),
      } as Omit<Invoice, "id" | "createdAt">);
      setInvFormOpen(false);
    } catch (err) { setInvError("Failed to save. " + (err as Error).message); }
  }

  async function invMarkPaid() {
    if (!invPayFor) return;
    await updateInvoice(invPayFor.id, {
      status: "Paid", paidDate: dateStringToTimestamp(invPayDate), paymentMethod: invPayMethod,
    });
    await addPayment({
      invoiceId: invPayFor.id, amount: invPayFor.grandTotal, method: invPayMethod,
      paidDate: dateStringToTimestamp(invPayDate)!,
    } as Omit<Payment, "id" | "createdAt">);
    setInvPayFor(null);
  }

  // Map an invoice to the existing Order/PDF shape for the receipt template
  async function invViewPdf(inv: Invoice) {
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

  // ── Settlement (receipts for finished/paid invoices) ─────────────────────────
  const [payments, setPayments] = useState<Payment[]>([]);
  const [payLoaded, setPayLoaded] = useState(false);
  const [stlSearch, setStlSearch] = useState("");
  const [stlToDelete, setStlToDelete] = useState<Payment | null>(null);

  useEffect(() => subscribePayments((rows) => { setPayments(rows); setPayLoaded(true); }), []);

  function invoiceFor(p: Payment): Invoice | undefined {
    return invoices.find((i) => i.id === p.invoiceId);
  }

  const stlFiltered = useMemo(
    () => payments.filter((p) => {
      const inv = invoiceFor(p);
      const q = stlSearch.toLowerCase();
      return !q || (inv?.number.toLowerCase().includes(q)) || (inv && custName(inv.customerId).toLowerCase().includes(q));
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [payments, invoices, customers, stlSearch]
  );

  const totalSettled = payments.reduce((s, p) => s + p.amount, 0);
  const settledThisMonth = payments.filter((p) => inThisMonth(toJsDate(p.paidDate))).reduce((s, p) => s + p.amount, 0);

  usePageHeader({
    actions: tab === "quotations" ? (
      <PrimaryButton onClick={qtOpenCreate}><Plus size={16} /> New Quotation</PrimaryButton>
    ) : tab === "invoices" ? (
      <PrimaryButton onClick={invOpenCreate}><Plus size={16} /> New Invoice</PrimaryButton>
    ) : null,
  });

  const loading = !(custLoaded && qtLoaded && invLoaded && payLoaded);
  if (loading) return <LoadingState />;

  return (
    <div className="max-w-6xl mx-auto">

      <div className="inline-flex items-center gap-1 bg-neutral-100 rounded-xl p-1 mb-6">
        <button onClick={() => setTab("quotations")} className={cn("px-4 py-2 rounded-lg text-sm font-semibold transition", tab === "quotations" ? "bg-white text-black shadow-sm" : "text-neutral-500 hover:text-black")}>Quotations</button>
        <button onClick={() => setTab("invoices")} className={cn("px-4 py-2 rounded-lg text-sm font-semibold transition", tab === "invoices" ? "bg-white text-black shadow-sm" : "text-neutral-500 hover:text-black")}>Invoices</button>
        <button onClick={() => setTab("settlement")} className={cn("px-4 py-2 rounded-lg text-sm font-semibold transition", tab === "settlement" ? "bg-white text-black shadow-sm" : "text-neutral-500 hover:text-black")}>Settlement</button>
      </div>

      {tab === "quotations" && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            <StatCard label="Total Quoted" value={formatCurrency(qtTotalValue)} icon={ArrowLeftRight} hint={`${quotations.length} quotation${quotations.length === 1 ? "" : "s"}`} tone="blue" />
            <StatCard label="Accepted" value={qtAcceptedCount} icon={Check} hint="Ready to invoice" tone="emerald" />
            <StatCard label="Conversion Rate" value={`${qtConversionRate}%`} icon={ArrowUpRight} hint="Accepted → invoiced" tone="amber" />
          </div>

          <div className="flex flex-wrap gap-3 mb-5">
            <SearchInput value={qtSearch} onChange={setQtSearch} placeholder="Search quotations..." />
            <select className={cn(inputClass, "max-w-[180px]")} value={qtFilterStatus} onChange={(e) => setQtFilterStatus(e.target.value)}>
              <option value="">All Statuses</option>
              {(["Draft", "Sent", "Accepted", "Rejected", "Expired"] as QuotationStatus[]).map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          <Card className="overflow-hidden">
            {qtFiltered.length === 0 ? (
              <EmptyState icon={ArrowLeftRight} label="No quotations found" />
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
                    {qtFiltered.map((q) => (
                      <tr key={q.id} className="hover:bg-neutral-50">
                        <td className="px-5 py-3 font-mono font-semibold text-red-800">{q.number}</td>
                        <td className="px-5 py-3 font-medium text-black">{custName(q.customerId)}</td>
                        <td className="px-5 py-3 font-semibold text-black">{formatCurrency(q.grandTotal)}</td>
                        <td className="px-5 py-3 text-neutral-600">{q.validUntil ? formatDate(toJsDate(q.validUntil)!) : "—"}</td>
                        <td className="px-5 py-3"><StatusBadge label={q.status} tone={toneForStatus(q.status)} /></td>
                        <td className="px-5 py-3 text-right">
                          <div className="flex gap-1 justify-end">
                            {(q.status === "Draft" || q.status === "Sent") && <>
                              <button onClick={() => qtAcceptAndConvert(q)} className="px-2 py-1 text-xs rounded bg-green-50 text-green-700 hover:bg-green-100 flex items-center gap-1"><Check size={12} /> Accepted</button>
                              <button onClick={() => updateQuotation(q.id, { status: "Rejected" })} className="px-2 py-1 text-xs rounded bg-red-50 text-red-600 hover:bg-red-100"><X size={12} /></button>
                            </>}
                            {q.status === "Accepted" && !q.convertedInvoiceId && <button onClick={() => qtConvertToInvoice(q)} className="px-2 py-1 text-xs rounded bg-black text-white hover:bg-neutral-800 flex items-center gap-1"><ArrowUpRight size={12} /> To Invoice</button>}
                            <button onClick={() => qtViewPdf(q)} className="p-1.5 rounded-md hover:bg-neutral-100 text-neutral-500"><Eye size={14} /></button>
                            <button onClick={() => setQtToDelete(q)} className="p-1.5 rounded-md hover:bg-red-50 text-red-600"><Trash2 size={14} /></button>
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

      {tab === "invoices" && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            <StatCard label="Outstanding" value={formatCurrency(outstanding)} icon={ArrowLeftRight} hint="Sent + overdue" tone="amber" />
            <StatCard label="Collected" value={formatCurrency(paidTotal)} icon={Check} hint="Paid invoices" tone="emerald" />
            <StatCard label="Overdue" value={overdueCount} icon={AlertTriangle} hint="Need follow-up" tone="red" />
          </div>

          <div className="flex flex-wrap gap-3 mb-5">
            <SearchInput value={invSearch} onChange={setInvSearch} placeholder="Search invoices..." />
            <select className={cn(inputClass, "max-w-[180px]")} value={invFilterStatus} onChange={(e) => setInvFilterStatus(e.target.value)}>
              <option value="">All Statuses</option>
              {(["Draft", "Sent", "Paid", "Overdue", "Cancelled"] as InvoiceStatus[]).map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          <Card className="overflow-hidden">
            {invFiltered.length === 0 ? (
              <EmptyState icon={ArrowLeftRight} label="No invoices found" />
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
                    {invFiltered.map((inv) => (
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
                            {inv.status !== "Paid" && inv.status !== "Cancelled" && <button onClick={() => { setInvPayFor(inv); setInvPayDate(new Date().toISOString().slice(0, 10)); }} className="px-2 py-1 text-xs rounded bg-green-50 text-green-700 hover:bg-green-100 flex items-center gap-1"><Check size={12} /> Paid</button>}
                            <button onClick={() => invViewPdf(inv)} className="p-1.5 rounded-md hover:bg-neutral-100 text-neutral-500"><Eye size={14} /></button>
                            <button onClick={() => setInvToDelete(inv)} className="p-1.5 rounded-md hover:bg-red-50 text-red-600"><Trash2 size={14} /></button>
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

      {tab === "settlement" && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            <StatCard label="Total Settled" value={formatCurrency(totalSettled)} icon={Receipt} tone="emerald" />
            <StatCard label="Settled This Month" value={formatCurrency(settledThisMonth)} icon={Check} tone="blue" />
            <StatCard label="Receipts" value={payments.length} icon={Receipt} tone="blue" />
          </div>

          <div className="mb-5"><SearchInput value={stlSearch} onChange={setStlSearch} placeholder="Search by invoice number or customer..." /></div>

          <Card className="overflow-hidden">
            {stlFiltered.length === 0 ? (
              <EmptyState icon={Receipt} label="No settlements yet" description="Receipts appear here once an invoice is marked as paid." />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-neutral-50 text-neutral-500 uppercase text-xs border-b border-neutral-200">
                    <tr>
                      <th className="px-5 py-3 font-medium">Date</th>
                      <th className="px-5 py-3 font-medium">Invoice</th>
                      <th className="px-5 py-3 font-medium">Customer</th>
                      <th className="px-5 py-3 font-medium">Amount</th>
                      <th className="px-5 py-3 font-medium">Method</th>
                      <th className="px-5 py-3 font-medium text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {stlFiltered.map((p) => {
                      const inv = invoiceFor(p);
                      return (
                        <tr key={p.id} className="hover:bg-neutral-50">
                          <td className="px-5 py-3 text-neutral-600">{p.paidDate ? formatDate(toJsDate(p.paidDate)!) : "—"}</td>
                          <td className="px-5 py-3 font-mono font-semibold text-red-800">{inv?.number ?? "—"}</td>
                          <td className="px-5 py-3 font-medium text-black">{inv ? custName(inv.customerId) : "—"}</td>
                          <td className="px-5 py-3 font-semibold text-black">{formatCurrency(p.amount)}</td>
                          <td className="px-5 py-3 text-neutral-600">{p.method}</td>
                          <td className="px-5 py-3 text-right">
                            <div className="flex gap-1 justify-end">
                              <button onClick={() => inv && invViewPdf(inv)} disabled={!inv} className="p-1.5 rounded-md hover:bg-neutral-100 text-neutral-500 disabled:opacity-30"><Eye size={14} /></button>
                              <button onClick={() => setStlToDelete(p)} className="p-1.5 rounded-md hover:bg-red-50 text-red-600"><Trash2 size={14} /></button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </>
      )}

      {/* ── Quotation dialogs ─────────────────────────────────────────────── */}
      <Dialog open={qtFormOpen} onOpenChange={setQtFormOpen}>
        <DialogContent className="sm:max-w-2xl bg-white max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>New Quotation</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="grid grid-cols-2 gap-4">
              <Field label="Customer">
                <select className={inputClass} value={qtCustomerId} onChange={(e) => setQtCustomerId(e.target.value)}>
                  <option value="">Select customer</option>
                  {customers.map((c) => <option key={c.id} value={c.id}>{c.company}</option>)}
                </select>
              </Field>
              <Field label="Valid Until"><input type="date" className={inputClass} value={qtValidUntil} onChange={(e) => setQtValidUntil(e.target.value)} /></Field>
            </div>
            <LineItemEditor lines={qtLines} discount={qtDiscount} products={products} onLinesChange={setQtLines} onDiscountChange={setQtDiscount} />
            <Field label="Notes"><textarea className={inputClass} rows={2} value={qtNotes} onChange={(e) => setQtNotes(e.target.value)} /></Field>
            {qtError && <p className="text-red-700 text-sm">{qtError}</p>}
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setQtFormOpen(false)} className="px-4 py-2 text-sm font-medium text-neutral-600 hover:bg-neutral-100 rounded-lg">Cancel</button>
              <PrimaryButton onClick={qtHandleSave}>Create Quotation</PrimaryButton>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <DeleteConfirmModal
        isOpen={!!qtToDelete}
        onClose={() => setQtToDelete(null)}
        onConfirm={async () => { if (qtToDelete) await deleteQuotation(qtToDelete.id); setQtToDelete(null); }}
        title="Delete Quotation"
        description={`Delete "${qtToDelete?.number}"?`}
      />

      {/* ── Invoice dialogs ───────────────────────────────────────────────── */}
      <Dialog open={invFormOpen} onOpenChange={setInvFormOpen}>
        <DialogContent className="sm:max-w-2xl bg-white max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>New Invoice</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="grid grid-cols-2 gap-4">
              <Field label="Customer">
                <select className={inputClass} value={invCustomerId} onChange={(e) => setInvCustomerId(e.target.value)}>
                  <option value="">Select customer</option>
                  {customers.map((c) => <option key={c.id} value={c.id}>{c.company}</option>)}
                </select>
              </Field>
              <Field label="Due Date"><input type="date" className={inputClass} value={invDueDate} onChange={(e) => setInvDueDate(e.target.value)} /></Field>
            </div>
            <LineItemEditor lines={invLines} discount={invDiscount} products={products} onLinesChange={setInvLines} onDiscountChange={setInvDiscount} />
            <Field label="Notes"><textarea className={inputClass} rows={2} value={invNotes} onChange={(e) => setInvNotes(e.target.value)} /></Field>
            {invError && <p className="text-red-700 text-sm">{invError}</p>}
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setInvFormOpen(false)} className="px-4 py-2 text-sm font-medium text-neutral-600 hover:bg-neutral-100 rounded-lg">Cancel</button>
              <PrimaryButton onClick={invHandleSave}>Create Invoice</PrimaryButton>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!invPayFor} onOpenChange={(o) => !o && setInvPayFor(null)}>
        <DialogContent className="sm:max-w-md bg-white">
          <DialogHeader><DialogTitle>Mark as Paid — {invPayFor?.number}</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <p className="text-sm text-neutral-600">Amount: <span className="font-semibold text-black">{invPayFor && formatCurrency(invPayFor.grandTotal)}</span></p>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Payment Date"><input type="date" className={inputClass} value={invPayDate} onChange={(e) => setInvPayDate(e.target.value)} /></Field>
              <Field label="Method">
                <select className={inputClass} value={invPayMethod} onChange={(e) => setInvPayMethod(e.target.value as PaymentMethod)}>
                  {PAY_METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
              </Field>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setInvPayFor(null)} className="px-4 py-2 text-sm font-medium text-neutral-600 hover:bg-neutral-100 rounded-lg">Cancel</button>
              <PrimaryButton onClick={invMarkPaid}>Confirm Payment</PrimaryButton>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <DeleteConfirmModal
        isOpen={!!invToDelete}
        onClose={() => setInvToDelete(null)}
        onConfirm={async () => { if (invToDelete) await deleteInvoice(invToDelete.id); setInvToDelete(null); }}
        title="Delete Invoice"
        description={`Delete invoice "${invToDelete?.number}"?`}
      />

      {/* ── Settlement delete ─────────────────────────────────────────────── */}
      <DeleteConfirmModal
        isOpen={!!stlToDelete}
        onClose={() => setStlToDelete(null)}
        onConfirm={async () => { if (stlToDelete) await deletePayment(stlToDelete.id); setStlToDelete(null); }}
        title="Delete Settlement Record"
        description="Delete this payment receipt? This does not reverse the invoice's Paid status."
      />
    </div>
  );
}
