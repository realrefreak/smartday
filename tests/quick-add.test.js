import { describe, expect, it } from "vitest";
import { parseDatePhrase, parseQuickAdd } from "@/lib/quick-add";

// A Friday.
const today = "2026-11-06";

describe("parseDatePhrase", () => {
  it("understands relative days", () => {
    expect(parseDatePhrase("today", today)).toBe("2026-11-06");
    expect(parseDatePhrase("tomorrow", today)).toBe("2026-11-07");
    expect(parseDatePhrase("tmr", today)).toBe("2026-11-07");
    expect(parseDatePhrase("next week", today)).toBe("2026-11-13");
    expect(parseDatePhrase("in 3 days", today)).toBe("2026-11-09");
    expect(parseDatePhrase("in 1 day", today)).toBe("2026-11-07");
    expect(parseDatePhrase("in 2 weeks", today)).toBe("2026-11-20");
    expect(parseDatePhrase("in a week", today)).toBe("2026-11-13");
  });

  it("takes a weekday as the next one, today included", () => {
    expect(parseDatePhrase("friday", today)).toBe("2026-11-06");
    expect(parseDatePhrase("sat", today)).toBe("2026-11-07");
    expect(parseDatePhrase("mon", today)).toBe("2026-11-09");
    expect(parseDatePhrase("thursday", today)).toBe("2026-11-12");
  });

  it("reads dates, rolling into next year once they've passed", () => {
    expect(parseDatePhrase("12 dec", today)).toBe("2026-12-12");
    expect(parseDatePhrase("dec 12", today)).toBe("2026-12-12");
    expect(parseDatePhrase("6 november", today)).toBe("2026-11-06");
    expect(parseDatePhrase("3 jan", today)).toBe("2027-01-03");
    expect(parseDatePhrase("1 nov", today)).toBe("2027-11-01");
    expect(parseDatePhrase("2027-02-14", today)).toBe("2027-02-14");
  });

  it("refuses dates that don't exist and anything else", () => {
    for (const phrase of ["31 feb", "2026-02-30", "32 jan", "0 jan", "12 smarch", "soon", "", "in days"]) {
      expect(parseDatePhrase(phrase, today), phrase).toBeNull();
    }
  });
});

describe("parseQuickAdd", () => {
  it("takes the date and priority off the end and keeps the tags", () => {
    expect(parseQuickAdd("Call mum tomorrow #family !high", today)).toEqual({
      title: "Call mum #family",
      dueDate: "2026-11-07",
      priority: "high",
    });
    expect(parseQuickAdd("Gym #health tomorrow", today)).toEqual({
      title: "Gym #health",
      dueDate: "2026-11-07",
      priority: null,
    });
  });

  it("drops a little word before the date", () => {
    expect(parseQuickAdd("Pay rent by friday", today).title).toBe("Pay rent");
    expect(parseQuickAdd("Dentist on 12 dec", today)).toMatchObject({ title: "Dentist", dueDate: "2026-12-12" });
    expect(parseQuickAdd("Report due in 3 days !2", today)).toEqual({
      title: "Report",
      dueDate: "2026-11-09",
      priority: "medium",
    });
  });

  it("is case-insensitive but keeps the title as typed", () => {
    expect(parseQuickAdd("Book FLIGHTS Tomorrow !LOW", today)).toEqual({
      title: "Book FLIGHTS",
      dueDate: "2026-11-07",
      priority: "low",
    });
  });

  it("leaves date words that aren't at the end alone", () => {
    for (const text of ["Today show tickets", "Monday meeting notes", "Plan next week's menu", "Wow!"]) {
      expect(parseQuickAdd(text, today)).toEqual({ title: text, dueDate: null, priority: null });
    }
  });

  it("keeps a title that would otherwise be empty", () => {
    expect(parseQuickAdd("tomorrow", today).title).toBe("tomorrow");
    expect(parseQuickAdd("#work friday", today).title).toBe("#work friday");
  });

  it("only takes the last date when there are two", () => {
    expect(parseQuickAdd("Swap monday shift friday", today)).toMatchObject({
      title: "Swap monday shift",
      dueDate: "2026-11-06",
    });
  });
});
