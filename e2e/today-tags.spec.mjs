import { expect, test } from "@playwright/test";
import { addTask, signUp, taskRow, uniqueEmail } from "./helpers.mjs";

// "YYYY-MM-DD" in India, `offset` days from now. The server uses the real
// clock, so the test works from the real date rather than a fake one.
function dateInIndia(offset) {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const part = (type) => Number(parts.find((p) => p.type === type).value);
  const date = new Date(Date.UTC(part("year"), part("month") - 1, part("day") + offset));
  return date.toISOString().slice(0, 10);
}

test.describe("in India", () => {
  test.use({ timezoneId: "Asia/Kolkata" });

  test("Today shows what's overdue or due today, in the user's time zone", async ({ page }) => {
    await signUp(page, { email: uniqueEmail("today") });
    await addTask(page, "Yesterday's thing", { dueDate: dateInIndia(-1) });
    await addTask(page, "Today's thing", { dueDate: dateInIndia(0) });
    await addTask(page, "Tomorrow's thing", { dueDate: dateInIndia(1) });
    await addTask(page, "Whenever");

    // The browser told the server its time zone. (Chrome uses the older name
    // for India, "Asia/Calcutta"; both are valid.)
    const cookies = await page.context().cookies();
    expect(cookies.find((cookie) => cookie.name === "tz")?.value).toMatch(/^Asia\/(Kolkata|Calcutta)$/);

    await page.getByRole("navigation", { name: "Filter tasks" }).getByRole("link", { name: "Today" }).click();
    await expect(page).toHaveURL("/tasks?show=today");
    await expect(page.getByRole("listitem")).toHaveText([/Yesterday's thing/, /Today's thing/]);

    // Done tasks leave the Today list.
    await taskRow(page, "Today's thing").getByRole("button", { name: "Mark done" }).click();
    await expect(page.getByRole("listitem")).toHaveText([/Yesterday's thing/]);
    await taskRow(page, "Yesterday's thing").getByRole("button", { name: "Mark done" }).click();
    await expect(page.getByText("Nothing due today. Enjoy!")).toBeVisible();
  });
});

test("clicking a #tag lists the tasks with exactly that tag", async ({ page }) => {
  await signUp(page, { email: uniqueEmail("tags") });
  await addTask(page, "Send report #work");
  await addTask(page, "Book #workshop room");
  await addTask(page, "Buy milk");

  await taskRow(page, "Send report").getByRole("link", { name: "#work" }).click();

  await expect(page).toHaveURL("/tasks?q=%23work");
  await expect(page.getByRole("listitem")).toHaveText([/Send report #work/]);
  // The search box shows what's being searched for.
  await expect(page.getByLabel("Search tasks")).toHaveValue("#work");
});

test("a repeating task's checklist unticks when it moves to its next date", async ({ page }) => {
  await signUp(page, { email: uniqueEmail("reset") });
  await page.getByLabel("New task").fill("Clean flat");
  await page.getByLabel("Due date").fill("2026-12-01");
  await page.getByLabel("Repeat").selectOption({ label: "Weekly" });
  await page.getByRole("button", { name: "Add" }).click();

  const row = taskRow(page, "Clean flat");
  const summary = row.locator("summary", { hasText: "Checklist" });
  await summary.click();
  await row.getByLabel("New checklist item for Clean flat").fill("Kitchen");
  await row.getByRole("button", { name: "Add step" }).click();
  await row.getByRole("checkbox", { name: "Kitchen" }).check();
  await expect(summary).toHaveText("Checklist (1/1)");

  await row.getByRole("button", { name: "Mark done" }).click();

  await expect(row).toContainText("Due 8 Dec 2026");
  await expect(summary).toHaveText("Checklist (0/1)");
  await expect(row.getByRole("checkbox", { name: "Kitchen" })).not.toBeChecked();
});
