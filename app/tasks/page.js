import { connection } from "next/server";
import { listTasks } from "@/lib/tasks";
import { toggleTaskAction } from "./actions";
import AddTaskForm from "./AddTaskForm";

export const metadata = {
  title: "Tasks",
};

export default async function TasksPage() {
  // Without this, Next would render the page once at build time (when the list
  // is empty) and serve that forever. connection() says: render on every request.
  await connection();

  const tasks = await listTasks();

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
              <span
                className={
                  task.completed ? "text-zinc-500 line-through" : undefined
                }
              >
                {task.title}
              </span>

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
