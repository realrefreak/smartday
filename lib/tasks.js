// Task store backed by Postgres (Neon) through Drizzle.
// Same function names and results as the old in-memory version, so the page
// and Server Actions did not need to change.

import { asc, eq, not } from "drizzle-orm";
import { getDb } from "@/db";
import { tasks } from "@/db/schema";

// Postgres rejects anything that isn't a valid UUID with an error, so check first.
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Oldest first. id breaks ties if two tasks share the same timestamp.
export async function listTasks() {
  return getDb().select().from(tasks).orderBy(asc(tasks.createdAt), asc(tasks.id));
}

// The database fills in id, completed and createdAt; returning() hands back the new row.
export async function addTask(title) {
  const [task] = await getDb().insert(tasks).values({ title }).returning();
  return task;
}

// Flips completed in one SQL statement (SET completed = NOT completed), so two
// clicks at the same moment can't overwrite each other.
// Returns the updated task, or null if the id is unknown.
export async function toggleTask(id) {
  if (typeof id !== "string" || !UUID_PATTERN.test(id)) {
    return null;
  }

  const [task] = await getDb()
    .update(tasks)
    .set({ completed: not(tasks.completed) })
    .where(eq(tasks.id, id))
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
