// Rules for a task title, kept in one place so the server action, the form and
// the tests all agree.

export const TITLE_MAX_LENGTH = 100;

// Returns { ok: true, title } with the cleaned-up title,
// or { ok: false, error } with a message that is safe to show the user.
export function validateTaskTitle(value) {
  // FormData values can be a File or missing entirely, not just a string.
  if (typeof value !== "string") {
    return { ok: false, error: "Please enter a task title." };
  }

  const title = value.trim();

  if (title.length === 0) {
    return { ok: false, error: "Please enter a task title." };
  }

  if (title.length > TITLE_MAX_LENGTH) {
    return {
      ok: false,
      error: `Task title must be ${TITLE_MAX_LENGTH} characters or fewer.`,
    };
  }

  // \p{Cc} = invisible control characters (e.g. null bytes, line breaks).
  if (/\p{Cc}/u.test(title)) {
    return { ok: false, error: "Task title contains invalid characters." };
  }

  return { ok: true, title };
}

// Due dates are optional, but if one is given it must be a real calendar day
// in the form the browser's date picker sends: "YYYY-MM-DD".
const DUE_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
export const DUE_DATE_MIN_YEAR = 2000;
export const DUE_DATE_MAX_YEAR = 2100;

// Returns { ok: true, dueDate } where dueDate is "YYYY-MM-DD" or null (no date),
// or { ok: false, error } with a message that is safe to show the user.
export function validateDueDate(value) {
  // Left empty, or not sent at all: the task has no due date.
  if (value === null || value === undefined || value === "") {
    return { ok: true, dueDate: null };
  }

  const invalid = { ok: false, error: "Please enter a valid due date." };

  if (typeof value !== "string") {
    return invalid;
  }

  const match = DUE_DATE_PATTERN.exec(value.trim());
  if (!match) {
    return invalid;
  }

  const [, yearText, monthText, dayText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);

  // The pattern allows "2026-02-30". Build the date and check nothing rolled
  // over (JavaScript would quietly turn 30 Feb into 2 Mar). UTC keeps the
  // server's own time zone out of it.
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    return invalid;
  }

  // Catches typos like year 0202 or 20266 that the date picker can let through.
  if (year < DUE_DATE_MIN_YEAR || year > DUE_DATE_MAX_YEAR) {
    return {
      ok: false,
      error: `Please choose a date between ${DUE_DATE_MIN_YEAR} and ${DUE_DATE_MAX_YEAR}.`,
    };
  }

  return { ok: true, dueDate: `${yearText}-${monthText}-${dayText}` };
}

// Every task has a priority. Listed from most to least urgent: sorting by
// priority uses this order.
export const PRIORITIES = [
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
];
export const DEFAULT_PRIORITY = "medium";
const PRIORITY_VALUES = new Set(PRIORITIES.map((priority) => priority.value));

// Returns { ok: true, priority } or { ok: false, error }.
// Not sent at all (e.g. an old form, or a script) means the default.
export function validatePriority(value) {
  if (value === null || value === undefined || value === "") {
    return { ok: true, priority: DEFAULT_PRIORITY };
  }

  if (typeof value !== "string" || !PRIORITY_VALUES.has(value)) {
    return { ok: false, error: "Please choose High, Medium or Low priority." };
  }

  return { ok: true, priority: value };
}

export const NOTES_MAX_LENGTH = 1000;

// Notes are optional, longer text that can span several lines.
// Returns { ok: true, notes } where notes is the cleaned text or null (none),
// or { ok: false, error }.
export function validateNotes(value) {
  if (value === null || value === undefined) {
    return { ok: true, notes: null };
  }

  if (typeof value !== "string") {
    return { ok: false, error: "Notes must be text." };
  }

  // Browsers send line breaks in a textarea as "\r\n"; store plain "\n".
  const notes = value.replace(/\r\n?/g, "\n").trim();

  if (notes.length === 0) {
    return { ok: true, notes: null };
  }

  if (notes.length > NOTES_MAX_LENGTH) {
    return { ok: false, error: `Notes must be ${NOTES_MAX_LENGTH} characters or fewer.` };
  }

  // Same invisible-character rule as titles, except that notes may contain
  // line breaks and tabs.
  if (/\p{Cc}/u.test(notes.replace(/[\n\t]/g, ""))) {
    return { ok: false, error: "Notes contain invalid characters." };
  }

  return { ok: true, notes };
}

// A task's checklist ("subtasks"): short steps you tick off one by one.
// Capped, so one task can't grow without limit.
export const SUBTASKS_MAX = 20;

// Same rules as a task title, with messages that talk about checklist items.
// Returns { ok: true, title } or { ok: false, error }.
export function validateSubtaskTitle(value) {
  const result = validateTaskTitle(value);
  if (result.ok) {
    return result;
  }

  const messages = {
    "Please enter a task title.": "Please enter a checklist item.",
    "Task title contains invalid characters.": "Checklist item contains invalid characters.",
  };
  return {
    ok: false,
    error: messages[result.error] ?? `Checklist items must be ${TITLE_MAX_LENGTH} characters or fewer.`,
  };
}

// How often a task comes back. null means it doesn't repeat.
export const REPEATS = [
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
];
const REPEAT_VALUES = new Set(REPEATS.map((repeat) => repeat.value));

// Returns { ok: true, repeat } (a value above, or null for "doesn't repeat")
// or { ok: false, error }. A repeating task needs a due date to move forward
// from, so pass the already-validated due date too.
export function validateRepeat(value, dueDate) {
  if (value === null || value === undefined || value === "") {
    return { ok: true, repeat: null };
  }

  if (typeof value !== "string" || !REPEAT_VALUES.has(value)) {
    return { ok: false, error: "Please choose how often the task repeats." };
  }

  if (!dueDate) {
    return { ok: false, error: "A repeating task needs a due date." };
  }

  return { ok: true, repeat: value };
}
