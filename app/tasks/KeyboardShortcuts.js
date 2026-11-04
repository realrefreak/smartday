"use client";
// Keyboard shortcuts for the Tasks page:
//   n  jump to the "New task" box
//   /  jump to the search box
// (Escape cancelling an edit is handled by the edit form itself.)
//
// It renders a short hint, and listens for key presses on the whole page.

import { useEffect } from "react";

const SHORTCUTS = {
  n: "title", // the id of the "New task" input in AddTaskForm
  "/": "task-search", // the id of the input in TaskSearch
};

export default function KeyboardShortcuts() {
  // useEffect runs only in the browser, after the page appears: the right
  // place to attach a listener to `document`. The function it returns removes
  // the listener again when the component goes away, so they don't pile up.
  useEffect(() => {
    function onKeyDown(event) {
      // Leave Ctrl/Cmd/Alt combinations (copy, find, ...) to the browser.
      if (event.ctrlKey || event.metaKey || event.altKey || event.defaultPrevented) return;

      // Typing "n" into a box must type an "n", not jump somewhere.
      const target = event.target;
      if (target instanceof HTMLElement && (target.isContentEditable || target.closest("input, textarea, select"))) {
        return;
      }

      const input = document.getElementById(SHORTCUTS[event.key]);
      if (!input) return;

      // Stop the key doing its usual thing (in Firefox "/" opens quick find).
      event.preventDefault();
      input.focus();
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  const kbd = "rounded border border-black/20 px-1 font-mono dark:border-white/25";

  // Hidden on small screens: phones don't have keyboards.
  return (
    <p className="hidden text-xs text-zinc-500 sm:block">
      Shortcuts: <kbd className={kbd}>n</kbd> new task · <kbd className={kbd}>/</kbd> search ·{" "}
      <kbd className={kbd}>Esc</kbd> cancel editing
    </p>
  );
}
