// The weekly review page: a look back at the last 7 days and ahead at the
// next 7. Plain functions with no database or clock inside, like
// lib/dashboard.js, so the tests can hand them any history and any "today".

import { addDays } from "@/lib/dashboard";

// completions: [{ day: "YYYY-MM-DD", title }] (from listRecentCompletions,
//              covering at least the last 14 days)
// activeTasks: the unfinished tasks
// today:       the user's date
// Returns:
//   days:      the last 7 days, oldest first, as [{ date, count }]
//   thisWeek:  tasks finished in those 7 days
//   lastWeek:  tasks finished in the 7 days before that
//   best:      the day with the most finished, or null if none
//   finished:  what was finished this week, newest first
//   overdue:   unfinished tasks due before today, oldest first
//   comingUp:  unfinished tasks due today to 7 days from now, soonest first
export function weeklyReview({ completions, activeTasks, today }) {
  const weekStart = addDays(today, -6);
  const lastWeekStart = addDays(today, -13);

  const thisWeekDone = completions.filter((entry) => entry.day >= weekStart && entry.day <= today);
  const lastWeek = completions.filter((entry) => entry.day >= lastWeekStart && entry.day < weekStart).length;

  const days = [];
  for (let i = 0; i < 7; i += 1) {
    const date = addDays(weekStart, i);
    days.push({ date, count: thisWeekDone.filter((entry) => entry.day === date).length });
  }

  // The first of the busiest days wins a tie.
  const best = days.reduce((top, day) => (day.count > (top?.count ?? 0) ? day : top), null);

  const byDueDate = (a, b) => a.dueDate.localeCompare(b.dueDate);
  const overdue = activeTasks.filter((task) => task.dueDate && task.dueDate < today).sort(byDueDate);
  const weekAhead = addDays(today, 7);
  const comingUp = activeTasks
    .filter((task) => task.dueDate && task.dueDate >= today && task.dueDate <= weekAhead)
    .sort(byDueDate);

  return {
    days,
    thisWeek: thisWeekDone.length,
    lastWeek,
    best,
    finished: thisWeekDone,
    overdue,
    comingUp,
  };
}

// "3 more than last week", "1 fewer than last week" or "Same as last week".
export function compareWeeks(thisWeek, lastWeek) {
  const difference = thisWeek - lastWeek;
  if (difference === 0) return "Same as last week";
  return `${Math.abs(difference)} ${difference > 0 ? "more" : "fewer"} than last week`;
}
