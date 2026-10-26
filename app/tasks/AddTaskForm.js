"use client";
// A Client Component, because it uses a React hook (useActionState) to show
// the action's result and its pending state.

import { useActionState } from "react";
import { createTaskAction } from "./actions";
import { TITLE_MAX_LENGTH } from "@/lib/task-validation";

const initialState = { error: "", title: "" };

export default function AddTaskForm() {
  // state   = whatever createTaskAction returned last time
  // action  = pass this to <form action>; React calls createTaskAction for us
  // pending = true while the action is running
  const [state, action, pending] = useActionState(createTaskAction, initialState);

  return (
    <form action={action} className="space-y-2">
      <div className="flex gap-2">
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
          aria-invalid={state.error ? true : undefined}
          aria-describedby={state.error ? "title-error" : undefined}
          className="flex-1 rounded border border-black/20 px-3 py-2 dark:border-white/25 dark:bg-transparent"
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
        <p id="title-error" role="alert" className="text-sm text-red-600 dark:text-red-400">
          {state.error}
        </p>
      )}
    </form>
  );
}
