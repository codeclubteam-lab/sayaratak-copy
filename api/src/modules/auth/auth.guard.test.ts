import { beforeEach, describe, expect, it } from "bun:test"
import { eq } from "drizzle-orm"

import { db } from "~/shared/db/client"
import { flushMail, testInbox } from "~/shared/mail/send"

import { req, resetDb } from "../../../tests/helpers"
import { account, rateLimit, user } from "./auth.tables"

const WEB = "http://localhost:3000"
const OMAR = "user@demo.sy"
const RIGHT = "Demo1234"

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

const signInAs = (password: string, ip?: string) =>
  post("/auth/sign-in/email", { email: OMAR, password }, ip)

async function failTimes(count: number, ip?: (i: number) => string) {
  for (let i = 0; i < count; i++) await signInAs("Wrong1234", ip?.(i))
}

beforeEach(async () => {
  await resetDb()
  await db.delete(rateLimit)
  testInbox.length = 0
})

describe("sign-in throttle", () => {
  it("returns 429 too_many_attempts with retryAfter after 5 failures from one IP, even with the right password", async () => {
    await failTimes(5)
    const res = await signInAs(RIGHT)
    expect(res.status).toBe(429)
    const body = (await res.json()) as { code: string; retryAfter: number }
    expect(body.code).toBe("too_many_attempts")
    expect(body.retryAfter).toBeGreaterThan(0)
    expect(body.retryAfter).toBeLessThanOrEqual(600)
    expect(res.headers.get("retry-after")).toBe(String(body.retryAfter))
  })

  it("an attacker's failures elsewhere do not lock the owner out", async () => {
    await failTimes(5, () => "6.6.6.6")
    expect((await signInAs(RIGHT, "41.95.0.1")).status).toBe(200)
  })

  it("20 failures from many IPs in an hour close the email from every IP", async () => {
    await failTimes(20, (i) => `6.6.6.${i}`)
    expect((await signInAs(RIGHT, "41.95.0.9")).status).toBe(429)
  })

  it("a successful sign-in starts the count again", async () => {
    await failTimes(4)
    expect((await signInAs(RIGHT)).status).toBe(200)
    await failTimes(4)
    expect((await signInAs(RIGHT)).status).toBe(200)
  })

  it("a password reset starts the count again", async () => {
    await failTimes(5)
    await post("/auth/email-otp/request-password-reset", { email: OMAR })
    await flushMail()
    const code = testInbox.findLast((mail) => mail.to === OMAR)?.code
    const reset = await post("/auth/email-otp/reset-password", {
      email: OMAR,
      otp: code,
      password: "Sudan2026",
    })
    expect(reset.status).toBe(200)
    expect((await signInAs("Sudan2026")).status).toBe(200)
  })
})

describe("password rules (shared passwordSchema)", () => {
  it("sign-up refuses a password without a digit with the web form's key", async () => {
    const res = await post("/auth/sign-up/email", {
      email: "sara@mail.sd",
      password: "onlyletters",
      name: "Sara",
    })
    expect(res.status).toBe(422)
    expect(await res.json()).toMatchObject({
      code: "validation",
      fields: { password: "validation.password_digit" },
    })
  })

  it("reset refuses a password without a letter", async () => {
    const res = await post("/auth/email-otp/reset-password", {
      email: OMAR,
      otp: "000000",
      password: "12345678",
    })
    expect(await res.json()).toMatchObject({
      fields: { password: "validation.password_letter" },
    })
  })
})

describe("sign-up for an email that has an account", () => {
  it("returns 409 exists for a verified account", async () => {
    const res = await post("/auth/sign-up/email", {
      email: OMAR,
      password: "Sudan2026",
      name: "Someone",
    })
    expect(res.status).toBe(409)
    expect(await res.json()).toMatchObject({ code: "exists" })
  })

  it("returns 409 exists for an unverified account with a Google login", async () => {
    await db
      .update(user)
      .set({ emailVerified: false })
      .where(eq(user.email, OMAR))
    await db.insert(account).values({
      id: "acc-google",
      accountId: "g-1",
      providerId: "google",
      userId: "u-omar",
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    const res = await post("/auth/sign-up/email", {
      email: OMAR,
      password: "Sudan2026",
      name: "Someone",
    })
    expect(res.status).toBe(409)
  })

  it("signing up again before verifying sends a new code and the new password works", async () => {
    const email = "sara@mail.sd"
    await post("/auth/sign-up/email", {
      email,
      password: "First2026",
      name: "Sara",
    })
    const again = await post("/auth/sign-up/email", {
      email,
      password: "Second2026",
      name: "Sara Ali",
    })
    expect(again.status).toBe(200)
    await flushMail()
    const code = testInbox.findLast((mail) => mail.to === email)?.code
    expect(testInbox.filter((mail) => mail.to === email)).toHaveLength(2)
    await post("/auth/email-otp/verify-email", { email, otp: code })
    expect(
      (await post("/auth/sign-in/email", { email, password: "Second2026" }))
        .status
    ).toBe(200)
  })
})
