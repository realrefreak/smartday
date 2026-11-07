"use server";
// Everything exported from this file is a Server Action: it always runs on the
// server, even when a form in the browser triggers it.
//
// Security note: Server Actions are public endpoints. Anyone can call them with
// any data, so they must check their input AND who is calling. Protecting the
// /tasks page does not protect these: they can be called directly.
// Browser checks like `required` and `maxLength` are only for convenience.

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/session";
import { addSubtask, deleteSubtask, toggleSubtask } from "@/lib/subtasks";
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
  SUBTASKS_MAX,
  validateDueDate,
  validateNotes,
  validatePriority,
  validateRepeat,
  validateSubtaskTitle,
  validateTaskTitle,
} from "@/lib/task-validation";

const SIGNED_OUT_ERROR = "Your session has ended. Please sign in again.";

// FormData values can be a File or missing; only strings go back to the form.
function asText(value) {
  return typeof value === "string" ? value : "";
}

// Used with useActionState, so it receives the previous state first, then the form data.
// It returns the new state:
//   error   - message to show, or "" if it worked
//   field   - which input the error is about ("title", "dueDate",
//             "priority" or "repeat"), for screen readers
//   title, dueDate, priority, repeat - what the user typed, so a mistake
//             doesn't wipe the form
export async function createTaskAction(prevState, formData) {
  const rawTitle = formData.get("title");
  const rawDueDate = formData.get("dueDate");
  const rawPriority = formData.get("priority");
  const rawRepeat = formData.get("repeat");
  const typed = {
    title: asText(rawTitle),
    dueDate: asText(rawDueDate),
    priority: asText(rawPriority),
    repeat: asText(rawRepeat),
  };

  // The owner always comes from the session on the server, never from the form,
  // so nobody can create tasks for another user.
  const user = await getCurrentUser();
  if (!user) {
    return { error: SIGNED_OUT_ERROR, field: "", ...typed };
  }

  const title = validateTaskTitle(rawTitle);
  if (!title.ok) {
    return { error: title.error, field: "title", ...typed };
  }

  const dueDate = validateDueDate(rawDueDate);
  if (!dueDate.ok) {
    return { error: dueDate.error, field: "dueDate", ...typed };
  }

  const priority = validatePriority(rawPriority);
  if (!priority.ok) {
    return { error: priority.error, field: "priority", ...typed };
  }

  const repeat = validateRepeat(rawRepeat, dueDate.dueDate);
  if (!repeat.ok) {
    return { error: repeat.error, field: "repeat", ...typed };
  }

  await addTask(user.id, title.title, dueDate.dueDate, priority.priority, repeat.repeat);

  // Tell Next the /tasks page (and the home page, which has its own add box)
  // are out of date, so the response shows the new task.
  revalidatePath("/tasks");
  revalidatePath("/");
  revalidatePath("/calendar");

  // Clear the form for the next task, but keep the priority: people often add
  // several tasks of the same priority in a row.
  return { error: "", field: "", title: "", dueDate: "", priority: typed.priority, repeat: "" };
}

export async function toggleTaskAction(formData) {
  const user = await getCurrentUser();
  if (!user) {
    return;
  }

  const id = String(formData.get("id") ?? "");

  // toggleTask only matches tasks owned by this user, so a forged id for
  // someone else's task changes nothing.
  await toggleTask(user.id, id);
  revalidatePath("/tasks");
}

// Saves an edited task. Used with useActionState, like createTaskAction, and
// returns the same kind of state plus ok: true when the save worked (the edit
// form uses that to close itself). It reuses the exact same validation as
// creating a task, so editing can't sneak in a title or date that adding
// would refuse.
export async function updateTaskAction(prevState, formData) {
  const id = asText(formData.get("id"));
  const rawTitle = formData.get("title");
  const rawDueDate = formData.get("dueDate");
  const rawPriority = formData.get("priority");
  const rawNotes = formData.get("notes");
  const rawRepeat = formData.get("repeat");
  const typed = {
    title: asText(rawTitle),
    dueDate: asText(rawDueDate),
    priority: asText(rawPriority),
    notes: asText(rawNotes),
    repeat: asText(rawRepeat),
  };

  const user = await getCurrentUser();
  if (!user) {
    return { ok: false, error: SIGNED_OUT_ERROR, field: "", ...typed };
  }

  const title = validateTaskTitle(rawTitle);
  if (!title.ok) {
    return { ok: false, error: title.error, field: "title", ...typed };
  }

  const dueDate = validateDueDate(rawDueDate);
  if (!dueDate.ok) {
    return { ok: false, error: dueDate.error, field: "dueDate", ...typed };
  }

  const priority = validatePriority(rawPriority);
  if (!priority.ok) {
    return { ok: false, error: priority.error, field: "priority", ...typed };
  }

  const notes = validateNotes(rawNotes);
  if (!notes.ok) {
    return { ok: false, error: notes.error, field: "notes", ...typed };
  }

  const repeat = validateRepeat(rawRepeat, dueDate.dueDate);
  if (!repeat.ok) {
    return { ok: false, error: repeat.error, field: "repeat", ...typed };
  }

  // updateTask only matches tasks owned by this user. null means the task was
  // deleted (e.g. in another tab) or the id was forged.
  const task = await updateTask(user.id, id, {
    title: title.title,
    dueDate: dueDate.dueDate,
    // A form that doesn't send these at all (e.g. a page opened before this
    // version was deployed) leaves them unchanged: undefined = don't touch.
    // A sent-but-empty notes box does clear the notes.
    priority: rawPriority === null ? undefined : priority.priority,
    notes: rawNotes === null ? undefined : notes.notes,
    // Same for repeat, with one exception: removing the due date also stops a
    // task repeating, since a repeating task must have a date.
    repeat: rawRepeat !== null ? repeat.repeat : dueDate.dueDate === null ? null : undefined,
  });
  if (!task) {
    return { ok: false, error: "This task no longer exists. Reload the page.", field: "", ...typed };
  }

  revalidatePath("/tasks");
  return { ok: true, error: "", field: "", ...typed };
}

