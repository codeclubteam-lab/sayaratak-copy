import { afterEach, beforeEach, describe, expect, it, spyOn } from "bun:test"
import { userSchema } from "@sayaratak/shared/schemas/user"
import { eq } from "drizzle-orm"
import { Hono } from "hono"

import { db } from "~/shared/db/client"
import { onError } from "~/shared/http/errors"
import { clock } from "~/shared/time/clock"

import { expectSchema, req, resetDb, signIn } from "../../../tests/helpers"
import { requireRole, requireUser, session } from "./auth.middleware"
import { account, user } from "./auth.tables"

const HOUR_MS = 3600_000

// A router behind the real middleware, standing in for the user and role
// routes later phases add.
const guarded = new Hono()
  .onError(onError)
  .use(session)
  .get("/api/v1/mine", requireUser, (c) => c.json({ id: c.get("user").id }))
  .get("/api/v1/dealer-only", requireRole("dealership"), (c) =>
    c.json({ ok: true })
  )

function guardedGet(path: string, headers: Record<string, string> = {}) {
  return guarded.request(`/api/v1${path}`, { headers })
}

async function ban(id: string, until: Date | null) {
  await db
    .update(user)
    .set({ banned: true, banReason: "spam", banExpires: until })
    .where(eq(user.id, id))
}

beforeEach(resetDb)
afterEach(() => spyOn(clock, "now").mockRestore())

describe("GET /me", () => {
  it("is null when signed out", async () => {
    const res = await req("/me")
    expect(res.status).toBe(200)
    expect(await res.json()).toBeNull()
  })

  it("answers the signed-in account in userSchema", async () => {
    const { cookie } = await signIn("dealership")
    const me = await expectSchema(
      await req("/me", { headers: { cookie } }),
      userSchema
    )
    expect(me).toMatchObject({
      id: "u-dealer",
      role: "dealership",
      hasPassword: true,
    })
  })

  it("accepts the session as a bearer token, with no cookie or Origin", async () => {
    const { token } = await signIn("user")
    const res = await req("/me", {
      headers: { authorization: `Bearer ${token}` },
    })
    expect(await res.json()).toMatchObject({ id: "u-omar" })
  })

  it("says hasPassword false for an account with no password sign-in", async () => {
    const { cookie } = await signIn("user")
    await db
      .update(account)
      .set({ password: null })
      .where(eq(account.userId, "u-omar"))
    const me = await expectSchema(
      await req("/me", { headers: { cookie } }),
      userSchema
    )
    expect(me.hasPassword).toBe(false)
  })

  it("an unknown or signed-out session reads as null", async () => {
    const { cookie } = await signIn("user")
    const headers = { cookie, origin: "http://localhost:3000" }
    await req("/auth/sign-out", { method: "POST", headers })
    expect(await (await req("/me", { headers: { cookie } })).json()).toBeNull()
    const forged = await req("/me", {
      headers: { cookie: "sy.session_token=nope" },
    })
    expect(await forged.json()).toBeNull()
  })
})

describe("requireUser and requireRole", () => {
  it("signed out is 401 unauthenticated", async () => {
    const res = await guardedGet("/mine")
    expect(res.status).toBe(401)
    expect(await res.json()).toMatchObject({ code: "unauthenticated" })
  })

  it("puts the account on the context", async () => {
    const { cookie } = await signIn("user")
    expect(await (await guardedGet("/mine", { cookie })).json()).toEqual({
      id: "u-omar",
    })
  })

  it("the wrong role is 403 forbidden, the right one passes", async () => {
    const asUser = await signIn("user")
    const asDealer = await signIn("dealership")
    const refused = await guardedGet("/dealer-only", { cookie: asUser.cookie })
    expect(refused.status).toBe(403)
    expect(await refused.json()).toMatchObject({ code: "forbidden" })
    expect(
      (await guardedGet("/dealer-only", { cookie: asDealer.cookie })).status
    ).toBe(200)
  })

  it("a permanent ban is 403 banned, and /me shows the ban", async () => {
    const { cookie } = await signIn("user")
    await ban("u-omar", null)
    const res = await guardedGet("/mine", { cookie })
    expect(res.status).toBe(403)
    expect(await res.json()).toMatchObject({ code: "banned" })
    const me = await expectSchema(
      await req("/me", { headers: { cookie } }),
      userSchema
    )
    expect(me).toMatchObject({ banned: true, bannedReason: "spam" })
  })

  it("a timed ban holds until its end, one second before and lifts after", async () => {
    const { cookie } = await signIn("user")
    const end = new Date(Date.now() + HOUR_MS)
    await ban("u-omar", end)

    spyOn(clock, "now").mockReturnValue(new Date(end.getTime() - 1000))
    expect((await guardedGet("/mine", { cookie })).status).toBe(403)

    spyOn(clock, "now").mockReturnValue(end)
    expect((await guardedGet("/mine", { cookie })).status).toBe(200)
    const [row] = await db.select().from(user).where(eq(user.id, "u-omar"))
    expect(row).toMatchObject({
      banned: false,
      banReason: null,
      banExpires: null,
    })
  })
})
