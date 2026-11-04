import { beforeEach, describe, expect, test } from "bun:test"
import { mechanicSchema } from "@sayaratak/shared/schemas/profile"
import { eq } from "drizzle-orm"

import { db } from "~/shared/db/client"
import { user } from "~/modules/auth/auth.tables"
import {
  mechanicCities,
  mechanics,
  workshops,
} from "~/modules/businesses/businesses.tables"

import { mineOf, patchBusiness } from "../../../tests/business"
import { expectSchema, req, resetDb, signIn } from "../../../tests/helpers"

beforeEach(resetDb)

describe("PATCH /me/business access and errors", () => {
  test("returns 401 signed out, 403 for a private seller and 403 banned", async () => {
    const out = await req("/me/business", {
      method: "PATCH",
      headers: {
        origin: "http://localhost:3000",
        "content-type": "application/json",
      },
      body: "{}",
    })
    expect(out.status).toBe(401)
    expect((await patchBusiness(await signIn("user"), {})).status).toBe(403)
    const shop = await signIn("workshop")
    await db.update(user).set({ banned: true }).where(eq(user.id, "u-workshop"))
    const banned = await patchBusiness(shop, { phone: "+249900000001" })
    expect(await banned.json()).toMatchObject({ code: "banned" })
  })

  test("returns 422 with field keys for a wrong value and changes nothing", async () => {
    const dealer = await signIn("dealership")
    const before = await mineOf(dealer)
    const res = await patchBusiness(dealer, {
      name: "x".repeat(81),
      phones: ["12"],
      cityId: "nowhere",
    })
    expect(res.status).toBe(422)
    const body = (await res.json()) as { code: string; fields: object }
    expect(body.code).toBe("validation")
    expect(body.fields).toMatchObject({
      name: "validation.too_long",
      "phones.0": "validation.phone",
    })
    expect(await mineOf(dealer)).toEqual(before)
    const noPhones = await patchBusiness(dealer, { phones: [] })
    expect(await noPhones.json()).toMatchObject({
      fields: { phones: "validation.phone_min" },
    })
  })

  test("returns 422 for an unknown city and for a district of another city", async () => {
    const dealer = await signIn("dealership")
    const city = await patchBusiness(dealer, { cityId: "nowhere" })
    expect(await city.json()).toMatchObject({
      fields: { cityId: "validation.required" },
    })
    const district = await patchBusiness(dealer, {
      cityId: "khartoum",
      districtId: "omdurman-center",
    })
    expect(district.status).toBe(422)
    expect(await district.json()).toMatchObject({
      fields: { districtId: "validation.required" },
    })
  })
})

describe("PATCH /me/business for a mechanic's lists", () => {
  test("keeps served cities and skills in the order sent and drops unknown ids", async () => {
    const person = await signIn("mechanic")
    const res = await patchBusiness(person, {
      cityId: "omdurman",
      servedCityIds: ["omdurman", "nowhere", "khartoum", "omdurman"],
      specializationIds: ["engine", "not-a-skill"],
    })
    expect(res.status).toBe(200)
    const saved = await expectSchema(res, mechanicSchema)
    expect(saved.servedCityIds).toEqual(["omdurman", "khartoum"])
    expect(saved.cityId).toBe("omdurman")
    expect(saved.specializationIds).not.toContain("not-a-skill")
    const rows = await db
      .select()
      .from(mechanicCities)
      .where(eq(mechanicCities.mechanicId, saved.id))
    expect(rows).toHaveLength(2)
  })

  test("two saves at once leave one coherent list", async () => {
    const person = await signIn("mechanic")
    const [a, b] = await Promise.all([
      patchBusiness(person, { servedCityIds: ["khartoum", "omdurman"] }),
      patchBusiness(person, { servedCityIds: ["omdurman", "khartoum"] }),
    ])
    expect([a.status, b.status]).toEqual([200, 200])
    const [row] = await db.select().from(mechanics)
    expect(row).toBeDefined()
    const rows = await db.select().from(mechanicCities)
    const own = rows.filter((r) => r.mechanicId === (row?.id ?? ""))
    expect(new Set(rows.map((r) => `${r.mechanicId}:${r.cityId}`)).size).toBe(
      rows.length
    )
    expect(own.length).toBeGreaterThan(0)
  })

  test("a workshop keeps its own row after a profile save", async () => {
    const shop = await signIn("workshop")
    await patchBusiness(shop, { address: "Street 7" })
    const [row] = await db
      .select()
      .from(workshops)
      .where(eq(workshops.ownerUserId, "u-workshop"))
    expect(row?.address).toBe("Street 7")
  })
})
