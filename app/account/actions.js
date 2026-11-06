"use server";
// Server Actions for the Account page. Like every Server Action, these are
// public endpoints: each one checks who is calling before doing anything.
// Better Auth does the real work, and checks the session again itself.

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { APIError } from "better-auth/api";
import { getAuth } from "@/lib/auth";
import {
  validateDeleteAccount,
  validateName,
  validatePasswordChange,
} from "@/lib/auth-validation";
import { saveReminderSettings } from "@/lib/reminders";
import { validateReminderSettings } from "@/lib/reminder-validation";
import { getCurrentUser } from "@/lib/session";

const SIGNED_OUT_ERROR = "Your session has ended. Please sign in again.";

function isWrongPassword(error) {
  return error instanceof APIError && error.body?.code === "INVALID_PASSWORD";
}

// Each action returns { error, field, success }. Passwords are never sent back.

export async function updateNameAction(prevState, formData) {
  const rawName = formData.get("name");
  const typed = { name: typeof rawName === "string" ? rawName : "" };

  if (!(await getCurrentUser())) {
    return { error: SIGNED_OUT_ERROR, success: "", ...typed };
  }

  const result = validateName(rawName);
  if (!result.ok) {
    return { error: result.error, success: "", ...typed };
  }

  try {
    await getAuth().api.updateUser({ body: { name: result.name }, headers: await headers() });
  } catch (error) {
    console.error("update_name_failed", error?.body?.code ?? error?.name);
    return { error: "We couldn't save your name. Please try again.", success: "", ...typed };
  }

  revalidatePath("/account");
  return { error: "", success: "Name saved.", name: result.name };
}

export async function changePasswordAction(prevState, formData) {
  if (!(await getCurrentUser())) {
    return { error: SIGNED_OUT_ERROR, field: "", success: "" };
  }

  const result = validatePasswordChange({
    currentPassword: formData.get("currentPassword"),
    newPassword: formData.get("newPassword"),
    confirmPassword: formData.get("confirmPassword"),
  });
  if (!result.ok) {
    return { error: result.error, field: result.field, success: "" };
  }

  try {
    // revokeOtherSessions: anyone signed in elsewhere (say, someone who
    // learned the old password) is signed out. This browser gets a fresh
    // session cookie, so you stay signed in here.
    await getAuth().api.changePassword({
      body: { ...result.data, revokeOtherSessions: true },
      headers: await headers(),
    });
  } catch (error) {
    if (isWrongPassword(error)) {
      return { error: "Your current password is incorrect.", field: "currentPassword", success: "" };
    }
    console.error("change_password_failed", error?.body?.code ?? error?.name);
    return { error: "We couldn't change your password. Please try again.", field: "", success: "" };
  }

  return {
    error: "",
    field: "",
    success: "Password changed. Any other devices have been signed out.",
  };
}

export async function deleteAccountAction(prevState, formData) {
  if (!(await getCurrentUser())) {
    return { error: SIGNED_OUT_ERROR };
  }

  const result = validateDeleteAccount({ password: formData.get("password") });
  if (!result.ok) {
    return { error: result.error };
  }

  try {
    // Checks the password, deletes the user (their tasks, sessions and
    // accounts go with them: "on delete cascade") and clears the cookie.
    await getAuth().api.deleteUser({ body: result.data, headers: await headers() });
  } catch (error) {
    if (isWrongPassword(error)) {
      return { error: "Password is incorrect." };
    }
    console.error("delete_account_failed", error?.body?.code ?? error?.name);
    return { error: "We couldn't delete your account. Please try again." };
  }

  // Outside the try/catch: redirect() works by throwing.
  redirect("/?account=deleted");
}

// Saves the daily email reminder choice. Like every action here, the user
// comes from the session, never from the form.
export async function saveRemindersAction(prevState, formData) {
  // What was chosen, so an error doesn't reset the form. (0 is a real hour,
  // so check for a whole number rather than "truthy".)
  const chosenHour = Number(formData.get("hour"));
  const typed = {
    enabled: formData.get("enabled") === "on",
    hour: Number.isInteger(chosenHour) ? chosenHour : prevState.hour,
  };

  const user = await getCurrentUser();
  if (!user) {
    return { error: SIGNED_OUT_ERROR, success: "", ...typed };
  }

  const result = validateReminderSettings({
    enabled: formData.get("enabled"),
    hour: formData.get("hour"),
    timeZone: formData.get("timeZone"),
  });
  if (!result.ok) {
    return { error: result.error, success: "", ...typed };
  }

  await saveReminderSettings(user.id, result);

  revalidatePath("/account");
  return {
    error: "",
    success: result.enabled ? `Reminders on: daily at ${result.hour}:00 your time.` : "Reminders off.",
    enabled: result.enabled,
    hour: result.hour,
  };
}
