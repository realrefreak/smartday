// The parts of notifications ("web push") that need no network or database:
// checking a subscription the browser sent, and wording the daily reminder.

// Browsers only hand out https endpoints, at most a few hundred characters.
const MAX_ENDPOINT_LENGTH = 1000;
// The two keys are base64url text: letters, digits, "-" and "_".
const KEY_PATTERN = /^[A-Za-z0-9_-]{8,200}={0,2}$/;

// A subscription as the browser gives it (subscription.toJSON()):
//   { endpoint: "https://...", keys: { p256dh: "...", auth: "..." } }
// Server Actions can be called with anything, so check every part.
export function validateSubscription(input) {
  const invalid = { ok: false, error: "This browser sent a subscription we can't use." };
  if (!input || typeof input !== "object") return invalid;

  const { endpoint, keys } = input;
  if (typeof endpoint !== "string" || endpoint.length > MAX_ENDPOINT_LENGTH) return invalid;
  let url;
  try {
    url = new URL(endpoint);
  } catch {
    return invalid;
  }
  if (url.protocol !== "https:") return invalid;

  if (!keys || typeof keys !== "object") return invalid;
  const { p256dh, auth } = keys;
  if (typeof p256dh !== "string" || !KEY_PATTERN.test(p256dh)) return invalid;
  if (typeof auth !== "string" || !KEY_PATTERN.test(auth)) return invalid;

  return { ok: true, endpoint, p256dh, auth };
}

// Notifications are short: show this many titles, then "and 2 more".
const MAX_TITLES = 3;

// The daily reminder for these tasks (overdue or due today):
//   { title: "3 tasks for today", body: "1 overdue · Pay rent, ...", url }
export function buildReminderNotification({ tasks, today }) {
  const overdue = tasks.filter((task) => task.dueDate && task.dueDate < today).length;
  const count = `${tasks.length} ${tasks.length === 1 ? "task" : "tasks"}`;

  const titles = tasks.slice(0, MAX_TITLES).map((task) => task.title);
  const more = tasks.length - titles.length;
  const list = titles.join(", ") + (more > 0 ? ` and ${more} more` : "");

  return {
    title: `${count} for today`,
    body: overdue > 0 ? `${overdue} overdue · ${list}` : list,
    // Tapping the notification opens the Today view.
    url: "/tasks?show=today",
  };
}
