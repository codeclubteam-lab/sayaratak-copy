import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test"
import { asc, eq } from "drizzle-orm"

import { devices } from "~/modules/devices/devices.tables"
import { db } from "~/shared/db/client"
import { MAX_ATTEMPTS } from "~/shared/mail/backoff"
import * as queries from "~/shared/mail/outbox.queries"
import { type NewOutboxRow, outbox } from "~/shared/mail/outbox.tables"
import { testInbox } from "~/shared/mail/send"
import { testPushes } from "~/shared/push/send"
import { clock } from "~/shared/time/clock"

import { DEMO_IDS, resetDb } from "../../../tests/helpers"
import { failOnCall } from "../../../tests/jobs"
import { sendDue } from "./notifications.outbox.service"

const NOW = new Date("2026-11-02T10:00:00Z")
const MINUTE_MS = 60_000

beforeEach(async () => {
  await resetDb()
  testInbox.length = 0
  testPushes.length = 0
  spyOn(clock, "now").mockReturnValue(NOW)
})
afterEach(() => {
  spyOn(clock, "now").mockRestore()
})

let counter = 0
/** An unsent verification mail that was written `age` minutes ago and failed `attempts` times. */
async function mail(row: Partial<NewOutboxRow> & { age?: number } = {}) {
  counter += 1
  const { age = 5, ...rest } = row
  const createdAt = new Date(NOW.getTime() - age * MINUTE_MS)
  const values: NewOutboxRow = {
    id: `out-t${counter}`,
    channel: "email",
    to: `person${counter}@mail.sd`,
    template: "sign-in",
    locale: "en",
    payload: { code: String(100_000 + counter) },
    sendAfter: createdAt,
    createdAt,
    ...rest,
  }
  await db.insert(outbox).values(values)
  return values.id
}
const rowOf = (id: string) =>
  db
    .select()
    .from(outbox)
    .where(eq(outbox.id, id))
    .then(([row]) => row)

describe("sendDue (outbox job)", () => {
  test("sends a due mail, empties its code and leaves a new row to its request", async () => {
    const old = await mail({ age: 3 })
    const fresh = await mail({ age: 0 })

    expect(await sendDue()).toBe(1)

    expect(testInbox).toHaveLength(1)
    expect(await rowOf(old)).toMatchObject({ payload: {} })
    expect((await rowOf(old))?.sentAt).toBeInstanceOf(Date)
    expect((await rowOf(fresh))?.sentAt).toBeNull()
  })

  test("retries a failed mail when its wait is over, not before", async () => {
    const waiting = await mail({
      attempts: 1,
      sendAfter: new Date(NOW.getTime() + MINUTE_MS),
    })
    const due = await mail({
      attempts: 1,
      sendAfter: new Date(NOW.getTime() - MINUTE_MS),
    })

    expect(await sendDue()).toBe(1)

    expect((await rowOf(waiting))?.sentAt).toBeNull()
    expect((await rowOf(due))?.sentAt).toBeInstanceOf(Date)
  })

  test("gives a mail up after its last attempt", async () => {
    const spent = await mail({ attempts: MAX_ATTEMPTS, age: 6 })
    expect(await sendDue()).toBe(0)
    expect(testInbox).toHaveLength(0)
    expect((await rowOf(spent))?.sentAt).toBeNull()
  })

  test("a failing send is kept with a wait, and the pass still finishes", async () => {
    const id = await mail({ age: 3, payload: { code: "424242" } })
    const push = spyOn(testInbox, "push").mockImplementation(() => {
      throw new Error("smtp down")
    })
    try {
      expect(await sendDue()).toBe(1)
    } finally {
      push.mockRestore()
    }
    const row = await rowOf(id)
    expect(row).toMatchObject({ attempts: 1, payload: { code: "424242" } })
    expect(row?.sendAfter.getTime()).toBe(NOW.getTime() + MINUTE_MS)
  })

  test("a row with an unknown template fails like a send instead of stopping the job", async () => {
    const odd = await mail({ template: "no-such-template" })
    const good = await mail()
    expect(await sendDue()).toBe(2)
    expect((await rowOf(odd))?.attempts).toBe(1)
    expect((await rowOf(good))?.sentAt).toBeInstanceOf(Date)
  })

  test("empties the code of a mail older than the code lasts and gives it up", async () => {
    const stale = await mail({ age: 11 })
    const live = await mail({ age: 9, attempts: 1 })
    const liveTo = (await rowOf(live))?.to ?? ""

    await sendDue()

    expect(await rowOf(stale)).toMatchObject({
      payload: {},
      attempts: MAX_ATTEMPTS,
      lastError: "code_expired",
      sentAt: null,
    })
    expect(testInbox.map((sent) => sent.to)).toEqual([liveTo])
    expect((await rowOf(live))?.sentAt).toBeInstanceOf(Date)
  })

  test("sends a push to the device and closes the row", async () => {
    await db.insert(devices).values({
      id: "dev-t1",
      userId: DEMO_IDS.user,
      platform: "android",
      fcmToken: "token-t1",
      appVersion: "1.0.0",
      locale: "en",
      lastSeenAt: NOW,
      createdAt: NOW,
    })
    const id = await mail({
      channel: "push",
      to: "dev-t1",
      template: "message",
      payload: {
        push: { userId: DEMO_IDS.user, title: "Hi", body: "Hello", data: {} },
      },
      attempts: 1,
    })

    expect(await sendDue()).toBe(1)

    expect(testPushes.map((push) => push.token)).toEqual(["token-t1"])
    expect((await rowOf(id))?.sentAt).toBeInstanceOf(Date)
  })

  test("running it twice sends each mail once", async () => {
    await mail({ age: 3 })
    await mail({ age: 4 })
    expect(await sendDue()).toBe(2)
    const snapshot = await db.select().from(outbox).orderBy(asc(outbox.id))
    expect(await sendDue()).toBe(0)
    expect(testInbox).toHaveLength(2)
    expect(await db.select().from(outbox).orderBy(asc(outbox.id))).toEqual(
      snapshot
    )
  })

  test("a crash after the first batch is finished by the next run", async () => {
    for (let i = 0; i < 5; i++) await mail({ age: 3 })
    const crash = failOnCall(queries, "listDue", 2)

    await expect(sendDue(2)).rejects.toThrow("crashed")
    expect(testInbox).toHaveLength(2)

    crash.mockRestore()
    expect(await sendDue(2)).toBe(3)
    // Nothing went out twice.
    expect(new Set(testInbox.map((sent) => sent.to)).size).toBe(5)
    expect(testInbox).toHaveLength(5)
  })
})
