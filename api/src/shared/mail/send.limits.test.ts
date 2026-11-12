import { afterEach, beforeEach, expect, spyOn, test } from "bun:test"
import { eq } from "drizzle-orm"

import { db } from "~/shared/db/client"
import { clock } from "~/shared/time/clock"

import { emptyDb } from "../../../tests/helpers"
import { outbox } from "./outbox.tables"
import { flushMail, send, testInbox } from "./send"

const TO = "cap-concurrency@example.test"
const OTHER = "cap-other@example.test"
const HOUR_MS = 3_600_000

beforeEach(async () => {
  await flushMail()
  await emptyDb()
  testInbox.length = 0
})
afterEach(async () => {
  await flushMail()
  spyOn(clock, "now").mockRestore()
  spyOn(testInbox, "push").mockRestore()
})

function queue(to = TO) {
  return send.otp({
    to,
    code: "123456",
    purpose: "forget-password",
    locale: "en",
  })
}

test("a concurrent burst reserves only five codes per recipient without blocking other recipients", async () => {
  const burst = 20
  for (let i = 0; i < burst; i++) expect(queue()).toBeUndefined()
  queue(OTHER)
  await flushMail()
  expect(testInbox.filter((mail) => mail.to === TO)).toHaveLength(5)
  expect(testInbox.filter((mail) => mail.to === OTHER)).toHaveLength(1)
  expect(await db.select().from(outbox).where(eq(outbox.to, TO))).toHaveLength(
    5
  )
  expect(
    await db.select().from(outbox).where(eq(outbox.to, OTHER))
  ).toHaveLength(1)
})

test("failed deliveries still reserve the five-code allowance", async () => {
  spyOn(testInbox, "push").mockImplementation(() => {
    throw new Error("fake SMTP unavailable")
  })
  for (let i = 0; i < 10; i++) queue()
  await flushMail()
  const rows = await db.select().from(outbox).where(eq(outbox.to, TO))
  expect(rows).toHaveLength(5)
  expect(rows.every((row) => row.sentAt === null && row.attempts === 1)).toBe(
    true
  )
})

test("the allowance reopens after the existing hourly window", async () => {
  const start = new Date("2026-11-12T10:00:00Z")
  const now = spyOn(clock, "now").mockReturnValue(start)
  for (let i = 0; i < 6; i++) queue()
  await flushMail()
  expect(testInbox).toHaveLength(5)
  now.mockReturnValue(new Date(start.getTime() + HOUR_MS + 1))
  queue()
  await flushMail()
  expect(testInbox).toHaveLength(6)
})
