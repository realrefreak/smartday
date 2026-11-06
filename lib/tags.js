// Tags are words in a task title that start with #, like "#work" or
// "#home". No extra database column: they're just part of the title, so
// adding or removing one is a normal edit.
//
// A tag is # followed by letters (any language), digits, _ or -.
// \p{L} = any letter, \p{N} = any digit; the "u" flag turns these on.
const TAG = /#[\p{L}\p{N}_-]+/gu;
const WHOLE_TAG = /^#[\p{L}\p{N}_-]+$/u;

// Splits a title into plain text and tags, in order, for showing tags as
// links: "Call #work boss" -> [{ text: "Call " }, { tag: "#work" }, { text: " boss" }].
export function splitTags(title) {
  const parts = [];
  let last = 0;
  for (const match of title.matchAll(TAG)) {
    if (match.index > last) parts.push({ text: title.slice(last, match.index) });
    parts.push({ tag: match[0] });
    last = match.index + match[0].length;
  }
  if (last < title.length) parts.push({ text: title.slice(last) });
  return parts;
}

// Is this search exactly one tag (e.g. "#work")? Then it should find that
// tag only, not every title containing the text "#work" ("#workshop").
export function isTagQuery(query) {
  return WHOLE_TAG.test(query);
}

// A Postgres regular expression that finds the tag as a whole word: "#work"
// followed by the end of the title or by a character that can't be part of a
// tag. Tags only contain letters, digits, _ and -, none of which mean
// anything special in a regular expression outside [...], so the tag can go
// in as it is. ([:alnum:] = any letter or digit, in any language.)
export function tagPattern(tag) {
  return `${tag}([^[:alnum:]_-]|$)`;
}
