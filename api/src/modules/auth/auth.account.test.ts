import { beforeEach, describe, expect, it } from "bun:test"
import { userSchema } from "@sayaratak/shared/schemas/user"
import { eq } from "drizzle-orm"

import { db } from "~/shared/db/client"
import { flushMail, testInbox } from "~/shared/mail/send"

import {
  call,
  expectSchema,
  req,
  resetDb,
  type SignedIn,
  signIn,
} from "../../../tests/helpers"
import { user } from "./auth.tables"

const OMAR = "u-omar"

const patchMe = (as: SignedIn, body: object) =>
  call(as, "/me", { method: "PATCH", body })

async function errorOf(res: Response) {
  return { status: res.status, ...((await res.json()) as object) }
}

async function emailCodeFor(as: SignedIn, newEmail: string) {
  await call(as, "/auth/email-otp/request-email-change", {
    method: "POST",
    body: { newEmail },
  })
  await flushMail()
  const mail = testInbox.findLast((sent) => sent.to === newEmail)
  if (!mail) throw new Error(`no code to ${newEmail}`)
  return mail.code
}

beforeEach(async () => {
  await resetDb()
  testInbox.length = 0
})

describe("PATCH /me", () => {
  it("saves name, city, interests and language and answers the account", async () => {
    const omar = await signIn("user")
    const res = await patchMe(omar, {
      fullName: "Omar Hassan",
      cityId: "omdurman",
      interests: ["cars", "parts"],
      locale: "en",
    })
    expect(res.status).toBe(200)
    const me = await expectSchema(res, userSchema)
    expect(me).toMatchObject({
      fullName: "Omar Hassan",
      cityId: "omdurman",
      interests: ["cars", "parts"],
    })
  })

  it("returns 401 signed out", async () => {
    const res = await req("/me", { method: "PATCH", body: "{}" })
    expect(res.status).toBe(401)
  })

  it('returns 422 for a city that does not exist, and "" clears the city', async () => {
    const omar = await signIn("user")
    const bad = await patchMe(omar, { cityId: "c-nowhere" })
    expect(await errorOf(bad)).toMatchObject({
      status: 422,
      fields: { cityId: "validation.required" },
    })
    const cleared = await expectSchema(
      await patchMe(omar, { cityId: "" }),
      userSchema
    )
    expect(cleared.cityId).toBeUndefined()
  })

  it('saves a new phone without a code, not verified; "" removes it', async () => {
    const omar = await signIn("user")
    const saved = await expectSchema(
      await patchMe(omar, { phone: "+249912000111" }),
      userSchema
    )
    expect(saved).toMatchObject({
      phone: "+249912000111",
      verifiedPhone: false,
    })
    const removed = await expectSchema(
      await patchMe(omar, { phone: "" }),
      userSchema
    )
    expect(removed.phone).toBeUndefined()
  })

  it("returns 409 exists for a phone another account has", async () => {
    const [other] = await db
      .select({ phone: user.phone })
      .from(user)
      .where(eq(user.id, "u-dealer"))
    const omar = await signIn("user")
    const res = await patchMe(omar, { phone: other?.phone })
    expect(await errorOf(res)).toMatchObject({ status: 409, code: "exists" })
  })

  it("returns 422 contact_required when the email is cleared", async () => {
    const res = await patchMe(await signIn("user"), { email: "" })
    expect(await errorOf(res)).toMatchObject({
      status: 422,
      code: "contact_required",
    })
  })

  it("returns 409 exists for an email another account has, before any code", async () => {
    const res = await patchMe(await signIn("user"), { email: "dealer@demo.sy" })
    expect(await errorOf(res)).toMatchObject({ status: 409, code: "exists" })
  })

  it("returns 422 otp_invalid for a new email without its code or with a wrong one", async () => {
    const omar = await signIn("user")
    const none = await patchMe(omar, { email: "omar@mail.sd" })
    expect(await errorOf(none)).toMatchObject({
      status: 422,
      code: "otp_invalid",
      fields: { code: "auth.otp_invalid" },
    })
    const code = await emailCodeFor(omar, "omar@mail.sd")
    const wrong = String((Number(code) + 1) % 1_000_000).padStart(6, "0")
    const res = await patchMe(omar, { email: "omar@mail.sd", code: wrong })
    expect(await errorOf(res)).toMatchObject({
      status: 422,
      code: "otp_invalid",
    })
  })

  it("changes the email with the code sent to the new address", async () => {
    const omar = await signIn("user")
    const code = await emailCodeFor(omar, "omar@mail.sd")
    const res = await patchMe(omar, { email: "omar@mail.sd", code })
    const me = await expectSchema(res, userSchema)
    expect(me).toMatchObject({ email: "omar@mail.sd", verifiedEmail: true })
  })

  it('a Facebook account without an email sends "" and keeps its placeholder', async () => {
    const omar = await signIn("user")
    await db
      .update(user)
      .set({ email: "fb-1@facebook.invalid" })
      .where(eq(user.id, OMAR))
    const me = await expectSchema(
      await patchMe(omar, { email: "", fullName: "Omar" }),
      userSchema
    )
    expect(me.email).toBeUndefined()
  })

  it("returns 422 for a photo address that is not the user's upload", async () => {
    const res = await patchMe(await signIn("user"), {
      avatarUrl: "https://elsewhere.example/p.jpg",
    })
    expect(await errorOf(res)).toMatchObject({
      status: 422,
      fields: { avatarUrl: "validation.url" },
    })
  })
})
