"use client";

import { useActionState } from "react";
import { signUpAction } from "./actions";
import { NAME_MAX_LENGTH, PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from "@/lib/auth-validation";

const initialState = { error: "", name: "", email: "" };
const inputClass =
  "w-full rounded border border-black/20 px-3 py-2 dark:border-white/25 dark:bg-transparent";

export default function SignUpForm() {
  const [state, action, pending] = useActionState(signUpAction, initialState);

  return (
    <form action={action} className="space-y-4">
      <div className="space-y-1">
        <label htmlFor="name" className="block text-sm font-medium">Name</label>
        <input id="name" name="name" required maxLength={NAME_MAX_LENGTH}
          autoComplete="name" defaultValue={state.name} className={inputClass} />
      </div>

      <div className="space-y-1">
        <label htmlFor="email" className="block text-sm font-medium">Email</label>
        <input id="email" name="email" type="email" required
          autoComplete="email" defaultValue={state.email} className={inputClass} />
      </div>

      <div className="space-y-1">
        <label htmlFor="password" className="block text-sm font-medium">Password</label>
        {/* "new-password" tells password managers to suggest a strong one. */}
        <input id="password" name="password" type="password" required
          minLength={PASSWORD_MIN_LENGTH} maxLength={PASSWORD_MAX_LENGTH}
          autoComplete="new-password" className={inputClass} />
        <p className="text-xs text-zinc-500">At least {PASSWORD_MIN_LENGTH} characters.</p>
      </div>

      {state.error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">{state.error}</p>
      )}

      <button type="submit" disabled={pending}
        className="w-full rounded bg-foreground px-4 py-2 text-background disabled:opacity-60">
        {pending ? "Creating account…" : "Create account"}
      </button>
    </form>
  );
}
