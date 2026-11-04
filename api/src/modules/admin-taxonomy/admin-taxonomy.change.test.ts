import { beforeEach, describe, expect, test } from "bun:test"
import { eq } from "drizzle-orm"

import { db } from "~/shared/db/client"
import { makes } from "~/modules/taxonomy/taxonomy.tables"

import { adminCaller, errorOf } from "../../../tests/admin"
import { resetDb } from "../../../tests/helpers"
import { auditOf } from "../../../tests/taxonomy"

let call = adminCaller()
beforeEach(async () => {
  await resetDb()
  call = adminCaller()
})

const edit = (type: string, id: string, body: unknown) =>
  call("PATCH", `/admin/taxonomy/${type}/${id}`, body)

describe("PATCH /admin/taxonomy/:type/:id", () => {
  test("changes the fields sent, keeps the rest and the slug, and writes before and after", async () => {
    const res = await edit("cities", "omdurman", {
      name: { ar: "أم درمان!", en: "Omdurman!" },
      slug: "ignored",
    })
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({
      id: "omdurman",
      slug: "omdurman",
      countryId: "sd",
      name: { ar: "أم درمان!", en: "Omdurman!" },
      center: { lat: 15.6445, lng: 32.4777 },
    })
    expect(await auditOf("omdurman")).toMatchObject([
      {
        action: "city.update",
        adminId: "u-admin",
        before: { name: { en: "Omdurman" } },
        after: { name: { en: "Omdurman!" } },
      },
    ])
  })

  test("moves a city's center and takes a make's mark off with null", async () => {
    await call("POST", "/admin/taxonomy/makes", {
      name: { ar: "شيري", en: "Chery" },
      vehicleTypes: ["car"],
      logoUrl: "/api/uploads/x",
    })
    const moved = await edit("cities", "bahri", {
      center: { lat: 15.7, lng: 32.6 },
    })
    expect(await moved.json()).toMatchObject({
      center: { lat: 15.7, lng: 32.6 },
    })
    const cleared = await edit("makes", "chery", { logoUrl: null })
    expect(await cleared.json()).not.toHaveProperty("logoUrl")
    const [row] = await db.select().from(makes).where(eq(makes.id, "chery"))
    expect(row?.logoUrl).toBeNull()
  })

  test("never changes a slug or a country code, and an edit with nothing to change writes nothing", async () => {
    const make = await edit("makes", "toyota", { slug: "t", name: undefined })
    expect(make.status).toBe(200)
    expect(await make.json()).toMatchObject({ id: "toyota", slug: "toyota" })
    const country = await edit("countries", "sd", { code: "xx" })
    expect(await country.json()).toMatchObject({ id: "sd" })
    expect(await auditOf("toyota")).toEqual([])
    expect(await auditOf("sd")).toEqual([])
  })

  test("renames and hides a vehicle type", async () => {
    const res = await edit("vehicle-types", "truck", {
      name: { ar: "شاحنات", en: "Lorries" },
      enabled: false,
    })
    expect(await res.json()).toEqual({
      id: "truck",
      name: { ar: "شاحنات", en: "Lorries" },
      enabled: false,
    })
    expect(await auditOf("truck")).toMatchObject([
      { action: "vehicle_type.update", targetType: "vehicle_type" },
    ])
  })

  test("answers 404 for an unknown entry and 422 for a bad field or a parent that does not exist", async () => {
    expect(
      (await edit("cities", "nope", { name: { ar: "ا", en: "A" } })).status
    ).toBe(404)
    expect((await edit("makes", "toyota", { vehicleTypes: [] })).status).toBe(
      422
    )
    const moved = await edit("districts", "khartoum-riyadh", { cityId: "zz" })
    expect(moved.status).toBe(422)
    expect((await errorOf(moved)).fields).toEqual({
      cityId: "validation.required",
    })
  })

  test("keeps the last vehicle type and the last country on (409 `last_shown`)", async () => {
    const off = (id: string) => edit("countries", id, { enabled: false })
    // Only Sudan is on: it stays on, and turning it off again after another is on works.
    const last = await off("sd")
    expect(last.status).toBe(409)
    expect((await errorOf(last)).code).toBe("last_shown")
    await edit("countries", "eg", { enabled: true })
    expect((await off("sd")).status).toBe(200)
    expect((await off("eg")).status).toBe(409)

    for (const id of ["car", "truck", "motorcycle", "tuk_tuk"])
      expect((await edit("vehicle-types", id, { enabled: false })).status).toBe(
        200
      )
    const lastType = await edit("vehicle-types", "rickshaw", { enabled: false })
    expect(lastType.status).toBe(409)
    expect((await errorOf(lastType)).code).toBe("last_shown")
    expect(await auditOf("rickshaw")).toEqual([])
  })
})
