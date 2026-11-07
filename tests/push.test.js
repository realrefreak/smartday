import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getDb } from "@/db";
import { pushSubscriptions, reminderSettings, user } from "@/db/schema";
import { buildReminderNotification, validateSubscription } from "@/lib/push-message";
import { notifyUser, removeSubscription, saveSubscription, sendDuePushReminders } from "@/lib/push";
import { saveReminderSettings, sendDueReminders } from "@/lib/reminders";
import { addTask, clearTasks } from "@/lib/tasks";

// The email part signs its unsubscribe links with this.
beforeEach(() => {
  vi.stubEnv("BETTER_AUTH_SECRET", "test-secret-for-unsubscribe-links");
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

const device = (name) => ({
  endpoint: `https://push.example.com/send/${name}`,
  p256dh: "BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u",
  auth: "tBHItJI5svbpez7KI4CCXg",
});

describe("validateSubscription", () => {
  const good = { endpoint: device("a").endpoint, keys: { p256dh: device("a").p256dh, auth: device("a").auth } };

  it("accepts what a browser sends", () => {
    expect(validateSubscription(good)).toEqual({ ok: true, ...device("a") });
  });

  it("refuses anything else", () => {
    const bad = [
      null,
      "text",
      { ...good, endpoint: "http://push.example.com/x" },
      { ...good, endpoint: "javascript:alert(1)" },
      { ...good, endpoint: `https://x.example/${"a".repeat(1000)}` },
      { ...good, keys: undefined },
      { ...good, keys: { p256dh: "has spaces in it", auth: good.keys.auth } },
      { ...good, keys: { p256dh: good.keys.p256dh, auth: 42 } },
    ];
    for (const input of bad) {
      expect(validateSubscription(input).ok).toBe(false);
    }
  });
});

describe("buildReminderNotification", () => {
  const today = "2026-11-06";

  it("counts the tasks, the overdue ones, and lists a few", () => {
    const tasks = [
      { title: "Pay rent", dueDate: "2026-11-04" },
      { title: "Call mum", dueDate: "2026-11-06" },
      { title: "Gym", dueDate: "2026-11-06" },
      { title: "Read", dueDate: "2026-11-06" },
      { title: "Cook", dueDate: "2026-11-06" },
    ];
    expect(buildReminderNotification({ tasks, today })).toEqual({
      title: "5 tasks for today",
      body: "1 overdue · Pay rent, Call mum, Gym and 2 more",
      url: "/tasks?show=today",
    });
  });

  it("keeps it short for one task", () => {
    expect(buildReminderNotification({ tasks: [{ title: "Gym", dueDate: today }], today })).toMatchObject({
      title: "1 task for today",
      body: "Gym",
    });
  });
});

describe.skipIf(!process.env.TEST_DATABASE_URL)("notifications (database)", () => {
  const A = "test-user-a";
  const B = "test-user-b";
  // 08:30 in India on 6 Nov 2026.
  const now = new Date("2026-11-06T03:00:00Z");

  beforeEach(async () => {
    await clearTasks();
    await getDb().delete(user);
    await getDb()
      .insert(user)
      .values([
        { id: A, name: "Asha", email: "a@test.example" },
        { id: B, name: "Ben", email: "b@test.example" },
      ]);
  });

  const devicesOf = async (userId) =>
    (await getDb().select().from(pushSubscriptions)).filter((row) => row.userId === userId);
  const settingsOf = async (userId) =>
    (await getDb().select().from(reminderSettings)).find((row) => row.userId === userId);

  it("saves a device, with reminder settings that keep email off", async () => {
    await saveSubscription(A, device("phone"), "Asia/Kolkata");

    expect(await devicesOf(A)).toHaveLength(1);
    expect(await settingsOf(A)).toMatchObject({ enabled: false, hour: 8, timeZone: "Asia/Kolkata" });
  });

  it("doesn't touch settings the user already chose", async () => {
    await saveReminderSettings(A, { enabled: true, hour: 7, timeZone: "Europe/London" });
    await saveSubscription(A, device("phone"), "Asia/Kolkata");

    expect(await settingsOf(A)).toMatchObject({ enabled: true, hour: 7, timeZone: "Europe/London" });
  });

  it("moves a browser to whoever turned notifications on last", async () => {
    await saveSubscription(A, device("shared-laptop"), "UTC");
    await saveSubscription(B, device("shared-laptop"), "UTC");

    expect(await devicesOf(A)).toHaveLength(0);
    expect(await devicesOf(B)).toHaveLength(1);
  });

  it("only removes your own devices", async () => {
    await saveSubscription(A, device("phone"), "UTC");

    expect(await removeSubscription(B, device("phone").endpoint)).toBe(false);
    expect(await removeSubscription(A, device("phone").endpoint)).toBe(true);
    expect(await devicesOf(A)).toHaveLength(0);
  });

  it("forgets devices the push service says are gone", async () => {
    await saveSubscription(A, device("phone"), "UTC");
    await saveSubscription(A, device("old-laptop"), "UTC");
    const send = vi.fn(async (target) =>
      target.endpoint.endsWith("old-laptop") ? { ok: false, gone: true, error: "410" } : { ok: true },
    );

    expect(await notifyUser(A, { title: "Hi" }, send)).toEqual({ devices: 2, delivered: 1, removed: 1 });
    expect((await devicesOf(A)).map((row) => row.endpoint)).toEqual([device("phone").endpoint]);
  });

  it("notifies each device once a day, at the reminder time, when something's due", async () => {
    await saveSubscription(A, device("phone"), "Asia/Kolkata");
    await saveSubscription(A, device("laptop"), "Asia/Kolkata");
    await saveSubscription(B, device("ben"), "Asia/Kolkata");
    await addTask(A, "Pay rent", "2026-11-05");
    await addTask(B, "Next week", "2026-11-13");

    const send = vi.fn(async () => ({ ok: true }));
    expect(await sendDuePushReminders({ now, send })).toEqual({ checked: 2, sent: 1, nothingDue: 1, failed: 0 });
    expect(send).toHaveBeenCalledTimes(2);
    expect(send.mock.calls[0][1]).toMatchObject({ title: "1 task for today", body: "1 overdue · Pay rent" });

    // The next hourly run that day sends nothing more.
    await sendDuePushReminders({ now: new Date("2026-11-06T04:00:00Z"), send });
    expect(send).toHaveBeenCalledTimes(2);
  });

  it("tries again next hour if every device failed", async () => {
    await saveSubscription(A, device("phone"), "Asia/Kolkata");
    await addTask(A, "Pay rent", "2026-11-06");
    vi.spyOn(console, "error").mockImplementation(() => {});

    const failing = vi.fn(async () => ({ ok: false, gone: false, error: "500" }));
    expect(await sendDuePushReminders({ now, send: failing })).toMatchObject({ failed: 1 });
    expect((await settingsOf(A)).pushLastSentOn).toBeNull();

    const working = vi.fn(async () => ({ ok: true }));
    expect(await sendDuePushReminders({ now, send: working })).toMatchObject({ sent: 1 });
  });

  it("isn't held back by a failing email", async () => {
    await saveReminderSettings(A, { enabled: true, hour: 8, timeZone: "Asia/Kolkata" });
    await saveSubscription(A, device("phone"), "Asia/Kolkata");
    await addTask(A, "Pay rent", "2026-11-06");
    vi.spyOn(console, "error").mockImplementation(() => {});

    const failingEmail = vi.fn(async () => ({ ok: false, error: "403" }));
    const push = vi.fn(async () => ({ ok: true }));
    for (const hour of ["03:00", "04:00"]) {
      const at = new Date(`2026-11-06T${hour}:00Z`);
      await sendDueReminders({ appUrl: "https://example.com", now: at, send: failingEmail });
      await sendDuePushReminders({ now: at, send: push });
    }

    // Email keeps retrying; the notification went out exactly once.
    expect(failingEmail).toHaveBeenCalledTimes(2);
    expect(push).toHaveBeenCalledTimes(1);
  });
});
