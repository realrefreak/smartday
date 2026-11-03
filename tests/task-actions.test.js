import { beforeEach, describe, expect, it, vi } from "vitest";

// revalidatePath only works inside a running Next.js server, so replace it with
// a fake ("mock") that just records how it was called.
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

// Replace the database-backed store with fakes too. This is a unit test of the
// action's own logic (validate, save, refresh), not of the database.
vi.mock("@/lib/tasks", () => ({
  addTask: vi.fn(),
  toggleTask: vi.fn(),
}));

// Fake "who is signed in". Each test decides by setting what it returns.
vi.mock("@/lib/session", () => ({
  getCurrentUser: vi.fn(),
}));

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/session";
import { addTask, toggleTask } from "@/lib/tasks";
import { createTaskAction, toggleTaskAction } from "@/app/tasks/actions";

const signedInUser = { id: "user-1", email: "a@example.com" };

// Builds the same FormData a browser would send. An empty date input still
// sends dueDate as "", so that's the default here too.
function form(title, dueDate = "") {
  const data = new FormData();
  data.set("title", title);
  data.set("dueDate", dueDate);
  return data;
}

const initialState = { error: "", field: "", title: "", dueDate: "" };

describe("createTaskAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCurrentUser.mockResolvedValue(signedInUser);
  });

  it("refuses to save anything when nobody is signed in", async () => {
    getCurrentUser.mockResolvedValue(null);

    const state = await createTaskAction(initialState, form("Buy milk"));

    expect(state.error).toMatch(/sign in/i);
    expect(state.title).toBe("Buy milk");
    expect(addTask).not.toHaveBeenCalled();
  });

  it("saves a valid task, trimmed, and refreshes the page", async () => {
    const state = await createTaskAction(initialState, form("  Buy milk  "));

    expect(state).toEqual(initialState);
    // The owner comes from the session, not the form. No date given = null.
    expect(addTask).toHaveBeenCalledWith("user-1", "Buy milk", null);
    expect(revalidatePath).toHaveBeenCalledWith("/tasks");
  });

  it("saves the due date when one is given", async () => {
    const state = await createTaskAction(initialState, form("Pay rent", "2026-12-01"));

    expect(state).toEqual(initialState);
    expect(addTask).toHaveBeenCalledWith("user-1", "Pay rent", "2026-12-01");
  });

  it("rejects an impossible due date and keeps both typed values", async () => {
    const state = await createTaskAction(initialState, form("Pay rent", "2026-02-30"));

    expect(state).toEqual({
      error: "Please enter a valid due date.",
      field: "dueDate",
      title: "Pay rent",
      dueDate: "2026-02-30",
    });
    expect(addTask).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("returns an error and saves nothing for a blank title", async () => {
    const state = await createTaskAction(initialState, form("   "));

    expect(state.error).toBe("Please enter a task title.");
    expect(addTask).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("keeps what the user typed when the title is too long", async () => {
    const longTitle = "a".repeat(101);
    const state = await createTaskAction(initialState, form(longTitle));

    expect(state.error).toMatch(/100 characters/);
    expect(state.title).toBe(longTitle);
    expect(addTask).not.toHaveBeenCalled();
  });
});

describe("toggleTaskAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does nothing when nobody is signed in", async () => {
    getCurrentUser.mockResolvedValue(null);
    const data = new FormData();
    data.set("id", "00000000-0000-4000-8000-000000000000");

    await toggleTaskAction(data);

    expect(toggleTask).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("toggles on behalf of the signed-in user only", async () => {
    getCurrentUser.mockResolvedValue(signedInUser);
    const data = new FormData();
    data.set("id", "00000000-0000-4000-8000-000000000000");

    await toggleTaskAction(data);

    expect(toggleTask).toHaveBeenCalledWith("user-1", "00000000-0000-4000-8000-000000000000");
    expect(revalidatePath).toHaveBeenCalledWith("/tasks");
  });
});
