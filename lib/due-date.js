// Turning a stored due date ("2026-11-15") into text for people ("15 Nov 2026").

// timeZone "UTC" matters: new Date("2026-11-15") means midnight UTC, and
// formatting it in a time zone behind UTC (like New York) would show 14 Nov.
// Using UTC for both reading and formatting means the day never shifts, so the
// server and the browser always produce the same text.
const formatter = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

export function formatDueDate(dueDate) {
  return formatter.format(new Date(dueDate));
}

// The calendar day of `date` as "YYYY-MM-DD", in the time zone of the computer
// running this code. In the browser that's the user's own time zone, which is
// what "today" should mean to them. (The server runs in UTC, so it would be
// wrong for anyone else.)
export function toLocalDateString(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// "overdue", "today" or "upcoming". Plain string comparison works because
// "YYYY-MM-DD" sorts in the same order as the dates themselves.
export function dueDateStatus(dueDate, today) {
  if (dueDate < today) return "overdue";
  if (dueDate === today) return "today";
  return "upcoming";
}
