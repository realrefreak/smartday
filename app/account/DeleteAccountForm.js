"use client";

import { useActionState } from "react";
import { PASSWORD_MAX_LENGTH } from "@/lib/auth-validation";
import { inputClass } from "@/app/tasks/styles";
import { deleteAccountAction } from "./actions";
import FormMessage from "./FormMessage";

export default function DeleteAccountForm() {
  const [state, action, pending] = useActionState(deleteAccountAction, { error: "" });
  const invalid = state.error ? { "aria-invalid": true, "aria-describedby": "delete-error" } : {};

  return (
    <form action={action} className="max-w-sm space-y-3">
      <div className="space-y-1">
        <label htmlFor="delete-password" className="block text-sm font-medium">
          Your password
        </label>
        <input
          id="delete-password"
          name="password"
          type="password"
          required
          maxLength={PASSWORD_MAX_LENGTH}
          autoComplete="current-password"
          {...invalid}
          className={`${inputClass} w-full`}
        />
      </div>
      <button
        type="submit"
        disabled={pending}
        // One last "are you sure?", like deleting a task.
        onClick={(event) => {
          if (!window.confirm("Delete your account and all your tasks? This can't be undone.")) {
            event.preventDefault();
          }
        }}
        className="rounded bg-red-700 px-4 py-2 text-white hover:bg-red-800 disabled:opacity-60"
      >
        {pending ? "Deleting…" : "Delete my account"}
      </button>
      <FormMessage id="delete-error" state={state} />
    </form>
  );
}
