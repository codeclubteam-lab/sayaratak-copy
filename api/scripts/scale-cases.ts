import { searchParamsSchema } from "@sayaratak/shared/search/schemas"

import { listForAdmin } from "~/modules/listings/listings.admin.queries"
import type { FacetKey } from "~/modules/listings/listings.filters.queries"
import { listMine } from "~/modules/listings/listings.mine.queries"
import { listRelevanceIds } from "~/modules/listings/listings.relevance.queries"
import { countFacets } from "~/modules/listings/listings.facets.queries"
import * as search from "~/modules/listings/listings.search.queries"
import { scopeOf } from "~/modules/listings/listings.search.service"
import * as messages from "~/modules/messaging/messaging.messages.queries"
import * as threads from "~/modules/messaging/messaging.threads.queries"
import * as notifications from "~/modules/notifications/notifications.queries"
import type { Executor } from "~/shared/db/tx"

type Query = Record<string, string>
type Case = [string, () => Promise<unknown>]

const KHARTOUM = { lat: "15.5", lng: "32.56" }
const BOX = { west: 32.4, south: 15.4, east: 32.7, north: 15.8 }
const page = { offset: 0, size: 24 }
const sale = { kind: "vehicle", intent: "sale" }
const verified = { userIds: [], dealershipOwnerIds: [] }
const admin = { verified, page: { offset: 0, size: 20 } }
const mine = {
  ownerUserId: "u00001",
  now: new Date(),
  needsAttention: false,
  dir: "desc" as const,
  page: { offset: 0, size: 20 },
}

/** The queries 10.6 measures: calls to the app's own query functions, so the SQL is the app's. */
export function buildCases(ex: Executor): Case[] {
  const h = searchHelpers(ex)
  return [
    ...pageCases(h),
    ...relevanceCases(h),
    ...countCases(ex, h),
    ...ownerCases(ex),
    ...inboxCases(ex),
  ]
}

type Helpers = ReturnType<typeof searchHelpers>

function searchHelpers(ex: Executor) {
  // What every search call needs: the parsed filters and the id lists from other modules.
  const find = async (query: Query) => {
    const params = searchParamsSchema.parse(query)
    return { params, scope: await scopeOf(ex, params) }
  }
  return {
    find,
    results: async (query: Query, at = page) =>
      search.listSearchPage(ex, { ...(await find(query)), page: at }),
    relevance: async (query: Query, organicLimit = 24) =>
      listRelevanceIds(ex, { ...(await find(query)), organicLimit }),
  }
}

function pageCases({ find, results }: Helpers): Case[] {
  const filters = { ...sale, type: "car", city: "khartoum", fuel: "petrol" }
  const price = { minPrice: "5000000", maxPrice: "30000000" }
  const deep = { offset: 39 * 24, size: 24 }
  return [
    ["scope (banned, suspended, Featured ids)", () => find({})],
    ["search: filters, newest", () => results({ ...filters, ...price })],
    [
      "search: price ascending, page 40",
      () => results({ ...sale, type: "car", sort: "price_asc" }, deep),
    ],
    [
      "search: q Arabic words",
      () => results({ kind: "vehicle", q: "تويوتا نظيفة", sort: "newest" }),
    ],
    [
      "search: nearest, radius 25 km",
      () =>
        results({
          kind: "vehicle",
          sort: "nearest",
          radius: "25",
          ...KHARTOUM,
        }),
    ],
  ]
}

function relevanceCases({ relevance }: Helpers): Case[] {
  const toyota = { kind: "vehicle", city: "khartoum", make: "toyota" }
  const rare = {
    kind: "vehicle",
    city: "port-sudan",
    make: "mercedes",
    fuel: "electric",
    minYear: "2015",
  }
  return [
    ["search: relevance (the default)", () => relevance(sale)],
    ["search: relevance, city and make", () => relevance(toyota)],
    ["search: relevance, rare filters", () => relevance(rare)],
    [
      "search: relevance, no match",
      () => relevance({ ...toyota, maxPrice: "1000" }),
    ],
    ["search: relevance, page 40", () => relevance(sale, 960)],
    [
      "search: q English words, relevance",
      () => relevance({ kind: "vehicle", q: "toyota corolla" }),
    ],
  ]
}

function countCases(ex: Executor, { find }: Helpers): Case[] {
  const facets = async (query: Query, keys: FacetKey[]) => {
    const f = await find(query)
    return countFacets(ex, { ...f, keys })
  }
  return [
    [
      "facets: five counts, all vehicles",
      () => facets(sale, ["type", "make", "fuel", "transmission", "city"]),
    ],
    ["facets: parts (fits count)", () => facets({ kind: "part" }, ["type"])],
    [
      "map: box over Khartoum",
      async () =>
        search.listInBox(ex, {
          ...(await find({ kind: "vehicle" })),
          box: BOX,
          limit: 200,
        }),
    ],
  ]
}

function ownerCases(ex: Executor): Case[] {
  return [
    ["admin listings: newest", () => listForAdmin(ex, admin)],
    [
      "admin listings: pending, text",
      () => listForAdmin(ex, { ...admin, moderation: "pending", q: "toyota" }),
    ],
    [
      "my listings: owner of 1,074, by views",
      () => listMine(ex, { ...mine, tab: "all", sort: "views" }),
    ],
    [
      "my listings: active tab, text",
      () => listMine(ex, { ...mine, tab: "active", q: "toyota" }),
    ],
  ]
}

function inboxCases(ex: Executor): Case[] {
  const inbox = async () => {
    const ids = (await threads.listOf(ex, "u00001")).map((t) => t.id)
    return Promise.all([
      threads.listParticipants(ex, ids),
      messages.listLast(ex, ids),
      messages.listUnreadCounts(ex, { userId: "u00001", threadIds: ids }),
    ])
  }
  return [
    [
      "notifications: page and total",
      () =>
        notifications.listOf(ex, { userId: "u00005", unreadOnly: false, page }),
    ],
    [
      "notifications: unread count",
      () => notifications.countUnread(ex, "u00005"),
    ],
    ["threads: inbox of a dealership", inbox],
    [
      "messages: one thread",
      () => messages.listOf(ex, { threadId: "t00001", page }),
    ],
  ]
}
