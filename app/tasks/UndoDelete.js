"use client";
// After you delete a task, a bar says "Deleted "…"" with an Undo button for a
// few seconds. This replaces an "Are you sure?" box: undo is friendlier than a
// question you learn to click through without reading.
//
// Why a "context": the Delete button lives inside a task row, but the row
// disappears once the task is deleted, so it can't show the bar itself. The
// provider sits above the whole list and lives on; any row can reach it with
// useUndoDelete(), without passing props through every layer.

import { createContext, useContext, useEffect, useState, useTransition } from "react";
import { restoreTaskAction } from "./actions";

// How long the Undo button stays.
const UNDO_MS = 10_000;

const UndoContext = createContext(() => {});

// Call the function it returns with a deleted task to offer Undo for it.
export function useUndoDelete() {
  return useContext(UndoContext);
}

export default function UndoDeleteProvider({ children }) {
  // The last deleted task, or null when there's nothing to undo. Each delete
  // gets a fresh object, so deleting twice restarts the timer.
  const [deleted, setDeleted] = useState(null);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  // Hide the bar after a while. The cleanup cancels the old timer when
  // another task is deleted (or the page goes away).
  useEffect(() => {
    if (!deleted) return;
    const timer = setTimeout(() => setDeleted(null), UNDO_MS);
    return () => clearTimeout(timer);
  }, [deleted]);

  function offerUndo(task) {
    setError("");
    setDeleted({ task });
  }

  function undo() {
    startTransition(async () => {
      const result = await restoreTaskAction(deleted.task);
      if (result.ok) {
        setDeleted(null);
      } else {
        setError(result.error);
      }
    });
  }

  // In React 19 a context is its own provider: <UndoContext value={...}>.
  return (
    <UndoContext value={offerUndo}>
      {children}

      {/* role="status" is a "live region": screen readers read out what
          appears in it. It must already be on the page before the text
          appears, so the empty box is always rendered. */}
      <div
        role="status"
        aria-label="Undo delete"
        className="fixed inset-x-0 bottom-4 flex justify-center px-4"
      >
        {deleted && (
          <div className="flex items-center gap-4 rounded bg-foreground px-4 py-2 text-sm text-background shadow-lg">
            <span className="break-words">{error || `Deleted "${deleted.task.title}".`}</span>
            {!error && (
              <button type="button" onClick={undo} disabled={pending} className="font-semibold hover:underline">
                {pending ? "Restoring…" : "Undo"}
              </button>
            )}
          </div>
        )}
      </div>
    </UndoContext>
  );
}
