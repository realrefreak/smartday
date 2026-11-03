// Starts Sentry on the server (Server Components, Server Actions, Route
// Handlers, proxy.js). Loaded by register() in instrumentation.js.

import * as Sentry from "@sentry/nextjs";
import { sentryOptions } from "./lib/sentry-options.js";

Sentry.init(sentryOptions());
