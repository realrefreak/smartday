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

test("clicking a calendar day lists its tasks and adds one due that day", async ({ page }) => {
  await signUp(page, { email: uniqueEmail("calendar-day") });
  const today = dayInIndia();
  await addTask(page, "Dentist", { dueDate: today });

  await page.goto("/calendar");
  await page.locator(`a[href$="day=${today}"]`).click();
  await expect(page).toHaveURL(new RegExp(`day=${today}$`));

  // The panel for that day: its task, and a form with the date filled in.
  const panel = page.getByRole("region").filter({ has: page.getByLabel("New task") });
  await expect(panel).toContainText("Dentist");
  await expect(panel.getByLabel("Due date")).toHaveValue(today);

  await panel.getByLabel("New task").fill("Pick up glasses");
  await panel.getByRole("button", { name: "Add" }).click();
  await expect(panel.getByRole("listitem").filter({ hasText: "Pick up glasses" })).toBeVisible();
  // The date stays filled in, ready for another task that day.
  await expect(panel.getByLabel("Due date")).toHaveValue(today);

  // It's in the grid too, on today's square.
  const todayCell = page.getByRole("cell").filter({ has: page.locator('time[aria-current="date"]') });
  await expect(todayCell).toContainText("Pick up glasses");

  await panel.getByRole("link", { name: "Close" }).click();
  await expect(page.getByLabel("New task")).toHaveCount(0);
});

test("the weekly review shows what you finished, what's overdue and what's next", async ({ page }) => {
  await signUp(page, { email: uniqueEmail("review") });
  await addTask(page, "Write report");
  await addTask(page, "Renew insurance", { dueDate: dayInIndia(-2) });
  await addTask(page, "Book flights", { dueDate: dayInIndia(3) });
  await taskRow(page, "Write report").getByRole("button", { name: "Mark done" }).click();
  await expect(taskRow(page, "Write report").getByRole("button", { name: "Undo" })).toBeVisible();

  await page.getByRole("link", { name: "Review", exact: true }).click();
  await expect(page).toHaveURL("/review");
  await expect(page.getByRole("heading", { name: "Your week" })).toBeVisible();

  await expect(page.getByRole("heading", { name: "1 task finished" })).toBeVisible();
  await expect(page.getByText("1 more than last week")).toBeVisible();
  await expect(page.getByRole("region", { name: "What you finished" })).toContainText("Write report");
  await expect(page.getByRole("region", { name: /^Still overdue/ })).toContainText("Renew insurance");
  await expect(page.getByRole("region", { name: /^Next 7 days/ })).toContainText("Book flights");
});

test("signed-out visitors are sent from /review to sign in", async ({ browser }) => {
  const page = await browser.newPage();
  await page.goto("/review");
  await expect(page).toHaveURL("/sign-in");
});

test("SmartDay can be installed as an app", async ({ page, request }) => {
  await page.goto("/");
  const href = await page.locator('link[rel="manifest"]').getAttribute("href");

  const response = await request.get(href);
  expect(response.ok()).toBe(true);
  const manifest = await response.json();
  expect(manifest).toMatchObject({ name: "SmartDay", display: "standalone", start_url: "/" });

  // Every icon it lists is really there, as a PNG.
  for (const icon of manifest.icons) {
    const image = await request.get(icon.src);
    expect(image.ok(), icon.src).toBe(true);
    expect(image.headers()["content-type"]).toBe("image/png");
  }
});
