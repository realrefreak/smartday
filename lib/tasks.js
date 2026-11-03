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
export async function listTasks(userId) {
  assertUserId(userId);

  return getDb()
    .select()
    .from(tasks)
    .where(eq(tasks.userId, userId))
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

// Flips completed in one SQL statement. The WHERE matches the task id AND the
// owner, so toggling someone else's task simply matches nothing.
// Returns the updated task, or null if it doesn't exist or isn't yours.
export async function toggleTask(userId, id) {
  assertUserId(userId);

  if (typeof id !== "string" || !UUID_PATTERN.test(id)) {
    return null;
  }

  const [task] = await getDb()
    .update(tasks)
    .set({ completed: not(tasks.completed) })
    .where(and(eq(tasks.id, id), eq(tasks.userId, userId)))
    .returning();

  return task ?? null;
}

// Deletes every task. Only for tests, and refuses to run anywhere else,
// so it can never wipe real data by accident.
export async function clearTasks() {
  if (process.env.NODE_ENV !== "test") {
    throw new Error("clearTasks() may only run in tests.");
  }

  await getDb().delete(tasks);
}
