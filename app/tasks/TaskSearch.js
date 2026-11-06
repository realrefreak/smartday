"use client";
// The search box. As you type, it updates ?q= in the URL; the page (a Server
// Component) reads it and asks the database for matching tasks.
//
// It gets the current filter, sort and search as props from the page, rather
// than reading the URL itself with useSearchParams (which in Next.js 16 would
// need a <Suspense> boundary around it).

import { useEffect, useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import { SEARCH_MAX_LENGTH, tasksHref } from "@/lib/task-filter";
import { inputClass } from "./styles";

// Wait this long after the last key press before searching, so typing
// "groceries" sends one request instead of nine. ("Debouncing".)
const DEBOUNCE_MS = 300;

export default function TaskSearch({ filter, sort, query }) {
  const router = useRouter();
  // isPending is true while the new results are loading.
  const [isPending, startTransition] = useTransition();
  const timer = useRef(null);

  const input = useRef(null);

  // If the component goes away (e.g. you sign out), cancel a pending search.
  useEffect(() => () => clearTimeout(timer.current), []);

  // defaultValue only counts when the box first appears. When the search
  // changes from elsewhere (clicking a #tag), show it in the box, unless
  // you're typing in it right now (that would fight with your typing).
  useEffect(() => {
    if (input.current && document.activeElement !== input.current) {
      input.current.value = query;
    }
  }, [query]);

  function search(text) {
    clearTimeout(timer.current);
    // replace, not push: each key press shouldn't add a Back-button step.
    // scroll: false keeps the page where it is.
    startTransition(() => {
      router.replace(tasksHref({ filter, sort, query: text }), { scroll: false });
    });
  }

  return (
    // role="search" marks this as the page's search area for screen readers.
    // Pressing Enter searches straight away instead of reloading the page.
    <form
      role="search"
      onSubmit={(event) => {
        event.preventDefault();
        search(new FormData(event.currentTarget).get("q"));
      }}
    >
      <label htmlFor="task-search" className="sr-only">
        Search tasks
      </label>
      <input
        ref={input}
        id="task-search"
        name="q"
        type="search"
        defaultValue={query}
        maxLength={SEARCH_MAX_LENGTH}
        placeholder="Search tasks and notes"
        onChange={(event) => {
          const text = event.target.value;
          clearTimeout(timer.current);
          timer.current = setTimeout(() => search(text), DEBOUNCE_MS);
        }}
        aria-busy={isPending}
        className={`${inputClass} w-full ${isPending ? "opacity-70" : ""}`}
      />
    </form>
  );
}
