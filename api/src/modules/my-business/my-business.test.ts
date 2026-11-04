import { beforeEach, describe, expect, test } from "bun:test"
import {
  dealershipSchema,
  mechanicSchema,
  workshopSchema,
} from "@sayaratak/shared/schemas/profile"
import { eq } from "drizzle-orm"

import { db } from "~/shared/db/client"
import { user } from "~/modules/auth/auth.tables"
import { dealerships } from "~/modules/businesses/businesses.tables"

import { mineOf, patchBusiness, read } from "../../../tests/business"
import { expectSchema, req, resetDb, signIn } from "../../../tests/helpers"

beforeEach(resetDb)

describe("GET /me/business", () => {
  test("answers each role its own profile in the shared schema", async () => {
    const dealer = await read(await signIn("dealership"), "/me/business")
    expect(dealer.status).toBe(200)
    await expectSchema(dealer, dealershipSchema)
    const shop = await read(await signIn("workshop"), "/me/business")
    await expectSchema(shop, workshopSchema)
    const person = await read(await signIn("mechanic"), "/me/business")
    await expectSchema(person, mechanicSchema)
  })

  test("returns 401 signed out, 403 forbidden for a private seller and 403 banned", async () => {
    expect((await req("/me/business")).status).toBe(401)
    const omar = await signIn("user")
    const refused = await read(omar, "/me/business")
    expect(refused.status).toBe(403)
    expect(await refused.json()).toMatchObject({ code: "forbidden" })
    const dealer = await signIn("dealership")
    await db.update(user).set({ banned: true }).where(eq(user.id, "u-dealer"))
    const banned = await read(dealer, "/me/business")
    expect(banned.status).toBe(403)
    expect(await banned.json()).toMatchObject({ code: "banned" })
  })

  test("returns 404 not_found for a business role with no profile", async () => {
    const visitor = await signIn("new")
    await db.update(user).set({ role: "workshop" }).where(eq(user.id, "u-new"))
    const res = await read(visitor, "/me/business")
    expect(res.status).toBe(404)
    expect(await res.json()).toMatchObject({ code: "not_found" })
  })

  test("still shows a suspended business to its owner", async () => {
    const dealer = await signIn("dealership")
    await db
      .update(dealerships)
      .set({ status: "suspended", suspendedReason: "Check your papers" })
      .where(eq(dealerships.ownerUserId, "u-dealer"))
    const res = await read(dealer, "/me/business")
    expect(await res.json()).toMatchObject({
      status: "suspended",
      suspendedReason: "Check your papers",
    })
  })
})

describe("PATCH /me/business text and contact", () => {
  test("stores a name typed once in both languages and keeps two slots as sent", async () => {
    const dealer = await signIn("dealership")
    const one = await patchBusiness(dealer, { name: "Al Nour" })
    expect(one.status).toBe(200)
    const saved = await expectSchema(one, dealershipSchema)
    expect(saved.name).toEqual({ ar: "Al Nour", en: "Al Nour" })
    const two = await patchBusiness(dealer, {
      name: { ar: "النور", en: "Al Nour" },
      description: { ar: "وصف", en: "About us" },
    })
    expect(await expectSchema(two, dealershipSchema)).toMatchObject({
      name: { ar: "النور", en: "Al Nour" },
      description: { ar: "وصف", en: "About us" },
    })
  })

  test("saves a dealership's phones, WhatsApp, hours and pin one section at a time", async () => {
    const dealer = await signIn("dealership")
    const before = await mineOf(dealer)
    const res = await patchBusiness(dealer, {
      phones: ["+249912345678", "+249911111111"],
      whatsapp: "+249912345678",
    })
    const saved = await expectSchema(res, dealershipSchema)
    expect(saved).toMatchObject({
      phones: ["+249912345678", "+249911111111"],
      whatsapp: "+249912345678",
      name: before.name,
      address: before.address,
    })
    const cleared = await patchBusiness(dealer, {
      whatsapp: null,
      location: null,
    })
    expect(await cleared.json()).toMatchObject({
      whatsapp: null,
      location: null,
    })
    const hours = saved.hours.map((day) => ({ ...day, closed: day.day === 5 }))
    const timed = await patchBusiness(dealer, { hours })
    expect((await expectSchema(timed, dealershipSchema)).hours).toEqual(hours)
  })

  test("saves a workshop's single phone and a mechanic's availability and years", async () => {
    const shop = await signIn("workshop")
    const phone = await patchBusiness(shop, { phone: "+249900000001" })
    expect(await phone.json()).toMatchObject({ phone: "+249900000001" })
    const person = await signIn("mechanic")
    const res = await patchBusiness(person, {
      available: false,
      yearsOfExperience: 12,
      bio: "Twelve years on Toyota engines.",
    })
    expect(await expectSchema(res, mechanicSchema)).toMatchObject({
      available: false,
      yearsOfExperience: 12,
      bio: {
        ar: "Twelve years on Toyota engines.",
        en: "Twelve years on Toyota engines.",
      },
    })
  })

  test("ignores fields the owner may not set, and the other kind's fields", async () => {
    const dealer = await signIn("dealership")
    const before = await mineOf(dealer)
    const res = await patchBusiness(dealer, {
      verified: true,
      status: "suspended",
      slug: "mine-now",
      ownerId: "u-admin",
      rating: { avg: 5, count: 99, distribution: [0, 0, 0, 0, 99] },
      phone: "+249900000009",
      available: false,
    })
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({
      verified: before.verified,
      status: before.status,
      slug: before.slug,
      ownerId: before.ownerId,
      rating: before.rating,
    })
    const [row] = await db
      .select()
      .from(dealerships)
      .where(eq(dealerships.ownerUserId, "u-dealer"))
    expect(row?.slug).toBe(before.slug as string)
  })
})
