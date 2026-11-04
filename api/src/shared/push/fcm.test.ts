import { afterEach, beforeAll, describe, expect, test } from "bun:test"

import { createFcm } from "./fcm"

const realFetch = globalThis.fetch
const message = { token: "tok", title: "Hi", body: "There", data: { id: "n1" } }
let account = ""
let publicKey: CryptoKey
let calls: { url: string; init: RequestInit }[] = []
let answers: Response[] = []

// The answers below are the shapes the real service sent on 2026-11-01.
const tokenAnswer = () =>
  Response.json({ access_token: "ya29.token", expires_in: 3600 })
const unregistered = () =>
  Response.json(
    {
      error: {
        code: 404,
        message: "NotRegistered",
        status: "NOT_FOUND",
        details: [
          {
            "@type": "type.googleapis.com/google.firebase.fcm.v1.FcmError",
            errorCode: "UNREGISTERED",
          },
        ],
      },
    },
    { status: 404 }
  )
const invalid = (field: string) =>
  Response.json(
    {
      error: {
        code: 400,
        status: "INVALID_ARGUMENT",
        details: [
          { errorCode: "INVALID_ARGUMENT" },
          { fieldViolations: [{ field, description: "bad" }] },
        ],
      },
    },
    { status: 400 }
  )

beforeAll(async () => {
  const pair = await crypto.subtle.generateKey(
    {
      name: "RSASSA-PKCS1-v1_5",
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: "SHA-256",
    },
    true,
    ["sign", "verify"]
  )
  publicKey = pair.publicKey
  const der = Buffer.from(
    await crypto.subtle.exportKey("pkcs8", pair.privateKey)
  ).toString("base64")
  account = JSON.stringify({
    project_id: "demo-project",
    client_email: "push@demo-project.iam.gserviceaccount.com",
    private_key: `-----BEGIN PRIVATE KEY-----\n${der}\n-----END PRIVATE KEY-----\n`,
    token_uri: "https://oauth2.example.test/token",
  })
})

function answer(...next: Response[]) {
  calls = []
  answers = next
  globalThis.fetch = (async (url: string | URL, init: RequestInit) => {
    calls.push({ url: String(url), init })
    return answers.shift() ?? new Response("none left", { status: 500 })
  }) as typeof fetch
}
afterEach(() => {
  globalThis.fetch = realFetch
})

describe("createFcm", () => {
  test("trades a signed JWT for an access token and posts the message with it", async () => {
    answer(tokenAnswer(), Response.json({ name: "projects/x/messages/1" }))
    expect(await createFcm(account).send(message)).toBe("sent")
    const [auth, send] = calls
    const form = auth?.init.body as URLSearchParams
    expect(form.get("grant_type")).toBe(
      "urn:ietf:params:oauth:grant-type:jwt-bearer"
    )
    const [head = "", claims = "", signature = ""] = (
      form.get("assertion") ?? ""
    ).split(".")
    expect(JSON.parse(Buffer.from(head, "base64url").toString())).toEqual({
      alg: "RS256",
      typ: "JWT",
    })
    const body = JSON.parse(Buffer.from(claims, "base64url").toString())
    expect(body).toMatchObject({
      iss: "push@demo-project.iam.gserviceaccount.com",
      scope: "https://www.googleapis.com/auth/firebase.messaging",
      aud: "https://oauth2.example.test/token",
    })
    expect(body.exp - body.iat).toBe(3600)
    expect(
      await crypto.subtle.verify(
        "RSASSA-PKCS1-v1_5",
        publicKey,
        Buffer.from(signature, "base64url"),
        new TextEncoder().encode(`${head}.${claims}`)
      )
    ).toBe(true)
    expect(send?.url).toBe(
      "https://fcm.googleapis.com/v1/projects/demo-project/messages:send"
    )
    expect(new Headers(send?.init.headers).get("authorization")).toBe(
      "Bearer ya29.token"
    )
    expect(JSON.parse(send?.init.body as string)).toEqual({
      message: {
        token: "tok",
        notification: { title: "Hi", body: "There" },
        data: { id: "n1" },
        android: { priority: "high" },
      },
    })
  })

  test("reuses the access token for the next push", async () => {
    answer(tokenAnswer(), Response.json({}), Response.json({}))
    const fcm = createFcm(account)
    await fcm.send(message)
    await fcm.send(message)
    expect(calls.map((call) => call.url.includes("oauth2"))).toEqual([
      true,
      false,
      false,
    ])
  })

  test("fetches a new access token after FCM refuses the old one", async () => {
    answer(
      tokenAnswer(),
      Response.json({}, { status: 401 }),
      tokenAnswer(),
      Response.json({})
    )
    const fcm = createFcm(account)
    await expect(fcm.send(message)).rejects.toThrow("fcm_send_401")
    expect(await fcm.send(message)).toBe("sent")
    expect(calls.filter((call) => call.url.includes("oauth2"))).toHaveLength(2)
  })

  test("calls a token dead when FCM says UNREGISTERED or the token itself is invalid", async () => {
    answer(tokenAnswer(), unregistered(), invalid("message.token"))
    const fcm = createFcm(account)
    expect(await fcm.send(message)).toBe("dead")
    expect(await fcm.send(message)).toBe("dead")
  })

  test("throws, so the outbox retries, when the fault is not the token", async () => {
    answer(
      tokenAnswer(),
      invalid("message.data"),
      Response.json({}, { status: 503 })
    )
    const fcm = createFcm(account)
    await expect(fcm.send(message)).rejects.toThrow("fcm_send_400")
    await expect(fcm.send(message)).rejects.toThrow("fcm_send_503")
  })

  test("throws when Google refuses the sign-in", async () => {
    answer(Response.json({ error: "invalid_grant" }, { status: 400 }))
    await expect(createFcm(account).send(message)).rejects.toThrow(
      "fcm_token_400"
    )
  })

  test("refuses a service account without a key", () => {
    expect(() => createFcm('{"project_id":"x"}')).toThrow()
  })
})
