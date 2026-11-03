// Since Sentry SDK v11, the build-time helper lives in its own entry point,
// separate from the runtime SDK. It's a CommonJS module, so take the default
// export and pick withSentryConfig out of it.
import sentryConfig from "@sentry/nextjs/config";

const { withSentryConfig } = sentryConfig;

/** @type {import('next').NextConfig} */
const nextConfig = {
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

// withSentryConfig adds Sentry to the build. Its main job is source maps:
// production JavaScript is minified (short names, one long line), so a raw
// stack trace is unreadable. Source maps translate it back to our real files
// and line numbers. They're uploaded to Sentry and then deleted from the
// build, so they're never public.
//
// Uploading needs SENTRY_AUTH_TOKEN, SENTRY_ORG and SENTRY_PROJECT. Those only
// exist in the GitHub Actions deploy job, so local builds and the E2E test
// build skip source maps entirely.
export default withSentryConfig(nextConfig, {
  // Only print upload logs in CI, where they're useful for debugging.
  silent: !process.env.CI,
  // Don't send Sentry usage statistics about our build.
  telemetry: false,
  sourcemaps: {
    disable: !process.env.SENTRY_AUTH_TOKEN,
    deleteSourcemapsAfterUpload: true,
  },
});
