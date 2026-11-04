// "3 of 8 done", with a bar. Counts all of the user's tasks, whatever the
// filter or search, so the number doesn't jump around as you browse.

export default function TaskProgress({ total, completed }) {
  if (total === 0) {
    return null;
  }

  const percent = Math.round((completed / total) * 100);

  return (
    <div className="space-y-1">
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        {completed === total ? `All ${total} done. Well done!` : `${completed} of ${total} done`}
      </p>
      {/* role="progressbar" and the aria-value* attributes let screen readers
          announce the bar ("38 percent"); the coloured div is only for eyes. */}
      <div
        role="progressbar"
        aria-label="Tasks done"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        className="h-2 overflow-hidden rounded bg-black/10 dark:bg-white/15"
      >
        <div className="h-full rounded bg-emerald-600" style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}
