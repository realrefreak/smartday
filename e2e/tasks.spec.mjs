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
  // Each person sees exactly one task: their own.
  await expect(ana.getByRole("listitem")).toHaveCount(1);
  await expect(ana.getByRole("listitem")).toContainText("Ana's secret plan");
  await expect(ben.getByRole("listitem")).toHaveCount(1);
  await expect(ben.getByRole("listitem")).toContainText("Ben's groceries");

  await anaContext.close();
  await benContext.close();
});

test("a task can have a due date, and it survives a page reload", async ({ page }) => {
  await signUp(page, { email: uniqueEmail("due") });

  await addTask(page, "Pay rent", { dueDate: "2026-12-01" });
  await addTask(page, "Someday task");

  await expect(taskRow(page, "Pay rent")).toContainText("Due 1 Dec 2026");
  await expect(taskRow(page, "Someday task")).not.toContainText("Due");
  // The date box clears after adding, like the title box.
  await expect(page.getByLabel("Due date")).toHaveValue("");

  await page.reload();
  await expect(taskRow(page, "Pay rent")).toContainText("Due 1 Dec 2026");
});

// The browser pretends to be in India at 00:30 on 15 Nov 2026. In UTC, where
// the server runs, it's still 14 Nov. Labels must follow the user's date.
test.describe("just after midnight in India", () => {
  test.use({ timezoneId: "Asia/Kolkata" });

  test("Overdue and Today use the browser's date, and tasks sort by due date", async ({ page }) => {
    // 19:00 UTC on 14 Nov = 00:30 IST on 15 Nov. Must be set before the page loads.
    await page.clock.setFixedTime(new Date("2026-11-14T19:00:00Z"));
    await signUp(page, { email: uniqueEmail("overdue") });

    await addTask(page, "Gym", { dueDate: "2026-11-16" });
    await addTask(page, "Rent", { dueDate: "2026-11-15" });
    await addTask(page, "Dentist", { dueDate: "2026-11-14" });
    await addTask(page, "Library book", { dueDate: "2026-11-14" });
    await addTask(page, "No rush");

    // Finished tasks are never shown as overdue.
    await taskRow(page, "Library book").getByRole("button", { name: "Mark done" }).click();
    await expect(taskRow(page, "Library book").getByRole("button", { name: "Undo" })).toBeVisible();

    await expect(taskRow(page, "Dentist")).toContainText("Overdue");
    await expect(taskRow(page, "Rent")).toContainText("Today");
    await expect(taskRow(page, "Gym")).not.toContainText(/Overdue|Today/);
    await expect(taskRow(page, "Library book")).not.toContainText("Overdue");

    // Soonest first, undated last (same date: added first comes first).
    await expect(page.getByRole("listitem")).toContainText([
      "Dentist",
      "Library book",
      "Rent",
      "Gym",
      "No rush",
    ]);
  });
});

test("edit a task, cancel an edit, and delete a task", async ({ page }) => {
  await signUp(page, { email: uniqueEmail("edit") });
  await addTask(page, "Buy mlik", { dueDate: "2026-12-01" });
  await addTask(page, "Old task");

  // Edit: fix the typo and remove the due date.
  await taskRow(page, "Buy mlik").getByRole("button", { name: "Edit" }).click();
  const editRow = page.getByRole("listitem").filter({ has: page.getByRole("button", { name: "Save" }) });
  await editRow.getByLabel("Title").fill("Buy milk");
  await editRow.getByLabel("Due date").fill("");
  await editRow.getByRole("button", { name: "Save" }).click();

  await expect(taskRow(page, "Buy milk")).toBeVisible();
  await expect(taskRow(page, "Buy milk")).not.toContainText("Due");
  await expect(page.getByRole("button", { name: "Save" })).toHaveCount(0);

  // Edit validation is the same as adding: spaces only are refused.
  await taskRow(page, "Buy milk").getByRole("button", { name: "Edit" }).click();
  await editRow.getByLabel("Title").fill("   ");
  await editRow.getByRole("button", { name: "Save" }).click();
  await expect(editRow.getByRole("alert")).toHaveText("Please enter a task title.");

  // Cancel throws the change away.
  await editRow.getByRole("button", { name: "Cancel" }).click();
  await expect(taskRow(page, "Buy milk")).toBeVisible();

  // Delete: it's gone at once (no confirm box; there's Undo instead, see
  // task-undo.spec.mjs), and still gone after a reload.
  await taskRow(page, "Old task").getByRole("button", { name: "Delete" }).click();
  await expect(taskRow(page, "Old task")).toHaveCount(0);

  await page.reload();
  await expect(page.getByRole("listitem")).toHaveCount(1);
  await expect(taskRow(page, "Buy milk")).toBeVisible();
});

test("filter tasks by All / Active / Done, kept in the URL", async ({ page }) => {
  await signUp(page, { email: uniqueEmail("filter") });
  await addTask(page, "Still to do");
  await addTask(page, "Already done");
  await taskRow(page, "Already done").getByRole("button", { name: "Mark done" }).click();
  await expect(taskRow(page, "Already done").getByRole("button", { name: "Undo" })).toBeVisible();

  const filters = page.getByRole("navigation", { name: "Filter tasks" });

  await filters.getByRole("link", { name: "Active" }).click();
  await expect(page).toHaveURL("/tasks?show=active");
  await expect(filters.getByRole("link", { name: "Active" })).toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("listitem")).toHaveCount(1);
  await expect(taskRow(page, "Still to do")).toBeVisible();

  await filters.getByRole("link", { name: "Done" }).click();
  await expect(page).toHaveURL("/tasks?show=done");
  await expect(page.getByRole("listitem")).toHaveCount(1);
  await expect(taskRow(page, "Already done")).toBeVisible();

  // The filter lives in the URL, so it survives a reload...
  await page.reload();
  await expect(page.getByRole("listitem")).toHaveCount(1);
  await expect(taskRow(page, "Already done")).toBeVisible();

  // ...and the back button goes to the previous filter.
  await page.goBack();
  await expect(page).toHaveURL("/tasks?show=active");
  await expect(taskRow(page, "Still to do")).toBeVisible();

  // Finishing the last active task empties the Active list.
  await taskRow(page, "Still to do").getByRole("button", { name: "Mark done" }).click();
  await expect(page.getByText("Nothing left to do.")).toBeVisible();

  // A made-up filter in the URL just shows everything.
  await page.goto("/tasks?show=banana");
  await expect(page.getByRole("listitem")).toHaveCount(2);
});
