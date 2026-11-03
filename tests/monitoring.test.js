import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Fakes: no real Sentry, database or session in these unit tests.
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));
vi.mock("@/db", () => ({ getDb: vi.fn() }));
vi.mock("@/lib/session", () => ({ getCurrentUser: vi.fn() }));

import * as Sentry from "@sentry/nextjs";
import { getDb } from "@/db";
import { getCurrentUser } from "@/lib/session";
import { sentryOptions } from "@/lib/sentry-options";
import { GET as health } from "@/app/api/health/route";
import { GET as monitoringCheck } from "@/app/api/monitoring-check/route";

describe("sentryOptions", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("is switched off when no DSN is set (local, tests, previews)", () => {
    vi.stubEnv("NEXT_PUBLIC_SENTRY_DSN", "");

    expect(sentryOptions().enabled).toBe(false);
  });

  it("is switched on when a DSN is set (production)", () => {
    vi.stubEnv("NEXT_PUBLIC_SENTRY_DSN", "https://key@o1.ingest.sentry.io/1");

    expect(sentryOptions()).toMatchObject({
      enabled: true,
      dsn: "https://key@o1.ingest.sentry.io/1",
    });
  });

  it("never sends personal data like cookies, IPs or form bodies", () => {
    expect(sentryOptions().sendDefaultPii).toBe(false);
  });
});

describe("GET /api/health", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("says ok when the database answers, and is never cached", async () => {
    getDb.mockReturnValue({ execute: vi.fn().mockResolvedValue([]) });

    const response = await health();

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "ok" });
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });

  it("returns 503 without details when the database is down, and reports it", async () => {
    const failure = new Error("connect ECONNREFUSED secret-host.neon.tech");
    getDb.mockReturnValue({ execute: vi.fn().mockRejectedValue(failure) });

    const response = await health();

    expect(response.status).toBe(503);
    // The public response must not leak the real error (it names our host).
    expect(await response.json()).toEqual({ status: "error" });
    expect(Sentry.captureException).toHaveBeenCalledWith(failure);
  });
});

describe("GET /api/monitoring-check", () => {
  it("is a plain 404 for visitors who aren't signed in", async () => {
    getCurrentUser.mockResolvedValue(null);

    const response = await monitoringCheck();

    expect(response.status).toBe(404);
  });

  it("throws the deliberate test error for signed-in users", async () => {
    getCurrentUser.mockResolvedValue({ id: "user-1" });

    await expect(monitoringCheck()).rejects.toThrow(/thrown on purpose to test Sentry/);
  });
});
