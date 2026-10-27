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
import { addTask, toggleTask } from "@/lib/tasks";
import { validateTaskTitle } from "@/lib/task-validation";

const SIGNED_OUT_ERROR = "Your session has ended. Please sign in again.";

// Used with useActionState, so it receives the previous state first, then the form data.
// It returns the new state: an error message, plus the typed title so it isn't lost.
export async function createTaskAction(prevState, formData) {
  const rawTitle = formData.get("title");

  // The owner always comes from the session on the server, never from the form,
  // so nobody can create tasks for another user.
  const user = await getCurrentUser();
  if (!user) {
    return { error: SIGNED_OUT_ERROR, title: typeof rawTitle === "string" ? rawTitle : "" };
  }

  const result = validateTaskTitle(rawTitle);

  if (!result.ok) {
    return {
      error: result.error,
      title: typeof rawTitle === "string" ? rawTitle : "",
    };
  }

  await addTask(user.id, result.title);

  // Tell Next the /tasks page is out of date, so the response shows the new task.
  revalidatePath("/tasks");

  return { error: "", title: "" };
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
