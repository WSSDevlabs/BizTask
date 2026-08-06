import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import {
  ArrowLeft, FolderKanban, ListChecks, GanttChartSquare, TrendingUp, Link2, ExternalLink as LinkIcon,
  Plus, Pencil, Trash2, Check, MessageSquare, Clock, CalendarDays, Users, Flag, X, MoreVertical, NotebookPen, Loader2,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DeleteConfirmModal } from "@/components/DeleteConfirmModal";
import {
  PrimaryButton, Card, LoadingState, EmptyState, Field, inputClass,
  StatusBadge, toneForStatus, toneForPriority,
} from "@/components/ui/shared";
import { usePageHeader } from "@/lib/page-header-context";
import {
  getProject, updateProject, deleteProject, subscribeTasksByProject, addTask, updateTask, deleteTask,
  subscribeDepartments, subscribeEmployees, subscribeComments, subscribeProjectNotes,
  subscribeProjectActivity, logProjectActivity,
} from "@/lib/db";
import { cn, formatCurrency, formatDate, toJsDate, dateStringToTimestamp, toDateInputValue, getInitials } from "@/lib/utils";
import type {
  Project, ProjectStatus, ProjectMember, ProjectMemberRole, ProjectLink, ProjectMilestone, MilestoneStatus,
  Task, TaskStatus, TaskPriority, Department, Employee, Comment, ProjectActivity,
} from "@/types";

const STATUSES: ProjectStatus[] = ["Planning", "Active", "At Risk", "On Hold", "Completed", "Cancelled"];
const PRIORITIES: TaskPriority[] = ["Critical", "High", "Medium", "Low"];
const TASK_STATUSES: TaskStatus[] = ["Backlog", "To Do", "In Progress", "Review", "Done"];
const MEMBER_ROLES: ProjectMemberRole[] = ["Owner", "Editor", "Viewer"];
const MILESTONE_STATUSES: MilestoneStatus[] = ["Planned", "In Progress", "Completed"];

function daysUntil(d: Date | null): number | null {
  if (!d) return null;
  return Math.ceil((d.getTime() - Date.now()) / 86400000);
}

let idCounter = 0;
function localId(): string {
  idCounter += 1;
  return `m_${Date.now()}_${idCounter}`;
}

