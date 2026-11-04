import { beforeEach, describe, expect, test } from "bun:test"
import {
  adminCountrySchema,
  adminCitySchema,
  adminDistrictSchema,
} from "@sayaratak/shared/schemas/admin"
import { taxonomySchema } from "@sayaratak/shared/schemas/taxonomy"
import { z } from "zod"

import { adminCaller, errorOf } from "../../../tests/admin"
import {
  buildSeed,
  expectSchema,
  req,
  resetDb,
  signIn,
} from "../../../tests/helpers"

const seeded = buildSeed()
const { makes, models, vehicleTypes, partCategories } = taxonomySchema.shape

// Seed: five countries (only Sudan is on, and only Sudan has cities), ten cities, five vehicle types.
let call = adminCaller()
beforeEach(async () => {
  await resetDb()
  call = adminCaller()
})

describe("admin taxonomy routes", () => {
  test("answer 401 signed out and 403 `forbidden` to a seller", async () => {
    const { cookie, origin } = await signIn("dealership")
    for (const [method, path] of [
      ["GET", "/admin/taxonomy/cities"],
      ["POST", "/admin/taxonomy/cities"],
      ["PATCH", "/admin/taxonomy/cities/khartoum"],
      ["DELETE", "/admin/taxonomy/cities/khartoum"],
    ] as const) {
      expect((await req(path, { method })).status).toBe(401)
      const seller = await req(path, {
        method,
        headers: { cookie, origin, "content-type": "application/json" },
        body: method === "GET" || method === "DELETE" ? undefined : "{}",
      })
      expect(seller.status).toBe(403)
    }
  })
})

describe("GET /admin/taxonomy/:type", () => {
  test("is every list in seed order, shaped as the admin pages read it", async () => {
    const lists = [
      ["cities", adminCitySchema, seeded.taxonomy.cities],
      ["districts", adminDistrictSchema, seeded.taxonomy.districts],
      ["makes", makes.element, seeded.taxonomy.makes],
      ["models", models.element, seeded.taxonomy.models],
      ["vehicle-types", vehicleTypes.element, seeded.taxonomy.vehicleTypes],
      [
        "part-categories",
        partCategories.element,
        seeded.taxonomy.partCategories,
      ],
      ["countries", adminCountrySchema, seeded.countries],
    ] as const
    for (const [type, schema, expected] of lists) {
      const res = await call("GET", `/admin/taxonomy/${type}`)
      expect(res.status).toBe(200)
      const rows = await expectSchema(res, z.array(schema))
      expect(rows.map((row) => row.id)).toEqual(expected.map((row) => row.id))
    }
  })

  test("answers 404 `not_found` for a list that is not managed here", async () => {
    for (const type of ["nope", "specializations", "service-templates"]) {
      const res = await call("GET", `/admin/taxonomy/${type}`)
      expect(res.status).toBe(404)
      expect((await errorOf(res)).code).toBe("not_found")
    }
  })

  test("keeps the cities of a turned-off country, which the public list drops", async () => {
    await call("PATCH", "/admin/taxonomy/countries/eg", { enabled: true })
    const off = await call("PATCH", "/admin/taxonomy/countries/sd", {
      enabled: false,
    })
    expect(off.status).toBe(200)
    const admin = await call("GET", "/admin/taxonomy/cities")
    expect(await admin.json()).toHaveLength(seeded.taxonomy.cities.length)
    const publicList = await expectSchema(
      await req("/taxonomy"),
      taxonomySchema
    )
    expect(publicList.cities).toEqual([])
    expect(publicList.districts).toEqual([])
  })
})
