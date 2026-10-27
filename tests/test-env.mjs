// Works out which database the tests may use. Shared by vitest.config.mjs
// and tests/global-setup.js so both apply the same rules.
//
// Rules:
// - Tests only ever use TEST_DATABASE_URL, never your real DATABASE_URL.
// - If TEST_DATABASE_URL is missing, database tests are skipped (unit tests still run).
// - If TEST_DATABASE_URL is the same as DATABASE_URL, refuse to run at all.

import { existsSync, readFileSync } from "node:fs";
import { parseEnv } from "node:util";

function readEnvFile(path) {
  return existsSync(path) ? parseEnv(readFileSync(path, "utf8")) : {};
}

export function getTestDatabaseUrl() {
  // Values already in the environment win (that's how CI will provide them);
  // otherwise fall back to .env.local on your machine.
  const fileEnv = readEnvFile(".env.local");
  const testUrl = process.env.TEST_DATABASE_URL || fileEnv.TEST_DATABASE_URL || "";
  const realUrl = process.env.DATABASE_URL || fileEnv.DATABASE_URL || "";

  if (testUrl && testUrl === realUrl) {
    throw new Error(
      "TEST_DATABASE_URL is the same as DATABASE_URL. Tests delete data, so they " +
        "need their own database (e.g. a Neon branch named 'test')."
    );
  }

  return testUrl;
}
