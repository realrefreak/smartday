// GET /api/tasks/export: downloads all of the signed-in user's tasks as a
// CSV file. A Route Handler, because the answer is a file, not a page.

import { getCurrentUser } from "@/lib/session";
import { listTasks } from "@/lib/tasks";
import { toCsv } from "@/lib/csv";

const HEADINGS = ["Title", "Done", "Due date", "Priority", "Repeats", "Notes", "Created"];

export async function GET() {
  // Route Handlers aren't covered by requireUser's redirect, so check here.
  // Only ever this user's own tasks, like everywhere else.
  const user = await getCurrentUser();
  if (!user) {
    return Response.json({ error: "Not signed in" }, { status: 401 });
  }

  const tasks = await listTasks(user.id);
  const rows = tasks.map((task) => [
    task.title,
    task.completed ? "Yes" : "No",
    task.dueDate ?? "",
    task.priority,
    task.repeat ?? "",
    task.notes ?? "",
    task.createdAt.toISOString(),
  ]);

  // "﻿" (a "byte order mark") at the start tells Excel the file is
  // UTF-8, so accents and emoji in titles show up correctly.
  const body = "﻿" + toCsv([HEADINGS, ...rows]);
  const today = new Date().toISOString().slice(0, 10);

  return new Response(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      // "attachment" = download it, under this file name, instead of showing it.
      "Content-Disposition": `attachment; filename="smartday-tasks-${today}.csv"`,
      // Personal data: never keep a copy in any cache.
      "Cache-Control": "private, no-store",
    },
  });
}
