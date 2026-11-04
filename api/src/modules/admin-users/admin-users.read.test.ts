import { beforeEach, describe, expect, test } from "bun:test"
import { adminUserSchema } from "@sayaratak/shared/schemas/admin"
import { pageOf } from "@sayaratak/shared/schemas/fields"

import { adminCaller } from "../../../tests/admin"
import {
  buildSeed,
  expectSchema,
  req,
  resetDb,
  signIn,
} from "../../../tests/helpers"

const seeded = buildSeed()
const nonDraft = (ownerId: string) =>
  seeded.listings.filter(
    (l) => l.ownerUserId === ownerId && l.moderation !== "draft"
  )

let call = adminCaller()
beforeEach(async () => {
  await resetDb()
  call = adminCaller()
})

const table = async (query = "") => {
  const res = await call("GET", `/admin/users${query}`)
  expect(res.status).toBe(200)
  return expectSchema(res, pageOf(adminUserSchema))
}

describe("admin user routes", () => {
  test("answer 401 signed out and 403 `forbidden` to a seller", async () => {
    const { cookie, origin } = await signIn("dealership")
    for (const [method, path] of [
      ["GET", "/admin/users"],
      ["POST", "/admin/users/u-omar/ban"],
      ["POST", "/admin/users/u-omar/unban"],
    ] as const) {
      expect((await req(path, { method })).status).toBe(401)
      const seller = await req(path, {
        method,
        headers: { cookie, origin, "content-type": "application/json" },
        body: method === "GET" ? undefined : "{}",
      })
      expect(seller.status).toBe(403)
    }
  })
})

describe("GET /admin/users", () => {
  test("is every account newest first, 20 to a page", async () => {
    const page = await table()
    expect(page).toMatchObject({
      total: seeded.users.length,
      page: 1,
      pageSize: 20,
    })
    expect(page.items).toHaveLength(20)
    const times = page.items.map((u) => u.createdAt)
    expect(times).toEqual([...times].sort().reverse())
  })

  test("counts each account's listings without drafts and the reports on them", async () => {
    const [omar] = (await table("?id=u-omar")).items
    expect(omar?.listings).toBe(nonDraft("u-omar").length)
    // rp-3 is on one of u-omar's listings.
    expect(omar?.reportsAgainst).toBe(1)
    const [dealer] = (await table("?id=u-dealer")).items
    expect(dealer?.listings).toBe(nonDraft("u-dealer").length)
    expect((await table("?id=ud-2")).items[0]?.reportsAgainst).toBe(2)
  })

  test("filters by role, status, id and text", async () => {
    const mechanics = await table("?role=mechanic&pageSize=100")
    expect(mechanics.total).toBe(18)
    expect(mechanics.items.every((u) => u.role === "mechanic")).toBe(true)
    const banned = await table("?status=banned")
    expect(banned.items.map((u) => u.id).sort()).toEqual(["u-58", "u-59"])
    expect(banned.items[0]?.bannedReason).toBe("Repeated spam listings")
    expect((await table("?status=active")).total).toBe(seeded.users.length - 2)
    expect((await table("?id=u-admin")).items.map((u) => u.role)).toEqual([
      "admin",
    ])
    expect(
      (await table("?q=USER1@example.sy")).items.map((u) => u.id)
    ).toContain("u-1")
    expect((await table("?q=+249923356945")).items.map((u) => u.id)).toEqual([
      "u-1",
    ])
    expect((await table("?role=boss")).items).toEqual([])
  })
})
