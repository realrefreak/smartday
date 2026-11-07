import { cookies } from "next/headers";
import Link from "next/link";
import { formatMonth, monthGrid, parseDay, parseMonth, shiftMonth } from "@/lib/calendar";
import { formatLongDate } from "@/lib/dashboard";
import { formatDueDate } from "@/lib/due-date";
import { requireUser } from "@/lib/session";
import { listTasksDueBetween } from "@/lib/tasks";
import { TIME_ZONE_COOKIE, parseTimeZone, todayIn } from "@/lib/time-zone";
import AddTaskForm from "../tasks/AddTaskForm";
import TimeZoneCookie from "../tasks/TimeZoneCookie";

export const metadata = {
  title: "Calendar",
};

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MAX_PER_DAY = 3;

const priorityClasses = {
  high: "bg-rose-100 text-rose-900 dark:bg-rose-950 dark:text-rose-200",
  medium: "bg-amber-50 text-amber-900 dark:bg-amber-950/60 dark:text-amber-200",
  low: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
};

function taskClass(task, today) {
  if (task.completed) return "text-zinc-500 line-through";
  if (task.dueDate < today) return "bg-red-100 text-red-900 dark:bg-red-950 dark:text-red-200";
  return priorityClasses[task.priority] ?? priorityClasses.medium;
}

