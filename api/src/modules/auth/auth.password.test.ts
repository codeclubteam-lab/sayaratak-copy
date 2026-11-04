import { beforeEach, describe, expect, it } from "bun:test"
import { notificationPrefsSchema } from "@sayaratak/shared/schemas/api"
import { userSchema } from "@sayaratak/shared/schemas/user"
import { and, eq } from "drizzle-orm"

import { db } from "~/shared/db/client"

import {
  call,
  expectSchema,
  req,
  resetDb,
  signIn,
} from "../../../tests/helpers"
import { account, rateLimit } from "./auth.tables"

const OMAR = "u-omar"

async function errorOf(res: Response) {
  return { status: res.status, ...((await res.json()) as object) }
}

beforeEach(resetDb)

describe("POST /me/password", () => {
  it("returns 401 invalid_credentials for a wrong current password", async () => {
    const res = await call(await signIn("user"), "/me/password", {
      method: "POST",
      body: { currentPassword: "Wrong1234", newPassword: "Sudan2026" },
    })
    expect(await errorOf(res)).toMatchObject({
      status: 401,
      code: "invalid_credentials",
    })
  })

  it("returns 422 for a password without a digit", async () => {
    const res = await call(await signIn("user"), "/me/password", {
      method: "POST",
      body: { currentPassword: "Demo1234", newPassword: "onlyletters" },
    })
    expect(res.status).toBe(422)
  })

  it("changes it, signs out the other sessions and keeps this one", async () => {
    const other = await signIn("user")
    const omar = await signIn("user")
    const res = await call(omar, "/me/password", {
      method: "POST",
      body: { currentPassword: "Demo1234", newPassword: "Sudan2026" },
    })
    expect(res.status).toBe(200)
    const fresh = res.headers
      .getSetCookie()
      .map((line) => line.split(";")[0] ?? "")
      .find((pair) => pair.includes("session_token="))
    const meNow = await req("/me", { headers: { cookie: fresh ?? "" } })
    expect(((await meNow.json()) as { id: string }).id).toBe(OMAR)
    const meOther = await req("/me", { headers: { cookie: other.cookie } })
    expect(await meOther.json()).toBeNull()
    await db.delete(rateLimit)
    const signInNew = await req("/auth/sign-in/email", {
      method: "POST",
      headers: { "content-type": "application/json", origin: omar.origin },
      body: JSON.stringify({ email: "user@demo.sy", password: "Sudan2026" }),
    })
    expect(signInNew.status).toBe(200)
  })

  it("sets a first password for an account made with Google or Facebook", async () => {
    const omar = await signIn("user")
    await db
      .delete(account)
      .where(
        and(eq(account.userId, OMAR), eq(account.providerId, "credential"))
      )
    const res = await call(omar, "/me/password", {
      method: "POST",
      body: { newPassword: "Sudan2026" },
    })
    expect(res.status).toBe(200)
    const me = await expectSchema(
      await req("/me", { headers: { cookie: omar.cookie } }),
      userSchema
    )
    expect(me.hasPassword).toBe(true)
  })
})

describe("notification prefs", () => {
  it("PATCH changes only the switches sent, GET reads them back", async () => {
    const omar = await signIn("user")
    const before = await expectSchema(
      await call(omar, "/me/notification-prefs", { method: "GET" }),
      notificationPrefsSchema
    )
    const patched = await expectSchema(
      await call(omar, "/me/notification-prefs", {
        method: "PATCH",
        body: { messages: false },
      }),
      notificationPrefsSchema
    )
    expect(patched).toEqual({ ...before, messages: false })
    const after = await call(omar, "/me/notification-prefs", { method: "GET" })
    expect(await after.json()).toEqual(patched)
  })

  it("returns 401 signed out", async () => {
    expect((await req("/me/notification-prefs")).status).toBe(401)
  })
})
