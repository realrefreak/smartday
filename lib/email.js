// Sending email through Resend (resend.com), with a plain fetch() call to
// their API rather than an extra package.
//
// RESEND_API_KEY      the key from Resend. Without it nothing is sent: the
//                     email is only logged ("dry run"), which is what local
//                     development and the tests use.
// REMINDER_FROM_EMAIL who it's from. Defaults to Resend's shared test
//                     address, which can only send to your own Resend account
//                     email until you verify a domain with Resend.

const DEFAULT_FROM = "SmartDay <onboarding@resend.dev>";

// Returns { ok: true, id } or { ok: true, dryRun: true }, or
// { ok: false, error } (never throws for a failed send, so one bad address
// can't stop the rest of the batch).
export async function sendEmail({ to, subject, text, html, headers = {} }) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.info("email_dry_run", { subject });
    return { ok: true, dryRun: true };
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.REMINDER_FROM_EMAIL || DEFAULT_FROM,
        to: [to],
        subject,
        text,
        html,
        headers,
      }),
      // Don't let a slow email service hang the whole job.
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      // Resend explains what went wrong in the body (bad key, unverified
      // address...). Log the reason, never the key.
      const body = await response.json().catch(() => ({}));
      return { ok: false, error: `${response.status} ${body.name ?? ""} ${body.message ?? ""}`.trim() };
    }

    const { id } = await response.json();
    return { ok: true, id };
  } catch (error) {
    return { ok: false, error: error?.name ?? "fetch_failed" };
  }
}
