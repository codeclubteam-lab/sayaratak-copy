import { beforeEach, describe, expect, test } from "bun:test"
import { adminReportSchema } from "@sayaratak/shared/schemas/admin"
import { pageOf } from "@sayaratak/shared/schemas/fields"
import { eq } from "drizzle-orm"

import { db } from "~/shared/db/client"
import { listings } from "~/modules/listings/listings.tables"
import { user } from "~/modules/auth/auth.tables"

import { adminCaller, errorOf } from "../../../tests/admin"
import {
  buildSeed,
  expectSchema,
  req,
  resetDb,
  signIn,
} from "../../../tests/helpers"

// Seed: rp-1 to rp-4 are open (rp-1 and rp-2 on l00001 of ud-2), rp-5 is dismissed, rp-6 actioned.
const seed = buildSeed()

let call = adminCaller()
beforeEach(async () => {
  await resetDb()
  call = adminCaller()
})

const read = async (query = "") => {
  const res = await call("GET", `/admin/reports${query}`)
  expect(res.status).toBe(200)
  return expectSchema(res, pageOf(adminReportSchema))
}
const idsOf = (page: { items: { id: string }[] }) =>
  page.items.map((item) => item.id)

describe("admin report routes", () => {
  test("answer 401 signed out and 403 `forbidden` to a seller", async () => {
    const { cookie, origin } = await signIn("dealership")
    for (const [method, path] of [
      ["GET", "/admin/reports"],
      ["POST", "/admin/reports/rp-1/dismiss"],
      ["POST", "/admin/reports/rp-1/action"],
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

describe("GET /admin/reports", () => {
  test("lists the reports newest first with their listing, reporter and counts", async () => {
    const page = await read()
    expect(page).toMatchObject({ total: 6, page: 1, pageSize: 20 })
    expect(idsOf(page)).toEqual([
      "rp-1",
      "rp-2",
      "rp-3",
      "rp-4",
      "rp-5",
      "rp-6",
    ])
    const [first, , third] = page.items
    expect(first).toMatchObject({
      status: "open",
      reporterName: "New Visitor",
      listingReports: 2,
      sellerBanned: false,
    })
    expect(first?.listing).toMatchObject({
      id: "l00001",
      moderation: "approved",
    })
    expect(third?.listingReports).toBe(1)
  })

  test("filters by status, `resolved` meaning dismissed and actioned together", async () => {
    expect(idsOf(await read("?status=open"))).toEqual([
      "rp-1",
      "rp-2",
      "rp-3",
      "rp-4",
    ])
    expect(idsOf(await read("?status=resolved"))).toEqual(["rp-5", "rp-6"])
    expect(idsOf(await read("?status=dismissed"))).toEqual(["rp-5"])
    expect(idsOf(await read("?status=actioned"))).toEqual(["rp-6"])
    expect((await read("?status=zzzz")).total).toBe(0)
  })

  test("finds one report by id; an unknown id gives none", async () => {
    expect(idsOf(await read("?id=rp-3"))).toEqual(["rp-3"])
    expect((await read("?id=zzzz")).total).toBe(0)
  })

  test("pages", async () => {
    const page = await read("?pageSize=2&page=2")
    expect(page).toMatchObject({ total: 6, page: 2, pageSize: 2 })
    expect(idsOf(page)).toEqual(["rp-3", "rp-4"])
  })

  test("`q` matches the listing title and the reporter's name", async () => {
    const title = seed.listings.find((l) => l.id === "l0000f")?.title ?? ""
    expect(idsOf(await read(`?q=${encodeURIComponent(title)}`))).toEqual([
      "rp-3",
    ])
    expect(idsOf(await read("?q=new%20visitor"))).toEqual(["rp-1"])
    expect((await read("?q=zzzz")).total).toBe(0)
  })

  test("shows whether the seller is banned now", async () => {
    await db
      .update(user)
      .set({ banned: true, banExpires: null })
      .where(eq(user.id, "ud-2"))
    expect((await read("?id=rp-1")).items[0]?.sellerBanned).toBe(true)
    // A ban that has ended no longer counts.
    await db
      .update(user)
      .set({ banExpires: new Date(Date.now() - 1000) })
      .where(eq(user.id, "ud-2"))
    expect((await read("?id=rp-1")).items[0]?.sellerBanned).toBe(false)
  })

  test("a report of a deleted listing has no listing and counts none", async () => {
    await db.delete(listings).where(eq(listings.id, "l0000f"))
    const row = (await read("?id=rp-3")).items[0]
    expect(row).toMatchObject({ listing: null, listingReports: 0 })
    expect(row?.sellerBanned).toBe(false)
  })
})
