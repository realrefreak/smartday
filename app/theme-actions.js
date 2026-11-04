"use server";
// Saving the theme choice. Anyone can call this (signed in or not): it only
// sets a cookie in the caller's own browser.

import { cookies } from "next/headers";
import { THEME_COOKIE, parseTheme } from "@/lib/theme";

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

export async function setThemeAction(formData) {
  const theme = parseTheme(formData.get("theme"));
  const cookieStore = await cookies();

  if (theme === "system") {
    // The default needs no cookie.
    cookieStore.delete(THEME_COOKIE);
  } else {
    cookieStore.set(THEME_COOKIE, theme, {
      path: "/",
      maxAge: ONE_YEAR_SECONDS,
      sameSite: "lax",
      // Only the server reads it, so page scripts don't need to see it.
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
    });
  }
  // Setting a cookie in a Server Action makes Next render the page again in
  // the same response, so the new theme shows straight away.
}
