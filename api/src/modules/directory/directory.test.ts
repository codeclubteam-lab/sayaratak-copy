import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test"
import { pageOf } from "@sayaratak/shared/schemas/fields"
import {
  dealershipSchema,
  mechanicSchema,
  workshopSchema,
} from "@sayaratak/shared/schemas/profile"
import { eq } from "drizzle-orm"

import { db } from "~/shared/db/client"
import { clock } from "~/shared/time/clock"
import { user } from "~/modules/auth/auth.tables"
import {
  dealerships,
  mechanics,
  workshops,
} from "~/modules/businesses/businesses.tables"

import { expectSchema, req, resetDb } from "../../../tests/helpers"

beforeEach(resetDb)
afterEach(() => spyOn(clock, "now").mockRestore())

const get = (path: string) => req(path)
const slugs = async (path: string) => {
  const page = (await (await get(path)).json()) as {
    items: { slug: string }[]
  }
  return page.items.map((item) => item.slug)
}

describe("the lists and details are public and match the shared schemas", () => {
  test("answers every kind signed out, with the Page envelope", async () => {
    const dealers = await expectSchema(
      await get("/dealerships"),
      pageOf(dealershipSchema)
    )
    const shops = await expectSchema(
      await get("/workshops"),
      pageOf(workshopSchema)
    )
    const people = await expectSchema(
      await get("/mechanics"),
      pageOf(mechanicSchema)
    )
    expect([dealers.page, dealers.pageSize]).toEqual([1, 12])
    expect(dealers.total).toBe(dealers.items.length)
    expect(shops.items.length).toBeGreaterThan(0)
    expect(people.items.length).toBeGreaterThan(0)
    const first = dealers.items[0]
    const detail = await expectSchema(
      await get(`/dealerships/${first?.slug}`),
      dealershipSchema
    )
    expect(detail.id).toBe(first?.id ?? "")
    expect(detail.slug).toBe(first?.slug ?? "")
  })

  test("returns 404 not_found for an unknown slug and for a slug of another kind", async () => {
    const [dealer] = await db.select().from(dealerships).limit(1)
    for (const path of [
      "/dealerships/nope",
      "/workshops/nope",
      "/mechanics/nope",
      `/workshops/${dealer?.slug}`,
    ]) {
      const res = await get(path)
      expect(res.status).toBe(404)
      expect(await res.json()).toMatchObject({ code: "not_found" })
    }
  })
})

describe("who is listed", () => {
  test("hides a suspended business from the list and its page", async () => {
    const [shop] = await db.select().from(workshops).limit(1)
    expect(await slugs("/workshops?pageSize=100")).toContain(shop?.slug ?? "")
    await db
      .update(workshops)
      .set({ status: "suspended", suspendedReason: "Fake photos" })
      .where(eq(workshops.id, shop?.id ?? ""))
    expect(await slugs("/workshops?pageSize=100")).not.toContain(
      shop?.slug ?? ""
    )
    expect((await get(`/workshops/${shop?.slug}`)).status).toBe(404)
  })

  test("takes a banned owner's business out of the list but opens its page flagged", async () => {
    const [shop] = await db.select().from(workshops).limit(1)
    await db
      .update(user)
      .set({ banned: true })
      .where(eq(user.id, shop?.ownerUserId ?? ""))
    expect(await slugs("/workshops?pageSize=100")).not.toContain(
      shop?.slug ?? ""
    )
    const page = await expectSchema(
      await get(`/workshops/${shop?.slug}`),
      workshopSchema
    )
    expect(page.unavailable).toBe(true)
    // No contact leaves the server for a banned owner.
    expect(page).toMatchObject({ phone: "", whatsapp: null })
    expect(JSON.stringify(page)).not.toContain(shop?.phone ?? "")
  })

  test("sends no phone or WhatsApp number of a banned dealership or mechanic", async () => {
    const [dealer] = await db.select().from(dealerships).limit(1)
    const [person] = await db.select().from(mechanics).limit(1)
    for (const owner of [dealer?.ownerUserId, person?.ownerUserId])
      await db
        .update(user)
        .set({ banned: true })
        .where(eq(user.id, owner ?? ""))
    const d = await expectSchema(
      await get(`/dealerships/${dealer?.slug}`),
      dealershipSchema
    )
    expect(d).toMatchObject({ unavailable: true, phones: [], whatsapp: null })
    const m = await expectSchema(
      await get(`/mechanics/${person?.slug}`),
      mechanicSchema
    )
    expect(m).toMatchObject({ unavailable: true, phone: "", whatsapp: null })
    for (const number of [...(dealer?.phones ?? []), person?.phone ?? ""])
      expect(JSON.stringify([d, m])).not.toContain(number)
  })

  test("keeps the contact of an owner who is not banned", async () => {
    const [shop] = await db.select().from(workshops).limit(1)
    const page = await expectSchema(
      await get(`/workshops/${shop?.slug}`),
      workshopSchema
    )
    expect(page.phone).toBe(shop?.phone ?? "")
    expect(page.unavailable).toBeUndefined()
  })

  test("lists the business again once a timed ban has ended", async () => {
    const [person] = await db.select().from(mechanics).limit(1)
    const now = new Date("2026-11-01T10:00:00Z")
    spyOn(clock, "now").mockReturnValue(now)
    const until = (ms: number) => new Date(now.getTime() + ms)
    const ban = (banExpires: Date) =>
      db
        .update(user)
        .set({ banned: true, banExpires })
        .where(eq(user.id, person?.ownerUserId ?? ""))
    await ban(until(60_000))
    expect(await slugs("/mechanics?pageSize=100")).not.toContain(
      person?.slug ?? ""
    )
    await ban(until(-60_000))
    expect(await slugs("/mechanics?pageSize=100")).toContain(person?.slug ?? "")
    const page = await expectSchema(
      await get(`/mechanics/${person?.slug}`),
      mechanicSchema
    )
    expect(page.unavailable).toBeUndefined()
  })

  test("filters by the name in either language, ignoring case", async () => {
    const [first] = await db.select().from(dealerships).limit(1)
    const word = first?.name.en.split(" ")[0] ?? ""
    const found = await slugs(`/dealerships?q=${word.toUpperCase()}`)
    expect(found).toContain(first?.slug ?? "")
    const arabic = await slugs(`/dealerships?q=${first?.name.ar.slice(0, 3)}`)
    expect(arabic).toContain(first?.slug ?? "")
    expect(await slugs("/dealerships?q=zzzz-nothing")).toEqual([])
  })
})
