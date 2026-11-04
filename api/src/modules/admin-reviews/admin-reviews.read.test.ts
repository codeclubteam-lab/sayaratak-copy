import { beforeEach, describe, expect, test } from "bun:test"
import { adminReviewSchema } from "@sayaratak/shared/schemas/admin"
import { pageOf } from "@sayaratak/shared/schemas/fields"

import { eq } from "drizzle-orm"

import { db } from "~/shared/db/client"
import { workshops } from "~/modules/businesses/businesses.tables"

import { adminCaller, errorOf } from "../../../tests/admin"
import {
  buildSeed,
  expectSchema,
  req,
  resetDb,
  signIn,
} from "../../../tests/helpers"

const seed = buildSeed()
const seeded = seed.reviews
// Ties in the mock's id order: `r-2` before `r-10`.
const newestFirst = (rows: { id: string; createdAt: string }[]) =>
  rows
    .toSorted(
      (a, b) =>
        b.createdAt.localeCompare(a.createdAt) ||
        a.id.length - b.id.length ||
        a.id.localeCompare(b.id)
    )
    .map((row) => row.id)

let call = adminCaller()
beforeEach(async () => {
  await resetDb()
  call = adminCaller()
})

const read = async (query = "") => {
  const res = await call("GET", `/admin/reviews${query}`)
  expect(res.status).toBe(200)
  return expectSchema(res, pageOf(adminReviewSchema))
}
const idsOf = (page: { items: { id: string }[] }) =>
  page.items.map((item) => item.id)

describe("admin review routes", () => {
  test("answer 401 signed out and 403 `forbidden` to a seller", async () => {
    const { cookie, origin } = await signIn("workshop")
    for (const [method, path] of [
      ["GET", "/admin/reviews"],
      ["POST", "/admin/reviews/r-1/hide"],
      ["POST", "/admin/reviews/r-1/show"],
    ] as const) {
      expect((await req(path, { method })).status).toBe(401)
      const seller = await req(path, {
        method,
        headers: { cookie, origin, "content-type": "application/json" },
      })
      expect(seller.status).toBe(403)
      expect((await errorOf(seller)).code).toBe("forbidden")
    }
  })
})

describe("GET /admin/reviews", () => {
  test("lists every review newest first, 20 to a page, each with its business", async () => {
    const page = await read()
    expect(page).toMatchObject({ total: 120, page: 1, pageSize: 20 })
    expect(idsOf(page)).toEqual(newestFirst(seeded).slice(0, 20))
    const shop = seed.workshops.find((w) => w.id === "w-4")
    const row = (await read("?id=r-1")).items[0]
    expect({ name: row?.target?.name, slug: row?.target?.slug }).toEqual({
      name: shop?.name,
      slug: shop?.slug,
    })
  })

  test("pages with `page` and `pageSize`", async () => {
    const page = await read("?page=3&pageSize=7")
    expect(page).toMatchObject({ total: 120, page: 3, pageSize: 7 })
    expect(idsOf(page)).toEqual(newestFirst(seeded).slice(14, 21))
  })

  test("filters by status, kind, stars and id", async () => {
    expect(idsOf(await read("?status=flagged")).toSorted()).toEqual([
      "r-117",
      "r-118",
      "r-119",
      "r-120",
    ])
    expect((await read("?status=hidden")).total).toBe(4)
    expect((await read("?targetType=workshop")).total).toBe(
      seeded.filter((r) => r.targetType === "workshop").length
    )
    expect((await read("?rating=5")).total).toBe(
      seeded.filter((r) => r.rating === 5).length
    )
    expect(idsOf(await read("?id=r-117"))).toEqual(["r-117"])
  })

  test("a value no review has matches nothing", async () => {
    for (const query of [
      "?status=zzzz",
      "?targetType=zzzz",
      "?rating=abc",
      "?rating=2.5",
      "?rating=0",
      "?id=zzzz",
    ])
      expect((await read(query)).total).toBe(0)
  })

  test("`q` matches the author, the text and the business name in either language", async () => {
    const author = seeded.find((r) => r.id === "r-117")?.authorName ?? ""
    const byAuthor = await read(`?q=${encodeURIComponent(author)}`)
    expect(idsOf(byAuthor)).toContain("r-117")
    expect(
      byAuthor.items.every((item) => item.authorName.includes(author))
    ).toBe(true)

    const body = seeded.find((r) => r.id === "r-1")?.body ?? ""
    expect(idsOf(await read(`?q=${encodeURIComponent(body)}`))).toContain("r-1")

    const shop = seed.workshops.find((w) => w.id === "w-1")
    for (const name of [shop?.name.en, shop?.name.ar, "AL AMAL AUTO"]) {
      const found = await read(
        `?q=${encodeURIComponent(name ?? "")}&pageSize=100`
      )
      expect(found.items.some((item) => item.target?.slug === shop?.slug)).toBe(
        true
      )
    }
    expect((await read("?q=zzzz")).total).toBe(0)
  })

  test("a review of a deleted business has no target", async () => {
    await db.delete(workshops).where(eq(workshops.id, "w-4"))
    const row = (await read("?id=r-1")).items[0]
    expect(row?.target).toBeNull()
  })
})
