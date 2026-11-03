// Which tasks to show: the "?show=" part of the /tasks URL.
//
// Keeping this in the URL (not in React state) means the choice survives a
// reload, works with the back button, and can be bookmarked or shared.

export const TASK_FILTERS = [
  { value: "all", label: "All" },
  { value: "active", label: "Active" },
  { value: "done", label: "Done" },
];

const VALUES = new Set(TASK_FILTERS.map((filter) => filter.value));

// Turns whatever is in the URL into a known filter. Anyone can type anything
// in a URL (?show=banana, ?show=a&show=b gives an array), so anything
// unexpected quietly falls back to "all".
export function parseTaskFilter(value) {
  return typeof value === "string" && VALUES.has(value) ? value : "all";
}

// The link for a filter. "all" is the default, so it gets the plain URL.
export function taskFilterHref(filter) {
  return filter === "all" ? "/tasks" : `/tasks?show=${filter}`;
}
