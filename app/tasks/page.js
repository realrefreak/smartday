import Link from "next/link";
import { requireUser } from "@/lib/session";
import { TASK_FILTERS, parseTaskFilter, taskFilterHref } from "@/lib/task-filter";
import { listTasks } from "@/lib/tasks";
import AddTaskForm from "./AddTaskForm";
import TaskItem from "./TaskItem";

export const metadata = {
  title: "Tasks",
};

// What to say when the list is empty, depending on the filter.
const EMPTY_MESSAGES = {
  all: "No tasks yet. Add your first one above.",
  active: "Nothing left to do. Nice!",
  done: "No finished tasks yet.",
};

// searchParams holds the URL's "?..." part. In Next.js 16 it's a Promise, so
// it must be awaited. A value can be a string, an array (?show=a&show=b) or
// missing, which parseTaskFilter handles.
export default async function TasksPage({ searchParams }) {
  // The real login check: proxy.js only looks for a cookie; this confirms the
  // session exists in the database. Logged-out visitors go to /sign-in.
  // (Reading the session also makes this page render on every request.)
  const user = await requireUser();

  const filter = parseTaskFilter((await searchParams).show);

  // Only this user's tasks, filtered in the database.
  const tasks = await listTasks(user.id, { filter });

  return (
    <section className="space-y-6">
      <h1 className="text-3xl font-semibold">Tasks</h1>

      {/* Client Component: shows validation errors and "Adding…" while saving. */}
      <AddTaskForm />

      {/* Plain links, not buttons: each filter is its own URL. Link swaps the
          page without a full reload. aria-current tells screen readers which
          one is selected. */}
      <nav aria-label="Filter tasks" className="flex gap-1 text-sm">
        {TASK_FILTERS.map(({ value, label }) => {
          const selected = value === filter;
          return (
            <Link
              key={value}
              href={taskFilterHref(value)}
              aria-current={selected ? "page" : undefined}
              className={
                selected
                  ? "rounded bg-foreground px-3 py-1 text-background"
                  : "rounded px-3 py-1 hover:bg-black/5 dark:hover:bg-white/10"
              }
            >
              {label}
            </Link>
          );
        })}
      </nav>

      {tasks.length === 0 ? (
        <p className="text-zinc-600 dark:text-zinc-400">{EMPTY_MESSAGES[filter]}</p>
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
