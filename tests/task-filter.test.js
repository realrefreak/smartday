import { describe, expect, it } from "vitest";
import { parseTaskFilter, taskFilterHref } from "@/lib/task-filter";

describe("parseTaskFilter", () => {
  it("accepts the known filters", () => {
    expect(parseTaskFilter("all")).toBe("all");
    expect(parseTaskFilter("active")).toBe("active");
    expect(parseTaskFilter("done")).toBe("done");
  });

  it("falls back to 'all' when the URL has no filter", () => {
    expect(parseTaskFilter(undefined)).toBe("all");
    expect(parseTaskFilter("")).toBe("all");
  });

  it("falls back to 'all' for anything typed into the URL by hand", () => {
    expect(parseTaskFilter("banana")).toBe("all");
    expect(parseTaskFilter("ACTIVE")).toBe("all");
    // ?show=active&show=done arrives as an array.
    expect(parseTaskFilter(["active", "done"])).toBe("all");
  });
});

describe("taskFilterHref", () => {
  it("uses the plain /tasks URL for the default filter", () => {
    expect(taskFilterHref("all")).toBe("/tasks");
  });

  it("puts other filters in the URL", () => {
    expect(taskFilterHref("active")).toBe("/tasks?show=active");
    expect(taskFilterHref("done")).toBe("/tasks?show=done");
  });
});
