import type { Role } from "@sayaratak/shared/schemas/fields"
import type { onboardingInputSchema } from "@sayaratak/shared/schemas/inputs"
import type { z } from "zod"

import { transaction, type Transaction } from "~/shared/db/tx"
import { fail } from "~/shared/http/errors"
import * as auth from "~/modules/auth/auth.service"
import type { SessionUser } from "~/modules/auth/auth.types"
import { createBusiness } from "~/modules/businesses/businesses.create.service"
import * as plans from "~/modules/plans/plans.service"
import * as taxonomy from "~/modules/taxonomy/taxonomy.service"
import * as uploads from "~/modules/uploads/uploads.media.service"

import { readIndividual } from "./onboarding.individual.service"
import {
  type BusinessRole,
  type Pictures,
  readBusiness,
} from "./onboarding.business.service"

type Input = z.infer<typeof onboardingInputSchema>

/**
 * Ends onboarding: the account takes its role for good, a business role also
 * gets its profile and the free plan of its audience (a paid pick is only
 * remembered, to be paid for afterwards). One account has one role, so a
 * second call is 409 `conflict`; admins have no business role, 403.
 * Two parallel calls queue on the account row, so only one passes.
 */
export async function completeOnboarding(user: SessionUser, input: Input) {
  return transaction(async (tx) => {
    // The session's copy may be a moment old; the locked row is the truth.
    const account = await auth.lockUser(tx, user.id)
    if (!account) fail.notFound()
    if (account.role === "admin") fail.forbidden()
    if (account.onboardingDone) fail.conflict()
    const chosenPlanId = await getChosenPlanId(tx, input)
    if (input.role === "user")
      return finishIndividual(tx, {
        account,
        payload: input.payload,
        chosenPlanId,
      })
    return finishBusiness(tx, {
      account,
      role: input.role,
      payload: input.payload,
      chosenPlanId,
    })
  })
}

type Finish = {
  account: SessionUser
  payload: Record<string, unknown>
  chosenPlanId: string | null
}

async function finishBusiness(
  tx: Transaction,
  finish: Finish & { role: BusinessRole }
) {
  const { account, role, payload } = finish
  const pictures = await attachPictures(tx, account.id, payload)
  const business = readBusiness(role, payload, { user: account, pictures })
  await createBusiness(tx, business)
  await plans.startFreeSubscription(tx, { userId: account.id, audience: role })
  return auth.finishOnboarding(tx, {
    id: account.id,
    role,
    cityId: business.cityId,
    chosenPlanId: finish.chosenPlanId,
  })
}

// The mock's individual path: name, photo, interests and home city.
async function finishIndividual(tx: Transaction, finish: Finish) {
  const { account, payload } = finish
  const form = readIndividual(payload)
  const cityId = form.cityId ?? account.cityId
  if (!cityId) fail.validation({ cityId: "validation.required" })
  await taxonomy.checkPicks(tx, {
    cityId,
    districtId: null,
    makeId: null,
    modelId: null,
    partCategoryId: null,
  })
  const avatarUploadId = await attachOne(tx, {
    ownerUserId: account.id,
    id: stringOf(payload, "avatarId"),
    field: "avatarId",
  })
  return auth.finishOnboarding(tx, {
    id: account.id,
    role: "user",
    cityId,
    chosenPlanId: finish.chosenPlanId,
    name: form.fullName ?? account.name,
    interests: form.interests,
    ...(avatarUploadId && { avatarUploadId }),
  })
}

async function getChosenPlanId(tx: Transaction, input: Input) {
  const planId = stringOf(input.payload, "planId")
  if (!planId) return null
  const audience: Role = input.role
  return (await plans.getPickablePaidPlanId(tx, { planId, audience })) ?? null
}

// Logo, cover and photo ids from the payload; each must be the account's own unused image.
async function attachPictures(
  tx: Transaction,
  ownerUserId: string,
  payload: Record<string, unknown>
): Promise<Pictures> {
  const pick = (field: string) => ({
    ownerUserId,
    id: stringOf(payload, field),
    field,
  })
  return {
    logo: await attachOne(tx, pick("logoId")),
    cover: await attachOne(tx, pick("coverId")),
    photo: await attachOne(tx, pick("photoId")),
  }
}

async function attachOne(
  tx: Transaction,
  picture: { ownerUserId: string; id: string | undefined; field: string }
) {
  if (!picture.id) return null
  await uploads.attachMedia(tx, {
    ownerUserId: picture.ownerUserId,
    ids: [picture.id],
    kept: [],
    field: picture.field,
    imagesOnly: true,
  })
  return picture.id
}

function stringOf(payload: Record<string, unknown>, key: string) {
  const value = payload[key]
  return typeof value === "string" ? value : undefined
}
