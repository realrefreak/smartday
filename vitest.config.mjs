import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
import { getTestDatabaseUrl } from "./tests/test-env.mjs";

const testDatabaseUrl = getTestDatabaseUrl();

export default defineConfig({
  resolve: {
    // Same "@/" shortcut as jsconfig.json, so tests can import "@/lib/tasks".
    alias: {
      "@": fileURLToPath(new URL(".", import.meta.url)),
    },
  },
  test: {
    // Our code runs on the server, so tests run in plain Node (no browser).
    environment: "node",
    include: ["tests/**/*.test.js"],
    globalSetup: ["./tests/global-setup.mjs"],
    // Run test files one after another, not side by side: the database test
    // files share one test database, and each starts by wiping it.
    fileParallelism: false,
    env: {
      // The app code reads DATABASE_URL, so inside tests point it at the test
      // database. Empty string = no database (database tests are skipped).
      DATABASE_URL: testDatabaseUrl,
      TEST_DATABASE_URL: testDatabaseUrl,
    },
  },
});
