import Link from "next/link";
import { requireUser } from "@/lib/session";
import {
  TASK_FILTERS,
  TASK_SORTS,
  parseSearchQuery,
  parseTaskFilter,
  parseTaskSort,
  tasksHref,
} from "@/lib/task-filter";
import { getTaskCounts, listTasks } from "@/lib/tasks";
import AddTaskForm from "./AddTaskForm";
import ClearCompletedButton from "./ClearCompletedButton";
import KeyboardShortcuts from "./KeyboardShortcuts";
import TaskProgress from "./TaskProgress";
import TaskItem from "./TaskItem";
import TaskSearch from "./TaskSearch";
import UndoDeleteProvider from "./UndoDelete";

export const metadata = {
  title: "Tasks",
};

// What to say when the list is empty, depending on the filter.
const EMPTY_MESSAGES = {
  all: "No tasks yet. Add your first one above.",
  active: "Nothing left to do. Nice!",
  done: "No finished tasks yet.",
};

// A row of links where one is selected (used for the filters and the sort).
// Plain links, not buttons: each choice is its own URL. Link swaps the page
// without a full reload. aria-current tells screen readers which is selected.
function LinkChoices({ label, options, selected, hrefFor }) {
  return (
    <nav aria-label={label} className="flex gap-1 text-sm">
      {options.map(({ value, label: text }) => {
        const isSelected = value === selected;
        return (
          <Link
            key={value}
            href={hrefFor(value)}
            aria-current={isSelected ? "page" : undefined}
            className={
              isSelected
                ? "rounded bg-foreground px-3 py-1 text-background"
                : "rounded px-3 py-1 hover:bg-black/5 dark:hover:bg-white/10"
            }
          >
            {text}
          </Link>
        );
      })}
    </nav>
  );
}

// searchParams holds the URL's "?..." part. In Next.js 16 it's a Promise, so
// it must be awaited. A value can be a string, an array (?show=a&show=b) or
// missing, which the parse functions handle.
export default async function TasksPage({ searchParams }) {
  // The real login check: proxy.js only looks for a cookie; this confirms the
  // session exists in the database. Logged-out visitors go to /sign-in.
  // (Reading the session also makes this page render on every request.)
  const user = await requireUser();

  const params = await searchParams;
  const filter = parseTaskFilter(params.show);
  const sort = parseTaskSort(params.sort);
  const query = parseSearchQuery(params.q);

  // Two independent queries, so run them at the same time. Both only ever
  // see this user's tasks.
  const [tasks, counts] = await Promise.all([
    listTasks(user.id, { filter, sort, query }),
    getTaskCounts(user.id),
  ]);

  const emptyMessage = query ? `No tasks match "${query}".` : EMPTY_MESSAGES[filter];

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-3xl font-semibold">Tasks</h1>
        {/* A plain <a>, not <Link>: this downloads a file from a Route
            Handler rather than showing another page. */}
        {counts.total > 0 && (
          <a href="/api/tasks/export" className="text-sm hover:underline">
            Export CSV
          </a>
        )}
      </div>

      <TaskProgress total={counts.total} completed={counts.completed} />

      {/* Client Component: shows validation errors and "Adding…" while saving. */}
      <AddTaskForm />

      <div className="space-y-3">
        <TaskSearch filter={filter} sort={sort} query={query} />

        <div className="flex flex-wrap items-center justify-between gap-2">
          {/* Every link keeps the other two settings, so switching the
              filter doesn't lose your search or sort order. */}
          <LinkChoices
            label="Filter tasks"
            options={TASK_FILTERS}
            selected={filter}
            hrefFor={(value) => tasksHref({ filter: value, sort, query })}
          />
          <LinkChoices
            label="Sort tasks"
            options={TASK_SORTS}
            selected={sort}
            hrefFor={(value) => tasksHref({ filter, sort: value, query })}
          />
        </div>
      </div>

      {/* A Client Component wrapping Server-rendered content: the rows
          inside can reach it to offer Undo after a delete. */}
      <UndoDeleteProvider>
        {tasks.length === 0 ? (
          <p className="text-zinc-600 dark:text-zinc-400">{emptyMessage}</p>
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
                priority={task.priority}
                notes={task.notes}
                repeat={task.repeat}
                completed={task.completed}
              />
            ))}
          </ul>
        )}
      </UndoDeleteProvider>

      {/* Counts every finished task, not just the ones on screen, because
          that's what the button deletes. */}
      {counts.completed > 0 && (
        <div className="flex justify-end">
          <ClearCompletedButton count={counts.completed} />
        </div>
      )}

      <KeyboardShortcuts />
    </section>
  );
}
