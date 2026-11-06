// The "unsubscribe" link in reminder emails has to work without signing in
// (that's the law in many countries, and what people expect). But it mustn't
// let anyone switch off anyone else's reminders just by guessing a user id.
//
// So the link carries the user id plus a signature: an HMAC, a fingerprint
// of the id made with a secret only the server knows (BETTER_AUTH_SECRET).
// Without the secret nobody can produce a valid signature for another id.

import { createHmac, timingSafeEqual } from "node:crypto";

function secret() {
  const value = process.env.BETTER_AUTH_SECRET;
  if (!value) {
    throw new Error("BETTER_AUTH_SECRET is not set.");
  }
  return value;
}

export function signUnsubscribe(userId) {
  // "reminders:" makes this signature useful for nothing but this one job.
  return createHmac("sha256", secret()).update(`reminders:${userId}`).digest("base64url");
}

// true only if `token` is the signature for this user id.
export function verifyUnsubscribe(userId, token) {
  if (typeof userId !== "string" || !userId || typeof token !== "string" || !token) {
    return false;
  }

  const expected = Buffer.from(signUnsubscribe(userId));
  const given = Buffer.from(token);
  // timingSafeEqual takes the same time however many characters match, so an
  // attacker can't guess the signature one character at a time by timing us.
  return expected.length === given.length && timingSafeEqual(expected, given);
}

// The full unsubscribe address for a user: the page people click through
// to, or (path "/api/reminders/unsubscribe") the one-click address email
// programs POST to.
export function unsubscribeUrl(appUrl, userId, path = "/unsubscribe") {
  const params = new URLSearchParams({ u: userId, t: signUnsubscribe(userId) });
  return `${appUrl}${path}?${params}`;
}
