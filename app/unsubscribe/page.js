import Link from "next/link";
import { verifyUnsubscribe } from "@/lib/unsubscribe-token";
import { unsubscribeAction } from "./actions";

export const metadata = {
  title: "Unsubscribe",
};

// Opening the link only shows a button; pressing it unsubscribes. That
// extra click matters: email scanners open links automatically, and a link
// that unsubscribed on its own would switch people off without them knowing.
export default async function UnsubscribePage({ searchParams }) {
  const { u, t, status } = await searchParams;

  if (status === "done") {
    return (
      <section className="space-y-2">
        <h1 className="text-3xl font-semibold">You&apos;re unsubscribed</h1>
        <p className="text-zinc-600 dark:text-zinc-400">
          You won&apos;t get daily reminder emails any more. You can turn them back on from your{" "}
          <Link href="/account" className="underline">
            Account page
          </Link>
          .
        </p>
      </section>
    );
  }

  if (status === "invalid" || !verifyUnsubscribe(u, t)) {
    return (
      <section className="space-y-2">
        <h1 className="text-3xl font-semibold">This link doesn&apos;t work</h1>
        <p className="text-zinc-600 dark:text-zinc-400">
          It may have been copied only partly. You can turn reminders off from your{" "}
          <Link href="/account" className="underline">
            Account page
          </Link>{" "}
          instead.
        </p>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <h1 className="text-3xl font-semibold">Unsubscribe from reminders?</h1>
      <p className="text-zinc-600 dark:text-zinc-400">
        You&apos;ll stop getting the daily SmartDay reminder email. Your tasks stay as they are.
      </p>
      <form action={unsubscribeAction}>
        <input type="hidden" name="u" value={u} />
        <input type="hidden" name="t" value={t} />
        <button type="submit" className="rounded bg-foreground px-4 py-2 text-background">
          Unsubscribe
        </button>
      </form>
    </section>
  );
}
