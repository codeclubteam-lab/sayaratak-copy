import { beforeEach, describe, expect, test } from "bun:test"
import { taxonomySchema } from "@sayaratak/shared/schemas/taxonomy"
import { asc, eq, sql } from "drizzle-orm"

import { session } from "~/modules/auth/auth.tables"
import { db } from "~/shared/db/client"

import {
  buildSeed,
  expectSchema,
  req,
  resetDb,
  signIn,
} from "../../../tests/helpers"
import { cities, countries, makes, models } from "./taxonomy.tables"

const seeded = buildSeed()

beforeEach(resetDb)

describe("taxonomy tables", () => {
  test("hold the mock's rows in the mock's order", async () => {
    const rows = await db.select().from(models).orderBy(asc(models.position))
    expect(rows.map(({ position: _, ...row }) => row)).toEqual(
      seeded.taxonomy.models
    )
    const countryRows = await db
      .select({ id: countries.id })
      .from(countries)
      .orderBy(asc(countries.position))
    expect(countryRows.map((row) => row.id)).toEqual(
      seeded.countries.map((country) => country.id)
    )
  })

  test("store names and settings as jsonb objects, not JSON strings", async () => {
    const rows = await db.execute<{ kinds: string[] }>(
      sql`select array(select distinct jsonb_typeof(name) from countries union select jsonb_typeof(contact) from settings) as kinds`
    )
    expect(rows[0]?.kinds).toEqual(["object"])
  })

  test("refuse to delete a city that districts still use", async () => {
    const error = await db
      .delete(cities)
      .where(eq(cities.id, "khartoum"))
      .catch((error) => error)
    expect(error.cause.errno).toBe("23503")
  })

  test("refuse a name without both languages and a make without types", async () => {
    const bad = { id: "x", slug: "x", vehicleTypes: [] }
    const noTypes = await db
      .insert(makes)
      .values({ ...bad, name: { ar: "x", en: "x" } })
      .catch((error) => error)
    expect(noTypes.cause.constraint).toBe("makes_vehicle_types")
    const oneSlot = await db
      .execute(
        sql`insert into makes (id, slug, name, vehicle_types) values ('y', 'y', '{"ar": "x"}', '{car}')`
      )
      .catch((error) => error)
    expect(oneSlot.cause.constraint).toBe("makes_name")
  })
})

describe("GET /taxonomy", () => {
  test("answers every list in the mock's order, checked by the shared schema", async () => {
    const res = await req("/taxonomy")
    expect(res.status).toBe(200)
    const taxonomy = await expectSchema(res, taxonomySchema)
    expect(taxonomy.makes.map((make) => make.id)).toEqual(
      seeded.taxonomy.makes.map((make) => make.id)
    )
    expect(taxonomy.cities[0]?.center).toEqual(
      seeded.taxonomy.cities[0]?.center
    )
    expect(taxonomy.specializations).toEqual(seeded.taxonomy.specializations)
  })

  test("leaves out cities and districts of a turned-off country", async () => {
    const countryId = seeded.taxonomy.cities[0]?.countryId ?? ""
    await db
      .update(countries)
      .set({ enabled: false })
      .where(eq(countries.id, countryId))
    const taxonomy = await expectSchema(await req("/taxonomy"), taxonomySchema)
    const hidden = new Set(
      seeded.taxonomy.cities
        .filter((city) => city.countryId === countryId)
        .map((city) => city.id)
    )
    expect(hidden.size).toBeGreaterThan(0)
    expect(taxonomy.cities.some((city) => hidden.has(city.id))).toBe(false)
    expect(taxonomy.districts.some((d) => hidden.has(d.cityId))).toBe(false)
    expect(taxonomy.makes).toHaveLength(seeded.taxonomy.makes.length)
  })

  test("shows a make's uploaded logo and leaves the key out without one", async () => {
    const [first, second] = seeded.taxonomy.makes
    await db
      .update(makes)
      .set({ logoUrl: "https://cdn.example/logo.webp" })
      .where(eq(makes.id, first?.id ?? ""))
    const text = await (await req("/taxonomy")).text()
    const taxonomy = taxonomySchema.parse(JSON.parse(text))
    expect(taxonomy.makes[0]?.logoUrl).toBe("https://cdn.example/logo.webp")
    expect(taxonomy.makes[1]?.id).toBe(second?.id ?? "")
    // Only the one make with a logo carries the key; no `"logoUrl": null`.
    expect(text.split('"logoUrl"')).toHaveLength(2)
  })

  test("may be cached publicly for a minute (A12)", async () => {
    const res = await req("/taxonomy")
    expect(res.headers.get("cache-control")).toBe("public, max-age=60")
  })

  test("stays no-store when the answer refreshes the session cookie", async () => {
    const { cookie } = await signIn("user")
    // A session close to its end is extended on the next request, which
    // sets a new cookie.
    await db.update(session).set({ expiresAt: new Date(Date.now() + 60_000) })
    const res = await req("/taxonomy", { headers: { cookie } })
    expect(res.headers.get("set-cookie")).not.toBeNull()
    expect(res.headers.get("cache-control")).toBe("no-store")
  })
})
