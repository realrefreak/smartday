// Settings shared by every place Sentry starts: the Node.js server, the edge
// runtime and the browser. Kept in one place so they can't drift apart.
//
// Sentry is error tracking: when something crashes, it records the error with
// its stack trace and context, groups repeats together, and can email you.

export function sentryOptions() {
  // The DSN tells the SDK which Sentry project to send to. It isn't a secret
  // (it ends up in the browser's JavaScript anyway), but it's only set on
  // Vercel's Production environment. Locally, in tests and in preview
  // deployments it's missing, so nothing is sent from there.
  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

  return {
    dsn,
    enabled: Boolean(dsn),

    // "production" for built apps, "development" for `next dev`, so the two
    // never get mixed up in Sentry if you ever set the DSN locally.
    environment: process.env.NODE_ENV,

    // Privacy: don't attach IP addresses, cookies or request bodies (which
    // could contain passwords from the sign-in form). We can still find the
    // problem from the stack trace and the URL.
    sendDefaultPii: false,

    // Performance tracing records how long requests take. Sampling 10% gives
    // a good picture without using up the free plan's quota.
    tracesSampleRate: 0.1,
  };
}
