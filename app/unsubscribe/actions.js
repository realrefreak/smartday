"use server";
// Switches reminders off from the link in an email, without signing in.
// The signed token proves the link came from us for this user (see
// lib/unsubscribe-token.js); anything else is turned away.

import { redirect } from "next/navigation";
import { disableReminders } from "@/lib/reminders";
import { verifyUnsubscribe } from "@/lib/unsubscribe-token";

export async function unsubscribeAction(formData) {
  const userId = formData.get("u");
  const token = formData.get("t");

  if (!verifyUnsubscribe(userId, token)) {
    redirect("/unsubscribe?status=invalid");
  }

  await disableReminders(userId);
  redirect("/unsubscribe?status=done");
}
