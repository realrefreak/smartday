import { beforeEach, describe, expect, it, vi } from "vitest";
import { APIError } from "better-auth/api";

// Fakes for things that only exist inside a running Next.js server.
vi.mock("next/headers", () => ({ headers: vi.fn(async () => new Headers()) }));

// The real redirect() throws to stop the action; the fake does the same so
// "code after redirect" behaves like it would for real.
vi.mock("next/navigation", () => ({
  redirect: vi.fn((url) => {
    throw new Error(`REDIRECT:${url}`);
  }),
}));

// Fake Better Auth: each test decides how its API calls behave.
// vi.hoisted: vi.mock calls are moved to the top of the file, so anything they
// use must be created "hoisted" too.
const api = vi.hoisted(() => ({ signUpEmail: vi.fn(), signInEmail: vi.fn(), signOut: vi.fn() }));
vi.mock("@/lib/auth", () => ({ getAuth: () => ({ api }) }));

import { redirect } from "next/navigation";
import { signInAction, signUpAction } from "@/app/(auth)/actions";

function form(fields) {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

const empty = { error: "" };

describe("signUpAction", () => {
  beforeEach(() => vi.clearAllMocks());

  it("creates the account and redirects to /tasks", async () => {
    await expect(
      signUpAction(empty, form({ name: "Sam", email: "Sam@Example.com", password: "long-enough" }))
    ).rejects.toThrow("REDIRECT:/tasks");

    expect(api.signUpEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        body: { name: "Sam", email: "sam@example.com", password: "long-enough" },
      })
    );
  });

  it("returns an error without calling Better Auth when input is invalid", async () => {
    const state = await signUpAction(empty, form({ name: "Sam", email: "sam@example.com", password: "short" }));

    expect(state.error).toMatch(/at least 8/);
    expect(api.signUpEmail).not.toHaveBeenCalled();
  });

  it("explains when the email is already registered, and never echoes the password", async () => {
    api.signUpEmail.mockRejectedValue(
      new APIError("UNPROCESSABLE_ENTITY", { code: "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL" })
    );

    const state = await signUpAction(empty, form({ name: "Sam", email: "sam@example.com", password: "long-enough" }));

    expect(state.error).toMatch(/already exists/);
    expect(state.email).toBe("sam@example.com");
    expect(JSON.stringify(state)).not.toContain("long-enough");
    expect(redirect).not.toHaveBeenCalled();
  });
});

describe("signInAction", () => {
  beforeEach(() => vi.clearAllMocks());

  it("signs in and redirects to /tasks", async () => {
    await expect(
      signInAction(empty, form({ email: "sam@example.com", password: "long-enough" }))
    ).rejects.toThrow("REDIRECT:/tasks");
  });

  it("gives one vague message for a wrong password", async () => {
    api.signInEmail.mockRejectedValue(
      new APIError("UNAUTHORIZED", { code: "INVALID_EMAIL_OR_PASSWORD" })
    );

    const state = await signInAction(empty, form({ email: "sam@example.com", password: "wrong" }));

    expect(state.error).toBe("Email or password is incorrect.");
    expect(JSON.stringify(state)).not.toContain("wrong");
  });

  it("shows a generic message for unexpected failures", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    api.signInEmail.mockRejectedValue(new Error("database down"));

    const state = await signInAction(empty, form({ email: "sam@example.com", password: "x" }));

    expect(state.error).toMatch(/couldn't sign you in/);
    expect(state.error).not.toMatch(/database/);
  });
});
