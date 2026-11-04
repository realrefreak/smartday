import { expect, test } from "@playwright/test";
import { addTask, signUp, taskRow, uniqueEmail } from "./helpers.mjs";

test("priorities show as badges and can sort the list", async ({ page }) => {
  await signUp(page, { email: uniqueEmail("priority") });

  await addTask(page, "Water plants", { priority: "Low" });
  await addTask(page, "File taxes", { dueDate: "2026-12-20", priority: "High" });
  // The drop-down keeps the last choice, so set Medium back explicitly.
  await addTask(page, "Read a book", { priority: "Medium" });
  await addTask(page, "Call the bank", { dueDate: "2026-12-01", priority: "High" });

  await expect(taskRow(page, "File taxes")).toContainText("High priority");
  await expect(taskRow(page, "Water plants")).toContainText("Low priority");
  // Medium is the default, so it has no badge.
  await expect(taskRow(page, "Read a book")).not.toContainText("priority");

  const sorts = page.getByRole("navigation", { name: "Sort tasks" });
  await sorts.getByRole("link", { name: "Priority" }).click();
  await expect(page).toHaveURL("/tasks?sort=priority");
  await expect(page.getByRole("listitem")).toContainText([
    "Call the bank",
    "File taxes",
    "Read a book",
    "Water plants",
  ]);

  // Change a priority by editing: Water plants becomes High.
  await taskRow(page, "Water plants").getByRole("button", { name: "Edit" }).click();
  const editRow = page.getByRole("listitem").filter({ has: page.getByRole("button", { name: "Save" }) });
  await editRow.getByLabel("Priority").selectOption({ label: "High" });
  await editRow.getByRole("button", { name: "Save" }).click();
  await expect(taskRow(page, "Water plants")).toContainText("High priority");

  // High tasks: soonest due date first, undated last.
  await expect(page.getByRole("listitem")).toContainText([
    "Call the bank",
    "File taxes",
    "Water plants",
    "Read a book",
  ]);
});

test("notes can be added, read, and removed", async ({ page }) => {
  await signUp(page, { email: uniqueEmail("notes") });
  await addTask(page, "Groceries");

  await taskRow(page, "Groceries").getByRole("button", { name: "Edit" }).click();
  const editRow = page.getByRole("listitem").filter({ has: page.getByRole("button", { name: "Save" }) });
  await editRow.getByLabel("Notes").fill("Milk\nEggs");
  await editRow.getByRole("button", { name: "Save" }).click();

  // Notes start folded away; clicking "Notes" opens them, line breaks kept.
  const row = taskRow(page, "Groceries");
  await expect(row.getByText("Notes")).toBeVisible();
  await expect(row.locator("details p")).toBeHidden();
  await row.getByText("Notes").click();
  await expect(row.locator("details p")).toHaveText("Milk\nEggs");

  // They're saved in the database: still there after a reload.
  await page.reload();
  await expect(row.locator("details p")).toHaveText("Milk\nEggs");

  // Emptying the box removes the notes.
  await row.getByRole("button", { name: "Edit" }).click();
  await editRow.getByLabel("Notes").fill("");
  await editRow.getByRole("button", { name: "Save" }).click();
  await expect(taskRow(page, "Groceries").locator("details")).toHaveCount(0);
});

test("search finds tasks by title or notes, as you type", async ({ page }) => {
  await signUp(page, { email: uniqueEmail("search") });
  await addTask(page, "Buy milk");
  await addTask(page, "Shopping");
  await addTask(page, "Walk the dog");

  await taskRow(page, "Shopping").getByRole("button", { name: "Edit" }).click();
  const editRow = page.getByRole("listitem").filter({ has: page.getByRole("button", { name: "Save" }) });
  await editRow.getByLabel("Notes").fill("oat MILK");
  await editRow.getByRole("button", { name: "Save" }).click();
  await expect(taskRow(page, "Shopping").getByText("Notes")).toBeVisible();

  const search = page.getByRole("searchbox", { name: "Search tasks" });
  await search.fill("milk");
  await expect(page).toHaveURL("/tasks?q=milk");
  await expect(page.getByRole("listitem")).toHaveCount(2);
  await expect(taskRow(page, "Walk the dog")).toHaveCount(0);

  // The search lives in the URL: it survives a reload, and switching the
  // filter keeps it.
  await page.reload();
  await expect(search).toHaveValue("milk");
  await expect(page.getByRole("listitem")).toHaveCount(2);
  await page.getByRole("navigation", { name: "Filter tasks" }).getByRole("link", { name: "Active" }).click();
  await expect(page).toHaveURL("/tasks?show=active&q=milk");

  await search.fill("zebra");
  await expect(page.getByText('No tasks match "zebra".')).toBeVisible();

  // Clearing the box shows everything again.
  await search.fill("");
  await expect(page).toHaveURL("/tasks?show=active");
  await expect(page.getByRole("listitem")).toHaveCount(3);
});

test("clear completed deletes every finished task, after confirming", async ({ page }) => {
  await signUp(page, { email: uniqueEmail("clear") });
  await addTask(page, "Done one");
  await addTask(page, "Done two");
  await addTask(page, "Keep me");

  const clear = page.getByRole("button", { name: /Clear completed/ });
  // Nothing finished yet: no button.
  await expect(clear).toHaveCount(0);

  await taskRow(page, "Done one").getByRole("button", { name: "Mark done" }).click();
  await expect(clear).toHaveText("Clear completed (1)");
  await taskRow(page, "Done two").getByRole("button", { name: "Mark done" }).click();
  await expect(clear).toHaveText("Clear completed (2)");

  // "Cancel" in the confirm box: nothing is deleted.
  page.once("dialog", (dialog) => dialog.dismiss());
  await clear.click();
  await expect(page.getByRole("listitem")).toHaveCount(3);

  page.once("dialog", async (dialog) => {
    expect(dialog.message()).toBe("Delete 2 finished tasks? This can't be undone.");
    await dialog.accept();
  });
  await clear.click();
  await expect(page.getByRole("listitem")).toHaveCount(1);
  await expect(taskRow(page, "Keep me")).toBeVisible();
  await expect(clear).toHaveCount(0);
});
