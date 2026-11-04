import { okSchema } from "@sayaratak/shared/schemas/api"
import { analyticsSchema } from "@sayaratak/shared/schemas/responses"
import { eventInputSchema } from "@sayaratak/shared/schemas/inputs"

import { db, find, insert } from "../db"
import { needUser, route } from "../http"
import { DAY_MS, businessOf, dayKey, eventSeries, rangeDays } from "../lib"

const stat = {
  view: "views",
  phone_click: "phoneClicks",
  whatsapp_click: "whatsappClicks",
} as const

route("POST", "/events", async (c) => {
  const { type, targetId } = await c.body(eventInputSchema)
  const listing = find(db.listings, targetId)
  const key =
    type === "view" || type === "phone_click" || type === "whatsapp_click"
      ? stat[type]
      : null
  if (listing && key) listing.stats[key] += 1
  const banner = find(db.banners, targetId)
  if (banner && type === "banner_click") banner.clicks += 1
  if (banner && type === "banner_view") banner.impressions += 1
  const campaign = find(db.campaigns, targetId)
  if (campaign && type === "banner_click") campaign.clicks += 1
  if (campaign && type === "banner_view") campaign.impressions += 1
  const day = dayKey()
  const id = `ev-${targetId}-${day}`
  const row =
    find(db.events, id) ??
    insert(db.events, {
      id,
      day,
      targetId,
      counts: {
        view: 0,
        phone_click: 0,
        whatsapp_click: 0,
        share: 0,
        banner_click: 0,
        banner_view: 0,
      },
    })
  row.counts[type] += 1
  return okSchema.parse({ ok: true })
})

const sum = (rows: { [k: string]: number }[], key: string) =>
  rows.reduce((total, row) => total + (row[key] ?? 0), 0)

// Role scoped: sellers see their listings, business owners their profile, admins everything. `previous` is the period of the same length just before, for the change on each stat card.
route("GET", "/me/analytics", (c) => {
  const user = needUser(c)
  const days = rangeDays(c.query)
  const all = user.role === "admin"
  const listings = all
    ? db.listings
    : db.listings.filter((l) => l.ownerUserId === user.id)
  const ids = new Set(listings.map((l) => l.id))
  const biz = businessOf(user)
  if (biz?.row) ids.add(biz.row.id)
  const mine = (id: string) => all || ids.has(id)
  const threads = new Set(
    db.threads
      .filter((t) => all || t.participantIds.includes(user.id))
      .map((t) => t.id)
  )
  const since = (n: number) => Date.now() - n * DAY_MS
  // Whole days, the way the daily series counts them: a window of `n` days is today and the `n - 1` days before, so totals and chart add up. `from` and `to` count days back (0 is today) and both ends are included.
  const span = (from: number, to: number) => ({
    first: dayKey(since(from - 1)),
    last: dayKey(since(to)),
  })
  const within = (iso: string, from: number, to: number) => {
    const { first, last } = span(from, to)
    const day = dayKey(Date.parse(iso))
    return day >= first && day <= last
  }
  const targets = new Set(biz?.row ? [biz.row.id] : [])
  const period = (from: number, to: number) => ({
    messages: db.messages.filter(
      (m) =>
        threads.has(m.threadId) &&
        (all || m.senderId !== user.id) &&
        within(m.createdAt, from, to)
    ).length,
    favorites: db.favorites.filter(
      (f) => mine(f.listingId) && within(f.createdAt, from, to)
    ).length,
    newReviews: db.reviews.filter(
      (r) => (all || targets.has(r.targetId)) && within(r.createdAt, from, to)
    ).length,
  })
  // Event rows are per target and day; the window covers the days from `from` back to `to` back, both included.
  const events = (from: number, to: number) => {
    const { first, last } = span(from, to)
    return db.events.filter(
      (e) => mine(e.targetId) && e.day >= first && e.day <= last
    )
  }
  const totals = (from: number, to: number) => {
    const rows = events(from, to)
    const count = (key: "view" | "phone_click" | "whatsapp_click") =>
      rows.reduce((total, e) => total + e.counts[key], 0)
    return {
      views: count("view"),
      calls: count("phone_click"),
      whatsapp: count("whatsapp_click"),
      ...period(from, to),
    }
  }
  const daily = eventSeries(mine, days).map((d) => ({
    date: d.day,
    views: d.views,
    calls: d.phoneClicks,
    whatsapp: d.whatsappClicks,
    messages: db.messages.filter(
      (m) =>
        threads.has(m.threadId) &&
        (all || m.senderId !== user.id) &&
        dayKey(Date.parse(m.createdAt)) === d.day
    ).length,
  }))
  const topListings =
    user.role === "dealership"
      ? listings
          .map((l) => {
            const rows = events(days, 0).filter((e) => e.targetId === l.id)
            const views = sum(
              rows.map((e) => ({ v: e.counts.view })),
              "v"
            )
            const contacts = sum(
              rows.map((e) => ({
                v: e.counts.phone_click + e.counts.whatsapp_click,
              })),
              "v"
            )
            const cover = l.media[0]
            return {
              id: l.id,
              slug: l.slug,
              title: l.title,
              coverUrl:
                (cover?.type === "video" ? cover.posterUrl : cover?.url) ??
                null,
              views,
              contacts,
            }
          })
          .sort((a, b) => b.views - a.views)
          .slice(0, 10)
      : []
  return analyticsSchema.parse({
    range: `${days}d`,
    totals: totals(days, 0),
    previous: totals(days * 2, days),
    daily,
    topListings,
  })
})
