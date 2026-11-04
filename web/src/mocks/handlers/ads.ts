import { z } from "zod"

import {
  adPageIdSchema,
  adPageSchema,
  adTargetSchema,
  campaignSchema,
  type AdPageId,
} from "@sayaratak/shared/schemas/ads"
import { bannerSchema, type Banner } from "@sayaratak/shared/schemas/admin"
import { campaignInputSchema } from "@sayaratak/shared/schemas/inputs"

import { db, find, insert, newId } from "../db"
import { fail, needRole, needUser, route } from "../http"
import { nowIso } from "../lib"
import { isPublic } from "../search"
import type { CampaignRow, UserRow } from "../types"

const DAY_MS = 24 * 60 * 60 * 1000
const sellers = ["dealership", "workshop", "mechanic"] as const

// A campaign holds its slots from the moment its receipt is sent until it ends; an unpaid one holds nothing.
const holds = (c: CampaignRow) =>
  c.status === "under_review" || c.status === "approved"
const overlaps = (c: CampaignRow, start: string, end: string) =>
  c.startsAt < end && start < c.endsAt

export function freeSlots(
  page: AdPageId,
  start?: string,
  end?: string,
  except?: string
) {
  const row = find(db.adPages, page)
  if (!row) return 0
  if (!start || !end) return row.slots
  const taken = db.campaigns.filter(
    (c) =>
      c.id !== except &&
      holds(c) &&
      c.pages.includes(page) &&
      overlaps(c, start, end)
  ).length
  return Math.max(0, row.slots - taken)
}

const rangeOf = (startDate: string, weeks: number) => {
  const start = new Date(`${startDate}T00:00:00.000Z`).toISOString()
  return {
    start,
    end: new Date(Date.parse(start) + weeks * 7 * DAY_MS).toISOString(),
  }
}

// Every chosen page still needs a free slot for the campaign's dates.
export function assertRoom(
  c: Pick<CampaignRow, "pages" | "startsAt" | "endsAt" | "id">
) {
  const full = c.pages.filter(
    (p) => freeSlots(p, c.startsAt, c.endsAt, c.id) < 1
  )
  if (full.length) throw fail(409, "page_full", undefined, { pages: full })
}

function ownerName(userId: string, lang: "ar" | "en" = "en") {
  const business =
    db.dealerships.find((b) => b.ownerId === userId) ??
    db.workshops.find((b) => b.ownerId === userId) ??
    db.mechanics.find((b) => b.ownerId === userId)
  return business?.name[lang] ?? find(db.users, userId)?.fullName ?? ""
}
export const campaignView = (c: CampaignRow) =>
  campaignSchema.parse({ ...c, ownerName: ownerName(c.ownerId) })

// The advertiser's public profile and live listings.
function targets(user: UserRow) {
  const profiles = [
    ["/dealerships", db.dealerships],
    ["/workshops", db.workshops],
    ["/mechanics", db.mechanics],
  ] as const
  const profile = profiles
    .map(([base, rows]) => ({
      base,
      row: rows.find((b) => b.ownerId === user.id),
    }))
    .find((p) => p.row)
  const listings = db.listings
    .filter((l) => l.ownerUserId === user.id && isPublic(l))
    .slice(0, 50)
    .map((l) => ({
      href: `/listing/${l.slug}`,
      label: { ar: l.title, en: l.title },
    }))
  return [
    ...(profile?.row
      ? [
          {
            href: `${profile.base}/${profile.row.slug}`,
            label: profile.row.name,
          },
        ]
      : []),
    ...listings,
  ]
}

route("GET", "/ad-pages", (c) => {
  needUser(c)
  const startDate = c.query.get("startDate")
  const weeks = Number(c.query.get("weeks") ?? 0)
  const range =
    startDate && weeks >= 1 && weeks <= 4 ? rangeOf(startDate, weeks) : null
  return z
    .array(adPageSchema)
    .parse(
      db.adPages
        .filter((p) => p.enabled)
        .map((p) => ({ ...p, free: freeSlots(p.id, range?.start, range?.end) }))
    )
})

route("GET", "/me/ad-targets", (c) =>
  z.array(adTargetSchema).parse(targets(needRole(c, ...sellers)))
)

route("GET", "/me/campaigns", (c) => {
  const user = needUser(c)
  return z.array(campaignSchema).parse(
    db.campaigns
      .filter((x) => x.ownerId === user.id)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map(campaignView)
  )
})

// Price = the chosen pages' weekly prices x weeks, from the server's table, never the client.
route("POST", "/campaigns", async (c) => {
  const user = needRole(c, ...sellers)
  const input = await c.body(campaignInputSchema)
  if (!targets(user).some((t) => t.href === input.href))
    throw fail(422, "validation", { href: "validation.ad_target" })
  const pages = [...new Set(input.pages)]
  const rows = pages.map((p) => find(db.adPages, p))
  if (rows.some((r) => !r?.enabled)) throw fail(422, "validation")
  const { start, end } = rangeOf(input.startDate, input.weeks)
  if (Date.parse(end) <= Date.now()) throw fail(422, "validation")
  const row: CampaignRow = {
    id: newId("camp"),
    ownerId: user.id,
    creative: input.creative,
    href: input.href,
    pages,
    startsAt: start,
    weeks: input.weeks,
    endsAt: end,
    amount:
      rows.reduce((sum, r) => sum + (r?.weeklyPrice ?? 0), 0) * input.weeks,
    status: "pending_payment",
    impressions: 0,
    clicks: 0,
    createdAt: nowIso(),
  }
  assertRoom(row)
  return campaignView(insert(db.campaigns, row))
})

const placementOf = (page: AdPageId): Banner["placement"] =>
  page === "home_top" || page === "home_middle"
    ? page
    : page === "listing_detail"
      ? "listing_aside"
      : page.startsWith("search_")
        ? "search_top"
        : "directory_top"

// Public: one running campaign of the page, picked at random per request, as a sponsored banner.
route("GET", "/ads", (c) => {
  const page = adPageIdSchema.safeParse(c.query.get("page")).data ?? null
  const now = nowIso()
  const live = db.campaigns.filter(
    (x) =>
      x.status === "approved" &&
      page !== null &&
      x.pages.includes(page) &&
      x.startsAt <= now &&
      now < x.endsAt
  )
  const pick = live[Math.floor(Math.random() * live.length)]
  if (!pick || !page) return []
  const text = (l: "ar" | "en") => ({
    eyebrow: ownerName(pick.ownerId, l),
    ...pick.creative.copy[l],
  })
  return z.array(bannerSchema).parse([
    {
      id: pick.id,
      title: pick.creative.copy.en.heading,
      imageUrl: { ar: pick.creative.imageUrl, en: pick.creative.imageUrl },
      copy: { ar: text("ar"), en: text("en") },
      sponsored: true,
      focus: 50,
      href: pick.href,
      placement: placementOf(page),
      startsAt: pick.startsAt,
      endsAt: pick.endsAt,
      active: true,
      sortOrder: 0,
      impressions: pick.impressions,
      clicks: pick.clicks,
    },
  ])
})
