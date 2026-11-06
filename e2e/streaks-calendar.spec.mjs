import { expect, test } from "@playwright/test";
import { addTask, signUp, taskRow, uniqueEmail } from "./helpers.mjs";

// India's date today as [year, month, day].
function partsInIndia() {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const part = (type) => Number(parts.find((p) => p.type === type).value);
  return [part("year"), part("month"), part("day")];
}

// "YYYY-MM-DD" in India: `months` months from now, on day `day` (or today).
function dateInIndia({ months = 0, day } = {}) {
  const [year, month, today] = partsInIndia();
  return new Date(Date.UTC(year, month - 1 + months, day ?? today)).toISOString().slice(0, 10);
}

test.use({ timezoneId: "Asia/Kolkata" });

test("finishing a task starts a streak on the home page", async ({ page }) => {
  await signUp(page, { email: uniqueEmail("streak") });
  await addTask(page, "Go for a run");
  await taskRow(page, "Go for a run").getByRole("button", { name: "Mark done" }).click();
  await expect(taskRow(page, "Go for a run").getByRole("button", { name: "Undo" })).toBeVisible();

  await page.getByRole("link", { name: "Home", exact: true }).click();
  const streak = page.getByRole("region", { name: "1-day streak" });
  await expect(streak).toBeVisible();
  // Today is the last of the 7 days, and it's filled in.
  await expect(streak.getByRole("listitem").last()).toContainText("finished a task");

  // Un-ticking it takes the day back off.
  await page.getByRole("link", { name: "Tasks", exact: true }).click();
  await taskRow(page, "Go for a run").getByRole("button", { name: "Undo" }).click();
  await expect(taskRow(page, "Go for a run").getByRole("button", { name: "Mark done" })).toBeVisible();
  await page.getByRole("link", { name: "Home", exact: true }).click();
  await expect(page.getByRole("region", { name: "No streak yet" })).toBeVisible();
});

test("the calendar shows tasks on their due day, month by month", async ({ page }) => {
  await signUp(page, { email: uniqueEmail("calendar") });
  await addTask(page, "Dentist", { dueDate: dateInIndia() });
  await addTask(page, "Renew passport", { dueDate: dateInIndia({ months: 1, day: 15 }) });

  await page.getByRole("link", { name: "Calendar", exact: true }).click();
  await expect(page).toHaveURL("/calendar");

  // Today's square is marked, and holds today's task.
  const todayCell = page.getByRole("cell").filter({ has: page.locator('time[aria-current="date"]') });
  await expect(todayCell).toContainText("Dentist");
  await expect(page.getByRole("table")).not.toContainText("Renew passport");

  await page.getByRole("link", { name: "Next →" }).click();
  await expect(page).toHaveURL(`/calendar?month=${dateInIndia({ months: 1, day: 1 }).slice(0, 7)}`);
  const cell = page.getByRole("cell").filter({ has: page.locator(`time[datetime="${dateInIndia({ months: 1, day: 15 })}"]`) });
  await expect(cell).toContainText("Renew passport");

  // "Today" jumps back to this month.
  await page.getByRole("link", { name: "Today" }).click();
  await expect(page).toHaveURL("/calendar");
});

test("signed-out visitors are sent from /calendar to sign in", async ({ browser }) => {
  const page = await browser.newPage();
  await page.goto("/calendar");
  await expect(page).toHaveURL("/sign-in");
});
