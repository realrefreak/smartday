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
