"use server";
// Server Actions for notifications on this device. Public endpoints like
// every Server Action: the user always comes from the session, and whatever
// the browser sends is checked before it's stored.

import { isPushConfigured, notifyUser, removeSubscription, saveSubscription } from "@/lib/push";
import { validateSubscription } from "@/lib/push-message";
import { getCurrentUser } from "@/lib/session";
import { parseTimeZone } from "@/lib/time-zone";

const SIGNED_OUT = { ok: false, error: "Your session has ended. Please sign in again." };

// subscription: what the browser's pushManager.subscribe() returned, as JSON
// timeZone:     the browser's time zone, for when the reminder goes out
export async function subscribePushAction(subscription, timeZone) {
  const user = await getCurrentUser();
  if (!user) return SIGNED_OUT;
  if (!isPushConfigured()) return { ok: false, error: "Notifications aren't set up on this server yet." };

  const checked = validateSubscription(subscription);
  if (!checked.ok) return checked;

  await saveSubscription(user.id, checked, parseTimeZone(timeZone));
  return { ok: true };
}

export async function unsubscribePushAction(endpoint) {
  const user = await getCurrentUser();
  if (!user) return SIGNED_OUT;
  if (typeof endpoint !== "string") return { ok: false, error: "Nothing to turn off." };

  await removeSubscription(user.id, endpoint);
  return { ok: true };
}

// Sends a test notification to every device the user turned them on for.
export async function sendTestPushAction() {
  const user = await getCurrentUser();
  if (!user) return SIGNED_OUT;

  const result = await notifyUser(user.id, {
    title: "SmartDay notifications work",
    body: "Your daily reminder will look like this.",
    url: "/",
    tag: "smartday-test",
  });
  if (result.devices === 0) return { ok: false, error: "Notifications aren't on for any of your devices." };
  if (result.delivered === 0) return { ok: false, error: "The notification couldn't be sent. Try turning notifications off and on again." };
  return { ok: true, delivered: result.delivered };
}
