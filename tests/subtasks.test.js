import { beforeEach, describe, expect, it } from "vitest";
import { getDb } from "@/db";
import { subtasks, user } from "@/db/schema";
import { addSubtask, deleteSubtask, listSubtasks, toggleSubtask } from "@/lib/subtasks";
import { addTask, clearTasks, deleteTask, duplicateTask, listTasks, restoreTask } from "@/lib/tasks";
import { SUBTASKS_MAX } from "@/lib/task-validation";

describe("subtask store safety checks", () => {
  it("needs a user id", async () => {
    await expect(listSubtasks("")).rejects.toThrow(/userId is required/);
    await expect(addSubtask(undefined, "x", "t")).rejects.toThrow(/userId is required/);
  });

  it("ignores ids that aren't UUIDs, without querying", async () => {
    expect(await addSubtask("user-a", "nope", "Step")).toEqual({ ok: false, reason: "not-found" });
    expect(await toggleSubtask("user-a", "nope")).toBeNull();
    expect(await deleteSubtask("user-a", "nope")).toBe(false);
  });
});

// Real database tests, skipped without TEST_DATABASE_URL (see tests/test-env.mjs).
describe.skipIf(!process.env.TEST_DATABASE_URL)("subtask store (database)", () => {
  const A = "test-user-a";
  const B = "test-user-b";

  beforeEach(async () => {
    await clearTasks();
    await getDb().delete(user);
    await getDb()
      .insert(user)
      .values([
        { id: A, name: "User A", email: "a@test.example" },
        { id: B, name: "User B", email: "b@test.example" },
      ]);
  });

  it("adds items to a task and lists them oldest first", async () => {
    const task = await addTask(A, "Move house");
    const first = await addSubtask(A, task.id, "Book van");
    await addSubtask(A, task.id, "Pack kitchen");

    expect(first).toMatchObject({ ok: true, subtask: { title: "Book van", completed: false } });
    expect((await listSubtasks(A)).map((item) => [item.taskId, item.title])).toEqual([
      [task.id, "Book van"],
      [task.id, "Pack kitchen"],
    ]);
  });

  it("ticks and unticks an item, and removes it", async () => {
    const task = await addTask(A, "Move house");
    const { subtask } = await addSubtask(A, task.id, "Book van");

    expect((await toggleSubtask(A, subtask.id)).completed).toBe(true);
    expect((await toggleSubtask(A, subtask.id)).completed).toBe(false);

    expect(await deleteSubtask(A, subtask.id)).toBe(true);
    expect(await listSubtasks(A)).toEqual([]);
    expect(await deleteSubtask(A, subtask.id)).toBe(false);
  });

  it("stops at the maximum number of items", async () => {
    const task = await addTask(A, "Big job");
    // Fill the checklist in one insert: 20 separate trips to the database
    // are slow enough on CI to hit the test time limit.
    await getDb()
      .insert(subtasks)
      .values(Array.from({ length: SUBTASKS_MAX }, (_, i) => ({ taskId: task.id, title: `Step ${i}` })));

    expect(await addSubtask(A, task.id, "One too many")).toEqual({ ok: false, reason: "full" });
    expect(await listSubtasks(A)).toHaveLength(SUBTASKS_MAX);
  });

  it("never lets one user see or change another user's items", async () => {
    const aTask = await addTask(A, "A's task");
    const { subtask } = await addSubtask(A, aTask.id, "A's step");

    // B can't add to A's task...
    expect(await addSubtask(B, aTask.id, "Sneaky")).toEqual({ ok: false, reason: "not-found" });
    // ...or list, tick or remove A's items.
    expect(await listSubtasks(B)).toEqual([]);
    expect(await toggleSubtask(B, subtask.id)).toBeNull();
    expect(await deleteSubtask(B, subtask.id)).toBe(false);

    const [unchanged] = await listSubtasks(A);
    expect(unchanged).toMatchObject({ title: "A's step", completed: false });
  });

  it("deleting a task deletes its items, and hands them back for Undo", async () => {
    const task = await addTask(A, "Move house");
    const { subtask } = await addSubtask(A, task.id, "Book van");
    await toggleSubtask(A, subtask.id);
    await addSubtask(A, task.id, "Pack kitchen");

    const deleted = await deleteTask(A, task.id);

    expect(deleted.subtasks).toEqual([
      { title: "Book van", completed: true },
      { title: "Pack kitchen", completed: false },
    ]);
    expect(await listSubtasks(A)).toEqual([]);

    // Undo puts the items back too, ticks and all.
    const restored = await restoreTask(A, deleted);
    expect((await listSubtasks(A)).map((item) => [item.taskId, item.title, item.completed])).toEqual([
      [restored.id, "Book van", true],
      [restored.id, "Pack kitchen", false],
    ]);
  });

  it("another user deleting your task gets nothing back, not even its items", async () => {
    const task = await addTask(A, "A's task");
    await addSubtask(A, task.id, "A's step");

    expect(await deleteTask(B, task.id)).toBeNull();
    expect(await listSubtasks(A)).toHaveLength(1);
  });

  it("duplicating a task copies its items, all unticked", async () => {
    const task = await addTask(A, "Weekly shop");
    const { subtask } = await addSubtask(A, task.id, "Milk");
    await toggleSubtask(A, subtask.id);

    const copy = await duplicateTask(A, task.id);

    const items = await listSubtasks(A);
    expect(items.filter((item) => item.taskId === task.id)).toMatchObject([{ title: "Milk", completed: true }]);
    expect(items.filter((item) => item.taskId === copy.id)).toMatchObject([{ title: "Milk", completed: false }]);
    expect(await listTasks(A)).toHaveLength(2);
  });
});
