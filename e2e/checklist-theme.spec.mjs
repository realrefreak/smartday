import { expect, test } from "@playwright/test";
import { addTask, signUp, taskRow, uniqueEmail } from "./helpers.mjs";

test("a task's checklist: add, tick, remove, and it survives delete + undo", async ({ page }) => {
  await signUp(page, { email: uniqueEmail("checklist") });
  await addTask(page, "Move house");
  const row = taskRow(page, "Move house");
  const summary = row.locator("summary", { hasText: "Checklist" });
  const newItem = row.getByLabel("New checklist item for Move house");
  const addStep = row.getByRole("button", { name: "Add step" });

  await summary.click();
  await newItem.fill("Book van");
  await addStep.click();
  await expect(row.getByRole("checkbox", { name: "Book van" })).toBeVisible();
  // The box is empty again, ready for the next item.
  await expect(newItem).toHaveValue("");

  await newItem.fill("Pack kitchen");
  await addStep.click();
  await expect(summary).toHaveText("Checklist (0/2)");

  // Only spaces: the server refuses it.
  await newItem.fill("   ");
  await addStep.click();
  await expect(row.getByRole("alert")).toHaveText("Please enter a checklist item.");

  await row.getByRole("checkbox", { name: "Book van" }).check();
  await expect(summary).toHaveText("Checklist (1/2)");
  await expect(row.getByRole("checkbox", { name: "Book van" })).toBeChecked();

  await row.getByRole("button", { name: 'Remove "Pack kitchen"' }).click();
  await expect(row.getByRole("checkbox", { name: "Pack kitchen" })).toHaveCount(0);
  await expect(summary).toHaveText("Checklist (1/1)");

  // Saved for real.
  await page.reload();
  await expect(summary).toHaveText("Checklist (1/1)");

  // Delete the task, then Undo: the checklist comes back too, still ticked.
  await row.getByRole("button", { name: "Delete" }).click();
  await expect(row).toHaveCount(0);
  await page.getByRole("status", { name: "Undo delete" }).getByRole("button", { name: "Undo" }).click();
  await expect(summary).toHaveText("Checklist (1/1)");
  await summary.click();
  await expect(row.getByRole("checkbox", { name: "Book van" })).toBeChecked();
});

test("the theme can follow the device, or be set to light or dark", async ({ page }) => {
  const html = page.locator("html");
  const body = page.locator("body");
  const theme = page.getByRole("group", { name: "Theme" });
  const background = () => body.evaluate((element) => getComputedStyle(element).backgroundColor);
  const white = "rgb(255, 255, 255)";
  const nearBlack = "rgb(10, 10, 10)";

  // A device in light mode; no choice made yet: System.
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/");
  await expect(theme.getByRole("button", { name: "System" })).toHaveAttribute("aria-pressed", "true");
  expect(await background()).toBe(white);

  // Dark, even though the device is light. Remembered after a reload.
  await theme.getByRole("button", { name: "Dark" }).click();
  await expect(html).toHaveClass(/(^|\s)dark(\s|$)/);
  await expect(theme.getByRole("button", { name: "Dark" })).toHaveAttribute("aria-pressed", "true");
  expect(await background()).toBe(nearBlack);
  await page.reload();
  expect(await background()).toBe(nearBlack);

  // Light, even though the device is now dark.
  await page.emulateMedia({ colorScheme: "dark" });
  await theme.getByRole("button", { name: "Light" }).click();
  await expect(html).toHaveClass(/(^|\s)light(\s|$)/);
  expect(await background()).toBe(white);

  // Back to System: follows the (dark) device again.
  await theme.getByRole("button", { name: "System" }).click();
  await expect(html).not.toHaveClass(/(^|\s)(light|dark)(\s|$)/);
  expect(await background()).toBe(nearBlack);
});
