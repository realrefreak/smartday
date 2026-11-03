import { beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { user } from "@/db/schema";
import { addTask, clearTasks, listTasks, toggleTask } from "@/lib/tasks";

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

  it("toggles a task to completed and back", async () => {
    const task = await addTask(A, "Walk the dog");

    expect((await toggleTask(A, task.id)).completed).toBe(true);
    expect((await toggleTask(A, task.id)).completed).toBe(false);
  });

  it("returns null when toggling a valid but unknown id", async () => {
    expect(await toggleTask(A, "00000000-0000-4000-8000-000000000000")).toBeNull();
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

  it("deletes a user's tasks when the user is deleted", async () => {
    await addTask(A, "A's task");
    await addTask(B, "B's task");

    await getDb().delete(user).where(eq(user.id, A));

    expect(await listTasks(A)).toEqual([]);
    expect(await listTasks(B)).toHaveLength(1);
  });
});
