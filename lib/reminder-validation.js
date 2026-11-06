// Checking the reminder settings form. Kept apart from lib/reminders.js
// (which talks to the database) so the tests can try it on its own.

import { parseTimeZone } from "@/lib/time-zone";

// Returns { ok: true, enabled, hour, timeZone } or { ok: false, error }.
//   enabled:  a checkbox sends "on" when ticked and nothing at all when not
//   hour:     "0" to "23"
//   timeZone: sent by the browser; anything unknown becomes UTC
export function validateReminderSettings({ enabled, hour, timeZone }) {
  const hourText = typeof hour === "string" ? hour.trim() : "";
  const hourNumber = Number(hourText);

  if (!/^\d{1,2}$/.test(hourText) || hourNumber > 23) {
    return { ok: false, error: "Please pick a time for the reminder." };
  }

  return {
    ok: true,
    enabled: enabled === "on",
    hour: hourNumber,
    timeZone: parseTimeZone(timeZone),
  };
}

// "8:00", "13:00": how the hours are shown in the drop-down.
export function formatHour(hour) {
  return `${hour}:00`;
}
