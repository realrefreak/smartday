import { beforeEach, describe, expect, it } from "vitest";
import { getDb } from "@/db";
import { taskCompletions, user } from "@/db/schema";
import { streakStats } from "@/lib/streaks";
import { addTask, clearTasks, deleteTask, listCompletionDays, toggleTask } from "@/lib/tasks";

describe("streakStats", () => {
  const today = "2026-11-06";

  it("is zero with no history", () => {
    expect(streakStats([], today)).toMatchObject({ current: 0, best: 0, doneToday: false });
  });

  it("counts back from today", () => {
    const stats = streakStats(["2026-11-06", "2026-11-05", "2026-11-04", "2026-11-01"], today);
    expect(stats).toMatchObject({ current: 3, best: 3, doneToday: true });
  });

  it("keeps a streak that ran up to yesterday alive", () => {
    expect(streakStats(["2026-11-05", "2026-11-04"], today).current).toBe(2);
  });

  it("breaks after a missed day", () => {
    expect(streakStats(["2026-11-04", "2026-11-03"], today).current).toBe(0);
  });

  it("remembers the best run, across a month end", () => {
    const days = ["2026-10-30", "2026-10-31", "2026-11-01", "2026-11-02", "2026-11-06"];
    expect(streakStats(days, today)).toMatchObject({ current: 1, best: 4 });
  });

  it("lists the last 7 days, oldest first", () => {
    const { week } = streakStats(["2026-11-06", "2026-11-01"], today);
    expect(week.map((d) => d.date)).toEqual([
      "2026-10-31",
      "2026-11-01",
      "2026-11-02",
      "2026-11-03",
      "2026-11-04",
      "2026-11-05",
      "2026-11-06",
    ]);
    expect(week.map((d) => d.done)).toEqual([false, true, false, false, false, false, true]);
  });
});

describe.skipIf(!process.env.TEST_DATABASE_URL)("completion diary (database)", () => {
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

  const entries = () => getDb().select().from(taskCompletions);

  it("writes down finishing a task, and forgets it when un-ticked", async () => {
    const task = await addTask(A, "Buy milk");

    await toggleTask(A, task.id);
    expect(await entries()).toHaveLength(1);
    expect((await entries())[0]).toMatchObject({ userId: A, taskId: task.id });

    await toggleTask(A, task.id);
    expect(await entries()).toHaveLength(0);
  });

  it("writes down every time a repeating task is done", async () => {
    const task = await addTask(A, "Water plants", "2026-11-06", "medium", "daily");

    await toggleTask(A, task.id);
    await toggleTask(A, task.id);

    expect(await entries()).toHaveLength(2);
  });

  it("keeps the entry when the task is deleted", async () => {
    const task = await addTask(A, "Buy milk");
    await toggleTask(A, task.id);
    await deleteTask(A, task.id);

    const [entry] = await entries();
    expect(entry).toMatchObject({ userId: A, taskId: null });
  });

  it("writes nothing for someone else's task", async () => {
    const task = await addTask(A, "Buy milk");

    await toggleTask(B, task.id);

    expect(await entries()).toHaveLength(0);
  });

  it("lists the days in the user's time zone, each day once", async () => {
    // 20:00 UTC on 5 Nov is already 6 Nov (01:30) in India.
    await getDb()
      .insert(taskCompletions)
      .values([
        { userId: A, completedAt: new Date("2026-11-05T20:00:00Z") },
        { userId: A, completedAt: new Date("2026-11-05T21:00:00Z") },
        { userId: A, completedAt: new Date("2026-11-04T10:00:00Z") },
        { userId: B, completedAt: new Date("2026-11-03T10:00:00Z") },
      ]);

    expect(await listCompletionDays(A, "UTC", 10_000)).toEqual(["2026-11-05", "2026-11-04"]);
    expect(await listCompletionDays(A, "Asia/Kolkata", 10_000)).toEqual(["2026-11-06", "2026-11-04"]);
  });
});
