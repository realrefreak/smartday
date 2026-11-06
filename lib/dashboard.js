// What the home page dashboard shows, worked out from the user's unfinished
// tasks. Plain functions with no database or clock inside, so the tests can
// hand them any tasks and any "today".

import { splitTags } from "@/lib/tags";

// "YYYY-MM-DD" plus `days` days. Done in UTC so no time zone can shift the day
// (the same trick as lib/due-date.js).
export function addDays(date, days) {
  const result = new Date(`${date}T00:00:00Z`);
  result.setUTCDate(result.getUTCDate() + days);
  return result.toISOString().slice(0, 10);
}

// The hour (0-23) right now in the user's time zone.
export function hourIn(timeZone, now = new Date()) {
  const hour = new Intl.DateTimeFormat("en", {
    timeZone,
    hour: "numeric",
    hourCycle: "h23",
  }).format(now);
  return Number(hour);
}

export function greetingFor(hour) {
  if (hour < 5) return "Working late";
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

// "Friday, 6 November" for a "YYYY-MM-DD" date.
const longDate = new Intl.DateTimeFormat("en-GB", {
  weekday: "long",
  day: "numeric",
  month: "long",
  timeZone: "UTC",
});

export function formatLongDate(date) {
  return longDate.format(new Date(date));
}

// Counts the #tags across the given tasks, most used first (ties in A-Z
// order). Tags match whatever the case (#Work and #work are the same tag, as
// in search), and are shown the way they were first written.
export function countTags(tasks, limit = 10) {
  const counts = new Map();
  for (const task of tasks) {
    // A tag written twice in one title still counts that task once.
    const seen = new Set();
    for (const part of splitTags(task.title)) {
      if (!part.tag) continue;
      const key = part.tag.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      const entry = counts.get(key) ?? { tag: part.tag, count: 0 };
      entry.count += 1;
      counts.set(key, entry);
    }
  }

  return [...counts.values()]
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag))
    .slice(0, limit);
}

// Sorts out the user's unfinished tasks for the dashboard.
//   activeTasks: not completed, already in priority order
//   today:       the user's date, "YYYY-MM-DD"
// Returns the counts for the stat cards, plus short lists:
//   focus:    overdue or due today (priority order kept)
//   upcoming: due in the next `days` days, soonest first
export function summarizeTasks(activeTasks, today, { days = 7, limit = 5 } = {}) {
  const lastDay = addDays(today, days);

  const overdue = activeTasks.filter((task) => task.dueDate && task.dueDate < today);
  const dueToday = activeTasks.filter((task) => task.dueDate === today);
  const focus = activeTasks.filter((task) => task.dueDate && task.dueDate <= today);
  const upcoming = activeTasks
    .filter((task) => task.dueDate && task.dueDate > today && task.dueDate <= lastDay)
    // toSorted() returns a sorted copy and leaves the original alone.
    .toSorted((a, b) => a.dueDate.localeCompare(b.dueDate));

  return {
    overdueCount: overdue.length,
    dueTodayCount: dueToday.length,
    upcomingCount: upcoming.length,
    focus: focus.slice(0, limit),
    moreFocus: Math.max(0, focus.length - limit),
    upcoming: upcoming.slice(0, limit),
    moreUpcoming: Math.max(0, upcoming.length - limit),
    tags: countTags(activeTasks),
  };
}
