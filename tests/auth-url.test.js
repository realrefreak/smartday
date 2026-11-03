import { describe, expect, it } from "vitest";
import { authUrlOptions } from "@/lib/auth-url";

describe("authUrlOptions", () => {
  it("uses the fixed BETTER_AUTH_URL in production", () => {
    const options = authUrlOptions({
      VERCEL_ENV: "production",
      BETTER_AUTH_URL: "https://smartday-one.vercel.app",
      VERCEL_URL: "smartday-abc123.vercel.app",
    });

    expect(options).toEqual({ baseURL: "https://smartday-one.vercel.app" });
  });

  it("uses BETTER_AUTH_URL locally, where Vercel's variables don't exist", () => {
    expect(authUrlOptions({ BETTER_AUTH_URL: "http://localhost:3000" })).toEqual({
      baseURL: "http://localhost:3000",
    });
  });

  it("trusts exactly this preview's own addresses", () => {
    const options = authUrlOptions({
      VERCEL_ENV: "preview",
      VERCEL_URL: "smartday-abc123.vercel.app",
      VERCEL_BRANCH_URL: "smartday-git-feature-aryak.vercel.app",
      // Ignored on previews: it's the production address.
      BETTER_AUTH_URL: "https://smartday-one.vercel.app",
    });

    expect(options).toEqual({
      baseURL: {
        allowedHosts: ["smartday-abc123.vercel.app", "smartday-git-feature-aryak.vercel.app"],
        fallback: "https://smartday-abc123.vercel.app",
      },
      trustedOrigins: [
        "https://smartday-abc123.vercel.app",
        "https://smartday-git-feature-aryak.vercel.app",
      ],
    });
  });

  it("never trusts every vercel.app site", () => {
    const options = authUrlOptions({ VERCEL_ENV: "preview", VERCEL_URL: "smartday-abc123.vercel.app" });

    expect(JSON.stringify(options)).not.toContain("*");
  });

  it("works when Vercel provides no branch address", () => {
    const options = authUrlOptions({ VERCEL_ENV: "preview", VERCEL_URL: "smartday-abc123.vercel.app" });

    expect(options.baseURL.allowedHosts).toEqual(["smartday-abc123.vercel.app"]);
  });
});
