import { slugify } from "@sayaratak/shared/lib/slug"

import type { Executor } from "~/shared/db/tx"
import { type ErrorFields, fail } from "~/shared/http/errors"
import { newId } from "~/shared/text/ids"
import * as users from "~/modules/auth/auth.overview.service"
import * as businesses from "~/modules/businesses/businesses.overview.service"
import * as listings from "~/modules/listings/listings.overview.service"

import * as q from "./taxonomy.admin.queries"
import type { TaxonomyType } from "./taxonomy.types"

/** What an admin sent that decides an entry's place: the country, city or make it sits under, and the English name. */
export type Placement = {
  countryId?: string
  cityId?: string
  makeId?: string
  name?: { en: string }
  code?: string
}

// These lists give a new entry its id, and its slug, from the English name; the word is used when that name has no Latin letters.
const FALLBACK_SLUGS: Partial<Record<TaxonomyType, string>> = {
  cities: "city",
  makes: "make",
  "part-categories": "part-category",
}

const ID_PREFIXES: Partial<Record<TaxonomyType, string>> = {
  districts: "dis",
  models: "mod",
}

// What still names an entry; the first hit makes it "in use".
const USES: Record<
  TaxonomyType,
  (ex: Executor, id: string) => Promise<boolean>[]
> = {
  cities: (ex, id) => [
    q.hasDistrictIn(ex, id),
    listings.hasListingWith(ex, { column: "cityId", id }),
    businesses.hasBusinessInCity(ex, id),
    users.hasUserInCity(ex, id),
  ],
  districts: (ex, id) => [
    listings.hasListingWith(ex, { column: "districtId", id }),
    businesses.hasBusinessInDistrict(ex, id),
  ],
  makes: (ex, id) => [
    q.hasModelOf(ex, id),
    listings.hasListingWith(ex, { column: "makeId", id }),
  ],
  models: (ex, id) => [listings.hasListingWith(ex, { column: "modelId", id })],
  "part-categories": (ex, id) => [
    listings.hasListingWith(ex, { column: "partCategoryId", id }),
  ],
  countries: (ex, id) => [q.hasCityIn(ex, id)],
  "vehicle-types": () => [],
}

// Which list an entry's parent is read from, by the field that names it.
const PARENT_LISTS = {
  countryId: "countries",
  cityId: "cities",
  makeId: "makes",
} as const

/** Whether a listing, profile, account or child entry still names the entry. */
export async function isInUse(
  ex: Executor,
  entry: { type: TaxonomyType; id: string }
) {
  const used = await Promise.all(USES[entry.type](ex, entry.id))
  return used.some(Boolean)
}

/**
 * The id of a new entry. A country's is its code (409 `exists` when taken); a city, make or
 * part category's is the slug of its English name, with a number added when taken; a district
 * or model gets a random id.
 */
export async function chooseId(
  ex: Executor,
  add: { type: TaxonomyType; input: Placement }
) {
  const { type, input } = add
  if (input.code) {
    if (await q.hasRow(ex, { type, id: input.code })) fail.conflict("exists")
    return input.code
  }
  const fallback = FALLBACK_SLUGS[type]
  if (!(fallback && input.name)) return newId(ID_PREFIXES[type] ?? type)
  return nextFreeSlug(ex, { type, base: slugify(input.name.en) || fallback })
}

/** Whether the id is made from the English name, so the entry also has a slug. */
export function hasSlug(type: TaxonomyType) {
  return type in FALLBACK_SLUGS
}

/** 422 when the country, city or make an entry is placed under does not exist. */
export async function checkParents(ex: Executor, input: Placement) {
  const parents = (
    Object.entries(PARENT_LISTS) as [keyof typeof PARENT_LISTS, TaxonomyType][]
  ).flatMap(([field, type]) => {
    const id = input[field]
    return id ? [{ field, type, id }] : []
  })
  // Independent one-row reads, each share-locking the parent so it cannot be deleted before this entry is saved.
  const found = await Promise.all(
    parents.map((parent) => q.hasRowShared(ex, parent))
  )
  const fields: ErrorFields = {}
  parents.forEach((parent, i) => {
    if (!found[i]) fields[parent.field] = "validation.required"
  })
  if (Object.keys(fields).length > 0) fail.validation(fields)
}

/** 409 `last_shown` when this is the only vehicle type or country still on: the site always shows one. */
export async function checkOtherShown(
  ex: Executor,
  entry: { type: TaxonomyType; id: string }
) {
  const hasOther = {
    countries: q.hasOtherCountryShown,
    "vehicle-types": q.hasOtherVehicleTypeShown,
  }[entry.type as "countries" | "vehicle-types"]
  if (hasOther && !(await hasOther(ex, entry.id))) fail.conflict("last_shown")
}

// Example: with `toyota` and `toyota-2` taken, base `toyota` gives `toyota-3`.
async function nextFreeSlug(
  ex: Executor,
  find: { type: TaxonomyType; base: string }
) {
  const taken = new Set(await q.listIdsLike(ex, find))
  let slug = find.base
  for (let n = 2; taken.has(slug); n++) slug = `${find.base}-${n}`
  return slug
}
