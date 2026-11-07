import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// revalidatePath only works inside a running Next.js server, so replace it with
// a fake ("mock") that just records how it was called.
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

// Replace the database-backed store with fakes too. This is a unit test of the
// action's own logic (validate, save, refresh), not of the database.
vi.mock("@/lib/tasks", () => ({
  addTask: vi.fn(),
  deleteCompletedTasks: vi.fn(),
  deleteTask: vi.fn(),
  duplicateTask: vi.fn(),
  restoreTask: vi.fn(),
  toggleTask: vi.fn(),
  updateTask: vi.fn(),
}));

vi.mock("@/lib/subtasks", () => ({
  addSubtask: vi.fn(),
  deleteSubtask: vi.fn(),
  toggleSubtask: vi.fn(),
}));

// cookies() only works inside a request. The actions read the time zone
// cookie from it; here it's India, so "today" is easy to predict.
vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({ get: (name) => (name === "tz" ? { value: "Asia/Kolkata" } : undefined) })),
}));

// Fake "who is signed in". Each test decides by setting what it returns.
vi.mock("@/lib/session", () => ({
  getCurrentUser: vi.fn(),
}));

import { revalidatePath } from "next/cache";
import { addSubtask, deleteSubtask, toggleSubtask } from "@/lib/subtasks";
import { getCurrentUser } from "@/lib/session";
import {
  addTask,
  deleteCompletedTasks,
  deleteTask,
  duplicateTask,
  restoreTask,
  toggleTask,
  updateTask,
} from "@/lib/tasks";
import {
  addSubtaskAction,
  clearCompletedAction,
  deleteSubtaskAction,
  toggleSubtaskAction,
  createTaskAction,
  deleteTaskAction,
  duplicateTaskAction,
  moveToTomorrowAction,
  restoreTaskAction,
  toggleTaskAction,
  updateTaskAction,
} from "@/app/tasks/actions";

const signedInUser = { id: "user-1", email: "a@example.com" };

// Builds the same FormData a browser would send. An empty date input still
// sends dueDate as "", so that's the default here too. The add form always
// sends a priority.
function form(title, dueDate = "", priority = "medium") {
  const data = new FormData();
  data.set("title", title);
  data.set("dueDate", dueDate);
  data.set("priority", priority);
  return data;
}

