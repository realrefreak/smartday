// The "Doesn't repeat / Daily / Weekly / Monthly" drop-down, shared by the add
// and edit forms. The empty value means a one-off task.

import { REPEATS } from "@/lib/task-validation";
import { inputClass } from "./styles";

export default function RepeatSelect({ id, defaultValue, ...props }) {
  return (
    <>
      <label htmlFor={id} className="sr-only">
        Repeat
      </label>
      <select id={id} name="repeat" defaultValue={defaultValue ?? ""} {...props} className={inputClass}>
        <option value="">Doesn&apos;t repeat</option>
        {REPEATS.map(({ value, label }) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>
    </>
  );
}
