"use client";
// The daily email reminder switch on the Account page.

import { useActionState } from "react";
import { formatHour } from "@/lib/reminder-validation";
import { inputClass } from "@/app/tasks/styles";
import { saveRemindersAction } from "./actions";
import FormMessage from "./FormMessage";

const HOURS = Array.from({ length: 24 }, (_, hour) => hour);

export default function ReminderForm({ email, enabled, hour }) {
  const [state, action, pending] = useActionState(saveRemindersAction, {
    error: "",
    success: "",
    enabled,
    hour,
  });

  // The browser's time zone goes along with the form, so the server knows
  // what "8:00" means for you. Read when the form is sent (in the browser),
  // not when the page is drawn (which happens on the server first).
  function addTimeZone(formData) {
    formData.set("timeZone", Intl.DateTimeFormat().resolvedOptions().timeZone ?? "UTC");
    return action(formData);
  }

  return (
    <form action={addTimeZone} className="space-y-3">
      <label className="flex items-start gap-3">
        <input
          type="checkbox"
          name="enabled"
          defaultChecked={state.enabled}
          className="mt-1 h-4 w-4"
        />
        <span>
          <span className="block font-medium">Email me a daily reminder</span>
          <span className="block text-sm text-zinc-600 dark:text-zinc-400">
            Sent to {email}, only on days when something is overdue or due. Every email has an
            unsubscribe link.
          </span>
        </span>
      </label>

      <div className="flex flex-wrap items-center gap-2">
        <label htmlFor="reminder-hour" className="text-sm">
          Send it at
        </label>
        <select
          id="reminder-hour"
          name="hour"
          defaultValue={String(state.hour)}
          className={inputClass}
        >
          {HOURS.map((value) => (
            <option key={value} value={value}>
              {formatHour(value)}
            </option>
          ))}
        </select>
        <span className="text-sm text-zinc-600 dark:text-zinc-400">your time</span>
        <button
          type="submit"
          disabled={pending}
          className="rounded bg-foreground px-4 py-2 text-background disabled:opacity-60"
        >
          {pending ? "Saving…" : "Save reminders"}
        </button>
      </div>
      <FormMessage id="reminders-error" state={state} />
    </form>
  );
}
