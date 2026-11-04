// Fills the "%s" in the layout's title template, so the tab reads "About | SmartDay".
export const metadata = {
  title: "About",
};

export default function AboutPage() {
  return (
    <section className="space-y-2">
      <h1 className="text-3xl font-semibold">About SmartDay</h1>
      <p className="text-zinc-600 dark:text-zinc-400">
        SmartDay is a daily task planner, built step by step as a
        production-style Next.js app.
      </p>
      <p className="text-zinc-600 dark:text-zinc-400">
        (Preview test: if you can read this, you're on a pull request preview.)
      </p>
    </section>
  );
}
