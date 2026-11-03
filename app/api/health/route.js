// GET /api/health: "is the app up, and can it reach its database?"
//
// An uptime monitor (Sentry Uptime) calls this every minute or so and alerts
// you if it fails. Error tracking only sees crashes that happen while someone
// is using the app; this notices when the whole site is down, even at 3 AM
// with no visitors.
//
// Public on purpose (monitors can't sign in), so it reveals nothing beyond
// ok/error: no versions, no error messages, no counts.

import * as Sentry from "@sentry/nextjs";
import { sql } from "drizzle-orm";
import { getDb } from "@/db";

// Never cache: a cached "ok" would hide an outage.
const NO_CACHE = { "Cache-Control": "no-store" };

export async function GET() {
  try {
    // The smallest possible query: proves the connection works.
    await getDb().execute(sql`select 1`);
    return Response.json({ status: "ok" }, { headers: NO_CACHE });
  } catch (error) {
    // We catch the error to return a clean 503, which means Next.js never
    // sees it, so report it to Sentry ourselves.
    Sentry.captureException(error);
    return Response.json({ status: "error" }, { status: 503, headers: NO_CACHE });
  }
}
