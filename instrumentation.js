// Next.js runs this file once when a server starts, before it handles any
// requests. It's the official place to plug in monitoring tools.

import * as Sentry from "@sentry/nextjs";

export async function register() {
  // Next.js has two server runtimes (Node.js and the lighter "edge"). Our
  // settings are the same for both, so both load the same config file.
  if (process.env.NEXT_RUNTIME === "nodejs" || process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.server.config.js");
  }
}

// Next.js calls this for every error thrown while handling a request: in a
// page, a Server Action, a Route Handler or the proxy. Sentry records it along
// with which route and what kind of request it was.
export const onRequestError = Sentry.captureRequestError;
