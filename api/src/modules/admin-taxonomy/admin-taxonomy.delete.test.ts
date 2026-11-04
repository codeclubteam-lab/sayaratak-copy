import { beforeEach, describe, expect, test } from "bun:test"
import { eq, isNotNull } from "drizzle-orm"

import { db } from "~/shared/db/client"
import { user } from "~/modules/auth/auth.tables"
import {
  dealerships,
  mechanicCities,
  mechanics,
  workshops,
} from "~/modules/businesses/businesses.tables"
import { listings } from "~/modules/listings/listings.tables"
import { cities, districts } from "~/modules/taxonomy/taxonomy.tables"

import { adminCaller, errorOf } from "../../../tests/admin"
import { resetDb } from "../../../tests/helpers"
import { auditOf, dongola } from "../../../tests/taxonomy"

let call = adminCaller()
beforeEach(async () => {
  await resetDb()
  call = adminCaller()
})

const remove = (type: string, id: string) =>
  call("DELETE", `/admin/taxonomy/${type}/${id}`)
const expectInUse = async (type: string, id: string) => {
  const res = await remove(type, id)
  expect(res.status).toBe(409)
  expect((await errorOf(res)).code).toBe("in_use")
  // An entry made in the test has its create row; a refused delete adds none.
  expect(
    (await auditOf(id)).filter((row) => row.action.endsWith(".delete"))
  ).toEqual([])
}
const usedBy = async (column: "districtId" | "modelId" | "partCategoryId") => {
  const [row] = await db
    .select({ id: listings[column] })
    .from(listings)
    .where(isNotNull(listings[column]))
    .limit(1)
  return row?.id ?? ""
}
const newCity = async () => {
  const res = await call("POST", "/admin/taxonomy/cities", dongola)
  return ((await res.json()) as { id: string }).id
}

describe("DELETE /admin/taxonomy/:type/:id", () => {
  test("deletes an entry nothing uses and writes the audit row", async () => {
    const id = await newCity()
    expect((await remove("cities", id)).status).toBe(200)
    expect(await db.select().from(cities).where(eq(cities.id, id))).toEqual([])
    expect(await auditOf(id)).toMatchObject([
      { action: "city.create" },
      { action: "city.delete", targetType: "city", before: { id } },
    ])
    // A country with no cities, a district and a model no listing names.
    for (const [type, entry] of [
      ["countries", "eg"],
      ["districts", "nyala-market"],
      ["models", "ford-ranger"],
    ] as const)
      expect((await remove(type, entry)).status).toBe(200)
  })

  test("refuses an entry a listing, a child or a country's city still names (409 `in_use`)", async () => {
    await expectInUse("cities", "khartoum")
    await expectInUse("makes", "toyota")
    await expectInUse("countries", "sd")
    await expectInUse("districts", await usedBy("districtId"))
    await expectInUse("models", await usedBy("modelId"))
    await expectInUse("part-categories", await usedBy("partCategoryId"))
  })

  test("refuses a city only an account, a dealership, a workshop or a mechanic's service area names", async () => {
    const [dealer] = await db.select().from(dealerships).limit(1)
    const [workshop] = await db.select().from(workshops).limit(1)
    const [mechanic] = await db.select().from(mechanics).limit(1)
    const [person] = await db.select().from(user).limit(1)
    if (!(dealer && workshop && mechanic && person)) throw new Error("seed")
    const pins = [
      (cityId: string) =>
        db.update(user).set({ cityId }).where(eq(user.id, person.id)),
      (cityId: string) =>
        db
          .update(dealerships)
          .set({ cityId })
          .where(eq(dealerships.id, dealer.id)),
      (cityId: string) =>
        db
          .update(workshops)
          .set({ cityId })
          .where(eq(workshops.id, workshop.id)),
      (cityId: string) =>
        db
          .update(mechanics)
          .set({ cityId })
          .where(eq(mechanics.id, mechanic.id)),
      (cityId: string) =>
        db
          .insert(mechanicCities)
          .values({ mechanicId: mechanic.id, cityId, position: 99 }),
    ]
    for (const pin of pins) {
      const id = await newCity()
      await pin(id)
      await expectInUse("cities", id)
    }
  })

  test("refuses a district a dealership or a workshop names", async () => {
    const [dealer] = await db.select().from(dealerships).limit(1)
    const [workshop] = await db.select().from(workshops).limit(1)
    if (!(dealer && workshop)) throw new Error("seed")
    const add = async () => {
      const res = await call("POST", "/admin/taxonomy/districts", {
        cityId: "khartoum",
        name: { ar: "ح", en: "H" },
      })
      return ((await res.json()) as { id: string }).id
    }
    const first = await add()
    await db
      .update(dealerships)
      .set({ districtId: first })
      .where(eq(dealerships.id, dealer.id))
    await expectInUse("districts", first)
    const second = await add()
    await db
      .update(workshops)
      .set({ districtId: second })
      .where(eq(workshops.id, workshop.id))
    await expectInUse("districts", second)
  })

  test("refuses a vehicle type (403 `forbidden`) and answers 404 for an unknown entry", async () => {
    const fixed = await remove("vehicle-types", "car")
    expect(fixed.status).toBe(403)
    expect((await errorOf(fixed)).code).toBe("forbidden")
    expect((await remove("cities", "nope")).status).toBe(404)
    expect((await remove("nope", "x")).status).toBe(404)
    expect(await db.select().from(districts).limit(1)).toHaveLength(1)
  })
})
