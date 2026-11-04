import { beforeEach, describe, expect, it, vi } from "vitest";
import { APIError } from "better-auth/api";

// Fakes for things that only exist inside a running Next.js server.
vi.mock("next/headers", () => ({ headers: vi.fn(async () => new Headers()) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: vi.fn((url) => {
    throw new Error(`REDIRECT:${url}`);
  }),
}));

const api = vi.hoisted(() => ({ updateUser: vi.fn(), changePassword: vi.fn(), deleteUser: vi.fn() }));
vi.mock("@/lib/auth", () => ({ getAuth: () => ({ api }) }));
vi.mock("@/lib/session", () => ({ getCurrentUser: vi.fn() }));

import { getCurrentUser } from "@/lib/session";
import {
  changePasswordAction,
  deleteAccountAction,
  updateNameAction,
} from "@/app/account/actions";

function form(fields) {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

const wrongPassword = () => new APIError("BAD_REQUEST", { code: "INVALID_PASSWORD" });

beforeEach(() => {
  vi.clearAllMocks();
  getCurrentUser.mockResolvedValue({ id: "user-1", email: "sam@example.com" });
});

describe("updateNameAction", () => {
  it("saves a trimmed name", async () => {
    const state = await updateNameAction({}, form({ name: "  Sam Lee " }));

    expect(state).toEqual({ error: "", success: "Name saved.", name: "Sam Lee" });
    expect(api.updateUser).toHaveBeenCalledWith(expect.objectContaining({ body: { name: "Sam Lee" } }));
  });

  it("refuses when signed out, without calling Better Auth", async () => {
    getCurrentUser.mockResolvedValue(null);

    const state = await updateNameAction({}, form({ name: "Sam" }));

    expect(state.error).toMatch(/sign in/i);
    expect(api.updateUser).not.toHaveBeenCalled();
  });

  it("rejects an empty name", async () => {
    const state = await updateNameAction({}, form({ name: "  " }));

    expect(state.error).toBe("Please enter your name.");
    expect(api.updateUser).not.toHaveBeenCalled();
  });
});

describe("changePasswordAction", () => {
  const good = { currentPassword: "old-password", newPassword: "new-password", confirmPassword: "new-password" };

  it("changes the password and signs out other devices", async () => {
    const state = await changePasswordAction({}, form(good));

    expect(state.success).toMatch(/Password changed/);
    expect(api.changePassword).toHaveBeenCalledWith(
      expect.objectContaining({
        body: { currentPassword: "old-password", newPassword: "new-password", revokeOtherSessions: true },
      }),
    );
  });

  it("explains a wrong current password, and never echoes passwords", async () => {
    api.changePassword.mockRejectedValue(wrongPassword());

    const state = await changePasswordAction({}, form(good));

    expect(state).toMatchObject({ field: "currentPassword", error: "Your current password is incorrect." });
    expect(JSON.stringify(state)).not.toMatch(/old-password|new-password/);
  });

  it("catches mismatched new passwords before calling Better Auth", async () => {
    const state = await changePasswordAction({}, form({ ...good, confirmPassword: "different-pw" }));

    expect(state.field).toBe("confirmPassword");
    expect(api.changePassword).not.toHaveBeenCalled();
  });
});

describe("deleteAccountAction", () => {
  it("deletes with the password, then goes home", async () => {
    await expect(deleteAccountAction({}, form({ password: "secret-pw" }))).rejects.toThrow(
      "REDIRECT:/?account=deleted",
    );

    expect(api.deleteUser).toHaveBeenCalledWith(expect.objectContaining({ body: { password: "secret-pw" } }));
  });

  it("never deletes without a password", async () => {
    // Better Auth would accept a recent session alone, so we must insist.
    const state = await deleteAccountAction({}, form({ password: "" }));

    expect(state.error).toMatch(/enter your password/);
    expect(api.deleteUser).not.toHaveBeenCalled();
  });

  it("keeps the account when the password is wrong", async () => {
    api.deleteUser.mockRejectedValue(wrongPassword());

    const state = await deleteAccountAction({}, form({ password: "wrong-pw" }));

    expect(state.error).toBe("Password is incorrect.");
  });

  it("refuses when signed out", async () => {
    getCurrentUser.mockResolvedValue(null);

    const state = await deleteAccountAction({}, form({ password: "secret-pw" }));

    expect(state.error).toMatch(/sign in/i);
    expect(api.deleteUser).not.toHaveBeenCalled();
  });
});
