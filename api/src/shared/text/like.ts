/**
 * A `LIKE` pattern for text that contains `term`, with `%`, `_` and `\` taken
 * literally. Example: `50%` gives `%50\%%`, so it matches "50% off" and not "500".
 */
export function containing(term: string) {
  return `%${term.replace(/[\\%_]/g, "\\$&")}%`
}
