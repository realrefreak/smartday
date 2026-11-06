// Daily email reminders: saving each user's choice, and the hourly job that
// decides who gets an email right now.

import { and, eq, isNull, ne, or } from "drizzle-orm";
import { getDb } from "@/db";
import { reminderSettings, user } from "@/db/schema";
import { hourIn } from "@/lib/dashboard";
import { sendEmail } from "@/lib/email";
import { buildReminderEmail } from "@/lib/reminder-email";
import { listTasks } from "@/lib/tasks";
import { todayIn } from "@/lib/time-zone";
import { unsubscribeUrl } from "@/lib/unsubscribe-token";

export const DEFAULT_REMINDER_HOUR = 8;

// The job runs once an hour, but GitHub sometimes starts scheduled runs late,
// or skips one when busy. So a reminder may go out up to this many hours
// after the chosen time (once), rather than only in that exact hour.
export const CATCH_UP_HOURS = 3;

function assertUserId(userId) {
  if (typeof userId !== "string" || userId.length === 0) {
    throw new Error("A userId is required for reminder settings.");
  }
}

// The user's settings, or the defaults (off) if they've never saved any.
export async function getReminderSettings(userId) {
  assertUserId(userId);

  const [row] = await getDb().select().from(reminderSettings).where(eq(reminderSettings.userId, userId));
  return row ?? { userId, enabled: false, hour: DEFAULT_REMINDER_HOUR, timeZone: "UTC", lastSentOn: null };
}

// Saves the settings (all already validated). "Upsert": insert the row, or
// if this user already has one, update it instead, in a single statement.
export async function saveReminderSettings(userId, { enabled, hour, timeZone }) {
  assertUserId(userId);

  const values = { enabled, hour, timeZone, updatedAt: new Date() };
  const [row] = await getDb()
    .insert(reminderSettings)
    .values({ userId, ...values })
    .onConflictDoUpdate({ target: reminderSettings.userId, set: values })
    .returning();
  return row;
}

// Switches reminders off (from the unsubscribe link). Returns true if a
// row was changed.
export async function disableReminders(userId) {
  assertUserId(userId);

  const rows = await getDb()
    .update(reminderSettings)
    .set({ enabled: false, updatedAt: new Date() })
    .where(eq(reminderSettings.userId, userId))
    .returning({ userId: reminderSettings.userId });
  return rows.length > 0;
}

// Is it time to send this user's reminder? Returns the user's date if so,
// or null. Time to send = within CATCH_UP_HOURS after their chosen hour, in
// their time zone, and not already sent for that date.
export function reminderDueOn({ hour, timeZone, lastSentOn }, now = new Date()) {
  const today = todayIn(timeZone, now);
  if (lastSentOn === today) return null;

  const hoursLate = hourIn(timeZone, now) - hour;
  return hoursLate >= 0 && hoursLate < CATCH_UP_HOURS ? today : null;
}

// Marks a user's reminder for `today` as taken, but only if nobody else has
// already. If two runs overlap, only one of them gets `true` back, so the
// email can never go out twice. (The check and the change are one SQL
// statement, so nothing can sneak in between them.)
async function claim(userId, today) {
  const rows = await getDb()
    .update(reminderSettings)
    .set({ lastSentOn: today })
    .where(
      and(
        eq(reminderSettings.userId, userId),
        eq(reminderSettings.enabled, true),
        or(isNull(reminderSettings.lastSentOn), ne(reminderSettings.lastSentOn, today)),
      ),
    )
    .returning({ userId: reminderSettings.userId });
  return rows.length > 0;
}

// Gives the claim back (after a failed send), so the next hourly run retries.
async function unclaim(userId, previous) {
  await getDb().update(reminderSettings).set({ lastSentOn: previous }).where(eq(reminderSettings.userId, userId));
}

// The hourly job. Returns counts: { checked, sent, nothingDue, failed }.
//   appUrl: the site's address, for links in the email
//   send:   how to send (the tests pass a fake)
export async function sendDueReminders({ appUrl, now = new Date(), send = sendEmail }) {
  const candidates = await getDb()
    .select({
      userId: reminderSettings.userId,
      hour: reminderSettings.hour,
      timeZone: reminderSettings.timeZone,
      lastSentOn: reminderSettings.lastSentOn,
      email: user.email,
      name: user.name,
    })
    .from(reminderSettings)
    .innerJoin(user, eq(user.id, reminderSettings.userId))
    .where(eq(reminderSettings.enabled, true));

  const result = { checked: candidates.length, sent: 0, nothingDue: 0, failed: 0 };

  // One at a time, not all at once: Resend's free plan allows a couple of
  // emails per second, and this keeps us well inside that.
  for (const candidate of candidates) {
    const today = reminderDueOn(candidate, now);
    if (!today || !(await claim(candidate.userId, today))) continue;

    const tasks = await listTasks(candidate.userId, { filter: "today", sort: "priority", today });
    if (tasks.length === 0) {
      // Nothing to say: no email (the day stays claimed, so we don't keep checking).
      result.nothingDue += 1;
      continue;
    }

    const unsubscribe = unsubscribeUrl(appUrl, candidate.userId);
    const email = buildReminderEmail({
      name: candidate.name,
      tasks,
      today,
      appUrl,
      unsubscribeUrl: unsubscribe,
    });
    const sent = await send({
      to: candidate.email,
      ...email,
      // Lets Gmail, Outlook etc. show their own "Unsubscribe" button, which
      // POSTs to this address (RFC 8058 "one-click" unsubscribe).
      headers: {
        "List-Unsubscribe": `<${unsubscribeUrl(appUrl, candidate.userId, "/api/reminders/unsubscribe")}>`,
        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
      },
    });

    if (sent.ok) {
      result.sent += 1;
    } else {
      // Never log the address or the tasks: only which user and why.
      console.error("reminder_send_failed", { userId: candidate.userId, error: sent.error });
      await unclaim(candidate.userId, candidate.lastSentOn);
      result.failed += 1;
    }
  }

  return result;
}
