// The home page for visitors who aren't signed in: what SmartDay is, and a
// way in. Pure HTML from the server, no data needed.

import Link from "next/link";

const FEATURES = [
  { title: "Today view", text: "See what's overdue and due today, in your own time zone." },
  { title: "Priorities", text: "Mark tasks high, medium or low, and sort by what matters most." },
  { title: "Repeating tasks", text: "Daily, weekly or monthly tasks move to their next date when done." },
  { title: "Checklists", text: "Break a task into steps and tick them off one by one." },
  { title: "#Tags", text: "Type #work or #home in a title, then click a tag to see them all." },
  { title: "Search", text: "Find any task by its title or notes in a moment." },
  { title: "Keyboard shortcuts", text: "Press n to add a task or / to search, no mouse needed." },
  { title: "Export", text: "Download all your tasks as a CSV file whenever you like." },
];

const STEPS = [
  { title: "Create an account", text: "It's free and takes a few seconds." },
  { title: "Add your tasks", text: "Give them due dates, priorities and tags." },
  { title: "Check them off", text: "Start each day from your dashboard and watch the progress bar fill." },
];

export default function Landing() {
  return (
    <div className="space-y-16">
      <section className="space-y-6 pt-6 text-center">
        <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
          Plan your day.
          <br />
          <span className="text-zinc-500 dark:text-zinc-400">Then actually get it done.</span>
        </h1>
        <p className="mx-auto max-w-xl text-lg text-zinc-600 dark:text-zinc-400">
          SmartDay is a simple task planner with due dates, priorities, repeating
          tasks and checklists, so nothing slips through the cracks.
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <Link href="/sign-up" className="rounded bg-foreground px-5 py-2.5 text-background">
            Get started free
          </Link>
          <Link
            href="/sign-in"
            className="rounded border border-black/20 px-5 py-2.5 hover:bg-black/5 dark:border-white/25 dark:hover:bg-white/10"
          >
            I have an account
          </Link>
        </div>
      </section>

      <section aria-labelledby="features-heading" className="space-y-6">
        <h2 id="features-heading" className="text-center text-2xl font-semibold">
          Everything you need, nothing you don&apos;t
        </h2>
        <ul className="grid gap-4 sm:grid-cols-2">
          {FEATURES.map(({ title, text }) => (
            <li key={title} className="rounded-lg border border-black/10 p-4 dark:border-white/15">
              <h3 className="font-medium">{title}</h3>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{text}</p>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="steps-heading" className="space-y-6">
        <h2 id="steps-heading" className="text-center text-2xl font-semibold">
          How it works
        </h2>
        <ol className="grid gap-4 sm:grid-cols-3">
          {STEPS.map(({ title, text }, index) => (
            <li key={title} className="space-y-2 text-center">
              <span className="mx-auto flex h-9 w-9 items-center justify-center rounded-full bg-foreground font-semibold text-background">
                {index + 1}
              </span>
              <h3 className="font-medium">{title}</h3>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">{text}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="rounded-lg bg-black/5 p-8 text-center dark:bg-white/10">
        <h2 className="text-2xl font-semibold">Ready to plan a better day?</h2>
        <Link
          href="/sign-up"
          className="mt-4 inline-block rounded bg-foreground px-5 py-2.5 text-background"
        >
          Create your free account
        </Link>
      </section>
    </div>
  );
}
