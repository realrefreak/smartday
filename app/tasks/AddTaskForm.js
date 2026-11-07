"use client";
// A Client Component, because it uses a React hook (useActionState) to show
// the action's result and its pending state.

import { useActionState } from "react";
import { createTaskAction } from "./actions";
import { DEFAULT_PRIORITY, TITLE_MAX_LENGTH } from "@/lib/task-validation";
import PrioritySelect from "./PrioritySelect";
import RepeatSelect from "./RepeatSelect";
import { fieldErrorProps } from "./field-error-props";
import { inputClass } from "./styles";

const initialState = { error: "", field: "", title: "", dueDate: "", priority: DEFAULT_PRIORITY, repeat: "" };

// defaultDueDate: a date to fill in, e.g. the day picked on the calendar.
export default function AddTaskForm({ defaultDueDate = "" }) {
  // state   = whatever createTaskAction returned last time
  // action  = pass this to <form action>; React calls createTaskAction for us
  // pending = true while the action is running
  const [state, action, pending] = useActionState(createTaskAction, initialState);
  const errorProps = (field) => fieldErrorProps(state, field, "form-error");

  return (
    <form action={action} className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <label htmlFor="title" className="sr-only">
          New task
        </label>
        <input
          id="title"
          name="title"
          required
          maxLength={TITLE_MAX_LENGTH}
          defaultValue={state.title}
          placeholder="What do you need to do?"
          {...errorProps("title")}
          className={`${inputClass} min-w-48 flex-1`}
        />

        {/* type="date" gives a date picker, and always sends "YYYY-MM-DD"
            whatever format the browser shows. Optional: no `required`. */}
        <label htmlFor="dueDate" className="sr-only">
          Due date
        </label>
        <input
          id="dueDate"
          name="dueDate"
          type="date"
          // After a successful add the action returns dueDate "", and the
          // calendar's day should stay filled in for the next task.
          defaultValue={state.dueDate || defaultDueDate}
          {...errorProps("dueDate")}
          className={inputClass}
        />

        {/* key: React only applies a <select>'s defaultValue when it's first
            created, and resetting the form after each submit goes back to
            that. A new key makes a fresh select whenever the value to show
            changes, e.g. after an error, so your choice isn't lost. */}
        <PrioritySelect
          key={`priority-${state.priority}`}
          id="priority"
          defaultValue={state.priority}
          {...errorProps("priority")}
        />

        <RepeatSelect
          key={`repeat-${state.repeat}`}
          id="repeat"
          defaultValue={state.repeat}
          {...errorProps("repeat")}
        />

        <button
          type="submit"
          disabled={pending}
          className="rounded bg-foreground px-4 py-2 text-background disabled:opacity-60"
        >
          {pending ? "Adding…" : "Add"}
        </button>
      </div>

      {state.error && (
        <p id="form-error" role="alert" className="text-sm text-red-600 dark:text-red-400">
          {state.error}
        </p>
      )}
    </form>
  );
}
