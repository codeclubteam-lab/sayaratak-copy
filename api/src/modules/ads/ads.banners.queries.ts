import type { Banner } from "@sayaratak/shared/schemas/admin"
import { and, asc, eq, gte, lte, sql } from "drizzle-orm"

import type { Executor } from "~/shared/db/tx"

import { banners } from "./ads.tables"

/** Banners that are on and inside their dates at `now`, by sort order (mock array order breaks ties). */
export function listLive(
  ex: Executor,
  find: { placement: Banner["placement"] | undefined; now: Date }
) {
  return ex
    .select()
    .from(banners)
    .where(
      and(
        eq(banners.active, true),
        lte(banners.startsAt, find.now),
        gte(banners.endsAt, find.now),
        find.placement ? eq(banners.placement, find.placement) : undefined
      )
    )
    .orderBy(
      asc(banners.sortOrder),
      asc(sql`length(${banners.id})`),
      asc(banners.id)
    )
}
