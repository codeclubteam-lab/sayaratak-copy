import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test"

import { db } from "~/shared/db/client"
import { clock } from "~/shared/time/clock"

import { resetDb } from "../../../tests/helpers"
import { pruneKeys } from "./idempotency.prune"
import { idempotencyKeys } from "./idempotency.tables"

const NOW = new Date("2026-11-03T10:00:00Z")
const HOUR_MS = 3_600_000

beforeEach(async () => {
  await resetDb()
  spyOn(clock, "now").mockReturnValue(NOW)
})
afterEach(() => {
  spyOn(clock, "now").mockRestore()
})

const key = (name: string, hoursOld: number) =>
  db.insert(idempotencyKeys).values({
    owner: "user:u-1",
    key: name,
    method: "POST",
    path: "/payments",
    requestHash: "h",
    status: 200,
    createdAt: new Date(NOW.getTime() - hoursOld * HOUR_MS),
  })

describe("pruneKeys (prune job, idempotency keys)", () => {
  test("deletes keys older than 24 hours and keeps younger ones", async () => {
    await key("old", 25)
    await key("young", 23)
    expect(await pruneKeys()).toBe(1)
    expect(
      (await db.select().from(idempotencyKeys)).map((row) => row.key)
    ).toEqual(["young"])
  })

  test("running it twice gives the same result", async () => {
    await key("a", 30)
    await key("b", 40)
    expect(await pruneKeys()).toBe(2)
    expect(await pruneKeys()).toBe(0)
  })

  test("works in batches", async () => {
    for (const name of ["a", "b", "c"]) await key(name, 30)
    expect(await pruneKeys(2)).toBe(3)
  })
})
