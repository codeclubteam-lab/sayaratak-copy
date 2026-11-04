import type { SearchParams } from "@sayaratak/shared/search/schemas"

import { db } from "~/shared/db/client"
import type { Box } from "~/shared/geo/box"
import type { SessionUser } from "~/modules/auth/auth.types"

import { toMapPoint } from "./listings.mapper"
import { scopeOf } from "./listings.search.service"
import * as q from "./listings.search.queries"
import { toListings } from "./listings.view.service"

/**
 * The vehicle layer of the map: listings matching the search filters with a
 * pin inside the box, Featured first, at most `limit`, with the total.
 * Pins are rounded to about 1 km for everyone but the owner and admins.
 */
export async function listVehiclePoints(find: {
  viewer: SessionUser | null
  params: SearchParams
  box: Box
  limit: number
}) {
  const { params } = find
  const scope = await scopeOf(db, params)
  const page = await q.listInBox(db, {
    params,
    scope,
    box: find.box,
    limit: find.limit,
  })
  const items = await toListings(db, page.rows, find.viewer)
  const points = items.flatMap((listing) => {
    const { location } = listing
    return location ? [toMapPoint({ ...listing, location })] : []
  })
  return { points, total: page.total }
}
