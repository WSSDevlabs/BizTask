import { useEffect, useMemo, useState } from "react";
import { Truck, Plus, Pencil, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DeleteConfirmModal } from "@/components/DeleteConfirmModal";
import {
  PageHeader, PrimaryButton, Card, LoadingState, EmptyState, Field, inputClass,
  SearchInput, StatCard,
} from "@/components/ui/shared";
import {
  subscribeSuppliers, addSupplier, updateSupplier, deleteSupplier,
} from "@/lib/db";
import type { Supplier } from "@/types";

const CATEGORIES = [
  "Software", "Logistics", "Office", "Utilities",
  "Professional Services", "Raw Materials", "Other",
];

export default function SuppliersPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [toDelete, setToDelete] = useState<Supplier | null>(null);

  const [name, setName] = useState("");
  const [category, setCategory] = useState("Software");
  const [contactPerson, setContactPerson] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const unsub = subscribeSuppliers((rows) => { setSuppliers(rows); setLoading(false); });
    return () => unsub();
  }, []);

  const filtered = useMemo(
    () => suppliers.filter((s) => s.name.toLowerCase().includes(search.toLowerCase())),
    [suppliers, search]
  );

  function openCreate() {
    setEditing(null);
    setName(""); setCategory("Software"); setContactPerson(""); setPhone("");
    setEmail(""); setAddress(""); setNotes(""); setError("");
    setFormOpen(true);
  }

  function openEdit(s: Supplier) {
    setEditing(s);
    setName(s.name); setCategory(s.category ?? "Other"); setContactPerson(s.contactPerson ?? "");
    setPhone(s.phone ?? ""); setEmail(s.email ?? ""); setAddress(s.address ?? "");
    setNotes(s.notes ?? ""); setError("");
    setFormOpen(true);
  }

  async function handleSave() {
    if (!name.trim()) { setError("Name is required"); return; }
    const payload = {
      name: name.trim(), category, contactPerson, phone, email, address, notes,
    };
    try {
      if (editing) await updateSupplier(editing.id, payload);
      else await addSupplier(payload);
      setFormOpen(false);
    } catch (err) { setError("Failed to save. " + (err as Error).message); }
  }

  if (loading) return <LoadingState />;

  return (
    <div className="max-w-6xl mx-auto">
      <PageHeader
        icon={Truck}
        title="Suppliers"
        subtitle="Vendor directory"
        actions={<PrimaryButton onClick={openCreate}><Plus size={16} /> New Supplier</PrimaryButton>}
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <StatCard label="Total Suppliers" value={suppliers.length} icon={Truck} accent />
      </div>

      <div className="flex flex-wrap gap-3 mb-5">
        <SearchInput value={search} onChange={setSearch} placeholder="Search suppliers..." />
      </div>

      <Card className="overflow-hidden">
        {filtered.length === 0 ? (
          <EmptyState icon={Truck} label="No suppliers found" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-neutral-50 text-neutral-500 uppercase text-xs border-b border-neutral-200">
                <tr>
                  <th className="px-5 py-3 font-medium">Name</th>
                  <th className="px-5 py-3 font-medium">Category</th>
                  <th className="px-5 py-3 font-medium">Contact Person</th>
                  <th className="px-5 py-3 font-medium">Phone</th>
                  <th className="px-5 py-3 font-medium">Email</th>
                  <th className="px-5 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {filtered.map((s) => (
                  <tr key={s.id} className="hover:bg-neutral-50">
                    <td className="px-5 py-3 font-medium text-black">{s.name}</td>
                    <td className="px-5 py-3 text-neutral-600">{s.category ?? "—"}</td>
                    <td className="px-5 py-3 text-neutral-600">{s.contactPerson || "—"}</td>
                    <td className="px-5 py-3 text-neutral-600">{s.phone || "—"}</td>
                    <td className="px-5 py-3 text-neutral-600">{s.email || "—"}</td>
                    <td className="px-5 py-3 text-right">
                      <div className="flex gap-1 justify-end">
                        <button onClick={() => openEdit(s)} className="p-1.5 rounded-md hover:bg-neutral-100 text-neutral-500"><Pencil size={14} /></button>
                        <button onClick={() => setToDelete(s)} className="p-1.5 rounded-md hover:bg-red-50 text-red-600"><Trash2 size={14} /></button>
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
          <DialogHeader><DialogTitle>{editing ? "Edit Supplier" : "New Supplier"}</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="grid grid-cols-2 gap-4">
              <Field label="Name"><input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} /></Field>
              <Field label="Category">
                <select className={inputClass} value={category} onChange={(e) => setCategory(e.target.value)}>
                  {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Contact Person"><input className={inputClass} value={contactPerson} onChange={(e) => setContactPerson(e.target.value)} /></Field>
              <Field label="Phone"><input className={inputClass} value={phone} onChange={(e) => setPhone(e.target.value)} /></Field>
            </div>
            <Field label="Email"><input className={inputClass} value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
            <Field label="Address"><textarea className={inputClass} rows={2} value={address} onChange={(e) => setAddress(e.target.value)} /></Field>
            <Field label="Notes"><textarea className={inputClass} rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
            {error && <p className="text-red-700 text-sm">{error}</p>}
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setFormOpen(false)} className="px-4 py-2 text-sm font-medium text-neutral-600 hover:bg-neutral-100 rounded-lg">Cancel</button>
              <PrimaryButton onClick={handleSave}>{editing ? "Save Changes" : "Create Supplier"}</PrimaryButton>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <DeleteConfirmModal
        isOpen={!!toDelete}
        onClose={() => setToDelete(null)}
        onConfirm={async () => { if (toDelete) await deleteSupplier(toDelete.id); setToDelete(null); }}
        title="Delete Supplier"
        description={`Delete supplier "${toDelete?.name}"?`}
      />
    </div>
  );
}
