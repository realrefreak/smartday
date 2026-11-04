import { describe, expect, it } from "vitest";
import {
  SEARCH_MAX_LENGTH,
  parseSearchQuery,
  parseTaskFilter,
  parseTaskSort,
  tasksHref,
} from "@/lib/task-filter";

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

describe("parseTaskSort", () => {
  it("accepts the known sort orders", () => {
    expect(parseTaskSort("due")).toBe("due");
    expect(parseTaskSort("priority")).toBe("priority");
  });

  it("falls back to due date for anything else", () => {
    expect(parseTaskSort(undefined)).toBe("due");
    expect(parseTaskSort("title")).toBe("due");
    expect(parseTaskSort(["priority", "due"])).toBe("due");
  });
});

describe("parseSearchQuery", () => {
  it("trims the search text", () => {
    expect(parseSearchQuery("  milk ")).toBe("milk");
  });

  it("means no search when missing, empty or repeated", () => {
    expect(parseSearchQuery(undefined)).toBe("");
    expect(parseSearchQuery("   ")).toBe("");
    expect(parseSearchQuery(["a", "b"])).toBe("");
  });

  it("cuts very long searches down to size", () => {
    expect(parseSearchQuery("x".repeat(5000))).toHaveLength(SEARCH_MAX_LENGTH);
  });
});

describe("tasksHref", () => {
  it("uses the plain /tasks URL for the defaults", () => {
    expect(tasksHref()).toBe("/tasks");
    expect(tasksHref({ filter: "all", sort: "due", query: "  " })).toBe("/tasks");
  });

  it("puts other filters in the URL", () => {
    expect(tasksHref({ filter: "active" })).toBe("/tasks?show=active");
    expect(tasksHref({ filter: "done" })).toBe("/tasks?show=done");
  });

  it("keeps filter, sort and search together", () => {
    expect(tasksHref({ filter: "done", sort: "priority", query: "milk" })).toBe(
      "/tasks?show=done&sort=priority&q=milk",
    );
  });

  it("encodes search text safely", () => {
    expect(tasksHref({ query: "rock & roll?" })).toBe("/tasks?q=rock+%26+roll%3F");
  });
});
