// Notifications on the user's phone or computer ("web push"): saving which
// devices said yes, sending to them, and the hourly job's daily reminder.
//
// How web push works: the browser subscribes with a push service run by
// its maker (Google for Chrome, Apple for Safari, Mozilla for Firefox) and
// gives us an address there. To notify that device we send an encrypted
// message to the address, signed with our VAPID key so the push service
// knows it's really us. The service wakes the device, and our service
// worker (public/sw.js) shows the notification, even with SmartDay closed.

import { and, eq, exists, isNull, ne, or, sql } from "drizzle-orm";
import webpush from "web-push";
import { getDb } from "@/db";
import { pushSubscriptions, reminderSettings } from "@/db/schema";
import { buildReminderNotification } from "@/lib/push-message";
import { DEFAULT_REMINDER_HOUR, reminderDueOn } from "@/lib/reminders";
import { listTasks } from "@/lib/tasks";

function assertUserId(userId) {
  if (typeof userId !== "string" || userId.length === 0) {
    throw new Error("A userId is required for notifications.");
  }
}

// The public half of the key pair. Browsers need it to subscribe; it's safe
// to show. Empty when notifications aren't set up on this server.
export function pushPublicKey() {
  return process.env.VAPID_PUBLIC_KEY ?? "";
}

export function isPushConfigured() {
  return Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
}

// Saves this browser's subscription for the user. Also makes sure the user
// has a reminder settings row (off for email), since that's where the
// reminder time and their time zone live.
export async function saveSubscription(userId, { endpoint, p256dh, auth }, timeZone) {
  assertUserId(userId);

  await getDb().batch([
    getDb()
      .insert(pushSubscriptions)
      .values({ userId, endpoint, p256dh, auth })
      // Same browser again (maybe now someone else signed in): update it.
      .onConflictDoUpdate({ target: pushSubscriptions.endpoint, set: { userId, p256dh, auth } }),
    getDb()
      .insert(reminderSettings)
      .values({ userId, enabled: false, hour: DEFAULT_REMINDER_HOUR, timeZone })
      .onConflictDoNothing({ target: reminderSettings.userId }),
  ]);
}

// Removes one of the user's devices. Returns true if there was one.
export async function removeSubscription(userId, endpoint) {
  assertUserId(userId);

  const rows = await getDb()
    .delete(pushSubscriptions)
    .where(and(eq(pushSubscriptions.userId, userId), eq(pushSubscriptions.endpoint, endpoint)))
    .returning({ id: pushSubscriptions.id });
  return rows.length > 0;
}

export async function listSubscriptions(userId) {
  assertUserId(userId);
  return getDb().select().from(pushSubscriptions).where(eq(pushSubscriptions.userId, userId));
}

// Sends one notification to one device. Never throws:
//   { ok: true }, or { ok: false, gone, error }
// gone = the push service says this subscription no longer exists (the user
// blocked notifications, or uninstalled the app). Those rows get deleted.
export async function sendPush(subscription, payload) {
  if (!isPushConfigured()) {
    // Like email without RESEND_API_KEY: log instead of sending.
    console.info("push_dry_run", { title: payload.title });
    return { ok: true, dryRun: true };
  }

  try {
    await webpush.sendNotification(
      { endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } },
      JSON.stringify(payload),
      {
        vapidDetails: {
          subject: process.env.VAPID_SUBJECT || "https://smartday-one.vercel.app",
          publicKey: process.env.VAPID_PUBLIC_KEY,
          privateKey: process.env.VAPID_PRIVATE_KEY,
        },
        // If the device is off, the push service keeps it this long (6 hours).
        TTL: 6 * 60 * 60,
      },
    );
    return { ok: true };
  } catch (error) {
    const status = error?.statusCode;
    return { ok: false, gone: status === 404 || status === 410, error: status ? `${status}` : (error?.name ?? "push_failed") };
  }
}

// Sends `payload` to every device of the user, removing dead ones.
// Returns { devices, delivered, removed }.
export async function notifyUser(userId, payload, send = sendPush) {
  const devices = await listSubscriptions(userId);
  const result = { devices: devices.length, delivered: 0, removed: 0 };

  for (const device of devices) {
    const sent = await send(device, payload);
    if (sent.ok) {
      result.delivered += 1;
    } else if (sent.gone) {
      await getDb().delete(pushSubscriptions).where(eq(pushSubscriptions.id, device.id));
      result.removed += 1;
    } else {
      console.error("push_send_failed", { userId, error: sent.error });
    }
  }
  return result;
}

// Same idea as claim() in lib/reminders.js, on its own column.
async function claim(userId, today) {
  const rows = await getDb()
    .update(reminderSettings)
    .set({ pushLastSentOn: today })
    .where(
      and(
        eq(reminderSettings.userId, userId),
        or(isNull(reminderSettings.pushLastSentOn), ne(reminderSettings.pushLastSentOn, today)),
      ),
    )
    .returning({ userId: reminderSettings.userId });
  return rows.length > 0;
}

async function unclaim(userId, previous) {
  await getDb().update(reminderSettings).set({ pushLastSentOn: previous }).where(eq(reminderSettings.userId, userId));
}

// The hourly job's notification part: everyone with at least one device,
// at their reminder time. Returns { checked, sent, nothingDue, failed }.
export async function sendDuePushReminders({ now = new Date(), send = sendPush } = {}) {
  const hasDevice = exists(
    getDb()
      .select({ one: sql`1` })
      .from(pushSubscriptions)
      .where(eq(pushSubscriptions.userId, reminderSettings.userId)),
  );
  const candidates = await getDb()
    .select({
      userId: reminderSettings.userId,
      hour: reminderSettings.hour,
      timeZone: reminderSettings.timeZone,
      lastSentOn: reminderSettings.pushLastSentOn,
    })
    .from(reminderSettings)
    .where(hasDevice);

  const result = { checked: candidates.length, sent: 0, nothingDue: 0, failed: 0 };

  for (const candidate of candidates) {
    const today = reminderDueOn(candidate, now);
    if (!today || !(await claim(candidate.userId, today))) continue;

    const tasks = await listTasks(candidate.userId, { filter: "today", sort: "priority", today });
    if (tasks.length === 0) {
      result.nothingDue += 1;
      continue;
    }

    const delivered = await notifyUser(candidate.userId, buildReminderNotification({ tasks, today }), send);
    if (delivered.delivered > 0) {
      result.sent += 1;
    } else if (delivered.devices > delivered.removed) {
      // Every device that still exists failed: try again next hour.
      await unclaim(candidate.userId, candidate.lastSentOn);
      result.failed += 1;
    }
  }

  return result;
}
