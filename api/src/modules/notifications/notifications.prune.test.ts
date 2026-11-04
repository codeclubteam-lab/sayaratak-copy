import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test"
import { eq } from "drizzle-orm"

import { db } from "~/shared/db/client"
import { MAX_ATTEMPTS } from "~/shared/mail/backoff"
import { outbox } from "~/shared/mail/outbox.tables"
import { clock } from "~/shared/time/clock"

import { DEMO_IDS, resetDb } from "../../../tests/helpers"
import { failOnCall } from "../../../tests/jobs"
import * as queries from "./notifications.cleanup.queries"
import { pruneRead } from "./notifications.cleanup.service"
import { pruneOutbox } from "./notifications.outbox.service"
import { notifications } from "./notifications.tables"

const NOW = new Date("2026-11-03T10:00:00Z")
const DAY_MS = 86_400_000
const ago = (days: number) => new Date(NOW.getTime() - days * DAY_MS)
let counter = 0

beforeEach(async () => {
  await resetDb()
  await db.delete(notifications)
  await db.delete(outbox)
  spyOn(clock, "now").mockReturnValue(NOW)
})
afterEach(() => {
  spyOn(clock, "now").mockRestore()
})

async function bell(options: { days: number; read: boolean }) {
  counter += 1
  await db.insert(notifications).values({
    id: `n-p${counter}`,
    userId: DEMO_IDS.user,
    type: "message",
    title: { ar: "x", en: "x" },
    body: { ar: "x", en: "x" },
    createdAt: ago(options.days),
    readAt: options.read ? ago(options.days - 1) : null,
  })
  return `n-p${counter}`
}
const bellExists = async (id: string) =>
  (await db.select().from(notifications).where(eq(notifications.id, id)))
    .length === 1

async function mail(options: {
  days: number
  sent: boolean
  attempts?: number
}) {
  counter += 1
  await db.insert(outbox).values({
    id: `out-p${counter}`,
    channel: "email",
    to: "a@mail.sd",
    template: "sign-in",
    locale: "en",
    payload: {},
    attempts: options.attempts ?? 0,
    sendAfter: ago(options.days),
    sentAt: options.sent ? ago(options.days) : null,
    createdAt: ago(options.days),
  })
  return `out-p${counter}`
}
const mailExists = async (id: string) =>
  (await db.select().from(outbox).where(eq(outbox.id, id))).length === 1

describe("pruneRead (prune job, read notifications)", () => {
  test("deletes read notifications older than six months and never an unread one", async () => {
    const oldRead = await bell({ days: 200, read: true })
    const oldUnread = await bell({ days: 400, read: false })
    const recentRead = await bell({ days: 100, read: true })

    expect(await pruneRead()).toBe(1)

    expect(await bellExists(oldRead)).toBe(false)
    expect(await bellExists(oldUnread)).toBe(true)
    expect(await bellExists(recentRead)).toBe(true)
  })

  test("running it twice gives the same result", async () => {
    await bell({ days: 200, read: true })
    await bell({ days: 300, read: true })
    expect(await pruneRead()).toBe(2)
    expect(await pruneRead()).toBe(0)
  })

  test("a crash after the first batch is finished by the next run", async () => {
    for (let i = 0; i < 3; i++) await bell({ days: 200 + i, read: true })
    const crash = failOnCall(queries, "deleteReadBatch", 2)

    await expect(pruneRead(2)).rejects.toThrow("crashed")
    expect(await db.$count(notifications)).toBe(1)

    crash.mockRestore()
    expect(await pruneRead(2)).toBe(1)
  })
})

describe("pruneOutbox (prune job, mail and push rows)", () => {
  test("deletes rows sent or given up more than a week ago, and keeps the rest", async () => {
    const sentOld = await mail({ days: 8, sent: true })
    const sentRecent = await mail({ days: 3, sent: true })
    const givenUpOld = await mail({
      days: 9,
      sent: false,
      attempts: MAX_ATTEMPTS,
    })
    const waitingOld = await mail({ days: 9, sent: false, attempts: 1 })
    const givenUpRecent = await mail({
      days: 2,
      sent: false,
      attempts: MAX_ATTEMPTS,
    })

    expect(await pruneOutbox()).toBe(2)

    expect(await mailExists(sentOld)).toBe(false)
    expect(await mailExists(givenUpOld)).toBe(false)
    for (const id of [sentRecent, waitingOld, givenUpRecent])
      expect(await mailExists(id)).toBe(true)
  })

  test("running it twice gives the same result", async () => {
    await mail({ days: 8, sent: true })
    expect(await pruneOutbox()).toBe(1)
    expect(await pruneOutbox()).toBe(0)
  })
})
