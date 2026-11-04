"use client";
// Shows "Due 15 Nov 2026", plus an "Overdue" or "Today" label.
//
// Why a Client Component: only the browser knows the user's time zone, so
// only the browser can say what "today" is. The server runs in UTC: at 00:30
// in India it still thinks it's yesterday.

import { useSyncExternalStore } from "react";
import { dueDateStatus, formatDueDate, toLocalDateString } from "@/lib/due-date";
import { REPEATS } from "@/lib/task-validation";

// useSyncExternalStore reads a value from outside React (here: the clock).
// It takes three functions:
//   subscribe         - how to hear about changes: re-check once a minute,
//                       so a page left open overnight notices midnight
//   getSnapshot       - the value in the browser: today's date there
//   getServerSnapshot - the value on the server, and during hydration: null,
//                       meaning "don't know yet"
// Because the server and the browser's first render both use null, their HTML
// matches (no hydration mismatch). React then re-renders with the real date.
function subscribe(onChange) {
  const timer = setInterval(onChange, 60_000);
  return () => clearInterval(timer);
}

function getToday() {
  return toLocalDateString(new Date());
}

function getServerToday() {
  return null;
}

const labels = {
  overdue: { text: "Overdue", className: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300" },
  today: { text: "Today", className: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300" },
};

export default function DueDate({ dueDate, repeat, completed }) {
  const today = useSyncExternalStore(subscribe, getToday, getServerToday);

  // No label until we know today's date, and never for finished tasks.
  const label = today && !completed ? labels[dueDateStatus(dueDate, today)] : undefined;

  return (
    <p className="text-sm text-zinc-600 dark:text-zinc-400">
      {/* <time dateTime> gives the exact date to machines (screen readers,
          search engines) alongside the friendly text. */}
      Due <time dateTime={dueDate}>{formatDueDate(dueDate)}</time>
      {repeat && <> · Repeats {REPEATS.find((r) => r.value === repeat)?.label.toLowerCase()}</>}
      {label && (
        <span className={`ml-2 rounded px-1.5 py-0.5 text-xs font-medium ${label.className}`}>
          {label.text}
        </span>
      )}
    </p>
  );
}
