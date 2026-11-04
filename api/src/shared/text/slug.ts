/**
 * Latin letters and digits of a name as a URL part, the mock's `slugify`.
 * An Arabic-only name gives "", so the caller supplies the fallback word.
 * Example: "Al Nour Motors!" gives "al-nour-motors".
 */
export function slugify(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
}
