import { afterEach, beforeEach, describe, expect, it, spyOn } from "bun:test"
import { eq } from "drizzle-orm"

import { db } from "~/shared/db/client"
import { clock } from "~/shared/time/clock"

import { emptyDb } from "../../../tests/helpers"
import { outbox } from "./outbox.tables"
import { deliver, flushMail, send, testInbox } from "./send"

const TO = "huda@mail.sd"

beforeEach(async () => {
  await emptyDb()
  testInbox.length = 0
})
afterEach(() => {
  spyOn(testInbox, "push").mockRestore()
  spyOn(clock, "now").mockRestore()
})

async function onlyRow() {
  const rows = await db.select().from(outbox)
  expect(rows).toHaveLength(1)
  const [row] = rows
  if (!row) throw new Error("no outbox row")
  return row
}

describe("send (A9)", () => {
  it("writes an outbox row, delivers it and drops the code", async () => {
    send.otp({
      to: TO,
      code: "482913",
      purpose: "forget-password",
      locale: "en",
    })
    await flushMail()

    expect(testInbox).toMatchObject([{ to: TO, code: "482913", locale: "en" }])
    const row = await onlyRow()
    expect(row.sentAt).toBeInstanceOf(Date)
    expect(row.payload).toEqual({})
    expect(row.template).toBe("forget-password")
  })

  it("Arabic mail has an RTL root, English an LTR one, both carry the code", async () => {
    send.otp({
      to: TO,
      code: "111222",
      purpose: "email-verification",
      locale: "ar",
    })
    send.otp({
      to: TO,
      code: "333444",
      purpose: "email-verification",
      locale: "en",
    })
    await flushMail()

    const ar = testInbox.find((mail) => mail.locale === "ar")
    const en = testInbox.find((mail) => mail.locale === "en")
    expect(ar?.html).toContain('<html lang="ar" dir="rtl">')
    expect(ar?.subject).toContain("سيارتك")
    expect(ar?.text).toContain("111222")
    expect(en?.html).toContain('<html lang="en" dir="ltr">')
    expect(en?.subject).toBe("Your Sayaratak verification code")
    expect(en?.html).toContain("333444")
  })

  it("the admin code takes the language of the user row", async () => {
    send.adminCode({ email: TO, locale: "en" }, "909090")
    send.adminCode({ email: "b@mail.sd", locale: null }, "808080")
    await flushMail()

    const sent = testInbox.map((mail) => [
      mail.code,
      mail.template,
      mail.locale,
    ])
    // Deliveries run side by side, so the inbox order is not the call order.
    expect(sent.sort()).toEqual([
      ["808080", "admin-code", "ar"],
      ["909090", "admin-code", "en"],
    ])
  })

  it("a failed send keeps the code and waits 1, then 2 minutes", async () => {
    const at = new Date("2026-11-01T10:00:00Z")
    spyOn(clock, "now").mockReturnValue(at)
    spyOn(testInbox, "push").mockImplementation(() => {
      throw new Error("smtp down")
    })
    send.otp({ to: TO, code: "555666", purpose: "sign-in", locale: "ar" })
    await flushMail()

    const failed = await onlyRow()
    expect(failed).toMatchObject({
      attempts: 1,
      sentAt: null,
      payload: { code: "555666" },
    })
    expect(failed.sendAfter.getTime() - at.getTime()).toBe(60_000)
    expect(failed.lastError).toContain("smtp down")

    await deliver(failed)
    const again = await onlyRow()
    expect(again.attempts).toBe(2)
    expect(again.sendAfter.getTime() - at.getTime()).toBe(120_000)
  })

  it("the retry sends a failed row and clears it", async () => {
    spyOn(testInbox, "push").mockImplementationOnce(() => {
      throw new Error("smtp down")
    })
    send.otp({ to: TO, code: "777888", purpose: "sign-in", locale: "ar" })
    await flushMail()
    spyOn(testInbox, "push").mockRestore()

    await deliver(await onlyRow())
    const [row] = await db.select().from(outbox).where(eq(outbox.to, TO))
    expect(row?.sentAt).toBeInstanceOf(Date)
    expect(row?.payload).toEqual({})
    expect(testInbox.at(-1)?.code).toBe("777888")
  })
})
