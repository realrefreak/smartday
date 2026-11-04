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

// Shared by sign-up and the Account page. Returns { ok, name } or { ok, error }.
export function validateName(name) {
  const cleanName = typeof name === "string" ? name.trim() : "";

  if (!cleanName) {
    return { ok: false, error: "Please enter your name." };
  }
  if (cleanName.length > NAME_MAX_LENGTH || /\p{Cc}/u.test(cleanName)) {
    return { ok: false, error: `Name must be ${NAME_MAX_LENGTH} characters or fewer.` };
  }

  return { ok: true, name: cleanName };
}

// Shared rule for any new password.
function checkNewPassword(password) {
  // Passwords are NOT trimmed: spaces are allowed and count.
  if (typeof password !== "string" || password.length < PASSWORD_MIN_LENGTH) {
    return `Password must be at least ${PASSWORD_MIN_LENGTH} characters.`;
  }
  if (password.length > PASSWORD_MAX_LENGTH) {
    return `Password must be ${PASSWORD_MAX_LENGTH} characters or fewer.`;
  }
  return "";
}

export function validateSignUp({ name, email, password }) {
  const nameResult = validateName(name);
  const cleanedEmail = cleanEmail(email);

  if (!nameResult.ok) {
    return nameResult;
  }
  const cleanName = nameResult.name;
  if (!EMAIL_PATTERN.test(cleanedEmail) || cleanedEmail.length > 254) {
    return { ok: false, error: "Please enter a valid email address." };
  }
  const passwordError = checkNewPassword(password);
  if (passwordError) {
    return { ok: false, error: passwordError };
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

// Changing your password: the current one (to prove it's you), then the new
// one twice (to catch typos, since password boxes hide what you type).
// Errors say which field they're about, for the form.
export function validatePasswordChange({ currentPassword, newPassword, confirmPassword }) {
  if (typeof currentPassword !== "string" || currentPassword.length === 0) {
    return { ok: false, field: "currentPassword", error: "Please enter your current password." };
  }

  const passwordError = checkNewPassword(newPassword);
  if (passwordError) {
    return { ok: false, field: "newPassword", error: `New ${passwordError.toLowerCase()}` };
  }
  if (newPassword !== confirmPassword) {
    return { ok: false, field: "confirmPassword", error: "The new passwords don't match." };
  }
  if (newPassword === currentPassword) {
    return { ok: false, field: "newPassword", error: "The new password must be different." };
  }

  return { ok: true, data: { currentPassword, newPassword } };
}

// Deleting your account always needs your password, even when signed in:
// it can't be undone, and someone might be using your unlocked computer.
export function validateDeleteAccount({ password }) {
  if (typeof password !== "string" || password.length === 0) {
    return { ok: false, error: "Please enter your password to delete your account." };
  }
  if (password.length > PASSWORD_MAX_LENGTH) {
    return { ok: false, error: "Password is incorrect." };
  }

  return { ok: true, data: { password } };
}
