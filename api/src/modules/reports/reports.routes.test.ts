import { beforeEach, describe, expect, test } from "bun:test"
import { reportSchema } from "@sayaratak/shared/schemas/admin"
import { countsSchema } from "@sayaratak/shared/schemas/api"
import { eq } from "drizzle-orm"

import { notifications } from "~/modules/notifications/notifications.tables"
import { db } from "~/shared/db/client"

import {
  call,
  DEMO_IDS,
  expectSchema,
  req,
  resetDb,
  signIn,
} from "../../../tests/helpers"
import { reports } from "./reports.tables"

const body = { listingId: "l00001", reason: "scam" }
const send = async (as: Awaited<ReturnType<typeof signIn>>, input: object) =>
  call(as, "/reports", { method: "POST", body: input })

beforeEach(resetDb)

describe("POST /reports", () => {
  test("saves an open report from the signed-in account", async () => {
    const buyer = await signIn("user")
    const report = await expectSchema(
      await send(buyer, { ...body, details: "Fake photos" }),
      reportSchema
    )
    expect(report).toMatchObject({
      listingId: "l00001",
      reporterId: DEMO_IDS.user,
      reason: "scam",
      details: "Fake photos",
      status: "open",
    })
    expect(report.id).toMatch(/^rp-/)
    const [row] = await db
      .select()
      .from(reports)
      .where(eq(reports.id, report.id))
    expect(row).toMatchObject({ status: "open", resolutionNote: null })
  })

  test("the admin's open count grows by one and nobody is notified", async () => {
    const admin = await signIn("admin")
    const open = async () =>
      (
        await expectSchema(
          await req("/me/counts", { headers: { cookie: admin.cookie } }),
          countsSchema
        )
      ).openReports ?? 0
    const before = await open()
    const notices = await db.$count(notifications)
    await send(await signIn("user"), body)
    expect(await open()).toBe(before + 1)
    expect(await db.$count(notifications)).toBe(notices)
  })

  test("the same person may report twice, and the owner may report their own", async () => {
    const buyer = await signIn("user")
    expect((await send(buyer, body)).status).toBe(200)
    expect((await send(buyer, body)).status).toBe(200)
  })

  test("is 401 signed out, 404 for an unknown listing, 422 for a bad body", async () => {
    expect((await req("/reports", { method: "POST" })).status).toBe(401)
    const buyer = await signIn("user")
    expect((await send(buyer, { ...body, listingId: "l-nope" })).status).toBe(
      404
    )
    const other = await send(buyer, { ...body, reason: "other" })
    expect(other.status).toBe(422)
    expect(await other.json()).toMatchObject({
      code: "validation",
      fields: { details: "validation.details_required" },
    })
    const reason = await send(buyer, { ...body, reason: "spam" })
    expect(reason.status).toBe(422)
    const long = await send(buyer, { ...body, details: "x".repeat(1001) })
    expect(long.status).toBe(422)
    expect(await long.json()).toMatchObject({
      fields: { details: "validation.too_long" },
    })
  })
})
