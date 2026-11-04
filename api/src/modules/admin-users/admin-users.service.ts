import type { banInputSchema } from "@sayaratak/shared/schemas/inputs"
import type { z } from "zod"

import { db } from "~/shared/db/client"
import type { Actor } from "~/modules/audit/audit.types"
import * as users from "~/modules/auth/auth.users.service"
import * as listings from "~/modules/listings/listings.overview.service"
import * as reports from "~/modules/reports/reports.service"

/**
 * `GET /admin/users`: a page of accounts, each with the listings it has (drafts
 * left out) and the reports made on those listings.
 */
export async function getAdminUsers(query: users.UsersQuery) {
  const page = await users.listAdminUsers(query)
  const idsPerOwner = await listings.listIdsPerOwner(
    db,
    page.items.map((item) => item.id)
  )
  const reportCounts = await reports.countReportsPerListing(
    db,
    [...idsPerOwner.values()].flat()
  )
  return {
    ...page,
    items: page.items.map((item) => {
      const own = idsPerOwner.get(item.id) ?? []
      return {
        ...item,
        listings: own.length,
        reportsAgainst: own.reduce(
          (sum, id) => sum + (reportCounts.get(id) ?? 0),
          0
        ),
      }
    }),
  }
}

/** `POST /admin/users/:id/ban`: the account as it is after. */
export function banAccount(
  actor: Actor,
  change: {
    userId: string
    input: z.output<typeof banInputSchema>
    headers: Headers
  }
) {
  return users.banUser(actor, change)
}

/** `POST /admin/users/:id/unban`: the account as it is after. */
export function unbanAccount(
  actor: Actor,
  change: { userId: string; headers: Headers }
) {
  return users.unbanUser(actor, change)
}
