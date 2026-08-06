import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  ListChecks, Plus, LayoutGrid, List as ListIcon, ChevronLeft, ChevronRight,
  Trash2, MessageSquare, AlertTriangle, Send,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  PrimaryButton, Card, LoadingState, EmptyState, Field, inputClass,
  StatusBadge, toneForPriority, toneForStatus,
} from "@/components/ui/shared";
import { usePageHeader } from "@/lib/page-header-context";
import {
  subscribeTasks, addTask, updateTask, deleteTask, subscribeDepartments,
  subscribeProjects, subscribeEmployees, subscribeComments, addComment,
} from "@/lib/db";
import { useAuth } from "@/lib/auth-context";
import { cn, formatDate, toJsDate, dateStringToTimestamp, toDateInputValue } from "@/lib/utils";
import type { Task, TaskStatus, TaskPriority, Department, Project, Employee, Comment } from "@/types";

const COLUMNS: TaskStatus[] = ["Backlog", "To Do", "In Progress", "Review", "Done"];
const PRIORITIES: TaskPriority[] = ["Critical", "High", "Medium", "Low"];

function isOverdue(t: Task): boolean {
  if (t.status === "Done") return false;
  const d = toJsDate(t.dueDate);
  return !!d && d.getTime() < Date.now();
}

