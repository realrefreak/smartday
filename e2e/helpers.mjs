// Shared steps for E2E tests, written the way a person uses the app:
// find things by their visible label or role, then click and type.

import { expect } from "@playwright/test";

export const PASSWORD = "correct-horse-battery";

// A fresh email for every test, so tests never collide with each other.
export function uniqueEmail(label) {
  const random = Math.random().toString(36).slice(2, 8);
  return `e2e-${label}-${Date.now()}-${random}@example.com`;
}

export async function signUp(page, { name = "E2E User", email }) {
  await page.goto("/sign-up");
  await page.getByLabel("Name").fill(name);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();

  // Signing up lands on the Tasks page, with the email in the nav.
  await expect(page).toHaveURL("/tasks");
  await expect(page.getByText(email)).toBeVisible();
}

// Clicks "Sign out" and WAITS until it has finished. Moving on before the
// redirect lands would race the sign-out (the old cookie would still work).
export async function signOut(page) {
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL("/");
  await expect(page.getByRole("link", { name: "Sign in" })).toBeVisible();
}

// The error message inside a form. Scoped to <form> because Next.js also puts
// an invisible role="alert" "route announcer" on every page for screen readers.
export function formError(page) {
  return page.locator("form").getByRole("alert");
}

export async function addTask(page, title) {
  await page.getByLabel("New task").fill(title);
  await page.getByRole("button", { name: "Add" }).click();
  await expect(page.getByRole("listitem").filter({ hasText: title })).toBeVisible();
}

// The <li> row for a task, to click its button or check its state.
export function taskRow(page, title) {
  return page.getByRole("listitem").filter({ hasText: title });
}
