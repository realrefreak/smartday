// What "today" means for the user. The server runs in UTC, but the user might
// be in India, where the day starts 5½ hours earlier. The browser knows its
// time zone (e.g. "Asia/Kolkata") and saves it in a cookie (see
// app/tasks/TimeZoneCookie.js); the server reads it to work out the user's date.

export const TIME_ZONE_COOKIE = "tz";

// A cookie can contain anything, so check it's a real time zone. The easiest
// test: Intl throws a RangeError for a name it doesn't know. Anything wrong
// means UTC.
export function parseTimeZone(value) {
  if (typeof value !== "string" || value.length === 0 || value.length > 64) {
    return "UTC";
  }
  try {
    new Intl.DateTimeFormat("en", { timeZone: value });
    return value;
  } catch {
    return "UTC";
  }
}

// The calendar date as "YYYY-MM-DD" in the given time zone at the moment
// `now`. formatToParts hands back the year, month and day separately, so we
// don't depend on how a language happens to order them.
export function todayIn(timeZone, now = new Date()) {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const part = (type) => parts.find((p) => p.type === type).value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}
