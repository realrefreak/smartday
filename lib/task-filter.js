// What the /tasks page shows, read from its URL:
//   ?show=  which tasks (all / active / done)
//   ?sort=  their order (due date / priority)
//   ?q=     search text
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

export const TASK_SORTS = [
  { value: "due", label: "Due date" },
  { value: "priority", label: "Priority" },
];

const SORT_VALUES = new Set(TASK_SORTS.map((sort) => sort.value));

// Same idea as parseTaskFilter: anything unexpected means the default.
export function parseTaskSort(value) {
  return typeof value === "string" && SORT_VALUES.has(value) ? value : "due";
}

// Longer than any title, so it can still match the start of a long note.
export const SEARCH_MAX_LENGTH = 100;

// The search text: trimmed, and cut to a sane length so a huge URL can't
// become a huge database query. Anything that isn't one string means no search.
export function parseSearchQuery(value) {
  return typeof value === "string" ? value.trim().slice(0, SEARCH_MAX_LENGTH) : "";
}

// The /tasks link for a filter, sort order and search together. Defaults are
// left out, so the plain view is just "/tasks". URLSearchParams handles the
// encoding (spaces, &, ? and so on in the search text).
export function tasksHref({ filter = "all", sort = "due", query = "" } = {}) {
  const params = new URLSearchParams();
  if (filter !== "all") params.set("show", filter);
  if (sort !== "due") params.set("sort", sort);
  const search = query.trim();
  if (search) params.set("q", search);

  const text = params.toString();
  return text ? `/tasks?${text}` : "/tasks";
}
