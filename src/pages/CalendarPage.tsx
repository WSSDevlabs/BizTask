import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  CalendarRange, ChevronLeft, ChevronRight, Plus, Pencil, Trash2, MapPin, Clock, ArrowRight,
} from "lucide-react";
import { Timestamp } from "firebase/firestore";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DeleteConfirmModal } from "@/components/DeleteConfirmModal";
import { PrimaryButton, Card, LoadingState, Field, inputClass } from "@/components/ui/shared";
import { usePageHeader } from "@/lib/page-header-context";
import { useAuth } from "@/lib/auth-context";
import {
  subscribeCalendarEvents, addCalendarEvent, updateCalendarEvent, deleteCalendarEvent,
  subscribeTasks, subscribeProjects, subscribeInvoices, subscribeBills,
  subscribeLeaveRequests, subscribeMaintenanceItems,
} from "@/lib/db";
import { cn, formatCurrency, toJsDate } from "@/lib/utils";
import type {
  CalendarEvent, Task, Project, Invoice, Bill, LeaveRequest, MaintenanceItem,
} from "@/types";

// ── Item model ───────────────────────────────────────────────────────────────

type Kind = "event" | "task" | "project" | "invoice" | "bill" | "leave" | "maintenance";

interface CalItem {
  id: string;
  kind: Kind;
  title: string;
  subtitle?: string;
  start: Date;
  end: Date;          // same as start for single-day items
  allDay: boolean;
  href?: string;
  event?: CalendarEvent;
}

const KINDS: { kind: Kind; label: string; chip: string; dot: string }[] = [
  { kind: "event",       label: "My Events",   chip: "bg-red-800 text-white",           dot: "bg-red-800" },
  { kind: "task",        label: "Tasks",       chip: "bg-neutral-900 text-white",       dot: "bg-neutral-900" },
  { kind: "project",     label: "Projects",    chip: "bg-blue-100 text-blue-800",       dot: "bg-blue-500" },
  { kind: "invoice",     label: "Invoices",    chip: "bg-emerald-100 text-emerald-800", dot: "bg-emerald-500" },
  { kind: "bill",        label: "Bills",       chip: "bg-amber-100 text-amber-800",     dot: "bg-amber-500" },
  { kind: "leave",       label: "Staff Leave", chip: "bg-violet-100 text-violet-800",   dot: "bg-violet-500" },
  { kind: "maintenance", label: "Maintenance", chip: "bg-sky-100 text-sky-800",         dot: "bg-sky-500" },
];
const KIND_META = Object.fromEntries(KINDS.map((k) => [k.kind, k])) as Record<Kind, (typeof KINDS)[number]>;

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

// ── Local-time date helpers ──────────────────────────────────────────────────
// Keys and <input> values are built from local time on purpose: toISOString()
// is UTC, which in Malaysia (UTC+8) shifts early-morning times to the day before.

const pad = (n: number) => String(n).padStart(2, "0");
const dayKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const timeValue = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

function parseLocal(date: string, time = "00:00"): Date | null {
  if (!date) return null;
  const d = new Date(`${date}T${time}`);
  return isNaN(d.getTime()) ? null : d;
}

function sameDay(a: Date, b: Date) {
  return dayKey(a) === dayKey(b);
}

