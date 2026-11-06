import { describe, expect, it } from "vitest";
import {
  addDays,
  countTags,
  formatLongDate,
  greetingFor,
  hourIn,
  summarizeTasks,
} from "@/lib/dashboard";

describe("addDays", () => {
  it("moves across month and year ends", () => {
    expect(addDays("2026-11-06", 1)).toBe("2026-11-07");
    expect(addDays("2026-11-30", 1)).toBe("2026-12-01");
    expect(addDays("2026-12-31", 7)).toBe("2027-01-07");
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
  });
});

describe("hourIn and greetingFor", () => {
  it("uses the user's time zone", () => {
    // 20:00 UTC is 01:30 the next day in India.
    const now = new Date("2026-11-06T20:00:00Z");
    expect(hourIn("UTC", now)).toBe(20);
    expect(hourIn("Asia/Kolkata", now)).toBe(1);
  });

  it("picks a greeting for the time of day", () => {
    expect(greetingFor(2)).toBe("Working late");
    expect(greetingFor(9)).toBe("Good morning");
    expect(greetingFor(12)).toBe("Good afternoon");
    expect(greetingFor(20)).toBe("Good evening");
  });
});

describe("formatLongDate", () => {
  it("writes the weekday and date", () => {
    expect(formatLongDate("2026-11-06")).toBe("Friday 6 November");
  });
});

describe("countTags", () => {
  it("counts each tag once per task, ignoring case, most used first", () => {
    const tasks = [
      { title: "Report #work #urgent" },
      { title: "Call #Work about #work" },
      { title: "Milk #home" },
      { title: "No tags here" },
    ];
    expect(countTags(tasks)).toEqual([
      { tag: "#work", count: 2 },
      { tag: "#home", count: 1 },
      { tag: "#urgent", count: 1 },
    ]);
  });

  it("keeps only the top ones", () => {
    const tasks = [{ title: "#a #b #c" }];
    expect(countTags(tasks, 2)).toHaveLength(2);
  });
});

describe("summarizeTasks", () => {
  const today = "2026-11-06";
  const task = (title, dueDate) => ({ title, dueDate });

  it("splits tasks into overdue, today and the coming week", () => {
    const tasks = [
      task("Late", "2026-11-01"),
      task("Now", "2026-11-06"),
      task("Next week", "2026-11-13"),
      task("Tomorrow", "2026-11-07"),
      task("Too far", "2026-11-14"),
      task("Someday", null),
    ];
    const summary = summarizeTasks(tasks, today);

    expect(summary.overdueCount).toBe(1);
    expect(summary.dueTodayCount).toBe(1);
    expect(summary.upcomingCount).toBe(2);
    expect(summary.focus.map((t) => t.title)).toEqual(["Late", "Now"]);
    // Soonest first, whatever order they came in.
    expect(summary.upcoming.map((t) => t.title)).toEqual(["Tomorrow", "Next week"]);
  });

  it("shows a few of each and says how many more there are", () => {
    const tasks = Array.from({ length: 7 }, (_, i) => task(`Task ${i}`, today));
    const summary = summarizeTasks(tasks, today, { limit: 5 });

    expect(summary.focus).toHaveLength(5);
    expect(summary.moreFocus).toBe(2);
    expect(summary.moreUpcoming).toBe(0);
  });

  it("handles no tasks at all", () => {
    const summary = summarizeTasks([], today);
    expect(summary.focus).toEqual([]);
    expect(summary.tags).toEqual([]);
  });
});
