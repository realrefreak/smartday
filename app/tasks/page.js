import { requireUser } from "@/lib/session";
import { formatDueDate } from "@/lib/due-date";
import { listTasks } from "@/lib/tasks";
import { toggleTaskAction } from "./actions";
import AddTaskForm from "./AddTaskForm";

export const metadata = {
  title: "Tasks",
};

export default async function TasksPage() {
  // The real login check: proxy.js only looks for a cookie; this confirms the
  // session exists in the database. Logged-out visitors go to /sign-in.
  // (Reading the session also makes this page render on every request.)
  const user = await requireUser();

  // Only this user's tasks.
  const tasks = await listTasks(user.id);

  return (
    <section className="space-y-6">
      <h1 className="text-3xl font-semibold">Tasks</h1>

      {/* Client Component: shows validation errors and "Adding…" while saving. */}
      <AddTaskForm />

      {tasks.length === 0 ? (
        <p className="text-zinc-600 dark:text-zinc-400">
          No tasks yet. Add your first one above.
        </p>
      ) : (
        <ul className="divide-y divide-black/10 dark:divide-white/15">
          {tasks.map((task) => (
            <li key={task.id} className="flex items-center justify-between py-3">
              <div>
                <span
                  className={
                    task.completed ? "text-zinc-500 line-through" : undefined
                  }
                >
                  {task.title}
                </span>

                {/* <time dateTime> gives the exact date to machines (screen
                    readers, search engines) alongside the friendly text. */}
                {task.dueDate && (
                  <p className="text-sm text-zinc-600 dark:text-zinc-400">
                    Due <time dateTime={task.dueDate}>{formatDueDate(task.dueDate)}</time>
                  </p>
                )}
              </div>

              {/* Each task gets its own tiny form; the hidden input tells the action which task. */}
              <form action={toggleTaskAction}>
                <input type="hidden" name="id" value={task.id} />
                <button type="submit" className="text-sm hover:underline">
                  {task.completed ? "Undo" : "Mark done"}
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
