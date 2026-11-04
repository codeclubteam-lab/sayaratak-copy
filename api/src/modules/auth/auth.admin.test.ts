import { afterEach, beforeEach, describe, expect, it, spyOn } from "bun:test"
import { eq } from "drizzle-orm"
import { Hono } from "hono"

import { db } from "~/shared/db/client"
import { onError } from "~/shared/http/errors"
import { flushMail, testInbox } from "~/shared/mail/send"
import { outbox } from "~/shared/mail/outbox.tables"
import { clock } from "~/shared/time/clock"

import {
  authPost,
  cookieOf,
  lastAdminCode,
  resetDb,
  signIn,
} from "../../../tests/helpers"
import { requireRole, session } from "./auth.middleware"

const ADMIN = "admin@demo.sy"
const PASSWORD = "Demo1234"
const TEN_MINUTES_MS = 10 * 60_000

// Stands in for the /admin/* routes of Phase 7, behind the real middleware.
const guarded = new Hono()
  .onError(onError)
  .use(session)
  .get("/api/v1/admin/ping", requireRole("admin"), (c) => c.json({ ok: true }))

function adminPing(headers: Record<string, string>) {
  return guarded.request("/api/v1/admin/ping", { headers })
}

// The admin's password step: Better-Auth's answer and its challenge cookie.
async function password() {
  const res = await authPost("/sign-in/email", {
    email: ADMIN,
    password: PASSWORD,
  })
  return { res, challenge: cookieOf(res, "two_factor=") ?? "" }
}

async function sendCode(challenge: string) {
  await authPost("/two-factor/send-otp", {}, challenge)
  return (await lastAdminCode(ADMIN)) ?? ""
}

function enterCode(challenge: string, code: string, trustDevice?: boolean) {
  return authPost("/two-factor/verify-otp", { code, trustDevice }, challenge)
}

beforeEach(async () => {
  await resetDb()
  testInbox.length = 0
})
afterEach(() => spyOn(clock, "now").mockRestore())

describe("admin second step", () => {
  it("answers 'code needed' to the password, with no session", async () => {
    const { res, challenge } = await password()
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({
      twoFactorRedirect: true,
      twoFactorMethods: ["otp"],
    })
    // Better-Auth only expires the cookie: no session value is set.
    expect(cookieOf(res, "session_token=")).toBe("sy.session_token=")
    expect(challenge).toContain("two_factor=")
  })

  it("mails the code through the outbox", async () => {
    const { challenge } = await password()
    expect(await sendCode(challenge)).toMatch(/^\d{6}$/)
    const rows = await db.select().from(outbox).where(eq(outbox.to, ADMIN))
    expect(rows.map((row) => row.template)).toEqual(["admin-code"])
  })

  it("gives admin access after the right code", async () => {
    const { challenge } = await password()
    const res = await enterCode(challenge, await sendCode(challenge))
    expect(res.status).toBe(200)
    const cookie = cookieOf(res, "session_token=") ?? ""
    expect((await adminPing({ cookie })).status).toBe(200)
  })

  it("refuses /admin/* to an admin session that skipped the code", async () => {
    // Email-code sign-in makes a session without the second step.
    await authPost("/email-otp/send-verification-otp", {
      email: ADMIN,
      type: "sign-in",
    })
    await flushMail()
    const otp = testInbox.findLast((mail) => mail.template === "sign-in")?.code
    const res = await authPost("/sign-in/email-otp", { email: ADMIN, otp })
    expect(res.status).toBe(200)
    const cookie = cookieOf(res, "session_token=") ?? ""
    const ping = await adminPing({ cookie })
    expect(ping.status).toBe(403)
    expect(await ping.json()).toMatchObject({ code: "forbidden" })
  })

  it("locks the email and IP for 10 minutes after 5 wrong codes", async () => {
    const { challenge } = await password()
    const code = await sendCode(challenge)
    const wrong = code === "000000" ? "111111" : "000000"
    for (let i = 0; i < 5; i++)
      expect((await enterCode(challenge, wrong)).status).toBe(401)
    const locked = await enterCode(challenge, code)
    expect(locked.status).toBe(429)
    expect(await locked.json()).toMatchObject({ code: "too_many_attempts" })
    // The password step is closed too, so a new code cannot be asked for.
    expect((await password()).res.status).toBe(429)
    const later = new Date(Date.now() + TEN_MINUTES_MS + 1000)
    spyOn(clock, "now").mockReturnValue(later)
    expect((await password()).res.status).toBe(200)
  })

  it("offers no trusted device to admins", async () => {
    const { challenge } = await password()
    const res = await enterCode(challenge, await sendCode(challenge), true)
    expect(res.status).toBe(403)
    expect(cookieOf(res, "trust_device=")).toBeUndefined()
  })

  it("keeps two-factor switches off the HTTP API", async () => {
    const { cookie, origin } = await signIn("user")
    const res = await authPost(
      "/two-factor/enable",
      { password: PASSWORD },
      cookie
    )
    expect(res.status).toBe(404)
    expect(origin).toBe("http://localhost:3000")
  })

  it("never asks a non-admin for a code", async () => {
    const res = await authPost("/sign-in/email", {
      email: "dealer@demo.sy",
      password: PASSWORD,
    })
    expect(res.status).toBe(200)
    expect(await res.json()).not.toHaveProperty("twoFactorRedirect")
    expect(cookieOf(res, "session_token=")).toBeDefined()
    await flushMail()
    expect(testInbox).toEqual([])
  })
})
