"use server";
// Everything exported from this file is a Server Action: it always runs on the
// server, even when a form in the browser triggers it.
//
// Security note: Server Actions are public endpoints. Anyone can call them with
// any data, so they must check their input (step 2c) and, later, who the user is
// (Stage 4).

import { revalidatePath } from "next/cache";
import { addTask, toggleTask } from "@/lib/tasks";

export async function createTaskAction(formData) {
  // Form values arrive as FormData; "title" matches the input's name attribute.
  const title = String(formData.get("title") ?? "").trim();

  // Minimal guard for now. Step 2c replaces this with proper validation + messages.
  if (!title) {
    return;
  }

  await addTask(title);

  // Tell Next the /tasks page is out of date, so the response shows the new task.
  revalidatePath("/tasks");
}

export async function toggleTaskAction(formData) {
  const id = String(formData.get("id") ?? "");

  await toggleTask(id);
  revalidatePath("/tasks");
}
