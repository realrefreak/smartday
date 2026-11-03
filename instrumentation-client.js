// Next.js runs this file in the browser before the app starts, so Sentry can
// catch errors that happen on the user's device (in Client Components).

import * as Sentry from "@sentry/nextjs";
import { sentryOptions } from "./lib/sentry-options.js";

Sentry.init(sentryOptions());

// Lets Sentry time page-to-page navigations (part of performance tracing).
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
