import { beforeEach, describe, expect, it } from "bun:test"
import { eq } from "drizzle-orm"

import { db } from "~/shared/db/client"
import { flushMail, type Locale, testInbox } from "~/shared/mail/send"

import { req, resetDb } from "../../../tests/helpers"
import { user } from "./auth.tables"

const EMAIL = "locale@mail.sd"
const signup = { name: "Sara Ali", email: EMAIL, password: "Sudan2026" }

function post(path: string, body: object, language?: string) {
  return req(`/auth${path}`, {
    method: "POST",
    headers: {
      origin: "http://localhost:3000",
      "content-type": "application/json",
      ...(language ? { "accept-language": language } : {}),
    },
    body: JSON.stringify(body),
  })
}

beforeEach(async () => {
  await resetDb()
  testInbox.length = 0
})

describe("auth mail follows the requesting app locale", () => {
  const locales: Locale[] = ["en", "ar"]
  for (const locale of locales) {
    it(`persists ${locale} at signup and sends matching verification mail`, async () => {
      expect((await post("/sign-up/email", signup, locale)).status).toBe(200)
      await flushMail()
      const [saved] = await db.select().from(user).where(eq(user.email, EMAIL))
      expect(saved?.locale).toBe(locale)
      expect(testInbox.at(-1)?.locale).toBe(locale)
    })
  }

  it("uses English for a resend even when the saved preference is Arabic", async () => {
    await post("/sign-up/email", signup, "ar")
    const res = await post(
      "/email-otp/send-verification-otp",
      {
        email: EMAIL,
        type: "email-verification",
      },
      "en"
    )
    expect(res.status).toBe(200)
    await flushMail()
    expect(testInbox.at(-1)?.locale).toBe("en")
    const [saved] = await db.select().from(user).where(eq(user.email, EMAIL))
    expect(saved?.locale).toBe("ar")
  })

  it("keeps the saved preference when the request has no language", async () => {
    await post("/sign-up/email", signup, "en")
    await post("/email-otp/request-password-reset", { email: EMAIL })
    await flushMail()
    expect(testInbox.at(-1)?.locale).toBe("en")
  })
})
