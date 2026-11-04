import { beforeEach, describe, expect, test } from "bun:test"
import { eq } from "drizzle-orm"

import { user } from "~/modules/auth/auth.tables"
import { uploads } from "~/modules/uploads/uploads.tables"
import { db } from "~/shared/db/client"

import { buildSeed, resetDb } from "../../../tests/helpers"
import { payments } from "./payments.tables"

const seeded = buildSeed()
const pending = seeded.payments.find((p) => p.status === "pending_review")
if (!pending) throw new Error("the mock seeds payments under review")

beforeEach(resetDb)

describe("payment table", () => {
  test("holds every mock payment with its receipt as a private upload", async () => {
    expect(await db.$count(payments)).toBe(seeded.payments.length)
    const [row] = await db
      .select({ delivery: uploads.delivery, kind: uploads.kind })
      .from(payments)
      .innerJoin(uploads, eq(uploads.id, payments.receiptUploadId))
      .where(eq(payments.id, pending.id))
    expect(row).toEqual({ delivery: "private", kind: "receipt" })
  })

  test("allows one receipt under review per item, and a new one after a rejection", async () => {
    const again = {
      ...pending,
      id: "pay-x",
      receiptUploadId: `receipt-${seeded.payments.length}`,
      createdAt: new Date(),
      reviewedAt: null,
    }
    const error = await db
      .insert(payments)
      .values(again)
      .catch((error) => error)
    expect(error.cause.constraint).toBe("payments_one_pending")
    await db
      .update(payments)
      .set({ status: "rejected" })
      .where(eq(payments.id, pending.id))
    await db.insert(payments).values(again)
  })

  test("keeps a deleted account's payments as records", async () => {
    await db.delete(user).where(eq(user.id, pending.userId))
    expect(await db.$count(payments, eq(payments.id, pending.id))).toBe(1)
  })
})
