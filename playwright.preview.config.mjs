// Runs the same E2E tests against a deployed pull request preview on Vercel,
// instead of a local build. Used by the preview-and-ship agent:
//
//   PREVIEW_URL=https://smartday-abc123.vercel.app npm run test:preview
//
// The preview has its own throwaway database (deleted when the pull request
// closes), so there's no setup or cleanup step here.

import { existsSync, readFileSync } from "node:fs";
import { parseEnv } from "node:util";
import { defineConfig, devices } from "@playwright/test";

const fileEnv = existsSync(".env.local") ? parseEnv(readFileSync(".env.local", "utf8")) : {};

const previewUrl = process.env.PREVIEW_URL ?? "";
if (!/^https:\/\/[a-z0-9-]+\.vercel\.app$/.test(previewUrl)) {
  throw new Error("Set PREVIEW_URL to the preview's https://<name>.vercel.app address.");
}

// Previews sit behind Vercel's login ("Deployment Protection"). This secret,
// sent as a header, lets automated tests through. It lives in .env.local
// (never committed); see Vercel > Settings > Deployment Protection >
// Protection Bypass for Automation.
const bypassSecret =
  process.env.VERCEL_AUTOMATION_BYPASS_SECRET || fileEnv.VERCEL_AUTOMATION_BYPASS_SECRET || "";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  // Gentler than local runs: a fresh preview and its database start "cold".
  workers: 3,
  retries: 1,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  reporter: "list",
  outputDir: "test-results/preview",

  use: {
    baseURL: previewUrl,
    trace: "retain-on-failure",
    extraHTTPHeaders: bypassSecret ? { "x-vercel-protection-bypass": bypassSecret } : {},
  },

  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
