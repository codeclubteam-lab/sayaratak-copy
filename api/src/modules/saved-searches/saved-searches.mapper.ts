import type { SavedSearch } from "@sayaratak/shared/schemas/saved-search"

import type { savedSearches } from "./saved-searches.tables"

type SavedSearchRow = typeof savedSearches.$inferSelect

export function toSavedSearch(row: SavedSearchRow): SavedSearch {
  return {
    id: row.id,
    name: row.name,
    params: row.params,
    alerts: row.alerts,
    newCount: row.newCount,
    createdAt: row.createdAt.toISOString(),
  }
}
