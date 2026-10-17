const numericCell = Symbol("CSV decimal");

/** A numeric column may retain a signed decimal, but never an arbitrary expression. */
export function csvNumber(value: string | number | null | undefined) {
  const text = String(value ?? "");
  const decimal = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/;
  return decimal.test(text) && Number.isFinite(Number(text)) ? { [numericCell]: text } : text;
}

/**
 * CSV quoting protects field boundaries, not spreadsheet formula interpretation. Prefix
 * risky text with an apostrophe inside the quoted cell. Inspect past leading whitespace
 * and controls too, including full-width formula prefixes used in some locales.
 * This is an export-only convention; spreadsheet import/save behavior still varies.
 */
export function escapeCsv(value: unknown) {
  const numeric = typeof value === "object" && value !== null && numericCell in value;
  let text = String(numeric ? value[numericCell] : value ?? "");
  if (!numeric && (/^[\s\u0000-\u001f\u007f]*[=+\-@＝＋－＠]/u.test(text) || /^[\s\u0000-\u001f\u007f]*[\t\r\n]/u.test(text))) {
    text = `'${text}`;
  }
  return `"${text.replaceAll('"', '""')}"`;
}
