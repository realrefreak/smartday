import { expect, test } from "@playwright/test";
import { addTask, signUp, uniqueEmail } from "./helpers.mjs";

// "YYYY-MM-DD" in India, `offset` days from now.
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

test("visitors see what SmartDay does and a way to sign up", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { level: 1 })).toContainText("Plan your day.");
  await expect(page.getByRole("heading", { name: "How it works" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Repeating tasks" })).toBeVisible();

  await page.getByRole("link", { name: "Get started free" }).click();
  await expect(page).toHaveURL("/sign-up");
});

test("a new account gets tips for getting started", async ({ page }) => {
  await signUp(page, { name: "Asha Rao", email: uniqueEmail("home-new") });
  await page.goto("/");

  await expect(page.getByRole("heading", { level: 1 })).toContainText(", Asha");
  await expect(page.getByRole("heading", { name: "Get started" })).toBeVisible();

  // Quick add, right on the home page.
  await page.getByLabel("New task").fill("Water the plants");
  await page.getByRole("button", { name: "Add" }).click();
  await expect(page.getByRole("region", { name: "Coming up" })).toBeVisible();
  await expect(page.getByLabel("New task")).toHaveValue("");
  await expect(page.getByRole("link", { name: /Still to do/ })).toContainText("1");
});

test.describe("in India", () => {
  test.use({ timezoneId: "Asia/Kolkata" });

  test("the dashboard shows today's focus, what's coming up and tags", async ({ page }) => {
    await signUp(page, { email: uniqueEmail("home") });
    await addTask(page, "Pay rent #home", { dueDate: dateInIndia(-1), priority: "High" });
    await addTask(page, "Send report #work", { dueDate: dateInIndia(0) });
    await addTask(page, "Plan trip #home", { dueDate: dateInIndia(3) });
    await addTask(page, "Read a book", { dueDate: dateInIndia(30) });

    await page.getByRole("link", { name: "Home", exact: true }).click();
    await expect(page).toHaveURL("/");

    const focus = page.getByRole("region", { name: "Today's focus" });
    await expect(focus.getByRole("listitem")).toHaveText([/Pay rent/, /Send report.*Today/]);

    // Only the next 7 days: the book is a month away.
    const upcoming = page.getByRole("region", { name: "Coming up" });
    await expect(upcoming.getByRole("listitem")).toHaveText([/Plan trip/]);

    await expect(page.getByRole("link", { name: /Overdue/ })).toContainText("1");
    await expect(page.getByRole("link", { name: /Due today/ })).toContainText("1");

    // Tags, most used first; clicking one searches for it.
    const tags = page.getByRole("region", { name: "Your tags" });
    await expect(tags.getByRole("link")).toHaveText([/#home\s*2/, /#work\s*1/]);
    await tags.getByRole("link", { name: /#work/ }).click();
    await expect(page).toHaveURL("/tasks?q=%23work");
  });
});
