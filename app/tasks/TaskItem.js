"use client";
// One row in the task list. A Client Component because it remembers whether
// it's being edited (useState), and offers Undo after deleting.
//
// It only receives the fields it shows, not the whole database row: anything
// passed to a Client Component is sent to the browser.

import Link from "next/link";
import { useState } from "react";
import { splitTags } from "@/lib/tags";
import { tasksHref } from "@/lib/task-filter";
import { deleteTaskAction, duplicateTaskAction, moveToTomorrowAction, toggleTaskAction } from "./actions";
import Checklist from "./Checklist";
import DueDate from "./DueDate";
import EditTaskForm from "./EditTaskForm";
import { useUndoDelete } from "./UndoDelete";

// Medium is the default, so only High and Low get a badge: a label on every
// row would just be noise.
const priorityBadges = {
  high: { text: "High priority", className: "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300" },
  low: { text: "Low priority", className: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300" },
};

// overdue: worked out by the page on the server, in the user's time zone.
export default function TaskItem({ id, title, dueDate, priority, notes, repeat, completed, subtasks, overdue = false }) {
  const [editing, setEditing] = useState(false);
  const offerUndo = useUndoDelete();
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
          {/* Tags like #work become links that list every task with that tag. */}
          {splitTags(title).map((part, index) =>
            part.tag ? (
              <Link
                key={index}
                href={tasksHref({ query: part.tag })}
                title={`Show tasks tagged ${part.tag}`}
                className="rounded bg-sky-100 px-1 text-sky-800 hover:underline dark:bg-sky-950 dark:text-sky-300"
              >
                {part.tag}
              </Link>
            ) : (
              part.text
            ),
          )}
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

        <Checklist taskId={id} taskTitle={title} subtasks={subtasks} />
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

        {/* One click instead of editing the date by hand. */}
        {overdue && (
          <form action={moveToTomorrowAction}>
            <input type="hidden" name="id" value={id} />
            <button type="submit" className="hover:underline">
              Move to tomorrow
            </button>
          </form>
        )}

        <button type="button" onClick={() => setEditing(true)} className="hover:underline">
          Edit
        </button>

        {/* A copy, made on the server from the saved task. */}
        <form action={duplicateTaskAction}>
          <input type="hidden" name="id" value={id} />
          <button type="submit" className="hover:underline">
            Duplicate
          </button>
        </form>

        {/* A form action can be our own function, not just a Server Action:
            this one calls the Server Action, then uses what it returns (the
            deleted task) to offer Undo. */}
        <form
          action={async (formData) => {
            const deleted = await deleteTaskAction(formData);
            if (deleted) offerUndo(deleted);
          }}
        >
          <input type="hidden" name="id" value={id} />
          <button type="submit" className="text-red-700 hover:underline dark:text-red-400">
            Delete
          </button>
        </form>
      </div>
    </li>
  );
}