function DayCell({ day, tasks, today, month, picked }) {
  const dayNumber = Number(day.date.slice(8));
  const isToday = day.date === today;
  const isPicked = day.date === picked;
  const shown = tasks.slice(0, MAX_PER_DAY);
  const more = tasks.length - shown.length;

  return (
    <td
      className={`h-20 border border-black/10 p-1 align-top sm:h-28 dark:border-white/15 ${
        day.inMonth ? "" : "bg-black/[0.03] text-zinc-400 dark:bg-white/[0.03] dark:text-zinc-500"
      }`}
    >
      {/* The day number opens that day's panel, to see all its tasks or add
          one. aria-label says the full date, since "12" alone means little. */}
      <Link
        href={`/calendar?month=${month}&day=${day.date}`}
        aria-label={`${formatLongDate(day.date)}${tasks.length ? `, ${tasks.length} ${tasks.length === 1 ? "task" : "tasks"}` : ""}`}
        className={`inline-flex rounded-full hover:ring-2 hover:ring-black/20 dark:hover:ring-white/30 ${
          isPicked ? "ring-2 ring-foreground" : ""
        }`}
      >
        <time
          dateTime={day.date}
          aria-current={isToday ? "date" : undefined}
          className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs ${
            isToday ? "bg-foreground font-semibold text-background" : ""
          }`}
        >
          {dayNumber}
        </time>
      </Link>

      {tasks.length > 0 && (
        <>
          {/* Phones: too narrow for titles, so just say how many. */}
          <p className="text-xs text-zinc-600 sm:hidden dark:text-zinc-400">
            {tasks.length} {tasks.length === 1 ? "task" : "tasks"}
          </p>
          <ul className="mt-0.5 hidden space-y-0.5 sm:block">
            {shown.map((task) => (
              <li
                key={task.id}
                title={task.title}
                className={`truncate rounded px-1 text-xs ${taskClass(task, today)}`}
              >
                {task.title}
              </li>
            ))}
            {more > 0 && <li className="px-1 text-xs text-zinc-600 dark:text-zinc-400">+{more} more</li>}
          </ul>
        </>
      )}
    </td>
  );
}

// Everything due on the picked day, plus a form that adds a task due then.
function DayPanel({ day, tasks, month, today }) {
  return (
    <section
      aria-labelledby="day-panel-heading"
      className="space-y-3 rounded-lg border border-black/10 p-4 dark:border-white/15"
    >
      <div className="flex items-start justify-between gap-2">
        <h2 id="day-panel-heading" className="text-lg font-semibold">
          {formatLongDate(day)}
          {day === today && <span className="ml-2 text-sm font-normal text-zinc-600 dark:text-zinc-400">Today</span>}
        </h2>
        <Link href={`/calendar?month=${month}`} className="rounded px-2 py-1 text-sm hover:bg-black/5 dark:hover:bg-white/10">
          Close
        </Link>
      </div>

      {tasks.length === 0 ? (
        <p className="text-sm text-zinc-600 dark:text-zinc-400">Nothing due this day yet.</p>
      ) : (
        <ul className="space-y-1 text-sm">
          {tasks.map((task) => (
            <li key={task.id} className={`rounded px-2 py-1 ${taskClass(task, today)}`}>
              {task.title}
            </li>
          ))}
        </ul>
      )}

      {/* key: a fresh form for each day, so its date input shows the new day. */}
      <AddTaskForm key={day} defaultDueDate={day} />
    </section>
  );
}

// ?month=2026-11 picks the month; anything else shows this month.
// ?day=2026-11-12 (a day in the grid) opens that day's panel.
export default async function CalendarPage({ searchParams }) {
  const user = await requireUser();
  const params = await searchParams;

  const savedTimeZone = (await cookies()).get(TIME_ZONE_COOKIE)?.value;
  const today = todayIn(parseTimeZone(savedTimeZone));
  const month = parseMonth(params.month, today);
  const { weeks, from, to } = monthGrid(month);

  // Only the tasks due on the days shown, from one query.
  const tasks = await listTasksDueBetween(user.id, from, to);
  const picked = parseDay(params.day, from, to);
  const tasksByDay = Object.groupBy(tasks, (task) => task.dueDate);
  const monthTasks = tasks.filter((task) => task.dueDate.startsWith(month));

  const thisMonth = today.slice(0, 7);

  return (
    <section className="space-y-4">
      <TimeZoneCookie saved={savedTimeZone} />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-3xl font-semibold">{formatMonth(month)}</h1>
        {/* Each month is its own URL, so the back button and bookmarks work. */}
        <nav aria-label="Change month" className="flex gap-1 text-sm">
          <Link href={`/calendar?month=${shiftMonth(month, -1)}`} className="rounded px-3 py-1 hover:bg-black/5 dark:hover:bg-white/10">
            ← Previous
          </Link>
          {month !== thisMonth && (
            <Link href="/calendar" className="rounded px-3 py-1 hover:bg-black/5 dark:hover:bg-white/10">
              Today
            </Link>
          )}
          <Link href={`/calendar?month=${shiftMonth(month, 1)}`} className="rounded px-3 py-1 hover:bg-black/5 dark:hover:bg-white/10">
            Next →
          </Link>
        </nav>
      </div>

      {picked ? (
        <DayPanel day={picked} tasks={tasksByDay[picked] ?? []} month={month} today={today} />
      ) : (
        <p className="text-sm text-zinc-600 dark:text-zinc-400">Pick a day to see everything due then, or to add a task for it.</p>
      )}

      {/* A real <table>: a calendar is a grid of data, and table markup lets
          screen readers announce "Wednesday" with each day. */}
      <table className="w-full table-fixed border-collapse">
        <caption className="sr-only">Tasks due in {formatMonth(month)}</caption>
        <thead>
          <tr>
            {WEEKDAYS.map((weekday) => (
              <th key={weekday} scope="col" className="pb-1 text-xs font-medium text-zinc-600 dark:text-zinc-400">
                {weekday}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {weeks.map((week) => (
            <tr key={week[0].date}>
              {week.map((day) => (
                <DayCell
                  key={day.date}
                  day={day}
                  tasks={tasksByDay[day.date] ?? []}
                  today={today}
                  month={month}
                  picked={picked}
                />
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      {/* On phones the grid has no room for titles, so list them below. */}
      <section aria-labelledby="month-list-heading" className="space-y-2 sm:hidden">
        <h2 id="month-list-heading" className="font-semibold">
          Due this month
        </h2>
        {monthTasks.length === 0 ? (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">Nothing due this month.</p>
        ) : (
          <ul className="divide-y divide-black/10 text-sm dark:divide-white/15">
            {monthTasks.map((task) => (
              <li key={task.id} className="flex justify-between gap-3 py-2">
                <span className={task.completed ? "text-zinc-500 line-through" : ""}>{task.title}</span>
                <time dateTime={task.dueDate} className="shrink-0 text-zinc-600 dark:text-zinc-400">
                  {formatDueDate(task.dueDate)}
                </time>
              </li>
            ))}
          </ul>
        )}
      </section>

      {tasks.length === 0 && (
        <p className="hidden text-sm text-zinc-600 sm:block dark:text-zinc-400">
          No tasks due in these weeks. Give a task a due date on the{" "}
          <Link href="/tasks" className="underline">
            Tasks page
          </Link>{" "}
          and it shows up here.
        </p>
      )}
    </section>
  );
}
