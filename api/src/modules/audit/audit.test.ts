import {
  afterEach,
  beforeEach,
  describe,
  expect,
  mock,
  spyOn,
  test,
} from "bun:test"
import { eq } from "drizzle-orm"

import { user } from "~/modules/auth/auth.tables"
import { db } from "~/shared/db/client"
import { transaction } from "~/shared/db/tx"
import { clock } from "~/shared/time/clock"

import { resetDb } from "../../../tests/helpers"
import { recordAudit } from "./audit.service"
import { auditLog } from "./audit.tables"

beforeEach(resetDb)
// The clock spy of one test must not reach the next test or file.
afterEach(() => mock.restore())

describe("audit log table", () => {
  test("keeps an admin's rows with no admin when that account is deleted", async () => {
    await db.insert(auditLog).values({
      id: "au-1",
      adminId: "u-admin",
      action: "listing.approve",
      targetType: "listing",
      targetId: "l00001",
      createdAt: new Date(),
    })
    await db.delete(user).where(eq(user.id, "u-admin"))
    const [row] = await db.select({ admin: auditLog.adminId }).from(auditLog)
    expect(row).toEqual({ admin: null })
  })
})

describe("recordAudit", () => {
  const entry = {
    action: "listing.reject",
    targetType: "listing",
    targetId: "l00001",
    before: { moderation: "pending" },
    after: { moderation: "rejected" },
    reason: "Blurry photos",
  }
  const adminRow = () =>
    db
      .select()
      .from(user)
      .where(eq(user.id, "u-admin"))
      .then(([row]) => row)

  test("writes who, what, why, from where and when", async () => {
    const at = new Date("2026-11-01T10:00:00Z")
    spyOn(clock, "now").mockReturnValue(at)
    const admin = await adminRow()
    if (!admin) throw new Error("no seeded admin")
    await recordAudit(db, { admin, ip: "203.0.113.7" }, entry)
    const [row] = await db.select().from(auditLog)
    expect(row).toMatchObject({
      ...entry,
      adminId: "u-admin",
      ip: "203.0.113.7",
      createdAt: at,
    })
    expect(row?.id).toMatch(/^au-[0-9a-z]{8}$/)
  })

  test("is undone with the transaction that made the change", async () => {
    const admin = await adminRow()
    if (!admin) throw new Error("no seeded admin")
    const failed = transaction(async (tx) => {
      await recordAudit(tx, { admin, ip: "203.0.113.7" }, entry)
      throw new Error("the change failed")
    })
    expect(failed).rejects.toThrow("the change failed")
    await failed.catch(() => undefined)
    expect(await db.$count(auditLog)).toBe(0)
  })
})
