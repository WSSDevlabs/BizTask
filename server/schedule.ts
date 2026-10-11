// Builds the same merged view as src/pages/CalendarPage.tsx — the owner's own
// events plus deadlines from other modules — for a range of Malaysia days.

import type { Firestore, FsData, FsDoc } from './firestore';
import { addDays, dayStart, formatDay, formatTime, isoLocal, myDate } from './http';

export type Kind = 'event' | 'task' | 'project' | 'invoice' | 'bill' | 'leave' | 'maintenance';

export interface ScheduleItem {
  kind: Kind;
  id: string;
  title: string;
  detail?: string;
  allDay: boolean;
  start: string;      // ISO, Malaysia time
  end: string;
  time?: string;      // "15:00–16:00" for timed items
  location?: string;
  notes?: string;
}

interface Item extends Omit<ScheduleItem, 'start' | 'end'> { startD: Date; endD: Date }

const money = (n: unknown) => `RM ${Number(n ?? 0).toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const date = (v: unknown) => (v instanceof Date ? v : null);
const str = (v: unknown) => (typeof v === 'string' && v ? v : undefined);

export function eventToItem(doc: FsDoc): Item | null {
  const d = doc.data;
  const startD = date(d.start);
  if (!startD) return null;
  const endD = date(d.end) ?? startD;
  const allDay = d.allDay === true;
  return {
    kind: 'event', id: doc.id, title: String(d.title ?? ''), allDay, startD, endD,
    location: str(d.location), notes: str(d.description),
    ...(allDay ? {} : { time: `${formatTime(startD)}–${formatTime(endD)}` }),
  };
}

function deadline(kind: Kind, id: string, title: string, due: unknown, detail: string): Item | null {
  const d = date(due);
  return d ? { kind, id, title, detail, allDay: true, startD: d, endD: d } : null;
}

export interface Sources {
  events: FsDoc[];
  tasks: FsDoc[];
  projects: FsDoc[];
  invoices: FsDoc[];
  bills: FsDoc[];
  leave: FsDoc[];
  maintenance: FsDoc[];
}

export async function loadSources(fs: Firestore, ownerUid: string): Promise<Sources> {
  const [events, tasks, projects, invoices, bills, leave, maintenance] = await Promise.all([
    fs.list('calendarEvents', { field: 'ownerId', equals: ownerUid }),
    fs.list('tasks'),
    fs.list('projects'),
    fs.list('invoices'),
    fs.list('bills'),
    fs.list('leaveRequests'),
    fs.list('maintenance'),
  ]);
  return { events, tasks, projects, invoices, bills, leave, maintenance };
}

function allItems(s: Sources): Item[] {
  const out: (Item | null)[] = [];
  const is = (d: FsData, ...v: string[]) => v.includes(String(d.status));

  s.events.forEach((e) => out.push(eventToItem(e)));
  s.tasks.filter((t) => !is(t.data, 'Done'))
    .forEach((t) => out.push(deadline('task', t.id, String(t.data.title), t.data.dueDate, `Task due · ${t.data.priority ?? 'Medium'} priority`)));
  s.projects.filter((p) => !is(p.data, 'Completed', 'Cancelled'))
    .forEach((p) => out.push(deadline('project', p.id, String(p.data.name), p.data.dueDate, 'Project deadline')));
  s.invoices.filter((i) => is(i.data, 'Sent', 'Overdue'))
    .forEach((i) => out.push(deadline('invoice', i.id, `Invoice ${i.data.number}`, i.data.dueDate, `Payment due · ${money(i.data.grandTotal)}`)));
  s.bills.filter((b) => !is(b.data, 'Paid'))
    .forEach((b) => out.push(deadline('bill', b.id, String(b.data.description), b.data.dueDate, `Bill due · ${money(b.data.amount)}`)));
  s.maintenance.filter((m) => is(m.data, 'Active'))
    .forEach((m) => out.push(deadline('maintenance', m.id, String(m.data.name), m.data.dueDate, `Renewal · ${money(m.data.price)}`)));
  s.leave.filter((l) => is(l.data, 'Approved')).forEach((l) => {
    const startD = date(l.data.startDate);
    if (!startD) return;
    out.push({
      kind: 'leave', id: l.id, title: `${l.data.employeeName} on leave`, allDay: true,
      detail: `${l.data.type} leave · ${l.data.days} day(s)`, startD, endD: date(l.data.endDate) ?? startD,
    });
  });
  return out.filter((i): i is Item => i !== null);
}

// The instant range an item occupies. All-day items cover whole Malaysia days,
// inclusive of their end day (matches CalendarPage); timed items are [start, end)
// with a minimum width so zero-length items still land on their day.
function span(i: Item): [number, number] {
  if (i.allDay) {
    return [dayStart(myDate(i.startD)).getTime(), dayStart(addDays(myDate(i.endD < i.startD ? i.startD : i.endD), 1)).getTime()];
  }
  return [i.startD.getTime(), Math.max(i.endD.getTime(), i.startD.getTime() + 1)];
}

function toPublic({ startD, endD, ...rest }: Item): ScheduleItem {
  return { ...rest, start: isoLocal(startD), end: isoLocal(endD) };
}

/** A calendarEvents doc as returned to the bot. */
export function publicEvent(id: string, data: FsData): ScheduleItem | null {
  const i = eventToItem({ id, data });
  return i && toPublic(i);
}

export interface Day { date: string; label: string; items: ScheduleItem[] }

/** Items grouped by Malaysia day, from `from` to `to` inclusive. */
export function scheduleByDay(s: Sources, from: string, to: string): Day[] {
  const items = allItems(s);
  const days: Day[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) {
    const start = dayStart(d).getTime();
    const end = dayStart(addDays(d, 1)).getTime();
    const list = items
      .filter((i) => { const [a, b] = span(i); return a < end && b > start; })
      .sort((a, b) => (a.allDay === b.allDay ? a.startD.getTime() - b.startD.getTime() : a.allDay ? -1 : 1))
      .map(toPublic);
    days.push({ date: d, label: formatDay(d), items: list });
  }
  return days;
}

/** Own events overlapping [start, end), optionally ignoring one event (when editing it). */
export function findClashes(events: FsDoc[], start: Date, end: Date, allDay: boolean, ignoreId?: string): ScheduleItem[] {
  const [s, e] = span({ kind: 'event', id: '', title: '', allDay, startD: start, endD: end });
  return events
    .filter((ev) => ev.id !== ignoreId)
    .map(eventToItem)
    .filter((i): i is Item => i !== null)
    .filter((i) => { const [a, b] = span(i); return a < e && b > s; })
    .map(toPublic);
}

export function overdue(s: Sources) {
  const today = dayStart(myDate()).getTime();
  const before = (v: unknown) => { const d = date(v); return !!d && d.getTime() < today; };
  return {
    tasks: s.tasks.filter((t) => t.data.status !== 'Done' && before(t.data.dueDate))
      .map((t) => ({ id: t.id, title: String(t.data.title), priority: t.data.priority, due: myDate(date(t.data.dueDate)!) })),
    invoices: s.invoices.filter((i) => i.data.status === 'Overdue' || (i.data.status === 'Sent' && before(i.data.dueDate)))
      .map((i) => ({ id: i.id, number: i.data.number, amount: money(i.data.grandTotal), due: date(i.data.dueDate) ? myDate(date(i.data.dueDate)!) : null })),
    bills: s.bills.filter((b) => b.data.status !== 'Paid' && before(b.data.dueDate))
      .map((b) => ({ id: b.id, description: b.data.description, amount: money(b.data.amount), due: myDate(date(b.data.dueDate)!) })),
  };
}

export { money };
