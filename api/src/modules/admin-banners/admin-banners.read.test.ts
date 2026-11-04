import { beforeEach, describe, expect, test } from "bun:test"
import { bannerSchema } from "@sayaratak/shared/schemas/admin"
import { z } from "zod"

import { expectSchema, req, resetDb, signIn } from "../../../tests/helpers"
import { callAs } from "../../../tests/banners"

// Seed: seven banners bn-1 to bn-7, sort order 0 to 6, all on and inside their dates.
beforeEach(resetDb)

describe("admin banner routes", () => {
  test("answer 401 signed out and 403 `forbidden` to a seller", async () => {
    const { cookie, origin } = await signIn("dealership")
    for (const [method, path] of [
      ["GET", "/admin/banners"],
      ["POST", "/admin/banners"],
      ["PATCH", "/admin/banners/bn-1"],
      ["DELETE", "/admin/banners/bn-1"],
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

describe("GET /admin/banners", () => {
  test("is every banner by sort order, with its pictures and counters", async () => {
    const call = callAs(await signIn("admin"))
    const res = await call("GET", "/admin/banners")
    expect(res.status).toBe(200)
    const rows = await expectSchema(res, z.array(bannerSchema))
    expect(rows.map((row) => row.id)).toEqual([
      "bn-1",
      "bn-2",
      "bn-3",
      "bn-4",
      "bn-5",
      "bn-6",
      "bn-7",
    ])
    expect(rows[0]?.imageUrl).toEqual({
      ar: "/mock/banner-1.webp",
      en: "/mock/banner-1.webp",
    })
  })

  test("keeps a banner that is off, which the public list drops", async () => {
    const call = callAs(await signIn("admin"))
    await call("PATCH", "/admin/banners/bn-1", { active: false })
    const admin = await expectSchema(
      await call("GET", "/admin/banners"),
      z.array(bannerSchema)
    )
    expect(admin.find((row) => row.id === "bn-1")?.active).toBe(false)
    const live = (await (await req("/banners")).json()) as { id: string }[]
    expect(live.map((row) => row.id)).not.toContain("bn-1")
  })
})
