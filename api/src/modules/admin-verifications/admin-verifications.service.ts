import type { AdminVerification } from "@sayaratak/shared/schemas/admin"
import type { VerificationRequest } from "@sayaratak/shared/schemas/admin"

import { db } from "~/shared/db/client"
import { type Executor, transaction } from "~/shared/db/tx"
import type { Actor } from "~/modules/audit/audit.types"
import * as auth from "~/modules/auth/auth.service"
import * as businesses from "~/modules/businesses/businesses.admin.service"
import * as verification from "~/modules/verification/verification.admin.service"
import * as uploads from "~/modules/uploads/uploads.media.service"

/** `GET /admin/verifications`: requests newest first, each with its business, owner and documents. */
export async function getAdminVerifications(
  query: verification.VerificationsQuery
) {
  const { requests, ...page } = await verification.listAdminRequests(
    db,
    query,
    await searchOf(query.q)
  )
  return { ...page, items: await toViews(db, requests) }
}

/** `POST /admin/verifications/:id/approve`: the request as it is after; the business gets the badge. */
export function approveVerification(actor: Actor, id: string) {
  return transaction(async (tx) => {
    await verification.approveRequest(tx, actor, id)
    return viewOne(tx, id)
  })
}

/** `POST /admin/verifications/:id/reject`: the request as it is after, with the reason. */
export function rejectVerification(
  actor: Actor,
  change: { id: string; reason: string }
) {
  return transaction(async (tx) => {
    await verification.rejectRequest(tx, actor, change)
    return viewOne(tx, change.id)
  })
}

// The text search reads the business name and the owner name; each module finds its own ids.
async function searchOf(text: string | undefined) {
  const term = text?.trim().toLowerCase()
  if (!term) return undefined
  const [targetIds, ownerIds] = await Promise.all([
    businesses.listBusinessIdsNamed(db, term),
    auth.listIdsNamed(db, term),
  ])
  return { targetIds, ownerIds }
}

async function viewOne(ex: Executor, id: string) {
  const { requests } = await verification.listAdminRequests(ex, { id })
  const [view] = await toViews(ex, requests)
  if (!view) throw new Error("verification request vanished after a decision")
  return view
}

// Business, picture and owner come from their own modules, in independent reads.
async function toViews(
  ex: Executor,
  requests: VerificationRequest[]
): Promise<AdminVerification[]> {
  const [rows, owners] = await Promise.all([
    businesses.getAdminBusinessRows(
      ex,
      requests.map((r) => ({ kind: r.targetType, id: r.targetId }))
    ),
    auth.listUsers(
      ex,
      requests.map((r) => r.ownerId)
    ),
  ])
  const media = await uploads.getMediaOf(
    ex,
    rows.flatMap((row) => (row.imageUploadId ? [row.imageUploadId] : []))
  )
  const targetOf = new Map(rows.map((row) => [row.id, row]))
  const ownerOf = new Map(owners.map((owner) => [owner.id, owner]))
  return requests.map((request) => {
    const row = targetOf.get(request.targetId)
    const owner = ownerOf.get(request.ownerId)
    return {
      ...request,
      target: row
        ? {
            name: row.name,
            slug: row.slug,
            imageUrl:
              (row.imageUploadId && media.get(row.imageUploadId)?.url) || "",
            cityId: row.cityId,
          }
        : null,
      owner: owner ? auth.toOwnerContact(owner) : null,
    }
  })
}
