// Task store backed by Postgres (Neon) through Drizzle.
// Every function takes the signed-in user's id and only ever touches that
// user's tasks: this is where "you can only see your own tasks" is enforced.

import { and, asc, count, eq, ilike, not, or, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { tasks } from "@/db/schema";
import { DEFAULT_PRIORITY, PRIORITIES } from "@/lib/task-validation";

// Postgres rejects anything that isn't a valid UUID with an error, so check first.
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// A missing user id is always a bug in the caller. Fail loudly rather than
// risk running a query without the owner filter.
function assertUserId(userId) {
  if (typeof userId !== "string" || userId.length === 0) {
    throw new Error("A userId is required for task operations.");
  }
}

// In LIKE patterns, % means "anything" and _ means "any one character". Put a
// backslash in front of them (and of backslash itself) so a search for "50%"
// looks for the text "50%", not "50 followed by anything".
function escapeLike(text) {
  return text.replace(/[\\%_]/g, (character) => `\\${character}`);
}

// Sorting by priority: SQL doesn't know "high" comes before "medium", so turn
// each priority into its position in PRIORITIES (high = 0, medium = 1, ...).
const priorityRank = sql.raw(
  `case "tasks"."priority" ${PRIORITIES.map((p, i) => `when '${p.value}' then ${i}`).join(" ")} end`,
);

// The user's tasks.
//   filter: "all" (default), "active" (not completed) or "done" (completed)
//   sort:   "due" (default): soonest due date first, tasks without one last
//           "priority": high first, then by due date within each priority
//   query:  only tasks whose title or notes contain this text (any case)
// Within the same due date (or none), oldest first; id breaks exact ties.
// Filtering and sorting happen in SQL, so the database only sends back the
// rows we show, and the server's time zone can't affect the order.
export async function listTasks(userId, { filter = "all", sort = "due", query = "" } = {}) {
  assertUserId(userId);

  const conditions = [eq(tasks.userId, userId)];
  if (filter === "active") conditions.push(eq(tasks.completed, false));
  if (filter === "done") conditions.push(eq(tasks.completed, true));
  if (query) {
    const pattern = `%${escapeLike(query)}%`;
    // ilike = case-insensitive LIKE. Drizzle sends the pattern as a separate
    // parameter, never pasted into the SQL, so this can't be SQL injection.
    conditions.push(or(ilike(tasks.title, pattern), ilike(tasks.notes, pattern)));
  }

  // In Postgres, ascending order puts NULLs last by default, so tasks
  // without a due date go to the bottom.
  const byDueDate = [asc(tasks.dueDate), asc(tasks.createdAt), asc(tasks.id)];

  return getDb()
    .select()
    .from(tasks)
    .where(and(...conditions))
    .orderBy(...(sort === "priority" ? [asc(priorityRank), ...byDueDate] : byDueDate));
}

// How many of the user's tasks are finished (for the "Clear completed" button).
export async function countCompletedTasks(userId) {
  assertUserId(userId);

  const [{ total }] = await getDb()
    .select({ total: count() })
    .from(tasks)
    .where(and(eq(tasks.userId, userId), eq(tasks.completed, true)));

  return total;
}

// The database fills in id, completed and createdAt; returning() hands back the new row.
// dueDate is "YYYY-MM-DD" (already validated) or null for no due date;
// priority is "high", "medium" or "low".
export async function addTask(userId, title, dueDate = null, priority = DEFAULT_PRIORITY) {
  assertUserId(userId);

  const [task] = await getDb()
    .insert(tasks)
    .values({ userId, title, dueDate, priority })
    .returning();
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

// Changes a task's title, due date, priority and notes (all already
// validated; dueDate and notes may be null to remove them). Any field left out
// (undefined) is not changed. Returns the updated task, or null if it doesn't
// exist or isn't yours.
export async function updateTask(userId, id, { title, dueDate, priority, notes }) {
  assertUserId(userId);

  if (!isTaskId(id)) {
    return null;
  }

  const [task] = await getDb()
    .update(tasks)
    .set({ title, dueDate, priority, notes })
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

// Deletes all of the user's finished tasks at once. Returns how many went.
export async function deleteCompletedTasks(userId) {
  assertUserId(userId);

  const deleted = await getDb()
    .delete(tasks)
    .where(and(eq(tasks.userId, userId), eq(tasks.completed, true)))
    .returning({ id: tasks.id });

  return deleted.length;
}

// Deletes every task. Only for tests, and refuses to run anywhere else,
// so it can never wipe real data by accident.
export async function clearTasks() {
  if (process.env.NODE_ENV !== "test") {
    throw new Error("clearTasks() may only run in tests.");
  }

  await getDb().delete(tasks);
}
