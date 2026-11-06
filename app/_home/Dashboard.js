// The home page for someone signed in: their day at a glance.
// A Server Component: it reads the database directly and sends plain HTML,
// with no JavaScript needed in the browser for any of it.
//
// (The "_" in the folder name makes it a "private folder": Next.js never
// turns anything in it into a page, so it's a safe place for components.)

import Link from "next/link";
import { formatDueDate } from "@/lib/due-date";
import { splitTags } from "@/lib/tags";
import { tasksHref } from "@/lib/task-filter";
import TaskProgress from "../tasks/TaskProgress";

const cardClass = "rounded-lg border border-black/10 p-4 dark:border-white/15";
const mutedClass = "text-zinc-600 dark:text-zinc-400";

const priorityDots = {
  high: { className: "bg-rose-500", label: "High priority" },
  medium: { className: "bg-amber-400", label: "Medium priority" },
  low: { className: "bg-zinc-400", label: "Low priority" },
};

// One number with a label, linking to the tasks it counts.
function StatCard({ label, value, href, tone = "" }) {
  return (
    <Link href={href} className={`${cardClass} block hover:bg-black/5 dark:hover:bg-white/5`}>
      <span className={`block text-3xl font-semibold ${value > 0 ? tone : ""}`}>{value}</span>
      <span className={`text-sm ${mutedClass}`}>{label}</span>
    </Link>
  );
}

// A title with its #tags as links, like on the Tasks page.
function TaskTitle({ title }) {
  return splitTags(title).map((part, index) =>
    part.tag ? (
      <Link
        key={index}
        href={tasksHref({ query: part.tag })}
        className="rounded bg-sky-100 px-1 text-sky-800 hover:underline dark:bg-sky-950 dark:text-sky-300"
      >
        {part.tag}
      </Link>
    ) : (
      part.text
    ),
  );
}

function TaskLine({ task, today }) {
  const dot = priorityDots[task.priority] ?? priorityDots.medium;
  const overdue = task.dueDate < today;

  return (
    <li className="flex items-start gap-3 py-2">
      {/* The colour is for eyes; the title attribute and sr-only text say it in words. */}
      <span className={`mt-2 h-2 w-2 shrink-0 rounded-full ${dot.className}`} title={dot.label}>
        <span className="sr-only">{dot.label}</span>
      </span>
      <span className="min-w-0 flex-1 break-words">
        <TaskTitle title={task.title} />
      </span>
      <time
        dateTime={task.dueDate}
        className={`shrink-0 text-sm ${overdue ? "text-red-700 dark:text-red-400" : mutedClass}`}
      >
        {task.dueDate === today ? "Today" : formatDueDate(task.dueDate)}
      </time>
    </li>
  );
}

// A titled list of tasks, with "and N more" linking to the full list.
function TaskPanel({ id, title, tasks, more, moreHref, empty, today }) {
  return (
    <section aria-labelledby={id} className={cardClass}>
      <h2 id={id} className="font-semibold">
        {title}
      </h2>
      {tasks.length === 0 ? (
        <p className={`mt-2 text-sm ${mutedClass}`}>{empty}</p>
      ) : (
        <ul className="mt-1 divide-y divide-black/5 dark:divide-white/10">
          {tasks.map((task) => (
            <TaskLine key={task.id} task={task} today={today} />
          ))}
        </ul>
      )}
      {more > 0 && (
        <Link href={moreHref} className="mt-2 inline-block text-sm hover:underline">
          and {more} more
        </Link>
      )}
    </section>
  );
}

// For a brand-new account: what to try first.
function GettingStarted() {
  const tips = [
    ["Add a task", "with a due date and a priority."],
    ["Tag it", "by typing a word like #work or #home in the title."],
    ["Make it repeat", "daily, weekly or monthly, for chores and habits."],
    ["Add a checklist", "to break a big task into small steps."],
  ];

  return (
    <section className={`${cardClass} space-y-3`}>
      <h2 className="font-semibold">Get started</h2>
      <ol className="list-inside list-decimal space-y-1 text-sm">
        {tips.map(([strong, rest]) => (
          <li key={strong}>
            <strong className="font-medium">{strong}</strong> {rest}
          </li>
        ))}
      </ol>
      <Link
        href="/tasks"
        className="inline-block rounded bg-foreground px-4 py-2 text-sm text-background"
      >
        Add your first task
      </Link>
    </section>
  );
}

export default function Dashboard({ name, greeting, today, todayText, summary, counts, activeCount }) {
  const firstName = name.trim().split(/\s+/)[0];

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className={`text-sm ${mutedClass}`}>{todayText}</p>
          <h1 className="text-3xl font-semibold">
            {greeting}
            {firstName ? `, ${firstName}` : ""}
          </h1>
        </div>
        <Link
          href="/tasks"
          className="rounded bg-foreground px-4 py-2 text-sm text-background"
        >
          Open my tasks
        </Link>
      </div>

      {counts.total === 0 ? (
        <GettingStarted />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard
              label="Overdue"
              value={summary.overdueCount}
              href={tasksHref({ filter: "today" })}
              tone="text-red-700 dark:text-red-400"
            />
            <StatCard
              label="Due today"
              value={summary.dueTodayCount}
              href={tasksHref({ filter: "today" })}
              tone="text-amber-700 dark:text-amber-400"
            />
            <StatCard label="Next 7 days" value={summary.upcomingCount} href={tasksHref({ filter: "active" })} />
            <StatCard label="Still to do" value={activeCount} href={tasksHref({ filter: "active" })} />
          </div>

          <TaskProgress total={counts.total} completed={counts.completed} />

          <div className="grid gap-4 md:grid-cols-2">
            <TaskPanel
              id="focus-heading"
              title="Today's focus"
              tasks={summary.focus}
              more={summary.moreFocus}
              moreHref={tasksHref({ filter: "today" })}
              empty="Nothing due today. Enjoy!"
              today={today}
            />
            <TaskPanel
              id="upcoming-heading"
              title="Coming up"
              tasks={summary.upcoming}
              more={summary.moreUpcoming}
              moreHref={tasksHref({ filter: "active" })}
              empty="Nothing due in the next 7 days."
              today={today}
            />
          </div>

          {summary.tags.length > 0 && (
            <section aria-labelledby="tags-heading" className="space-y-2">
              <h2 id="tags-heading" className="font-semibold">
                Your tags
              </h2>
              <ul className="flex flex-wrap gap-2">
                {summary.tags.map(({ tag, count }) => (
                  <li key={tag}>
                    <Link
                      href={tasksHref({ query: tag })}
                      className="inline-flex items-center gap-1.5 rounded-full bg-sky-100 px-3 py-1 text-sm text-sky-800 hover:underline dark:bg-sky-950 dark:text-sky-300"
                    >
                      {tag}
                      <span className="text-xs opacity-75">{count}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  );
}
