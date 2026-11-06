import { describe, expect, it } from "vitest";
import { isTagQuery, splitTags, tagPattern } from "@/lib/tags";
import { parseTimeZone, todayIn } from "@/lib/time-zone";

describe("parseTimeZone", () => {
  it("accepts real time zone names", () => {
    expect(parseTimeZone("Asia/Kolkata")).toBe("Asia/Kolkata");
    expect(parseTimeZone("America/New_York")).toBe("America/New_York");
    expect(parseTimeZone("UTC")).toBe("UTC");
  });

  it("falls back to UTC for anything else", () => {
    expect(parseTimeZone(undefined)).toBe("UTC");
    expect(parseTimeZone("")).toBe("UTC");
    expect(parseTimeZone("Mars/Olympus_Mons")).toBe("UTC");
    expect(parseTimeZone("x".repeat(65))).toBe("UTC");
    expect(parseTimeZone("'; drop table tasks; --")).toBe("UTC");
  });
});

describe("todayIn", () => {
  // 20:00 UTC on 5 Nov is already 01:30 on 6 Nov in India, but still
  // 15:00 on 5 Nov in New York.
  const moment = new Date("2026-11-05T20:00:00Z");

  it("gives the date where the user is", () => {
    expect(todayIn("UTC", moment)).toBe("2026-11-05");
    expect(todayIn("Asia/Kolkata", moment)).toBe("2026-11-06");
    expect(todayIn("America/New_York", moment)).toBe("2026-11-05");
  });

  it("pads months and days to two digits", () => {
    expect(todayIn("UTC", new Date("2027-01-02T12:00:00Z"))).toBe("2027-01-02");
  });
});

describe("splitTags", () => {
  it("separates tags from the rest of the title", () => {
    expect(splitTags("Call boss #work about #q4-plan")).toEqual([
      { text: "Call boss " },
      { tag: "#work" },
      { text: " about " },
      { tag: "#q4-plan" },
    ]);
  });

  it("leaves a title without tags as it is", () => {
    expect(splitTags("Buy milk")).toEqual([{ text: "Buy milk" }]);
    expect(splitTags("")).toEqual([]);
  });

  it("allows letters from any language, and ignores a lone #", () => {
    expect(splitTags("#café # done")).toEqual([{ tag: "#café" }, { text: " # done" }]);
  });

  it("ends a tag at punctuation", () => {
    expect(splitTags("Gym (#health).")).toEqual([{ text: "Gym (" }, { tag: "#health" }, { text: ")." }]);
  });
});

describe("isTagQuery and tagPattern", () => {
  it("spots a search that is exactly one tag", () => {
    expect(isTagQuery("#work")).toBe(true);
    expect(isTagQuery("#q4-plan")).toBe(true);
    expect(isTagQuery("work")).toBe(false);
    expect(isTagQuery("#work stuff")).toBe(false);
    expect(isTagQuery("#")).toBe(false);
    expect(isTagQuery("#a.*")).toBe(false);
  });

  it("builds a pattern that matches the whole tag only", () => {
    expect(tagPattern("#work")).toBe("#work([^[:alnum:]_-]|$)");
  });
});
