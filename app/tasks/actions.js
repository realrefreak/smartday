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
import { addTask, deleteTask, toggleTask, updateTask } from "@/lib/tasks";
import { validateDueDate, validateTaskTitle } from "@/lib/task-validation";

const SIGNED_OUT_ERROR = "Your session has ended. Please sign in again.";

// FormData values can be a File or missing; only strings go back to the form.
function asText(value) {
  return typeof value === "string" ? value : "";
}

// Used with useActionState, so it receives the previous state first, then the form data.
// It returns the new state:
//   error   - message to show, or "" if it worked
//   field   - which input the error is about ("title" or "dueDate"), for screen readers
//   title, dueDate - what the user typed, so a mistake doesn't wipe the form
export async function createTaskAction(prevState, formData) {
  const rawTitle = formData.get("title");
  const rawDueDate = formData.get("dueDate");
  const typed = { title: asText(rawTitle), dueDate: asText(rawDueDate) };

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

  await addTask(user.id, title.title, dueDate.dueDate);

  // Tell Next the /tasks page is out of date, so the response shows the new task.
  revalidatePath("/tasks");

  return { error: "", field: "", title: "", dueDate: "" };
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
  const typed = { title: asText(rawTitle), dueDate: asText(rawDueDate) };

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

  // updateTask only matches tasks owned by this user. null means the task was
  // deleted (e.g. in another tab) or the id was forged.
  const task = await updateTask(user.id, id, {
    title: title.title,
    dueDate: dueDate.dueDate,
  });
  if (!task) {
    return { ok: false, error: "This task no longer exists. Reload the page.", field: "", ...typed };
  }

  revalidatePath("/tasks");
  return { ok: true, error: "", field: "", ...typed };
}

export async function deleteTaskAction(formData) {
  const user = await getCurrentUser();
  if (!user) {
    return;
  }

  // Like toggling: only matches this user's own task.
  await deleteTask(user.id, String(formData.get("id") ?? ""));
  revalidatePath("/tasks");
}
