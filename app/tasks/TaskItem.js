"use client";
// One row in the task list. A Client Component because it remembers whether
// it's being edited (useState), and asks before deleting.
//
// It only receives the fields it shows, not the whole database row: anything
// passed to a Client Component is sent to the browser.

import { useState } from "react";
import { deleteTaskAction, toggleTaskAction } from "./actions";
import DueDate from "./DueDate";
import EditTaskForm from "./EditTaskForm";

// Medium is the default, so only High and Low get a badge: a label on every
// row would just be noise.
const priorityBadges = {
  high: { text: "High priority", className: "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300" },
  low: { text: "Low priority", className: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300" },
};

export default function TaskItem({ id, title, dueDate, priority, notes, repeat, completed }) {
  const [editing, setEditing] = useState(false);
  const badge = priorityBadges[priority];

  if (editing) {
    return (
      <li className="py-3">
        <EditTaskForm
          id={id}
          title={title}
          dueDate={dueDate}
          priority={priority}
          notes={notes}
          repeat={repeat}
          onDone={() => setEditing(false)}
        />
      </li>
    );
  }

  return (
    <li className="flex items-center justify-between gap-4 py-3">
      <div className="min-w-0">
        <span className={completed ? "break-words text-zinc-500 line-through" : "break-words"}>
          {title}
        </span>
        {badge && (
          <span className={`ml-2 rounded px-1.5 py-0.5 text-xs font-medium ${badge.className}`}>
            {badge.text}
          </span>
        )}

        {/* Adds "Overdue"/"Today" using the browser's own date. */}
        {dueDate && <DueDate dueDate={dueDate} repeat={repeat} completed={completed} />}

        {/* <details> opens and closes by itself, with no JavaScript, and
            screen readers announce it as expandable. whitespace-pre-wrap keeps
            the line breaks the user typed. */}
        {notes && (
          <details className="mt-1 text-sm">
            <summary className="cursor-pointer text-zinc-600 dark:text-zinc-400">Notes</summary>
            <p className="mt-1 whitespace-pre-wrap break-words">{notes}</p>
          </details>
        )}
      </div>

      <div className="flex shrink-0 gap-3 text-sm">
        {/* Each button that changes data is its own tiny form; the hidden
            input tells the action which task. */}
        <form action={toggleTaskAction}>
          <input type="hidden" name="id" value={id} />
          <button type="submit" className="hover:underline">
            {completed ? "Undo" : "Mark done"}
          </button>
        </form>

        <button type="button" onClick={() => setEditing(true)} className="hover:underline">
          Edit
        </button>

        <form action={deleteTaskAction}>
          <input type="hidden" name="id" value={id} />
          <button
            type="submit"
            // Deleting can't be undone, so ask first. preventDefault on the
            // button's click stops the form from being submitted at all.
            onClick={(event) => {
              if (!window.confirm(`Delete "${title}"? This can't be undone.`)) {
                event.preventDefault();
              }
            }}
            className="text-red-700 hover:underline dark:text-red-400"
          >
            Delete
          </button>
        </form>
      </div>
    </li>
  );
}
