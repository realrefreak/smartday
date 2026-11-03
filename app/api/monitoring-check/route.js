// GET /api/monitoring-check: crashes on purpose, to prove that errors on the
// live site really reach Sentry. Visit it once after setting Sentry up, then
// look for "Monitoring check" in Sentry's Issues list.
//
// Only works for signed-in users, so strangers can't use it to flood our
// Sentry quota with fake errors. Everyone else gets a plain 404.

import { getCurrentUser } from "@/lib/session";

// Route files should only export request handlers (GET, POST, ...), so this
// stays private. Its own name makes the test error easy to spot in Sentry.
class MonitoringCheckError extends Error {
  name = "MonitoringCheckError";
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return new Response("Not found", { status: 404 });
  }

  // Not caught anywhere: Next.js returns a 500 and calls onRequestError
  // (instrumentation.js), which sends this to Sentry.
  throw new MonitoringCheckError(
    "Monitoring check: this error was thrown on purpose to test Sentry.",
  );
}
