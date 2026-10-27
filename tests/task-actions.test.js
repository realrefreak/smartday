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

import { revalidatePath } from "next/cache";
import { addTask } from "@/lib/tasks";
import { createTaskAction } from "@/app/tasks/actions";

// Builds the same FormData a browser would send.
function form(title) {
  const data = new FormData();
  data.set("title", title);
  return data;
}

const initialState = { error: "", title: "" };

describe("createTaskAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("saves a valid task, trimmed, and refreshes the page", async () => {
    const state = await createTaskAction(initialState, form("  Buy milk  "));

    expect(state).toEqual({ error: "", title: "" });
    expect(addTask).toHaveBeenCalledWith("Buy milk");
    expect(revalidatePath).toHaveBeenCalledWith("/tasks");
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
