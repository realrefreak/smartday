// Handles every request under /api/auth/* (sign-up, sign-in, sign-out, session...).
// [...all] is a "catch-all" route: it matches any path after /api/auth/.

import { toNextJsHandler } from "better-auth/next-js";
import { getAuth } from "@/lib/auth";

// getAuth() is called per request (not at import) so builds don't need a database.
export async function GET(request) {
  return toNextJsHandler(getAuth()).GET(request);
}

export async function POST(request) {
  return toNextJsHandler(getAuth()).POST(request);
}
