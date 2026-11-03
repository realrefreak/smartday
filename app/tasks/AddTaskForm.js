"use client";
// A Client Component, because it uses a React hook (useActionState) to show
// the action's result and its pending state.

import { useActionState } from "react";
import { createTaskAction } from "./actions";
import { TITLE_MAX_LENGTH } from "@/lib/task-validation";

const initialState = { error: "", field: "", title: "", dueDate: "" };

const inputClass =
  "rounded border border-black/20 px-3 py-2 dark:border-white/25 dark:bg-transparent";

export default function AddTaskForm() {
  // state   = whatever createTaskAction returned last time
  // action  = pass this to <form action>; React calls createTaskAction for us
  // pending = true while the action is running
  const [state, action, pending] = useActionState(createTaskAction, initialState);

  // Point screen readers at the error from the input it's about.
  // An error with no field (e.g. signed out) applies to the whole form.
  function errorProps(field) {
    const isInvalid = state.error && (state.field === field || !state.field);
    return isInvalid ? { "aria-invalid": true, "aria-describedby": "form-error" } : {};
  }

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
          defaultValue={state.dueDate}
          {...errorProps("dueDate")}
          className={inputClass}
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
