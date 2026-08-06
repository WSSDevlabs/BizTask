import { useEffect, useMemo, useState } from "react";
import { Wrench, Plus, Pencil, Trash2, Check } from "lucide-react";
import { Timestamp } from "firebase/firestore";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DeleteConfirmModal } from "@/components/DeleteConfirmModal";
import {
  PrimaryButton, Card, LoadingState, EmptyState, Field, inputClass,
  StatusBadge, toneForStatus, StatCard, SearchInput,
} from "@/components/ui/shared";
import { usePageHeader } from "@/lib/page-header-context";
import {
  subscribeMaintenanceItems, addMaintenanceItem, updateMaintenanceItem, deleteMaintenanceItem,
  subscribeProjects,
} from "@/lib/db";
import { cn, formatCurrency, formatDate, toJsDate, dateStringToTimestamp, toDateInputValue } from "@/lib/utils";
import type { MaintenanceItem, MaintenanceStatus, BillingCycle, Project } from "@/types";

const INTERVALS: BillingCycle[] = ["Weekly", "Monthly", "Quarterly", "Yearly"];
const STATUSES: MaintenanceStatus[] = ["Active", "Completed", "Cancelled"];

// Advances from the item's own due date (not from "today"), so a renewal done
// early or late still lands on the same recurring day each cycle.
function advanceDate(d: Date, cycle: BillingCycle): Date {
  const next = new Date(d);
  switch (cycle) {
    case "Weekly":    next.setDate(next.getDate() + 7); break;
    case "Monthly":   next.setMonth(next.getMonth() + 1); break;
    case "Quarterly": next.setMonth(next.getMonth() + 3); break;
    case "Yearly":    next.setFullYear(next.getFullYear() + 1); break;
  }
  return next;
}

function dueSoon(m: MaintenanceItem): boolean {
  if (m.status !== "Active") return false;
  const d = toJsDate(m.dueDate);
  if (!d) return false;
  const daysAway = (d.getTime() - Date.now()) / 86400000;
  return daysAway >= 0 && daysAway <= 7;
}

function isOverdue(m: MaintenanceItem): boolean {
  if (m.status !== "Active") return false;
  const d = toJsDate(m.dueDate);
  return !!d && d.getTime() < Date.now();
}

