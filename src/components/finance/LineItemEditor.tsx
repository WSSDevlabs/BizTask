import { Plus, Trash2 } from "lucide-react";
import { inputClass } from "@/components/ui/shared";
import { formatCurrency } from "@/lib/utils";
import type { InvoiceLine, Product } from "@/types";

const TAX_RATES = [0, 6, 8];

export interface LineTotals {
  subtotal: number;
  taxTotal: number;
  grandTotal: number;
}

export function computeTotals(lines: InvoiceLine[], discount: number): LineTotals {
  const lineNet = (l: InvoiceLine) => Math.max(0, l.quantity * l.unitPrice - (l.discount ?? 0));
  const subtotal = lines.reduce((s, l) => s + lineNet(l), 0);
  const taxTotal = lines.reduce((s, l) => s + lineNet(l) * (l.taxRate / 100), 0);
  const grandTotal = Math.max(0, subtotal - discount + taxTotal);
  return { subtotal, taxTotal, grandTotal };
}

let lineCounter = 0;
export function emptyLine(): InvoiceLine {
  lineCounter += 1;
  return { id: `line_${Date.now()}_${lineCounter}`, description: "", quantity: 1, unitPrice: 0, discount: 0, taxRate: 0, total: 0 };
}

export default function LineItemEditor({
  lines,
  discount,
  products = [],
  onLinesChange,
  onDiscountChange,
}: {
  lines: InvoiceLine[];
  discount: number;
  products?: Product[];
  onLinesChange: (lines: InvoiceLine[]) => void;
  onDiscountChange: (discount: number) => void;
}) {
  function update(id: string, patch: Partial<InvoiceLine>) {
    onLinesChange(
      lines.map((l) => {
        if (l.id !== id) return l;
        const next = { ...l, ...patch };
        next.total = Math.max(0, next.quantity * next.unitPrice - (next.discount ?? 0));
        return next;
      })
    );
  }

  function selectProduct(id: string, productId: string) {
    if (!productId) { update(id, { productId: undefined }); return; }
    const p = products.find((x) => x.id === productId);
    if (!p) return;
    update(id, { productId, description: p.name, unitPrice: p.price });
  }

  const totals = computeTotals(lines, discount);

  return (
    <div>
      <div className="space-y-3">
        {lines.map((l) => (
          <div key={l.id} className="border border-neutral-200 rounded-xl p-3 space-y-2">
            <div className="flex gap-2">
              {products.length > 0 && (
                <select
                  className={`${inputClass} w-40 shrink-0`}
                  value={l.productId ?? ""}
                  onChange={(e) => selectProduct(l.id, e.target.value)}
                >
                  <option value="">Custom</option>
                  {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              )}
              <input className={`${inputClass} flex-1`} value={l.description} onChange={(e) => update(l.id, { description: e.target.value })} placeholder="Item description" />
              <button onClick={() => onLinesChange(lines.filter((x) => x.id !== l.id))} className="p-2 rounded-md hover:bg-red-50 text-red-600 shrink-0"><Trash2 size={15} /></button>
            </div>
            <div className="grid grid-cols-4 gap-2">
              <div>
                <label className="text-[10px] text-neutral-400 uppercase tracking-wide">Qty</label>
                <input type="number" min={1} className={inputClass} value={l.quantity} onChange={(e) => update(l.id, { quantity: Number(e.target.value) })} />
              </div>
              <div>
                <label className="text-[10px] text-neutral-400 uppercase tracking-wide">Unit Price</label>
                <input type="number" min={0} step="0.01" className={inputClass} value={l.unitPrice} onChange={(e) => update(l.id, { unitPrice: Number(e.target.value) })} />
              </div>
              <div>
                <label className="text-[10px] text-neutral-400 uppercase tracking-wide">Discount (RM)</label>
                <input type="number" min={0} step="0.01" className={inputClass} value={l.discount ?? 0} onChange={(e) => update(l.id, { discount: Number(e.target.value) || 0 })} />
              </div>
              <div>
                <label className="text-[10px] text-neutral-400 uppercase tracking-wide">Tax</label>
                <select className={inputClass} value={l.taxRate} onChange={(e) => update(l.id, { taxRate: Number(e.target.value) })}>
                  {TAX_RATES.map((r) => <option key={r} value={r}>{r === 0 ? "Exempt" : `SST ${r}%`}</option>)}
                </select>
              </div>
            </div>
          </div>
        ))}
      </div>

      <button onClick={() => onLinesChange([...lines, emptyLine()])} className="mt-3 flex items-center gap-1.5 text-sm text-sky-700 hover:underline">
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
