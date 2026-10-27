import { expect, test } from "@playwright/test";
import { addTask, formError, signUp, taskRow, uniqueEmail } from "./helpers.mjs";

test("add tasks, complete one, and both survive a page reload", async ({ page }) => {
  const email = uniqueEmail("tasks");
  await signUp(page, { email });
  await expect(page.getByText("No tasks yet")).toBeVisible();

  await addTask(page, "Buy milk");
  await addTask(page, "Walk the dog");

  // The box clears after adding, ready for the next task.
  await expect(page.getByLabel("New task")).toHaveValue("");

  await taskRow(page, "Buy milk").getByRole("button", { name: "Mark done" }).click();
  await expect(taskRow(page, "Buy milk").getByRole("button", { name: "Undo" })).toBeVisible();

  // Reload: the data comes from the database, not the browser.
  await page.reload();
  await expect(taskRow(page, "Buy milk").getByRole("button", { name: "Undo" })).toBeVisible();
  await expect(taskRow(page, "Walk the dog").getByRole("button", { name: "Mark done" })).toBeVisible();
});

test("a title of only spaces shows the server's validation message", async ({ page }) => {
  await signUp(page, { email: uniqueEmail("blank") });

  // `required` stops a truly empty box in the browser; spaces get past it,
  // so this reaches the server-side check.
  await page.getByLabel("New task").fill("   ");
  await page.getByRole("button", { name: "Add" }).click();

  await expect(formError(page)).toHaveText("Please enter a task title.");
  await expect(page.getByRole("listitem")).toHaveCount(0);
});

test("two users never see each other's tasks", async ({ browser }) => {
  // Two separate browser contexts = two different people, each with their own cookies.
  const anaContext = await browser.newContext();
  const benContext = await browser.newContext();
  const ana = await anaContext.newPage();
  const ben = await benContext.newPage();

  await signUp(ana, { name: "Ana", email: uniqueEmail("ana") });
  await signUp(ben, { name: "Ben", email: uniqueEmail("ben") });

  await addTask(ana, "Ana's secret plan");
  await addTask(ben, "Ben's groceries");

  await ana.reload();
  await ben.reload();
  await expect(ana.getByRole("listitem")).toHaveText(["Ana's secret planMark done"]);
  await expect(ben.getByRole("listitem")).toHaveText(["Ben's groceriesMark done"]);

  await anaContext.close();
  await benContext.close();
});
