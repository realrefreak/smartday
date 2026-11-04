"use client";
// "Clear completed (3)": deletes every finished task at once, after asking.
// A Client Component only for the confirm box, like the Delete button.

import { clearCompletedAction } from "./actions";

export default function ClearCompletedButton({ count }) {
  const tasksWord = count === 1 ? "finished task" : "finished tasks";

  return (
    <form action={clearCompletedAction}>
      <button
        type="submit"
        onClick={(event) => {
          if (!window.confirm(`Delete ${count} ${tasksWord}? This can't be undone.`)) {
            event.preventDefault();
          }
        }}
        className="rounded px-3 py-1 text-sm text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950"
      >
        Clear completed ({count})
      </button>
    </form>
  );
}
