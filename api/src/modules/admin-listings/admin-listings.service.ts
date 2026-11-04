import type { adminListingPatchSchema } from "@sayaratak/shared/schemas/inputs"
import type { z } from "zod"

import { db } from "~/shared/db/client"
import { transaction } from "~/shared/db/tx"
import { fail } from "~/shared/http/errors"
import type { Actor } from "~/modules/audit/audit.types"
import * as listings from "~/modules/listings/listings.admin.service"
import * as moderation from "~/modules/listings/listings.moderation.service"
import { toOneListing } from "~/modules/listings/listings.view.service"
import * as reports from "~/modules/reports/reports.service"

type Action = moderation.ModerationAction

// Fields the schema accepts but that an admin may not change here: the text and price are the
// seller's, and a state change must go through the approve, reject, remove or restore route
// (those tell the owner and feed saved-search alerts).
const NOT_EDITABLE = ["title", "description", "price", "moderation"] as const

/** `GET /admin/moderation`: pending listings, newest first. */
export function getModerationQueue(actor: Actor, query: listings.AdminQuery) {
  return listings.listModerationQueue(actor.admin, query)
}

/** `GET /admin/listings`: the table, each listing with its report count. */
export async function getAdminListings(
  actor: Actor,
  query: listings.AdminQuery
) {
  const page = await listings.listAdminListings(actor.admin, query)
  const counts = await reports.countReportsPerListing(
    db,
    page.items.map((item) => item.id)
  )
  return {
    ...page,
    items: page.items.map((item) => ({
      ...item,
      reports: counts.get(item.id) ?? 0,
    })),
  }
}

/** `POST /admin/listings/:id/approve|reject|remove|restore`: the listing as it is after. */
export function moderateListing(
  actor: Actor,
  change: { id: string; action: Action; reason?: string }
) {
  return transaction(async (tx) =>
    toOneListing(
      tx,
      await moderation.moderateOne(tx, actor, change),
      actor.admin
    )
  )
}

/** `POST /admin/listings/bulk`: how many of the picked listings the action changed. */
export async function moderateListings(
  actor: Actor,
  change: { ids: string[]; action: Action; reason?: string }
) {
  const count = await transaction((tx) =>
    moderation.moderateMany(tx, actor, change)
  )
  return { count }
}

/** `PATCH /admin/listings/:id`: the sale state only; any other field is refused with 422. */
export function updateListing(
  actor: Actor,
  change: { id: string; patch: z.output<typeof adminListingPatchSchema> }
) {
  const refused = NOT_EDITABLE.filter((key) => change.patch[key] !== undefined)
  if (refused.length > 0)
    fail.validation(
      Object.fromEntries(refused.map((key) => [key, "validation.not_editable"]))
    )
  return transaction(async (tx) => {
    const status = change.patch.status
    const row = status
      ? await moderation.setStatus(tx, actor, { id: change.id, status })
      : await listings.getForAdmin(tx, change.id)
    return toOneListing(tx, row, actor.admin)
  })
}
