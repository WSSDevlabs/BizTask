import { useEffect, useMemo, useState } from "react";
import { Package, Wrench, Plus, Pencil, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DeleteConfirmModal } from "@/components/DeleteConfirmModal";
import {
  PrimaryButton, Card, LoadingState, EmptyState, Field, inputClass,
  SearchInput, StatCard, StatusBadge,
} from "@/components/ui/shared";
import { usePageHeader } from "@/lib/page-header-context";
import {
  subscribeProducts, addProduct, updateProduct, deleteProduct,
} from "@/lib/db";
import { formatCurrency, cn } from "@/lib/utils";
import type { Product, ProductType } from "@/types";

const CATEGORIES = [
  "Software", "Hardware", "Service", "Consulting", "Subscription", "Other",
];

const TYPES: ProductType[] = ["Product", "Service"];

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [toDelete, setToDelete] = useState<Product | null>(null);

  const [type, setType] = useState<ProductType>("Product");
  const [name, setName] = useState("");
  const [sku, setSku] = useState("");
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [price, setPrice] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");

  useEffect(() => subscribeProducts((rows) => { setProducts(rows); setLoading(false); }), []);

  const filtered = useMemo(
    () => products.filter((p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.sku ?? "").toLowerCase().includes(search.toLowerCase())
    ),
    [products, search]
  );

  const totalProducts = products.filter((p) => p.type !== "Service").length;
  const totalServices = products.filter((p) => p.type === "Service").length;

  function openCreate() {
    setEditing(null);
    setType("Product"); setName(""); setSku(""); setCategory(CATEGORIES[0]); setPrice(""); setDescription(""); setError("");
    setFormOpen(true);
  }

  function openEdit(p: Product) {
    setEditing(p);
    setType(p.type ?? "Product");
    setName(p.name); setSku(p.sku ?? ""); setCategory(p.category ?? CATEGORIES[0]);
    setPrice(p.price.toString()); setDescription(p.description ?? ""); setError("");
    setFormOpen(true);
  }

  async function handleSave() {
    if (!name.trim()) { setError("Product name is required"); return; }
    const priceNum = parseFloat(price);
    if (!priceNum || priceNum <= 0) { setError("Enter a valid price"); return; }
    const payload = {
      name: name.trim(), type, category, price: priceNum,
      ...(sku.trim() ? { sku: sku.trim() } : {}),
      ...(description.trim() ? { description: description.trim() } : {}),
    };
    try {
      if (editing) await updateProduct(editing.id, payload);
      else await addProduct(payload);
      setFormOpen(false);
    } catch (err) {
      setError("Failed to save. " + (err as Error).message);
    }
  }

  usePageHeader({ actions: <PrimaryButton onClick={openCreate}><Plus size={16} /> New Item</PrimaryButton> });

  if (loading) return <LoadingState />;

  return (
    <div className="max-w-6xl mx-auto">
      <div className="sticky top-0 z-10 bg-neutral-50 pb-4">
        <div className="flex flex-wrap gap-3 mb-5">
          <SearchInput value={search} onChange={setSearch} placeholder="Search by name or SKU..." />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          <StatCard label="Total Products" value={totalProducts} icon={Package} tone="blue" />
          <StatCard label="Total Services" value={totalServices} icon={Wrench} tone="emerald" />
        </div>
      </div>

      <Card className="overflow-hidden">
        {filtered.length === 0 ? (
          <EmptyState icon={Package} label="No products or services found" description="Add products and services here so you can pick them instantly when building a quotation or invoice." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-neutral-50 text-neutral-500 uppercase text-xs border-b border-neutral-200">
                <tr>
                  <th className="px-5 py-3 font-medium">Name</th>
                  <th className="px-5 py-3 font-medium">Type</th>
                  <th className="px-5 py-3 font-medium">SKU</th>
                  <th className="px-5 py-3 font-medium">Category</th>
                  <th className="px-5 py-3 font-medium">Price</th>
                  <th className="px-5 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {filtered.map((p) => (
                  <tr key={p.id} className="hover:bg-neutral-50">
                    <td className="px-5 py-3">
                      <p className="font-medium text-black">{p.name}</p>
                      {p.description && <p className="text-xs text-neutral-400 truncate max-w-xs">{p.description}</p>}
                    </td>
                    <td className="px-5 py-3">
                      <StatusBadge label={p.type ?? "Product"} tone={p.type === "Service" ? "green" : "blue"} dot={false} />
                    </td>
                    <td className="px-5 py-3 text-neutral-600 font-mono text-xs">{p.sku || "—"}</td>
                    <td className="px-5 py-3 text-neutral-600">{p.category ?? "—"}</td>
                    <td className="px-5 py-3 font-semibold text-black">{formatCurrency(p.price)}</td>
                    <td className="px-5 py-3 text-right">
                      <div className="flex gap-1 justify-end">
                        <button onClick={() => openEdit(p)} className="p-1.5 rounded-md hover:bg-neutral-100 text-neutral-500"><Pencil size={14} /></button>
                        <button onClick={() => setToDelete(p)} className="p-1.5 rounded-md hover:bg-red-50 text-red-600"><Trash2 size={14} /></button>
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
          <DialogHeader><DialogTitle>{editing ? `Edit ${type}` : `New ${type}`}</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <Field label="Type">
              <div className="grid grid-cols-2 gap-2">
                {TYPES.map((t) => {
                  const Icon = t === "Service" ? Wrench : Package;
                  return (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setType(t)}
                      className={cn(
                        "flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border text-sm font-medium transition-all duration-150",
                        type === t
                          ? "bg-sky-50 border-sky-300 text-sky-700 ring-1 ring-sky-200"
                          : "bg-white border-neutral-200 text-neutral-500 hover:border-neutral-300"
                      )}
                    >
                      <Icon size={14} /> {t}
                    </button>
                  );
                })}
              </div>
            </Field>
            <Field label="Name"><input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Website Maintenance (Monthly)" /></Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="SKU (optional)"><input className={inputClass} value={sku} onChange={(e) => setSku(e.target.value)} /></Field>
              <Field label="Category">
                <select className={inputClass} value={category} onChange={(e) => setCategory(e.target.value)}>
                  {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </Field>
            </div>
            <Field label="Price (RM)"><input type="number" min="0" step="0.01" className={inputClass} value={price} onChange={(e) => setPrice(e.target.value)} /></Field>
            <Field label="Description (optional)"><textarea rows={2} className={inputClass} value={description} onChange={(e) => setDescription(e.target.value)} /></Field>
            {error && <p className="text-red-700 text-sm">{error}</p>}
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setFormOpen(false)} className="px-4 py-2 text-sm font-medium text-neutral-600 hover:bg-neutral-100 rounded-lg">Cancel</button>
              <PrimaryButton onClick={handleSave}>{editing ? "Save Changes" : "Create Product"}</PrimaryButton>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <DeleteConfirmModal
        isOpen={!!toDelete}
        onClose={() => setToDelete(null)}
        onConfirm={async () => { if (toDelete) await deleteProduct(toDelete.id); setToDelete(null); }}
        title="Delete Product"
        description={`Delete "${toDelete?.name}"?`}
      />
    </div>
  );
}
