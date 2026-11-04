"use client";
// The checklist inside a task: tick items off, remove them, add new ones.
// Folded away in a <details> until opened; the summary shows "2/5" so you can
// see progress without opening it.

import { useActionState, useId, useOptimistic, useTransition } from "react";
import { SUBTASKS_MAX, TITLE_MAX_LENGTH } from "@/lib/task-validation";
import { addSubtaskAction, deleteSubtaskAction, toggleSubtaskAction } from "./actions";
import { inputClass } from "./styles";

export default function Checklist({ taskId, taskTitle, subtasks }) {
  const fieldId = useId();
  const [state, action, pending] = useActionState(addSubtaskAction, { error: "", title: "" });
  const done = subtasks.filter((item) => item.completed).length;
  const full = subtasks.length >= SUBTASKS_MAX;

  return (
    <details className="mt-1 text-sm">
      <summary className="cursor-pointer text-zinc-600 dark:text-zinc-400">
        Checklist{subtasks.length > 0 && ` (${done}/${subtasks.length})`}
      </summary>

      {subtasks.length > 0 && (
        <ul aria-label={`Checklist for ${taskTitle}`} className="mt-1 space-y-1">
          {subtasks.map((item) => (
            <ChecklistItem key={item.id} item={item} inputId={`${fieldId}-${item.id}`} />
          ))}
        </ul>
      )}

      {full ? (
        <p className="mt-1 text-zinc-600 dark:text-zinc-400">This checklist is full ({SUBTASKS_MAX} items).</p>
      ) : (
        <form action={action} className="mt-2 flex gap-2">
          <input type="hidden" name="taskId" value={taskId} />
          <label htmlFor={`${fieldId}-new`} className="sr-only">
            New checklist item for {taskTitle}
          </label>
          <input
            id={`${fieldId}-new`}
            name="title"
            required
            maxLength={TITLE_MAX_LENGTH}
            defaultValue={state.title}
            placeholder="Add a step"
            aria-invalid={state.error ? true : undefined}
            aria-describedby={state.error ? `${fieldId}-error` : undefined}
            className={`${inputClass} min-w-0 flex-1`}
          />
          <button type="submit" disabled={pending} className="rounded border border-current px-3 py-1 disabled:opacity-60">
            {pending ? "Adding…" : "Add step"}
          </button>
        </form>
      )}

      {state.error && (
        <p id={`${fieldId}-error`} role="alert" className="mt-1 text-red-600 dark:text-red-400">
          {state.error}
        </p>
      )}
    </details>
  );
}

// One item: a checkbox and a remove button.
function ChecklistItem({ item, inputId }) {
  // useOptimistic: show the new tick straight away, while the server saves it.
  // `checked` is item.completed from the server, except while the transition
  // below is running, when it's whatever we set it to. When it ends, React
  // goes back to the server's value (by then the saved one). Without this,
  // the box would flick back until the server answers, because its tick
  // comes from the server's data.
  const [checked, setChecked] = useOptimistic(item.completed);
  const [, startTransition] = useTransition();

  // Not a <form>: after a form action, React 19 resets the form, which would
  // untick the box again. Calling the Server Action directly avoids that.
  function toggle() {
    startTransition(async () => {
      setChecked(!checked);
      const formData = new FormData();
      formData.set("id", item.id);
      await toggleSubtaskAction(formData);
    });
  }

  return (
    <li className="flex items-center gap-2">
      {/* A real checkbox, so it looks and reads like one. */}
      <div className="flex min-w-0 items-center gap-2">
        <input id={inputId} type="checkbox" checked={checked} onChange={toggle} />
        <label htmlFor={inputId} className={checked ? "break-words text-zinc-500 line-through" : "break-words"}>
          {item.title}
        </label>
      </div>

      <form action={deleteSubtaskAction}>
        <input type="hidden" name="id" value={item.id} />
        {/* The visible "×" means nothing to a screen reader, so the button
            gets a proper name with aria-label. */}
        <button
          type="submit"
          aria-label={`Remove "${item.title}"`}
          className="px-1 text-zinc-500 hover:text-red-700 dark:hover:text-red-400"
        >
          ×
        </button>
      </form>
    </li>
  );
}
