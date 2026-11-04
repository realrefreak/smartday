"use client";
// The form a task row turns into when you click Edit.

import { useActionState, useId } from "react";
import { NOTES_MAX_LENGTH, TITLE_MAX_LENGTH } from "@/lib/task-validation";
import { updateTaskAction } from "./actions";
import { fieldErrorProps } from "./field-error-props";
import PrioritySelect from "./PrioritySelect";
import RepeatSelect from "./RepeatSelect";
import { inputClass } from "./styles";

export default function EditTaskForm({ id, title, dueDate, priority, notes, repeat, onDone }) {
  // Every row could show this form, so ids must be unique on the page.
  const fieldId = useId();
  const errorId = `${fieldId}-error`;

  // Wrap the Server Action: once it reports a successful save, close the form.
  // The action already refreshed /tasks, so the row shows the new values.
  const [state, action, pending] = useActionState(
    async (prevState, formData) => {
      const result = await updateTaskAction(prevState, formData);
      if (result.ok) {
        onDone();
      }
      return result;
    },
    { ok: false, error: "", field: "", title, dueDate: dueDate ?? "", priority, notes: notes ?? "", repeat: repeat ?? "" },
  );

  const errorProps = (field) => fieldErrorProps(state, field, errorId);

  return (
    <form
      action={action}
      // Escape cancels, like most edit boxes.
      onKeyDown={(event) => {
        if (event.key === "Escape") onDone();
      }}
      className="space-y-2"
    >
      <input type="hidden" name="id" value={id} />

      <div className="flex flex-wrap gap-2">
        <label htmlFor={`${fieldId}-title`} className="sr-only">
          Title
        </label>
        <input
          id={`${fieldId}-title`}
          name="title"
          required
          maxLength={TITLE_MAX_LENGTH}
          defaultValue={state.title}
          // Jump straight into the box you're editing.
          autoFocus
          {...errorProps("title")}
          className={`${inputClass} min-w-48 flex-1`}
        />

        <label htmlFor={`${fieldId}-due`} className="sr-only">
          Due date
        </label>
        <input
          id={`${fieldId}-due`}
          name="dueDate"
          type="date"
          defaultValue={state.dueDate}
          {...errorProps("dueDate")}
          className={inputClass}
        />

        {/* key: see AddTaskForm. Keeps your choices after a failed save. */}
        <PrioritySelect
          key={`priority-${state.priority}`}
          id={`${fieldId}-priority`}
          defaultValue={state.priority}
          {...errorProps("priority")}
        />

        <RepeatSelect
          key={`repeat-${state.repeat}`}
          id={`${fieldId}-repeat`}
          defaultValue={state.repeat}
          {...errorProps("repeat")}
        />
      </div>

      {/* A visible label here: unlike the other boxes, an empty notes box has
          nothing else saying what it's for. */}
      <label htmlFor={`${fieldId}-notes`} className="block text-sm text-zinc-600 dark:text-zinc-400">
        Notes
      </label>
      <textarea
        id={`${fieldId}-notes`}
        name="notes"
        rows={3}
        maxLength={NOTES_MAX_LENGTH}
        defaultValue={state.notes}
        placeholder="Optional details"
        {...errorProps("notes")}
        className={`${inputClass} w-full`}
      />

      {/* After the notes box, so Tab moves through the form top to bottom. */}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded bg-foreground px-4 py-2 text-background disabled:opacity-60"
        >
          {pending ? "Saving…" : "Save"}
        </button>
        <button type="button" onClick={onDone} className="px-2 py-2 text-sm hover:underline">
          Cancel
        </button>
      </div>

      {state.error && (
        <p id={errorId} role="alert" className="text-sm text-red-600 dark:text-red-400">
          {state.error}
        </p>
      )}
    </form>
  );
}
