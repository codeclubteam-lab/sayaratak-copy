import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test"

import { db } from "~/shared/db/client"
import { clock } from "~/shared/time/clock"

import { DEMO_IDS, resetDb } from "../../../tests/helpers"
import { failOnCall } from "../../../tests/jobs"
import * as queries from "./devices.queries"
import { pruneStale } from "./devices.service"
import { devices } from "./devices.tables"

const NOW = new Date("2026-11-03T10:00:00Z")
const DAY_MS = 86_400_000
let counter = 0

beforeEach(async () => {
  await resetDb()
  spyOn(clock, "now").mockReturnValue(NOW)
})
afterEach(() => {
  spyOn(clock, "now").mockRestore()
})

async function phone(daysSinceOpened: number) {
  counter += 1
  const seen = new Date(NOW.getTime() - daysSinceOpened * DAY_MS)
  await db.insert(devices).values({
    id: `dev-p${counter}`,
    userId: DEMO_IDS.user,
    platform: "android",
    fcmToken: `token-p${counter}`,
    appVersion: "1.0.0",
    locale: "en",
    lastSeenAt: seen,
    createdAt: seen,
  })
}

describe("pruneStale (prune job, old devices)", () => {
  test("deletes devices not opened for 90 days and keeps the others", async () => {
    await phone(91)
    await phone(89)
    expect(await pruneStale()).toBe(1)
    expect(await db.$count(devices)).toBe(1)
  })

  test("running it twice gives the same result", async () => {
    await phone(120)
    expect(await pruneStale()).toBe(1)
    expect(await pruneStale()).toBe(0)
  })

  test("a crash after the first batch is finished by the next run", async () => {
    for (let i = 0; i < 3; i++) await phone(100 + i)
    const crash = failOnCall(queries, "deleteStaleBatch", 2)

    await expect(pruneStale(2)).rejects.toThrow("crashed")
    expect(await db.$count(devices)).toBe(1)

    crash.mockRestore()
    expect(await pruneStale(2)).toBe(1)
  })
})
