// The colour theme: "system" follows the device's light/dark setting, or the
// user can pick "light" or "dark". The choice is kept in a cookie, so the
// server can put the right class on <html> before the page is sent: no flash
// of the wrong colours while the page loads.

export const THEMES = [
  { value: "system", label: "System" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
];

export const THEME_COOKIE = "theme";

const VALUES = new Set(THEMES.map((theme) => theme.value));

// Anything unknown (an old or tampered cookie) means "system".
export function parseTheme(value) {
  return typeof value === "string" && VALUES.has(value) ? value : "system";
}

// The class for <html>: "light" or "dark" forces that theme (see
// globals.css); "" lets the device decide.
export function themeClass(theme) {
  return theme === "system" ? "" : theme;
}
