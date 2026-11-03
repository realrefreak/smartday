import { describe, expect, it } from "vitest";
import { TITLE_MAX_LENGTH, validateDueDate, validateTaskTitle } from "@/lib/task-validation";
import { dueDateStatus, formatDueDate, toLocalDateString } from "@/lib/due-date";

describe("validateTaskTitle", () => {
  it("accepts a normal title", () => {
    expect(validateTaskTitle("Buy milk")).toEqual({ ok: true, title: "Buy milk" });
  });

  it("trims spaces from both ends", () => {
    expect(validateTaskTitle("  Buy milk  ")).toEqual({ ok: true, title: "Buy milk" });
  });

  it("rejects an empty title", () => {
    expect(validateTaskTitle("").ok).toBe(false);
  });

  it("rejects a title that is only spaces", () => {
    expect(validateTaskTitle("    ").ok).toBe(false);
  });

  it("rejects a missing value (not a string)", () => {
    expect(validateTaskTitle(null).ok).toBe(false);
  });

  it("accepts a title exactly at the length limit", () => {
    expect(validateTaskTitle("a".repeat(TITLE_MAX_LENGTH)).ok).toBe(true);
  });

  it("rejects a title one character over the limit", () => {
    const result = validateTaskTitle("a".repeat(TITLE_MAX_LENGTH + 1));

    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/100 characters/);
  });

  it("rejects hidden control characters", () => {
    expect(validateTaskTitle("Buy\u0000milk").ok).toBe(false);
  });
});

describe("validateDueDate", () => {
  it("treats an empty or missing value as 'no due date'", () => {
    expect(validateDueDate("")).toEqual({ ok: true, dueDate: null });
    expect(validateDueDate(null)).toEqual({ ok: true, dueDate: null });
    expect(validateDueDate(undefined)).toEqual({ ok: true, dueDate: null });
  });

  it("accepts a real date in YYYY-MM-DD form", () => {
    expect(validateDueDate("2026-11-15")).toEqual({ ok: true, dueDate: "2026-11-15" });
  });

  it("accepts 29 February in a leap year", () => {
    expect(validateDueDate("2028-02-29").ok).toBe(true);
  });

  it("rejects 29 February in a non-leap year", () => {
    expect(validateDueDate("2026-02-29").ok).toBe(false);
  });

  it("rejects days and months that don't exist", () => {
    expect(validateDueDate("2026-02-30").ok).toBe(false);
    expect(validateDueDate("2026-13-01").ok).toBe(false);
    expect(validateDueDate("2026-00-10").ok).toBe(false);
  });

  it("rejects other formats", () => {
    expect(validateDueDate("15/11/2026").ok).toBe(false);
    expect(validateDueDate("2026-1-5").ok).toBe(false);
    expect(validateDueDate("tomorrow").ok).toBe(false);
  });

  it("rejects years outside 2000-2100", () => {
    const result = validateDueDate("0202-11-15");

    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/between 2000 and 2100/);
    expect(validateDueDate("2101-01-01").ok).toBe(false);
  });

  it("rejects values that aren't text", () => {
    expect(validateDueDate(20261115).ok).toBe(false);
  });
});

describe("formatDueDate", () => {
  it("shows the date in a friendly form", () => {
    expect(formatDueDate("2026-11-15")).toBe("15 Nov 2026");
  });

  it("never shifts the day, even at the start of a month or year", () => {
    expect(formatDueDate("2027-01-01")).toBe("1 Jan 2027");
  });
});

describe("toLocalDateString", () => {
  it("uses the local calendar day, padding month and day", () => {
    // new Date(year, monthIndex, day, hour) is in local time; month 0 = January.
    expect(toLocalDateString(new Date(2027, 0, 5, 0, 30))).toBe("2027-01-05");
    expect(toLocalDateString(new Date(2026, 10, 15, 23, 59))).toBe("2026-11-15");
  });
});

describe("dueDateStatus", () => {
  const today = "2026-11-15";

  it("is overdue when the due date has passed", () => {
    expect(dueDateStatus("2026-11-14", today)).toBe("overdue");
    expect(dueDateStatus("2025-12-31", today)).toBe("overdue");
  });

  it("is today when the due date is today", () => {
    expect(dueDateStatus("2026-11-15", today)).toBe("today");
  });

  it("is upcoming when the due date is in the future", () => {
    expect(dueDateStatus("2026-11-16", today)).toBe("upcoming");
    expect(dueDateStatus("2027-01-01", today)).toBe("upcoming");
  });
});
