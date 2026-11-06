import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getDb } from "@/db";
import { reminderSettings, user } from "@/db/schema";
import { buildReminderEmail, escapeHtml } from "@/lib/reminder-email";
import { validateReminderSettings } from "@/lib/reminder-validation";
import {
  disableReminders,
  getReminderSettings,
  reminderDueOn,
  saveReminderSettings,
  sendDueReminders,
} from "@/lib/reminders";
import { addTask, clearTasks, toggleTask } from "@/lib/tasks";
import { signUnsubscribe, unsubscribeUrl, verifyUnsubscribe } from "@/lib/unsubscribe-token";

beforeEach(() => {
  vi.stubEnv("BETTER_AUTH_SECRET", "test-secret-for-unsubscribe-links");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("reminderDueOn", () => {
  // 03:00 UTC = 08:30 in India.
  const now = new Date("2026-11-06T03:00:00Z");
  const india = { hour: 8, timeZone: "Asia/Kolkata", lastSentOn: null };

  it("is due from the chosen hour, in the user's time zone", () => {
    expect(reminderDueOn(india, now)).toBe("2026-11-06");
    // 03:00 in UTC is too early for an 8:00 reminder there.
    expect(reminderDueOn({ ...india, timeZone: "UTC" }, now)).toBeNull();
  });

  it("catches up for a few hours, then gives up for the day", () => {
    expect(reminderDueOn({ ...india, hour: 6 }, now)).toBe("2026-11-06");
    expect(reminderDueOn({ ...india, hour: 5 }, now)).toBeNull();
  });

  it("is not due twice on the same day", () => {
    expect(reminderDueOn({ ...india, lastSentOn: "2026-11-06" }, now)).toBeNull();
    expect(reminderDueOn({ ...india, lastSentOn: "2026-11-05" }, now)).toBe("2026-11-06");
  });
});

describe("validateReminderSettings", () => {
  it("reads the checkbox, hour and time zone", () => {
    expect(validateReminderSettings({ enabled: "on", hour: "7", timeZone: "Asia/Kolkata" })).toEqual({
      ok: true,
      enabled: true,
      hour: 7,
      timeZone: "Asia/Kolkata",
    });
    // An unticked checkbox sends nothing at all.
    expect(validateReminderSettings({ enabled: null, hour: "0", timeZone: "Nowhere/Land" })).toEqual({
      ok: true,
      enabled: false,
      hour: 0,
      timeZone: "UTC",
    });
  });

  it("refuses an hour that isn't 0 to 23", () => {
    for (const hour of ["24", "-1", "8.5", "", "eight", null]) {
      expect(validateReminderSettings({ enabled: "on", hour, timeZone: "UTC" }).ok).toBe(false);
    }
  });
});

describe("unsubscribe links", () => {
  it("accept the right signature and nothing else", () => {
    const token = signUnsubscribe("user-1");

    expect(verifyUnsubscribe("user-1", token)).toBe(true);
    expect(verifyUnsubscribe("user-2", token)).toBe(false);
    expect(verifyUnsubscribe("user-1", `${token}x`)).toBe(false);
    expect(verifyUnsubscribe("user-1", "")).toBe(false);
    expect(verifyUnsubscribe(undefined, token)).toBe(false);
  });

  it("change when the secret changes", () => {
    const token = signUnsubscribe("user-1");
    vi.stubEnv("BETTER_AUTH_SECRET", "another-secret");
    expect(verifyUnsubscribe("user-1", token)).toBe(false);
  });

  it("build the full address", () => {
    const url = new URL(unsubscribeUrl("https://example.com", "user-1"));
    expect(url.pathname).toBe("/unsubscribe");
    expect(url.searchParams.get("u")).toBe("user-1");
    expect(verifyUnsubscribe("user-1", url.searchParams.get("t"))).toBe(true);
  });
});

describe("buildReminderEmail", () => {
  const base = {
    name: "Asha Rao",
    today: "2026-11-06",
    appUrl: "https://example.com",
    unsubscribeUrl: "https://example.com/unsubscribe?u=1&t=abc",
  };

  it("lists the tasks and counts the overdue ones", () => {
    const email = buildReminderEmail({
      ...base,
      tasks: [
        { title: "Pay rent", dueDate: "2026-11-04" },
        { title: "Call mum", dueDate: "2026-11-06" },
      ],
    });

    expect(email.subject).toBe("2 tasks for today (1 overdue)");
    expect(email.text).toContain("Hi Asha,");
    expect(email.text).toContain("- Pay rent (overdue since 4 Nov 2026)");
    expect(email.text).toContain("- Call mum (due today)");
    expect(email.text).toContain(base.unsubscribeUrl);
    expect(email.html).toContain("https://example.com/unsubscribe?u=1&amp;t=abc");
  });

  it("escapes task titles in the HTML", () => {
    const email = buildReminderEmail({
      ...base,
      tasks: [{ title: '<img src=x onerror="alert(1)">', dueDate: "2026-11-06" }],
    });

    expect(email.subject).toBe("1 task for today");
    expect(email.html).not.toContain("<img");
    expect(email.html).toContain("&lt;img src=x onerror=&quot;alert(1)&quot;&gt;");
  });

  it("escapes every special character", () => {
    expect(escapeHtml(`<a href="x">Tom & Jerry's</a>`)).toBe(
      "&lt;a href=&quot;x&quot;&gt;Tom &amp; Jerry&#39;s&lt;/a&gt;",
    );
  });
});

describe.skipIf(!process.env.TEST_DATABASE_URL)("reminders (database)", () => {
  const A = "test-user-a";
  const B = "test-user-b";
  // 08:30 in India on 6 Nov 2026.
  const now = new Date("2026-11-06T03:00:00Z");
  const appUrl = "https://example.com";

  beforeEach(async () => {
    await clearTasks();
    await getDb().delete(user);
    await getDb()
      .insert(user)
      .values([
        { id: A, name: "Asha Rao", email: "a@test.example" },
        { id: B, name: "Ben", email: "b@test.example" },
      ]);
  });

  const india = { enabled: true, hour: 8, timeZone: "Asia/Kolkata" };
  const settingsOf = async (userId) =>
    (await getDb().select().from(reminderSettings)).find((row) => row.userId === userId);

  it("is off for someone who never saved the form", async () => {
    expect(await getReminderSettings(A)).toMatchObject({ enabled: false, hour: 8 });
  });

  it("saves, then updates, one row per user", async () => {
    await saveReminderSettings(A, india);
    await saveReminderSettings(A, { ...india, hour: 7 });

    expect(await getReminderSettings(A)).toMatchObject({ enabled: true, hour: 7, timeZone: "Asia/Kolkata" });
    expect(await getDb().select().from(reminderSettings)).toHaveLength(1);
  });

  it("emails what's overdue or due today, once a day, only to people who opted in", async () => {
    await saveReminderSettings(A, india);
    await saveReminderSettings(B, { ...india, enabled: false });
    await addTask(A, "Pay rent", "2026-11-05");
    await addTask(A, "Next week", "2026-11-13");
    const done = await addTask(A, "Already done", "2026-11-06");
    await toggleTask(A, done.id);
    await addTask(B, "Ben's task", "2026-11-06");

    const send = vi.fn(async () => ({ ok: true, id: "email-1" }));
    const result = await sendDueReminders({ appUrl, now, send });

    expect(result).toEqual({ checked: 1, sent: 1, nothingDue: 0, failed: 0 });
    expect(send).toHaveBeenCalledTimes(1);
    const email = send.mock.calls[0][0];
    expect(email.to).toBe("a@test.example");
    expect(email.text).toContain("Pay rent");
    expect(email.text).not.toContain("Next week");
    expect(email.text).not.toContain("Already done");
    expect(email.headers["List-Unsubscribe-Post"]).toBe("List-Unsubscribe=One-Click");
    expect(email.headers["List-Unsubscribe"]).toContain("https://example.com/api/reminders/unsubscribe?u=");
    expect((await settingsOf(A)).lastSentOn).toBe("2026-11-06");

    // The next hourly run the same day sends nothing.
    await sendDueReminders({ appUrl, now: new Date("2026-11-06T04:00:00Z"), send });
    expect(send).toHaveBeenCalledTimes(1);
  });

  it("sends nothing when nothing is due", async () => {
    await saveReminderSettings(A, india);
    await addTask(A, "Next week", "2026-11-13");

    const send = vi.fn();
    const result = await sendDueReminders({ appUrl, now, send });

    expect(result).toMatchObject({ checked: 1, sent: 0, nothingDue: 1 });
    expect(send).not.toHaveBeenCalled();
  });

  it("tries again next hour if sending failed", async () => {
    await saveReminderSettings(A, india);
    await addTask(A, "Pay rent", "2026-11-06");
    vi.spyOn(console, "error").mockImplementation(() => {});

    const failing = vi.fn(async () => ({ ok: false, error: "500" }));
    expect(await sendDueReminders({ appUrl, now, send: failing })).toMatchObject({ failed: 1 });
    expect((await settingsOf(A)).lastSentOn).toBeNull();

    const working = vi.fn(async () => ({ ok: true }));
    expect(await sendDueReminders({ appUrl, now, send: working })).toMatchObject({ sent: 1 });
  });

  it("stops after unsubscribing", async () => {
    await saveReminderSettings(A, india);
    await addTask(A, "Pay rent", "2026-11-06");

    expect(await disableReminders(A)).toBe(true);
    const send = vi.fn();
    expect(await sendDueReminders({ appUrl, now, send })).toMatchObject({ checked: 0 });
    // Someone with no settings at all: nothing to switch off.
    expect(await disableReminders(B)).toBe(false);
  });
});
