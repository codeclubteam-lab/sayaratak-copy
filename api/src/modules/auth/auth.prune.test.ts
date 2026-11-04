import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test"

import { db } from "~/shared/db/client"
import { clock } from "~/shared/time/clock"

import { DEMO_IDS, resetDb } from "../../../tests/helpers"
import { failOnCall } from "../../../tests/jobs"
import * as queries from "./auth.cleanup.queries"
import { pruneExpired } from "./auth.cleanup.service"
import { loginFailures, rateLimit, session, verification } from "./auth.tables"

const NOW = new Date("2026-11-03T10:00:00Z")
const HOUR_MS = 3_600_000
const at = (hoursFromNow: number) =>
  new Date(NOW.getTime() + hoursFromNow * HOUR_MS)

beforeEach(async () => {
  await resetDb()
  await db.delete(session)
  spyOn(clock, "now").mockReturnValue(NOW)
})
afterEach(() => {
  spyOn(clock, "now").mockRestore()
})

async function seedRows(live: boolean) {
  // `live` rows are still needed, the others have run out.
  const offset = live ? 1 : -1
  const tag = live ? "live" : "dead"
  await db.insert(session).values({
    id: `s-${tag}`,
    token: `token-${tag}`,
    userId: DEMO_IDS.user,
    expiresAt: at(offset),
    createdAt: at(-48),
    updatedAt: at(-48),
  })
  await db.insert(verification).values({
    id: `v-${tag}`,
    identifier: `${tag}@mail.sd`,
    value: "x",
    expiresAt: at(offset),
    createdAt: at(-48),
    updatedAt: at(-48),
  })
  await db.insert(rateLimit).values({
    id: `r-${tag}`,
    key: `key-${tag}`,
    count: 1,
    lastRequest: at(live ? -1 : -30).getTime(),
  })
  await db.insert(loginFailures).values({
    email: `${tag}@mail.sd`,
    ip: "1.1.1.1",
    failedAt: at(live ? -1 : -30),
  })
}
const counts = async () => ({
  sessions: await db.$count(session),
  codes: await db.$count(verification),
  limits: await db.$count(rateLimit),
  failures: await db.$count(loginFailures),
})

describe("pruneExpired (prune job, sign-in leftovers)", () => {
  test("deletes what has run out and keeps what is still in use", async () => {
    await seedRows(true)
    await seedRows(false)
    const before = await counts()

    expect(await pruneExpired()).toBe(4)

    const after = await counts()
    expect(after.sessions).toBe(before.sessions - 1)
    expect(after.codes).toBe(before.codes - 1)
    expect(after.limits).toBe(before.limits - 1)
    expect(after.failures).toBe(before.failures - 1)
  })

  test("running it twice gives the same result", async () => {
    await seedRows(false)
    expect(await pruneExpired()).toBe(4)
    expect(await pruneExpired()).toBe(0)
  })

  test("a crash after the first batch is finished by the next run", async () => {
    for (let i = 0; i < 3; i++)
      await db.insert(session).values({
        id: `s-old${i}`,
        token: `token-old${i}`,
        userId: DEMO_IDS.user,
        expiresAt: at(-5),
        createdAt: at(-48),
        updatedAt: at(-48),
      })
    const crash = failOnCall(queries, "deleteExpiredSessions", 2)

    await expect(pruneExpired(2)).rejects.toThrow("crashed")
    expect(await db.$count(session)).toBe(1)

    crash.mockRestore()
    expect(await pruneExpired(2)).toBe(1)
    expect(await db.$count(session)).toBe(0)
  })
})
