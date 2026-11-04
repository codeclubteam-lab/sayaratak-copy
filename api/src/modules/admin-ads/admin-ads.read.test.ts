import { beforeEach, describe, expect, test } from "bun:test"
import {
  adminCampaignSchema,
  adPageSchema,
} from "@sayaratak/shared/schemas/ads"
import { z } from "zod"

import { adminCaller } from "../../../tests/admin"
import {
  buildSeed,
  expectSchema,
  req,
  resetDb,
  signIn,
} from "../../../tests/helpers"
import { campaignReceipt } from "../admin-payments/admin-payments.test-helpers"

const seeded = buildSeed()

// Seed: camp-1 (u-dealer) is approved, camp-2 (u-workshop) waits for review; no campaign receipt.
let call = adminCaller()
beforeEach(async () => {
  await resetDb()
  call = adminCaller()
})

describe("admin ads routes", () => {
  test("answer 401 signed out and 403 `forbidden` to a seller", async () => {
    const { cookie, origin } = await signIn("dealership")
    for (const [method, path] of [
      ["GET", "/admin/campaigns"],
      ["POST", "/admin/campaigns/camp-2/approve"],
      ["POST", "/admin/campaigns/camp-2/reject"],
      ["GET", "/admin/ad-pages"],
      ["PATCH", "/admin/ad-pages/home_top"],
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

describe("GET /admin/campaigns", () => {
  test("lists the campaign waiting for review first, with its advertiser and no receipt yet", async () => {
    const res = await call("GET", "/admin/campaigns")
    expect(res.status).toBe(200)
    const rows = await expectSchema(res, z.array(adminCampaignSchema))
    expect(rows.map((row) => [row.id, row.status])).toEqual([
      ["camp-2", "under_review"],
      ["camp-1", "approved"],
    ])
    expect(rows[0]).toMatchObject({
      ownerId: "u-workshop",
      receiptUrl: null,
      creative: { imageUrl: expect.any(String) },
    })
    expect(rows[0]?.ownerName).not.toBe("")
  })

  test("shows the receipt sent for a campaign", async () => {
    await campaignReceipt()
    const rows = await expectSchema(
      await call("GET", "/admin/campaigns"),
      z.array(adminCampaignSchema)
    )
    expect(rows.find((row) => row.id === "camp-2")?.receiptUrl).toMatch(
      /^(\/|https?:)/
    )
    expect(rows.find((row) => row.id === "camp-1")?.receiptUrl).toBeNull()
  })
})

describe("GET /admin/ad-pages", () => {
  test("lists every page in seed order, every slot free", async () => {
    const res = await call("GET", "/admin/ad-pages")
    const rows = await expectSchema(res, z.array(adPageSchema))
    expect(rows.map((row) => row.id)).toEqual(seeded.adPages.map((p) => p.id))
    expect(rows.every((row) => row.free === row.slots)).toBe(true)
  })

  test("keeps a page that is off sale, which the sellers' list drops", async () => {
    await call("PATCH", "/admin/ad-pages/home_top", { enabled: false })
    const admin = await expectSchema(
      await call("GET", "/admin/ad-pages"),
      z.array(adPageSchema)
    )
    expect(admin.find((row) => row.id === "home_top")?.enabled).toBe(false)
    const publicRows = (await (await call("GET", "/ad-pages")).json()) as {
      id: string
    }[]
    expect(publicRows.map((row) => row.id)).not.toContain("home_top")
  })
})
