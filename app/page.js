import { cookies } from "next/headers";
import { formatLongDate, greetingFor, hourIn, summarizeTasks } from "@/lib/dashboard";
import { getCurrentUser } from "@/lib/session";
import { streakStats } from "@/lib/streaks";
import { getTaskCounts, listCompletionDays, listTasks } from "@/lib/tasks";
import { TIME_ZONE_COOKIE, parseTimeZone, todayIn } from "@/lib/time-zone";
import Dashboard from "./_home/Dashboard";
import Landing from "./_home/Landing";
import TimeZoneCookie from "./tasks/TimeZoneCookie";

// One page, two faces: a dashboard for someone signed in, a landing page for
// everyone else. getCurrentUser() is cached per request, so the layout and
// this page share one session lookup.
//
// searchParams is a Promise in Next.js 16. "?account=deleted" is where
// deleting your account lands, so we can confirm it worked.
export default async function HomePage({ searchParams }) {
  const { account } = await searchParams;
  const user = await getCurrentUser();

  const notice = account === "deleted" && (
    <p role="status" className="mb-6 rounded bg-black/5 px-4 py-3 text-sm dark:bg-white/10">
      Your account and all of your tasks have been deleted.
    </p>
  );

  if (!user) {
    return (
      <>
        {notice}
        <Landing />
      </>
    );
  }

  // The user's own date and hour, from the time zone their browser saved.
  const savedTimeZone = (await cookies()).get(TIME_ZONE_COOKIE)?.value;
  const timeZone = parseTimeZone(savedTimeZone);
  const today = todayIn(timeZone);

  // Unfinished tasks (high priority first), the totals and the days you
  // finished something, all at the same time.
  const [activeTasks, counts, completionDays] = await Promise.all([
    listTasks(user.id, { filter: "active", sort: "priority" }),
    getTaskCounts(user.id),
    listCompletionDays(user.id, timeZone),
  ]);

  return (
    <>
      <TimeZoneCookie saved={savedTimeZone} />
      <Dashboard
        name={user.name ?? ""}
        greeting={greetingFor(hourIn(timeZone))}
        today={today}
        todayText={formatLongDate(today)}
        summary={summarizeTasks(activeTasks, today)}
        counts={counts}
        activeCount={activeTasks.length}
        streak={streakStats(completionDays, today)}
      />
    </>
  );
}
