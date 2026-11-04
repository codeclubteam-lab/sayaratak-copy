import type { Bilingual } from "@sayaratak/shared/schemas/fields"

import { db } from "~/shared/db/client"
import { fail } from "~/shared/http/errors"
import { pageParams } from "~/shared/http/page"
import { isOpenNow } from "~/shared/time/hours"
import { clock } from "~/shared/time/clock"
import * as businesses from "~/modules/businesses/businesses.directory.service"
import * as profiles from "~/modules/businesses/businesses.profile.service"
import * as listings from "~/modules/listings/listings.service"
import * as plans from "~/modules/plans/plans.service"
import * as reviews from "~/modules/reviews/reviews.service"

import {
  sortDealerships,
  sortMechanics,
  sortWorkshops,
} from "./directory.sort.service"

/** The raw query values of the three directory lists, read as the mock reads them. */
export type DirectoryQuery = Partial<
  Record<
    | "q"
    | "city"
    | "verified"
    | "sort"
    | "service"
    | "specialization"
    | "minYears"
    | "available"
    | "openNow"
    | "lat"
    | "lng"
    | "page"
    | "pageSize"
    | "limit",
    string
  >
>

// 12 a page, up to 100; `limit` (1 to 24) serves the rails.
const PAGE_SIZE = { default: 12, max: 100 }

/**
 * `GET /dealerships`: listed dealerships by `q` (name, either language),
 * `city`, `verified=true`, sorted by `rating` (default), `listings` or `newest`.
 */
export async function listDealerships(query: DirectoryQuery) {
  const found = await businesses.listDealershipCandidates(db, {
    city: query.city || undefined,
    verified: query.verified === "true",
  })
  const rows = found.filter(matchesName(query.q))
  // Independent reads, for every row because the sort needs them all.
  const [ratings, inventory] = await Promise.all([
    reviews.getRatingSummaries(
      db,
      rows.map((row) => row.id)
    ),
    listings.countInventoryOf(
      db,
      rows.map((row) => row.ownerUserId)
    ),
  ])
  const sorted = sortDealerships(rows, { sort: query.sort, ratings, inventory })
  return pageOf(sorted, query, (ids) =>
    profiles.getDealerships(db, { ids, inventory })
  )
}

/**
 * `GET /workshops`: also `service` (a template id), `openNow=true` (weekly
 * hours on the Khartoum clock) and `sort=nearest` with `lat` and `lng`.
 */
export async function listWorkshops(query: DirectoryQuery) {
  const found = await businesses.listWorkshopCandidates(db, {
    city: query.city || undefined,
    verified: query.verified === "true",
    service: query.service || undefined,
  })
  const now = clock.now()
  const rows = found
    .filter(matchesName(query.q))
    .filter((row) => query.openNow !== "true" || isOpenNow(row.hours, now))
  const ratings = await reviews.getRatingSummaries(
    db,
    rows.map((row) => row.id)
  )
  const sorted = sortWorkshops(rows, {
    sort: query.sort,
    ratings,
    from: { lat: Number(query.lat), lng: Number(query.lng) },
  })
  return pageOf(sorted, query, (ids) => profiles.getWorkshops(db, ids))
}

/**
 * `GET /mechanics`: also `specialization`, `minYears`, `available=true`;
 * `city` is any city the mechanic serves; sorted by `rating` (default),
 * `experience` or `newest`, with paid plans first in every order.
 */
export async function listMechanics(query: DirectoryQuery) {
  const found = await businesses.listMechanicCandidates(db, {
    city: query.city || undefined,
    verified: query.verified === "true",
    specialization: query.specialization || undefined,
    minYears: Number(query.minYears) || 0,
    available: query.available === "true",
  })
  const rows = found.filter(matchesName(query.q))
  // Independent reads.
  const [ratings, paidOwnerIds] = await Promise.all([
    reviews.getRatingSummaries(
      db,
      rows.map((row) => row.id)
    ),
    plans.listPaidOwnerIds(db),
  ])
  const sorted = sortMechanics(rows, {
    sort: query.sort,
    ratings,
    paidOwnerIds,
  })
  return pageOf(sorted, query, (ids) => profiles.getMechanics(db, ids))
}

/** `GET /dealerships/:slug`: an active dealership; 404 when missing or suspended, `unavailable` when its owner is banned. */
export async function getDealership(slug: string) {
  const found = await businesses.findActiveBySlug(db, {
    kind: "dealership",
    slug,
  })
  if (!found) fail.notFound()
  const inventory = await listings.countInventoryOf(db, [found.ownerUserId])
  const [dealership] = await profiles.getDealerships(db, {
    ids: [found.id],
    inventory,
  })
  if (!dealership) fail.notFound()
  return dealership
}

/** `GET /workshops/:slug`, with the same visibility as a dealership. */
export async function getWorkshop(slug: string) {
  const found = await businesses.findActiveBySlug(db, {
    kind: "workshop",
    slug,
  })
  if (!found) fail.notFound()
  const [workshop] = await profiles.getWorkshops(db, [found.id])
  if (!workshop) fail.notFound()
  return workshop
}

/** `GET /mechanics/:slug`, with the same visibility as a dealership. */
export async function getMechanic(slug: string) {
  const found = await businesses.findActiveBySlug(db, {
    kind: "mechanic",
    slug,
  })
  if (!found) fail.notFound()
  const [mechanic] = await profiles.getMechanics(db, [found.id])
  if (!mechanic) fail.notFound()
  return mechanic
}

// The `q` box matches either language of the name, in lowercase, as the mock's `textOf`.
function matchesName(q: string | undefined) {
  const needle = q?.toLowerCase()
  return (row: { name: Bilingual }) =>
    !needle || `${row.name.ar} ${row.name.en}`.toLowerCase().includes(needle)
}

// Cuts the page out of the sorted rows, then loads only those profiles.
async function pageOf<T extends { id: string }, P>(
  sorted: T[],
  query: DirectoryQuery,
  load: (ids: string[]) => Promise<P[]>
) {
  const { page, pageSize } = pageParams(query, PAGE_SIZE)
  const ids = sorted
    .slice((page - 1) * pageSize, page * pageSize)
    .map((row) => row.id)
  return { items: await load(ids), total: sorted.length, page, pageSize }
}
