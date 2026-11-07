// POST /api/cron/reminders: sends the daily reminders (emails and device
// notifications) that are due this hour. Called once an hour by the GitHub Actions workflow in
// .github/workflows/reminders.yml.
//
// It's a public address, so it must check who's calling: the caller sends
// "Authorization: Bearer <CRON_SECRET>", a long random password shared only
// by the workflow and the app. No secret configured = refuse everything.

import { timingSafeEqual } from "node:crypto";
import * as Sentry from "@sentry/nextjs";
import { sendDuePushReminders } from "@/lib/push";
import { sendDueReminders } from "@/lib/reminders";

// Sending emails one by one can take a while; allow up to a minute.
export const maxDuration = 60;

function isAuthorized(request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;

  const expected = Buffer.from(`Bearer ${secret}`);
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  return expected.length === given.length && timingSafeEqual(expected, given);
}

export async function POST(request) {
  if (!isAuthorized(request)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  // Links in the email point at the real site address when it's set.
  const appUrl = (process.env.BETTER_AUTH_URL || new URL(request.url).origin).replace(/\/$/, "");

  // Emails and notifications run one after the other, each on its own: if
  // one breaks, the other still goes out.
  const [email, push] = [await run(() => sendDueReminders({ appUrl })), await run(() => sendDuePushReminders())];
  const result = { ...email, push };
  console.info("reminders_run", result);
  return Response.json(result, { status: email.error || push.error ? 500 : 200 });
}

async function run(job) {
  try {
    return await job();
  } catch (error) {
    Sentry.captureException(error);
    return { error: "failed" };
  }
}
