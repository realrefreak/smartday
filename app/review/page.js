import { cookies } from "next/headers";
import Link from "next/link";
import { formatLongDate } from "@/lib/dashboard";
import { formatDueDate } from "@/lib/due-date";
import { compareWeeks, weeklyReview } from "@/lib/review";
import { requireUser } from "@/lib/session";
import { listRecentCompletions, listTasks } from "@/lib/tasks";
import { TIME_ZONE_COOKIE, parseTimeZone, todayIn } from "@/lib/time-zone";
import TimeZoneCookie from "../tasks/TimeZoneCookie";

export const metadata = {
  title: "Weekly review",
};

const weekday = new Intl.DateTimeFormat("en-GB", { weekday: "short", timeZone: "UTC" });
const shortDay = (date) => weekday.format(new Date(`${date}T00:00:00Z`));

const muted = "text-zinc-600 dark:text-zinc-400";
const card = "space-y-3 rounded-lg border border-black/10 p-4 dark:border-white/15";

// One bar per day. The bars are only a picture (aria-hidden); each day's
// text says the same thing for screen readers and anyone who can't see them.
function WeekChart({ days, today }) {
  const most = Math.max(1, ...days.map((day) => day.count));

  return (
    <ol className="flex h-40 items-end gap-2">
      {days.map((day) => (
        <li key={day.date} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
          <span className="text-xs font-medium">{day.count}</span>
          <div
            aria-hidden="true"
            style={{ height: `${(day.count / most) * 100}%` }}
            className={`w-full min-h-1 rounded-t ${day.count ? "bg-emerald-600 dark:bg-emerald-500" : "bg-black/10 dark:bg-white/15"}`}
          />
          <span className={`text-xs ${day.date === today ? "font-semibold" : muted}`}>
            <span aria-hidden="true">{shortDay(day.date)}</span>
            <span className="sr-only">
              {formatLongDate(day.date)}: {day.count} {day.count === 1 ? "task" : "tasks"} finished
            </span>
          </span>
        </li>
      ))}
    </ol>
  );
}

function TaskList({ id, title, tasks, empty, today }) {
  return (
    <section aria-labelledby={id} className={card}>
      <h2 id={id} className="font-semibold">
        {title} <span className={`font-normal ${muted}`}>({tasks.length})</span>
      </h2>
      {tasks.length === 0 ? (
        <p className={`text-sm ${muted}`}>{empty}</p>
      ) : (
        <ul className="divide-y divide-black/10 text-sm dark:divide-white/15">
          {tasks.map((task) => (
            <li key={task.id} className="flex justify-between gap-3 py-2">
              <span>{task.title}</span>
              <time dateTime={task.dueDate} className={`shrink-0 ${task.dueDate < today ? "text-red-700 dark:text-red-400" : muted}`}>
                {formatDueDate(task.dueDate)}
              </time>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default async function ReviewPage() {
  const user = await requireUser();

  const savedTimeZone = (await cookies()).get(TIME_ZONE_COOKIE)?.value;
  const timeZone = parseTimeZone(savedTimeZone);
  const today = todayIn(timeZone);

  const [completions, activeTasks] = await Promise.all([
    listRecentCompletions(user.id, timeZone),
    listTasks(user.id, { filter: "active" }),
  ]);
  const review = weeklyReview({ completions, activeTasks, today });

  return (
    <section className="space-y-6">
      <TimeZoneCookie saved={savedTimeZone} />

      <div>
        <h1 className="text-3xl font-semibold">Your week</h1>
        <p className={`mt-1 ${muted}`}>
          {formatLongDate(review.days[0].date)} to {formatLongDate(today)}
        </p>
      </div>

      <section aria-labelledby="finished-heading" className={card}>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="finished-heading" className="text-2xl font-semibold">
            {review.thisWeek} {review.thisWeek === 1 ? "task" : "tasks"} finished
          </h2>
          <p className={`text-sm ${muted}`}>{compareWeeks(review.thisWeek, review.lastWeek)}</p>
        </div>
        <WeekChart days={review.days} today={today} />
        {review.best && (
          <p className={`text-sm ${muted}`}>
            Best day: {formatLongDate(review.best.date)}, with {review.best.count}.
          </p>
        )}
      </section>

      <section aria-labelledby="done-list-heading" className={card}>
        <h2 id="done-list-heading" className="font-semibold">
          What you finished
        </h2>
        {review.finished.length === 0 ? (
          <p className={`text-sm ${muted}`}>
            Nothing finished in the last 7 days yet. Tick off a task on the{" "}
            <Link href="/tasks" className="underline">
              Tasks page
            </Link>{" "}
            and it shows up here.
          </p>
        ) : (
          <ul className="divide-y divide-black/10 text-sm dark:divide-white/15">
            {review.finished.map((entry, index) => (
              <li key={index} className="flex justify-between gap-3 py-2">
                <span className={entry.title ? "" : `italic ${muted}`}>{entry.title ?? "A task you've since deleted"}</span>
                <span className={`shrink-0 ${muted}`}>{shortDay(entry.day)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="grid gap-6 sm:grid-cols-2">
        <TaskList
          id="overdue-heading"
          title="Still overdue"
          tasks={review.overdue}
          empty="Nothing overdue. Well done."
          today={today}
        />
        <TaskList
          id="ahead-heading"
          title="Next 7 days"
          tasks={review.comingUp}
          empty="Nothing due in the next 7 days."
          today={today}
        />
      </div>
    </section>
  );
}
