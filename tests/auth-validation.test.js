import { describe, expect, it } from "vitest";
import {
  validateDeleteAccount,
  validateName,
  validatePasswordChange,
  validateSignIn,
  validateSignUp,
} from "@/lib/auth-validation";

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

describe("validateName", () => {
  it("trims and accepts a normal name", () => {
    expect(validateName("  Sam Lee ")).toEqual({ ok: true, name: "Sam Lee" });
  });

  it("rejects empty, too long, or invisible-character names", () => {
    expect(validateName("   ").ok).toBe(false);
    expect(validateName("a".repeat(51)).ok).toBe(false);
    expect(validateName("Sam\u0000").ok).toBe(false);
    expect(validateName(undefined).ok).toBe(false);
  });
});

describe("validatePasswordChange", () => {
  const good = { currentPassword: "old-password", newPassword: "new-password", confirmPassword: "new-password" };

  it("accepts a valid change and drops the confirmation", () => {
    expect(validatePasswordChange(good)).toEqual({
      ok: true,
      data: { currentPassword: "old-password", newPassword: "new-password" },
    });
  });

  it("says which box is wrong", () => {
    expect(validatePasswordChange({ ...good, currentPassword: "" }).field).toBe("currentPassword");
    expect(validatePasswordChange({ ...good, newPassword: "short", confirmPassword: "short" })).toMatchObject({
      field: "newPassword",
      error: "New password must be at least 8 characters.",
    });
    expect(validatePasswordChange({ ...good, confirmPassword: "new-passwort" })).toMatchObject({
      field: "confirmPassword",
      error: "The new passwords don't match.",
    });
    expect(
      validatePasswordChange({ ...good, newPassword: "old-password", confirmPassword: "old-password" }).field,
    ).toBe("newPassword");
  });
});

describe("validateDeleteAccount", () => {
  it("requires a password", () => {
    expect(validateDeleteAccount({ password: "" }).ok).toBe(false);
    expect(validateDeleteAccount({ password: null }).ok).toBe(false);
    expect(validateDeleteAccount({ password: "secret-pw" })).toEqual({ ok: true, data: { password: "secret-pw" } });
  });
});
