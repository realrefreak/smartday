// Runs once before all tests: brings the test database's tables up to date by
// applying any migrations in ./drizzle it hasn't run yet.

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { migrate } from "drizzle-orm/neon-http/migrator";
import { getTestDatabaseUrl } from "./test-env.mjs";

export default async function setup() {
  const url = getTestDatabaseUrl();

  if (!url) {
    console.warn("TEST_DATABASE_URL not set: database tests will be skipped.");
    return;
  }

  const db = drizzle({ client: neon(url) });
  await migrate(db, { migrationsFolder: "./drizzle" });
}
