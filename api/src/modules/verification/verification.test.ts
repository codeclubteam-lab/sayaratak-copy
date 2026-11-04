import { beforeEach, describe, expect, test } from "bun:test"
import { asc, eq } from "drizzle-orm"

import { uploads } from "~/modules/uploads/uploads.tables"
import { db } from "~/shared/db/client"

import { buildSeed, resetDb } from "../../../tests/helpers"
import {
  verificationDocuments,
  verificationRequests,
} from "./verification.tables"

const seeded = buildSeed()
const pending = seeded.verifications.find((v) => v.status === "pending")

beforeEach(resetDb)

describe("verification tables", () => {
  test("hold every request with its documents as private uploads", async () => {
    expect(await db.$count(verificationRequests)).toBe(
      seeded.verifications.length
    )
    const docs = await db
      .select({ id: verificationDocuments.id, delivery: uploads.delivery })
      .from(verificationDocuments)
      .innerJoin(uploads, eq(uploads.id, verificationDocuments.uploadId))
      .where(eq(verificationDocuments.requestId, pending?.id ?? ""))
      .orderBy(asc(verificationDocuments.position))
    expect(docs).toEqual(
      pending?.documents.map((d) => ({ id: d.id, delivery: "private" })) ?? []
    )
  })

  test("allow one open request per business", async () => {
    const again = {
      id: "vr-x",
      targetType: pending?.targetType ?? "dealership",
      targetId: pending?.targetId ?? "",
      ownerId: pending?.ownerId ?? "",
      createdAt: new Date(),
    }
    const error = await db
      .insert(verificationRequests)
      .values(again)
      .catch((error) => error)
    expect(error.cause.constraint).toBe("verification_requests_one_pending")
    await db
      .update(verificationRequests)
      .set({ status: "rejected" })
      .where(eq(verificationRequests.id, pending?.id ?? ""))
    await db.insert(verificationRequests).values(again)
  })
})