// Deletes a task, and returns a copy of what was deleted so the page can offer
// "Undo". Only the fields the user typed are sent back (no ids or owner).
// Returns null if nothing was deleted.
export async function deleteTaskAction(formData) {
  const user = await getCurrentUser();
  if (!user) {
    return null;
  }

  // Like toggling: only matches this user's own task.
  const deleted = await deleteTask(user.id, String(formData.get("id") ?? ""));
  if (!deleted) {
    return null;
  }

  revalidatePath("/tasks");
  const { title, dueDate, priority, notes, repeat, completed, subtasks } = deleted;
  return { title, dueDate, priority, notes, repeat, completed, subtasks };
}

// "Undo" after deleting: puts the task back. The task comes from the browser,
// and anyone could send anything here, so every field goes through the same
// checks as adding a task. In effect this is "add a task with these details".
// Returns { ok: true } or { ok: false, error }.
export async function restoreTaskAction(task) {
  const user = await getCurrentUser();
  if (!user) {
    return { ok: false, error: SIGNED_OUT_ERROR };
  }

  const fields = task && typeof task === "object" ? task : {};
  const title = validateTaskTitle(fields.title);
  const dueDate = validateDueDate(fields.dueDate);
  const priority = validatePriority(fields.priority);
  const notes = validateNotes(fields.notes);
  const repeat = dueDate.ok ? validateRepeat(fields.repeat, dueDate.dueDate) : dueDate;
  const completed = typeof fields.completed === "boolean" ? fields.completed : null;
  const checklist = validateChecklist(fields.subtasks);

  if (
    !title.ok ||
    !dueDate.ok ||
    !priority.ok ||
    !notes.ok ||
    !repeat.ok ||
    completed === null ||
    checklist === null
  ) {
    return { ok: false, error: "This task can't be restored." };
  }

  // Only the checked values are passed on: an extra "userId" or "id" sent by
  // the browser is simply ignored.
  await restoreTask(user.id, {
    title: title.title,
    dueDate: dueDate.dueDate,
    priority: priority.priority,
    notes: notes.notes,
    repeat: repeat.repeat,
    completed,
    subtasks: checklist,
  });

  revalidatePath("/tasks");
  return { ok: true };
}

// The checklist items sent back with "Undo": at most SUBTASKS_MAX, each with a
// valid title and a true/false tick. Missing means none (e.g. a page opened
// before checklists existed). Returns the cleaned list, or null if anything is
// wrong.
function validateChecklist(value) {
  if (value === undefined || value === null) {
    return [];
  }
  if (!Array.isArray(value) || value.length > SUBTASKS_MAX) {
    return null;
  }

  const items = [];
  for (const item of value) {
    const title = validateSubtaskTitle(item?.title);
    if (!title.ok || typeof item.completed !== "boolean") {
      return null;
    }
    items.push({ title: title.title, completed: item.completed });
  }
  return items;
}

// Adds an item to a task's checklist. Used with useActionState; returns
// { error, title } where title is what was typed (kept after an error,
// cleared after a success so the next item can be typed straight away).
export async function addSubtaskAction(prevState, formData) {
  const rawTitle = formData.get("title");
  const typed = asText(rawTitle);

  const user = await getCurrentUser();
  if (!user) {
    return { error: SIGNED_OUT_ERROR, title: typed };
  }

  const title = validateSubtaskTitle(rawTitle);
  if (!title.ok) {
    return { error: title.error, title: typed };
  }

  // addSubtask checks the task is this user's, and that it isn't full.
  const result = await addSubtask(user.id, asText(formData.get("taskId")), title.title);
  if (!result.ok) {
    const error =
      result.reason === "full"
        ? `A checklist can have at most ${SUBTASKS_MAX} items.`
        : "This task no longer exists. Reload the page.";
    return { error, title: typed };
  }

  revalidatePath("/tasks");
  return { error: "", title: "" };
}

export async function toggleSubtaskAction(formData) {
  const user = await getCurrentUser();
  if (!user) {
    return;
  }

  await toggleSubtask(user.id, asText(formData.get("id")));
  revalidatePath("/tasks");
}

export async function deleteSubtaskAction(formData) {
  const user = await getCurrentUser();
  if (!user) {
    return;
  }

  await deleteSubtask(user.id, asText(formData.get("id")));
  revalidatePath("/tasks");
}

// Copies a task. Only the id comes from the form; the details are read from
// the database, and duplicateTask only finds this user's own tasks.
export async function duplicateTaskAction(formData) {
  const user = await getCurrentUser();
  if (!user) {
    return;
  }

  await duplicateTask(user.id, String(formData.get("id") ?? ""));
  revalidatePath("/tasks");
}

// Deletes all of the signed-in user's finished tasks. Takes no input: it can
// only ever act on the caller's own tasks.
export async function clearCompletedAction() {
  const user = await getCurrentUser();
  if (!user) {
    return;
  }

  await deleteCompletedTasks(user.id);
  revalidatePath("/tasks");
}
