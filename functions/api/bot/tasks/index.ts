// GET  /api/bot/tasks?filter=open|overdue|today|week|done   (default: open)
//      Optional &q=proposal to search titles.
// POST /api/bot/tasks  { title, dueDate?, priority?, status?, description?, project?, dryRun? }
//      `project` is matched against project names (case-insensitive, partial).

import type { PagesFunction } from '../../../../server/types';
import type { FsData } from '../../../../server/firestore';
import { addDays, audit, HttpError, json, myDate, readJson } from '../../../../server/http';
import { firestore } from '../../../../server/firestore';
import { PRIORITIES, STATUSES, oneOf, parseDue, publicTask, text } from '../../../../server/tasks';

const FILTERS = ['open', 'overdue', 'today', 'week', 'done'] as const;

export const onRequestGet: PagesFunction = async ({ request, env }) => {
  const url = new URL(request.url);
  const filter = oneOf(url.searchParams.get('filter') ?? 'open', FILTERS, 'filter')!;
  const q = (url.searchParams.get('q') ?? '').toLowerCase().trim();

  const fs = firestore(env);
  const [tasks, projects] = await Promise.all([fs.list('tasks'), fs.list('projects')]);
  const today = myDate();
  const weekEnd = addDays(today, 7);

  const rows = tasks
    .map((t) => publicTask(t, projects))
    .filter((t) => {
      if (q && !String(t.title).toLowerCase().includes(q)) return false;
      const open = t.status !== 'Done';
      switch (filter) {
        case 'open': return open;
        case 'done': return !open;
        case 'overdue': return t.overdue;
        case 'today': return open && t.dueDate === today;
        case 'week': return open && !!t.dueDate && t.dueDate >= today && t.dueDate <= weekEnd;
      }
    })
    .sort((a, b) => (a.dueDate ?? '9999').localeCompare(b.dueDate ?? '9999'));

  return json({ today, filter, count: rows.length, tasks: rows.slice(0, 50) });
};

interface TaskInput {
  title?: unknown; dueDate?: unknown; priority?: unknown; status?: unknown;
  description?: unknown; project?: unknown; dryRun?: unknown;
}

export const onRequestPost: PagesFunction = async ({ request, env }) => {
  const input = await readJson<TaskInput>(request);
  const fs = firestore(env);
  const projects = await fs.list('projects');

  const title = text(input.title, 'title', 200, true)!;
  const description = text(input.description, 'description', 2000);
  const due = parseDue(input.dueDate);
  const priority = oneOf(input.priority, PRIORITIES, 'priority') ?? 'Medium';
  const status = oneOf(input.status, STATUSES, 'status') ?? 'To Do';

  let projectId: string | undefined;
  const projectName = text(input.project, 'project', 200);
  if (projectName) {
    const matches = projects.filter((p) => String(p.data.name).toLowerCase().includes(projectName.toLowerCase()));
    if (matches.length === 0) throw new HttpError(400, `No project matches "${projectName}"`);
    if (matches.length > 1) throw new HttpError(400, `"${projectName}" matches several projects: ${matches.map((p) => p.data.name).join(', ')}`);
    projectId = matches[0].id;
  }

  const data: FsData = {
    title, priority, status,
    ...(due ? { dueDate: due } : {}),
    ...(description ? { description } : {}),
    ...(projectId ? { projectId } : {}),
  };

  if (input.dryRun === true) {
    return json({ saved: false, task: publicTask({ id: '(not saved)', data }, projects) });
  }

  const now = new Date();
  const id = await fs.create('tasks', { ...data, createdAt: now, updatedAt: now });
  await audit(fs, 'create', 'Tasks', `Created task ${title}`, id);
  if (projectId) await fs.create('projectActivity', { projectId, taskId: id, type: 'task_created', createdAt: now });
  return json({ saved: true, task: publicTask({ id, data }, projects) }, 201);
};
