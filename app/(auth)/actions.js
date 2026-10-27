"use server";
// Server Actions for signing up, in and out. They validate input, call Better
// Auth on the server, and (thanks to the nextCookies plugin) Better Auth sets
// or clears the session cookie on the response.

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { APIError } from "better-auth/api";
import { getAuth } from "@/lib/auth";
import { validateSignIn, validateSignUp } from "@/lib/auth-validation";

// Each returns { error, ...fields to refill the form }. Passwords are never sent back.

export async function signUpAction(prevState, formData) {
  const input = {
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
  };
  const keep = { name: String(input.name ?? ""), email: String(input.email ?? "") };

  const result = validateSignUp(input);
  if (!result.ok) {
    return { error: result.error, ...keep };
  }

  try {
    await getAuth().api.signUpEmail({ body: result.data, headers: await headers() });
  } catch (error) {
    if (error instanceof APIError && error.body?.code?.startsWith("USER_ALREADY_EXISTS")) {
      return { error: "An account with this email already exists. Try signing in.", ...keep };
    }
    console.error("sign_up_failed", error?.body?.code ?? error?.name);
    return { error: "We couldn't create your account. Please try again.", ...keep };
  }

  // redirect() works by throwing, so it must be outside the try/catch above.
  redirect("/tasks");
}

export async function signInAction(prevState, formData) {
  const input = { email: formData.get("email"), password: formData.get("password") };
  const keep = { email: String(input.email ?? "") };

  const result = validateSignIn(input);
  if (!result.ok) {
    return { error: result.error, ...keep };
  }

  try {
    await getAuth().api.signInEmail({ body: result.data, headers: await headers() });
  } catch (error) {
    // Same message for "no such email" and "wrong password", so attackers
    // can't use this form to discover who has an account.
    if (error instanceof APIError && error.body?.code === "INVALID_EMAIL_OR_PASSWORD") {
      return { error: "Email or password is incorrect.", ...keep };
    }
    console.error("sign_in_failed", error?.body?.code ?? error?.name);
    return { error: "We couldn't sign you in. Please try again.", ...keep };
  }

  redirect("/tasks");
}

export async function signOutAction() {
  // Deletes the session row and clears the cookie.
  await getAuth().api.signOut({ headers: await headers() });
  redirect("/");
}
