import { readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import { addTask, formError, signUp, taskRow, uniqueEmail } from "./helpers.mjs";

test("a repeating task moves to its next date when marked done", async ({ page }) => {
  await signUp(page, { email: uniqueEmail("repeat") });

  // Repeating needs a due date: the server says so.
  await page.getByLabel("New task").fill("Water plants");
  await page.getByLabel("Repeat").selectOption({ label: "Weekly" });
  await page.getByRole("button", { name: "Add" }).click();
  await expect(formError(page)).toHaveText("A repeating task needs a due date.");

  await page.getByLabel("Due date").fill("2026-12-01");
  await page.getByRole("button", { name: "Add" }).click();
  const row = taskRow(page, "Water plants");
  await expect(row).toContainText("Due 1 Dec 2026 · Repeats weekly");

  // Done: it stays on the list, a week later, still to do.
  await row.getByRole("button", { name: "Mark done" }).click();
  await expect(row).toContainText("Due 8 Dec 2026");
  await expect(row.getByRole("button", { name: "Mark done" })).toBeVisible();

  // Stop it repeating by editing.
  await row.getByRole("button", { name: "Edit" }).click();
  const editRow = page.getByRole("listitem").filter({ has: page.getByRole("button", { name: "Save" }) });
  await editRow.getByLabel("Repeat").selectOption({ label: "Doesn't repeat" });
  await editRow.getByRole("button", { name: "Save" }).click();
  await expect(row).not.toContainText("Repeats");

  // Now done means done.
  await row.getByRole("button", { name: "Mark done" }).click();
  await expect(row.getByRole("button", { name: "Undo" })).toBeVisible();
  await expect(row).toContainText("Due 8 Dec 2026");
});

test("the progress bar counts finished tasks", async ({ page }) => {
  await signUp(page, { email: uniqueEmail("progress") });
  await expect(page.getByRole("progressbar")).toHaveCount(0);

  // (Not "One": that would also match the "Mark done" button text.)
  await addTask(page, "Apples");
  await addTask(page, "Bananas");
  await expect(page.getByText("0 of 2 done")).toBeVisible();

  await taskRow(page, "Apples").getByRole("button", { name: "Mark done" }).click();
  await expect(page.getByText("1 of 2 done")).toBeVisible();
  await expect(page.getByRole("progressbar", { name: "Tasks done" })).toHaveAttribute("aria-valuenow", "50");

  // The count covers every task, whatever the filter.
  await page.getByRole("navigation", { name: "Filter tasks" }).getByRole("link", { name: "Active" }).click();
  await expect(page.getByText("1 of 2 done")).toBeVisible();

  await taskRow(page, "Bananas").getByRole("button", { name: "Mark done" }).click();
  await expect(page.getByText("All 2 done. Well done!")).toBeVisible();
});

test("export downloads your tasks as a CSV file", async ({ page }) => {
  await signUp(page, { email: uniqueEmail("export") });
  await addTask(page, "Buy milk, eggs", { dueDate: "2026-12-01", priority: "High" });
  // The drop-down keeps the last priority, so set Medium back explicitly.
  await addTask(page, "=1+1", { priority: "Medium" });

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("link", { name: "Export CSV" }).click();
  const download = await downloadPromise;

  expect(download.suggestedFilename()).toMatch(/^smartday-tasks-\d{4}-\d{2}-\d{2}\.csv$/);
  const text = (await readFile(await download.path(), "utf8")).replace(/^﻿/, "");
  const lines = text.trim().split("\r\n");
  expect(lines[0]).toBe("Title,Done,Due date,Priority,Repeats,Notes,Created");
  expect(lines[1]).toMatch(/^"Buy milk, eggs",No,2026-12-01,high,,,/);
  // A title that looks like a formula is made safe.
  expect(lines[2]).toMatch(/^'=1\+1,No,,medium,,,/);
});

test("signed-out visitors can't export anything", async ({ request }) => {
  // `request` has no cookies: a stranger.
  const response = await request.get("/api/tasks/export");

  expect(response.status()).toBe(401);
});
