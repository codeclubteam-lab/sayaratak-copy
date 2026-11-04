import { beforeEach, describe, expect, test } from "bun:test"
import { estimateSchema } from "@sayaratak/shared/schemas/responses"
import { eq, sql } from "drizzle-orm"

import { db } from "~/shared/db/client"
import { user } from "~/modules/auth/auth.tables"
import { dealerships } from "~/modules/businesses/businesses.tables"

import { adminCaller, errorOf } from "../../../tests/admin"
import { expectSchema, req, resetDb, signIn } from "../../../tests/helpers"

// Seed: 61 individuals (2 banned), 12 dealerships, 14 workshops, 18 mechanics, all reading announcements.
let call = adminCaller()
beforeEach(async () => {
  await resetDb()
  call = adminCaller()
})

const estimate = async (query: string) => {
  const res = await call("GET", `/admin/broadcasts/estimate?${query}`)
  expect(res.status).toBe(200)
  return (await expectSchema(res, estimateSchema)).count
}
const stopAnnouncements = (userId: string) =>
  db
    .update(user)
    .set({ prefs: sql`jsonb_set(${user.prefs}, '{announcements}', 'false')` })
    .where(eq(user.id, userId))

describe("admin broadcast routes", () => {
  test("answer 401 signed out and 403 `forbidden` to a seller", async () => {
    const { cookie, origin } = await signIn("dealership")
    for (const [method, path] of [
      ["GET", "/admin/broadcasts"],
      ["GET", "/admin/broadcasts/estimate?roles=user"],
      ["POST", "/admin/broadcasts"],
    ] as const) {
      expect((await req(path, { method })).status).toBe(401)
      const seller = await req(path, {
        method,
        headers: { cookie, origin, "content-type": "application/json" },
        body: method === "POST" ? "{}" : undefined,
      })
      expect(seller.status).toBe(403)
    }
  })
})

describe("GET /admin/broadcasts/estimate", () => {
  test("counts the accounts in the roles that read announcements, without banned ones", async () => {
    expect(await estimate("roles=user")).toBe(59)
    expect(await estimate("roles=dealership&roles=workshop")).toBe(26)
    expect(await estimate("roles=mechanic")).toBe(18)
    await stopAnnouncements("ud-2")
    expect(await estimate("roles=dealership")).toBe(11)
  })

  test("narrows by city and by the verified badge, which leaves individuals out", async () => {
    const shops = await db.select().from(dealerships)
    const verified = shops.filter((row) => row.verified).length
    expect(await estimate("roles=dealership&verifiedOnly=true")).toBe(verified)
    expect(await estimate("roles=user&verifiedOnly=true")).toBe(0)
    const city = shops[0]?.cityId ?? ""
    const inCity = shops.filter((row) => row.cityId === city).length
    expect(await estimate(`roles=dealership&cityId=${city}`)).toBe(inCity)
    expect(await estimate("roles=dealership&cityId=")).toBe(shops.length)
    expect(await estimate("roles=dealership&cityId=nowhere")).toBe(0)
  })

  test("answers 422 for no role or one that is not an audience", async () => {
    for (const query of ["", "roles=admin", "roles=robot"]) {
      const res = await call("GET", `/admin/broadcasts/estimate?${query}`)
      expect(res.status).toBe(422)
      const fields = Object.keys((await errorOf(res)).fields ?? {})
      expect(fields.some((field) => field.startsWith("roles"))).toBe(true)
    }
  })
})
