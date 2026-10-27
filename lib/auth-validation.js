// Input rules for the sign-up and sign-in forms. Checked on the server before
// anything is sent to Better Auth. Each returns { ok: true, data } or { ok: false, error }.

export const NAME_MAX_LENGTH = 50;
export const PASSWORD_MIN_LENGTH = 8; // must match minPasswordLength in lib/auth.js
export const PASSWORD_MAX_LENGTH = 128;

// Deliberately simple: "something@something.something" with no spaces.
// The only real proof an email works is sending a message to it.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function cleanEmail(value) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

export function validateSignUp({ name, email, password }) {
  const cleanName = typeof name === "string" ? name.trim() : "";
  const cleanedEmail = cleanEmail(email);

  if (!cleanName) {
    return { ok: false, error: "Please enter your name." };
  }
  if (cleanName.length > NAME_MAX_LENGTH || /\p{Cc}/u.test(cleanName)) {
    return { ok: false, error: `Name must be ${NAME_MAX_LENGTH} characters or fewer.` };
  }
  if (!EMAIL_PATTERN.test(cleanedEmail) || cleanedEmail.length > 254) {
    return { ok: false, error: "Please enter a valid email address." };
  }
  // Passwords are NOT trimmed: spaces are allowed and count.
  if (typeof password !== "string" || password.length < PASSWORD_MIN_LENGTH) {
    return { ok: false, error: `Password must be at least ${PASSWORD_MIN_LENGTH} characters.` };
  }
  if (password.length > PASSWORD_MAX_LENGTH) {
    return { ok: false, error: `Password must be ${PASSWORD_MAX_LENGTH} characters or fewer.` };
  }

  return { ok: true, data: { name: cleanName, email: cleanedEmail, password } };
}

export function validateSignIn({ email, password }) {
  const cleanedEmail = cleanEmail(email);

  if (!EMAIL_PATTERN.test(cleanedEmail)) {
    return { ok: false, error: "Please enter a valid email address." };
  }
  if (typeof password !== "string" || password.length === 0) {
    return { ok: false, error: "Please enter your password." };
  }

  return { ok: true, data: { email: cleanedEmail, password } };
}
