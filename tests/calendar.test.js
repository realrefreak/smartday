import { describe, expect, it } from "vitest";
import { formatMonth, monthGrid, parseDay, parseMonth, shiftMonth } from "@/lib/calendar";

describe("parseMonth", () => {
  const today = "2026-11-06";

  it("accepts a real month", () => {
    expect(parseMonth("2027-02", today)).toBe("2027-02");
  });

  it("falls back to this month for anything else", () => {
    expect(parseMonth(undefined, today)).toBe("2026-11");
    expect(parseMonth("banana", today)).toBe("2026-11");
    expect(parseMonth("2026-13", today)).toBe("2026-11");
    expect(parseMonth("2026-00", today)).toBe("2026-11");
    expect(parseMonth("1900-01", today)).toBe("2026-11");
    expect(parseMonth(["2026-01", "2026-02"], today)).toBe("2026-11");
  });
});

describe("shiftMonth and formatMonth", () => {
  it("moves across year ends", () => {
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
  });

  it("names the month", () => {
    expect(formatMonth("2026-11")).toBe("November 2026");
  });
});

describe("monthGrid", () => {
  it("covers November 2026 in Monday-to-Sunday weeks", () => {
    // 1 Nov 2026 is a Sunday, so the first week starts on Monday 26 Oct.
    const { weeks, from, to } = monthGrid("2026-11");

    expect(from).toBe("2026-10-26");
    expect(to).toBe("2026-12-06");
    expect(weeks).toHaveLength(6);
    expect(weeks.every((week) => week.length === 7)).toBe(true);
    expect(weeks[0][6]).toEqual({ date: "2026-11-01", inMonth: true });
    expect(weeks[0][0]).toEqual({ date: "2026-10-26", inMonth: false });
  });

  it("needs only 4 weeks for a February that starts on a Monday", () => {
    // 1 Feb 2027 is a Monday and February 2027 has 28 days.
    const { weeks, from, to } = monthGrid("2027-02");
    expect(weeks).toHaveLength(4);
    expect(from).toBe("2027-02-01");
    expect(to).toBe("2027-02-28");
  });
});

describe("parseDay", () => {
  // November 2026's grid runs from Monday 26 October to Sunday 6 December.
  const from = "2026-10-26";
  const to = "2026-12-06";

  it("accepts a real day shown in the grid, including the edge weeks", () => {
    expect(parseDay("2026-11-12", from, to)).toBe("2026-11-12");
    expect(parseDay("2026-10-26", from, to)).toBe("2026-10-26");
    expect(parseDay("2026-12-06", from, to)).toBe("2026-12-06");
  });

  it("ignores days outside the grid, impossible dates and junk", () => {
    for (const value of ["2026-12-07", "2026-10-25", "2026-11-31", "2026-02-30", "2026-11-1", "banana", "", undefined, ["2026-11-12"]]) {
      expect(parseDay(value, from, to)).toBeNull();
    }
  });
});
