import type { Executor } from "~/shared/db/tx"
import { both } from "~/shared/text/bilingual"
import { newId } from "~/shared/text/ids"
import { slugify } from "~/shared/text/slug"
import { clock } from "~/shared/time/clock"
import * as taxonomy from "~/modules/taxonomy/taxonomy.service"

import * as q from "./businesses.write.queries"
import type {
  NewBusiness,
  NewDealership,
  NewMechanic,
  NewWorkshop,
} from "./businesses.types"

const ID_PREFIX = { dealership: "d", workshop: "w", mechanic: "m" } as const
const SERVICE_ID_PREFIX = "svc"
const FALLBACK_SLUG_WORD = "business"
// Slug endings tried in turn: the last 4, then the last 8 characters of the owner id.
const SLUG_TAIL_LENGTHS = [4, 8]

/**
 * Creates the dealership, workshop or mechanic profile of an account, with
 * its services, served cities and skills, active and unverified. The city
 * and district must exist (422 `validation`). The slug is the Latin part of
 * the name plus the end of the owner id (the mock's shape).
 */
export async function createBusiness(ex: Executor, input: NewBusiness) {
  await taxonomy.checkPicks(ex, {
    cityId: input.cityId,
    districtId: input.kind === "mechanic" ? null : input.districtId,
    makeId: null,
    modelId: null,
    partCategoryId: null,
  })
  const id = newId(ID_PREFIX[input.kind])
  const common = {
    id,
    ownerUserId: input.ownerUserId,
    slug: await pickSlug(ex, input),
    name: both(input.name),
    cityId: input.cityId,
    whatsapp: input.whatsapp,
    createdAt: clock.now(),
  }
  if (input.kind === "dealership") await saveDealership(ex, common, input)
  if (input.kind === "workshop") await saveWorkshop(ex, common, input)
  if (input.kind === "mechanic") await saveMechanic(ex, common, input)
  return id
}

type Common = {
  id: string
  ownerUserId: string
  slug: string
  name: { ar: string; en: string }
  cityId: string
  whatsapp: string | null
  createdAt: Date
}

// What dealerships and workshops store for their address and look.
function placeColumns(input: NewDealership | NewWorkshop) {
  return {
    districtId: input.districtId,
    address: input.address,
    lat: input.location?.lat ?? null,
    lng: input.location?.lng ?? null,
    hours: input.hours,
    logoUploadId: input.logoUploadId,
    coverUploadId: input.coverUploadId,
    description: both(input.description),
  }
}

async function saveDealership(
  ex: Executor,
  common: Common,
  input: NewDealership
) {
  await q.insertDealership(ex, {
    ...common,
    ...placeColumns(input),
    phones: input.phones,
  })
}

async function saveWorkshop(ex: Executor, common: Common, input: NewWorkshop) {
  await q.insertWorkshop(ex, {
    ...common,
    ...placeColumns(input),
    phone: input.phone,
  })
  const templates = await taxonomy.getKnownServiceTemplateIds(
    ex,
    input.services.flatMap((service) => service.templateId ?? [])
  )
  await q.insertServices(
    ex,
    input.services.map((service, position) => ({
      ...service,
      // A template an admin deleted since the page loaded reads as a custom service.
      templateId:
        service.templateId && templates.has(service.templateId)
          ? service.templateId
          : null,
      id: newId(SERVICE_ID_PREFIX),
      workshopId: common.id,
      position,
    }))
  )
}

async function saveMechanic(ex: Executor, common: Common, input: NewMechanic) {
  await q.insertMechanic(ex, {
    ...common,
    photoUploadId: input.photoUploadId,
    bio: both(input.bio),
    yearsOfExperience: input.yearsOfExperience,
    phone: input.phone,
  })
  // The home city comes first, so the list the owner edits keeps it in front.
  const [cityIds, skillIds] = await Promise.all([
    taxonomy.keepCities(ex, [input.cityId, ...input.servedCityIds]),
    taxonomy.keepSpecializations(ex, input.specializationIds),
  ])
  await q.insertMechanicCities(
    ex,
    cityIds.map((cityId, position) => ({
      mechanicId: common.id,
      cityId,
      position,
    }))
  )
  await q.insertMechanicSpecializations(
    ex,
    skillIds.map((specializationId, position) => ({
      mechanicId: common.id,
      specializationId,
      position,
    }))
  )
}

// Example: "Al Nour Motors" owned by account `...x7k2` is `al-nour-motors-x7k2`; an
// Arabic-only name is `business-x7k2`. A taken slug takes a longer tail of the id.
async function pickSlug(ex: Executor, input: NewBusiness) {
  const words = slugify(input.name) || FALLBACK_SLUG_WORD
  for (const length of SLUG_TAIL_LENGTHS) {
    const slug = `${words}-${input.ownerUserId.slice(-length)}`
    if (!(await q.hasSlug(ex, { kind: input.kind, slug }))) return slug
  }
  // The whole owner id is unique per account, so a slug made of it cannot be taken by another.
  return `${words}-${input.ownerUserId}`
}
