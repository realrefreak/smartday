// The single place that connects to the database.

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";

let db;

// Create the connection the first time it is needed, not when this file is
// imported. That way `next build` and tests that never touch the database
// work without DATABASE_URL being set.
export function getDb() {
  if (!db) {
    const url = process.env.DATABASE_URL;

    if (!url) {
      throw new Error("DATABASE_URL is not set. See .env.example.");
    }

    // neon() sends each query over HTTPS: a good fit for serverless hosting,
    // where there is no long-lived server to hold a connection open.
    db = drizzle({ client: neon(url) });
  }

  return db;
}