const initialState = { error: "", field: "", title: "", dueDate: "", priority: "medium", repeat: "" };
// After a successful add, title and date are cleared; priority is kept.
const clearedState = (priority = "medium") => ({ ...initialState, priority });

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

    expect(state).toEqual(clearedState());
    // The owner comes from the session, not the form. No date given = null.
    expect(addTask).toHaveBeenCalledWith("user-1", "Buy milk", null, "medium", null);
    expect(revalidatePath).toHaveBeenCalledWith("/tasks");
  });

  it("saves the due date when one is given", async () => {
    const state = await createTaskAction(initialState, form("Pay rent", "2026-12-01"));

    expect(state).toEqual(clearedState());
    expect(addTask).toHaveBeenCalledWith("user-1", "Pay rent", "2026-12-01", "medium", null);
  });

  it("saves the chosen priority and keeps it for the next task", async () => {
    const state = await createTaskAction(initialState, form("File taxes", "", "high"));

    expect(addTask).toHaveBeenCalledWith("user-1", "File taxes", null, "high", null);
    expect(state).toEqual(clearedState("high"));
  });

  it("saves a repeating task", async () => {
    const data = form("Water plants", "2026-12-01");
    data.set("repeat", "weekly");

    await createTaskAction(initialState, data);

    expect(addTask).toHaveBeenCalledWith("user-1", "Water plants", "2026-12-01", "medium", "weekly");
  });

  it("refuses a repeating task without a due date", async () => {
    const data = form("Water plants");
    data.set("repeat", "weekly");

    const state = await createTaskAction(initialState, data);

    expect(state).toMatchObject({ field: "repeat", error: "A repeating task needs a due date." });
    expect(addTask).not.toHaveBeenCalled();
  });

  it("rejects a made-up priority", async () => {
    const state = await createTaskAction(initialState, form("File taxes", "", "urgent"));

    expect(state).toMatchObject({ field: "priority", priority: "urgent" });
    expect(state.error).toMatch(/priority/);
    expect(addTask).not.toHaveBeenCalled();
  });

  it("rejects an impossible due date and keeps both typed values", async () => {
    const state = await createTaskAction(initialState, form("Pay rent", "2026-02-30"));

    expect(state).toEqual({
      error: "Please enter a valid due date.",
      field: "dueDate",
      title: "Pay rent",
      dueDate: "2026-02-30",
      priority: "medium",
      repeat: "",
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

const TASK_ID = "00000000-0000-4000-8000-000000000000";

// The FormData the edit form sends.
function editForm(title, dueDate = "", { priority = "medium", notes = "", repeat = "" } = {}) {
  const data = form(title, dueDate, priority);
  data.set("id", TASK_ID);
  data.set("notes", notes);
  data.set("repeat", repeat);
  return data;
}

describe("updateTaskAction", () => {
  const before = { ok: false, error: "", field: "", title: "Old", dueDate: "" };

  beforeEach(() => {
    vi.clearAllMocks();
    getCurrentUser.mockResolvedValue(signedInUser);
    // By default the task exists and belongs to the user.
    updateTask.mockResolvedValue({ id: TASK_ID });
  });

  it("refuses to save anything when nobody is signed in", async () => {
    getCurrentUser.mockResolvedValue(null);

    const state = await updateTaskAction(before, editForm("New"));

    expect(state.ok).toBe(false);
    expect(state.error).toMatch(/sign in/i);
    expect(updateTask).not.toHaveBeenCalled();
  });

  it("saves the trimmed title and date for the signed-in user", async () => {
    const state = await updateTaskAction(
      before,
      editForm("  New title  ", "2026-12-01", { priority: "low", notes: " Ask Sam\r\nfirst " }),
    );

    expect(state.ok).toBe(true);
    expect(updateTask).toHaveBeenCalledWith("user-1", TASK_ID, {
      title: "New title",
      dueDate: "2026-12-01",
      priority: "low",
      notes: "Ask Sam\nfirst",
      repeat: null,
    });
    expect(revalidatePath).toHaveBeenCalledWith("/tasks");
  });

  it("clears the due date when the date box is emptied", async () => {
    await updateTaskAction(before, editForm("New title", ""));

    expect(updateTask).toHaveBeenCalledWith("user-1", TASK_ID, {
      title: "New title",
      dueDate: null,
      priority: "medium",
      notes: null,
      repeat: null,
    });
  });

  it("saves a new repeat setting", async () => {
    await updateTaskAction(before, editForm("Gym", "2026-12-01", { repeat: "daily" }));

    expect(updateTask).toHaveBeenCalledWith("user-1", TASK_ID, expect.objectContaining({ repeat: "daily" }));
  });

  it("refuses to repeat a task without a due date", async () => {
    const state = await updateTaskAction(before, editForm("Gym", "", { repeat: "daily" }));

    expect(state).toMatchObject({ ok: false, field: "repeat" });
    expect(updateTask).not.toHaveBeenCalled();
  });

  it("leaves priority and notes alone when an older form doesn't send them", async () => {
    // A page opened before priorities existed only sends id, title and date.
    const data = new FormData();
    data.set("id", TASK_ID);
    data.set("title", "New title");
    data.set("dueDate", "");

    await updateTaskAction(before, data);

    expect(updateTask).toHaveBeenCalledWith("user-1", TASK_ID, {
      title: "New title",
      dueDate: null,
      priority: undefined,
      notes: undefined,
      // The date was removed, so the task can't keep repeating.
      repeat: null,
    });
  });

  it("leaves repeat alone when an older form keeps the due date", async () => {
    const data = new FormData();
    data.set("id", TASK_ID);
    data.set("title", "New title");
    data.set("dueDate", "2026-12-01");

    await updateTaskAction(before, data);

    expect(updateTask.mock.calls[0][2]).toMatchObject({ dueDate: "2026-12-01" });
    expect(updateTask.mock.calls[0][2].repeat).toBeUndefined();
  });

  it("rejects notes that are too long", async () => {
    const state = await updateTaskAction(before, editForm("New", "", { notes: "a".repeat(1001) }));

    expect(state).toMatchObject({ ok: false, field: "notes" });
    expect(updateTask).not.toHaveBeenCalled();
  });

  it("uses the same validation as adding a task", async () => {
    const blank = await updateTaskAction(before, editForm("   "));
    expect(blank).toMatchObject({ ok: false, field: "title", error: "Please enter a task title." });

    const badDate = await updateTaskAction(before, editForm("New", "2026-02-30"));
    expect(badDate).toMatchObject({ ok: false, field: "dueDate", dueDate: "2026-02-30" });

    expect(updateTask).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("explains when the task no longer exists (or isn't yours)", async () => {
    updateTask.mockResolvedValue(null);

    const state = await updateTaskAction(before, editForm("New"));

    expect(state.ok).toBe(false);
    expect(state.error).toMatch(/no longer exists/);
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});

describe("deleteTaskAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does nothing when nobody is signed in", async () => {
    getCurrentUser.mockResolvedValue(null);
    const data = new FormData();
    data.set("id", TASK_ID);

    expect(await deleteTaskAction(data)).toBeNull();

    expect(deleteTask).not.toHaveBeenCalled();
  });

  it("deletes on behalf of the signed-in user only, and returns what it deleted", async () => {
    getCurrentUser.mockResolvedValue(signedInUser);
    deleteTask.mockResolvedValue({
      id: TASK_ID,
      userId: "user-1",
      title: "Buy milk",
      dueDate: "2026-12-01",
      priority: "high",
      notes: null,
      repeat: null,
      completed: true,
      createdAt: new Date(),
      subtasks: [{ title: "Full fat", completed: false }],
    });
    const data = new FormData();
    data.set("id", TASK_ID);

    const deleted = await deleteTaskAction(data);

    expect(deleteTask).toHaveBeenCalledWith("user-1", TASK_ID);
    expect(revalidatePath).toHaveBeenCalledWith("/tasks");
    // Just the details, not the id or the owner.
    expect(deleted).toEqual({
      title: "Buy milk",
      dueDate: "2026-12-01",
      priority: "high",
      notes: null,
      repeat: null,
      completed: true,
      subtasks: [{ title: "Full fat", completed: false }],
    });
  });

  it("returns null when there was nothing to delete", async () => {
    getCurrentUser.mockResolvedValue(signedInUser);
    deleteTask.mockResolvedValue(null);
    const data = new FormData();
    data.set("id", TASK_ID);

    expect(await deleteTaskAction(data)).toBeNull();
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});

describe("restoreTaskAction", () => {
  const deleted = {
    title: "Water plants",
    dueDate: "2026-12-01",
    priority: "low",
    notes: "Big ones",
    repeat: "weekly",
    completed: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    getCurrentUser.mockResolvedValue(signedInUser);
  });

  it("refuses when nobody is signed in", async () => {
    getCurrentUser.mockResolvedValue(null);

    expect(await restoreTaskAction(deleted)).toEqual({ ok: false, error: expect.stringMatching(/sign in/) });
    expect(restoreTask).not.toHaveBeenCalled();
  });

  it("puts the task back for the signed-in user", async () => {
    expect(await restoreTaskAction(deleted)).toEqual({ ok: true });

    // No checklist sent (an older page): restored with none.
    expect(restoreTask).toHaveBeenCalledWith("user-1", { ...deleted, subtasks: [] });
    expect(revalidatePath).toHaveBeenCalledWith("/tasks");
  });

  it("keeps a finished task finished", async () => {
    await restoreTaskAction({ ...deleted, repeat: null, completed: true });

    expect(restoreTask).toHaveBeenCalledWith("user-1", expect.objectContaining({ completed: true }));
  });

  it.each([
    ["an empty title", { title: "  " }],
    ["a bad date", { dueDate: "2026-02-30" }],
    ["an unknown priority", { priority: "urgent" }],
    ["notes that are too long", { notes: "x".repeat(1001) }],
    ["repeating without a date", { dueDate: null }],
    ["completed that is not true or false", { completed: "yes" }],
  ])("checks everything like a new task: refuses %s", async (_, change) => {
    expect(await restoreTaskAction({ ...deleted, ...change })).toEqual({
      ok: false,
      error: "This task can't be restored.",
    });
    expect(restoreTask).not.toHaveBeenCalled();
  });

  it("refuses something that is not a task at all", async () => {
    expect((await restoreTaskAction(null)).ok).toBe(false);
    expect((await restoreTaskAction("drop table")).ok).toBe(false);
    expect(restoreTask).not.toHaveBeenCalled();
  });

  it("never passes on fields it did not check", async () => {
    await restoreTaskAction({ ...deleted, userId: "someone-else", id: TASK_ID });

    expect(restoreTask).toHaveBeenCalledWith("user-1", { ...deleted, subtasks: [] });
  });

  it("puts the checklist back too, cleaned up", async () => {
    await restoreTaskAction({
      ...deleted,
      subtasks: [
        { title: "  Buy soil ", completed: true, taskId: "someone-elses-task" },
        { title: "Repot", completed: false },
      ],
    });

    expect(restoreTask).toHaveBeenCalledWith(
      "user-1",
      expect.objectContaining({
        subtasks: [
          { title: "Buy soil", completed: true },
          { title: "Repot", completed: false },
        ],
      }),
    );
  });

  it.each([
    ["not a list", "Buy soil"],
    ["an item with no title", [{ title: "", completed: false }]],
    ["an item without a tick value", [{ title: "Repot" }]],
    ["an item that is not an object", [null]],
    ["too many items", Array.from({ length: 21 }, () => ({ title: "Step", completed: false }))],
  ])("refuses a checklist that is %s", async (_, subtasks) => {
    expect((await restoreTaskAction({ ...deleted, subtasks })).ok).toBe(false);
    expect(restoreTask).not.toHaveBeenCalled();
  });
});

describe("addSubtaskAction", () => {
  const before = { error: "", title: "" };

  function itemForm(title, taskId = TASK_ID) {
    const data = new FormData();
    data.set("taskId", taskId);
    data.set("title", title);
    return data;
  }

  beforeEach(() => {
    vi.clearAllMocks();
    getCurrentUser.mockResolvedValue(signedInUser);
  });

  it("refuses when nobody is signed in", async () => {
    getCurrentUser.mockResolvedValue(null);

    const state = await addSubtaskAction(before, itemForm("Step"));

    expect(state.error).toMatch(/sign in/);
    expect(addSubtask).not.toHaveBeenCalled();
  });

  it("adds a trimmed item for the signed-in user and clears the box", async () => {
    addSubtask.mockResolvedValue({ ok: true, subtask: {} });

    const state = await addSubtaskAction(before, itemForm("  Book van "));

    expect(addSubtask).toHaveBeenCalledWith("user-1", TASK_ID, "Book van");
    expect(state).toEqual({ error: "", title: "" });
    expect(revalidatePath).toHaveBeenCalledWith("/tasks");
  });

  it("refuses an empty item and keeps what was typed", async () => {
    const state = await addSubtaskAction(before, itemForm("   "));

    expect(state).toEqual({ error: "Please enter a checklist item.", title: "   " });
    expect(addSubtask).not.toHaveBeenCalled();
  });

  it("explains a full checklist", async () => {
    addSubtask.mockResolvedValue({ ok: false, reason: "full" });

    const state = await addSubtaskAction(before, itemForm("One more"));

    expect(state).toEqual({ error: "A checklist can have at most 20 items.", title: "One more" });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("explains a task that is gone (or not yours)", async () => {
    addSubtask.mockResolvedValue({ ok: false, reason: "not-found" });

    const state = await addSubtaskAction(before, itemForm("Step"));

    expect(state.error).toMatch(/no longer exists/);
  });
});

describe("toggleSubtaskAction and deleteSubtaskAction", () => {
  function idForm() {
    const data = new FormData();
    data.set("id", TASK_ID);
    return data;
  }

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("do nothing when nobody is signed in", async () => {
    getCurrentUser.mockResolvedValue(null);

    await toggleSubtaskAction(idForm());
    await deleteSubtaskAction(idForm());

    expect(toggleSubtask).not.toHaveBeenCalled();
    expect(deleteSubtask).not.toHaveBeenCalled();
  });

  it("act on behalf of the signed-in user only", async () => {
    getCurrentUser.mockResolvedValue(signedInUser);

    await toggleSubtaskAction(idForm());
    await deleteSubtaskAction(idForm());

    expect(toggleSubtask).toHaveBeenCalledWith("user-1", TASK_ID);
    expect(deleteSubtask).toHaveBeenCalledWith("user-1", TASK_ID);
    expect(revalidatePath).toHaveBeenCalledTimes(2);
  });
});

describe("duplicateTaskAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does nothing when nobody is signed in", async () => {
    getCurrentUser.mockResolvedValue(null);
    const data = new FormData();
    data.set("id", TASK_ID);

    await duplicateTaskAction(data);

    expect(duplicateTask).not.toHaveBeenCalled();
  });

  it("copies on behalf of the signed-in user only", async () => {
    getCurrentUser.mockResolvedValue(signedInUser);
    const data = new FormData();
    data.set("id", TASK_ID);

    await duplicateTaskAction(data);

    expect(duplicateTask).toHaveBeenCalledWith("user-1", TASK_ID);
    expect(revalidatePath).toHaveBeenCalledWith("/tasks");
  });
});

describe("clearCompletedAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does nothing when nobody is signed in", async () => {
    getCurrentUser.mockResolvedValue(null);

    await clearCompletedAction();

    expect(deleteCompletedTasks).not.toHaveBeenCalled();
  });

  it("clears only the signed-in user's finished tasks", async () => {
    getCurrentUser.mockResolvedValue(signedInUser);

    await clearCompletedAction();

    expect(deleteCompletedTasks).toHaveBeenCalledWith("user-1");
    expect(revalidatePath).toHaveBeenCalledWith("/tasks");
  });
});

describe("smart quick add and Move to tomorrow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCurrentUser.mockResolvedValue(signedInUser);
    // 23:00 UTC on 6 Nov is already 7 Nov in India (a Saturday).
    vi.useFakeTimers({ now: new Date("2026-11-06T23:00:00Z"), toFake: ["Date"] });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("reads the date and priority typed at the end of the title", async () => {
    await createTaskAction(initialState, form("Call mum tomorrow #family !high"));

    expect(addTask).toHaveBeenCalledWith("user-1", "Call mum #family", "2026-11-08", "high", null);
  });

  it("lets a date picked in the form win over a typed one", async () => {
    await createTaskAction(initialState, form("Call mum tomorrow", "2026-12-25"));

    expect(addTask).toHaveBeenCalledWith("user-1", "Call mum", "2026-12-25", "medium", null);
  });

  it("moves a task to tomorrow in the user's time zone", async () => {
    const data = new FormData();
    data.set("id", "task-1");

    await moveToTomorrowAction(data);

    expect(updateTask).toHaveBeenCalledWith("user-1", "task-1", { dueDate: "2026-11-08" });
    expect(revalidatePath).toHaveBeenCalledWith("/tasks");
  });

  it("does nothing for someone signed out", async () => {
    getCurrentUser.mockResolvedValue(null);
    const data = new FormData();
    data.set("id", "task-1");

    await moveToTomorrowAction(data);

    expect(updateTask).not.toHaveBeenCalled();
  });
});
