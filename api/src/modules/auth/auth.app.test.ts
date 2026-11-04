import { beforeEach, describe, expect, it } from "bun:test"
import { userSchema } from "@sayaratak/shared/schemas/user"
import { eq } from "drizzle-orm"
import { hashPassword } from "better-auth/crypto"
import { Hono } from "hono"

import { db } from "~/shared/db/client"
import { ALL_PREFS } from "~/shared/db/defaults"
import { onError } from "~/shared/http/errors"
import { newId } from "~/shared/text/ids"

import { expectSchema, req, resetDb, signIn } from "../../../tests/helpers"
import { requireRole, session } from "./auth.middleware"
import { appleClientSecret } from "./auth.social.service"
import { account, user } from "./auth.tables"

const ONE_IP = "10.20.30.40"
const PASSWORD = "Phone1234"

// What an app sends: JSON, its platform headers, no cookie and no Origin (A18).
function appPost(path: string, body: object, ip = "10.0.0.1") {
  return req(`/auth${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-platform": "android",
      "x-app-version": "1.0.0",
      "x-forwarded-for": ip,
    },
    body: JSON.stringify(body),
  })
}

function bearer(token: string) {
  return { authorization: `Bearer ${token}` }
}

const guarded = new Hono()
  .onError(onError)
  .use(session)
  .get("/api/v1/admin/ping", requireRole("admin"), (c) => c.json({ ok: true }))

beforeEach(resetDb)

describe("app sign-in with a bearer token", () => {
  it("signs in and reads /me with only the token, no cookie or Origin", async () => {
    const res = await appPost("/sign-in/email", {
      email: "user@demo.sy",
      password: "Demo1234",
    })
    expect(res.status).toBe(200)
    const token = res.headers.get("set-auth-token") ?? ""
    const me = await expectSchema(
      await req("/me", { headers: bearer(token) }),
      userSchema
    )
    expect(me.id).toBe("u-omar")
  })

  it("answers 403 banned to a banned account's token", async () => {
    const { token } = await signIn("user")
    await db.update(user).set({ banned: true }).where(eq(user.id, "u-omar"))
    const res = await req("/me/notification-prefs", { headers: bearer(token) })
    expect(res.status).toBe(403)
    expect(await res.json()).toMatchObject({ code: "banned" })
  })

  it("refuses /admin/* to a bearer token, even an admin's", async () => {
    const { cookie, token } = await signIn("admin")
    const headers = { cookie }
    const web = await guarded.request("/api/v1/admin/ping", { headers })
    expect(web.status).toBe(200)
    const app = await guarded.request("/api/v1/admin/ping", {
      headers: bearer(token),
    })
    expect(app.status).toBe(403)
    expect(await app.json()).toMatchObject({ code: "forbidden" })
  })

  it("lets 50 accounts behind one carrier IP all sign in", async () => {
    const hash = await hashPassword(PASSWORD)
    const ids = Array.from({ length: 50 }, () => newId("u"))
    const createdAt = new Date()
    await db.insert(user).values(
      ids.map((id) => ({
        id,
        name: "Phone User",
        email: `${id}@mail.sd`,
        emailVerified: true,
        prefs: ALL_PREFS,
        createdAt,
      }))
    )
    await db.insert(account).values(
      ids.map((id) => ({
        id: newId("acc"),
        accountId: id,
        providerId: "credential",
        userId: id,
        password: hash,
        createdAt,
      }))
    )
    const answers = await Promise.all(
      ids.map((id) =>
        appPost(
          "/sign-in/email",
          { email: `${id}@mail.sd`, password: PASSWORD },
          ONE_IP
        )
      )
    )
    expect(answers.map((res) => res.status)).toEqual(ids.map(() => 200))
  })
})

describe("Apple client secret", () => {
  it("is an ES256 JWT Apple can check with the key", async () => {
    const key = await crypto.subtle.generateKey(
      { name: "ECDSA", namedCurve: "P-256" },
      true,
      ["sign", "verify"]
    )
    const pkcs8 = await crypto.subtle.exportKey("pkcs8", key.privateKey)
    const secret = await appleClientSecret({
      teamId: "TEAM",
      keyId: "KEY",
      clientId: "sd.web",
      privateKey: `-----BEGIN PRIVATE KEY-----\n${Buffer.from(pkcs8).toString("base64")}\n-----END PRIVATE KEY-----`,
    })
    const [header = "", payload = "", signature = ""] = secret.split(".")
    const claims = JSON.parse(Buffer.from(payload, "base64url").toString())
    expect(JSON.parse(Buffer.from(header, "base64url").toString())).toEqual({
      alg: "ES256",
      kid: "KEY",
    })
    expect(claims).toMatchObject({
      iss: "TEAM",
      sub: "sd.web",
      aud: "https://appleid.apple.com",
    })
    expect(claims.exp - claims.iat).toBe(180 * 24 * 3600)
    const valid = await crypto.subtle.verify(
      { name: "ECDSA", hash: "SHA-256" },
      key.publicKey,
      Buffer.from(signature, "base64url"),
      new TextEncoder().encode(`${header}.${payload}`)
    )
    expect(valid).toBe(true)
  })
})
