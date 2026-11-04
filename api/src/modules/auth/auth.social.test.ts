import { afterEach, beforeEach, describe, expect, it, spyOn } from "bun:test"
import { userSchema } from "@sayaratak/shared/schemas/user"
import { eq } from "drizzle-orm"

import { db } from "~/shared/db/client"
import { flushMail, testInbox } from "~/shared/mail/send"

import { expectSchema, req, resetDb } from "../../../tests/helpers"
import { account, user } from "./auth.tables"

const WEB = "http://localhost:3000"
const CALLBACK = `${WEB}/ar`

type Profile = {
  id: string
  name: string
  email?: string
  emailVerified?: boolean
}

// An unsigned JWT: Better-Auth decodes Google's id token from the token
// response it fetched itself, without checking a signature.
function idToken(claims: object) {
  const part = (value: object) =>
    Buffer.from(JSON.stringify(value)).toString("base64url")
  return `${part({ alg: "none" })}.${part(claims)}.`
}

function googleAnswer(profile: Profile) {
  return {
    access_token: "google-access",
    token_type: "Bearer",
    expires_in: 3600,
    id_token: idToken({
      sub: profile.id,
      name: profile.name,
      email: profile.email,
      email_verified: profile.emailVerified ?? true,
    }),
  }
}

function facebookAnswer(profile: Profile, path: string) {
  if (path.endsWith("/oauth/access_token"))
    return { access_token: "fb-access", token_type: "bearer" }
  if (path === "/debug_token")
    return {
      data: { is_valid: true, app_id: "test-facebook-id", user_id: profile.id },
    }
  return {
    id: profile.id,
    name: profile.name,
    email: profile.email,
    picture: { data: { url: "https://example.com/p.jpg" } },
  }
}

/** Answers Google's and Facebook's server calls as the real providers would. */
function stubProvider(profile: Profile) {
  const real = globalThis.fetch
  const fake = async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(input instanceof Request ? input.url : String(input))
    if (url.host === "oauth2.googleapis.com")
      return Response.json(googleAnswer(profile))
    if (url.host === "graph.facebook.com")
      return Response.json(facebookAnswer(profile, url.pathname))
    return real(input, init)
  }
  return spyOn(globalThis, "fetch").mockImplementation(
    Object.assign(fake, { preconnect: real.preconnect })
  )
}

/** The whole redirect dance: start, come back to the callback, read /me. */
async function socialSignIn(provider: "google" | "facebook") {
  const start = await req("/auth/sign-in/social", {
    method: "POST",
    headers: { "content-type": "application/json", origin: WEB },
    body: JSON.stringify({ provider, callbackURL: CALLBACK }),
  })
  expect(start.status).toBe(200)
  const { url } = (await start.json()) as { url: string }
  const state = new URL(url).searchParams.get("state") ?? ""
  const stateCookie = start.headers
    .getSetCookie()
    .map((line) => line.split(";")[0])
    .join("; ")
  const back = await req(
    `/auth/callback/${provider}?code=provider-code&state=${state}`,
    { headers: { cookie: stateCookie } }
  )
  const cookie = back.headers
    .getSetCookie()
    .map((line) => line.split(";")[0] ?? "")
    .find((pair) => pair.includes("session_token="))
  return { back, cookie }
}

async function me(cookie: string | undefined) {
  const res = await req("/me", { headers: { cookie: cookie ?? "" } })
  return expectSchema(res, userSchema.nullable())
}

let stub: ReturnType<typeof stubProvider> | undefined
beforeEach(async () => {
  await resetDb()
  testInbox.length = 0
})
afterEach(() => stub?.mockRestore())

describe("social sign-in (stubbed provider)", () => {
  it("Google, first time: a new user account, onboarding not done, back to the web", async () => {
    stub = stubProvider({
      id: "g-1",
      name: "Huda Osman",
      email: "huda@gmail.com",
    })
    const { back, cookie } = await socialSignIn("google")
    expect(back.status).toBe(302)
    expect(back.headers.get("location")).toBe(CALLBACK)
    const account = await me(cookie)
    expect(account).toMatchObject({
      role: "user",
      fullName: "Huda Osman",
      email: "huda@gmail.com",
      verifiedEmail: true,
      hasPassword: false,
      onboardingDone: false,
      interests: [],
    })
  })

  it("Google with a verified email links to the existing account", async () => {
    stub = stubProvider({ id: "g-2", name: "Omar", email: "user@demo.sy" })
    const { cookie } = await socialSignIn("google")
    const account = await me(cookie)
    expect(account?.id).toBe("u-omar")
    expect(account?.hasPassword).toBe(true)
  })

  it("an unverified provider email never takes over an existing account", async () => {
    stub = stubProvider({
      id: "g-3",
      name: "Someone",
      email: "user@demo.sy",
      emailVerified: false,
    })
    const { back, cookie } = await socialSignIn("google")
    expect(cookie).toBeUndefined()
    expect(back.headers.get("location")).toContain("error=")
    const links = await db
      .select()
      .from(account)
      .where(eq(account.userId, "u-omar"))
    expect(links.map((row) => row.providerId)).toEqual(["credential"])
  })

  it("the second sign-in with the same Google account finds the same user", async () => {
    stub = stubProvider({ id: "g-4", name: "Huda", email: "huda@gmail.com" })
    const first = await me((await socialSignIn("google")).cookie)
    const second = await me((await socialSignIn("google")).cookie)
    expect(second?.id).toBe(first?.id ?? "")
  })

  it("Facebook with an email signs in", async () => {
    stub = stubProvider({ id: "fb-1", name: "Amna", email: "amna@mail.sd" })
    const account = await me((await socialSignIn("facebook")).cookie)
    expect(account).toMatchObject({ email: "amna@mail.sd", role: "user" })
  })

  it("Facebook with no email: placeholder kept, left out of /me, a reset code is never mailed", async () => {
    stub = stubProvider({ id: "778899", name: "Musa Adam" })
    const account = await me((await socialSignIn("facebook")).cookie)
    expect(account).toMatchObject({
      fullName: "Musa Adam",
      verifiedEmail: false,
    })
    expect(account?.email).toBeUndefined()
    const [row] = await db
      .select({ email: user.email })
      .from(user)
      .where(eq(user.id, account?.id ?? ""))
    expect(row?.email).toBe("fb-778899@facebook.invalid")
    await req("/auth/email-otp/request-password-reset", {
      method: "POST",
      headers: { "content-type": "application/json", origin: WEB },
      body: JSON.stringify({ email: "fb-778899@facebook.invalid" }),
    })
    await flushMail()
    expect(testInbox).toHaveLength(0)
  })

  it("a banned account gets no session", async () => {
    await db.update(user).set({ banned: true }).where(eq(user.id, "u-omar"))
    stub = stubProvider({ id: "g-5", name: "Omar", email: "user@demo.sy" })
    const { back, cookie } = await socialSignIn("google")
    expect(cookie).toBeUndefined()
    expect(back.headers.get("location")).toContain("banned")
  })
})
