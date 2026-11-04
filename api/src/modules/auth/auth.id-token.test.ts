import { afterEach, beforeEach, describe, expect, it, spyOn } from "bun:test"
import { userSchema } from "@sayaratak/shared/schemas/user"

import { expectSchema, req, resetDb } from "../../../tests/helpers"

// What an app sends: JSON, its platform headers, no cookie and no Origin (A18).
function appPost(path: string, body: object) {
  return req(`/auth${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-platform": "ios",
      "x-app-version": "1.0.0",
    },
    body: JSON.stringify(body),
  })
}

// One RS256 key standing in for Google's and Apple's signing keys.
const issuer = await crypto.subtle.generateKey(
  {
    name: "RSASSA-PKCS1-v1_5",
    modulusLength: 2048,
    publicExponent: new Uint8Array([1, 0, 1]),
    hash: "SHA-256",
  },
  true,
  ["sign", "verify"]
)
const jwk = {
  ...(await crypto.subtle.exportKey("jwk", issuer.publicKey)),
  kid: "test-kid",
  alg: "RS256",
  use: "sig",
}

const b64 = (value: object) =>
  Buffer.from(JSON.stringify(value)).toString("base64url")

async function idToken(claims: object) {
  const now = Math.floor(Date.now() / 1000)
  const unsigned = `${b64({ alg: "RS256", kid: "test-kid", typ: "JWT" })}.${b64({ iat: now, exp: now + 600, ...claims })}`
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    issuer.privateKey,
    new TextEncoder().encode(unsigned)
  )
  return `${unsigned}.${Buffer.from(signature).toString("base64url")}`
}

const facebookToken = {
  data: { is_valid: true, app_id: "test-facebook-id", user_id: "fb-9" },
}
const facebookMe = {
  id: "fb-9",
  name: "Fatima Facebook",
  email: "fatima@mail.sd",
  picture: { data: { url: "https://example.com/p.jpg" } },
}

// The provider calls Better-Auth makes, by URL without the query.
function providerAnswer(url: URL) {
  const keys = { keys: [jwk] }
  const answers: Record<string, object> = {
    "https://www.googleapis.com/oauth2/v3/certs": keys,
    "https://appleid.apple.com/auth/keys": keys,
    "https://graph.facebook.com/debug_token": facebookToken,
    "https://graph.facebook.com/me": facebookMe,
  }
  return answers[`${url.origin}${url.pathname}`]
}

/** Answers the providers' key and Graph calls as the real ones would. */
function stubProviders() {
  const real = globalThis.fetch
  const fake = async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(input instanceof Request ? input.url : String(input))
    const answer = providerAnswer(url)
    return answer ? Response.json(answer) : real(input, init)
  }
  return spyOn(globalThis, "fetch").mockImplementation(
    Object.assign(fake, { preconnect: real.preconnect })
  )
}

async function signedInMe(res: Response) {
  expect(res.status).toBe(200)
  const token = res.headers.get("set-auth-token") ?? ""
  return expectSchema(
    await req("/me", { headers: { authorization: `Bearer ${token}` } }),
    userSchema
  )
}

beforeEach(resetDb)
afterEach(() => spyOn(globalThis, "fetch").mockRestore())

describe("native ID-token sign-in", () => {
  it("accepts a Google ID token", async () => {
    stubProviders()
    const token = await idToken({
      iss: "https://accounts.google.com",
      aud: "test-google-id",
      sub: "g-1",
      email: "gamal@gmail.com",
      email_verified: true,
      name: "Gamal Google",
    })
    const res = await appPost("/sign-in/social", {
      provider: "google",
      idToken: { token },
    })
    expect(await signedInMe(res)).toMatchObject({ email: "gamal@gmail.com" })
  })

  it("refuses a Google ID token made for another app", async () => {
    stubProviders()
    const token = await idToken({
      iss: "https://accounts.google.com",
      aud: "someone-else",
      sub: "g-1",
      email: "gamal@gmail.com",
    })
    const res = await appPost("/sign-in/social", {
      provider: "google",
      idToken: { token },
    })
    expect(res.status).toBe(401)
  })

  it("accepts an Apple ID token for the app's bundle id", async () => {
    stubProviders()
    const token = await idToken({
      iss: "https://appleid.apple.com",
      aud: "test.apple.app",
      sub: "apple-1",
      email: "amna@privaterelay.appleid.com",
      email_verified: "true",
    })
    const res = await appPost("/sign-in/social", {
      provider: "apple",
      idToken: { token, user: { name: { firstName: "Amna", lastName: "A" } } },
    })
    expect(await signedInMe(res)).toMatchObject({
      email: "amna@privaterelay.appleid.com",
      fullName: "Amna A",
    })
  })

  it("accepts a Facebook access token checked with debug_token", async () => {
    stubProviders()
    const res = await appPost("/sign-in/social", {
      provider: "facebook",
      idToken: { token: "fb-access", accessToken: "fb-access" },
    })
    expect(await signedInMe(res)).toMatchObject({ email: "fatima@mail.sd" })
  })
})
