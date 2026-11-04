// Checklist items ("subtasks") inside tasks.
//
// Items have no owner column of their own: an item is yours if its task is
// yours. So every query here joins to, or filters through, the tasks table
// with the user's id. Like lib/tasks.js, a forged or guessed id for someone
// else's item simply matches nothing.

import { and, asc, count, eq, inArray, not } from "drizzle-orm";
import { getDb } from "@/db";
import { subtasks, tasks } from "@/db/schema";
import { SUBTASKS_MAX } from "@/lib/task-validation";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function assertUserId(userId) {
  if (typeof userId !== "string" || userId.length === 0) {
    throw new Error("A userId is required for subtask operations.");
  }
}

function isId(id) {
  return typeof id === "string" && UUID_PATTERN.test(id);
}

// A "subquery": the ids of this user's tasks. Used as
// "where task_id in (select id from tasks where user_id = ...)",
// which Postgres runs as part of the same statement.
function ownTaskIds(userId) {
  return getDb().select({ id: tasks.id }).from(tasks).where(eq(tasks.userId, userId));
}

// "This item, and only if its task belongs to this user."
function ownedSubtask(userId, id) {
  return and(eq(subtasks.id, id), inArray(subtasks.taskId, ownTaskIds(userId)));
}

// All of the user's checklist items, oldest first, in one query (an inner
// join keeps only items whose task is this user's). The page groups them by
// task. Returns [{ id, taskId, title, completed }].
export async function listSubtasks(userId) {
  assertUserId(userId);

  return getDb()
    .select({
      id: subtasks.id,
      taskId: subtasks.taskId,
      title: subtasks.title,
      completed: subtasks.completed,
    })
    .from(subtasks)
    .innerJoin(tasks, eq(subtasks.taskId, tasks.id))
    .where(eq(tasks.userId, userId))
    .orderBy(asc(subtasks.createdAt), asc(subtasks.id));
}

// Adds an item to one of your tasks (title already validated).
// Returns { ok: true, subtask }, or { ok: false, reason } where reason is
// "not-found" (no such task, or not yours) or "full" (SUBTASKS_MAX reached).
export async function addSubtask(userId, taskId, title) {
  assertUserId(userId);

  if (!isId(taskId)) {
    return { ok: false, reason: "not-found" };
  }

  const [task] = await getDb()
    .select({ id: tasks.id })
    .from(tasks)
    .where(and(eq(tasks.id, taskId), eq(tasks.userId, userId)));
  if (!task) {
    return { ok: false, reason: "not-found" };
  }

  const [{ total }] = await getDb()
    .select({ total: count() })
    .from(subtasks)
    .where(eq(subtasks.taskId, taskId));
  if (total >= SUBTASKS_MAX) {
    return { ok: false, reason: "full" };
  }

  const [subtask] = await getDb().insert(subtasks).values({ taskId, title }).returning();
  return { ok: true, subtask };
}

// Ticks an item, or unticks it. Returns the item, or null if not found / not yours.
export async function toggleSubtask(userId, id) {
  assertUserId(userId);

  if (!isId(id)) {
    return null;
  }

  const [subtask] = await getDb()
    .update(subtasks)
    // Computed from the current value in the database, in one statement.
    .set({ completed: not(subtasks.completed) })
    .where(ownedSubtask(userId, id))
    .returning();
  return subtask ?? null;
}

// Removes one item. Returns true if it was removed.
export async function deleteSubtask(userId, id) {
  assertUserId(userId);

  if (!isId(id)) {
    return false;
  }

  const deleted = await getDb()
    .delete(subtasks)
    .where(ownedSubtask(userId, id))
    .returning({ id: subtasks.id });
  return deleted.length > 0;
}
