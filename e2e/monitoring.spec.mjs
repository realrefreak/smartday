import { expect, test } from "@playwright/test";
import { signUp, uniqueEmail } from "./helpers.mjs";

test("the health check reports ok when the database is reachable", async ({ request }) => {
  const response = await request.get("/api/health");

  expect(response.status()).toBe(200);
  expect(await response.json()).toEqual({ status: "ok" });
  expect(response.headers()["cache-control"]).toContain("no-store");
});

test("the monitoring check is hidden from visitors and crashes for signed-in users", async ({
  page,
  request,
}) => {
  // `request` has no cookies: a stranger.
  expect((await request.get("/api/monitoring-check")).status()).toBe(404);

  // page.request shares the signed-in browser's cookies.
  await signUp(page, { email: uniqueEmail("monitoring") });
  expect((await page.request.get("/api/monitoring-check")).status()).toBe(500);
});
