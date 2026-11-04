import type { Role } from "@sayaratak/shared/schemas/fields"

import { db } from "~/shared/db/client"
import { type Executor, type Transaction, transaction } from "~/shared/db/tx"
import { fail } from "~/shared/http/errors"
import type { SessionUser } from "~/modules/auth/auth.types"
import * as businesses from "~/modules/businesses/businesses.update.service"
import * as profiles from "~/modules/businesses/businesses.profile.service"
import * as listings from "~/modules/listings/listings.service"
import * as taxonomy from "~/modules/taxonomy/taxonomy.service"

import { columnsOf, readPatch } from "./my-business.patch.service"

export type BusinessRole = Extract<Role, "dealership" | "workshop" | "mechanic">

/** The business profile the account owns, as `GET /me/business` shows it (a suspended one too). */
export async function getMyBusiness(user: SessionUser) {
  const ref = await businesses.getBusinessRefOf(db, user.id)
  if (!ref) fail.notFound()
  return profileOf(db, { ref, ownerUserId: user.id })
}

/**
 * `PATCH /me/business`: saves the fields the page sends (a section at a time),
 * checks them first, and answers the whole profile. A name, description or
 * bio typed once is stored in both languages. Edits of one business queue on
 * its row lock, so two saves never mix their lists.
 */
export async function updateMyBusiness(
  user: SessionUser,
  body: Record<string, unknown>
) {
  return transaction(async (tx) => {
    const ref = await businesses.getBusinessRefOf(tx, user.id)
    if (!ref) fail.notFound()
    await businesses.lockBusiness(tx, ref)
    const { form, pictures } = readPatch(ref.kind, body)
    const current = await profileOf(tx, { ref, ownerUserId: user.id })
    await checkPlace(tx, { kind: ref.kind, form, current })
    const change = await changeOf(tx, ref.kind, form)
    await businesses.updateProfile(tx, {
      ref,
      ownerUserId: user.id,
      change,
      pictures,
    })
    return profileOf(tx, { ref, ownerUserId: user.id })
  })
}

// A new city, or a district that must belong to the city the business ends up in.
async function checkPlace(
  tx: Transaction,
  check: {
    kind: businesses.BusinessRef["kind"]
    form: ReturnType<typeof readPatch>["form"]
    current: Awaited<ReturnType<typeof profileOf>>
  }
) {
  const { form, current } = check
  if (form.cityId === undefined && form.districtId === undefined) return
  const district =
    "districtId" in current ? (form.districtId ?? current.districtId) : ""
  await taxonomy.checkPicks(tx, {
    cityId: form.cityId ?? current.cityId,
    districtId: check.kind === "mechanic" ? null : district || null,
    makeId: null,
    modelId: null,
    partCategoryId: null,
  })
}

// Served cities and skills drop unknown ids, as onboarding does.
async function changeOf(
  tx: Transaction,
  kind: businesses.BusinessRef["kind"],
  form: ReturnType<typeof readPatch>["form"]
): Promise<businesses.ProfileChange> {
  const columns = columnsOf(form)
  if (kind !== "mechanic") return { kind, columns }
  return {
    kind,
    columns,
    servedCityIds:
      form.servedCityIds && (await taxonomy.keepCities(tx, form.servedCityIds)),
    specializationIds:
      form.specializationIds &&
      (await taxonomy.keepSpecializations(tx, form.specializationIds)),
  }
}

/** The profile of a business as its owner sees it; a dealership carries its inventory count. */
export async function profileOf(
  ex: Executor,
  find: { ref: businesses.BusinessRef; ownerUserId: string }
) {
  const [profile] = await profilesOf(ex, find)
  if (!profile) fail.notFound()
  return profile
}

async function profilesOf(
  ex: Executor,
  find: { ref: businesses.BusinessRef; ownerUserId: string }
) {
  const { ref } = find
  if (ref.kind === "workshop") return profiles.getWorkshops(ex, [ref.id])
  if (ref.kind === "mechanic") return profiles.getMechanics(ex, [ref.id])
  const inventory = await listings.countInventoryOf(ex, [find.ownerUserId])
  return profiles.getDealerships(ex, { ids: [ref.id], inventory })
}
