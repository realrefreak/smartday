import { beforeEach, describe, expect, it, vi } from "vitest";
import { addTask, clearTasks, listTasks, toggleTask } from "@/lib/tasks";

// These checks never reach the database, so they always run.
describe("task store safety checks", () => {
  it("returns null for an id that isn't a UUID, without querying", async () => {
    // DATABASE_URL isn't set in tests, so a real query would throw instead.
    expect(await toggleTask("does-not-exist")).toBeNull();
  });

  it("refuses to clear tasks outside of tests", async () => {
    vi.stubEnv("NODE_ENV", "production");

    await expect(clearTasks()).rejects.toThrow(/only run in tests/);

    vi.unstubAllEnvs();
  });
});

// These talk to a real database. They are skipped until step 3c gives them a
// separate test database, so they can never delete your real tasks.
describe.skipIf(!process.env.TEST_DATABASE_URL)("task store (database)", () => {
  beforeEach(async () => {
    await clearTasks();
  });

  it("starts with no tasks", async () => {
    expect(await listTasks()).toEqual([]);
  });

  it("adds a task that is not completed", async () => {
    const task = await addTask("Buy milk");

    expect(task.title).toBe("Buy milk");
    expect(task.completed).toBe(false);
    expect(task.id).toBeTruthy();
    expect(await listTasks()).toEqual([task]);
  });

  it("keeps tasks in the order they were added", async () => {
    await addTask("First");
    await addTask("Second");

    const titles = (await listTasks()).map((t) => t.title);
    expect(titles).toEqual(["First", "Second"]);
  });

  it("gives every task a different id", async () => {
    const a = await addTask("A");
    const b = await addTask("B");

    expect(a.id).not.toBe(b.id);
  });

  it("toggles a task to completed and back", async () => {
    const task = await addTask("Walk the dog");

    expect((await toggleTask(task.id)).completed).toBe(true);
    expect((await toggleTask(task.id)).completed).toBe(false);
  });

  it("returns null when toggling a valid but unknown id", async () => {
    expect(await toggleTask("00000000-0000-4000-8000-000000000000")).toBeNull();
  });
});
