import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { FolderKanban, Plus, Trash2, MoreVertical } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DeleteConfirmModal } from "@/components/DeleteConfirmModal";
import {
  PrimaryButton, Card, LoadingState, EmptyState, Field, inputClass, SearchInput,
} from "@/components/ui/shared";
import { usePageHeader } from "@/lib/page-header-context";
import {
  subscribeProjects, addProject, updateProject, deleteProject, subscribeDepartments,
  subscribeEmployees,
} from "@/lib/db";
import { cn, dateStringToTimestamp, toDateInputValue, getInitials } from "@/lib/utils";
import type { Project, ProjectStatus, Department, Employee, ProjectMember, ProjectMemberRole } from "@/types";

const STATUSES: ProjectStatus[] = ["Planning", "Active", "At Risk", "On Hold", "Completed", "Cancelled"];

function projectTone(status: ProjectStatus) {
  switch (status) {
    case "Active":    return { badge: "bg-sky-50 text-sky-700 border-sky-200", border: "border-l-sky-500", bar: "bg-sky-500", label: "In Progress" };
    case "At Risk":   return { badge: "bg-amber-50 text-amber-700 border-amber-200", border: "border-l-amber-500", bar: "bg-amber-500", label: "At Risk" };
    case "Completed": return { badge: "bg-emerald-50 text-emerald-700 border-emerald-200", border: "border-l-emerald-500", bar: "bg-emerald-500", label: "Completed" };
    case "Cancelled": return { badge: "bg-red-50 text-red-700 border-red-200", border: "border-l-red-400", bar: "bg-red-500", label: "Cancelled" };
    default:          return { badge: "bg-neutral-100 text-neutral-600 border-neutral-200", border: "border-l-neutral-300", bar: "bg-neutral-400", label: status };
  }
}

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterDept, setFilterDept] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Project | null>(null);
  const [toDelete, setToDelete] = useState<Project | null>(null);
  const [menuFor, setMenuFor] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [status, setStatus] = useState<ProjectStatus>("Planning");
  const [startDate, setStartDate] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [budget, setBudget] = useState("");
  const [teamIds, setTeamIds] = useState<string[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    const unsubs = [
      subscribeProjects((rows) => { setProjects(rows); setLoading(false); }),
      subscribeDepartments(setDepartments),
      subscribeEmployees(setEmployees),
    ];
    return () => unsubs.forEach((u) => u());
  }, []);

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
    setStartDate(""); setDueDate(""); setBudget(""); setTeamIds([]); setError(""); setModalOpen(true);
  }

  function openEdit(p: Project) {
    setEditing(p);
    setName(p.name); setDescription(p.description ?? ""); setDepartmentId(p.departmentId ?? "");
    setStatus(p.status); setStartDate(toDateInputValue(p.startDate)); setDueDate(toDateInputValue(p.dueDate));
    setBudget(p.budget?.toString() ?? ""); setTeamIds((p.team ?? []).map((m) => m.employeeId)); setError(""); setModalOpen(true);
  }

  async function handleSave() {
    if (!name.trim()) { setError("Project name is required"); return; }
    const team: ProjectMember[] = teamIds.map((empId) => {
      const existing = editing?.team?.find((m) => m.employeeId === empId);
      return existing ?? { employeeId: empId, role: "Editor" as ProjectMemberRole };
    });
    const payload = {
      name, description, status, team,
      ...(departmentId ? { departmentId } : {}),
      ...(startDate ? { startDate: dateStringToTimestamp(startDate) } : {}),
      ...(dueDate ? { dueDate: dateStringToTimestamp(dueDate) } : {}),
      ...(budget ? { budget: Number(budget) } : {}),
    };
    try {
      if (editing) await updateProject(editing.id, payload);
      else await addProject(payload as Omit<Project, "id" | "createdAt">);
      setModalOpen(false);
    } catch (err) {
      setError("Failed to save. " + (err as Error).message);
    }
  }

  usePageHeader({ actions: <PrimaryButton onClick={openCreate}><Plus size={16} /> New Project</PrimaryButton> });

  if (loading) return <LoadingState />;

  return (
    <div className="max-w-6xl mx-auto">
      <div className="sticky top-0 z-10 bg-neutral-50 pb-4">
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
      </div>

      {filtered.length === 0 ? (
        <Card><EmptyState icon={FolderKanban} label="No projects found" /></Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((p) => {
            const tone = projectTone(p.status);
            const team = p.team ?? [];
            return (
              <Card key={p.id} className={cn("p-5 hover:shadow-md transition group border-l-4", tone.border)}>
                <div className="flex items-start justify-between mb-3">
                  <span className={cn("inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide border", tone.badge)}>{tone.label}</span>
                  <div className="relative">
                    <button onClick={() => setMenuFor(menuFor === p.id ? null : p.id)} className="p-1 rounded-md hover:bg-neutral-100 text-neutral-400 opacity-0 group-hover:opacity-100 transition"><MoreVertical size={15} /></button>
                    {menuFor === p.id && (
                      <div className="absolute right-0 top-full mt-1 w-36 bg-white rounded-xl border border-neutral-200 shadow-lg z-20 overflow-hidden">
                        <button onClick={() => { setMenuFor(null); openEdit(p); }} className="w-full text-left px-3 py-2 text-xs font-medium text-neutral-700 hover:bg-neutral-50">Edit</button>
                        <button onClick={() => { setMenuFor(null); setToDelete(p); }} className="w-full text-left px-3 py-2 text-xs font-medium text-red-700 hover:bg-red-50">Delete</button>
                      </div>
                    )}
                  </div>
                </div>
                <Link to={`/projects/${p.id}`} className="font-semibold text-black hover:text-sky-700 transition block">{p.name}</Link>
                {p.description && <p className="text-sm text-neutral-500 mt-1.5 line-clamp-2">{p.description}</p>}

                <div className="mt-4 pt-3 border-t border-neutral-100">
                  {team.length === 0 ? (
                    <span className="text-xs text-neutral-400">No members assigned</span>
                  ) : (
                    <div className="flex -space-x-2">
                      {team.slice(0, 5).map((m) => {
                        const emp = employees.find((e) => e.id === m.employeeId);
                        return (
                          <div key={m.employeeId} title={emp?.fullName} className="w-7 h-7 rounded-full bg-sky-100 border-2 border-white text-sky-800 flex items-center justify-center text-[9px] font-bold overflow-hidden shrink-0">
                            {emp?.photoUrl ? <img src={emp.photoUrl} alt="" className="w-full h-full object-cover" /> : getInitials(emp?.email ?? "?")}
                          </div>
                        );
                      })}
                      {team.length > 5 && <div className="w-7 h-7 rounded-full bg-neutral-200 border-2 border-white text-neutral-600 flex items-center justify-center text-[9px] font-bold shrink-0">+{team.length - 5}</div>}
                    </div>
                  )}
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
            <Field label="Team Members">
              <div className="border border-neutral-200 rounded-xl p-2.5 max-h-36 overflow-y-auto space-y-1">
                {employees.length === 0 ? (
                  <p className="text-xs text-neutral-400 px-0.5">No employees found.</p>
                ) : employees.map((e) => (
                  <label key={e.id} className="flex items-center gap-2 text-sm py-0.5">
                    <input
                      type="checkbox"
                      checked={teamIds.includes(e.id)}
                      onChange={(ev) => setTeamIds(ev.target.checked ? [...teamIds, e.id] : teamIds.filter((x) => x !== e.id))}
                    />
                    <span className="text-neutral-700">{e.fullName}</span>
                  </label>
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
        onConfirm={async () => { if (toDelete) await deleteProject(toDelete.id); setToDelete(null); }}
        title="Delete Project"
        description={`Delete "${toDelete?.name}"?`}
      />
    </div>
  );
}
