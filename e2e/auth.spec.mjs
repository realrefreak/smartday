import { expect, test } from "@playwright/test";
import { formError, PASSWORD, signOut, signUp, uniqueEmail } from "./helpers.mjs";

test("signed-out visitors are sent from /tasks to sign in", async ({ page }) => {
  await page.goto("/tasks");

  await expect(page).toHaveURL("/sign-in");
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
});

test("sign up, sign out, and sign back in", async ({ page }) => {
  const email = uniqueEmail("auth");

  await signUp(page, { email });
  await signOut(page);

  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();

  await expect(page).toHaveURL("/tasks");
  await expect(page.getByText(email)).toBeVisible();
});

test("a wrong password shows a vague error and keeps the email", async ({ page }) => {
  const email = uniqueEmail("wrongpw");
  await signUp(page, { email });
  await signOut(page);

  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("not-the-password");
  await page.getByRole("button", { name: "Sign in" }).click();

  await expect(formError(page)).toHaveText("Email or password is incorrect.");
  await expect(page.getByLabel("Email")).toHaveValue(email);
  await expect(page).toHaveURL("/sign-in");
});

test("signing up twice with the same email is refused", async ({ page }) => {
  const email = uniqueEmail("dupe");
  await signUp(page, { email });
  await signOut(page);

  await page.goto("/sign-up");
  await page.getByLabel("Name").fill("Someone Else");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();

  await expect(formError(page)).toContainText("already exists");
});
