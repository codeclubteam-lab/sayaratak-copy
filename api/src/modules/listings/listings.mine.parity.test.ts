import { beforeAll, describe, test } from "bun:test"
import { and, asc, eq } from "drizzle-orm"

import { db } from "~/shared/db/client"

import { bothSessions, DEMO_IDS, resetDb } from "../../../tests/helpers"
import { expectParity } from "../../../tests/parity"
import { listings } from "./listings.tables"

beforeAll(resetDb)

const mine = async (
  query: string,
  as: "user" | "dealership" | "workshop" = "dealership"
) =>
  expectParity(`/api/v1/me/listings?${query}`, {
    init: { headers: await bothSessions(as) },
  })

describe("GET /me/listings matches the mock", () => {
  test("every tab, and the default", async () => {
    await mine("")
    for (const tab of [
      "all",
      "active",
      "pending",
      "rejected",
      "drafts",
      "closed",
      "expired",
    ])
      await mine(`tab=${tab}`)
    await mine("tab=active", "user")
  })

  test("filters and needs attention", async () => {
    await mine("type=car&intent=sale")
    await mine("type=part", "user")
    await mine("moderation=approved&status=reserved")
    await mine("status=nonsense")
    await mine("q=toyota", "user")
    await mine(`q=${encodeURIComponent("تويوتا")}`, "user")
    await mine("needsAttention=true")
    await mine("needsAttention=true", "user")
  })

  test("sorts both ways, pages, the CSV size and a rail limit", async () => {
    for (const sort of ["price", "views", "expires", "created"])
      for (const dir of ["asc", "desc"]) await mine(`sort=${sort}&dir=${dir}`)
    await mine("page=2&pageSize=5")
    await mine("page=99")
    await mine("pageSize=500")
    await mine("pageSize=9999")
    await mine("limit=3")
  })

  test("the expired tab, with one listing expired on both sides", async () => {
    // The seed has none expired; the same change goes to the mock's own rows.
    const { db: mockDb } = await import("../../../../web/src/mocks/db")
    const [row] = await db
      .select()
      .from(listings)
      .where(
        and(
          eq(listings.ownerUserId, DEMO_IDS.dealership),
          eq(listings.moderation, "approved")
        )
      )
      .orderBy(asc(listings.id))
      .limit(1)
    const mockRow = mockDb.listings.find((l) => l.id === row?.id)
    if (!row || !mockRow) throw new Error("no approved dealership listing")
    const past = new Date(Date.now() - 86_400_000)
    await db
      .update(listings)
      .set({ expiresAt: past })
      .where(eq(listings.id, row.id))
    // The mock's rows live for the whole test run, so the change is undone.
    const kept = mockRow.expiresAt
    mockRow.expiresAt = past.toISOString()
    try {
      await mine("tab=expired")
      await mine("tab=active")
      await mine("needsAttention=true")
    } finally {
      mockRow.expiresAt = kept
    }
  })

  test("a workshop account is refused as the mock refuses it", async () => {
    await mine("", "workshop")
  })
})
