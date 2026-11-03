// Task store backed by Postgres (Neon) through Drizzle.
// Every function takes the signed-in user's id and only ever touches that
// user's tasks: this is where "you can only see your own tasks" is enforced.

import { and, asc, eq, not } from "drizzle-orm";
import { getDb } from "@/db";
import { tasks } from "@/db/schema";

// Postgres rejects anything that isn't a valid UUID with an error, so check first.
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// A missing user id is always a bug in the caller. Fail loudly rather than
// risk running a query without the owner filter.
function assertUserId(userId) {
  if (typeof userId !== "string" || userId.length === 0) {
    throw new Error("A userId is required for task operations.");
  }
}

// The user's tasks: soonest due date first, then tasks with no due date.
// Within the same due date (or none), oldest first; id breaks exact ties.
// Sorting happens here in SQL, and doesn't depend on "today", so the server's
// time zone can't affect it.
// filter: "all" (default), "active" (not completed) or "done" (completed).
// Filtering in SQL means the database only sends back the rows we show.
export async function listTasks(userId, { filter = "all" } = {}) {
  assertUserId(userId);

  const conditions = [eq(tasks.userId, userId)];
  if (filter === "active") conditions.push(eq(tasks.completed, false));
  if (filter === "done") conditions.push(eq(tasks.completed, true));

  return getDb()
    .select()
    .from(tasks)
    .where(and(...conditions))
    // In Postgres, ascending order puts NULLs last by default, so tasks
    // without a due date go to the bottom.
    .orderBy(asc(tasks.dueDate), asc(tasks.createdAt), asc(tasks.id));
}

// The database fills in id, completed and createdAt; returning() hands back the new row.
// dueDate is "YYYY-MM-DD" (already validated) or null for no due date.
export async function addTask(userId, title, dueDate = null) {
  assertUserId(userId);

  const [task] = await getDb().insert(tasks).values({ userId, title, dueDate }).returning();
  return task;
}

function isTaskId(id) {
  return typeof id === "string" && UUID_PATTERN.test(id);
}

// "This task, and only if it belongs to this user." Every query that changes
// a single task uses this, so a forged or guessed id for someone else's task
// simply matches nothing. Forgetting the owner check is a classic security bug
// called IDOR ("insecure direct object reference").
function ownedTask(userId, id) {
  return and(eq(tasks.id, id), eq(tasks.userId, userId));
}

// Flips completed in one SQL statement.
// Returns the updated task, or null if it doesn't exist or isn't yours.
export async function toggleTask(userId, id) {
  assertUserId(userId);

  if (!isTaskId(id)) {
    return null;
  }

  const [task] = await getDb()
    .update(tasks)
    .set({ completed: not(tasks.completed) })
    .where(ownedTask(userId, id))
    .returning();

  return task ?? null;
}

// Changes a task's title and due date (both already validated; dueDate may be
// null to remove it). Returns the updated task, or null if it doesn't exist or
// isn't yours.
export async function updateTask(userId, id, { title, dueDate }) {
  assertUserId(userId);

  if (!isTaskId(id)) {
    return null;
  }

  const [task] = await getDb()
    .update(tasks)
    .set({ title, dueDate })
    .where(ownedTask(userId, id))
    .returning();

  return task ?? null;
}

// Deletes one task for good. Returns true if a task was deleted, false if it
// didn't exist or isn't yours.
export async function deleteTask(userId, id) {
  assertUserId(userId);

  if (!isTaskId(id)) {
    return false;
  }

  const deleted = await getDb()
    .delete(tasks)
    .where(ownedTask(userId, id))
    .returning({ id: tasks.id });

  return deleted.length > 0;
}

// Deletes every task. Only for tests, and refuses to run anywhere else,
// so it can never wipe real data by accident.
export async function clearTasks() {
  if (process.env.NODE_ENV !== "test") {
    throw new Error("clearTasks() may only run in tests.");
  }

  await getDb().delete(tasks);
}