function formatTime(d: Date) {
  return d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

// 6 weeks × 7 days, starting on the Monday on/before the 1st of the month.
function buildGrid(month: Date): Date[] {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const offset = (first.getDay() + 6) % 7;
  const start = new Date(first.getFullYear(), first.getMonth(), 1 - offset);
  return Array.from({ length: 42 }, (_, i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));
}

function sortItems(a: CalItem, b: CalItem) {
  if (a.allDay !== b.allDay) return a.allDay ? -1 : 1;
  return a.start.getTime() - b.start.getTime();
}

export default function CalendarPage() {
  const { user } = useAuth();

  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [bills, setBills] = useState<Bill[]>([]);
  const [leave, setLeave] = useState<LeaveRequest[]>([]);
  const [maintenance, setMaintenance] = useState<MaintenanceItem[]>([]);
  const [loading, setLoading] = useState(true);

  const [month, setMonth] = useState(() => { const n = new Date(); return new Date(n.getFullYear(), n.getMonth(), 1); });
  const [selected, setSelected] = useState(() => startOfDay(new Date()));
  const [hidden, setHidden] = useState<Set<Kind>>(new Set());

  // Event form
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<CalendarEvent | null>(null);
  const [toDelete, setToDelete] = useState<CalendarEvent | null>(null);
  const [title, setTitle] = useState("");
  const [location, setLocation] = useState("");
  const [description, setDescription] = useState("");
  const [allDay, setAllDay] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [startTime, setStartTime] = useState("09:00");
  const [endDate, setEndDate] = useState("");
  const [endTime, setEndTime] = useState("10:00");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    const unsubs = [
      subscribeCalendarEvents(user.uid, (rows) => { setEvents(rows); setLoading(false); }),
      subscribeTasks(setTasks),
      subscribeProjects(setProjects),
      subscribeInvoices(setInvoices),
      subscribeBills(setBills),
      subscribeLeaveRequests(setLeave),
      subscribeMaintenanceItems(setMaintenance),
    ];
    return () => unsubs.forEach((u) => u());
  }, [user]);

  // ── Merge every dated record into one list ─────────────────────────────────
  const items = useMemo<CalItem[]>(() => {
    const out: CalItem[] = [];
    const single = (id: string, kind: Kind, t: string, d: Date | null, href: string, subtitle?: string) => {
      if (d) out.push({ id, kind, title: t, subtitle, start: d, end: d, allDay: true, href });
    };

    events.forEach((e) => {
      const start = toJsDate(e.start);
      const end = toJsDate(e.end) ?? start;
      if (start && end) out.push({ id: e.id, kind: "event", title: e.title, subtitle: e.location, start, end, allDay: e.allDay, event: e });
    });
    tasks.filter((t) => t.status !== "Done")
      .forEach((t) => single(t.id, "task", t.title, toJsDate(t.dueDate), "/tasks", `Task due · ${t.priority}`));
    projects.filter((p) => p.status !== "Completed" && p.status !== "Cancelled")
      .forEach((p) => single(p.id, "project", p.name, toJsDate(p.dueDate), `/projects/${p.id}`, "Project deadline"));
    invoices.filter((i) => i.status === "Sent" || i.status === "Overdue")
      .forEach((i) => single(i.id, "invoice", `Invoice ${i.number}`, toJsDate(i.dueDate), "/finance/transactions", `Payment due · ${formatCurrency(i.grandTotal)}`));
    bills.filter((b) => b.status !== "Paid")
      .forEach((b) => single(b.id, "bill", b.description, toJsDate(b.dueDate), "/finance/expenses", `Bill due · ${formatCurrency(b.amount)}`));
    maintenance.filter((m) => m.status === "Active")
      .forEach((m) => single(m.id, "maintenance", m.name, toJsDate(m.dueDate), "/maintenance", `Renewal · ${formatCurrency(m.price)}`));
    leave.filter((l) => l.status === "Approved").forEach((l) => {
      const start = toJsDate(l.startDate);
      const end = toJsDate(l.endDate) ?? start;
      if (start && end) out.push({ id: l.id, kind: "leave", title: `${l.employeeName} on leave`, subtitle: `${l.type} leave · ${l.days} day${l.days === 1 ? "" : "s"}`, start, end, allDay: true, href: "/hr/leave" });
    });
    return out;
  }, [events, tasks, projects, invoices, bills, leave, maintenance]);

  // dayKey → items, expanding multi-day items onto every day they cover
  const byDay = useMemo(() => {
    const map = new Map<string, CalItem[]>();
    items.filter((it) => !hidden.has(it.kind)).forEach((it) => {
      const last = startOfDay(it.end < it.start ? it.start : it.end);
      for (let d = startOfDay(it.start); d <= last; d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1)) {
        const k = dayKey(d);
        if (!map.has(k)) map.set(k, []);
        map.get(k)!.push(it);
      }
    });
    map.forEach((list) => list.sort(sortItems));
    return map;
  }, [items, hidden]);

  const grid = useMemo(() => buildGrid(month), [month]);
  const today = new Date();
  const selectedItems = byDay.get(dayKey(selected)) ?? [];

  const upcoming = useMemo(() => {
    const from = startOfDay(new Date());
    const days: { date: Date; items: CalItem[] }[] = [];
    for (let i = 1; i <= 7; i++) {
      const d = new Date(from.getFullYear(), from.getMonth(), from.getDate() + i);
      const list = byDay.get(dayKey(d));
      if (list?.length) days.push({ date: d, items: list });
    }
    return days;
  }, [byDay]);

  // ── Navigation ─────────────────────────────────────────────────────────────
  function shiftMonth(delta: number) {
    setMonth((m) => new Date(m.getFullYear(), m.getMonth() + delta, 1));
  }
  function goToday() {
    const n = new Date();
    setMonth(new Date(n.getFullYear(), n.getMonth(), 1));
    setSelected(startOfDay(n));
  }
  function selectDay(d: Date) {
    setSelected(startOfDay(d));
    if (d.getMonth() !== month.getMonth()) setMonth(new Date(d.getFullYear(), d.getMonth(), 1));
  }
  function toggleKind(k: Kind) {
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k); else next.add(k);
      return next;
    });
  }

  // ── Event form ─────────────────────────────────────────────────────────────
  function openCreate(day: Date = selected) {
    setEditing(null);
    setTitle(""); setLocation(""); setDescription(""); setAllDay(false);
    setStartDate(dayKey(day)); setStartTime("09:00");
    setEndDate(dayKey(day)); setEndTime("10:00");
    setError("");
    setFormOpen(true);
  }

  function openEdit(e: CalendarEvent) {
    const start = toJsDate(e.start) ?? new Date();
    const end = toJsDate(e.end) ?? start;
    setEditing(e);
    setTitle(e.title); setLocation(e.location ?? ""); setDescription(e.description ?? ""); setAllDay(e.allDay);
    setStartDate(dayKey(start)); setStartTime(timeValue(start));
    setEndDate(dayKey(end)); setEndTime(timeValue(end));
    setError("");
    setFormOpen(true);
  }

  async function handleSave() {
    if (!user) return;
    if (!title.trim()) { setError("Title is required"); return; }
    const start = parseLocal(startDate, allDay ? "00:00" : startTime);
    const end = parseLocal(endDate || startDate, allDay ? "00:00" : endTime);
    if (!start || !end) { setError("Enter a valid date and time"); return; }
    if (end < start) { setError("End must be after start"); return; }

    const payload = {
      title: title.trim(),
      allDay,
      start: Timestamp.fromDate(start),
      end: Timestamp.fromDate(end),
      ...(location.trim() ? { location: location.trim() } : {}),
      ...(description.trim() ? { description: description.trim() } : {}),
    };
    setSaving(true);
    try {
      if (editing) await updateCalendarEvent(editing.id, payload);
      else await addCalendarEvent({ ...payload, ownerId: user.uid });
      setFormOpen(false);
      selectDay(start);
    } catch (err) {
      setError("Failed to save. " + (err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  usePageHeader({ actions: <PrimaryButton onClick={() => openCreate()}><Plus size={16} /> New Event</PrimaryButton> });

  if (loading) return <LoadingState />;

  const monthLabel = month.toLocaleDateString("en-GB", { month: "long", year: "numeric" });

  return (
    <div className="max-w-7xl mx-auto space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button onClick={() => shiftMonth(-1)} className="p-2 rounded-lg border border-neutral-200 bg-white hover:bg-neutral-100" aria-label="Previous month"><ChevronLeft size={16} /></button>
          <button onClick={() => shiftMonth(1)} className="p-2 rounded-lg border border-neutral-200 bg-white hover:bg-neutral-100" aria-label="Next month"><ChevronRight size={16} /></button>
          <button onClick={goToday} className="px-3 py-2 rounded-lg border border-neutral-200 bg-white hover:bg-neutral-100 text-sm font-medium">Today</button>
          <h2 className="text-xl font-bold text-black ml-2">{monthLabel}</h2>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {KINDS.map((k) => (
            <button
              key={k.kind}
              onClick={() => toggleKind(k.kind)}
              className={cn(
                "flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium transition",
                hidden.has(k.kind) ? "border-neutral-200 bg-white text-neutral-400 line-through" : "border-neutral-300 bg-white text-neutral-700"
              )}
            >
              <span className={cn("w-2 h-2 rounded-full", hidden.has(k.kind) ? "bg-neutral-300" : k.dot)} />
              {k.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_340px] gap-6">
        {/* Month grid */}
        <Card className="overflow-hidden">
          <div className="grid grid-cols-7 border-b border-neutral-200 bg-neutral-50">
            {WEEKDAYS.map((w) => (
              <div key={w} className="px-2 py-2 text-[11px] font-semibold uppercase tracking-wide text-neutral-500 text-center sm:text-left">{w}</div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {grid.map((d, i) => {
              const list = byDay.get(dayKey(d)) ?? [];
              const inMonth = d.getMonth() === month.getMonth();
              const isToday = sameDay(d, today);
              const isSelected = sameDay(d, selected);
              return (
                <button
                  key={i}
                  onClick={() => selectDay(d)}
                  onDoubleClick={() => openCreate(d)}
                  className={cn(
                    "relative min-h-16 sm:min-h-28 p-1 sm:p-1.5 text-left border-b border-r border-neutral-100 transition flex flex-col",
                    (i + 1) % 7 === 0 && "border-r-0",
                    inMonth ? "bg-white hover:bg-neutral-50" : "bg-neutral-50/60 text-neutral-400 hover:bg-neutral-100/60",
                    isSelected && "ring-2 ring-inset ring-red-800 z-[1]"
                  )}
                >
                  <span className={cn(
                    "inline-flex items-center justify-center w-6 h-6 text-xs font-semibold rounded-full",
                    isToday ? "bg-red-800 text-white" : inMonth ? "text-neutral-800" : "text-neutral-400"
                  )}>
                    {d.getDate()}
                  </span>

                  {/* Phone: dots */}
                  {list.length > 0 && (
                    <div className="flex flex-wrap gap-0.5 mt-1 sm:hidden">
                      {list.slice(0, 4).map((it) => <span key={it.kind + it.id} className={cn("w-1.5 h-1.5 rounded-full", KIND_META[it.kind].dot)} />)}
                    </div>
                  )}

                  {/* Tablet & up: chips */}
                  <div className="hidden sm:flex flex-col gap-0.5 mt-1 min-w-0">
                    {list.slice(0, 3).map((it) => (
                      <span key={it.kind + it.id} className={cn("truncate rounded px-1.5 py-0.5 text-[11px] font-medium leading-tight", KIND_META[it.kind].chip, !inMonth && "opacity-60")}>
                        {!it.allDay && sameDay(it.start, d) && <span className="opacity-80 mr-1">{formatTime(it.start)}</span>}
                        {it.title}
                      </span>
                    ))}
                    {list.length > 3 && <span className="text-[11px] text-neutral-500 px-1">+{list.length - 3} more</span>}
                  </div>
                </button>
              );
            })}
          </div>
        </Card>

        {/* Side panel */}
        <div className="space-y-6">
          <Card className="overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-200">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">{selected.toLocaleDateString("en-GB", { weekday: "long" })}</p>
                <h3 className="text-lg font-semibold text-black">{selected.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}</h3>
              </div>
              <button onClick={() => openCreate()} className="p-2 rounded-lg bg-red-800 text-white hover:bg-red-900" aria-label="Add event on this day"><Plus size={16} /></button>
            </div>
            {selectedItems.length === 0 ? (
              <p className="px-5 py-6 text-sm text-neutral-400">Nothing scheduled.</p>
            ) : (
              <div className="divide-y divide-neutral-100">
                {selectedItems.map((it) => <AgendaRow key={it.kind + it.id} item={it} day={selected} onEdit={openEdit} onDelete={setToDelete} />)}
              </div>
            )}
          </Card>

          <Card className="p-5">
            <h3 className="text-lg font-semibold text-black mb-3 flex items-center gap-2"><CalendarRange size={18} /> Next 7 Days</h3>
            {upcoming.length === 0 ? (
              <p className="text-sm text-neutral-400">Nothing coming up.</p>
            ) : (
              <div className="space-y-3">
                {upcoming.map(({ date, items: list }) => (
                  <button key={dayKey(date)} onClick={() => selectDay(date)} className="block w-full text-left group">
                    <p className="text-xs font-semibold text-neutral-500 group-hover:text-red-800">
                      {date.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}
                    </p>
                    <div className="mt-1 space-y-1">
                      {list.slice(0, 3).map((it) => (
                        <div key={it.kind + it.id} className="flex items-center gap-2 text-sm min-w-0">
                          <span className={cn("w-2 h-2 rounded-full shrink-0", KIND_META[it.kind].dot)} />
                          <span className="truncate text-black">{it.title}</span>
                          {!it.allDay && sameDay(it.start, date) && <span className="ml-auto shrink-0 text-xs text-neutral-400">{formatTime(it.start)}</span>}
                        </div>
                      ))}
                      {list.length > 3 && <p className="text-xs text-neutral-400 pl-4">+{list.length - 3} more</p>}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="sm:max-w-lg bg-white max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? "Edit Event" : "New Event"}</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <Field label="Title"><input className={inputClass} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Meeting with client" autoFocus /></Field>
            <label className="flex items-center gap-2 text-sm text-neutral-700">
              <input type="checkbox" checked={allDay} onChange={(e) => setAllDay(e.target.checked)} className="accent-red-800" />
              All day
            </label>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Start date"><input type="date" className={inputClass} value={startDate} onChange={(e) => { setStartDate(e.target.value); if (!endDate || endDate < e.target.value) setEndDate(e.target.value); }} /></Field>
              {!allDay && <Field label="Start time"><input type="time" className={inputClass} value={startTime} onChange={(e) => setStartTime(e.target.value)} /></Field>}
              <Field label="End date"><input type="date" className={inputClass} value={endDate} min={startDate} onChange={(e) => setEndDate(e.target.value)} /></Field>
              {!allDay && <Field label="End time"><input type="time" className={inputClass} value={endTime} onChange={(e) => setEndTime(e.target.value)} /></Field>}
            </div>
            <Field label="Location (optional)"><input className={inputClass} value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Office, Google Meet link, address…" /></Field>
            <Field label="Notes (optional)"><textarea rows={3} className={inputClass} value={description} onChange={(e) => setDescription(e.target.value)} /></Field>
            {error && <p className="text-red-700 text-sm">{error}</p>}
            <div className="flex items-center justify-between gap-2 pt-2">
              {editing ? (
                <button onClick={() => { setFormOpen(false); setToDelete(editing); }} className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50 rounded-lg"><Trash2 size={14} /> Delete</button>
              ) : <span />}
              <div className="flex gap-2">
                <button onClick={() => setFormOpen(false)} className="px-4 py-2 text-sm font-medium text-neutral-600 hover:bg-neutral-100 rounded-lg">Cancel</button>
                <PrimaryButton onClick={handleSave} isLoading={saving}>{editing ? "Save Changes" : "Create"}</PrimaryButton>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <DeleteConfirmModal
        isOpen={!!toDelete}
        onClose={() => setToDelete(null)}
        onConfirm={async () => { if (toDelete) await deleteCalendarEvent(toDelete.id); setToDelete(null); }}
        title="Delete Event"
        description={`Delete "${toDelete?.title}"?`}
      />
    </div>
  );
}

function AgendaRow({ item, day, onEdit, onDelete }: {
  item: CalItem;
  day: Date;
  onEdit: (e: CalendarEvent) => void;
  onDelete: (e: CalendarEvent) => void;
}) {
  const meta = KIND_META[item.kind];
  const multiDay = !sameDay(item.start, item.end);
  let when = "All day";
  if (!item.allDay) {
    if (!multiDay) when = `${formatTime(item.start)} – ${formatTime(item.end)}`;
    else if (sameDay(item.start, day)) when = `From ${formatTime(item.start)}`;
    else if (sameDay(item.end, day)) when = `Until ${formatTime(item.end)}`;
  }

  return (
    <div className="flex gap-3 px-5 py-3">
      <span className={cn("mt-1.5 w-2.5 h-2.5 rounded-full shrink-0", meta.dot)} />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-black truncate">{item.title}</p>
        <p className="text-xs text-neutral-500 flex items-center gap-1 mt-0.5"><Clock size={11} /> {when} · {meta.label}</p>
        {item.subtitle && (
          <p className="text-xs text-neutral-400 mt-0.5 flex items-center gap-1 truncate">
            {item.kind === "event" && <MapPin size={11} className="shrink-0" />}{item.subtitle}
          </p>
        )}
        {item.event?.description && <p className="text-xs text-neutral-500 mt-1 whitespace-pre-line line-clamp-3">{item.event.description}</p>}
      </div>
      {item.event ? (
        <div className="flex gap-0.5 shrink-0 self-start">
          <button onClick={() => onEdit(item.event!)} className="p-1.5 rounded-md hover:bg-neutral-100 text-neutral-500" aria-label="Edit event"><Pencil size={14} /></button>
          <button onClick={() => onDelete(item.event!)} className="p-1.5 rounded-md hover:bg-red-50 text-red-600" aria-label="Delete event"><Trash2 size={14} /></button>
        </div>
      ) : item.href ? (
        <Link to={item.href} className="p-1.5 rounded-md hover:bg-neutral-100 text-neutral-500 shrink-0 self-start" aria-label="Open"><ArrowRight size={14} /></Link>
      ) : null}
    </div>
  );
}
