import { describe, expect, it } from "vitest";
import { validateSignIn, validateSignUp } from "@/lib/auth-validation";

const good = { name: "Sam", email: "sam@example.com", password: "long-enough" };

describe("validateSignUp", () => {
  it("accepts valid input and cleans it up", () => {
    const result = validateSignUp({ ...good, name: "  Sam  ", email: "  Sam@Example.COM " });

    expect(result).toEqual({
      ok: true,
      data: { name: "Sam", email: "sam@example.com", password: "long-enough" },
    });
  });

  it("keeps spaces in passwords exactly as typed", () => {
    const result = validateSignUp({ ...good, password: "  spaced out  " });

    expect(result.data.password).toBe("  spaced out  ");
  });

  it.each([
    ["missing name", { name: "   " }, /name/i],
    ["name too long", { name: "a".repeat(51) }, /50/],
    ["email without @", { email: "sam.example.com" }, /email/i],
    ["email with spaces", { email: "sam @example.com" }, /email/i],
    ["password too short", { password: "1234567" }, /at least 8/],
    ["password too long", { password: "a".repeat(129) }, /128/],
    ["password missing", { password: null }, /at least 8/],
  ])("rejects %s", (_label, change, message) => {
    const result = validateSignUp({ ...good, ...change });

    expect(result.ok).toBe(false);
    expect(result.error).toMatch(message);
  });
});

describe("validateSignIn", () => {
  it("accepts an email and any non-empty password", () => {
    expect(validateSignIn({ email: "SAM@example.com", password: "x" })).toEqual({
      ok: true,
      data: { email: "sam@example.com", password: "x" },
    });
  });

  it("rejects a bad email", () => {
    expect(validateSignIn({ email: "nope", password: "x" }).ok).toBe(false);
  });

  it("rejects an empty password", () => {
    expect(validateSignIn({ email: "sam@example.com", password: "" }).ok).toBe(false);
  });
});
