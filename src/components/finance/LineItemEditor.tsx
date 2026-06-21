import { Plus, Trash2 } from "lucide-react";
import { inputClass } from "@/components/ui/shared";
import { formatCurrency } from "@/lib/utils";
import type { InvoiceLine } from "@/types";

const TAX_RATES = [0, 6, 8];

export interface LineTotals {
  subtotal: number;
  taxTotal: number;
  grandTotal: number;
}

export function computeTotals(lines: InvoiceLine[], discount: number): LineTotals {
  const subtotal = lines.reduce((s, l) => s + l.quantity * l.unitPrice, 0);
  const taxTotal = lines.reduce((s, l) => s + l.quantity * l.unitPrice * (l.taxRate / 100), 0);
  const grandTotal = Math.max(0, subtotal - discount + taxTotal);
  return { subtotal, taxTotal, grandTotal };
}

let lineCounter = 0;
export function emptyLine(): InvoiceLine {
  lineCounter += 1;
  return { id: `line_${Date.now()}_${lineCounter}`, description: "", quantity: 1, unitPrice: 0, taxRate: 0, total: 0 };
}

export default function LineItemEditor({
  lines,
  discount,
  onLinesChange,
  onDiscountChange,
}: {
  lines: InvoiceLine[];
  discount: number;
  onLinesChange: (lines: InvoiceLine[]) => void;
  onDiscountChange: (discount: number) => void;
}) {
  function update(id: string, patch: Partial<InvoiceLine>) {
    onLinesChange(
      lines.map((l) => {
        if (l.id !== id) return l;
        const next = { ...l, ...patch };
        next.total = next.quantity * next.unitPrice;
        return next;
      })
    );
  }

  const totals = computeTotals(lines, discount);

  return (
    <div>
      <div className="space-y-2">
        <div className="grid grid-cols-12 gap-2 text-xs font-medium text-neutral-500 uppercase px-1">
          <span className="col-span-5">Description</span>
          <span className="col-span-2 text-center">Qty</span>
          <span className="col-span-2 text-center">Unit Price</span>
          <span className="col-span-2 text-center">Tax</span>
          <span className="col-span-1" />
        </div>
        {lines.map((l) => (
          <div key={l.id} className="grid grid-cols-12 gap-2 items-center">
            <input className={`${inputClass} col-span-5`} value={l.description} onChange={(e) => update(l.id, { description: e.target.value })} placeholder="Item description" />
            <input type="number" min={1} className={`${inputClass} col-span-2 text-center`} value={l.quantity} onChange={(e) => update(l.id, { quantity: Number(e.target.value) })} />
            <input type="number" min={0} step="0.01" className={`${inputClass} col-span-2`} value={l.unitPrice} onChange={(e) => update(l.id, { unitPrice: Number(e.target.value) })} />
            <select className={`${inputClass} col-span-2`} value={l.taxRate} onChange={(e) => update(l.id, { taxRate: Number(e.target.value) })}>
              {TAX_RATES.map((r) => <option key={r} value={r}>{r === 0 ? "Exempt" : `SST ${r}%`}</option>)}
            </select>
            <button onClick={() => onLinesChange(lines.filter((x) => x.id !== l.id))} className="col-span-1 p-2 rounded-md hover:bg-red-50 text-red-600 flex justify-center"><Trash2 size={15} /></button>
          </div>
        ))}
      </div>

      <button onClick={() => onLinesChange([...lines, emptyLine()])} className="mt-2 flex items-center gap-1.5 text-sm text-red-800 hover:underline">
        <Plus size={15} /> Add line item
      </button>

      <div className="mt-4 ml-auto max-w-xs space-y-2 text-sm">
        <div className="flex justify-between text-neutral-600"><span>Subtotal</span><span className="font-medium text-black">{formatCurrency(totals.subtotal)}</span></div>
        <div className="flex justify-between items-center text-neutral-600">
          <span>Discount (RM)</span>
          <input type="number" min={0} className={`${inputClass} w-28 text-right py-1.5`} value={discount} onChange={(e) => onDiscountChange(Number(e.target.value) || 0)} />
        </div>
        <div className="flex justify-between text-neutral-600"><span>SST</span><span className="font-medium text-black">{formatCurrency(totals.taxTotal)}</span></div>
        <div className="flex justify-between text-base font-bold text-black border-t border-neutral-200 pt-2"><span>Grand Total</span><span className="text-red-800">{formatCurrency(totals.grandTotal)}</span></div>
      </div>
    </div>
  );
}
