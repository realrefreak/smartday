import { expect, test } from "@playwright/test";
import { addTask, signUp, taskRow, uniqueEmail } from "./helpers.mjs";

// The bar that appears after deleting a task.
function undoBar(page) {
  return page.getByRole("status", { name: "Undo delete" });
}

test("undo brings a deleted task back with all its details", async ({ page }) => {
  await signUp(page, { email: uniqueEmail("undo") });
  await addTask(page, "Call the bank", { dueDate: "2026-12-01", priority: "High" });
  await addTask(page, "Keep me", { priority: "Medium" });

  await taskRow(page, "Call the bank").getByRole("button", { name: "Delete" }).click();
  await expect(taskRow(page, "Call the bank")).toHaveCount(0);
  await expect(undoBar(page)).toContainText('Deleted "Call the bank".');

  await undoBar(page).getByRole("button", { name: "Undo" }).click();
  const row = taskRow(page, "Call the bank");
  await expect(row).toContainText("High priority");
  await expect(row).toContainText("Due 1 Dec 2026");
  await expect(undoBar(page)).toBeEmpty();

  // Back for real: still there after a reload.
  await page.reload();
  await expect(taskRow(page, "Call the bank")).toBeVisible();

  // Without Undo, a delete sticks.
  await taskRow(page, "Call the bank").getByRole("button", { name: "Delete" }).click();
  await expect(undoBar(page)).toContainText("Deleted");
  await page.reload();
  await expect(taskRow(page, "Call the bank")).toHaveCount(0);
  await expect(taskRow(page, "Keep me")).toBeVisible();
});

test("duplicate makes an unfinished copy of a task", async ({ page }) => {
  await signUp(page, { email: uniqueEmail("duplicate") });
  await addTask(page, "Pack bags", { dueDate: "2026-12-20", priority: "Low" });
  await taskRow(page, "Pack bags").getByRole("button", { name: "Mark done" }).click();
  await expect(taskRow(page, "Pack bags").getByRole("button", { name: "Undo" })).toBeVisible();

  await taskRow(page, "Pack bags").getByRole("button", { name: "Duplicate" }).click();

  const rows = taskRow(page, "Pack bags");
  await expect(rows).toHaveCount(2);
  // One done, one to do, both with the same details.
  await expect(rows.filter({ has: page.getByRole("button", { name: "Undo" }) })).toHaveCount(1);
  await expect(rows.filter({ has: page.getByRole("button", { name: "Mark done" }) })).toHaveCount(1);
  for (const row of await rows.all()) {
    await expect(row).toContainText("Low priority");
    await expect(row).toContainText("Due 20 Dec 2026");
  }
});

test("keyboard shortcuts jump to the new task box and the search box", async ({ page }) => {
  await signUp(page, { email: uniqueEmail("keys") });
  const newTask = page.getByLabel("New task");
  const search = page.getByLabel("Search tasks");

  // Start with nothing focused.
  await page.getByRole("heading", { name: "Tasks" }).click();
  await page.keyboard.press("n");
  await expect(newTask).toBeFocused();

  // Inside a box, "n" and "/" are just letters.
  await page.keyboard.type("now/then");
  await expect(newTask).toHaveValue("now/then");

  await page.getByRole("heading", { name: "Tasks" }).click();
  await page.keyboard.press("/");
  await expect(search).toBeFocused();
  await expect(search).toHaveValue("");
});
