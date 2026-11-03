// Removes every user from a brand-new preview database.
//
// Preview databases start as a copy of production, because production is the
// only database guaranteed to have exactly main's migrations applied (and
// Drizzle decides what to run from its record of applied migrations). But a
// preview shouldn't hold real people's data, so right after copying, we
// delete all users. Their sessions, accounts and tasks go too ("on delete
// cascade" in the schema). The tables and migration records stay.
//
// Run only by the CI preview job, on a database it has just created:
//   PREVIEW_BRANCH=preview/pr-12 DATABASE_URL=... node scripts/wipe-preview-users.mjs

import { neon } from "@neondatabase/serverless";

const branch = process.env.PREVIEW_BRANCH ?? "";
const url = process.env.DATABASE_URL;

// Safety catch: refuse unless we're clearly told this is a preview branch.
if (!branch.startsWith("preview/")) {
  console.error(`Refusing to wipe users: PREVIEW_BRANCH must start with "preview/" (got "${branch}").`);
  process.exit(1);
}

if (!url) {
  console.error("Refusing to wipe users: DATABASE_URL is not set.");
  process.exit(1);
}

const sql = neon(url);
const deleted = await sql`delete from "user" returning id`;
console.log(`Removed ${deleted.length} copied user(s) from ${branch}.`);
