// PATCH /api/bot/tasks/:id  { status?, priority?, dueDate?, title?, description?, dryRun? }
// e.g. { "status": "Done" } to mark complete. dueDate: null clears it.

import type { PagesFunction } from '../../../../server/types';
import type { FsData } from '../../../../server/firestore';
import { audit, HttpError, json, readJson } from '../../../../server/http';
import { firestore } from '../../../../server/firestore';
import { PRIORITIES, STATUSES, oneOf, parseDue, publicTask, text } from '../../../../server/tasks';

interface TaskPatch {
  status?: unknown; priority?: unknown; dueDate?: unknown;
  title?: unknown; description?: unknown; dryRun?: unknown;
}

export const onRequestPatch: PagesFunction<'id'> = async ({ request, env, params }) => {
  const input = await readJson<TaskPatch>(request);
  const fs = firestore(env);
  const [doc, projects] = await Promise.all([fs.get('tasks', params.id), fs.list('projects')]);
  if (!doc) throw new HttpError(404, 'Task not found');

  const changes: FsData = {};
  const remove: string[] = [];
  const status = oneOf(input.status, STATUSES, 'status');
  const priority = oneOf(input.priority, PRIORITIES, 'priority');
  const title = input.title !== undefined ? text(input.title, 'title', 200, true) : undefined;
  const due = parseDue(input.dueDate);
  if (status) changes.status = status;
  if (priority) changes.priority = priority;
  if (title) changes.title = title;
  if (due) changes.dueDate = due; else if (due === null) remove.push('dueDate');
  if (input.description !== undefined) {
    const d = text(input.description, 'description', 2000);
    if (d) changes.description = d; else remove.push('description');
  }
  if (Object.keys(changes).length === 0 && remove.length === 0) throw new HttpError(400, 'Nothing to change');

  const after = { ...doc.data, ...changes };
  remove.forEach((k) => delete after[k]);
  const before = publicTask(doc, projects);

  if (input.dryRun === true) {
    return json({ saved: false, before, task: publicTask({ id: doc.id, data: after }, projects) });
  }

  const now = new Date();
  await fs.update('tasks', doc.id, { ...changes, updatedAt: now }, remove);
  await audit(fs, 'update', 'Tasks', `Updated task ${after.title}`, doc.id, changes);

  // Same Project Progress feed the web app writes when a task is completed.
  const projectId = doc.data.projectId;
  if (status === 'Done' && doc.data.status !== 'Done' && typeof projectId === 'string') {
    await fs.create('projectActivity', {
      projectId, taskId: doc.id, type: doc.data.parentTaskId ? 'subtask_done' : 'task_done', createdAt: now,
    });
  }
  return json({ saved: true, before, task: publicTask({ id: doc.id, data: after }, projects) });
};
