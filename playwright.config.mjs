// Playwright: end-to-end ("E2E") tests that drive a real browser against a
// real, production-built copy of the app.

import { defineConfig, devices } from "@playwright/test";
import { getTestDatabaseUrl } from "./tests/test-env.mjs";

const PORT = 3100;
const BASE_URL = `http://localhost:${PORT}`;

// Safety first: the app under test must use the TEST database. Without this,
// the server would fall back to DATABASE_URL in .env.local: your real data.
const testDatabaseUrl = getTestDatabaseUrl();
if (!testDatabaseUrl) {
  throw new Error("E2E tests need TEST_DATABASE_URL (see .env.example).");
}

export default defineConfig({
  testDir: "./e2e",
  // Tests share one database, but each signs up its own unique user, so they
  // can run in parallel without interfering.
  fullyParallel: true,
  // Fail CI if someone accidentally commits test.only.
  forbidOnly: !!process.env.CI,
  // Retry once on CI to smooth over rare network hiccups; never locally.
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",

  use: {
    baseURL: BASE_URL,
    // On failure, keep a trace (timeline, screenshots, network) to debug with:
    //   npx playwright show-trace test-results/<test>/trace.zip
    trace: "retain-on-failure",
  },

  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],

  // Apply database migrations to the test database first (same as Vitest),
  // and remove the users these tests created afterwards.
  globalSetup: "./tests/global-setup.mjs",
  globalTeardown: "./e2e/global-teardown.mjs",

  // Build and start the app like production, wired to the test database.
  webServer: {
    command: `npm run build && npm run start -- -p ${PORT}`,
    url: BASE_URL,
    timeout: 180_000,
    // Never reuse a server that's already running: it might use your real database.
    reuseExistingServer: false,
    env: {
      DATABASE_URL: testDatabaseUrl,
      BETTER_AUTH_URL: BASE_URL,
    },
  },
});
