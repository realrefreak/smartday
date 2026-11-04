// The High / Medium / Low drop-down, shared by the add and edit forms.
// A plain <select>: it works without JavaScript, with the keyboard, and with
// screen readers, and only ever sends one of our three values (the server
// checks anyway).

import { DEFAULT_PRIORITY, PRIORITIES } from "@/lib/task-validation";
import { inputClass } from "./styles";

export default function PrioritySelect({ id, defaultValue, ...props }) {
  return (
    <>
      <label htmlFor={id} className="sr-only">
        Priority
      </label>
      <select
        id={id}
        name="priority"
        defaultValue={defaultValue || DEFAULT_PRIORITY}
        {...props}
        className={inputClass}
      >
        {PRIORITIES.map(({ value, label }) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>
    </>
  );
}
