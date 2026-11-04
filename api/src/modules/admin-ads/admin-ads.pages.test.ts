import { beforeEach, describe, expect, test } from "bun:test"
import { adPageSchema } from "@sayaratak/shared/schemas/ads"
import { eq } from "drizzle-orm"

import { db } from "~/shared/db/client"
import { auditLog } from "~/modules/audit/audit.tables"

import { adminCaller, errorOf } from "../../../tests/admin"
import { expectSchema, resetDb } from "../../../tests/helpers"

let call = adminCaller()
beforeEach(async () => {
  await resetDb()
  call = adminCaller()
})

const edit = (id: string, body: unknown) =>
  call("PATCH", `/admin/ad-pages/${id}`, body)

describe("PATCH /admin/ad-pages/:id", () => {
  test("changes the fields sent, keeps the rest and writes before and after", async () => {
    const res = await edit("home_top", { weeklyPrice: 350000, slots: 4 })
    expect(res.status).toBe(200)
    expect(await expectSchema(res, adPageSchema)).toEqual({
      id: "home_top",
      weeklyPrice: 350000,
      slots: 4,
      enabled: true,
      free: 4,
    })
    const [row] = await db
      .select()
      .from(auditLog)
      .where(eq(auditLog.targetId, "home_top"))
    expect(row).toMatchObject({
      action: "ad_page.update",
      targetType: "ad_page",
      adminId: "u-admin",
      before: { weeklyPrice: 300000, slots: 3 },
      after: { weeklyPrice: 350000, slots: 4 },
    })
  })

  test("switches a page off and on", async () => {
    expect(
      (await (await edit("search_car", { enabled: false })).json()) as object
    ).toMatchObject({ enabled: false })
    expect(
      (await (await edit("search_car", { enabled: true })).json()) as object
    ).toMatchObject({ enabled: true })
  })

  test("an empty edit changes nothing; an unknown page is 404", async () => {
    expect((await edit("home_top", {})).status).toBe(200)
    const res = await edit("nope", { slots: 2 })
    expect(res.status).toBe(404)
    expect((await errorOf(res)).code).toBe("not_found")
  })

  test("answers 422 for a price below 0 and slots outside 1 to 10", async () => {
    for (const body of [{ weeklyPrice: -1 }, { slots: 0 }, { slots: 11 }]) {
      expect((await edit("home_top", body)).status).toBe(422)
    }
  })
})
