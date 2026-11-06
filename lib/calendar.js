// The month grid for the /calendar page. Months are "YYYY-MM" strings (they
// go in the URL as ?month=2026-11), days are "YYYY-MM-DD". All the date maths
// is done in UTC so no time zone can move a day.

import { addDays } from "@/lib/dashboard";

const MONTH_PATTERN = /^(\d{4})-(\d{2})$/;

// The month from the URL, or the month containing `today` if it's missing or
// nonsense (?month=banana, ?month=2026-13, an array...).
export function parseMonth(value, today) {
  const match = typeof value === "string" ? MONTH_PATTERN.exec(value) : null;
  if (match) {
    const year = Number(match[1]);
    const month = Number(match[2]);
    if (year >= 2000 && year <= 2100 && month >= 1 && month <= 12) {
      return value;
    }
  }
  return today.slice(0, 7);
}

// The month before (-1) or after (+1).
export function shiftMonth(month, by) {
  const [year, number] = month.split("-").map(Number);
  const date = new Date(Date.UTC(year, number - 1 + by, 1));
  return date.toISOString().slice(0, 7);
}

const monthName = new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });

// "November 2026"
export function formatMonth(month) {
  return monthName.format(new Date(`${month}-01T00:00:00Z`));
}

// The weeks to draw, Monday to Sunday, covering the whole month. Days from
// the months either side fill the first and last week, marked inMonth: false.
//   [[{ date: "2026-10-26", inMonth: false }, ...7 days], ...4 to 6 weeks]
// Also returns the first and last date shown, for the database query.
export function monthGrid(month) {
  const first = `${month}-01`;
  // getUTCDay(): Sunday = 0 ... Saturday = 6. Turn that into "days since Monday".
  const sinceMonday = (new Date(`${first}T00:00:00Z`).getUTCDay() + 6) % 7;
  const start = addDays(first, -sinceMonday);
  const nextMonth = `${shiftMonth(month, 1)}-01`;

  const weeks = [];
  let day = start;
  // Keep adding whole weeks until the month is covered.
  while (day < nextMonth) {
    const week = [];
    for (let i = 0; i < 7; i += 1) {
      week.push({ date: day, inMonth: day.startsWith(month) });
      day = addDays(day, 1);
    }
    weeks.push(week);
  }

  return { weeks, from: start, to: addDays(day, -1) };
}
