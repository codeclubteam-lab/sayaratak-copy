/** What the `q` search matches a listing against: every part joined and lowercased, as the mock does. */
export function searchText(parts: (string | undefined)[]) {
  return parts.join(" ").toLowerCase()
}
