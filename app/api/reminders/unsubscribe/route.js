// POST /api/reminders/unsubscribe?u=...&t=...: "one-click" unsubscribe.
// Gmail, Outlook and others show their own Unsubscribe button for emails
// with a List-Unsubscribe-Post header, and pressing it POSTs here.
//
// Only POST, never GET: email scanners and link previewers open (GET) every
// link in an email, and that must not switch anybody's reminders off.

import { disableReminders } from "@/lib/reminders";
import { verifyUnsubscribe } from "@/lib/unsubscribe-token";

export async function POST(request) {
  const params = new URL(request.url).searchParams;
  const userId = params.get("u");

  if (!verifyUnsubscribe(userId, params.get("t"))) {
    return Response.json({ error: "invalid link" }, { status: 400 });
  }

  await disableReminders(userId);
  return Response.json({ status: "unsubscribed" });
}
