import { beforeEach, describe, expect, it } from "bun:test"
import { eq } from "drizzle-orm"

import { db } from "~/shared/db/client"
import { flushMail, testInbox } from "~/shared/mail/send"

import { req, resetDb } from "../../../tests/helpers"
import { session, user, verification } from "./auth.tables"

const EMAIL = "sara@mail.sd"
const PASSWORD = "Sudan2026"
const WEB = {
  "content-type": "application/json",
  origin: "http://localhost:3000",
}

function post(path: string, body: object) {
  return req(path, { method: "POST", headers: WEB, body: JSON.stringify(body) })
}

function signUp() {
  return post("/auth/sign-up/email", {
    email: EMAIL,
    password: PASSWORD,
    name: "Sara Ali",
  })
}

function verify(otp: string) {
  return post("/auth/email-otp/verify-email", { email: EMAIL, otp })
}

async function lastCode() {
  await flushMail()
  const mail = testInbox.findLast((sent) => sent.to === EMAIL)
  if (!mail) throw new Error(`no mail to ${EMAIL}`)
  return mail.code
}

function sessionsOf(email: string) {
  return db
    .select({ id: session.id })
    .from(session)
    .innerJoin(user, eq(user.id, session.userId))
    .where(eq(user.email, email))
}

// A code that is not the one sent: the last digit moved by one.
function wrong(code: string) {
  return code.slice(0, 5) + ((Number(code[5]) + 1) % 10)
}

beforeEach(async () => {
  await resetDb()
  testInbox.length = 0
})

describe("Better-Auth sign-up with an email code", () => {
  it("sign-up sends a code and creates no session", async () => {
    const res = await signUp()

    expect(res.status).toBe(200)
    expect(res.headers.get("set-cookie") ?? "").not.toContain("session_token")
    expect(await lastCode()).toMatch(/^\d{6}$/)
    expect(testInbox).toMatchObject([
      { to: EMAIL, template: "email-verification" },
    ])
    expect(await sessionsOf(EMAIL)).toHaveLength(0)
  })

  it("the right code verifies the email and signs in", async () => {
    await signUp()
    const res = await verify(await lastCode())

    expect(res.status).toBe(200)
    expect(res.headers.get("set-cookie")).toContain("sy.session_token=")
    const [row] = await db.select().from(user).where(eq(user.email, EMAIL))
    expect(row?.emailVerified).toBe(true)
    expect(await sessionsOf(EMAIL)).toHaveLength(1)
  })

  it("sign-in before the code is entered is refused", async () => {
    await signUp()
    const res = await post("/auth/sign-in/email", {
      email: EMAIL,
      password: PASSWORD,
    })

    expect(res.status).toBe(403)
    expect(await res.json()).toMatchObject({ code: "EMAIL_NOT_VERIFIED" })
    expect(await sessionsOf(EMAIL)).toHaveLength(0)
  })

  it("five wrong codes kill the code", async () => {
    await signUp()
    const code = await lastCode()
    for (let i = 0; i < 5; i++) {
      expect((await verify(wrong(code))).status).toBe(400)
    }
    const res = await verify(code)

    expect(res.status).toBe(403)
    expect(await res.json()).toMatchObject({ code: "TOO_MANY_ATTEMPTS" })
  })

  it("a code that waited over 10 minutes is refused", async () => {
    await signUp()
    const code = await lastCode()
    await db
      .update(verification)
      .set({ expiresAt: new Date(Date.now() - 1000) })
    const res = await verify(code)

    expect(res.status).toBe(400)
    expect(await res.json()).toMatchObject({ code: "OTP_EXPIRED" })
  })

  it("asking again replaces the code", async () => {
    await signUp()
    const first = await lastCode()
    const resend = await post("/auth/email-otp/send-verification-otp", {
      email: EMAIL,
      type: "email-verification",
    })
    expect(resend.status).toBe(200)
    const second = await lastCode()

    expect(testInbox).toHaveLength(2)
    expect((await verify(first)).status).toBe(400)
    expect((await verify(second)).status).toBe(200)
  })

  it("a seeded demo account signs in with its password", async () => {
    const res = await post("/auth/sign-in/email", {
      email: "user@demo.sy",
      password: "Demo1234",
    })

    expect(res.status).toBe(200)
    expect(res.headers.get("set-cookie")).toContain("sy.session_token=")
  })
})
