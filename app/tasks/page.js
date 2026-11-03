import { requireUser } from "@/lib/session";
import { listTasks } from "@/lib/tasks";
import AddTaskForm from "./AddTaskForm";
import TaskItem from "./TaskItem";

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
          {/* TaskItem is a Client Component (it has an edit mode), so pass
              only what it needs: these values are sent to the browser. */}
          {tasks.map((task) => (
            <TaskItem
              key={task.id}
              id={task.id}
              title={task.title}
              dueDate={task.dueDate}
              completed={task.completed}
            />
          ))}
        </ul>
      )}
    </section>
  );
}
