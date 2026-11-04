import { beforeEach, describe, expect, test } from "bun:test"
import { eq, ne } from "drizzle-orm"

import { db } from "~/shared/db/client"
import {
  mechanics,
  portfolioItems,
} from "~/modules/businesses/businesses.tables"
import { uploads } from "~/modules/uploads/uploads.tables"

import { expectSchema, resetDb, signIn } from "../../../tests/helpers"
import {
  itemSchema,
  list,
  listSchema,
  patch,
  remove,
  reorder,
} from "../../../tests/portfolio"

beforeEach(resetDb)

const foreignItem = () =>
  db
    .select({ id: portfolioItems.id, uploadId: portfolioItems.uploadId })
    .from(portfolioItems)
    .innerJoin(mechanics, eq(mechanics.id, portfolioItems.mechanicId))
    .where(ne(mechanics.ownerUserId, "u-mechanic"))
    .limit(1)
    .then(([row]) => row)

describe("PATCH /me/portfolio/:id", () => {
  test("changes the caption and keeps the picture", async () => {
    const person = await signIn("mechanic")
    const [row] = await list(person)
    const res = await patch(person, row?.id ?? "", {
      caption: "New caption",
      imageId: "ignored",
    })
    expect(res.status).toBe(200)
    expect(await expectSchema(res, itemSchema)).toEqual({
      ...row,
      id: row?.id ?? "",
      url: row?.url ?? "",
      caption: "New caption",
      width: row?.width ?? 0,
      height: row?.height ?? 0,
      placeholderColor: row?.placeholderColor ?? "",
    })
    expect((await list(person))[0]?.caption).toBe("New caption")
  })

  test("returns 404 for an unknown item and for another mechanic's item, and 422 for a wrong caption", async () => {
    const person = await signIn("mechanic")
    expect((await patch(person, "pf-missing", { caption: "x" })).status).toBe(
      404
    )
    const theirs = await foreignItem()
    expect(
      (await patch(person, theirs?.id ?? "", { caption: "Mine now" })).status
    ).toBe(404)
    const [row] = await list(person)
    const bad = await patch(person, row?.id ?? "", { caption: "" })
    expect(bad.status).toBe(422)
  })
})

describe("DELETE /me/portfolio/:id", () => {
  test("removes the picture with its file", async () => {
    const person = await signIn("mechanic")
    const rows = await list(person)
    const [item] = await db
      .select()
      .from(portfolioItems)
      .where(eq(portfolioItems.id, rows[0]?.id ?? ""))
    const res = await remove(person, rows[0]?.id ?? "")
    expect(await res.json()).toEqual({ ok: true })
    expect((await list(person)).map((row) => row.id)).toEqual(
      rows.slice(1).map((row) => row.id)
    )
    const left = await db
      .select()
      .from(uploads)
      .where(eq(uploads.id, item?.uploadId ?? ""))
    expect(left).toHaveLength(0)
  })

  test("an unknown id or another mechanic's item changes nothing", async () => {
    const person = await signIn("mechanic")
    const rows = await list(person)
    const theirs = await foreignItem()
    const total = (await db.select().from(portfolioItems)).length
    for (const id of ["pf-missing", theirs?.id ?? ""]) {
      expect(await (await remove(person, id)).json()).toEqual({ ok: true })
    }
    expect((await db.select().from(portfolioItems)).length).toBe(total)
    expect(await list(person)).toEqual(rows)
  })
})

describe("POST /me/portfolio/reorder", () => {
  test("puts the named pictures first and keeps the others after them", async () => {
    const person = await signIn("mechanic")
    const ids = (await list(person)).map((row) => row.id)
    expect(ids.length).toBeGreaterThan(2)
    const [a = "", b = "", c = "", ...rest] = ids
    const res = await reorder(person, [c, "pf-missing", a, c])
    expect(res.status).toBe(200)
    const order = [c, a, b, ...rest]
    expect((await expectSchema(res, listSchema)).map((row) => row.id)).toEqual(
      order
    )
    expect((await list(person)).map((row) => row.id)).toEqual(order)
  })

  test("an empty list changes nothing", async () => {
    const person = await signIn("mechanic")
    const ids = (await list(person)).map((row) => row.id)
    await reorder(person, [])
    expect((await list(person)).map((row) => row.id)).toEqual(ids)
  })
})
