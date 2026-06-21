import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { FolderKanban, Plus, Pencil, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DeleteConfirmModal } from "@/components/DeleteConfirmModal";
import {
  PageHeader, PrimaryButton, Card, LoadingState, EmptyState, Field, inputClass,
  StatusBadge, toneForStatus, SearchInput,
} from "@/components/ui/shared";
import {
  subscribeProjects, addProject, updateProject, deleteProject, subscribeDepartments, subscribeTasks,
} from "@/lib/db";
import { cn, formatCurrency, formatDate, toJsDate, dateStringToTimestamp, toDateInputValue } from "@/lib/utils";
import type { Project, ProjectStatus, Department, Task } from "@/types";

const STATUSES: ProjectStatus[] = ["Planning", "Active", "On Hold", "Completed", "Cancelled"];

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterDept, setFilterDept] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Project | null>(null);
  const [toDelete, setToDelete] = useState<Project | null>(null);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [status, setStatus] = useState<ProjectStatus>("Planning");
  const [startDate, setStartDate] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [budget, setBudget] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const unsubs = [
      subscribeProjects((rows) => { setProjects(rows); setLoading(false); }),
      subscribeDepartments(setDepartments),
      subscribeTasks(setTasks),
    ];
    return () => unsubs.forEach((u) => u());
  }, []);

  const deptName = (id?: string) => departments.find((d) => d.id === id)?.name;

  function progress(projectId: string): number {
    const pTasks = tasks.filter((t) => t.projectId === projectId);
    if (pTasks.length === 0) return 0;
    return Math.round((pTasks.filter((t) => t.status === "Done").length / pTasks.length) * 100);
  }

  const filtered = useMemo(
    () => projects.filter((p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) &&
      (!filterStatus || p.status === filterStatus) &&
      (!filterDept || p.departmentId === filterDept)
    ),
    [projects, search, filterStatus, filterDept]
  );

  function openCreate() {
    setEditing(null);
    setName(""); setDescription(""); setDepartmentId(""); setStatus("Planning");
    setStartDate(""); setDueDate(""); setBudget(""); setError(""); setModalOpen(true);
  }

  function openEdit(p: Project) {
    setEditing(p);
    setName(p.name); setDescription(p.description ?? ""); setDepartmentId(p.departmentId ?? "");
    setStatus(p.status); setStartDate(toDateInputValue(p.startDate)); setDueDate(toDateInputValue(p.dueDate));
    setBudget(p.budget?.toString() ?? ""); setError(""); setModalOpen(true);
  }

  async function handleSave() {
    if (!name.trim()) { setError("Project name is required"); return; }
    const payload = {
      name, description, departmentId: departmentId || undefined, status,
      startDate: dateStringToTimestamp(startDate),
      dueDate: dateStringToTimestamp(dueDate),
      budget: budget ? Number(budget) : undefined,
    };
    try {
      if (editing) await updateProject(editing.id, payload);
      else await addProject(payload as Omit<Project, "id" | "createdAt">);
      setModalOpen(false);
    } catch (err) {
      setError("Failed to save. " + (err as Error).message);
    }
  }

  if (loading) return <LoadingState />;

  return (
    <div className="max-w-6xl mx-auto">
      <PageHeader
        icon={FolderKanban}
        title="Projects"
        subtitle="Track initiatives across departments"
        actions={<PrimaryButton onClick={openCreate}><Plus size={16} /> New Project</PrimaryButton>}
      />

      <div className="flex flex-wrap gap-3 mb-5">
        <SearchInput value={search} onChange={setSearch} placeholder="Search projects..." />
        <select className={cn(inputClass, "max-w-[180px]")} value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
          <option value="">All Statuses</option>
          {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select className={cn(inputClass, "max-w-[200px]")} value={filterDept} onChange={(e) => setFilterDept(e.target.value)}>
          <option value="">All Departments</option>
          {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
      </div>

      {filtered.length === 0 ? (
        <Card><EmptyState icon={FolderKanban} label="No projects found" /></Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((p) => {
            const pct = progress(p.id);
            return (
              <Card key={p.id} className="p-5 hover:shadow-md transition group">
                <div className="flex items-start justify-between">
                  <Link to={`/projects/${p.id}`} className="font-semibold text-black hover:text-red-800 transition">{p.name}</Link>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition">
                    <button onClick={() => openEdit(p)} className="p-1.5 rounded-md hover:bg-neutral-100 text-neutral-500"><Pencil size={14} /></button>
                    <button onClick={() => setToDelete(p)} className="p-1.5 rounded-md hover:bg-red-50 text-red-600"><Trash2 size={14} /></button>
                  </div>
                </div>
                <div className="mt-2"><StatusBadge label={p.status} tone={toneForStatus(p.status)} /></div>
                {p.description && <p className="text-sm text-neutral-500 mt-2 line-clamp-2">{p.description}</p>}

                <div className="mt-4">
                  <div className="flex justify-between text-xs text-neutral-500 mb-1">
                    <span>Progress</span><span>{pct}%</span>
                  </div>
                  <div className="h-2 bg-neutral-100 rounded-full overflow-hidden">
                    <div className="h-full bg-red-800 rounded-full transition-all" style={{ width: `${pct}%` }} />
                  </div>
                </div>

                <div className="flex flex-wrap gap-x-4 gap-y-1 mt-4 text-xs text-neutral-500">
                  {p.departmentId && <span>{deptName(p.departmentId)}</span>}
                  {p.dueDate && <span>Due {formatDate(toJsDate(p.dueDate)!)}</span>}
                  {p.budget != null && <span>{formatCurrency(p.budget)}</span>}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-lg bg-white max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? "Edit Project" : "New Project"}</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <Field label="Name"><input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} /></Field>
            <Field label="Description"><textarea className={inputClass} rows={2} value={description} onChange={(e) => setDescription(e.target.value)} /></Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Department">
                <select className={inputClass} value={departmentId} onChange={(e) => setDepartmentId(e.target.value)}>
                  <option value="">None</option>
                  {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </Field>
              <Field label="Status">
                <select className={inputClass} value={status} onChange={(e) => setStatus(e.target.value as ProjectStatus)}>
                  {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </Field>
              <Field label="Start Date"><input type="date" className={inputClass} value={startDate} onChange={(e) => setStartDate(e.target.value)} /></Field>
              <Field label="Due Date"><input type="date" className={inputClass} value={dueDate} onChange={(e) => setDueDate(e.target.value)} /></Field>
              <Field label="Budget (RM)"><input type="number" className={inputClass} value={budget} onChange={(e) => setBudget(e.target.value)} /></Field>
            </div>
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
        onConfirm={async () => { if (toDelete) await deleteProject(toDelete.id); setToDelete(null); }}
        title="Delete Project"
        description={`Delete "${toDelete?.name}"?`}
      />
    </div>
  );
}