export default function MaintenancePage() {
  const [items, setItems] = useState<MaintenanceItem[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<MaintenanceItem | null>(null);
  const [toDelete, setToDelete] = useState<MaintenanceItem | null>(null);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [projectId, setProjectId] = useState("");
  const [price, setPrice] = useState("");
  const [interval, setInterval_] = useState<BillingCycle>("Yearly");
  const [dueDate, setDueDate] = useState(new Date().toISOString().slice(0, 10));
  const [status, setStatus] = useState<MaintenanceStatus>("Active");
  const [error, setError] = useState("");

  useEffect(() => {
    const unsubs = [
      subscribeMaintenanceItems((rows) => { setItems(rows); setLoading(false); }),
      subscribeProjects(setProjects),
    ];
    return () => unsubs.forEach((u) => u());
  }, []);

  const projectName = (id?: string) => projects.find((p) => p.id === id)?.name;

  const filtered = useMemo(
    () => items.filter((m) =>
      m.name.toLowerCase().includes(search.toLowerCase()) ||
      (projectName(m.projectId) ?? "").toLowerCase().includes(search.toLowerCase())
    ),
    [items, search, projects]
  );

  const activeItems = items.filter((m) => m.status === "Active");
  const dueSoonCount = items.filter(dueSoon).length;
  const overdueCount = items.filter(isOverdue).length;

  function openCreate() {
    setEditing(null);
    setName(""); setDescription(""); setProjectId(""); setPrice(""); setInterval_("Yearly");
    setDueDate(new Date().toISOString().slice(0, 10)); setStatus("Active"); setError("");
    setFormOpen(true);
  }

  function openEdit(m: MaintenanceItem) {
    setEditing(m);
    setName(m.name); setDescription(m.description ?? ""); setProjectId(m.projectId ?? "");
    setPrice(String(m.price)); setInterval_(m.interval);
    setDueDate(m.dueDate ? toDateInputValue(m.dueDate) : new Date().toISOString().slice(0, 10));
    setStatus(m.status); setError("");
    setFormOpen(true);
  }

  async function handleSave() {
    if (!name.trim()) { setError("Name is required"); return; }
    const priceNum = parseFloat(price);
    if (!priceNum || priceNum <= 0) { setError("Enter a valid price"); return; }
    const due = dateStringToTimestamp(dueDate);
    if (!due) { setError("Enter a due date"); return; }
    const payload = {
      name: name.trim(), price: priceNum, interval, dueDate: due, status,
      ...(projectId ? { projectId } : {}),
      ...(description.trim() ? { description: description.trim() } : {}),
    };
    try {
      if (editing) await updateMaintenanceItem(editing.id, payload);
      else await addMaintenanceItem(payload);
      setFormOpen(false);
    } catch (err) {
      setError("Failed to save. " + (err as Error).message);
    }
  }

  async function markDone(m: MaintenanceItem) {
    const current = toJsDate(m.dueDate);
    if (!current) return;
    const next = advanceDate(current, m.interval);
    await updateMaintenanceItem(m.id, { dueDate: Timestamp.fromDate(next) });
    setFormOpen(false);
  }

  usePageHeader({ actions: <PrimaryButton onClick={openCreate}><Plus size={16} /> New Item</PrimaryButton> });

  if (loading) return <LoadingState />;

  return (
    <div className="max-w-6xl mx-auto">
      <div className="sticky top-0 z-10 bg-neutral-50 pb-4">
        <div className="flex flex-wrap gap-3 mb-5">
          <SearchInput value={search} onChange={setSearch} placeholder="Search maintenance items..." />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <StatCard label="Active Items" value={activeItems.length} icon={Wrench} tone="blue" />
          <StatCard label="Due This Week" value={dueSoonCount} icon={Wrench} tone="amber" />
          <StatCard label="Overdue" value={overdueCount} icon={Wrench} tone="red" />
        </div>
      </div>

      <Card className="overflow-hidden">
        {filtered.length === 0 ? (
          <EmptyState icon={Wrench} label="No maintenance items yet" description="Track recurring upkeep for a project — like renewing a client's domain or hosting — with a due date, interval, and price." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-neutral-50 text-neutral-500 uppercase text-xs border-b border-neutral-200">
                <tr>
                  <th className="px-5 py-3 font-medium">Name</th>
                  <th className="px-5 py-3 font-medium">Project</th>
                  <th className="px-5 py-3 font-medium">Price</th>
                  <th className="px-5 py-3 font-medium">Interval</th>
                  <th className="px-5 py-3 font-medium">Due Date</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {filtered.map((m) => (
                  <tr key={m.id} className="hover:bg-neutral-50">
                    <td className="px-5 py-3">
                      <p className="font-medium text-black">{m.name}</p>
                      {m.description && <p className="text-xs text-neutral-400 truncate max-w-xs">{m.description}</p>}
                    </td>
                    <td className="px-5 py-3 text-neutral-600">{projectName(m.projectId) ?? "—"}</td>
                    <td className="px-5 py-3 font-semibold text-black">{formatCurrency(m.price)}</td>
                    <td className="px-5 py-3 text-neutral-600">{m.interval}</td>
                    <td className={cn("px-5 py-3", isOverdue(m) ? "text-red-600 font-medium" : dueSoon(m) ? "text-amber-600 font-medium" : "text-neutral-600")}>
                      {m.dueDate ? formatDate(toJsDate(m.dueDate)!) : "—"}
                    </td>
                    <td className="px-5 py-3"><StatusBadge label={m.status} tone={toneForStatus(m.status)} /></td>
                    <td className="px-5 py-3 text-right">
                      <div className="flex gap-1 justify-end">
                        {m.status === "Active" && (
                          <button onClick={() => markDone(m)} className="px-2 py-1 text-xs rounded bg-emerald-50 text-emerald-700 hover:bg-emerald-100 font-medium">Done</button>
                        )}
                        <button onClick={() => openEdit(m)} className="p-1.5 rounded-md hover:bg-neutral-100 text-neutral-500"><Pencil size={14} /></button>
                        <button onClick={() => setToDelete(m)} className="p-1.5 rounded-md hover:bg-red-50 text-red-600"><Trash2 size={14} /></button>
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
          <DialogHeader><DialogTitle>{editing ? "Edit Maintenance Item" : "New Maintenance Item"}</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <Field label="Name"><input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. clientdomain.com renewal" /></Field>
            <Field label="Description (optional)"><textarea rows={2} className={inputClass} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Details about this maintenance task" /></Field>
            <Field label="Project (optional)">
              <select className={inputClass} value={projectId} onChange={(e) => setProjectId(e.target.value)}>
                <option value="">Not linked to a project</option>
                {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Price (RM)"><input type="number" min="0" step="0.01" className={inputClass} value={price} onChange={(e) => setPrice(e.target.value)} /></Field>
              <Field label="Interval">
                <select className={inputClass} value={interval} onChange={(e) => setInterval_(e.target.value as BillingCycle)}>
                  {INTERVALS.map((i) => <option key={i} value={i}>{i}</option>)}
                </select>
              </Field>
              <Field label="Due Date">
                {editing ? (
                  <input disabled type="date" className={cn(inputClass, "bg-neutral-50 text-neutral-400 cursor-not-allowed")} value={dueDate} />
                ) : (
                  <input type="date" className={inputClass} value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
                )}
              </Field>
              <Field label="Status">
                <select className={inputClass} value={status} onChange={(e) => setStatus(e.target.value as MaintenanceStatus)}>
                  {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </Field>
            </div>
            {editing && (
              <button
                type="button"
                onClick={() => markDone(editing)}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-700 text-sm font-semibold hover:bg-emerald-100 transition"
              >
                <Check size={15} /> Mark Done — next due {formatDate(advanceDate(toJsDate(editing.dueDate)!, interval))}
              </button>
            )}
            {error && <p className="text-red-700 text-sm">{error}</p>}
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setFormOpen(false)} className="px-4 py-2 text-sm font-medium text-neutral-600 hover:bg-neutral-100 rounded-lg">Cancel</button>
              <PrimaryButton onClick={handleSave}>{editing ? "Save Changes" : "Create"}</PrimaryButton>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <DeleteConfirmModal
        isOpen={!!toDelete}
        onClose={() => setToDelete(null)}
        onConfirm={async () => { if (toDelete) await deleteMaintenanceItem(toDelete.id); setToDelete(null); }}
        title="Delete Maintenance Item"
        description={`Delete "${toDelete?.name}"?`}
      />
    </div>
  );
}
