// Smart quick add: "Call mum tomorrow #family !high" becomes the task
// "Call mum #family", due tomorrow, high priority.
//
// Only words at the END of the title are read, so a title that merely
// starts with or contains a date word ("Today show tickets", "Monday
// meeting notes") is left alone. #tags at the end stay in the title (that's
// where tags live) but are stepped over, so "Gym #health tomorrow" and
// "Gym tomorrow #health" both work.
//
// Pure functions: no clock or database inside, so tests can try any day.

import { addDays } from "@/lib/dashboard";

const PRIORITY_WORDS = {
  "!high": "high",
  "!h": "high",
  "!1": "high",
  "!medium": "medium",
  "!med": "medium",
  "!m": "medium",
  "!2": "medium",
  "!low": "low",
  "!l": "low",
  "!3": "low",
};

// Sunday = 0, like getUTCDay().
const WEEKDAYS = {
  sunday: 0, sun: 0,
  monday: 1, mon: 1,
  tuesday: 2, tue: 2, tues: 2,
  wednesday: 3, wed: 3,
  thursday: 4, thu: 4, thur: 4, thurs: 4,
  friday: 5, fri: 5,
  saturday: 6, sat: 6,
};

const MONTHS = {
  jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3, apr: 4, april: 4,
  may: 5, jun: 6, june: 6, jul: 7, july: 7, aug: 8, august: 8,
  sep: 9, sept: 9, september: 9, oct: 10, october: 10, nov: 11, november: 11, dec: 12, december: 12,
};

// Little words people put before a date: "Pay rent by friday".
const CONNECTORS = new Set(["on", "by", "due"]);

const pad = (number) => String(number).padStart(2, "0");

// "YYYY-MM-DD" for day/month, or null if that date doesn't exist (31 Feb).
function makeDate(year, month, day) {
  const date = `${year}-${pad(month)}-${pad(day)}`;
  return addDays(date, 0) === date ? date : null;
}

// "12 nov" or "nov 12": this year, or next year if it has already passed.
function dayAndMonth(day, monthWord, today) {
  const month = MONTHS[monthWord];
  const dayNumber = Number(day);
  if (!month || !Number.isInteger(dayNumber) || dayNumber < 1 || dayNumber > 31) return null;

  const year = Number(today.slice(0, 4));
  const thisYear = makeDate(year, month, dayNumber);
  if (thisYear && thisYear >= today) return thisYear;
  return makeDate(year + 1, month, dayNumber);
}

// The date a phrase means (all lower case), or null if it isn't one.
export function parseDatePhrase(phrase, today) {
  if (phrase === "today" || phrase === "tod") return today;
  if (phrase === "tomorrow" || phrase === "tmr" || phrase === "tmrw") return addDays(today, 1);
  if (phrase === "next week") return addDays(today, 7);
  if (phrase === "in a week") return addDays(today, 7);

  // A weekday means the next one, today included.
  if (phrase in WEEKDAYS) {
    const todayNumber = new Date(`${today}T00:00:00Z`).getUTCDay();
    return addDays(today, (WEEKDAYS[phrase] - todayNumber + 7) % 7);
  }

  let match = /^in (\d{1,3}) (day|days|week|weeks)$/.exec(phrase);
  if (match) {
    const amount = Number(match[1]);
    return addDays(today, match[2].startsWith("week") ? amount * 7 : amount);
  }

  match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(phrase);
  if (match) return makeDate(Number(match[1]), Number(match[2]), Number(match[3]));

  match = /^(\d{1,2}) ([a-z]+)$/.exec(phrase);
  if (match) return dayAndMonth(match[1], match[2], today);
  match = /^([a-z]+) (\d{1,2})$/.exec(phrase);
  if (match) return dayAndMonth(match[2], match[1], today);

  return null;
}

// Reads the end of `text` (what was typed as the title).
// Returns { title, dueDate, priority }: dueDate and priority are null when
// not given. If nothing was recognised, or nothing would be left of the
// title, the text comes back exactly as typed.
export function parseQuickAdd(text, today) {
  const unchanged = { title: text, dueDate: null, priority: null };
  if (typeof text !== "string") return unchanged;

  const words = text.trim().split(/\s+/);
  const tags = [];
  let end = words.length;
  let dueDate = null;
  let priority = null;

  // Walk backwards from the last word for as long as words are understood.
  while (end > 0) {
    const last = words[end - 1].toLowerCase();

    if (!priority && last in PRIORITY_WORDS) {
      priority = PRIORITY_WORDS[last];
      end -= 1;
      continue;
    }

    if (/^#\S+$/.test(last)) {
      tags.unshift(words[end - 1]);
      end -= 1;
      continue;
    }

    if (!dueDate) {
      // Try the longest phrase first: "in 3 days" before "days".
      const length = [3, 2, 1].find(
        (size) => size <= end && parseDatePhrase(words.slice(end - size, end).join(" ").toLowerCase(), today),
      );
      if (length) {
        dueDate = parseDatePhrase(words.slice(end - length, end).join(" ").toLowerCase(), today);
        end -= length;
        if (end > 0 && CONNECTORS.has(words[end - 1].toLowerCase())) end -= 1;
        continue;
      }
    }

    break;
  }

  if (!dueDate && !priority) return unchanged;

  const title = [...words.slice(0, end), ...tags].join(" ");
  // Only tags (or nothing) left: "tomorrow" alone is the task's title.
  if (words.slice(0, end).length === 0) return unchanged;

  return { title, dueDate, priority };
}
