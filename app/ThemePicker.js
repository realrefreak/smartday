// System / Light / Dark buttons. A plain form with no JavaScript of its own:
// each button sends its own value, and the Server Action saves it in a cookie.
// aria-pressed tells screen readers which one is on.

import { setThemeAction } from "./theme-actions";
import { THEMES } from "@/lib/theme";

export default function ThemePicker({ theme }) {
  return (
    <form action={setThemeAction} className="flex items-center gap-1 text-sm">
      <span id="theme-label" className="mr-1 text-zinc-600 dark:text-zinc-400">
        Theme
      </span>
      <div role="group" aria-labelledby="theme-label" className="flex gap-1">
        {THEMES.map(({ value, label }) => {
          const selected = value === theme;
          return (
            <button
              key={value}
              type="submit"
              name="theme"
              value={value}
              aria-pressed={selected}
              className={
                selected
                  ? "rounded bg-foreground px-2 py-0.5 text-background"
                  : "rounded px-2 py-0.5 hover:bg-black/5 dark:hover:bg-white/10"
              }
            >
              {label}
            </button>
          );
        })}
      </div>
    </form>
  );
}
