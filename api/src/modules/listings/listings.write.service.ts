import { extraDefaults } from "@sayaratak/shared/schemas/listing-fields"
import type {
  listingCreateSchema,
  listingPatchSchema,
} from "@sayaratak/shared/schemas/inputs"
import { makeListingSlug } from "@sayaratak/shared/lib/slug"
import type { z } from "zod"

import { type Transaction, transaction } from "~/shared/db/tx"
import { fail } from "~/shared/http/errors"
import { both } from "~/shared/text/bilingual"
import { clock } from "~/shared/time/clock"
import type { SessionUser } from "~/modules/auth/auth.types"
import * as businesses from "~/modules/businesses/businesses.service"
import * as content from "~/modules/content/content.service"
import * as savedSearches from "~/modules/saved-searches/saved-searches.service"
import * as taxonomy from "~/modules/taxonomy/taxonomy.service"
import * as uploads from "~/modules/uploads/uploads.media.service"

import { columnsOf, searchTextOf } from "./listings.columns.service"
import * as q from "./listings.queries"
import {
  checkSubmitted,
  checkUnderLimit,
  newFreeListingId,
  publishState,
} from "./listings.rules.service"
import { type ListingRow, toOneListing } from "./listings.view.service"
import { saveChanges } from "./listings.patch.service"

type CreateBody = z.output<typeof listingCreateSchema>
type PatchBody = z.output<typeof listingPatchSchema>

const DAY_MS = 86_400_000
const POSTING_ROLES = new Set(["user", "dealership"])

/**
 * `POST /listings`: a draft, or a listing sent to review (published at once
 * for an auto-approved verified dealership). A dealership posts as its
 * business. Sending counts against the plan limit.
 */
export function createListing(user: SessionUser, body: CreateBody) {
  if (!POSTING_ROLES.has(user.role)) fail.forbidden()
  return transaction(async (tx) => {
    const submit = body.submit ?? false
    if (submit) await checkUnderLimit(tx, user)
    if (submit) checkSubmitted(body)
    await taxonomy.checkPicks(tx, {
      cityId: body.cityId,
      districtId: body.districtId ?? null,
      makeId: body.makeId ?? null,
      modelId: body.modelId ?? null,
      partCategoryId: body.partCategoryId ?? null,
    })
    const mediaIds = (body.media ?? []).map((media) => media.id)
    await uploads.attachMedia(tx, {
      ownerUserId: user.id,
      ids: mediaIds,
      kept: [],
    })
    const row = await q.insertListing(
      tx,
      await newRow(tx, { user, body, submit })
    )
    await q.replaceMedia(tx, { listingId: row.id, uploadIds: mediaIds })
    await feedSavedSearches(tx, row)
    return toOneListing(tx, row, user)
  })
}

// A listing published at once (auto-approved) counts as a new match for saved searches.
async function feedSavedSearches(tx: Transaction, row: ListingRow) {
  if (row.moderation === "approved")
    await savedSearches.onListingApproved(tx, row)
}

/**
 * `PATCH /listings/:id`: the owner's or an admin's changes. Changing what a
 * buyer judges sends an approved listing back to review; `submit` sends a
 * draft or rejected one.
 */
export function patchListing(
  user: SessionUser,
  change: { id: string; body: PatchBody }
) {
  return transaction(async (tx) => {
    const saved = await saveChanges(tx, { user, ...change })
    return toOneListing(tx, saved, user)
  })
}

async function newRow(
  tx: Transaction,
  draft: { user: SessionUser; body: CreateBody; submit: boolean }
) {
  const { user, body } = draft
  const [dealer, settings, moderation, id] = await Promise.all([
    businesses.getDealershipOf(tx, user.id),
    content.getListingSettings(tx),
    publishState(tx, user, draft.submit),
    newFreeListingId(tx),
  ])
  const now = clock.now()
  const description = both(body.description ?? "")
  const columns = columnsOf(body, extraDefaults)
  const listing = {
    ...defaultsOf(body),
    ...columns,
    title: body.title,
    description,
  }
  return {
    ...listing,
    id,
    slug: makeListingSlug(body.title, body.cityId, id),
    ownerUserId: user.id,
    ownerType: dealer ? ("dealership" as const) : ("user" as const),
    ownerName: dealer ? dealer.name : both(user.name),
    contact: {
      phone: body.contact?.phone ?? user.phone ?? dealer?.phones[0] ?? "",
      whatsapp: body.contact?.whatsapp ?? null,
      showPhone: body.contact?.showPhone ?? true,
      methods: body.contact?.methods ?? ["call", "chat"],
    },
    status: "available" as const,
    moderation,
    searchText: await searchTextOf(tx, listing),
    expiresAt: new Date(now.getTime() + settings.listingExpiryDays * DAY_MS),
    createdAt: now,
    updatedAt: now,
  }
}

// What the mock fills in for a key the body left out.
function defaultsOf(body: CreateBody) {
  return {
    kind: "vehicle" as const,
    intent: "sale" as const,
    negotiable: false,
    condition: "used" as const,
    compatibleTypes: [],
    cityId: body.cityId,
    price: body.price,
  }
}
