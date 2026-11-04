// searchParams is a Promise in Next.js 16. "?account=deleted" is where
// deleting your account lands, so we can confirm it worked.
export default async function HomePage({ searchParams }) {
  const { account } = await searchParams;

  return (
    <section className="space-y-2">
      {account === "deleted" && (
        <p role="status" className="mb-6 rounded bg-black/5 px-4 py-3 text-sm dark:bg-white/10">
          Your account and all of your tasks have been deleted.
        </p>
      )}
      <h1 className="text-3xl font-semibold">Welcome to SmartDay</h1>
      <p className="text-zinc-600 dark:text-zinc-400">
        Organize your day, one task at a time.
      </p>
    </section>
  );
}
