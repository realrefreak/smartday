// Helpers for "who is making this request?" in Server Components and Server Actions.

import { cache } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getAuth } from "@/lib/auth";

// Reads the session cookie from the request and looks the session up in the
// database. Returns the user, or null if not signed in (or the session expired).
//
// cache() remembers the answer for the rest of this one request, so the layout
// and the page can both call it without querying the database twice.
export const getCurrentUser = cache(async () => {
  const session = await getAuth().api.getSession({ headers: await headers() });
  return session?.user ?? null;
});

// For pages that require login: returns the user, or sends them to /sign-in.
export async function requireUser() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/sign-in");
  }

  return user;
}
