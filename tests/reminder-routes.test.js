import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// The routes' work is tested in reminders.test.js; here only who may call them.
vi.mock("@/lib/reminders", () => ({
  sendDueReminders: vi.fn(async () => ({ checked: 0, sent: 0, nothingDue: 0, failed: 0 })),
  disableReminders: vi.fn(async () => true),
}));
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));

import { disableReminders, sendDueReminders } from "@/lib/reminders";
import { POST as runReminders } from "@/app/api/cron/reminders/route";
import { POST as oneClickUnsubscribe } from "@/app/api/reminders/unsubscribe/route";
import { signUnsubscribe } from "@/lib/unsubscribe-token";

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("CRON_SECRET", "a-long-random-cron-secret");
  vi.stubEnv("BETTER_AUTH_SECRET", "test-secret-for-unsubscribe-links");
  vi.stubEnv("BETTER_AUTH_URL", "https://smartday.example");
  vi.spyOn(console, "info").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
});

function cronRequest(authorization) {
  const headers = authorization ? { authorization } : {};
  return new Request("http://localhost/api/cron/reminders", { method: "POST", headers });
}

describe("POST /api/cron/reminders", () => {
  it("runs with the right secret", async () => {
    const response = await runReminders(cronRequest("Bearer a-long-random-cron-secret"));

    expect(response.status).toBe(200);
    expect(sendDueReminders).toHaveBeenCalledWith({ appUrl: "https://smartday.example" });
  });

  it("refuses a wrong or missing secret", async () => {
    for (const header of [undefined, "Bearer wrong", "a-long-random-cron-secret"]) {
      expect((await runReminders(cronRequest(header))).status).toBe(401);
    }
    expect(sendDueReminders).not.toHaveBeenCalled();
  });

  it("refuses everything when no secret is configured", async () => {
    vi.stubEnv("CRON_SECRET", "");
    expect((await runReminders(cronRequest("Bearer "))).status).toBe(401);
    expect(sendDueReminders).not.toHaveBeenCalled();
  });
});

describe("POST /api/reminders/unsubscribe", () => {
  const url = (u, t) =>
    `http://localhost/api/reminders/unsubscribe?${new URLSearchParams({ u, t })}`;

  it("switches reminders off with a valid link", async () => {
    const response = await oneClickUnsubscribe(new Request(url("user-1", signUnsubscribe("user-1")), { method: "POST" }));

    expect(response.status).toBe(200);
    expect(disableReminders).toHaveBeenCalledWith("user-1");
  });

  it("refuses a forged link", async () => {
    const response = await oneClickUnsubscribe(new Request(url("user-2", signUnsubscribe("user-1")), { method: "POST" }));

    expect(response.status).toBe(400);
    expect(disableReminders).not.toHaveBeenCalled();
  });
});
