import { db } from "~/shared/db/client"

import { listListedSlugs } from "./businesses.sitemap.queries"

/** Slugs of every listed dealership, workshop and mechanic, for the sitemap. */
export async function listListedProfileSlugs(hiddenOwnerIds: string[]) {
  // Three independent reads.
  const [dealerships, workshops, mechanics] = await Promise.all([
    listListedSlugs(db, { kind: "dealerships", hiddenOwnerIds }),
    listListedSlugs(db, { kind: "workshops", hiddenOwnerIds }),
    listListedSlugs(db, { kind: "mechanics", hiddenOwnerIds }),
  ])
  return { dealerships, workshops, mechanics }
}
