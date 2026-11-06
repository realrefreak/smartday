import { beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { user } from "@/db/schema";
import {
  addTask,
  clearTasks,
  getTaskCounts,
  deleteCompletedTasks,
  deleteTask,
  duplicateTask,
  listTasks,
  restoreTask,
  toggleTask,
  updateTask,
} from "@/lib/tasks";

// These checks never reach the database, so they always run.
describe("task store safety checks", () => {
  it("returns null for an id that isn't a UUID, without querying", async () => {
    // Invalid ids are rejected before any SQL is sent.
    expect(await toggleTask("user-a", "does-not-exist")).toBeNull();
  });

  it("refuses to run any query without a user id", async () => {
    await expect(listTasks(undefined)).rejects.toThrow(/userId is required/);
    await expect(addTask("", "Buy milk")).rejects.toThrow(/userId is required/);
    await expect(toggleTask(null, "x")).rejects.toThrow(/userId is required/);
    await expect(updateTask("", "x", { title: "t", dueDate: null })).rejects.toThrow(
      /userId is required/,
    );
    await expect(deleteTask(undefined, "x")).rejects.toThrow(/userId is required/);
    await expect(deleteCompletedTasks("")).rejects.toThrow(/userId is required/);
    await expect(getTaskCounts(null)).rejects.toThrow(/userId is required/);
  });

  it("ignores ids that aren't UUIDs when editing or deleting", async () => {
    expect(await updateTask("user-a", "nope", { title: "t", dueDate: null })).toBeNull();
    expect(await deleteTask("user-a", "nope")).toBeNull();
  });

  it("refuses to clear tasks outside of tests", async () => {
    vi.stubEnv("NODE_ENV", "production");

    await expect(clearTasks()).rejects.toThrow(/only run in tests/);

    vi.unstubAllEnvs();
  });
});

// These talk to a real database: the separate TEST_DATABASE_URL one (see
// tests/test-env.mjs). They are skipped when it isn't set, so they can never
// delete your real tasks.
describe.skipIf(!process.env.TEST_DATABASE_URL)("task store (database)", () => {
  const A = "test-user-a";
  const B = "test-user-b";

  beforeEach(async () => {
    // Fresh start: remove everything (deleting users also deletes their tasks),
    // then create two users, since every task must belong to a real user.
    await clearTasks();
    await getDb().delete(user);
    await getDb()
      .insert(user)
      .values([
        { id: A, name: "User A", email: "a@test.example" },
        { id: B, name: "User B", email: "b@test.example" },
      ]);
  });

  it("starts with no tasks", async () => {
    expect(await listTasks(A)).toEqual([]);
  });

  it("adds a task owned by the user, not completed", async () => {
    const task = await addTask(A, "Buy milk");

    expect(task.title).toBe("Buy milk");
    expect(task.userId).toBe(A);
    expect(task.completed).toBe(false);
    expect(task.dueDate).toBeNull();
    // New tasks are medium priority with no notes unless told otherwise.
    expect(task.priority).toBe("medium");
    expect(task.notes).toBeNull();
    expect(await listTasks(A)).toEqual([task]);
  });

  it("stores a due date exactly as given, with no time zone shift", async () => {
    const task = await addTask(A, "Pay rent", "2026-12-01");

    expect(task.dueDate).toBe("2026-12-01");
    expect((await listTasks(A))[0].dueDate).toBe("2026-12-01");
  });

  it("keeps tasks in the order they were added", async () => {
    await addTask(A, "First");
    await addTask(A, "Second");

    const titles = (await listTasks(A)).map((t) => t.title);
    expect(titles).toEqual(["First", "Second"]);
  });

  it("lists the soonest due date first and undated tasks last", async () => {
    await addTask(A, "No date");
    await addTask(A, "Later", "2026-12-24");
    await addTask(A, "Sooner", "2026-11-20");
    await addTask(A, "Also later", "2026-12-24");

    const titles = (await listTasks(A)).map((t) => t.title);
    // Same date: the one added first comes first.
    expect(titles).toEqual(["Sooner", "Later", "Also later", "No date"]);
  });

  it("filters to active or done tasks, keeping the due-date order", async () => {
    const later = await addTask(A, "Later", "2026-12-24");
    const sooner = await addTask(A, "Sooner", "2026-11-20");
    const finished = await addTask(A, "Finished");
    await toggleTask(A, finished.id);

    const titles = async (filter) => (await listTasks(A, { filter })).map((t) => t.title);

    expect(await titles("active")).toEqual([sooner.title, later.title]);
    expect(await titles("done")).toEqual(["Finished"]);
    expect(await titles("all")).toEqual(["Sooner", "Later", "Finished"]);
  });

  it("never lets a filter show another user's tasks", async () => {
    const bTask = await addTask(B, "B's finished task");
    await toggleTask(B, bTask.id);

    expect(await listTasks(A, { filter: "done" })).toEqual([]);
  });

  it("toggles a task to completed and back", async () => {
    const task = await addTask(A, "Walk the dog");

    expect((await toggleTask(A, task.id)).completed).toBe(true);
    expect((await toggleTask(A, task.id)).completed).toBe(false);
  });

  it("edits a task's title and due date", async () => {
    const task = await addTask(A, "Buy mlik");

    const updated = await updateTask(A, task.id, { title: "Buy milk", dueDate: "2026-12-01" });

    expect(updated.title).toBe("Buy milk");
    expect(updated.dueDate).toBe("2026-12-01");
    // Editing doesn't touch anything else.
    expect(updated.completed).toBe(false);
    expect(updated.createdAt).toEqual(task.createdAt);
  });

  it("can remove a due date by setting it to null", async () => {
    const task = await addTask(A, "Pay rent", "2026-12-01");

    expect((await updateTask(A, task.id, { title: "Pay rent", dueDate: null })).dueDate).toBeNull();
  });

  it("deletes only the chosen task", async () => {
    const keep = await addTask(A, "Keep me");
    const remove = await addTask(A, "Delete me");

    // It hands back what was deleted, for "Undo".
    expect(await deleteTask(A, remove.id)).toEqual({ ...remove, subtasks: [] });
    expect(await listTasks(A)).toEqual([keep]);
    // Deleting again finds nothing.
    expect(await deleteTask(A, remove.id)).toBeNull();
  });

  it("returns null when toggling a valid but unknown id", async () => {
    expect(await toggleTask(A, "00000000-0000-4000-8000-000000000000")).toBeNull();
  });

  it("sorts by priority, then by due date within each priority", async () => {
    await addTask(A, "Low, soon", "2026-11-20", "low");
    await addTask(A, "High, later", "2026-12-24", "high");
    await addTask(A, "Medium, no date");
    await addTask(A, "High, sooner", "2026-11-25", "high");

    const titles = (await listTasks(A, { sort: "priority" })).map((t) => t.title);
    expect(titles).toEqual(["High, sooner", "High, later", "Medium, no date", "Low, soon"]);
  });

  it("refuses an unknown priority at the database level too", async () => {
    // The CHECK constraint is the safety net behind validatePriority.
    await expect(addTask(A, "Sneaky", null, "urgent")).rejects.toThrow();
  });

  it("saves and clears notes, and only changes the fields it's given", async () => {
    const task = await addTask(A, "Groceries", "2026-12-01", "high");

    const withNotes = await updateTask(A, task.id, { notes: "Milk\nEggs" });
    expect(withNotes).toMatchObject({ title: "Groceries", dueDate: "2026-12-01", priority: "high", notes: "Milk\nEggs" });

    expect((await updateTask(A, task.id, { notes: null })).notes).toBeNull();
  });

  it("searches titles and notes, ignoring case", async () => {
    await addTask(A, "Buy MILK");
    const eggs = await addTask(A, "Shopping");
    await updateTask(A, eggs.id, { notes: "eggs and milk" });
    await addTask(A, "Walk the dog");

    const titles = async (query) => (await listTasks(A, { query })).map((t) => t.title);
    expect(await titles("milk")).toEqual(["Buy MILK", "Shopping"]);
    expect(await titles("DOG")).toEqual(["Walk the dog"]);
    expect(await titles("nothing like this")).toEqual([]);
  });

  it("treats % and _ in a search as plain text", async () => {
    await addTask(A, "Save 50% on shoes");
    await addTask(A, "Save 500 coins");
    await addTask(A, "my_file");
    await addTask(A, "myxfile");

    expect((await listTasks(A, { query: "50%" })).map((t) => t.title)).toEqual(["Save 50% on shoes"]);
    expect((await listTasks(A, { query: "my_" })).map((t) => t.title)).toEqual(["my_file"]);
  });

  it("combines search with a filter", async () => {
    const done = await addTask(A, "Milk (bought)");
    await toggleTask(A, done.id);
    await addTask(A, "Milk (to buy)");

    expect((await listTasks(A, { filter: "done", query: "milk" })).map((t) => t.title)).toEqual([
      "Milk (bought)",
    ]);
  });

  it("counts and clears only finished tasks", async () => {
    const one = await addTask(A, "Done one");
    const two = await addTask(A, "Done two");
    await addTask(A, "Still to do");
    await toggleTask(A, one.id);
    await toggleTask(A, two.id);

    expect(await getTaskCounts(A)).toEqual({ total: 3, completed: 2 });
    expect(await deleteCompletedTasks(A)).toBe(2);
    expect(await getTaskCounts(A)).toEqual({ total: 1, completed: 0 });
    expect((await listTasks(A)).map((t) => t.title)).toEqual(["Still to do"]);
  });

  it("starts with no repeat", async () => {
    expect((await addTask(A, "One-off")).repeat).toBeNull();
  });

  it("moves a repeating task's due date forward instead of finishing it", async () => {
    const daily = await addTask(A, "Stretch", "2026-11-30", "medium", "daily");
    const weekly = await addTask(A, "Bins", "2026-12-28", "medium", "weekly");

    // Daily: 30 Nov -> 1 Dec (across a month end).
    const nextDay = await toggleTask(A, daily.id);
    expect(nextDay).toMatchObject({ completed: false, dueDate: "2026-12-01" });

    // Weekly: 28 Dec 2026 -> 4 Jan 2027 (across a year end).
    expect(await toggleTask(A, weekly.id)).toMatchObject({ completed: false, dueDate: "2027-01-04" });
  });

  it("keeps monthly tasks inside short months", async () => {
    const rent = await addTask(A, "Rent", "2027-01-31", "medium", "monthly");

    // 31 Jan -> 28 Feb (2027 isn't a leap year), not 3 March.
    expect((await toggleTask(A, rent.id)).dueDate).toBe("2027-02-28");
  });

  it("toggles a one-off task normally, leaving its date alone", async () => {
    const task = await addTask(A, "Dentist", "2026-12-01");

    expect(await toggleTask(A, task.id)).toMatchObject({ completed: true, dueDate: "2026-12-01" });
  });

  it("refuses a repeating task without a due date at the database level", async () => {
    await expect(addTask(A, "Sneaky", null, "medium", "weekly")).rejects.toThrow();
    await expect(addTask(A, "Sneaky", "2026-12-01", "medium", "yearly")).rejects.toThrow();
  });

  it("counts all tasks and finished ones in one go", async () => {
    expect(await getTaskCounts(A)).toEqual({ total: 0, completed: 0 });

    const done = await addTask(A, "Done");
    await addTask(A, "Not done");
    await toggleTask(A, done.id);

    expect(await getTaskCounts(A)).toEqual({ total: 2, completed: 1 });
  });

  // --- Authorization: users are kept apart ---

  it("only lists the user's own tasks", async () => {
    await addTask(A, "A's task");
    await addTask(B, "B's task");

    expect((await listTasks(A)).map((t) => t.title)).toEqual(["A's task"]);
    expect((await listTasks(B)).map((t) => t.title)).toEqual(["B's task"]);
  });

  it("does not let one user toggle another user's task", async () => {
    const aTask = await addTask(A, "A's task");

    // B knows (or guesses) the id of A's task and tries to toggle it.
    expect(await toggleTask(B, aTask.id)).toBeNull();

    const [unchanged] = await listTasks(A);
    expect(unchanged.completed).toBe(false);
  });

  it("does not let one user edit another user's task", async () => {
    const aTask = await addTask(A, "A's task", "2026-12-01");

    expect(await updateTask(B, aTask.id, { title: "Hacked", dueDate: null })).toBeNull();

    const [unchanged] = await listTasks(A);
    expect(unchanged.title).toBe("A's task");
    expect(unchanged.dueDate).toBe("2026-12-01");
  });

  it("does not let one user delete another user's task", async () => {
    const aTask = await addTask(A, "A's task");

    expect(await deleteTask(B, aTask.id)).toBeNull();
    expect(await listTasks(A)).toHaveLength(1);
  });

  it("Today shows unfinished tasks due today or earlier", async () => {
    await addTask(A, "Overdue", "2026-11-04");
    await addTask(A, "Due today", "2026-11-05");
    await addTask(A, "Tomorrow", "2026-11-06");
    await addTask(A, "Undated");
    const finished = await addTask(A, "Done already", "2026-11-05");
    await toggleTask(A, finished.id);
    await addTask(B, "B's task", "2026-11-05");

    const today = await listTasks(A, { filter: "today", today: "2026-11-05" });

    expect(today.map((task) => task.title)).toEqual(["Overdue", "Due today"]);
  });

  it("refuses the Today filter without the user's date", async () => {
    await expect(listTasks(A, { filter: "today" })).rejects.toThrow(/needs the user's date/);
  });

  it("finds a tag as a whole word only, in any case", async () => {
    await addTask(A, "Report #work");
    await addTask(A, "#Work call");
    await addTask(A, "Plan #workshop");
    await addTask(A, "Fix bike #work-life");
    await addTask(A, "Note about work");
    await addTask(B, "B's #work");

    const found = await listTasks(A, { query: "#work" });

    expect(found.map((task) => task.title).sort()).toEqual(["#Work call", "Report #work"]);
  });

  it("still searches plain text the old way", async () => {
    await addTask(A, "Plan #workshop");
    await addTask(A, "Note about work");

    expect(await listTasks(A, { query: "work" })).toHaveLength(2);
    expect(await listTasks(A, { query: "#work shop" })).toEqual([]);
  });

  it("does not let one user copy another user's task", async () => {
    const aTask = await addTask(A, "A's secret");

    expect(await duplicateTask(B, aTask.id)).toBeNull();
    expect(await listTasks(B)).toEqual([]);
    expect(await listTasks(A)).toHaveLength(1);
  });

  it("restores a deleted task with all its details", async () => {
    const task = await addTask(A, "Water plants", "2026-12-01", "high", "weekly");
    await updateTask(A, task.id, { notes: "The big ones too" });
    await toggleTask(A, task.id);
    const deleted = await deleteTask(A, task.id);

    const restored = await restoreTask(A, deleted);

    expect(restored).toMatchObject({
      userId: A,
      title: "Water plants",
      dueDate: deleted.dueDate,
      priority: "high",
      notes: "The big ones too",
      repeat: "weekly",
      completed: false,
    });
    expect(await listTasks(A)).toEqual([restored]);
  });

  it("duplicates a task as a new, unfinished copy", async () => {
    const task = await addTask(A, "Pack bags", "2026-12-20", "low");
    await updateTask(A, task.id, { notes: "Passport!" });
    await toggleTask(A, task.id);

    const copy = await duplicateTask(A, task.id);

    expect(copy.id).not.toBe(task.id);
    expect(copy).toMatchObject({
      title: "Pack bags",
      dueDate: "2026-12-20",
      priority: "low",
      notes: "Passport!",
      completed: false,
    });
    expect(await listTasks(A)).toHaveLength(2);
  });

  it("returns null when duplicating an unknown or invalid id", async () => {
    expect(await duplicateTask(A, "nope")).toBeNull();
    expect(await duplicateTask(A, "00000000-0000-4000-8000-000000000000")).toBeNull();
  });

  it("never searches another user's tasks", async () => {
    await addTask(B, "B's milk");

    expect(await listTasks(A, { query: "milk" })).toEqual([]);
  });

  it("clearing completed never touches another user's tasks", async () => {
    const bTask = await addTask(B, "B's finished task");
    await toggleTask(B, bTask.id);

    expect(await getTaskCounts(A)).toEqual({ total: 0, completed: 0 });
    expect(await deleteCompletedTasks(A)).toBe(0);
    expect(await getTaskCounts(B)).toEqual({ total: 1, completed: 1 });
  });

  it("deletes a user's tasks when the user is deleted", async () => {
    await addTask(A, "A's task");
    await addTask(B, "B's task");

    await getDb().delete(user).where(eq(user.id, A));

    expect(await listTasks(A)).toEqual([]);
    expect(await listTasks(B)).toHaveLength(1);
  });
});
