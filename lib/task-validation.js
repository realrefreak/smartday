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
