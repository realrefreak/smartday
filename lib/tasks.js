// Task store backed by Postgres (Neon) through Drizzle.
// Every function takes the signed-in user's id and only ever touches that
// user's tasks: this is where "you can only see your own tasks" is enforced.

import { and, asc, count, desc, eq, exists, gte, ilike, inArray, isNotNull, lte, not, or, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { subtasks, taskCompletions, tasks } from "@/db/schema";
import { isTagQuery, tagPattern } from "@/lib/tags";
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
//   filter: "all" (default), "active" (not completed), "done" (completed),
//           or "today": not completed, and due today or earlier (overdue)
//   today:  the user's date as "YYYY-MM-DD", needed for "today" (only the
//           caller knows the user's time zone)
//   sort:   "due" (default): soonest due date first, tasks without one last
//           "priority": high first, then by due date within each priority
//   query:  only tasks whose title or notes contain this text (any case);
//           a single tag like "#work" finds titles with exactly that tag
// Within the same due date (or none), oldest first; id breaks exact ties.
// Filtering and sorting happen in SQL, so the database only sends back the
// rows we show, and the server's time zone can't affect the order.
export async function listTasks(
  userId,
  { filter = "all", sort = "due", query = "", today } = {},
) {
  assertUserId(userId);

  const conditions = [eq(tasks.userId, userId)];
  if (filter === "active") conditions.push(eq(tasks.completed, false));
  if (filter === "done") conditions.push(eq(tasks.completed, true));
  if (filter === "today") {
    if (!today) throw new Error('The "today" filter needs the user\'s date.');
    // Dates compare as dates in SQL; tasks without one are left out
    // (NULL <= anything is not true).
    conditions.push(eq(tasks.completed, false), lte(tasks.dueDate, today));
  }
  if (isTagQuery(query)) {
    // ~* = case-insensitive regular expression match (see lib/tags.js).
    // The pattern is sent as a parameter, like every other value.
    conditions.push(sql`${tasks.title} ~* ${tagPattern(query)}`);
  } else if (query) {
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

// How many tasks the user has, and how many are finished: for the progress
// summary and the "Clear completed" button. One query counts both.
// count(*) filter (where ...) is Postgres for "count only the rows where ...".
export async function getTaskCounts(userId) {
  assertUserId(userId);

  const [counts] = await getDb()
    .select({
      total: count(),
      completed: sql`count(*) filter (where ${tasks.completed})`.mapWith(Number),
    })
    .from(tasks)
    .where(eq(tasks.userId, userId));

  return counts;
}

// The database fills in id, completed and createdAt; returning() hands back the new row.
// dueDate is "YYYY-MM-DD" (already validated) or null for no due date;
// priority is "high", "medium" or "low"; repeat is "daily", "weekly",
// "monthly" or null (and needs a due date).
export async function addTask(
  userId,
  title,
  dueDate = null,
  priority = DEFAULT_PRIORITY,
  repeat = null,
) {
  assertUserId(userId);

  const [task] = await getDb()
    .insert(tasks)
    .values({ userId, title, dueDate, priority, repeat })
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

// How far a repeating task's due date moves when it's done, as a Postgres
// interval. Adding "1 month" to 31 Jan gives 28 Feb (Postgres keeps it inside
// the month), so month ends just work.
const repeatInterval = sql.raw(
  `case "tasks"."repeat" when 'daily' then interval '1 day' when 'weekly' then interval '7 days' when 'monthly' then interval '1 month' end`,
);

// "This is an unfinished repeating task": marking it done moves it forward.
const rollsForward = and(not(tasks.completed), isNotNull(tasks.repeat), isNotNull(tasks.dueDate));

// Marks a task done, or not done. A repeating task isn't finished: its due
// date moves forward by one day / week / month and it stays on the list, with
// its checklist unticked, ready for next time.
//
// Each new value is computed from the row's current values inside SQL, so two
// clicks at the same moment (say, two open tabs) can't both read the old date
// and save the same new one. Both statements run in one "batch", which is a
// single transaction: the date never moves without the checklist resetting.
// Returns the updated task, or null if it doesn't exist or isn't yours.
export async function toggleTask(userId, id) {
  assertUserId(userId);

  if (!isTaskId(id)) {
    return null;
  }

  // First untick the checklist, but only if the task is about to roll
  // forward. This runs BEFORE the task changes, while rollsForward still
  // describes the task as it is now (afterwards it's "not done" either way).
  const resetChecklist = getDb()
    .update(subtasks)
    .set({ completed: false })
    .where(
      inArray(
        subtasks.taskId,
        getDb()
          .select({ id: tasks.id })
          .from(tasks)
          .where(and(ownedTask(userId, id), rollsForward)),
      ),
    );

  const toggle = getDb()
    .update(tasks)
    .set({
      completed: sql`case when ${rollsForward} then false else not ${tasks.completed} end`,
      dueDate: sql`case when ${rollsForward} then (${tasks.dueDate} + ${repeatInterval})::date else ${tasks.dueDate} end`,
    })
    .where(ownedTask(userId, id))
    .returning();

  // Keep the streak diary in step, also judged on the task as it is now:
  // - not done yet: this click finishes it (or moves a repeating task on),
  //   so write down "finished now"
  // - already done: this click un-finishes it, so remove its latest entry
  //   (a mis-click shouldn't count towards a streak)
  const logCompletion = getDb().execute(sql`
    insert into ${taskCompletions} (user_id, task_id)
    select ${tasks.userId}, ${tasks.id} from ${tasks}
    where ${and(ownedTask(userId, id), not(tasks.completed))}`);

  const unlogCompletion = getDb()
    .delete(taskCompletions)
    .where(
      inArray(
        taskCompletions.id,
        getDb()
          .select({ id: taskCompletions.id })
          .from(taskCompletions)
          .where(
            and(
              eq(taskCompletions.taskId, id),
              eq(taskCompletions.userId, userId),
              exists(
                getDb()
                  .select({ one: sql`1` })
                  .from(tasks)
                  .where(and(ownedTask(userId, id), eq(tasks.completed, true))),
              ),
            ),
          )
          .orderBy(desc(taskCompletions.completedAt))
          .limit(1),
      ),
    );

  // The diary statements must run before the toggle (they look at the task
  // as it is now). The toggle's result is the last one.
  const results = await getDb().batch([resetChecklist, unlogCompletion, logCompletion, toggle]);
  const [task] = results.at(-1);
  return task ?? null;
}

// Changes a task's title, due date, priority, notes and repeat (all already
// validated; dueDate, notes and repeat may be null to remove them). Any field
// left out (undefined) is not changed. Returns the updated task, or null if it
// doesn't exist or isn't yours.
export async function updateTask(userId, id, { title, dueDate, priority, notes, repeat }) {
  assertUserId(userId);

  if (!isTaskId(id)) {
    return null;
  }

  const [task] = await getDb()
    .update(tasks)
    .set({ title, dueDate, priority, notes, repeat })
    .where(ownedTask(userId, id))
    .returning();

  return task ?? null;
}

// The checklist items to copy along with a task: just what you typed and
// ticked, oldest first.
function checklistOf(taskId) {
  return getDb()
    .select({ title: subtasks.title, completed: subtasks.completed })
    .from(subtasks)
    .where(eq(subtasks.taskId, taskId))
    .orderBy(asc(subtasks.createdAt), asc(subtasks.id));
}

// Inserts a task and its checklist items together, in a "batch": one round
// trip that runs as a single transaction, so either everything is saved or
// nothing is (never a task with half its checklist).
// The task's id is made here, with crypto.randomUUID(), because the items
// need it before the database has created the task.
async function insertTaskWithChecklist(values, checklist) {
  const id = crypto.randomUUID();
  const statements = [getDb().insert(tasks).values({ ...values, id }).returning()];
  if (checklist.length > 0) {
    // Inside one transaction the database's now() never changes, so every
    // item would get the same creation time and come back in random order.
    // Give each its own, one millisecond apart, to keep the original order.
    const start = Date.now();
    statements.push(
      getDb()
        .insert(subtasks)
        .values(
          checklist.map(({ title, completed }, index) => ({
            taskId: id,
            title,
            completed,
            createdAt: new Date(start + index),
          })),
        ),
    );
  }

  const [[task]] = await getDb().batch(statements);
  return task;
}

// Deletes one task for good (its checklist goes with it). Returns the deleted
// task plus `subtasks`, its checklist items as [{ title, completed }], so the
// page can offer "Undo". Returns null if it didn't exist or isn't yours.
export async function deleteTask(userId, id) {
  assertUserId(userId);

  if (!isTaskId(id)) {
    return null;
  }

  // Read the checklist first: once the task is gone, so are its items.
  // (Only used if the task turns out to be yours.)
  const checklist = await checklistOf(id);
  const [deleted] = await getDb().delete(tasks).where(ownedTask(userId, id)).returning();

  return deleted ? { ...deleted, subtasks: checklist } : null;
}

// Puts a deleted task back, for "Undo", with its checklist items. Everything
// is already validated (it came back from the browser, so the action checks
// it like a new task). It's a new row with the same contents: new id, new
// creation time.
export async function restoreTask(
  userId,
  { title, dueDate, priority, notes, repeat, completed, subtasks: checklist = [] },
) {
  assertUserId(userId);

  return insertTaskWithChecklist(
    { userId, title, dueDate, priority, notes, repeat, completed },
    checklist,
  );
}

// Makes a copy of one of your tasks: same title, due date, priority, notes,
// repeat and checklist, but nothing ticked. Everything is read from the
// database, not sent by the browser. Returns the copy, or null if the task
// doesn't exist or isn't yours.
export async function duplicateTask(userId, id) {
  assertUserId(userId);

  if (!isTaskId(id)) {
    return null;
  }

  const [original] = await getDb().select().from(tasks).where(ownedTask(userId, id));
  if (!original) {
    return null;
  }

  const checklist = await checklistOf(id);
  const { title, dueDate, priority, notes, repeat } = original;
  return insertTaskWithChecklist(
    { userId, title, dueDate, priority, notes, repeat },
    checklist.map((item) => ({ title: item.title, completed: false })),
  );
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

// The days (as "YYYY-MM-DD", newest first) on which the user finished at
// least one task, in their time zone, going back `days` days. For streaks.
// "at time zone" turns each stored moment into the user's local date and
// time; Postgres knows the same zone names as the browser ("Asia/Kolkata").
export async function listCompletionDays(userId, timeZone, days = 400) {
  assertUserId(userId);

  const localDay = sql`to_char(${taskCompletions.completedAt} at time zone ${timeZone}, 'YYYY-MM-DD')`;
  const rows = await getDb()
    .selectDistinct({ day: localDay })
    .from(taskCompletions)
    .where(
      and(
        eq(taskCompletions.userId, userId),
        gte(taskCompletions.completedAt, sql`now() - make_interval(days => ${days})`),
      ),
    );

  // Sorted here rather than in SQL: "YYYY-MM-DD" text sorts like the dates.
  return rows.map((row) => row.day).sort().reverse();
}

// Every task the user finished in the last `days` days, for the weekly
// review: [{ day: "YYYY-MM-DD" in their time zone, title }], newest first.
// A task deleted since has no title any more (the entry stays, see
// taskCompletions), so title can be null.
export async function listRecentCompletions(userId, timeZone, days = 14) {
  assertUserId(userId);

  const localDay = sql`to_char(${taskCompletions.completedAt} at time zone ${timeZone}, 'YYYY-MM-DD')`;
  return getDb()
    .select({ day: localDay, title: tasks.title })
    .from(taskCompletions)
    // "left join": keep completions whose task was deleted.
    .leftJoin(tasks, eq(tasks.id, taskCompletions.taskId))
    .where(
      and(
        eq(taskCompletions.userId, userId),
        gte(taskCompletions.completedAt, sql`now() - make_interval(days => ${days})`),
      ),
    )
    .orderBy(desc(taskCompletions.completedAt), asc(taskCompletions.id));
}

// The user's tasks due between two dates ("YYYY-MM-DD", both included),
// finished or not, for the calendar. Oldest date first.
export async function listTasksDueBetween(userId, from, to) {
  assertUserId(userId);

  return getDb()
    .select()
    .from(tasks)
    .where(and(eq(tasks.userId, userId), gte(tasks.dueDate, from), lte(tasks.dueDate, to)))
    .orderBy(asc(tasks.dueDate), asc(priorityRank), asc(tasks.createdAt), asc(tasks.id));
}

// Deletes every task. Only for tests, and refuses to run anywhere else,
// so it can never wipe real data by accident.
export async function clearTasks() {
  if (process.env.NODE_ENV !== "test") {
    throw new Error("clearTasks() may only run in tests.");
  }

  await getDb().delete(tasks);
}
