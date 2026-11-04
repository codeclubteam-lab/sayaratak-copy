import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test"
import { eq } from "drizzle-orm"

import { db } from "~/shared/db/client"
import { clock } from "~/shared/time/clock"

import { resetDb } from "../../../tests/helpers"
import { failOnCall } from "../../../tests/jobs"
import * as expiry from "./promotions.expiry.queries"
import { endExpired } from "./promotions.service"
import { promotions } from "./promotions.tables"

const DAY_MS = 86_400_000

beforeEach(resetDb)
afterEach(() => {
  spyOn(clock, "now").mockRestore()
  spyOn(expiry, "updateEndedBatch").mockRestore()
})

const statuses = async () =>
  (await db.select().from(promotions)).map((row) => row.status)
const running = async () =>
  (await db.select().from(promotions).where(eq(promotions.status, "active")))
    .length

describe("endExpired (promotion-end job)", () => {
  test("ends only the running promotions whose end has passed", async () => {
    const before = await running()
    expect(before).toBeGreaterThan(2)
    expect(await endExpired()).toBe(0)

    const unpaid = (await statuses()).filter((s) => s === "pending_payment")
    spyOn(clock, "now").mockReturnValue(new Date(Date.now() + 400 * DAY_MS))
    expect(await endExpired()).toBe(before)
    expect(await running()).toBe(0)
    // An order that never ran is not touched.
    expect((await statuses()).filter((s) => s === "pending_payment")).toEqual(
      unpaid
    )
  })

  test("running it twice gives the same result", async () => {
    spyOn(clock, "now").mockReturnValue(new Date(Date.now() + 400 * DAY_MS))
    const first = await endExpired()
    const snapshot = await db.select().from(promotions)
    expect(first).toBeGreaterThan(0)
    expect(await endExpired()).toBe(0)
    expect(await db.select().from(promotions)).toEqual(snapshot)
  })

  test("a crash after the first batch is finished by the next run", async () => {
    const before = await running()
    expect(before).toBeGreaterThan(2)
    spyOn(clock, "now").mockReturnValue(new Date(Date.now() + 400 * DAY_MS))
    const crash = failOnCall(expiry, "updateEndedBatch", 2)

    await expect(endExpired(2)).rejects.toThrow("crashed")
    // The first batch was committed on its own.
    expect(await running()).toBe(before - 2)

    crash.mockRestore()
    expect(await endExpired(2)).toBe(before - 2)
    expect(await running()).toBe(0)
  })
})
