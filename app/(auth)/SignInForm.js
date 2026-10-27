"use client";

import { useActionState } from "react";
import { signInAction } from "./actions";

const initialState = { error: "", email: "" };
const inputClass =
  "w-full rounded border border-black/20 px-3 py-2 dark:border-white/25 dark:bg-transparent";

export default function SignInForm() {
  const [state, action, pending] = useActionState(signInAction, initialState);

  return (
    <form action={action} className="space-y-4">
      <div className="space-y-1">
        <label htmlFor="email" className="block text-sm font-medium">Email</label>
        <input id="email" name="email" type="email" required
          autoComplete="email" defaultValue={state.email} className={inputClass} />
      </div>

      <div className="space-y-1">
        <label htmlFor="password" className="block text-sm font-medium">Password</label>
        <input id="password" name="password" type="password" required
          autoComplete="current-password" className={inputClass} />
      </div>

      {state.error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">{state.error}</p>
      )}

      <button type="submit" disabled={pending}
        className="w-full rounded bg-foreground px-4 py-2 text-background disabled:opacity-60">
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
