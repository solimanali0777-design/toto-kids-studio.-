import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { durableConfigured, durableGet, durablePut } from './durableStore.mjs';

const WORK_FILE = process.env.SOLY_WORK_SESSION_PATH || '/tmp/soly-work-session.json';
const VALID_TASK_STATES = new Set(['pending', 'running', 'blocked', 'done', 'skipped']);
const now = () => new Date().toISOString();
const cleanText = (value, fallback = '') => String(value ?? fallback).trim();

function normalizeTask(task = {}, index = 0) {
  const id = cleanText(task.id) || `task-${index + 1}`;
  const status = VALID_TASK_STATES.has(task.status) ? task.status : 'pending';
  return {
    id,
    title: cleanText(task.title || task.goal || id),
    status,
    note: cleanText(task.note),
    blocker: cleanText(task.blocker),
    alternatives: Array.isArray(task.alternatives) ? task.alternatives.map(String).filter(Boolean).slice(0, 10) : [],
    createdAt: task.createdAt || now(),
    updatedAt: task.updatedAt || now(),
  };
}

function normalizeSession(session = {}) {
  const tasks = Array.isArray(session.tasks) ? session.tasks.map(normalizeTask) : [];
  return {
    version: 1,
    sessionId: cleanText(session.sessionId) || 'active',
    goal: cleanText(session.goal),
    state: session.state === 'completed' ? 'completed' : 'active',
    tasks,
    history: Array.isArray(session.history) ? session.history.slice(-200) : [],
    createdAt: session.createdAt || now(),
    updatedAt: session.updatedAt || now(),
  };
}

async function readAll() {
  if (durableConfigured()) return (await durableGet('work-continuity', 'sessions')) || {};
  try {
    const parsed = JSON.parse(await readFile(WORK_FILE, 'utf8'));
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

async function writeAll(data) {
  if (durableConfigured()) {
    await durablePut('work-continuity', 'sessions', data);
    return;
  }
  await mkdir(dirname(WORK_FILE), { recursive: true });
  await writeFile(WORK_FILE, JSON.stringify(data, null, 2));
}

export async function createWorkSession({ sessionId = 'active', goal = '', tasks = [] } = {}) {
  const all = await readAll();
  const session = normalizeSession({ sessionId, goal, tasks, history: [] });
  session.history.push({ at: now(), type: 'session-created', goal: session.goal, taskCount: session.tasks.length });
  all[session.sessionId] = session;
  await writeAll(all);
  return session;
}

export async function getWorkSession(sessionId = 'active') {
  const all = await readAll();
  const found = all[cleanText(sessionId) || 'active'];
  return found ? normalizeSession(found) : null;
}

export function selectNextTask(session = {}) {
  const tasks = Array.isArray(session.tasks) ? session.tasks : [];
  return tasks.find(task => task.status === 'running')
    || tasks.find(task => task.status === 'pending')
    || null;
}

export function summarizeWorkSession(session = {}) {
  const normalized = normalizeSession(session);
  const counts = { pending: 0, running: 0, blocked: 0, done: 0, skipped: 0 };
  for (const task of normalized.tasks) counts[task.status] += 1;
  const next = selectNextTask(normalized);
  return {
    sessionId: normalized.sessionId,
    goal: normalized.goal,
    state: normalized.state,
    counts,
    nextAction: next ? { id: next.id, title: next.title, status: next.status } : null,
    canContinue: Boolean(next),
    blockedTasks: normalized.tasks.filter(task => task.status === 'blocked').map(task => ({
      id: task.id,
      title: task.title,
      blocker: task.blocker,
      alternatives: task.alternatives,
    })),
    updatedAt: normalized.updatedAt,
  };
}

export async function checkpointWork({
  sessionId = 'active',
  taskId,
  status,
  note = '',
  blocker = '',
  alternatives = [],
  nextAction = '',
} = {}) {
  if (!cleanText(taskId)) throw Object.assign(new Error('taskId is required'), { code: 'schema_error' });
  if (!VALID_TASK_STATES.has(status)) throw Object.assign(new Error('invalid task status'), { code: 'schema_error' });

  const all = await readAll();
  const current = all[cleanText(sessionId) || 'active'];
  if (!current) throw Object.assign(new Error('work session not found'), { code: 'not_found', status: 404 });

  const session = normalizeSession(current);
  const index = session.tasks.findIndex(task => task.id === taskId);
  if (index < 0) throw Object.assign(new Error('work task not found'), { code: 'not_found', status: 404 });

  const previous = session.tasks[index];
  session.tasks[index] = {
    ...previous,
    status,
    note: cleanText(note, previous.note),
    blocker: status === 'blocked' ? cleanText(blocker, previous.blocker) : '',
    alternatives: status === 'blocked'
      ? (Array.isArray(alternatives) ? alternatives.map(String).filter(Boolean).slice(0, 10) : previous.alternatives)
      : [],
    updatedAt: now(),
  };

  const unfinished = session.tasks.some(task => ['pending', 'running'].includes(task.status));
  const completed = session.tasks.length > 0 && session.tasks.every(task => ['done', 'skipped', 'blocked'].includes(task.status));
  session.state = completed && !unfinished ? 'completed' : 'active';
  session.updatedAt = now();
  session.history.push({
    at: session.updatedAt,
    type: 'checkpoint',
    taskId,
    from: previous.status,
    to: status,
    note: cleanText(note),
    blocker: cleanText(blocker),
    nextAction: cleanText(nextAction),
  });
  session.history = session.history.slice(-200);

  all[session.sessionId] = session;
  await writeAll(all);
  return { session, summary: summarizeWorkSession(session) };
}

export async function addWorkTasks(sessionId = 'active', tasks = []) {
  const all = await readAll();
  const current = all[cleanText(sessionId) || 'active'];
  if (!current) throw Object.assign(new Error('work session not found'), { code: 'not_found', status: 404 });

  const session = normalizeSession(current);
  const known = new Set(session.tasks.map(task => task.id));
  const additions = (Array.isArray(tasks) ? tasks : [])
    .map((task, index) => normalizeTask(task, session.tasks.length + index))
    .filter(task => !known.has(task.id));

  session.tasks.push(...additions);
  session.state = 'active';
  session.updatedAt = now();
  session.history.push({ at: session.updatedAt, type: 'tasks-added', taskIds: additions.map(task => task.id) });
  all[session.sessionId] = session;
  await writeAll(all);
  return { session, summary: summarizeWorkSession(session) };
}

export const __test = { normalizeTask, normalizeSession };
