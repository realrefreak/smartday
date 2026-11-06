import { expect, test } from "@playwright/test";
import { addTask, formError, PASSWORD, signOut, signUp, uniqueEmail } from "./helpers.mjs";

async function signIn(page, email, password) {
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
}

test("signed-out visitors are sent from /account to sign in", async ({ page }) => {
  await page.goto("/account");
  await expect(page).toHaveURL("/sign-in");
});

test("change your name from the Account page", async ({ page }) => {
  const email = uniqueEmail("name");
  await signUp(page, { name: "Old Name", email });

  // The email in the nav links to the Account page.
  await page.getByRole("link", { name: email }).click();
  await expect(page).toHaveURL("/account");
  await expect(page.getByText(`Signed in as ${email}`)).toBeVisible();

  await page.getByLabel("Name", { exact: true }).fill("  New Name ");
  await page.getByRole("button", { name: "Save name" }).click();
  await expect(page.getByRole("status")).toHaveText("Name saved.");

  await page.reload();
  await expect(page.getByLabel("Name", { exact: true })).toHaveValue("New Name");
});

test("change your password, then sign in with the new one", async ({ page }) => {
  const email = uniqueEmail("password");
  const newPassword = "brand-new-password";
  await signUp(page, { email });
  await page.goto("/account");

  // A wrong current password is refused.
  await page.getByLabel("Current password").fill("not-my-password");
  await page.getByLabel("New password", { exact: true }).fill(newPassword);
  await page.getByLabel("Confirm new password").fill(newPassword);
  await page.getByRole("button", { name: "Change password" }).click();
  await expect(formError(page)).toHaveText("Your current password is incorrect.");

  // The boxes were cleared; fill them in properly.
  await page.getByLabel("Current password").fill(PASSWORD);
  await page.getByLabel("New password", { exact: true }).fill(newPassword);
  await page.getByLabel("Confirm new password").fill(newPassword);
  await page.getByRole("button", { name: "Change password" }).click();
  await expect(page.getByRole("status")).toContainText("Password changed.");

  // Still signed in here (Better Auth gave this browser a fresh session).
  await page.goto("/tasks");
  await expect(page).toHaveURL("/tasks");

  await signOut(page);
  await signIn(page, email, PASSWORD);
  await expect(formError(page)).toHaveText("Email or password is incorrect.");
  await signIn(page, email, newPassword);
  await expect(page).toHaveURL("/tasks");
});

test("delete your account after confirming with your password", async ({ page }) => {
  const email = uniqueEmail("delete");
  await signUp(page, { email });
  await addTask(page, "A task that goes too");
  await page.goto("/account");

  const passwordBox = page.getByLabel("Your password");
  const deleteButton = page.getByRole("button", { name: "Delete my account" });

  // Wrong password: nothing is deleted.
  await passwordBox.fill("not-my-password");
  page.once("dialog", (dialog) => dialog.accept());
  await deleteButton.click();
  await expect(formError(page)).toHaveText("Password is incorrect.");

  // Right password, but "Cancel" in the confirm box: nothing is sent.
  await passwordBox.fill(PASSWORD);
  page.once("dialog", (dialog) => dialog.dismiss());
  await deleteButton.click();
  await expect(page).toHaveURL("/account");

  // Right password, confirmed: gone.
  page.once("dialog", (dialog) => dialog.accept());
  await deleteButton.click();
  await expect(page).toHaveURL("/?account=deleted");
  await expect(page.getByRole("status")).toHaveText(
    "Your account and all of your tasks have been deleted.",
  );
  await expect(page.getByRole("link", { name: "Sign in" })).toBeVisible();

  // The account really is gone: signing in fails.
  await signIn(page, email, PASSWORD);
  await expect(formError(page)).toHaveText("Email or password is incorrect.");
});
