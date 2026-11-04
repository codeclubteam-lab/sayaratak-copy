import { beforeEach, describe, expect, it } from "bun:test"

import { db } from "~/shared/db/client"
import { flushMail, testInbox } from "~/shared/mail/send"

import { req, resetDb } from "../../../tests/helpers"
import { rateLimit } from "./auth.tables"

const WEB = "http://localhost:3000"

function post(path: string, body: object, ip = "41.95.0.1") {
  return req(path, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: WEB,
      "x-forwarded-for": ip,
    },
    body: JSON.stringify(body),
  })
}

const forgot = (email: string, ip?: string) =>
  post("/auth/email-otp/request-password-reset", { email }, ip)

async function timed(send: () => Response | Promise<Response>) {
  const start = performance.now()
  const res = await send()
  return { res, ms: performance.now() - start }
}

function median(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.floor(sorted.length / 2)] ?? 0
}

beforeEach(async () => {
  await resetDb()
  await db.delete(rateLimit)
  testInbox.length = 0
})

describe("forgot password tells nothing about which emails exist", () => {
  it("answers the same body and status for a known and an unknown email, and mails only the known one", async () => {
    const known = await forgot("user@demo.sy")
    const unknown = await forgot("nobody@mail.sd")
    expect(unknown.status).toBe(known.status)
    expect(await unknown.json()).toEqual(await known.json())
    await flushMail()
    expect(testInbox.map((mail) => mail.to)).toEqual(["user@demo.sy"])
  })

  it("answers in the same time band for both", async () => {
    const knownMs: number[] = []
    const unknownMs: number[] = []
    for (let i = 0; i < 7; i++) {
      knownMs.push(
        (await timed(() => forgot("user@demo.sy", `10.1.0.${i}`))).ms
      )
      unknownMs.push(
        (await timed(() => forgot(`nobody${i}@mail.sd`, `10.2.0.${i}`))).ms
      )
    }
    // The mail is sent off the request (A6), so both sides do one lookup and
    // one write; a gap of tens of milliseconds would point at an await.
    expect(Math.abs(median(knownMs) - median(unknownMs))).toBeLessThan(25)
  })
})

describe("codes sent to one address", () => {
  it("stops after 5 an hour, quietly: the sixth request still answers ok", async () => {
    for (let i = 0; i < 6; i++) {
      const res = await forgot("user@demo.sy", `10.3.0.${i}`)
      expect(res.status).toBe(200)
    }
    await flushMail()
    expect(testInbox).toHaveLength(5)
  })
})

describe("per-IP ceilings", () => {
  it("returns 429 on the 21st sign-up from one IP in 10 minutes; another IP still signs up", async () => {
    for (let i = 0; i < 20; i++) {
      const res = await post("/auth/sign-up/email", {
        email: `bot${i}@mail.sd`,
        password: "Sudan2026",
        name: "Bot",
      })
      expect(res.status).toBe(200)
    }
    const blocked = await post("/auth/sign-up/email", {
      email: "bot21@mail.sd",
      password: "Sudan2026",
      name: "Bot",
    })
    expect(blocked.status).toBe(429)
    const other = await post(
      "/auth/sign-up/email",
      { email: "sara@mail.sd", password: "Sudan2026", name: "Sara" },
      "197.252.0.1"
    )
    expect(other.status).toBe(200)
  })
})
