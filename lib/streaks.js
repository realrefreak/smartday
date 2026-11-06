// Streaks: how many days in a row you've finished at least one task.
// Works on a list of "YYYY-MM-DD" days (from listCompletionDays), so no
// database or clock inside, and the tests can try any history.

import { addDays } from "@/lib/dashboard";

// days:  the days with at least one finished task, any order
// today: the user's date
// Returns:
//   current: the streak you're on now. Today counts once you finish
//            something; until then, a streak that ran up to yesterday is
//            still alive (you have the rest of today to keep it going).
//   best:    the longest run ever (in the history given)
//   doneToday
//   week:    the last 7 days, oldest first, as [{ date, done }]
export function streakStats(days, today) {
  const done = new Set(days);
  const doneToday = done.has(today);

  let current = 0;
  let day = doneToday ? today : addDays(today, -1);
  while (done.has(day)) {
    current += 1;
    day = addDays(day, -1);
  }

  // Walk the days in order; a day straight after the previous one extends
  // the run, anything else starts a new one.
  let best = 0;
  let run = 0;
  let previous = null;
  for (const date of [...done].sort()) {
    run = previous && addDays(previous, 1) === date ? run + 1 : 1;
    best = Math.max(best, run);
    previous = date;
  }

  const week = Array.from({ length: 7 }, (_, index) => {
    const date = addDays(today, index - 6);
    return { date, done: done.has(date) };
  });

  return { current, best, doneToday, week };
}
