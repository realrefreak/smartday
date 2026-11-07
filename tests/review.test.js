import { beforeEach, describe, expect, it } from "vitest";
import manifest from "@/app/manifest";
import { getDb } from "@/db";
import { user } from "@/db/schema";
import { compareWeeks, weeklyReview } from "@/lib/review";
import { addTask, clearTasks, deleteTask, listRecentCompletions, toggleTask } from "@/lib/tasks";

describe("weeklyReview", () => {
  const today = "2026-11-07"; // a Saturday

  const completions = [
    { day: "2026-11-07", title: "Gym" },
    { day: "2026-11-05", title: "Pay rent" },
    { day: "2026-11-05", title: "Call mum" },
    { day: "2026-11-01", title: null }, // 7 days ago, so still this week
    { day: "2026-10-31", title: "Last week" }, // 8 days ago
    { day: "2026-10-24", title: "Two weeks ago" }, // 14 days ago: neither week
  ];

  it("counts this week day by day, and last week as a whole", () => {
    const review = weeklyReview({ completions, activeTasks: [], today });

    expect(review.days.map((day) => day.date)).toEqual([
      "2026-11-01",
      "2026-11-02",
      "2026-11-03",
      "2026-11-04",
      "2026-11-05",
      "2026-11-06",
      "2026-11-07",
    ]);
    expect(review.days.map((day) => day.count)).toEqual([1, 0, 0, 0, 2, 0, 1]);
    expect(review.thisWeek).toBe(4);
    expect(review.lastWeek).toBe(1);
    expect(review.best).toEqual({ date: "2026-11-05", count: 2 });
    expect(review.finished.map((entry) => entry.title)).toEqual(["Gym", "Pay rent", "Call mum", null]);
  });

  it("has no best day in an empty week", () => {
    const review = weeklyReview({ completions: [], activeTasks: [], today });
    expect(review.best).toBeNull();
    expect(review.thisWeek).toBe(0);
  });

  it("splits unfinished tasks into overdue and the next 7 days", () => {
    const activeTasks = [
      { id: "1", title: "Next week+1", dueDate: "2026-11-15" },
      { id: "2", title: "In 7 days", dueDate: "2026-11-14" },
      { id: "3", title: "Today", dueDate: "2026-11-07" },
      { id: "4", title: "Long overdue", dueDate: "2026-10-01" },
      { id: "5", title: "Yesterday", dueDate: "2026-11-06" },
      { id: "6", title: "Someday", dueDate: null },
    ];
    const review = weeklyReview({ completions: [], activeTasks, today });

    expect(review.overdue.map((task) => task.title)).toEqual(["Long overdue", "Yesterday"]);
    expect(review.comingUp.map((task) => task.title)).toEqual(["Today", "In 7 days"]);
  });
});

describe("compareWeeks", () => {
  it("says how this week compares", () => {
    expect(compareWeeks(5, 2)).toBe("3 more than last week");
    expect(compareWeeks(1, 2)).toBe("1 fewer than last week");
    expect(compareWeeks(0, 0)).toBe("Same as last week");
  });
});

describe("manifest", () => {
  it("makes SmartDay installable", () => {
    const app = manifest();
    expect(app).toMatchObject({ name: "SmartDay", start_url: "/", display: "standalone" });
    // Browsers want at least a 192px and a 512px icon to offer installing.
    const sizes = app.icons.map((icon) => icon.sizes);
    expect(sizes).toContain("192x192");
    expect(sizes).toContain("512x512");
  });
});

describe.skipIf(!process.env.TEST_DATABASE_URL)("listRecentCompletions (database)", () => {
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

  it("lists your finished tasks with their titles, even deleted ones", async () => {
    const milk = await addTask(A, "Buy milk");
    const bins = await addTask(A, "Take out bins");
    const theirs = await addTask(B, "Not yours");
    await toggleTask(A, milk.id);
    await toggleTask(A, bins.id);
    await toggleTask(B, theirs.id);
    await deleteTask(A, bins.id);

    const entries = await listRecentCompletions(A, "Asia/Kolkata");

    expect(entries).toHaveLength(2);
    expect(entries.map((entry) => entry.title).sort((a, b) => String(a).localeCompare(String(b)))).toEqual([
      "Buy milk",
      null,
    ]);
    expect(entries[0].day).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
