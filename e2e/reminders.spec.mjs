import { expect, test } from "@playwright/test";
import { signUp, uniqueEmail } from "./helpers.mjs";

test("turn daily email reminders on and off from the Account page", async ({ page }) => {
  const email = uniqueEmail("reminders");
  await signUp(page, { email });
  await page.goto("/account");

  const section = page.getByRole("region", { name: "Email reminders" });
  const checkbox = section.getByRole("checkbox", { name: /Email me a daily reminder/ });

  // Off until you choose otherwise.
  await expect(checkbox).not.toBeChecked();
  await expect(section).toContainText(`Sent to ${email}`);

  await checkbox.check();
  await section.getByLabel("Send it at").selectOption("7");
  await section.getByRole("button", { name: "Save reminders" }).click();
  await expect(section.getByRole("status")).toHaveText("Reminders on: daily at 7:00 your time.");

  // Saved for real: still there after a reload.
  await page.reload();
  await expect(checkbox).toBeChecked();
  await expect(section.getByLabel("Send it at")).toHaveValue("7");

  await checkbox.uncheck();
  await section.getByRole("button", { name: "Save reminders" }).click();
  await expect(section.getByRole("status")).toHaveText("Reminders off.");
  await page.reload();
  await expect(checkbox).not.toBeChecked();
});

test("a broken unsubscribe link says so instead of doing anything", async ({ page }) => {
  await page.goto("/unsubscribe?u=someone&t=forged");

  await expect(page.getByRole("heading", { level: 1 })).toHaveText("This link doesn't work");
  await expect(page.getByRole("button", { name: "Unsubscribe" })).toHaveCount(0);
});
