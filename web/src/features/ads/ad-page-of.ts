import type { AdPageId } from "@sayaratak/shared/schemas/ads"
import type { SearchParams } from "@sayaratak/shared/search/schemas"

// The ad page of a search: one per category. Rickshaws share the tuk-tuk page; the all-vehicles search shows the Cars page's ads.
export function adPageOf(s: Pick<SearchParams, "kind" | "type">): AdPageId {
  if (s.kind === "part") return "search_parts"
  if (s.type === "truck") return "search_truck"
  if (s.type === "motorcycle") return "search_motorcycle"
  if (s.type === "tuk_tuk" || s.type === "rickshaw") return "search_tuk_tuk"
  return "search_car"
}
