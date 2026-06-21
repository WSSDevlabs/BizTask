import { useEffect, useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import {
  ArrowLeft, FolderKanban, ListChecks, Activity as ActivityIcon, FileText,
  Plus, Pencil,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  PageHeader, PrimaryButton, Card, LoadingState, EmptyState, Field, inputClass,
  StatusBadge, toneForStatus, toneForPriority,
} from "@/components/ui/shared";
import {
  getProject, updateProject, subscribeTasksByProject, addTask, updateTask,
  subscribeDepartments, subscribeComments,
} from "@/lib/db";
import { cn, formatCurrency, formatDate, toJsDate, dateStringToTimestamp, toDateInputValue } from "@/lib/utils";
import type { Project, ProjectStatus, Task, TaskStatus, TaskPriority, Department, Comment } from "@/types";

const COLUMNS: TaskStatus[] = ["Backlog", "To Do", "In Progress", "Review", "Done"];
const STATUSES: ProjectStatus[] = ["Planning", "Active", "On Hold", "Completed", "Cancelled"];
const PRIORITIES: TaskPriority[] = ["Critical", "High", "Medium", "Low"];

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [project, setProject] = useState<Project | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"tasks" | "activity" | "files">("tasks");

  const [editOpen, setEditOpen] = useState(false);
  const [taskOpen, setTaskOpen] = useState(false);

  // project edit fields
  const [pName, setPName] = useState("");
  const [pStatus, setPStatus] = useState<ProjectStatus>("Planning");
  const [pDue, setPDue] = useState("");
  const [pBudget, setPBudget] = useState("");

  // new task fields
  const [tTitle, setTTitle] = useState("");
  const [tStatus, setTStatus] = useState<TaskStatus>("To Do");
  const [tPriority, setTPriority] = useState<TaskPriority>("Medium");
  const [tDue, setTDue] = useState("");

  useEffect(() => {
    if (!id) return;
    let active = true;
    getProject(id).then((p) => { if (active) { setProject(p); setLoading(false); } });
    const unsubs = [
      subscribeTasksByProject(id, setTasks),
      subscribeDepartments(setDepartments),
    ];
    return () => { active = false; unsubs.forEach((u) => u()); };
  }, [id]);

  const deptName = (dId?: string) => departments.find((d) => d.id === dId)?.name;

  function openEdit() {
    if (!project) return;
    setPName(project.name); setPStatus(project.status);
    setPDue(toDateInputValue(project.dueDate)); setPBudget(project.budget?.toString() ?? "");
    setEditOpen(true);
  }

  async function saveProject() {
    if (!project) return;
    await updateProject(project.id, {
      name: pName, status: pStatus,
      dueDate: dateStringToTimestamp(pDue),
      budget: pBudget ? Number(pBudget) : undefined,
    });
    setProject({ ...project, name: pName, status: pStatus });
    setEditOpen(false);
  }

  async function saveTask() {
    if (!id || !tTitle.trim()) return;
    await addTask({
      title: tTitle, status: tStatus, priority: tPriority, projectId: id,
      departmentId: project?.departmentId,
      dueDate: dateStringToTimestamp(tDue),
    } as Omit<Task, "id" | "createdAt">);
    setTTitle(""); setTStatus("To Do"); setTPriority("Medium"); setTDue("");
    setTaskOpen(false);
  }

  async function moveTask(t: Task, dir: -1 | 1) {
    const next = COLUMNS[COLUMNS.indexOf(t.status) + dir];
    if (next) await updateTask(t.id, { status: next });
  }

  const pct = useMemo(() => {
    if (tasks.length === 0) return 0;
    return Math.round((tasks.filter((t) => t.status === "Done").length / tasks.length) * 100);
  }, [tasks]);

  if (loading) return <LoadingState />;
  if (!project) return (
    <div className="max-w-4xl mx-auto">
      <Card><EmptyState icon={FolderKanban} label="Project not found" /></Card>
      <Link to="/projects" className="inline-flex items-center gap-1 text-sm text-red-800 mt-4"><ArrowLeft size={14} /> Back to Projects</Link>
    </div>
  );

  return (
    <div className="max-w-6xl mx-auto">
      <Link to="/projects" className="inline-flex items-center gap-1 text-sm text-neutral-500 hover:text-black mb-4"><ArrowLeft size={14} /> Projects</Link>

      <PageHeader
        icon={FolderKanban}
        title={project.name}
        subtitle={project.description}
        actions={<PrimaryButton onClick={openEdit}><Pencil size={15} /> Edit</PrimaryButton>}
      />

      <Card className="p-5 mb-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div><p className="text-neutral-400 text-xs uppercase mb-1">Status</p><StatusBadge label={project.status} tone={toneForStatus(project.status)} /></div>
          <div><p className="text-neutral-400 text-xs uppercase mb-1">Department</p><p className="text-black font-medium">{deptName(project.departmentId) ?? "—"}</p></div>
          <div><p className="text-neutral-400 text-xs uppercase mb-1">Due Date</p><p className="text-black font-medium">{project.dueDate ? formatDate(toJsDate(project.dueDate)!) : "—"}</p></div>
          <div><p className="text-neutral-400 text-xs uppercase mb-1">Budget</p><p className="text-black font-medium">{project.budget != null ? formatCurrency(project.budget) : "—"}</p></div>
        </div>
        <div className="mt-4">
          <div className="flex justify-between text-xs text-neutral-500 mb-1"><span>Task completion</span><span>{pct}%</span></div>
          <div className="h-2 bg-neutral-100 rounded-full overflow-hidden"><div className="h-full bg-red-800 rounded-full" style={{ width: `${pct}%` }} /></div>
        </div>
      </Card>

      <div className="flex gap-1 border-b border-neutral-200 mb-5">
        {([["tasks", "Tasks", ListChecks], ["activity", "Activity", ActivityIcon], ["files", "Files", FileText]] as const).map(([key, label, Icon]) => (
          <button key={key} onClick={() => setTab(key)} className={cn("flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition", tab === key ? "border-red-800 text-red-800" : "border-transparent text-neutral-500 hover:text-black")}>
            <Icon size={15} /> {label}
          </button>
        ))}
      </div>

      {tab === "tasks" && (
        <>
          <div className="flex justify-end mb-3">
            <PrimaryButton onClick={() => setTaskOpen(true)}><Plus size={15} /> Add Task</PrimaryButton>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-5 gap-3">
            {COLUMNS.map((col) => {
              const colTasks = tasks.filter((t) => t.status === col);
              return (
                <div key={col} className="bg-neutral-100 rounded-xl p-3 min-h-[150px]">
                  <div className="flex items-center justify-between mb-3 px-1">
                    <h3 className="text-sm font-semibold text-neutral-700">{col}</h3>
                    <span className="text-xs text-neutral-400 bg-white rounded-full px-2 py-0.5">{colTasks.length}</span>
                  </div>
                  <div className="space-y-2">
                    {colTasks.map((t) => (
                      <div key={t.id} className="bg-white rounded-lg p-3 shadow-sm border border-neutral-200">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-medium text-black">{t.title}</p>
                          <StatusBadge label={t.priority} tone={toneForPriority(t.priority)} dot={false} />
                        </div>
                        {t.dueDate && <p className="text-xs text-neutral-400 mt-1">{formatDate(toJsDate(t.dueDate)!)}</p>}
                        <div className="flex justify-between mt-2 pt-2 border-t border-neutral-100">
                          <button disabled={COLUMNS.indexOf(t.status) === 0} onClick={() => moveTask(t, -1)} className="text-xs text-neutral-500 disabled:opacity-30">←</button>
                          <button disabled={COLUMNS.indexOf(t.status) === COLUMNS.length - 1} onClick={() => moveTask(t, 1)} className="text-xs text-neutral-500 disabled:opacity-30">→</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {tab === "activity" && <ProjectActivity tasks={tasks} />}

      {tab === "files" && (
        <Card><EmptyState icon={FileText} label="Manage files in the Assets module and link them to this project." /></Card>
      )}

      {/* Edit project */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-md bg-white">
          <DialogHeader><DialogTitle>Edit Project</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <Field label="Name"><input className={inputClass} value={pName} onChange={(e) => setPName(e.target.value)} /></Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Status">
                <select className={inputClass} value={pStatus} onChange={(e) => setPStatus(e.target.value as ProjectStatus)}>
                  {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </Field>
              <Field label="Due Date"><input type="date" className={inputClass} value={pDue} onChange={(e) => setPDue(e.target.value)} /></Field>
              <Field label="Budget (RM)"><input type="number" className={inputClass} value={pBudget} onChange={(e) => setPBudget(e.target.value)} /></Field>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setEditOpen(false)} className="px-4 py-2 text-sm font-medium text-neutral-600 hover:bg-neutral-100 rounded-lg">Cancel</button>
              <PrimaryButton onClick={saveProject}>Save</PrimaryButton>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add task */}
      <Dialog open={taskOpen} onOpenChange={setTaskOpen}>
        <DialogContent className="sm:max-w-md bg-white">
          <DialogHeader><DialogTitle>Add Task</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <Field label="Title"><input className={inputClass} value={tTitle} onChange={(e) => setTTitle(e.target.value)} /></Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Status">
                <select className={inputClass} value={tStatus} onChange={(e) => setTStatus(e.target.value as TaskStatus)}>
                  {COLUMNS.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </Field>
              <Field label="Priority">
                <select className={inputClass} value={tPriority} onChange={(e) => setTPriority(e.target.value as TaskPriority)}>
                  {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              </Field>
              <Field label="Due Date"><input type="date" className={inputClass} value={tDue} onChange={(e) => setTDue(e.target.value)} /></Field>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setTaskOpen(false)} className="px-4 py-2 text-sm font-medium text-neutral-600 hover:bg-neutral-100 rounded-lg">Cancel</button>
              <PrimaryButton onClick={saveTask}>Add</PrimaryButton>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Activity tab — aggregates recent comments across the project's tasks
function ProjectActivity({ tasks }: { tasks: Task[] }) {
  const [allComments, setAllComments] = useState<Record<string, Comment[]>>({});

  useEffect(() => {
    const unsubs = tasks.map((t) =>
      subscribeComments(t.id, (rows) => setAllComments((prev) => ({ ...prev, [t.id]: rows })))
    );
    return () => unsubs.forEach((u) => u());
  }, [tasks]);

  const taskTitle = (id: string) => tasks.find((t) => t.id === id)?.title ?? "Task";
  const feed = Object.values(allComments).flat().sort(
    (a, b) => (toJsDate(b.createdAt)?.getTime() ?? 0) - (toJsDate(a.createdAt)?.getTime() ?? 0)
  );

  return (
    <Card className="p-5">
      {feed.length === 0 ? (
        <EmptyState icon={ActivityIcon} label="No comments yet on this project's tasks." />
      ) : (
        <div className="space-y-3">
          {feed.map((c) => (
            <div key={c.id} className="flex gap-3 text-sm">
              <div className="w-8 h-8 rounded-full bg-red-100 text-red-800 flex items-center justify-center font-semibold text-xs shrink-0">
                {c.authorName.charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="text-black"><span className="font-medium">{c.authorName}</span> on <span className="text-red-800">{taskTitle(c.taskId)}</span></p>
                <p className="text-neutral-600">{c.body}</p>
                <p className="text-xs text-neutral-400 mt-0.5">{c.createdAt ? formatDate(toJsDate(c.createdAt)!) : ""}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
