// Turning rows of values into CSV text that Excel, Google Sheets and Numbers
// all open correctly.

// Spreadsheets treat a cell starting with = + - @ (or a tab / carriage return)
// as a formula. A task titled "=HYPERLINK(...)" could then run when someone
// opens the file ("CSV injection"). Starting such cells with ' makes them
// plain text.
const FORMULA_START = /^[=+\-@\t\r]/;

function csvCell(value) {
  if (value === null || value === undefined) {
    return "";
  }

  let text = String(value);
  if (FORMULA_START.test(text)) {
    text = `'${text}`;
  }

  // Cells with commas, quotes or line breaks go in double quotes, and any
  // double quote inside is written twice: She said "hi" -> "She said ""hi""".
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

// rows: an array of arrays, the first being the column headings.
// Lines end in \r\n, which the CSV standard (RFC 4180) asks for.
export function toCsv(rows) {
  return rows.map((row) => row.map(csvCell).join(",")).join("\r\n") + "\r\n";
}
