"use client";
// Shown instead of a page when something on it crashes, so the user sees a
// friendly message (inside the normal layout) instead of a blank screen.
// Error boundaries must be Client Components.

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";

export default function Error({ error, retry }) {
  useEffect(() => {
    // Errors from the server arrive here with a `digest` (an id) and were
    // already reported by onRequestError in instrumentation.js. Only errors
    // thrown in the browser need reporting here; this avoids duplicates.
    if (!error?.digest) {
      Sentry.captureException(error);
    }
  }, [error]);

  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-semibold">Something went wrong</h1>
      <p className="text-zinc-600 dark:text-zinc-400">
        Sorry about that. The problem has been reported. Please try again.
      </p>
      {/* retry() re-fetches and re-renders the page: often enough for a
          temporary problem like a dropped database connection. */}
      <button
        type="button"
        onClick={() => retry()}
        className="rounded bg-foreground px-4 py-2 text-background"
      >
        Try again
      </button>
    </section>
  );
}
