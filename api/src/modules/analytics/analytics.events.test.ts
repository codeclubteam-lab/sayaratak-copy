import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test"
import { and, asc, eq } from "drizzle-orm"

import { db } from "~/shared/db/client"
import { clock } from "~/shared/time/clock"
import { banners, campaigns } from "~/modules/ads/ads.tables"
import { dealerships } from "~/modules/businesses/businesses.tables"
import { listings, listingStats } from "~/modules/listings/listings.tables"

import { req, resetDb } from "../../../tests/helpers"
import { events } from "./analytics.tables"

beforeEach(resetDb)
afterEach(() => spyOn(clock, "now").mockRestore())

const send = (body: object) =>
  req("/events", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  })

const countOf = async (targetId: string, type: string, day?: string) => {
  const rows = await db
    .select({ count: events.count })
    .from(events)
    .where(
      and(
        eq(events.targetId, targetId),
        eq(events.type, type as "view"),
        day ? eq(events.day, day) : undefined
      )
    )
  return rows.reduce((sum, row) => sum + row.count, 0)
}

const firstListing = async () => {
  const [row] = await db.select().from(listings).orderBy(asc(listings.id))
  if (!row) throw new Error("the seed has listings")
  return row.id
}

const statsOf = (id: string) =>
  db
    .select()
    .from(listingStats)
    .where(eq(listingStats.listingId, id))
    .then(([row]) => row)

describe("POST /events", () => {
  test("a view, a call and a WhatsApp tap raise the listing's counters and the day's row", async () => {
    const id = await firstListing()
    const before = await statsOf(id)
    for (const type of ["view", "view", "phone_click", "whatsapp_click"]) {
      const res = await send({ type, targetId: id })
      expect(res.status).toBe(200)
      expect(await res.json()).toEqual({ ok: true })
    }
    const after = await statsOf(id)
    expect(after?.views).toBe((before?.views ?? 0) + 2)
    expect(after?.phoneClicks).toBe((before?.phoneClicks ?? 0) + 1)
    expect(after?.whatsappClicks).toBe((before?.whatsappClicks ?? 0) + 1)
  })

  test("a share is counted in the day's row only", async () => {
    const id = await firstListing()
    const before = await statsOf(id)
    const shares = await countOf(id, "share")
    await send({ type: "share", targetId: id })
    expect(await countOf(id, "share")).toBe(shares + 1)
    expect(await statsOf(id)).toEqual(before)
  })

  test("the first event of a day makes the row and the next ones add to it", async () => {
    const id = await firstListing()
    const day = "2031-05-04"
    spyOn(clock, "now").mockReturnValue(new Date(`${day}T10:00:00Z`))
    expect(await countOf(id, "view", day)).toBe(0)
    await send({ type: "view", targetId: id })
    await send({ type: "view", targetId: id })
    expect(await countOf(id, "view", day)).toBe(2)
  })

  test("the day is the Khartoum day: 22:30 UTC is already tomorrow", async () => {
    const id = await firstListing()
    spyOn(clock, "now").mockReturnValue(new Date("2031-05-04T22:30:00Z"))
    await send({ type: "view", targetId: id })
    expect(await countOf(id, "view", "2031-05-05")).toBe(1)
    expect(await countOf(id, "view", "2031-05-04")).toBe(0)
  })

  test("a business page view is kept for its owner's numbers", async () => {
    const [shop] = await db.select().from(dealerships).limit(1)
    const id = shop?.id ?? ""
    const views = await countOf(id, "view")
    await send({ type: "view", targetId: id })
    expect(await countOf(id, "view")).toBe(views + 1)
  })

  test("banner and campaign views and clicks raise their own counters", async () => {
    const [banner] = await db.select().from(banners).limit(1)
    const [campaign] = await db.select().from(campaigns).limit(1)
    if (!banner || !campaign) throw new Error("the seed has both")
    await send({ type: "banner_view", targetId: banner.id })
    await send({ type: "banner_click", targetId: banner.id })
    await send({ type: "banner_view", targetId: campaign.id })
    await send({ type: "banner_click", targetId: campaign.id })
    const [bannerNow] = await db
      .select()
      .from(banners)
      .where(eq(banners.id, banner.id))
    const [campaignNow] = await db
      .select()
      .from(campaigns)
      .where(eq(campaigns.id, campaign.id))
    expect(bannerNow?.impressions).toBe(banner.impressions + 1)
    expect(bannerNow?.clicks).toBe(banner.clicks + 1)
    expect(campaignNow?.impressions).toBe(campaign.impressions + 1)
    expect(campaignNow?.clicks).toBe(campaign.clicks + 1)
    expect(await countOf(banner.id, "banner_click")).toBe(1)
  })

  test("an id that matches nothing, or the wrong kind of event for it, answers ok and writes nothing", async () => {
    const before = await db.$count(events)
    const listing = await firstListing()
    const [banner] = await db.select().from(banners).limit(1)
    for (const body of [
      { type: "view", targetId: "nope" },
      { type: "banner_click", targetId: "nope" },
      { type: "banner_click", targetId: listing },
      { type: "view", targetId: banner?.id },
    ]) {
      const res = await send(body)
      expect(res.status).toBe(200)
    }
    expect(await db.$count(events)).toBe(before)
  })

  test("an unknown event type or a missing id is a 422", async () => {
    for (const body of [
      { type: "hover", targetId: "x" },
      { type: "view" },
      { type: "view", targetId: "" },
    ]) {
      const res = await send(body)
      expect(res.status).toBe(422)
    }
  })
})
