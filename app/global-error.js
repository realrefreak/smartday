"use client";
// The last line of defence: shown when the root layout itself crashes, so
// app/error.js (which lives inside that layout) can't be used. It replaces the
// whole page, so it needs its own <html> and <body>, and our global CSS
// doesn't apply here: hence the plain inline styles.

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";

export default function GlobalError({ error, retry }) {
  useEffect(() => {
    // Same rule as app/error.js: server errors were already reported.
    if (!error?.digest) {
      Sentry.captureException(error);
    }
  }, [error]);

  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", padding: "2rem", maxWidth: "40rem" }}>
        <title>Something went wrong · SmartDay</title>
        <h1>Something went wrong</h1>
        <p>Sorry about that. The problem has been reported. Please try again.</p>
        <button type="button" onClick={() => retry()}>
          Try again
        </button>
      </body>
    </html>
  );
}
