import { beforeEach, describe, expect, test } from "bun:test"
import { eq, ne } from "drizzle-orm"

import { db } from "~/shared/db/client"
import {
  workshopServices,
  workshops,
} from "~/modules/businesses/businesses.tables"

import { expectSchema, resetDb, signIn } from "../../../tests/helpers"
import {
  add,
  list,
  listSchema,
  patch,
  remove,
  reorder,
  serviceSchema,
} from "../../../tests/services"

beforeEach(resetDb)

describe("PATCH /me/services/:id", () => {
  test("changes only the fields sent and keeps the template link", async () => {
    const shop = await signIn("workshop")
    const rows = await list(shop)
    const row = rows.find((service) => service.templateId) ?? rows[0]
    const res = await patch(shop, row?.id ?? "", { name: "New name" })
    expect(res.status).toBe(200)
    expect(row?.templateId).toBeString()
    expect(await expectSchema(res, serviceSchema)).toMatchObject({
      ...row,
      name: "New name",
    })
    const priced = await patch(shop, row?.id ?? "", { priceFrom: 9000 })
    expect(await priced.json()).toMatchObject({
      priceFrom: 9000,
      name: "New name",
    })
    const cleared = await patch(shop, row?.id ?? "", { priceFrom: null })
    expect(await expectSchema(cleared, serviceSchema)).not.toHaveProperty(
      "priceFrom"
    )
  })

  test("returns 404 for an unknown service and for another workshop's service, and 422 for a wrong name", async () => {
    const shop = await signIn("workshop")
    expect((await patch(shop, "svc-missing", { name: "x" })).status).toBe(404)
    const [theirs] = await db
      .select()
      .from(workshopServices)
      .innerJoin(workshops, eq(workshops.id, workshopServices.workshopId))
      .where(ne(workshops.ownerUserId, "u-workshop"))
      .limit(1)
    const other = await patch(shop, theirs?.workshop_services.id ?? "", {
      name: "Mine now",
    })
    expect(other.status).toBe(404)
    const rows = await list(shop)
    const bad = await patch(shop, rows[0]?.id ?? "", { name: "" })
    expect(bad.status).toBe(422)
  })
})

describe("DELETE /me/services/:id", () => {
  test("removes the service, and an unknown id or another workshop's service changes nothing", async () => {
    const shop = await signIn("workshop")
    const rows = await list(shop)
    const [theirs] = await db
      .select({ id: workshopServices.id })
      .from(workshopServices)
      .innerJoin(workshops, eq(workshops.id, workshopServices.workshopId))
      .where(ne(workshops.ownerUserId, "u-workshop"))
      .limit(1)
    const total = (await db.select().from(workshopServices)).length
    for (const id of ["svc-missing", theirs?.id ?? ""]) {
      const res = await remove(shop, id)
      expect(await res.json()).toEqual({ ok: true })
    }
    expect((await db.select().from(workshopServices)).length).toBe(total)
    expect(await list(shop)).toEqual(rows)
    const gone = await remove(shop, rows[0]?.id ?? "")
    expect(gone.status).toBe(200)
    expect((await list(shop)).map((row) => row.id)).toEqual(
      rows.slice(1).map((row) => row.id)
    )
  })
})

describe("POST /me/services/reorder", () => {
  test("puts the named services first and keeps the others after them", async () => {
    const shop = await signIn("workshop")
    const ids = (await list(shop)).map((row) => row.id)
    expect(ids.length).toBeGreaterThan(2)
    const [a, b, c, ...rest] = ids
    const res = await reorder(shop, [c ?? "", "svc-missing", a ?? "", c ?? ""])
    expect(res.status).toBe(200)
    const order = [c, a, b, ...rest]
    expect((await expectSchema(res, listSchema)).map((row) => row.id)).toEqual(
      order as string[]
    )
    expect((await list(shop)).map((row) => row.id)).toEqual(order as string[])
  })

  test("an empty list changes nothing and a new service still goes last", async () => {
    const shop = await signIn("workshop")
    const ids = (await list(shop)).map((row) => row.id)
    await reorder(shop, [])
    expect((await list(shop)).map((row) => row.id)).toEqual(ids)
    const added = await expectSchema(
      await add(shop, { name: "Last", priceFrom: null, templateId: null }),
      serviceSchema
    )
    expect((await list(shop)).at(-1)?.id).toBe(added.id)
  })
})