export default function TasksPage() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"board" | "list">("board");

  const [filterDept, setFilterDept] = useState("");
  const [filterPriority, setFilterPriority] = useState("");
  const [openOnly, setOpenOnly] = useState(searchParams.get("status") === "open");

  const [formOpen, setFormOpen] = useState(false);
  const [detail, setDetail] = useState<Task | null>(null);

  // form fields
  const [editing, setEditing] = useState<Task | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<TaskStatus>("To Do");
  const [priority, setPriority] = useState<TaskPriority>("Medium");
  const [departmentId, setDepartmentId] = useState("");
  const [projectId, setProjectId] = useState("");
  const [assigneeId, setAssigneeId] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const unsubs = [
      subscribeTasks((rows) => { setTasks(rows); setLoading(false); }),
      subscribeDepartments(setDepartments),
      subscribeProjects(setProjects),
      subscribeEmployees(setEmployees),
    ];
    return () => unsubs.forEach((u) => u());
  }, []);

  const deptName = (id?: string) => departments.find((d) => d.id === id)?.name;
  const deptColor = (id?: string) => departments.find((d) => d.id === id)?.color;
  const empName = (id?: string) => employees.find((e) => e.id === id)?.fullName;

  const filtered = useMemo(
    () =>
      tasks.filter(
        (t) =>
          (!filterDept || t.departmentId === filterDept) &&
          (!filterPriority || t.priority === filterPriority) &&
          (!openOnly || t.status !== "Done")
      ),
    [tasks, filterDept, filterPriority, openOnly]
  );

  const displayColumns = openOnly ? COLUMNS.filter((c) => c !== "Done") : COLUMNS;

  function openCreate(presetStatus?: TaskStatus) {
    setEditing(null);
    setTitle(""); setDescription(""); setStatus(presetStatus ?? "To Do");
    setPriority("Medium"); setDepartmentId(""); setProjectId(""); setAssigneeId(""); setDueDate("");
    setError(""); setFormOpen(true);
  }

  useEffect(() => {
    if (searchParams.get("action") === "new") {
      openCreate();
      setSearchParams((p) => { p.delete("action"); return p; }, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  function openEdit(t: Task) {
    setEditing(t);
    setTitle(t.title); setDescription(t.description ?? ""); setStatus(t.status);
    setPriority(t.priority); setDepartmentId(t.departmentId ?? ""); setProjectId(t.projectId ?? "");
    setAssigneeId(t.assigneeId ?? ""); setDueDate(toDateInputValue(t.dueDate));
    setError(""); setDetail(null); setFormOpen(true);
  }

  async function handleSave() {
    if (!title.trim()) { setError("Title is required"); return; }
    const payload = {
      title, description, status, priority,
      ...(departmentId ? { departmentId } : {}),
      ...(projectId ? { projectId } : {}),
      ...(assigneeId ? { assigneeId } : {}),
      ...(dueDate ? { dueDate: dateStringToTimestamp(dueDate) } : {}),
    };
    try {
      if (editing) await updateTask(editing.id, payload);
      else await addTask(payload as Omit<Task, "id" | "createdAt">);
      setFormOpen(false);
    } catch (err) {
      setError("Failed to save. " + (err as Error).message);
    }
  }

  async function moveTask(t: Task, dir: -1 | 1) {
    const idx = COLUMNS.indexOf(t.status);
    const next = COLUMNS[idx + dir];
    if (next) await updateTask(t.id, { status: next });
  }

  usePageHeader({
    actions: (
      <div className="flex items-center gap-2">
        <div className="flex rounded-lg border border-neutral-200 overflow-hidden">
          <button onClick={() => setView("board")} className={cn("p-2", view === "board" ? "bg-black text-white" : "bg-white text-neutral-500")}><LayoutGrid size={16} /></button>
          <button onClick={() => setView("list")} className={cn("p-2", view === "list" ? "bg-black text-white" : "bg-white text-neutral-500")}><ListIcon size={16} /></button>
        </div>
        <PrimaryButton onClick={() => openCreate()}><Plus size={16} /> New Task</PrimaryButton>
      </div>
    ),
  });

  if (loading) return <LoadingState />;

  return (
    <div className="max-w-[1400px] mx-auto">
      <div className="sticky top-0 z-10 bg-neutral-50 pb-4">
        <div className="flex flex-wrap gap-3 mb-5">
          <select className={cn(inputClass, "max-w-[200px]")} value={filterDept} onChange={(e) => setFilterDept(e.target.value)}>
            <option value="">All Departments</option>
            {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
          <select className={cn(inputClass, "max-w-[180px]")} value={filterPriority} onChange={(e) => setFilterPriority(e.target.value)}>
            <option value="">All Priorities</option>
            {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
          {openOnly && (
            <button
              onClick={() => { setOpenOnly(false); setSearchParams((p) => { p.delete("status"); return p; }, { replace: true }); }}
              className="text-xs font-medium text-sky-700 hover:underline px-1"
            >
              Showing open tasks only · Show all
            </button>
          )}
        </div>
      </div>

      {view === "board" ? (
        <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-5 gap-4">
          {displayColumns.map((col) => {
            const colTasks = filtered.filter((t) => t.status === col);
            return (
              <div key={col} className="bg-neutral-100 rounded-xl p-3 min-h-[200px]">
                <div className="flex items-center justify-between mb-3 px-1">
                  <h3 className="text-sm font-semibold text-neutral-700">{col}</h3>
                  <span className="text-xs text-neutral-400 bg-white rounded-full px-2 py-0.5">{colTasks.length}</span>
                </div>
                <div className="space-y-2.5">
                  {colTasks.map((t) => (
                    <div
                      key={t.id}
                      onClick={() => setDetail(t)}
                      className={cn(
                        "bg-white rounded-lg p-3 shadow-sm border cursor-pointer hover:shadow-md transition",
                        isOverdue(t) ? "border-red-400" : "border-neutral-200"
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-medium text-black leading-snug">{t.title}</p>
                        <StatusBadge label={t.priority} tone={toneForPriority(t.priority)} dot={false} />
                      </div>
                      <div className="flex flex-wrap items-center gap-2 mt-2.5 text-xs text-neutral-500">
                        <span className="inline-flex items-center gap-1">
                          <span className={cn("w-2 h-2 rounded-full", t.assigneeId ? "bg-sky-500" : "bg-neutral-300")} />
                          {t.assigneeId ? empName(t.assigneeId) : "Unassigned"}
                        </span>
                        {t.dueDate && (
                          <span className={cn(isOverdue(t) && "text-red-600 font-medium")}>
                            {isOverdue(t) && <AlertTriangle size={11} className="inline mr-0.5" />}
                            {formatDate(toJsDate(t.dueDate)!)}
                          </span>
                        )}
                      </div>
                      <div className="flex justify-between items-center mt-2.5 pt-2 border-t border-neutral-100" onClick={(e) => e.stopPropagation()}>
                        <button disabled={COLUMNS.indexOf(t.status) === 0} onClick={() => moveTask(t, -1)} className="p-1 rounded hover:bg-neutral-100 disabled:opacity-30"><ChevronLeft size={14} /></button>
                        <button disabled={COLUMNS.indexOf(t.status) === COLUMNS.length - 1} onClick={() => moveTask(t, 1)} className="p-1 rounded hover:bg-neutral-100 disabled:opacity-30"><ChevronRight size={14} /></button>
                      </div>
                    </div>
                  ))}
                  {colTasks.length === 0 && <p className="text-xs text-neutral-400 text-center py-4">No tasks</p>}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <Card className="overflow-hidden">
          {filtered.length === 0 ? (
            <EmptyState icon={ListChecks} label="No tasks match your filters" />
          ) : (
            <table className="w-full text-sm text-left">
              <thead className="bg-neutral-50 text-neutral-500 uppercase text-xs border-b border-neutral-200">
                <tr>
                  <th className="px-5 py-3 font-medium">Task</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 font-medium">Priority</th>
                  <th className="px-5 py-3 font-medium">Department</th>
                  <th className="px-5 py-3 font-medium">Due</th>
                  <th className="px-5 py-3 font-medium">Assignee</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {filtered.map((t) => (
                  <tr key={t.id} onClick={() => setDetail(t)} className={cn("hover:bg-neutral-50 cursor-pointer", isOverdue(t) && "bg-red-50/40")}>
                    <td className="px-5 py-3 font-medium text-black">{t.title}</td>
                    <td className="px-5 py-3"><StatusBadge label={t.status} tone={toneForStatus(t.status)} /></td>
                    <td className="px-5 py-3"><StatusBadge label={t.priority} tone={toneForPriority(t.priority)} dot={false} /></td>
                    <td className="px-5 py-3 text-neutral-600">{deptName(t.departmentId) ?? "—"}</td>
                    <td className={cn("px-5 py-3", isOverdue(t) ? "text-red-600 font-medium" : "text-neutral-600")}>{t.dueDate ? formatDate(toJsDate(t.dueDate)!) : "—"}</td>
                    <td className="px-5 py-3 text-neutral-600">{empName(t.assigneeId) ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      )}

      {/* Create / edit form */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="sm:max-w-lg bg-white max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? "Edit Task" : "New Task"}</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <Field label="Title"><input className={inputClass} value={title} onChange={(e) => setTitle(e.target.value)} /></Field>
            <Field label="Description"><textarea className={inputClass} rows={3} value={description} onChange={(e) => setDescription(e.target.value)} /></Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Status">
                <select className={inputClass} value={status} onChange={(e) => setStatus(e.target.value as TaskStatus)}>
                  {COLUMNS.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </Field>
              <Field label="Priority">
                <select className={inputClass} value={priority} onChange={(e) => setPriority(e.target.value as TaskPriority)}>
                  {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              </Field>
              <Field label="Department">
                <select className={inputClass} value={departmentId} onChange={(e) => setDepartmentId(e.target.value)}>
                  <option value="">None</option>
                  {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </Field>
              <Field label="Project">
                <select className={inputClass} value={projectId} onChange={(e) => setProjectId(e.target.value)}>
                  <option value="">None</option>
                  {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </Field>
              <Field label="Assignee">
                <select className={inputClass} value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)}>
                  <option value="">Unassigned</option>
                  {employees.map((emp) => <option key={emp.id} value={emp.id}>{emp.fullName}</option>)}
                </select>
              </Field>
              <Field label="Due Date"><input type="date" className={inputClass} value={dueDate} onChange={(e) => setDueDate(e.target.value)} /></Field>
            </div>
            {error && <p className="text-red-700 text-sm">{error}</p>}
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setFormOpen(false)} className="px-4 py-2 text-sm font-medium text-neutral-600 hover:bg-neutral-100 rounded-lg">Cancel</button>
              <PrimaryButton onClick={handleSave}>{editing ? "Save" : "Create"}</PrimaryButton>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Detail panel with comments */}
      {detail && (
        <TaskDetail
          task={detail}
          deptName={deptName(detail.departmentId)}
          assignee={empName(detail.assigneeId)}
          authorName={user?.email ?? "User"}
          authorId={user?.uid ?? "system"}
          onEdit={() => openEdit(detail)}
          onDelete={async () => { await deleteTask(detail.id); setDetail(null); }}
          onClose={() => setDetail(null)}
        />
      )}
    </div>
  );
}

function TaskDetail({
  task, deptName, assignee, authorName, authorId, onEdit, onDelete, onClose,
}: {
  task: Task;
  deptName?: string;
  assignee?: string;
  authorName: string;
  authorId: string;
  onEdit: () => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [body, setBody] = useState("");

  useEffect(() => subscribeComments(task.id, setComments), [task.id]);

  async function send() {
    if (!body.trim()) return;
    await addComment({ taskId: task.id, authorId, authorName, body });
    setBody("");
  }

  const sorted = [...comments].sort(
    (a, b) => (toJsDate(a.createdAt)?.getTime() ?? 0) - (toJsDate(b.createdAt)?.getTime() ?? 0)
  );

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg bg-white max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{task.title}</DialogTitle></DialogHeader>
        <div className="space-y-3 pt-1">
          <div className="flex flex-wrap gap-2">
            <StatusBadge label={task.status} tone={toneForStatus(task.status)} />
            <StatusBadge label={task.priority} tone={toneForPriority(task.priority)} dot={false} />
          </div>
          {task.description && <p className="text-sm text-neutral-600">{task.description}</p>}
          <div className="grid grid-cols-2 gap-2 text-sm text-neutral-500">
            <p>Department: <span className="text-black">{deptName ?? "—"}</span></p>
            <p>Assignee: <span className="text-black">{assignee ?? "—"}</span></p>
            <p>Due: <span className="text-black">{task.dueDate ? formatDate(toJsDate(task.dueDate)!) : "—"}</span></p>
          </div>

          <div className="border-t border-neutral-200 pt-3">
            <p className="text-sm font-semibold text-black mb-2 flex items-center gap-1.5"><MessageSquare size={15} /> Comments ({sorted.length})</p>
            <div className="space-y-2 max-h-48 overflow-y-auto mb-2">
              {sorted.map((c) => (
                <div key={c.id} className="bg-neutral-50 rounded-lg p-2.5">
                  <p className="text-xs font-medium text-black">{c.authorName} <span className="text-neutral-400 font-normal">· {c.createdAt ? formatDate(toJsDate(c.createdAt)!) : ""}</span></p>
                  <p className="text-sm text-neutral-700 mt-0.5">{c.body}</p>
                </div>
              ))}
              {sorted.length === 0 && <p className="text-xs text-neutral-400">No comments yet.</p>}
            </div>
            <div className="flex gap-2">
              <input className={inputClass} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Add a comment..." onKeyDown={(e) => e.key === "Enter" && send()} />
              <PrimaryButton onClick={send}><Send size={15} /></PrimaryButton>
            </div>
          </div>

          <div className="flex justify-between pt-2 border-t border-neutral-200">
            <button onClick={onDelete} className="flex items-center gap-1.5 text-sm text-red-600 hover:bg-red-50 px-3 py-2 rounded-lg"><Trash2 size={15} /> Delete</button>
            <PrimaryButton onClick={onEdit}>Edit Task</PrimaryButton>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
