import {
  contactStepSchema,
  detailsSchema,
  listingInputSchema,
  photosStepSchema,
  typeStepSchema,
} from "@sayaratak/shared/listings/schemas"
import type { listingPatchSchema } from "@sayaratak/shared/schemas/inputs"
import type { z } from "zod"

import type { Executor, Transaction } from "~/shared/db/tx"
import { type ErrorFields, fail } from "~/shared/http/errors"
import { toFields } from "~/shared/http/validate"
import { newListingId } from "~/shared/text/ids"
import { clock } from "~/shared/time/clock"
import * as auth from "~/modules/auth/auth.service"
import type { SessionUser } from "~/modules/auth/auth.types"
import * as businesses from "~/modules/businesses/businesses.service"
import * as content from "~/modules/content/content.service"
import * as plans from "~/modules/plans/plans.service"

import * as q from "./listings.queries"
import type { ListingRow } from "./listings.view.service"

type ListingBody = z.output<typeof listingPatchSchema>
type Owner = Pick<SessionUser, "id" | "role">

// A1 rule 19: listing ids are 5 base36 characters, so a clash is retried.
const ID_TRIES = 5

/** Only the owner or an admin may change a listing; anyone else gets 403 `forbidden`. */
export function checkCanEdit(user: SessionUser, row: ListingRow) {
  if (user.role !== "admin" && row.ownerUserId !== user.id) fail.forbidden()
}

/**
 * 403 `limit_reached` when the owner already has as many live listings as
 * their plan allows (handoff "Plans, limits and credits").
 */
export async function checkUnderLimit(tx: Transaction, owner: Owner) {
  // FOR UPDATE on the owner row: two parallel submits must not both pass the limit.
  await auth.lockUser(tx, owner.id)
  const limit = await listingLimitOf(tx, owner)
  if (limit === null) return
  const used = await q.countLiveOf(tx, {
    ownerUserId: owner.id,
    now: clock.now(),
  })
  if (used >= limit) fail.limit("limit_reached")
}

/**
 * Where a saved listing goes: a draft stays a draft; a submitted one waits
 * for review, except a verified dealership's when the admin setting
 * auto-approves them.
 */
export async function publishState(
  ex: Executor,
  user: SessionUser,
  submit: boolean
) {
  if (!submit) return "draft" as const
  const [settings, dealer] = await Promise.all([
    content.getListingSettings(ex),
    businesses.getDealershipOf(ex, user.id),
  ])
  return settings.autoApproveVerifiedDealers && dealer?.verified
    ? ("approved" as const)
    : ("pending" as const)
}

/**
 * A listing sent for review must pass what the wizard checked: the flat
 * payload, then the rules of each step. A draft may be incomplete. Mock
 * `checkSubmitted`, field by field.
 */
export function checkSubmitted(body: ListingBody) {
  const flat = listingInputSchema.safeParse({ ...body, ...body.contact })
  if (!flat.success) fail.validation(toFields(flat.error))
  // The details step holds an empty part number as "", the payload as null.
  const values = { ...flat.data, partNumber: flat.data.partNumber ?? "" }
  const rules = [
    typeStepSchema,
    detailsSchema(values),
    photosStepSchema,
    contactStepSchema,
  ]
  const fields: ErrorFields = {}
  for (const rule of rules) {
    const result = rule.safeParse(values)
    if (!result.success) Object.assign(fields, toFields(result.error))
  }
  if (Object.keys(fields).length > 0) fail.validation(fields)
}

/** Live listings of the account and its limit (null: no cap), for the billing page. */
export async function getListingUsage(ex: Executor, owner: Owner) {
  const [limit, used] = await Promise.all([
    listingLimitOf(ex, owner),
    q.countLiveOf(ex, { ownerUserId: owner.id, now: clock.now() }),
  ])
  return { used, limit }
}

// Mock `listingLimit`: workshops and mechanics post no listings; a dealership
// has its subscription's limit (none without one); a person has no limit
// while individual subscriptions are off, else their subscription's, else the
// free limit.
async function listingLimitOf(ex: Executor, owner: Owner) {
  if (owner.role === "workshop" || owner.role === "mechanic") return null
  const subscription = await plans.getActiveSubscription(ex, owner.id)
  if (owner.role === "dealership") return subscription?.listingLimit ?? null
  const settings = await content.getListingSettings(ex)
  if (!settings.individualSubscriptionsEnabled) return null
  return subscription ? subscription.listingLimit : settings.freeListingLimit
}

/**
 * An unused listing id. Checked before insert rather than retried on the
 * unique violation: a failed insert would abort the open transaction.
 */
export async function newFreeListingId(ex: Executor) {
  for (let i = 0; i < ID_TRIES; i++) {
    const id = newListingId()
    if (!(await q.hasListing(ex, id))) return id
  }
  throw new Error("no free listing id after 5 tries")
}
