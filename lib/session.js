// Helpers for "who is making this request?" in Server Components and Server Actions.

import { cache } from "react";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { getAuth } from "@/lib/auth";

// Reads the session cookie from the request and looks the session up in the
// database. Returns the user, or null if not signed in (or the session expired).
//
// cache() remembers the answer for the rest of this one request, so the layout
// and the page can both call it without querying the database twice.
export const getCurrentUser = cache(async () => {
  const session = await getAuth().api.getSession({ headers: await currentHeaders() });
  return session?.user ?? null;
});

// The request's headers, but with the cookies as they are NOW.
//
// After a Server Action changes a cookie (e.g. changing your password gives
// you a brand-new session), Next.js re-renders the page in the same response.
// headers() still holds the cookies the browser originally sent, including
// the old, now-deleted session; cookies() includes the change. Without this,
// that re-render would think you'd just been signed out.
async function currentHeaders() {
  const merged = new Headers(await headers());
  const cookieHeader = (await cookies()).toString();

  if (cookieHeader) {
    merged.set("cookie", cookieHeader);
  } else {
    merged.delete("cookie");
  }

  return merged;
}

// For pages that require login: returns the user, or sends them to /sign-in.
export async function requireUser() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/sign-in");
  }

  return user;
}
