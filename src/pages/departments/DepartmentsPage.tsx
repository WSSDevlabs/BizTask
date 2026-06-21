import { useEffect, useState } from "react";
import { Building2, Plus, Pencil, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DeleteConfirmModal } from "@/components/DeleteConfirmModal";
import {
  PageHeader, PrimaryButton, Card, LoadingState, EmptyState, Field, inputClass,
} from "@/components/ui/shared";
import { subscribeDepartments, addDepartment, updateDepartment, deleteDepartment } from "@/lib/db";
import type { Department } from "@/types";

const COLORS = ["#ef4444", "#f97316", "#eab308", "#22c55e", "#3b82f6", "#8b5cf6", "#ec4899", "#14b8a6"];

export default function DepartmentsPage() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Department | null>(null);
  const [toDelete, setToDelete] = useState<Department | null>(null);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState(COLORS[0]);
  const [error, setError] = useState("");

  useEffect(() => {
    const unsub = subscribeDepartments((rows) => {
      setDepartments(rows);
      setLoading(false);
    });
    return unsub;
  }, []);

  function openCreate() {
    setEditing(null);
    setName("");
    setDescription("");
    setColor(COLORS[0]);
    setError("");
    setModalOpen(true);
  }

  function openEdit(d: Department) {
    setEditing(d);
    setName(d.name);
    setDescription(d.description ?? "");
    setColor(d.color);
    setError("");
    setModalOpen(true);
  }

  async function handleSave() {
    if (!name.trim()) {
      setError("Department name is required");
      return;
    }
    try {
      if (editing) {
        await updateDepartment(editing.id, { name, description, color });
      } else {
        await addDepartment({ name, description, color });
      }
      setModalOpen(false);
    } catch (err) {
      setError("Failed to save. " + (err as Error).message);
    }
  }

  return (
    <div className="max-w-5xl mx-auto">
      <PageHeader
        icon={Building2}
        title="Departments"
        subtitle="Used as tags across tasks and projects"
        actions={
          <PrimaryButton onClick={openCreate}>
            <Plus size={16} /> New Department
          </PrimaryButton>
        }
      />

      {loading ? (
        <LoadingState />
      ) : departments.length === 0 ? (
        <Card><EmptyState icon={Building2} label="No departments yet. Create one to start tagging work." /></Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {departments.map((d) => (
            <Card key={d.id} className="p-5">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2.5">
                  <span className="w-3.5 h-3.5 rounded-full" style={{ backgroundColor: d.color }} />
                  <h3 className="font-semibold text-black">{d.name}</h3>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => openEdit(d)} className="p-1.5 rounded-md hover:bg-neutral-100 text-neutral-500">
                    <Pencil size={15} />
                  </button>
                  <button onClick={() => setToDelete(d)} className="p-1.5 rounded-md hover:bg-red-50 text-red-600">
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
              {d.description && <p className="text-sm text-neutral-500 mt-2">{d.description}</p>}
            </Card>
          ))}
        </div>
      )}

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-md bg-white">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Department" : "New Department"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <Field label="Name">
              <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Marketing" />
            </Field>
            <Field label="Description">
              <textarea className={inputClass} rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
            </Field>
            <Field label="Colour">
              <div className="flex flex-wrap gap-2">
                {COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    className={`w-8 h-8 rounded-full border-2 ${color === c ? "border-black" : "border-transparent"}`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </Field>
            {error && <p className="text-red-700 text-sm">{error}</p>}
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setModalOpen(false)} className="px-4 py-2 text-sm font-medium text-neutral-600 hover:bg-neutral-100 rounded-lg">Cancel</button>
              <PrimaryButton onClick={handleSave}>{editing ? "Save" : "Create"}</PrimaryButton>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <DeleteConfirmModal
        isOpen={!!toDelete}
        onClose={() => setToDelete(null)}
        onConfirm={async () => {
          if (toDelete) await deleteDepartment(toDelete.id);
          setToDelete(null);
        }}
        title="Delete Department"
        description={`Delete "${toDelete?.name}"? This cannot be undone.`}
      />
    </div>
  );
}
