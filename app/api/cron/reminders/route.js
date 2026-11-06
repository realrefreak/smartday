// POST /api/cron/reminders: sends the daily reminder emails that are due
// this hour. Called once an hour by the GitHub Actions workflow in
// .github/workflows/reminders.yml.
//
// It's a public address, so it must check who's calling: the caller sends
// "Authorization: Bearer <CRON_SECRET>", a long random password shared only
// by the workflow and the app. No secret configured = refuse everything.

import { timingSafeEqual } from "node:crypto";
import * as Sentry from "@sentry/nextjs";
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

  try {
    const result = await sendDueReminders({ appUrl });
    console.info("reminders_run", result);
    return Response.json(result);
  } catch (error) {
    Sentry.captureException(error);
    return Response.json({ error: "failed" }, { status: 500 });
  }
}
