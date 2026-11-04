import { beforeEach, describe, expect, test } from "bun:test"
import { settingsSchema } from "@sayaratak/shared/schemas/admin"
import { eq } from "drizzle-orm"

import { db } from "~/shared/db/client"
import { auditLog } from "~/modules/audit/audit.tables"
import { plans } from "~/modules/plans/plans.tables"

import { adminCaller, errorOf } from "../../../tests/admin"
import { expectSchema, resetDb } from "../../../tests/helpers"

let call = adminCaller()
beforeEach(async () => {
  await resetDb()
  call = adminCaller()
})

const read = async () =>
  expectSchema(await call("GET", "/admin/settings"), settingsSchema)
const patch = (body: unknown) => call("PATCH", "/admin/settings", body)

describe("GET /admin/settings", () => {
  test("is every setting, the bank account as one group", async () => {
    const settings = await read()
    expect(settings).toMatchObject({
      listingExpiryDays: 30,
      freeListingLimit: 3,
      bankakAccount: { name: expect.any(String), number: expect.any(String) },
      locales: ["ar", "en"],
    })
  })
})

describe("PATCH /admin/settings", () => {
  test("changes the settings sent, keeps the rest and writes before and after", async () => {
    const before = await read()
    const res = await patch({ listingExpiryDays: 45, backupSchedule: "weekly" })
    expect(res.status).toBe(200)
    expect(await expectSchema(res, settingsSchema)).toEqual({
      ...before,
      listingExpiryDays: 45,
      backupSchedule: "weekly",
    })
    expect(await read()).toMatchObject({ listingExpiryDays: 45 })
    const [row] = await db.select().from(auditLog)
    expect(row).toMatchObject({
      action: "settings.update",
      targetType: "settings",
      adminId: "u-admin",
      before: {
        listingExpiryDays: 30,
        backupSchedule: before.backupSchedule,
      },
      after: { listingExpiryDays: 45, backupSchedule: "weekly" },
    })
  })

  test("replaces the bank account and the contact details as a whole", async () => {
    const bankakAccount = { name: "Sayaratak Co", number: "1234567" }
    const contact = {
      phone: "+249911111111",
      whatsapp: "",
      email: "hi@sayaratak.sd",
      address: "Khartoum",
    }
    const settings = await expectSchema(
      await patch({ bankakAccount, contact }),
      settingsSchema
    )
    expect(settings.bankakAccount).toEqual(bankakAccount)
    expect(settings.contact).toEqual(contact)
  })

  test("shows the free listing limit on the individuals' free plan", async () => {
    await patch({ freeListingLimit: 7 })
    const [free] = await db
      .select()
      .from(plans)
      .where(eq(plans.id, "plan-user-free"))
    expect(free?.listingLimit).toBe(7)
  })

  test("answers 422 for a value the database would refuse, or one of the wrong kind", async () => {
    for (const [body, field] of [
      [{ listingExpiryDays: 0 }, "listingExpiryDays"],
      [{ freeListingLimit: -1 }, "freeListingLimit"],
      [{ backupSchedule: "hourly" }, "backupSchedule"],
      [{ locales: ["fr"] }, "locales.0"],
      [{ bankakAccount: { name: "x" } }, "bankakAccount.number"],
    ] as const) {
      const res = await patch(body)
      expect(res.status).toBe(422)
      expect(Object.keys((await errorOf(res)).fields ?? {})).toContain(field)
    }
    expect(await read()).toMatchObject({ listingExpiryDays: 30 })
    expect(await db.select().from(auditLog)).toEqual([])
  })

  test("an empty edit changes nothing", async () => {
    const before = await read()
    expect((await patch({})).status).toBe(200)
    expect(await read()).toEqual(before)
  })
})
