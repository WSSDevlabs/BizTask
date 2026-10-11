// Task shapes shared by the bot task endpoints. Values mirror src/types (Task).

import type { FsDoc } from './firestore';
import { HttpError, myDate } from './http';

export const STATUSES = ['Backlog', 'To Do', 'In Progress', 'Review', 'Done'] as const;
export const PRIORITIES = ['Critical', 'High', 'Medium', 'Low'] as const;

export function oneOf<T extends readonly string[]>(v: unknown, allowed: T, field: string): T[number] | undefined {
  if (v === undefined || v === null || v === '') return undefined;
  const match = allowed.find((a) => a.toLowerCase() === String(v).toLowerCase());
  if (!match) throw new HttpError(400, `${field} must be one of: ${allowed.join(', ')}`);
  return match;
}

/** Due dates are date-only. Stored as UTC midnight to match the web app's
 *  dateStringToTimestamp(new Date("YYYY-MM-DD")), which it reads back via toISOString(). */
export function parseDue(v: unknown): Date | null | undefined {
  if (v === undefined) return undefined;
  if (v === null || v === '') return null;
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) throw new HttpError(400, 'dueDate must be YYYY-MM-DD');
  return new Date(`${v}T00:00:00Z`);
}

export function publicTask(doc: FsDoc, projects: FsDoc[]) {
  const d = doc.data;
  const due = d.dueDate instanceof Date ? myDate(d.dueDate) : null;
  const project = projects.find((p) => p.id === d.projectId);
  return {
    id: doc.id,
    title: d.title,
    status: d.status,
    priority: d.priority,
    dueDate: due,
    overdue: !!due && d.status !== 'Done' && due < myDate(),
    ...(project ? { project: project.data.name } : {}),
    ...(typeof d.description === 'string' && d.description ? { description: d.description } : {}),
  };
}

export function text(v: unknown, field: string, max: number, required = false): string | undefined {
  if (v === undefined || v === null || v === '') {
    if (required) throw new HttpError(400, `${field} is required`);
    return undefined;
  }
  if (typeof v !== 'string') throw new HttpError(400, `${field} must be text`);
  const t = v.trim();
  if (required && !t) throw new HttpError(400, `${field} is required`);
  if (t.length > max) throw new HttpError(400, `${field} is too long (max ${max} characters)`);
  return t;
}

