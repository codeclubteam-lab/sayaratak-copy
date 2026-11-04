import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test"
import { eq } from "drizzle-orm"

import { db } from "~/shared/db/client"
import { clock } from "~/shared/time/clock"

import { DEMO_IDS, resetDb } from "../../../tests/helpers"
import { failOnCall } from "../../../tests/jobs"
import * as accounts from "./auth.accounts.queries"
import { liftExpiredBans } from "./auth.service"
import { user } from "./auth.tables"

const NOW = new Date("2026-11-02T10:00:00Z")
const HOUR_MS = 3_600_000

beforeEach(resetDb)
afterEach(() => {
  spyOn(clock, "now").mockRestore()
})

const ban = (id: string, banExpires: Date | null) =>
  db
    .update(user)
    .set({ banned: true, banReason: "spam", banExpires })
    .where(eq(user.id, id))
const rowOf = (id: string) =>
  db
    .select()
    .from(user)
    .where(eq(user.id, id))
    .then(([row]) => row)

describe("liftExpiredBans (ban-lift job)", () => {
  test("clears a timed ban that is over and leaves the rest alone", async () => {
    spyOn(clock, "now").mockReturnValue(NOW)
    await ban(DEMO_IDS.user, new Date(NOW.getTime() - HOUR_MS))
    await ban(DEMO_IDS.dealership, new Date(NOW.getTime() + HOUR_MS))
    await ban(DEMO_IDS.workshop, null)

    expect(await liftExpiredBans()).toBe(1)

    expect(await rowOf(DEMO_IDS.user)).toMatchObject({
      banned: false,
      banReason: null,
      banExpires: null,
    })
    expect(await rowOf(DEMO_IDS.dealership)).toMatchObject({ banned: true })
    // A permanent ban never ends by itself.
    expect(await rowOf(DEMO_IDS.workshop)).toMatchObject({ banned: true })
  })

  test("running it twice gives the same result", async () => {
    spyOn(clock, "now").mockReturnValue(NOW)
    await ban(DEMO_IDS.user, new Date(NOW.getTime() - HOUR_MS))
    expect(await liftExpiredBans()).toBe(1)
    const snapshot = await db.select().from(user)
    expect(await liftExpiredBans()).toBe(0)
    expect(await db.select().from(user)).toEqual(snapshot)
  })

  test("a crash after the first batch is finished by the next run", async () => {
    spyOn(clock, "now").mockReturnValue(NOW)
    const ids = [DEMO_IDS.user, DEMO_IDS.dealership, DEMO_IDS.workshop]
    for (const id of ids) await ban(id, new Date(NOW.getTime() - HOUR_MS))
    const crash = failOnCall(accounts, "updateBansLifted", 2)

    await expect(liftExpiredBans(2)).rejects.toThrow("crashed")
    const after = await Promise.all(ids.map(rowOf))
    expect(after.filter((row) => row?.banned)).toHaveLength(1)

    crash.mockRestore()
    expect(await liftExpiredBans(2)).toBe(1)
    const done = await Promise.all(ids.map(rowOf))
    expect(done.some((row) => row?.banned)).toBe(false)
  })
})
