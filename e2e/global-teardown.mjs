// Runs once after all E2E tests: deletes the users they signed up (their tasks
// and sessions are deleted with them, thanks to "on delete cascade").

import { neon } from "@neondatabase/serverless";
import { getTestDatabaseUrl } from "../tests/test-env.mjs";

export default async function teardown() {
  const url = getTestDatabaseUrl();
  if (!url) return;

  const sql = neon(url);
  await sql.query(`delete from "user" where email like $1`, ["e2e-%@example.com"]);
}
