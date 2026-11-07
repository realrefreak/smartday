import { expect, test } from "@playwright/test";
import { addTask, signUp, taskRow, uniqueEmail } from "./helpers.mjs";

// "YYYY-MM-DD" in India, `days` days from today.
function dayInIndia(days = 0) {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());
  const date = new Date(`${today}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

test.use({ timezoneId: "Asia/Kolkata" });

test("typing a date and priority at the end of a task sets them", async ({ page }) => {
  await signUp(page, { email: uniqueEmail("quick-add") });

  // Not the addTask helper: it waits for the exact text typed, and here the
  // title changes.
  await page.getByLabel("New task").fill("Call mum tomorrow #family !high");
  await page.getByRole("button", { name: "Add" }).click();
  await expect(taskRow(page, "Call mum")).toBeVisible();

  // The words became settings, and the title is just the task.
  const row = taskRow(page, "Call mum");
  await expect(row).toContainText("High priority");
  await expect(row).not.toContainText("tomorrow !high");
  await expect(row.getByRole("link", { name: "#family" })).toBeVisible();

  // It's on tomorrow's square in the calendar.
  const tomorrow = dayInIndia(1);
  await page.goto(`/calendar?month=${tomorrow.slice(0, 7)}`);
  const cell = page.getByRole("cell").filter({ has: page.locator(`time[datetime="${tomorrow}"]`) });
  await expect(cell).toContainText("Call mum");
});

test("an overdue task can be moved to tomorrow in one click", async ({ page }) => {
  await signUp(page, { email: uniqueEmail("reschedule") });
  await addTask(page, "Renew insurance", { dueDate: dayInIndia(-3) });
  await addTask(page, "Due later", { dueDate: dayInIndia(5) });

  // Only overdue tasks get the button.
  await expect(taskRow(page, "Due later").getByRole("button", { name: "Move to tomorrow" })).toHaveCount(0);
  await expect(taskRow(page, "Renew insurance")).toContainText("Overdue");

  await taskRow(page, "Renew insurance").getByRole("button", { name: "Move to tomorrow" }).click();

  await expect(taskRow(page, "Renew insurance").getByRole("button", { name: "Move to tomorrow" })).toHaveCount(0);
  await expect(taskRow(page, "Renew insurance")).not.toContainText("Overdue");

  const tomorrow = dayInIndia(1);
  await page.goto(`/calendar?month=${tomorrow.slice(0, 7)}`);
  const cell = page.getByRole("cell").filter({ has: page.locator(`time[datetime="${tomorrow}"]`) });
  await expect(cell).toContainText("Renew insurance");
});
