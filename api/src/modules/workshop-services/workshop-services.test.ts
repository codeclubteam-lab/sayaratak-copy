import { beforeEach, describe, expect, test } from "bun:test"
import { workshopSchema } from "@sayaratak/shared/schemas/profile"
import { eq } from "drizzle-orm"

import { db } from "~/shared/db/client"
import { user } from "~/modules/auth/auth.tables"
import { serviceTemplates } from "~/modules/taxonomy/taxonomy.tables"

import { read } from "../../../tests/business"
import { expectSchema, req, resetDb, signIn } from "../../../tests/helpers"
import {
  add,
  limitTo,
  list,
  patch,
  remove,
  reorder,
  serviceSchema,
} from "../../../tests/services"

beforeEach(resetDb)

describe("GET /me/services", () => {
  test("answers the workshop's services in the shared schema", async () => {
    const shop = await signIn("workshop")
    const rows = await list(shop)
    expect(rows.length).toBeGreaterThan(0)
    const profile = await expectSchema(
      await read(shop, "/me/business"),
      workshopSchema
    )
    expect(rows).toEqual(profile.services)
  })

  test("returns 401 signed out, 403 for a dealership, 403 banned and 404 without a workshop", async () => {
    expect((await req("/me/services")).status).toBe(401)
    const dealer = await signIn("dealership")
    const refused = await read(dealer, "/me/services")
    expect(refused.status).toBe(403)
    expect(await refused.json()).toMatchObject({ code: "forbidden" })
    const shop = await signIn("workshop")
    await db.update(user).set({ banned: true }).where(eq(user.id, "u-workshop"))
    expect(await (await read(shop, "/me/services")).json()).toMatchObject({
      code: "banned",
    })
    const visitor = await signIn("new")
    await db.update(user).set({ role: "workshop" }).where(eq(user.id, "u-new"))
    expect((await read(visitor, "/me/services")).status).toBe(404)
  })
})

describe("POST /me/services", () => {
  test("adds a service at the end with an empty description and no price", async () => {
    const shop = await signIn("workshop")
    const before = await list(shop)
    const res = await add(shop, {
      name: "Brake check",
      priceFrom: null,
      templateId: null,
    })
    expect(res.status).toBe(200)
    const saved = await expectSchema(res, serviceSchema)
    expect(saved).toEqual({
      id: saved.id,
      name: "Brake check",
      description: "",
      templateId: null,
    })
    expect((await list(shop)).map((row) => row.id)).toEqual([
      ...before.map((row) => row.id),
      saved.id,
    ])
  })

  test("keeps a known template and a price, and reads an unknown template as custom", async () => {
    const shop = await signIn("workshop")
    const [template] = await db.select().from(serviceTemplates).limit(1)
    const known = await add(shop, {
      name: "Oil change",
      description: "Filter included",
      priceFrom: 15000,
      templateId: template?.id,
    })
    expect(await expectSchema(known, serviceSchema)).toMatchObject({
      description: "Filter included",
      priceFrom: 15000,
      templateId: template?.id,
    })
    const unknown = await add(shop, {
      name: "Other",
      priceFrom: null,
      templateId: "tpl-gone",
    })
    expect(await unknown.json()).toMatchObject({ templateId: null })
  })

  test("returns 422 with field keys for a wrong service", async () => {
    const shop = await signIn("workshop")
    const before = await list(shop)
    const res = await add(shop, { name: "", priceFrom: 0, templateId: null })
    expect(res.status).toBe(422)
    expect(await res.json()).toMatchObject({
      code: "validation",
      fields: {
        name: "validation.required",
        priceFrom: "validation.price_min",
      },
    })
    expect(await list(shop)).toEqual(before)
  })

  test("returns 403 limit_reached at the plan's service limit and lets a change through", async () => {
    const shop = await signIn("workshop")
    const rows = await list(shop)
    await limitTo(rows.length)
    const full = await add(shop, {
      name: "One more",
      priceFrom: null,
      templateId: null,
    })
    expect(full.status).toBe(403)
    expect(await full.json()).toMatchObject({ code: "limit_reached" })
    const first = rows[0]?.id ?? ""
    expect((await patch(shop, first, { name: "Renamed" })).status).toBe(200)
    expect(
      (await reorder(shop, rows.map((row) => row.id).reverse())).status
    ).toBe(200)
    expect((await remove(shop, first)).status).toBe(200)
    expect(
      (await add(shop, { name: "Fits now", priceFrom: null, templateId: null }))
        .status
    ).toBe(200)
  })

  test("two adds at once past the last free place let only one through", async () => {
    const shop = await signIn("workshop")
    const rows = await list(shop)
    await limitTo(rows.length + 1)
    const results = await Promise.all(
      ["A", "B"].map((name) =>
        add(shop, { name, priceFrom: null, templateId: null })
      )
    )
    expect(results.map((res) => res.status).sort()).toEqual([200, 403])
    expect(await list(shop)).toHaveLength(rows.length + 1)
  })
})
