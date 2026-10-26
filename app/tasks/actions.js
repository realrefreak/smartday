"use server";
// Everything exported from this file is a Server Action: it always runs on the
// server, even when a form in the browser triggers it.
//
// Security note: Server Actions are public endpoints. Anyone can call them with
// any data, so they must check their input here and, later, who the user is
// (Stage 4). Browser checks like `required` and `maxLength` are only for
// convenience; they are easy to bypass.

import { revalidatePath } from "next/cache";
import { addTask, toggleTask } from "@/lib/tasks";
import { validateTaskTitle } from "@/lib/task-validation";

// Used with useActionState, so it receives the previous state first, then the form data.
// It returns the new state: an error message, plus the typed title so it isn't lost.
export async function createTaskAction(prevState, formData) {
  const rawTitle = formData.get("title");
  const result = validateTaskTitle(rawTitle);

  if (!result.ok) {
    return {
      error: result.error,
      title: typeof rawTitle === "string" ? rawTitle : "",
    };
  }

  await addTask(result.title);

  // Tell Next the /tasks page is out of date, so the response shows the new task.
  revalidatePath("/tasks");

  return { error: "", title: "" };
}

export async function toggleTaskAction(formData) {
  const id = String(formData.get("id") ?? "");

  await toggleTask(id);
  revalidatePath("/tasks");
}
