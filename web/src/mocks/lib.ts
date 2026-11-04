import { z } from "zod"

import type { Bilingual } from "@sayaratak/shared/schemas/fields"
import {
  extraDefaults,
  extraFields,
} from "@sayaratak/shared/schemas/listing-fields"
import type { NotificationPrefs } from "@sayaratak/shared/schemas/api"
import type { Notification } from "@sayaratak/shared/schemas/messaging"
import { db, find, newId, paginate } from "./db"
import { fail, pageParams, type Ctx } from "./http"
import type { Plan, Promotion } from "@sayaratak/shared/schemas/billing"
import { notificationHref } from "./seed/util"
import type { ListingRow, UserRow } from "./types"
import { userSchema } from "@sayaratak/shared/schemas/user"

export const publicUser = (u: UserRow) =>
  userSchema.parse({ ...u, hasPassword: Boolean(u.password) })

// The step 7.9 fields of a listing input: what it sent, the rest empty. Parsing keeps only these keys.
const extrasInput = z.object(extraFields).partial()
export const extrasOf = (input: object) => ({
  ...extraDefaults,
  ...extrasInput.parse(input),
})

// Both languages as one lowercase string, for `q` matching.
export const textOf = (b: Bilingual) => `${b.ar} ${b.en}`.toLowerCase()
export const DAY_MS = 86_400_000
export const nowIso = () => new Date().toISOString()
export const dayKey = (d: Date | number = new Date()) =>
  new Date(d).toISOString().slice(0, 10)

// The switch of the recipient's notification settings that silences each type.
const prefOf: Record<Notification["type"], keyof NotificationPrefs> = {
  message: "messages",
  listing_approved: "updates",
  listing_rejected: "updates",
  listing_expired: "updates",
  verification_result: "updates",
  business_status: "updates",
  saved_search_match: "savedSearchMatches",
  review_new: "reviews",
  payment_approved: "billing",
  payment_rejected: "billing",
  subscription_expiring: "billing",
  broadcast: "announcements",
}

// Both languages are stored, so the recipient sees the right one even after switching. Nothing is written when the recipient turned that kind off.
export function notify(
  userId: string,
  type: Notification["type"],
  title: Bilingual,
  body: Bilingual,
  href?: string
) {
  const user = find(db.users, userId)
  if (!user?.prefs[prefOf[type]]) return
  db.notifications.unshift({
    id: newId("n"),
    userId,
    type,
    title,
    body,
    href: href && notificationHref(user.role, href),
    createdAt: nowIso(),
  })
}

export const businessOf = (user: Pick<UserRow, "id" | "role">) => {
  if (user.role === "dealership")
    return {
      type: "dealership" as const,
      row: db.dealerships.find((d) => d.ownerId === user.id),
    }
  if (user.role === "workshop")
    return {
      type: "workshop" as const,
      row: db.workshops.find((d) => d.ownerId === user.id),
    }
  if (user.role === "mechanic")
    return {
      type: "mechanic" as const,
      row: db.mechanics.find((d) => d.ownerId === user.id),
    }
  return null
}
// A banned owner's business keeps its page (with a notice and no contact, see `unavailable`) but leaves directories, the map and the sitemap.
export const ownerBanned = (ownerId: string) =>
  !!find(db.users, ownerId)?.banned
export const listed = (b: { status: string; ownerId: string }) =>
  b.status === "active" && !ownerBanned(b.ownerId)
export const findBusiness = (id: string) =>
  find(db.dealerships, id) ?? find(db.workshops, id) ?? find(db.mechanics, id)
export const businessType = (id: string) =>
  find(db.dealerships, id)
    ? ("dealership" as const)
    : find(db.workshops, id)
      ? ("workshop" as const)
      : find(db.mechanics, id)
        ? ("mechanic" as const)
        : null

// A listing counts against the owner's limit while it is pending or approved, available or reserved, and not expired.
const live = (l: ListingRow) =>
  (l.moderation === "pending" || l.moderation === "approved") &&
  (l.status === "available" || l.status === "reserved") &&
  Date.parse(l.expiresAt) > Date.now()
export const listingUsage = (userId: string) =>
  db.listings.filter((l) => l.ownerUserId === userId && live(l)).length

// The active subscription, else the pending one.
export const currentSubscription = (userId: string) => {
  const mine = db.subscriptions
    .filter((s) => s.userId === userId)
    .sort((a, b) => b.startsAt.localeCompare(a.startsAt))
  return (
    mine.find((s) => s.status === "active") ??
    mine.find((s) => s.status === "pending")
  )
}

// A7 usage rules. Individuals: no limit while individual subscriptions are off, else their subscription's limit, else the free limit. Dealerships: their subscription's limit. Workshops and mechanics post no listings, so no limit.
export function listingLimit(userId: string) {
  const user = find(db.users, userId)
  if (user?.role === "workshop" || user?.role === "mechanic") return null
  const sub = db.subscriptions.find(
    (s) => s.userId === userId && s.status === "active"
  )
  if (user?.role === "dealership") return sub?.usage.limit ?? null
  if (!db.settings.individualSubscriptionsEnabled) return null
  return sub ? sub.usage.limit : db.settings.freeListingLimit
}

