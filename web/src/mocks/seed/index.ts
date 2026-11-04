import { faker } from "@faker-js/faker"

import type { Db } from "../types"
import {
  seedNotifications,
  applyRatings,
  seedReviews,
  seedSaved,
  seedThreads,
} from "./activity"
import {
  plans,
  promotionPrices,
  seedPayments,
  seedSubscriptions,
} from "./commerce"
import { adPages, campaigns } from "./ads"
import { seedListings } from "./listings"
import { seedPeople } from "./people"
import {
  backups,
  banners,
  pages,
  seedEvents,
  seedReports,
  seedVerifications,
  settings,
} from "./site"
import { seedReceipts } from "./receipts"
import { countries, seedTaxonomy } from "./taxonomy"
import { clock } from "./util"

const demoIds = ["u-omar", "u-dealer", "u-workshop", "u-mechanic", "u-admin"]

// `empty` keeps taxonomy, plans, settings, pages and the demo accounts (with their business profiles) and nothing else.
export function buildSeed({ empty = false }: { empty?: boolean } = {}): Db {
  faker.seed(20260)
  clock.now = Date.now()
  const { taxonomy, catalog } = seedTaxonomy()
  const { users, dealerships, workshops, mechanics } = seedPeople(
    taxonomy,
    empty
  )
  const businesses = [
    ...dealerships.map((b) => ({
      id: b.id,
      ownerId: b.ownerId,
      name: b.name,
      type: "dealership" as const,
      photo: b.logoUrl,
      verified: b.verified,
    })),
    ...workshops.map((b) => ({
      id: b.id,
      ownerId: b.ownerId,
      name: b.name,
      type: "workshop" as const,
      photo: b.logoUrl,
      verified: b.verified,
    })),
    ...mechanics.map((b) => ({
      id: b.id,
      ownerId: b.ownerId,
      name: b.name,
      type: "mechanic" as const,
      photo: b.photoUrl,
      verified: b.verified,
    })),
  ]
  const { listings, promotions } = empty
    ? { listings: [], promotions: [] }
    : seedListings({ taxonomy, catalog, users, dealerships })
  const reviews = empty ? [] : seedReviews(users, businesses)
  applyRatings(reviews, [...dealerships, ...workshops, ...mechanics])
  const { threads, messages } = empty
    ? { threads: [], messages: [] }
    : seedThreads(users, listings, businesses)
  const { favorites, savedSearches } = empty
    ? { favorites: [], savedSearches: [] }
    : seedSaved(users, listings)
  const payments = empty ? [] : seedPayments(users, listings, promotions)
  const owned = new Set(
    listings
      .filter((l) => l.ownerUserId === "u-omar" || l.ownerUserId === "u-dealer")
      .map((l) => l.id)
  )
  return {
    taxonomy,
    countries: structuredClone(countries),
    users,
    listings,
    dealerships,
    workshops,
    mechanics,
    reviews,
    favorites,
    savedSearches,
    threads,
    messages,
    notifications: empty
      ? []
      : seedNotifications(users.filter((u) => demoIds.includes(u.id))),
    plans: structuredClone(plans),
    subscriptions: seedSubscriptions(),
    payments,
    promotions,
    promotionPrices: structuredClone(promotionPrices),
    reports: empty ? [] : seedReports(listings, users),
    verifications: empty
      ? []
      : seedVerifications(
          businesses.filter(
            (b) => b.id !== "d-1" && b.id !== "w-1" && b.id !== "m-1"
          )
        ),
    banners: empty ? [] : banners(),
    adPages: adPages(),
    campaigns: empty
      ? []
      : campaigns({
          dealer: dealerships.find((d) => d.ownerId === "u-dealer")?.slug ?? "",
          workshop:
            workshops.find((w) => w.ownerId === "u-workshop")?.slug ?? "",
        }),
    pages: pages(),
    backups: empty ? [] : backups(),
    settings: structuredClone(settings),
    drafts: [],
    events: empty
      ? []
      : seedEvents([
          ...new Set([
            ...owned,
            "d-1",
            "w-1",
            "m-1",
            ...listings.slice(0, 40).map((l) => l.id),
          ]),
        ]),
    contacts: [],
    broadcasts: [],
    uploads: seedReceipts(payments, settings.bankakAccount.name),
    attempts: new Map(),
    codes: new Map(),
    resetTokens: new Map(),
  }
}
