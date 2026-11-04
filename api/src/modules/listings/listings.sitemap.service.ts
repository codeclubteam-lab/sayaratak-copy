import { db } from "~/shared/db/client"

import * as q from "./listings.sitemap.queries"

/**
 * Every listing a search engine may index: approved and available, with the
 * owners hidden from the public site (banned, suspended) left out. The
 * sitemap builds the listing pages and the landing pages from the same rows.
 */
export function listIndexableListings(hiddenOwnerIds: string[]) {
  return q.listIndexable(db, hiddenOwnerIds)
}
