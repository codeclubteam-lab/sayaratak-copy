import { beforeEach, describe, expect, test } from "bun:test"
import { adminListingSchema } from "@sayaratak/shared/schemas/admin"
import { pageOf } from "@sayaratak/shared/schemas/fields"
import { listingSchema } from "@sayaratak/shared/schemas/listing"

import { adminCaller } from "../../../tests/admin"
import {
  buildSeed,
  expectSchema,
  req,
  resetDb,
  signIn,
} from "../../../tests/helpers"

const seeded = buildSeed().listings
const moderationOf = (state: string) =>
  seeded.filter((l) => l.moderation === state)
const newestFirst = (rows: { id: string; createdAt: string }[]) =>
  rows
    .toSorted(
      (a, b) =>
        b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id)
    )
    .map((l) => l.id)

let call = adminCaller()
beforeEach(async () => {
  await resetDb()
  call = adminCaller()
})

const ROUTES = [
  ["GET", "/admin/moderation"],
  ["GET", "/admin/listings"],
  ["POST", "/admin/listings/l0008d/approve"],
  ["POST", "/admin/listings/l0008d/reject"],
  ["POST", "/admin/listings/l0008d/remove"],
  ["POST", "/admin/listings/l0008d/restore"],
  ["POST", "/admin/listings/bulk"],
  ["PATCH", "/admin/listings/l0008d"],
] as const

describe("admin listing routes", () => {
  test("answer 401 signed out and 403 `forbidden` to a seller", async () => {
    const { cookie, origin } = await signIn("dealership")
    for (const [method, path] of ROUTES) {
      expect((await req(path, { method })).status).toBe(401)
      const seller = await req(path, {
        method,
        headers: { cookie, origin, "content-type": "application/json" },
        body: method === "GET" ? undefined : "{}",
      })
      expect(seller.status).toBe(403)
      expect(await seller.json()).toMatchObject({ code: "forbidden" })
    }
  })
})

describe("GET /admin/moderation", () => {
  const queue = async (query = "") => {
    const res = await call("GET", `/admin/moderation${query}`)
    expect(res.status).toBe(200)
    return expectSchema(res, pageOf(listingSchema))
  }

  test("is the pending listings, newest first", async () => {
    const page = await queue()
    expect(page.items.map((l) => l.id)).toEqual(
      newestFirst(moderationOf("pending"))
    )
    expect(page.items.every((l) => l.moderation === "pending")).toBe(true)
    expect(page.total).toBe(moderationOf("pending").length)
  })

  test("narrows by type, seller kind and text", async () => {
    expect((await queue("?type=truck")).items.map((l) => l.id)).toEqual(
      newestFirst(
        moderationOf("pending").filter((l) => l.vehicleType === "truck")
      )
    )
    const dealers = await queue("?sellerKind=dealership")
    expect(dealers.items.length).toBeGreaterThan(0)
    expect(dealers.items.every((l) => l.owner.type === "dealership")).toBe(true)
    // The queue's text search reads titles only, as the mock; the table also reads ids.
    expect((await queue("?q=L0008D")).items).toEqual([])
    const title = moderationOf("pending")[0]?.title ?? ""
    expect(
      (await queue(`?q=${encodeURIComponent(title.toUpperCase())}`)).items.map(
        (l) => l.title
      )
    ).toContain(title)
    expect((await queue("?type=part")).items).toEqual([])
  })

  test("pages with 20 by default and honors pageSize", async () => {
    const page = await queue("?pageSize=3&page=2")
    expect(page).toMatchObject({ page: 2, pageSize: 3 })
    expect(page.items).toHaveLength(3)
  })
})

describe("GET /admin/listings", () => {
  const table = async (query = "") => {
    const res = await call("GET", `/admin/listings${query}`)
    expect(res.status).toBe(200)
    return expectSchema(res, pageOf(adminListingSchema))
  }

  test("holds every listing but drafts, unless `moderation` asks for them", async () => {
    const all = await table("?pageSize=100")
    expect(all.total).toBe(seeded.length - moderationOf("draft").length)
    expect(all.items.some((l) => l.moderation === "draft")).toBe(false)
    const drafts = await table("?moderation=draft")
    expect(drafts.items.map((l) => l.id).sort()).toEqual(
      moderationOf("draft")
        .map((l) => l.id)
        .sort()
    )
  })

  test("counts the reports on each listing", async () => {
    const [row] = (await table("?id=l00001")).items
    expect(row?.reports).toBe(2)
    expect((await table("?id=l00002")).items[0]?.reports).toBe(0)
  })

  test("filters by owner, city, status, seller kind and promotion", async () => {
    const mine = await table("?ownerId=u-dealer&pageSize=100")
    expect(mine.items.every((l) => l.owner.type === "dealership")).toBe(true)
    expect(mine.total).toBe(
      seeded.filter(
        (l) => l.ownerUserId === "u-dealer" && l.moderation !== "draft"
      ).length
    )
    const promoted = await table("?promoted=yes&pageSize=100")
    expect(promoted.items.length).toBeGreaterThan(0)
    expect(promoted.items.every((l) => l.promotions.length > 0)).toBe(true)
    const plain = await table("?promoted=no&pageSize=100")
    expect(plain.items.every((l) => l.promotions.length === 0)).toBe(true)
    expect(promoted.total + plain.total).toBe((await table()).total)
    const individuals = await table("?sellerKind=individual&pageSize=100")
    expect(individuals.items.every((l) => l.owner.type === "user")).toBe(true)
    const verified = await table("?sellerKind=verified&pageSize=100")
    expect(verified.items.length).toBeGreaterThan(0)
    expect(verified.items.every((l) => l.owner.verified)).toBe(true)
    const sold = await table("?status=sold&pageSize=100")
    expect(sold.items.every((l) => l.status === "sold")).toBe(true)
    const city = seeded[0]?.cityId ?? ""
    expect(
      (await table(`?cityId=${city}&pageSize=100`)).items.every(
        (l) => l.cityId === city
      )
    ).toBe(true)
  })

  test("finds a listing by title, id or owner name, in any case", async () => {
    const row = seeded.find((l) => l.id === "l00001")
    expect(
      (await table(`?q=${row?.id.toUpperCase()}`)).items.map((l) => l.id)
    ).toEqual(["l00001"])
    const byTitle = await table(
      `?q=${encodeURIComponent((row?.title ?? "").toUpperCase())}`
    )
    expect(byTitle.items.map((l) => l.id)).toContain("l00001")
    const byOwner = await table(
      `?q=${encodeURIComponent((row?.owner.name.en ?? "").toLowerCase())}`
    )
    expect(byOwner.items.map((l) => l.id)).toContain("l00001")
  })
})
