"use client";

import { useActionState } from "react";
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from "@/lib/auth-validation";
import { fieldErrorProps } from "@/app/tasks/field-error-props";
import { inputClass } from "@/app/tasks/styles";
import { changePasswordAction } from "./actions";
import FormMessage from "./FormMessage";

// autoComplete tells password managers which box is which: "current-password"
// to fill in, "new-password" to offer a strong generated one.
const FIELDS = [
  { name: "currentPassword", label: "Current password", autoComplete: "current-password" },
  { name: "newPassword", label: "New password", autoComplete: "new-password" },
  { name: "confirmPassword", label: "Confirm new password", autoComplete: "new-password" },
];

export default function ChangePasswordForm() {
  const [state, action, pending] = useActionState(changePasswordAction, {
    error: "",
    field: "",
    success: "",
  });

  return (
    // Passwords are never sent back, so after each try React resets the form
    // and the boxes start empty: nothing secret lingers on the page.
    <form action={action} className="max-w-sm space-y-3">
      {FIELDS.map(({ name, label, autoComplete }) => (
        <div key={name} className="space-y-1">
          <label htmlFor={name} className="block text-sm font-medium">
            {label}
          </label>
          <input
            id={name}
            name={name}
            type="password"
            required
            minLength={name === "currentPassword" ? undefined : PASSWORD_MIN_LENGTH}
            maxLength={PASSWORD_MAX_LENGTH}
            autoComplete={autoComplete}
            {...fieldErrorProps(state, name, "password-error")}
            className={`${inputClass} w-full`}
          />
        </div>
      ))}
      <button
        type="submit"
        disabled={pending}
        className="rounded bg-foreground px-4 py-2 text-background disabled:opacity-60"
      >
        {pending ? "Changing…" : "Change password"}
      </button>
      <FormMessage id="password-error" state={state} />
    </form>
  );
}
