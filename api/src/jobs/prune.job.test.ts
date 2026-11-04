import { afterEach, beforeEach, expect, spyOn, test } from "bun:test"

import { session } from "~/modules/auth/auth.tables"
import { events } from "~/modules/analytics/analytics.tables"
import { db } from "~/shared/db/client"
import { clock } from "~/shared/time/clock"

import { DEMO_IDS, resetDb } from "../../tests/helpers"
import { pruneJob } from "./prune.job"

const NOW = new Date("2026-11-03T10:00:00Z")

beforeEach(async () => {
  await resetDb()
  spyOn(clock, "now").mockReturnValue(NOW)
})
afterEach(() => {
  spyOn(clock, "now").mockRestore()
})

test("the prune job runs every cleanup in turn and a second run finds nothing", async () => {
  await db.insert(session).values({
    id: "s-old",
    token: "token-old",
    userId: DEMO_IDS.user,
    expiresAt: new Date(NOW.getTime() - 3_600_000),
    createdAt: NOW,
    updatedAt: NOW,
  })
  await db
    .insert(events)
    .values({ targetId: "l1", day: "2025-01-01", type: "view", count: 2 })

  expect(await pruneJob.run()).toBeGreaterThanOrEqual(2)
  expect(await pruneJob.run()).toBe(0)
})
