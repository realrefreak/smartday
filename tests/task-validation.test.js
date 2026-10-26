import { describe, expect, it } from "vitest";
import { TITLE_MAX_LENGTH, validateTaskTitle } from "@/lib/task-validation";

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