function hostname(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [project, setProject] = useState<Project | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [activity, setActivity] = useState<ProjectActivity[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"tasks" | "timeline" | "dependencies" | "notes">("tasks");

  // Shared notepad
  const [notes, setNotes] = useState("");
  const [savingNotes, setSavingNotes] = useState(false);
  const notesFocusedRef = useRef(false);
  const notesDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [editOpen, setEditOpen] = useState(false);
  const [taskOpen, setTaskOpen] = useState(false);
  const [memberOpen, setMemberOpen] = useState(false);
  const [milestoneOpen, setMilestoneOpen] = useState(false);
  const [toDeleteTask, setToDeleteTask] = useState<Task | null>(null);
  const [deleteProjectOpen, setDeleteProjectOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  // project edit fields
  const [pName, setPName] = useState("");
  const [pStatus, setPStatus] = useState<ProjectStatus>("Planning");
  const [pStart, setPStart] = useState("");
  const [pDue, setPDue] = useState("");
  const [pDescription, setPDescription] = useState("");
  const [pLinks, setPLinks] = useState<ProjectLink[]>([]);
  const [linkLabel, setLinkLabel] = useState("");
  const [linkUrl, setLinkUrl] = useState("");

  // add member fields
  const [memberEmployeeId, setMemberEmployeeId] = useState("");
  const [memberRole, setMemberRole] = useState<ProjectMemberRole>("Editor");

  // add/edit task fields
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [tTitle, setTTitle] = useState("");
  const [tDescription, setTDescription] = useState("");
  const [tStatus, setTStatus] = useState<TaskStatus>("To Do");
  const [tPriority, setTPriority] = useState<TaskPriority>("Medium");
  const [tAssignee, setTAssignee] = useState("");
  const [tDue, setTDue] = useState("");
  const [tDependsOn, setTDependsOn] = useState<string[]>([]);
  const [tParentId, setTParentId] = useState("");

  // milestone fields
  const [msTitle, setMsTitle] = useState("");
  const [msDate, setMsDate] = useState("");
  const [msStatus, setMsStatus] = useState<MilestoneStatus>("Planned");

  // resource link fields (Resources tab)
  const [resourceOpen, setResourceOpen] = useState(false);
  const [rlLabel, setRlLabel] = useState("");
  const [rlUrl, setRlUrl] = useState("");
  const [rlSaving, setRlSaving] = useState(false);
  const [rlError, setRlError] = useState("");
  const [rlToDelete, setRlToDelete] = useState<number | null>(null);

  useEffect(() => {
    if (!id) return;
    let active = true;
    getProject(id).then((p) => { if (active) { setProject(p); setLoading(false); } });
    const unsubs = [
      subscribeTasksByProject(id, setTasks),
      subscribeDepartments(setDepartments),
      subscribeEmployees(setEmployees),
      subscribeProjectNotes(id, (n) => { if (!notesFocusedRef.current) setNotes(n); }),
      subscribeProjectActivity(id, setActivity),
    ];
    return () => { active = false; unsubs.forEach((u) => u()); };
  }, [id]);

  function handleNotesChange(value: string) {
    setNotes(value);
    if (!id) return;
    if (notesDebounceRef.current) clearTimeout(notesDebounceRef.current);
    setSavingNotes(true);
    notesDebounceRef.current = setTimeout(async () => {
      await updateProject(id, { notes: value });
      setSavingNotes(false);
    }, 800);
  }

  const empName = (empId?: string) => employees.find((e) => e.id === empId)?.fullName ?? "Unknown";
  const empInitials = (empId?: string) => getInitials(employees.find((e) => e.id === empId)?.email ?? empName(empId));
  const empPhoto = (empId?: string) => employees.find((e) => e.id === empId)?.photoUrl;
  const taskTitle = (taskId: string) => tasks.find((t) => t.id === taskId)?.title ?? "Task";

  function openEdit() {
    if (!project) return;
    setPName(project.name); setPStatus(project.status);
    setPStart(toDateInputValue(project.startDate)); setPDue(toDateInputValue(project.dueDate));
    setPDescription(project.description ?? ""); setPLinks(project.links ?? []);
    setLinkLabel(""); setLinkUrl("");
    setEditOpen(true);
  }

  async function saveProject() {
    if (!project) return;
    const payload = {
      name: pName, status: pStatus, description: pDescription, links: pLinks,
      ...(pStart ? { startDate: dateStringToTimestamp(pStart) } : {}),
      ...(pDue ? { dueDate: dateStringToTimestamp(pDue) } : {}),
    };
    await updateProject(project.id, payload);
    setProject({ ...project, ...payload });
    setEditOpen(false);
  }

  function addLinkField() {
    if (!linkLabel.trim() || !linkUrl.trim()) return;
    const url = /^https?:\/\//i.test(linkUrl.trim()) ? linkUrl.trim() : `https://${linkUrl.trim()}`;
    setPLinks([...pLinks, { label: linkLabel.trim(), url }]);
    setLinkLabel(""); setLinkUrl("");
  }

  async function addMember() {
    if (!project || !memberEmployeeId) return;
    const team = [...(project.team ?? []).filter((m) => m.employeeId !== memberEmployeeId), { employeeId: memberEmployeeId, role: memberRole }];
    await updateProject(project.id, { team });
    setProject({ ...project, team });
    setMemberEmployeeId(""); setMemberRole("Editor"); setMemberOpen(false);
  }

  async function setMemberRoleFor(empId: string, role: ProjectMemberRole) {
    if (!project) return;
    const team = (project.team ?? []).map((m) => m.employeeId === empId ? { ...m, role } : m);
    await updateProject(project.id, { team });
    setProject({ ...project, team });
  }

  async function removeMember(empId: string) {
    if (!project) return;
    const team = (project.team ?? []).filter((m) => m.employeeId !== empId);
    await updateProject(project.id, { team });
    setProject({ ...project, team });
  }

  function openAddTask(parentId?: string) {
    setEditingTask(null);
    setTTitle(""); setTDescription(""); setTStatus("To Do"); setTPriority("Medium");
    setTAssignee(""); setTDue(""); setTDependsOn([]); setTParentId(parentId ?? "");
    setTaskOpen(true);
  }

  function openEditTask(t: Task) {
    setEditingTask(t);
    setTTitle(t.title); setTDescription(t.description ?? ""); setTStatus(t.status); setTPriority(t.priority);
    setTAssignee(t.assigneeId ?? ""); setTDue(toDateInputValue(t.dueDate)); setTDependsOn(t.dependsOn ?? []);
    setTParentId(t.parentTaskId ?? "");
    setTaskOpen(true);
  }

  async function saveTask() {
    if (!id || !tTitle.trim()) return;
    const subs = editingTask ? tasks.filter((x) => x.parentTaskId === editingTask.id) : [];
    const subsIncomplete = subs.length > 0 && subs.some((s) => s.status !== "Done");
    const effectiveStatus = subsIncomplete && tStatus === "Done" ? "In Progress" : tStatus;
    const payload = {
      title: tTitle.trim(), description: tDescription, status: effectiveStatus, priority: tPriority, projectId: id,
      ...(project?.departmentId ? { departmentId: project.departmentId } : {}),
      ...(tAssignee ? { assigneeId: tAssignee } : {}),
      ...(tDue ? { dueDate: dateStringToTimestamp(tDue) } : {}),
      ...(tDependsOn.length > 0 ? { dependsOn: tDependsOn } : {}),
      ...(tParentId ? { parentTaskId: tParentId } : {}),
    };
    if (editingTask) {
      await updateTask(editingTask.id, payload);
      if (editingTask.status !== "Done" && effectiveStatus === "Done") {
        await logProjectActivity(id, editingTask.id, editingTask.parentTaskId ? "subtask_done" : "task_done");
      }
    } else {
      const newId = await addTask(payload as Omit<Task, "id" | "createdAt">);
      await logProjectActivity(id, newId, tParentId ? "subtask_created" : "task_created");
    }
    setTaskOpen(false);
  }

  async function toggleDone(t: Task) {
    const subs = tasks.filter((x) => x.parentTaskId === t.id);
    if (subs.length > 0 && subs.some((s) => s.status !== "Done")) return; // major task follows its subtasks — can't be manually marked Done
    const nowDone = t.status !== "Done";
    await updateTask(t.id, { status: nowDone ? "Done" : "To Do" });
    if (nowDone && id) {
      await logProjectActivity(id, t.id, t.parentTaskId ? "subtask_done" : "task_done");
    }
  }

  async function addMilestone() {
    if (!project || !msTitle.trim()) return;
    const milestone: ProjectMilestone = {
      id: localId(), title: msTitle.trim(), status: msStatus,
      ...(msDate ? { date: dateStringToTimestamp(msDate) } : {}),
    };
    const milestones = [...(project.milestones ?? []), milestone];
    await updateProject(project.id, { milestones });
    setProject({ ...project, milestones });
    setMsTitle(""); setMsDate(""); setMsStatus("Planned"); setMilestoneOpen(false);
  }

  async function removeMilestone(msId: string) {
    if (!project) return;
    const milestones = (project.milestones ?? []).filter((m) => m.id !== msId);
    await updateProject(project.id, { milestones });
    setProject({ ...project, milestones });
  }

  async function addResourceLink() {
    if (!project) return;
    if (!rlLabel.trim() || !rlUrl.trim()) { setRlError("Enter both a name and a link"); return; }
    const finalUrl = /^https?:\/\//i.test(rlUrl.trim()) ? rlUrl.trim() : `https://${rlUrl.trim()}`;
    try {
      new URL(finalUrl);
    } catch {
      setRlError("That doesn't look like a valid link");
      return;
    }
    setRlSaving(true); setRlError("");
    try {
      const links = [...(project.links ?? []), { label: rlLabel.trim(), url: finalUrl }];
      await updateProject(project.id, { links });
      setProject({ ...project, links });
      setRlLabel(""); setRlUrl(""); setResourceOpen(false);
    } catch (err) {
      setRlError("Failed to add. " + (err as Error).message);
    } finally {
      setRlSaving(false);
    }
  }

  async function removeResourceLink(index: number) {
    if (!project) return;
    const links = (project.links ?? []).filter((_, i) => i !== index);
    await updateProject(project.id, { links });
    setProject({ ...project, links });
    setRlToDelete(null);
  }

  const majorTasks = tasks.filter((t) => !t.parentTaskId);
  const subtasksOf = (parentId: string) => tasks.filter((t) => t.parentTaskId === parentId);
  const leafTasks = tasks.filter((t) => !tasks.some((x) => x.parentTaskId === t.id));
  const doneCount = leafTasks.filter((t) => t.status === "Done").length;
  const pct = leafTasks.length === 0 ? 0 : Math.round((doneCount / leafTasks.length) * 100);
  const editingSubtasks = editingTask ? subtasksOf(editingTask.id) : [];
  const blockDoneStatus = editingSubtasks.length > 0 && editingSubtasks.some((s) => s.status !== "Done");

  usePageHeader({
    icon: FolderKanban,
    title: project?.name ?? "Project",
    actions: project ? (
      <div className="flex items-center gap-2">
        <PrimaryButton onClick={openEdit}><Pencil size={15} /> Edit</PrimaryButton>
        <div className="relative">
          <button onClick={() => setMenuOpen((o) => !o)} className="p-2.5 rounded-xl border border-neutral-200 text-neutral-500 hover:bg-neutral-100"><MoreVertical size={16} /></button>
          {menuOpen && (
            <div className="absolute right-0 top-full mt-2 w-44 bg-white rounded-xl border border-neutral-200 shadow-lg z-50 overflow-hidden">
              <button
                onClick={() => { setMenuOpen(false); setDeleteProjectOpen(true); }}
                className="w-full flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-red-700 hover:bg-red-50"
              >
                <Trash2 size={14} /> Delete Project
              </button>
            </div>
          )}
        </div>
      </div>
    ) : undefined,
  });

  if (loading) return <LoadingState />;
  if (!project) return (
    <div className="max-w-4xl mx-auto">
      <Card><EmptyState icon={FolderKanban} label="Project not found" /></Card>
      <Link to="/projects" className="inline-flex items-center gap-1 text-sm text-red-800 mt-4"><ArrowLeft size={14} /> Back to Projects</Link>
    </div>
  );

  const team = project.team ?? [];
  const links = project.links ?? [];
  const milestones = project.milestones ?? [];
  const startDate = toJsDate(project.startDate);
  const dueDate = toJsDate(project.dueDate);

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex items-center gap-1.5 text-sm text-neutral-400 mb-3">
        <Link to="/projects" className="hover:text-black">Projects</Link>
        <span>/</span>
        <span className="text-black font-medium">{project.name}</span>
      </div>

      <Card className="p-6 mb-6">
        <div className="flex items-start justify-between gap-3 mb-2">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold text-black">{project.name}</h1>
            <StatusBadge label={project.status} tone={toneForStatus(project.status)} />
          </div>
        </div>
        {project.description && <p className="text-sm text-neutral-500 max-w-3xl leading-relaxed">{project.description}</p>}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-sky-50 text-sky-700 shrink-0"><CalendarDays size={16} /></div>
            <div className="min-w-0">
              <p className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wide">Timeline</p>
              <p className="text-sm font-semibold text-black truncate">
                {startDate ? formatDate(startDate) : "—"} - {dueDate ? formatDate(dueDate) : "—"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-sky-50 text-sky-700 shrink-0"><GanttChartSquare size={16} /></div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wide">Overall Progress</p>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-black">{pct}%</span>
                <div className="h-1.5 flex-1 bg-neutral-100 rounded-full overflow-hidden"><div className="h-full bg-emerald-500 rounded-full" style={{ width: `${pct}%` }} /></div>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-sky-50 text-sky-700 shrink-0"><Check size={16} /></div>
            <div className="min-w-0">
              <p className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wide">Tasks Completed</p>
              <p className="text-sm font-semibold text-black"><span className="text-sky-700">{doneCount}</span> / {leafTasks.length}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-sky-50 text-sky-700 shrink-0"><Users size={16} /></div>
            <div className="min-w-0">
              <p className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wide mb-0.5">Assigned Team</p>
              {team.length === 0 ? <p className="text-xs text-neutral-400">No members yet</p> : (
                <div className="flex -space-x-2">
                  {team.slice(0, 4).map((m) => (
                    <div key={m.employeeId} title={empName(m.employeeId)} className="w-6 h-6 rounded-full bg-sky-100 border-2 border-white text-sky-800 flex items-center justify-center text-[9px] font-bold overflow-hidden">
                      {empPhoto(m.employeeId) ? <img src={empPhoto(m.employeeId)} alt="" className="w-full h-full object-cover" /> : empInitials(m.employeeId)}
                    </div>
                  ))}
                  {team.length > 4 && <div className="w-6 h-6 rounded-full bg-neutral-200 border-2 border-white text-neutral-600 flex items-center justify-center text-[9px] font-bold">+{team.length - 4}</div>}
                </div>
              )}
            </div>
          </div>
        </div>

        {links.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-6 pt-5 border-t border-neutral-100">
            {links.map((l, i) => (
              <a key={i} href={l.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-neutral-200 text-xs font-medium text-neutral-700 hover:border-sky-300 hover:text-sky-700 transition">
                <LinkIcon size={12} /> {l.label}
              </a>
            ))}
          </div>
        )}
      </Card>

      <div className="flex gap-1 border-b border-neutral-200 mb-5">
        {([["tasks", "Task List", ListChecks], ["timeline", "Project Progress", TrendingUp], ["dependencies", "Resources", Link2], ["notes", "Notepad", NotebookPen]] as const).map(([key, label, Icon]) => (
          <button key={key} onClick={() => setTab(key)} className={cn("flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition", tab === key ? "border-sky-600 text-sky-700" : "border-transparent text-neutral-500 hover:text-black")}>
            <Icon size={15} /> {label}
          </button>
        ))}
      </div>

      {tab === "tasks" && (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <div className="xl:col-span-2">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-semibold text-black">Active Sprints</h2>
              <PrimaryButton onClick={() => openAddTask()}><Plus size={15} /> Add Task</PrimaryButton>
            </div>

            {majorTasks.length === 0 ? (
              <Card><EmptyState icon={ListChecks} label="No tasks yet" description="Add the first major task, then break it into subtasks." /></Card>
            ) : (
              <div className="space-y-2.5">
                {majorTasks.map((t) => {
                  const subs = subtasksOf(t.id);
                  const hasSubs = subs.length > 0;
                  const subDone = subs.filter((s) => s.status === "Done").length;
                  const isDone = t.status === "Done";
                  const blockedByIncompleteSubtasks = hasSubs && subDone !== subs.length && !isDone;
                  const days = daysUntil(toJsDate(t.dueDate));
                  return (
                    <Card key={t.id} className={cn("p-4 border-l-4", isDone ? "border-l-emerald-400" : "border-l-neutral-200")}>
                      <div className="flex items-start gap-3">
                        <button
                          onClick={() => toggleDone(t)}
                          disabled={blockedByIncompleteSubtasks}
                          title={blockedByIncompleteSubtasks ? "Complete all subtasks first" : undefined}
                          className={cn(
                            "mt-0.5 w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition",
                            isDone
                              ? "bg-emerald-500 border-emerald-500"
                              : blockedByIncompleteSubtasks
                                ? "border-neutral-200 opacity-50 cursor-not-allowed"
                                : "border-neutral-300 hover:border-sky-500"
                          )}
                        >
                          {isDone && <Check size={13} className="text-white" />}
                        </button>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <button onClick={() => openEditTask(t)} className={cn("text-sm font-semibold text-left hover:underline", isDone ? "text-neutral-400 line-through" : "text-black")}>{t.title}</button>
                            <div className="flex items-center gap-2 shrink-0">
                              {hasSubs && <span className="text-[11px] font-semibold text-neutral-400">{subDone}/{subs.length}</span>}
                              {isDone ? (
                                <StatusBadge label="Done" tone="green" dot={false} />
                              ) : (
                                <StatusBadge label={t.priority} tone={toneForPriority(t.priority)} dot={false} />
                              )}
                            </div>
                          </div>
                          {t.description && <p className="text-xs text-neutral-500 mt-1 truncate">{t.description}</p>}
                          <div className="flex items-center justify-between mt-2.5 pt-2.5 border-t border-neutral-100">
                            <div className="flex items-center gap-3 text-xs text-neutral-400">
                              {isDone ? (
                                <span className="flex items-center gap-1"><Check size={12} /> Done</span>
                              ) : days !== null ? (
                                <span className={cn("flex items-center gap-1", days < 0 && "text-red-600 font-medium")}><Clock size={12} /> {days < 0 ? `${Math.abs(days)}d overdue` : days === 0 ? "Due today" : `Due in ${days}d`}</span>
                              ) : null}
                              <MessageCount taskId={t.id} />
                            </div>
                            <div className="flex items-center gap-2">
                              {t.assigneeId && (
                                <div title={empName(t.assigneeId)} className="w-6 h-6 rounded-full bg-neutral-200 text-neutral-700 flex items-center justify-center text-[9px] font-bold overflow-hidden shrink-0">
                                  {empPhoto(t.assigneeId) ? <img src={empPhoto(t.assigneeId)} alt="" className="w-full h-full object-cover" /> : empInitials(t.assigneeId)}
                                </div>
                              )}
                              <button onClick={() => setToDeleteTask(t)} className="p-1 rounded hover:bg-red-50 text-neutral-300 hover:text-red-600"><Trash2 size={13} /></button>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Subtasks */}
                      <div className="mt-3 pt-3 border-t border-neutral-100 pl-8">
                        {hasSubs && (
                          <div className="space-y-1.5 mb-2">
                            {subs.map((s) => {
                              const sDone = s.status === "Done";
                              return (
                                <div key={s.id} className="flex items-center gap-2.5 group">
                                  <button
                                    onClick={() => toggleDone(s)}
                                    className={cn(
                                      "w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition",
                                      sDone ? "bg-emerald-500 border-emerald-500" : "border-neutral-300 hover:border-sky-500"
                                    )}
                                  >
                                    {sDone && <Check size={10} className="text-white" />}
                                  </button>
                                  <button onClick={() => openEditTask(s)} className={cn("text-xs text-left hover:underline flex-1 min-w-0 truncate", sDone ? "text-neutral-400 line-through" : "text-neutral-700")}>{s.title}</button>
                                  {s.assigneeId && (
                                    <div title={empName(s.assigneeId)} className="w-5 h-5 rounded-full bg-neutral-200 text-neutral-700 flex items-center justify-center text-[8px] font-bold shrink-0 overflow-hidden">
                                      {empPhoto(s.assigneeId) ? <img src={empPhoto(s.assigneeId)} alt="" className="w-full h-full object-cover" /> : empInitials(s.assigneeId)}
                                    </div>
                                  )}
                                  <button onClick={() => setToDeleteTask(s)} className="p-0.5 rounded hover:bg-red-50 text-neutral-300 hover:text-red-600 opacity-0 group-hover:opacity-100 transition shrink-0"><Trash2 size={11} /></button>
                                </div>
                              );
                            })}
                          </div>
                        )}
                        <button onClick={() => openAddTask(t.id)} className="text-[11px] font-semibold text-sky-700 hover:underline flex items-center gap-1">
                          <Plus size={11} /> Add Subtask
                        </button>
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-semibold text-black">Key Milestones</h2>
              <button onClick={() => setMilestoneOpen(true)} className="text-sky-700 hover:underline text-xs font-semibold flex items-center gap-1"><Plus size={13} /> Add</button>
            </div>
            <Card className="p-5">
              {milestones.length === 0 ? (
                <p className="text-xs text-neutral-400">No milestones yet.</p>
              ) : (
                <div className="space-y-5">
                  {milestones.map((m, i) => (
                    <div key={m.id} className="relative pl-6 group">
                      {i < milestones.length - 1 && <div className="absolute left-[5px] top-4 bottom-[-20px] w-px bg-neutral-200" />}
                      <span className={cn(
                        "absolute left-0 top-1 w-2.5 h-2.5 rounded-full",
                        m.status === "Completed" ? "bg-emerald-500" : m.status === "In Progress" ? "bg-sky-500 ring-2 ring-sky-100" : "bg-neutral-300"
                      )} />
                      <p className="text-sm font-semibold text-black">{m.title}</p>
                      <p className={cn("text-xs mt-0.5", m.status === "Completed" ? "text-neutral-400" : m.status === "In Progress" ? "text-sky-700 font-medium" : "text-neutral-400")}>
                        {m.status === "Completed" ? "Completed" : m.status === "In Progress" ? "In Progress" : "Planned"}{m.date ? ` · ${formatDate(toJsDate(m.date)!)}` : ""}
                      </p>
                      <button onClick={() => removeMilestone(m.id)} className="absolute right-0 top-0 opacity-0 group-hover:opacity-100 text-neutral-300 hover:text-red-600 transition"><X size={13} /></button>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
        </div>
      )}

      {tab === "timeline" && <ProjectProgress project={project} activity={activity} pct={pct} doneCount={doneCount} totalLeaf={leafTasks.length} />}

      {tab === "dependencies" && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-semibold text-black">Project Resources</h2>
            <PrimaryButton onClick={() => { setRlLabel(""); setRlUrl(""); setRlError(""); setResourceOpen(true); }}><Plus size={15} /> Add Link</PrimaryButton>
          </div>
          {links.length === 0 ? (
            <Card><EmptyState icon={Link2} label="No links yet" description="Add links to external tools, docs, or resources for this project." /></Card>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {links.map((l, i) => (
                <Card key={i} className="group relative overflow-hidden">
                  <a
                    href={l.url}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="flex flex-col items-center text-center gap-2.5 px-4 py-6 hover:bg-neutral-50 transition"
                  >
                    <img
                      src={`https://www.google.com/s2/favicons?sz=64&domain=${encodeURIComponent(hostname(l.url))}`}
                      alt=""
                      className="w-10 h-10 rounded-lg"
                      onError={(e) => { e.currentTarget.style.display = "none"; }}
                    />
                    <p className="text-sm font-semibold text-black truncate max-w-full">{l.label}</p>
                    <p className="text-xs text-neutral-400 truncate max-w-full">{hostname(l.url)}</p>
                  </a>
                  <button
                    onClick={() => setRlToDelete(i)}
                    className="absolute top-2 right-2 p-1.5 rounded-lg bg-white/90 opacity-0 group-hover:opacity-100 hover:bg-red-50 text-red-600 transition shadow-sm"
                    aria-label={`Remove ${l.label}`}
                  >
                    <Trash2 size={13} />
                  </button>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === "notes" && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-semibold text-black">Project Notepad</h2>
            <span className="text-xs text-neutral-400">{savingNotes ? "Saving…" : "Synced for everyone on this project"}</span>
          </div>
          <Card className="overflow-hidden">
            <textarea
              value={notes}
              onChange={(e) => handleNotesChange(e.target.value)}
              onFocus={() => { notesFocusedRef.current = true; }}
              onBlur={() => { notesFocusedRef.current = false; }}
              placeholder="Jot down notes, meeting minutes, or anything the team needs to remember about this project…"
              className="w-full min-h-[420px] p-5 text-sm text-neutral-800 leading-relaxed resize-y focus:outline-none"
            />
          </Card>
        </div>
      )}

      {/* Edit project */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-lg bg-white max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Edit Project</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <Field label="Project Name"><input className={inputClass} value={pName} onChange={(e) => setPName(e.target.value)} /></Field>
            <div className="grid grid-cols-3 gap-3">
              <Field label="Status">
                <select className={inputClass} value={pStatus} onChange={(e) => setPStatus(e.target.value as ProjectStatus)}>
                  {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </Field>
              <Field label="Start Date"><input type="date" className={inputClass} value={pStart} onChange={(e) => setPStart(e.target.value)} /></Field>
              <Field label="End Date"><input type="date" className={inputClass} value={pDue} onChange={(e) => setPDue(e.target.value)} /></Field>
            </div>
            <Field label="Description"><textarea rows={3} className={inputClass} value={pDescription} onChange={(e) => setPDescription(e.target.value)} /></Field>

            <div className="pt-2 border-t border-neutral-100">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-semibold text-black">Quick Links</p>
              </div>
              <div className="space-y-1.5 mb-2">
                {pLinks.map((l, i) => (
                  <div key={i} className="flex items-center justify-between text-sm bg-neutral-50 rounded-lg px-3 py-1.5">
                    <span className="text-black truncate">{l.label}</span>
                    <button onClick={() => setPLinks(pLinks.filter((_, idx) => idx !== i))} className="text-neutral-400 hover:text-red-600"><X size={13} /></button>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <input className={inputClass} placeholder="Label" value={linkLabel} onChange={(e) => setLinkLabel(e.target.value)} />
                <input className={inputClass} placeholder="URL" value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} />
                <button onClick={addLinkField} className="px-3 rounded-xl border border-neutral-200 text-neutral-600 hover:bg-neutral-50 shrink-0"><Plus size={15} /></button>
              </div>
            </div>

            <div className="pt-2 border-t border-neutral-100">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <p className="text-sm font-semibold text-black">Team Members</p>
                  <p className="text-xs text-neutral-400">Manage who has access to this project.</p>
                </div>
                <button onClick={() => setMemberOpen(true)} className="text-sky-700 hover:underline text-xs font-semibold flex items-center gap-1 shrink-0"><Users size={13} /> Add Member</button>
              </div>
              <div className="border border-neutral-200 rounded-xl divide-y divide-neutral-100">
                {team.length === 0 ? (
                  <p className="text-xs text-neutral-400 px-3 py-3">No members yet.</p>
                ) : team.map((m) => (
                  <div key={m.employeeId} className="flex items-center justify-between px-3 py-2.5">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-8 rounded-full bg-sky-100 text-sky-800 flex items-center justify-center text-[10px] font-bold shrink-0 overflow-hidden">
                        {empPhoto(m.employeeId) ? <img src={empPhoto(m.employeeId)} alt="" className="w-full h-full object-cover" /> : empInitials(m.employeeId)}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-black truncate">{empName(m.employeeId)}</p>
                        <p className="text-xs text-neutral-400 truncate">{employees.find((e) => e.id === m.employeeId)?.position ?? ""}</p>
                      </div>
                    </div>
                    {m.role === "Owner" ? (
                      <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full shrink-0">Owner</span>
                    ) : (
                      <div className="flex items-center gap-2 shrink-0">
                        <select value={m.role} onChange={(e) => setMemberRoleFor(m.employeeId, e.target.value as ProjectMemberRole)} className="text-xs border border-neutral-200 rounded-lg px-2 py-1 text-neutral-600">
                          {MEMBER_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                        </select>
                        <button onClick={() => removeMember(m.employeeId)} className="text-neutral-300 hover:text-red-600"><X size={14} /></button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setEditOpen(false)} className="px-4 py-2 text-sm font-medium text-neutral-600 hover:bg-neutral-100 rounded-lg">Cancel</button>
              <PrimaryButton onClick={saveProject}>Save Changes</PrimaryButton>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add member */}
      <Dialog open={memberOpen} onOpenChange={setMemberOpen}>
        <DialogContent className="sm:max-w-sm bg-white">
          <DialogHeader><DialogTitle>Add Team Member</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <Field label="Employee">
              <select className={inputClass} value={memberEmployeeId} onChange={(e) => setMemberEmployeeId(e.target.value)}>
                <option value="">Select employee</option>
                {employees.filter((e) => !team.some((m) => m.employeeId === e.id)).map((e) => <option key={e.id} value={e.id}>{e.fullName}</option>)}
              </select>
            </Field>
            <Field label="Role">
              <select className={inputClass} value={memberRole} onChange={(e) => setMemberRole(e.target.value as ProjectMemberRole)}>
                {MEMBER_ROLES.filter((r) => r !== "Owner").map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </Field>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setMemberOpen(false)} className="px-4 py-2 text-sm font-medium text-neutral-600 hover:bg-neutral-100 rounded-lg">Cancel</button>
              <PrimaryButton onClick={addMember} disabled={!memberEmployeeId}>Add</PrimaryButton>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add milestone */}
      <Dialog open={milestoneOpen} onOpenChange={setMilestoneOpen}>
        <DialogContent className="sm:max-w-sm bg-white">
          <DialogHeader><DialogTitle>Add Milestone</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <Field label="Title"><input className={inputClass} value={msTitle} onChange={(e) => setMsTitle(e.target.value)} /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Date"><input type="date" className={inputClass} value={msDate} onChange={(e) => setMsDate(e.target.value)} /></Field>
              <Field label="Status">
                <select className={inputClass} value={msStatus} onChange={(e) => setMsStatus(e.target.value as MilestoneStatus)}>
                  {MILESTONE_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </Field>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setMilestoneOpen(false)} className="px-4 py-2 text-sm font-medium text-neutral-600 hover:bg-neutral-100 rounded-lg">Cancel</button>
              <PrimaryButton onClick={addMilestone} disabled={!msTitle.trim()}>Add</PrimaryButton>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add resource link */}
      <Dialog open={resourceOpen} onOpenChange={setResourceOpen}>
        <DialogContent className="sm:max-w-md bg-white">
          <DialogHeader><DialogTitle>Add Link</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <Field label="Name"><input className={inputClass} value={rlLabel} onChange={(e) => setRlLabel(e.target.value)} placeholder="Google Drive" /></Field>
            <Field label="Link"><input className={inputClass} value={rlUrl} onChange={(e) => setRlUrl(e.target.value)} placeholder="drive.google.com/..." /></Field>
            {rlError && <p className="text-red-700 text-sm">{rlError}</p>}
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setResourceOpen(false)} className="px-4 py-2 text-sm font-medium text-neutral-600 hover:bg-neutral-100 rounded-lg">Cancel</button>
              <PrimaryButton onClick={addResourceLink} disabled={rlSaving}>
                {rlSaving ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />} Add
              </PrimaryButton>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <DeleteConfirmModal
        isOpen={rlToDelete !== null}
        onClose={() => setRlToDelete(null)}
        onConfirm={async () => { if (rlToDelete !== null) await removeResourceLink(rlToDelete); }}
        title="Remove Link"
        description={`Remove "${rlToDelete !== null ? links[rlToDelete]?.label : ""}"?`}
      />

      {/* Add / edit task */}
      <Dialog open={taskOpen} onOpenChange={setTaskOpen}>
        <DialogContent className="sm:max-w-lg bg-white max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingTask ? (tParentId ? "Edit Subtask" : "Edit Task") : (tParentId ? "Add Subtask" : "Add Task")}</DialogTitle>
          </DialogHeader>
          {tParentId && (
            <p className="text-xs text-neutral-400 -mt-2">Subtask of &quot;{taskTitle(tParentId)}&quot;</p>
          )}
          <div className="space-y-4 pt-2">
            <Field label="Title"><input className={inputClass} value={tTitle} onChange={(e) => setTTitle(e.target.value)} /></Field>
            <Field label="Description"><textarea rows={2} className={inputClass} value={tDescription} onChange={(e) => setTDescription(e.target.value)} /></Field>
            <div className="grid grid-cols-2 gap-4">
              {!tParentId && (
                <>
                  <Field label="Status">
                    <select className={inputClass} value={tStatus} onChange={(e) => setTStatus(e.target.value as TaskStatus)}>
                      {TASK_STATUSES.map((c) => <option key={c} value={c} disabled={c === "Done" && blockDoneStatus}>{c}</option>)}
                    </select>
                    {blockDoneStatus && <p className="text-[11px] text-amber-600 mt-1">Complete all subtasks first.</p>}
                  </Field>
                  <Field label="Priority">
                    <select className={inputClass} value={tPriority} onChange={(e) => setTPriority(e.target.value as TaskPriority)}>
                      {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </Field>
                </>
              )}
              <Field label="Assignee">
                <select className={inputClass} value={tAssignee} onChange={(e) => setTAssignee(e.target.value)}>
                  <option value="">Unassigned</option>
                  {employees.map((e) => <option key={e.id} value={e.id}>{e.fullName}</option>)}
                </select>
              </Field>
              <Field label="Due Date"><input type="date" className={inputClass} value={tDue} onChange={(e) => setTDue(e.target.value)} /></Field>
            </div>
            {!tParentId && tasks.filter((t) => t.id !== editingTask?.id).length > 0 && (
              <Field label="Depends on">
                <div className="border border-neutral-200 rounded-xl p-2.5 max-h-32 overflow-y-auto space-y-1">
                  {tasks.filter((t) => t.id !== editingTask?.id).map((t) => (
                    <label key={t.id} className="flex items-center gap-2 text-sm py-0.5">
                      <input
                        type="checkbox"
                        checked={tDependsOn.includes(t.id)}
                        onChange={(e) => setTDependsOn(e.target.checked ? [...tDependsOn, t.id] : tDependsOn.filter((x) => x !== t.id))}
                      />
                      <span className="text-neutral-700 flex items-center gap-1"><Flag size={11} className="text-neutral-400" /> {t.title}</span>
                    </label>
                  ))}
                </div>
              </Field>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setTaskOpen(false)} className="px-4 py-2 text-sm font-medium text-neutral-600 hover:bg-neutral-100 rounded-lg">Cancel</button>
              <PrimaryButton onClick={saveTask}>{editingTask ? "Save Changes" : "Add Task"}</PrimaryButton>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <DeleteConfirmModal
        isOpen={!!toDeleteTask}
        onClose={() => setToDeleteTask(null)}
        onConfirm={async () => {
          if (toDeleteTask) {
            await deleteTask(toDeleteTask.id);
            if (id) await logProjectActivity(id, toDeleteTask.id, "task_deleted");
          }
          setToDeleteTask(null);
        }}
        title="Delete Task"
        description={`Delete "${toDeleteTask?.title}"?`}
      />

      <DeleteConfirmModal
        isOpen={deleteProjectOpen}
        onClose={() => setDeleteProjectOpen(false)}
        onConfirm={async () => { await deleteProject(project.id); navigate("/projects"); }}
        title="Delete Project"
        description={`Delete "${project.name}" and all its data? This cannot be undone.`}
      />
    </div>
  );
}

// Small live comment-count badge for a task
function MessageCount({ taskId }: { taskId: string }) {
  const [comments, setComments] = useState<Comment[]>([]);
  useEffect(() => subscribeComments(taskId, setComments), [taskId]);
  if (comments.length === 0) return null;
  return <span className="flex items-center gap-1"><MessageSquare size={12} /> {comments.length}</span>;
}

type ProgressRange = "7d" | "1m" | "all";

function daysBetween(start: Date, end: Date): Date[] {
  const days: Date[] = [];
  const cur = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const last = new Date(end.getFullYear(), end.getMonth(), end.getDate());
  while (cur <= last) {
    days.push(new Date(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return days;
}

const dayKey = (d: Date) => d.toISOString().slice(0, 10);
const GRACE_MS = 12 * 60 * 60 * 1000;

// Daily activity — every task/subtask created (unless deleted within 12h of
// creation), completed, or subtask completed. Deletions are logged (to power
// the 12h grace check) but never counted as a plotted activity themselves.
function ProjectProgress({ project, activity, pct, doneCount, totalLeaf }: {
  project: Project; activity: ProjectActivity[]; pct: number; doneCount: number; totalLeaf: number;
}) {
  const [range, setRange] = useState<ProgressRange>("7d");

  const countable = useMemo(() => {
    const deletions = activity.filter((a) => a.type === "task_deleted");
    return activity.filter((a) => {
      if (a.type === "task_deleted") return false;
      if (a.type === "task_created" || a.type === "subtask_created") {
        const createdAt = toJsDate(a.createdAt)?.getTime() ?? 0;
        const gracedOut = deletions.some((d) => {
          if (d.taskId !== a.taskId) return false;
          const deletedAt = toJsDate(d.createdAt)?.getTime() ?? 0;
          return deletedAt >= createdAt && deletedAt - createdAt < GRACE_MS;
        });
        return !gracedOut;
      }
      return true;
    });
  }, [activity]);

  const today = new Date();
  const rangeStart =
    range === "7d" ? new Date(today.getTime() - 6 * 86400000)
    : range === "1m" ? new Date(today.getTime() - 29 * 86400000)
    : toJsDate(project.startDate) ?? toJsDate(project.createdAt) ?? today;

  const days = daysBetween(rangeStart, today);
  const countsByDay = useMemo(() => {
    const map = new Map<string, number>();
    countable.forEach((a) => {
      const d = toJsDate(a.createdAt);
      if (!d) return;
      const key = dayKey(d);
      map.set(key, (map.get(key) ?? 0) + 1);
    });
    return map;
  }, [countable]);

  const points = days.map((d) => ({ date: d, count: countsByDay.get(dayKey(d)) ?? 0 }));
  const totalInRange = points.reduce((s, p) => s + p.count, 0);

  return (
    <div className="space-y-6">
      <Card className="p-5">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-neutral-400 uppercase tracking-widest">Overall Progress</span>
          <span className="text-sm font-bold text-black">{doneCount} / {totalLeaf} tasks · {pct}%</span>
        </div>
        <div className="h-2.5 bg-neutral-100 rounded-full overflow-hidden">
          <div className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-full transition-all duration-700" style={{ width: `${pct}%` }} />
        </div>
      </Card>

      <Card className="p-5">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <div>
            <h2 className="font-semibold text-black">Team Activity</h2>
            <p className="text-xs text-neutral-400 mt-0.5">{totalInRange} activities in this range</p>
          </div>
          <div className="inline-flex items-center gap-1 bg-neutral-100 rounded-xl p-1">
            {([["7d", "7 Days"], ["1m", "1 Month"], ["all", "All"]] as const).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setRange(key)}
                className={cn("px-3 py-1.5 rounded-lg text-xs font-semibold transition", range === key ? "bg-white text-black shadow-sm" : "text-neutral-500 hover:text-black")}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <ActivityChart points={points} />
      </Card>
    </div>
  );
}

function ActivityChart({ points }: { points: { date: Date; count: number }[] }) {
  if (points.length === 0) {
    return <EmptyState icon={TrendingUp} label="No activity yet" description="Create tasks and mark them done to see daily activity here." />;
  }

  const width = 640, height = 180, padX = 20, padY = 20;
  const max = Math.max(1, ...points.map((p) => p.count));
  const stepX = points.length > 1 ? (width - padX * 2) / (points.length - 1) : 0;
  const coords = points.map((p, i) => ({
    x: padX + i * stepX,
    y: height - padY - (p.count / max) * (height - padY * 2),
    ...p,
  }));
  const linePath = coords.map((c, i) => `${i === 0 ? "M" : "L"} ${c.x.toFixed(1)} ${c.y.toFixed(1)}`).join(" ");
  const areaPath = `${linePath} L ${coords[coords.length - 1].x.toFixed(1)} ${height - padY} L ${padX} ${height - padY} Z`;

  // Show at most ~7 date labels regardless of range length, evenly spaced.
  const labelEvery = Math.max(1, Math.ceil(points.length / 7));

  return (
    <div>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-44">
        <path d={areaPath} fill="#0ea5e9" opacity={0.08} />
        <path d={linePath} fill="none" stroke="#0284c7" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        {coords.map((c, i) => (
          <circle key={i} cx={c.x} cy={c.y} r={c.count > 0 ? 3.5 : 2} fill={c.count > 0 ? "#0284c7" : "#cbd5e1"}>
            <title>{`${formatDate(c.date)}: ${c.count} activit${c.count === 1 ? "y" : "ies"}`}</title>
          </circle>
        ))}
      </svg>
      <div className="flex justify-between mt-1 px-1">
        {coords.map((c, i) => (
          <span key={i} className={cn("text-[10px] text-neutral-400", i % labelEvery !== 0 && i !== coords.length - 1 && "invisible")}>
            {formatDate(c.date).replace(/^0+/, "").slice(0, 6)}
          </span>
        ))}
      </div>
    </div>
  );
}
