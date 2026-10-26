import { beforeEach, describe, expect, it } from "vitest";
import { addTask, clearTasks, listTasks, toggleTask } from "@/lib/tasks";

describe("task store", () => {
  // The store is shared module state, so reset it before every test.
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

  it("returns null when toggling an unknown id", async () => {
    expect(await toggleTask("does-not-exist")).toBeNull();
  });

  it("does not let callers change stored tasks directly", async () => {
    const task = await addTask("Original");
    task.title = "Changed from outside";

    const [stored] = await listTasks();
    expect(stored.title).toBe("Original");
  });
});
