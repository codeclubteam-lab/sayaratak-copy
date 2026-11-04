import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test"
import { eq } from "drizzle-orm"

import { db } from "~/shared/db/client"
import { clock } from "~/shared/time/clock"

import { DEMO_IDS, resetDb } from "../../../tests/helpers"
import { failOnCall } from "../../../tests/jobs"
import * as accounts from "./auth.accounts.queries"
import { deleteUnfinishedSignUps } from "./auth.cleanup.service"
import { account, user } from "./auth.tables"

const NOW = new Date("2026-11-03T10:00:00Z")
const HOUR_MS = 3_600_000
let counter = 0

beforeEach(async () => {
  await resetDb()
  spyOn(clock, "now").mockReturnValue(NOW)
})
afterEach(() => {
  spyOn(clock, "now").mockRestore()
})

/** A sign-up `hoursOld` hours old, copied from a seeded person; `provider` is how it can sign in. */
async function signUp(options: {
  hoursOld: number
  verified?: boolean
  provider?: string
}) {
  counter += 1
  const [base] = await db.select().from(user).where(eq(user.id, DEMO_IDS.user))
  if (!base) throw new Error("the seed has a person")
  const createdAt = new Date(NOW.getTime() - options.hoursOld * HOUR_MS)
  const id = `u-sign${counter}`
  await db.insert(user).values({
    ...base,
    id,
    email: `sign${counter}@mail.sd`,
    phone: null,
    emailVerified: options.verified ?? false,
    createdAt,
    updatedAt: createdAt,
  })
  await db.insert(account).values({
    id: `acc-sign${counter}`,
    accountId: id,
    providerId: options.provider ?? "credential",
    userId: id,
    createdAt,
    updatedAt: createdAt,
  })
  return id
}
const exists = async (id: string) =>
  (await db.select().from(user).where(eq(user.id, id))).length === 1

describe("deleteUnfinishedSignUps (unverified-cleanup job)", () => {
  test("deletes a sign-up older than a day that never verified its email, with its login", async () => {
    const stale = await signUp({ hoursOld: 25 })
    expect(await deleteUnfinishedSignUps()).toBe(1)
    expect(await exists(stale)).toBe(false)
    expect(
      await db.select().from(account).where(eq(account.userId, stale))
    ).toEqual([])
  })

  test("keeps a young sign-up, a verified one and one that signs in with Google", async () => {
    const young = await signUp({ hoursOld: 23 })
    const verified = await signUp({ hoursOld: 99, verified: true })
    const google = await signUp({ hoursOld: 99, provider: "google" })

    expect(await deleteUnfinishedSignUps()).toBe(0)

    for (const id of [young, verified, google])
      expect(await exists(id)).toBe(true)
    // The seeded people are untouched too.
    expect(await exists(DEMO_IDS.user)).toBe(true)
  })

  test("running it twice gives the same result", async () => {
    await signUp({ hoursOld: 30 })
    await signUp({ hoursOld: 40 })
    expect(await deleteUnfinishedSignUps()).toBe(2)
    expect(await deleteUnfinishedSignUps()).toBe(0)
  })

  test("a crash after the first batch is finished by the next run", async () => {
    const ids = [
      await signUp({ hoursOld: 30 }),
      await signUp({ hoursOld: 31 }),
      await signUp({ hoursOld: 32 }),
    ]
    const crash = failOnCall(accounts, "deleteUnfinishedSignUps", 2)

    await expect(deleteUnfinishedSignUps(2)).rejects.toThrow("crashed")
    expect((await Promise.all(ids.map(exists))).filter(Boolean)).toHaveLength(1)

    crash.mockRestore()
    expect(await deleteUnfinishedSignUps(2)).toBe(1)
  })
})
