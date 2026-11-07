import { expect, test } from "@playwright/test";
import { signUp, uniqueEmail } from "./helpers.mjs";

test("turn daily email reminders on and off from the Account page", async ({ page }) => {
  const email = uniqueEmail("reminders");
  await signUp(page, { email });
  await page.goto("/account");

  const section = page.getByRole("region", { name: "Daily reminders" });
  // The email form's own message (the notifications part has another).
  const saved = section.locator("form").getByRole("status");
  const checkbox = section.getByRole("checkbox", { name: /Email me a daily reminder/ });

  // Off until you choose otherwise.
  await expect(checkbox).not.toBeChecked();
  await expect(section).toContainText(`Sent to ${email}`);

  await checkbox.check();
  await section.getByLabel("Send it at").selectOption("7");
  await section.getByRole("button", { name: "Save reminders" }).click();
  await expect(saved).toHaveText("Reminders on: daily at 7:00 your time.");

  // Saved for real: still there after a reload.
  await page.reload();
  await expect(checkbox).toBeChecked();
  await expect(section.getByLabel("Send it at")).toHaveValue("7");

  await checkbox.uncheck();
  await section.getByRole("button", { name: "Save reminders" }).click();
  await expect(saved).toHaveText("Reminders off.");
  await page.reload();
  await expect(checkbox).not.toBeChecked();
});

test("the Account page offers notifications for this device", async ({ page }) => {
  await signUp(page, { email: uniqueEmail("push") });
  await page.goto("/account");

  const push = page.getByRole("region", { name: "Notifications on this device" });
  // The section checks what this browser allows, then settles on one state.
  // Which one depends on the machine: CI's test build has no keys ("aren't
  // set up"), and headless test browsers report notifications as blocked.
  // Real phones and browsers get the "Turn on notifications" button.
  await expect(push.getByText("Checking this device")).toHaveCount(0);
  await expect(
    push
      .getByRole("button", { name: "Turn on notifications" })
      .or(push.getByText("aren't set up on this server"))
      .or(push.getByText("Notifications are blocked")),
  ).toBeVisible();
});

test("a broken unsubscribe link says so instead of doing anything", async ({ page }) => {
  await page.goto("/unsubscribe?u=someone&t=forged");

  await expect(page.getByRole("heading", { level: 1 })).toHaveText("This link doesn't work");
  await expect(page.getByRole("button", { name: "Unsubscribe" })).toHaveCount(0);
});
