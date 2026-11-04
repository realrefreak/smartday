"use client";

import { useActionState } from "react";
import { NAME_MAX_LENGTH } from "@/lib/auth-validation";
import { inputClass } from "@/app/tasks/styles";
import { updateNameAction } from "./actions";
import FormMessage from "./FormMessage";

export default function NameForm({ name }) {
  const [state, action, pending] = useActionState(updateNameAction, {
    error: "",
    success: "",
    name,
  });
  const invalid = state.error ? { "aria-invalid": true, "aria-describedby": "name-error" } : {};

  return (
    <form action={action} className="space-y-2">
      <label htmlFor="account-name" className="block text-sm font-medium">
        Name
      </label>
      <div className="flex flex-wrap gap-2">
        <input
          id="account-name"
          name="name"
          required
          maxLength={NAME_MAX_LENGTH}
          autoComplete="name"
          defaultValue={state.name}
          {...invalid}
          className={`${inputClass} min-w-48 flex-1`}
        />
        <button
          type="submit"
          disabled={pending}
          className="rounded bg-foreground px-4 py-2 text-background disabled:opacity-60"
        >
          {pending ? "Saving…" : "Save name"}
        </button>
      </div>
      <FormMessage id="name-error" state={state} />
    </form>
  );
}