// A9: an audience's free plan is its first plan (by order) priced 0. Onboarding starts a business on it and billing shows it when there is no subscription.
export const freePlanOf = (audience: Plan["audience"]) =>
  db.plans
    .filter((p) => p.audience === audience)
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .find((p) => p.price === 0)

// The setting "Free listings per user" is the individuals' free plan limit; the plan only shows it.
export function syncFreeLimit() {
  const free = freePlanOf("user")
  if (free) free.listingLimit = db.settings.freeListingLimit
}

// The plan of the active subscription, if any.
export const activePlan = (userId: string) =>
  find(
    db.plans,
    db.subscriptions.find((s) => s.userId === userId && s.status === "active")
      ?.planId ?? ""
  )

// A stable reference per payer and item, so the checkout shows the same code the payment keeps.
export const paymentReference = (userId: string, itemId: string) => {
  let hash = 0
  for (const ch of `${userId}:${itemId}`)
    hash = (hash * 31 + ch.charCodeAt(0)) % 900_000
  return `SY-${100_000 + hash}`
}

export const promotionPrice = (p: Pick<Promotion, "type" | "durationDays">) =>
  db.promotionPrices.find(
    (x) => x.type === p.type && x.durationDays === p.durationDays
  )

// A promotion with the listing and payment details of `myPromotionSchema`. An active one whose end has passed reads as ended.
export function promotionView(p: Promotion) {
  const listing = listingById(p.listingId)
  const cover = listing.media[0]
  const payment = db.payments
    .filter((x) => x.itemType === "promotion" && x.itemId === p.id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]
  const over = p.status === "active" && Date.parse(p.endsAt ?? "") < Date.now()
  return {
    ...p,
    status: over ? ("ended" as const) : p.status,
    listing: {
      id: listing.id,
      slug: listing.slug,
      title: listing.title,
      coverUrl:
        (cover?.type === "video" ? cover.posterUrl : cover?.url) ?? null,
    },
    price: p.source === "paid" ? (promotionPrice(p)?.price ?? 0) : 0,
    paymentStatus: payment?.status ?? ("none" as const),
  }
}

// Starts the clock: from now for the promotion's days, and the listing carries it while it runs. A bump is done at once: the listing goes back to the top of the newest.
export function activatePromotion(p: Promotion) {
  const listing = listingById(p.listingId)
  p.startsAt = nowIso()
  if (p.type === "bump") {
    p.status = "ended"
    p.endsAt = p.startsAt
    listing.bumpedAt = p.startsAt
    return
  }
  p.status = "active"
  p.endsAt = new Date(Date.now() + p.durationDays * DAY_MS).toISOString()
  listing.promotions.push({
    type: p.type,
    startsAt: p.startsAt,
    endsAt: p.endsAt,
  })
}

export function canEditListing(user: UserRow, listing: ListingRow) {
  if (user.role !== "admin" && listing.ownerUserId !== user.id)
    throw fail(403, "forbidden")
}
export function listingById(id: string) {
  const row = find(db.listings, id)
  if (!row) throw fail(404, "not_found")
  return row
}

// Generic paged list for tables: newest first (the caller sorts), optional `q` over a text projection.
export function listPage<T>(
  c: Ctx,
  rows: T[],
  text?: (r: T) => string,
  size = 20
) {
  const q = c.query.get("q")?.trim().toLowerCase()
  const kept =
    q && text ? rows.filter((r) => text(r).toLowerCase().includes(q)) : rows
  const { page, pageSize } = pageParams(c.query, size)
  return paginate(kept, page, pageSize)
}
export const byNewest = <T extends { createdAt: string }>(a: T, b: T) =>
  b.createdAt.localeCompare(a.createdAt)

export const rangeDays = (query: URLSearchParams) => {
  const r = query.get("range")
  return r === "7d" ? 7 : r === "90d" ? 90 : 30
}
// Daily sums of the event table for some targets, oldest first, with empty days filled in.
export function eventSeries(
  match: (targetId: string) => boolean,
  days: number
) {
  const byDay = new Map<
    string,
    {
      views: number
      phoneClicks: number
      whatsappClicks: number
      shares: number
    }
  >()
  for (const e of db.events) {
    if (!match(e.targetId)) continue
    const cur = byDay.get(e.day) ?? {
      views: 0,
      phoneClicks: 0,
      whatsappClicks: 0,
      shares: 0,
    }
    cur.views += e.counts.view
    cur.phoneClicks += e.counts.phone_click
    cur.whatsappClicks += e.counts.whatsapp_click
    cur.shares += e.counts.share
    byDay.set(e.day, cur)
  }
  return Array.from({ length: days }, (_, i) => {
    const day = dayKey(Date.now() - (days - 1 - i) * DAY_MS)
    return {
      day,
      ...(byDay.get(day) ?? {
        views: 0,
        phoneClicks: 0,
        whatsappClicks: 0,
        shares: 0,
      }),
    }
  })
}
