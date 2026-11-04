import { z } from "zod"

import { clock } from "~/shared/time/clock"

const SCOPE = "https://www.googleapis.com/auth/firebase.messaging"
const JWT_LIFETIME_S = 3600
const TIMEOUT_MS = 10_000
// An access token is reused until 5 minutes before it ends.
const REFRESH_MARGIN_MS = 300_000
const JWT_GRANT = "urn:ietf:params:oauth:grant-type:jwt-bearer"

const accountSchema = z.object({
  project_id: z.string().min(1),
  client_email: z.string().min(1),
  private_key: z.string().min(1),
  token_uri: z.url(),
})
const tokenSchema = z.object({
  access_token: z.string().min(1),
  expires_in: z.number(),
})
// The part of an FCM error answer that tells a dead token from a failure to retry.
const failureSchema = z.object({
  error: z.object({
    details: z.array(
      z.looseObject({
        errorCode: z.string().optional(),
        fieldViolations: z.array(z.object({ field: z.string() })).optional(),
      })
    ),
  }),
})

export type PushMessage = {
  token: string
  title: string
  body: string
  data: Record<string, string>
}
/** `dead`: FCM says the token will never work again, so the device row goes. */
export type PushResult = "sent" | "dead"

type Account = z.infer<typeof accountSchema>

/**
 * FCM HTTP v1 sender (A18), no SDK: the service account signs a short JWT
 * (RS256, Web Crypto), Google trades it for a one-hour access token, and the
 * token is reused until just before it ends.
 */
export function createFcm(serviceAccount: string) {
  const account = accountSchema.parse(JSON.parse(serviceAccount))
  const accessToken = accessTokenOf(account)
  return {
    /** Sends one push; throws when FCM could not take it, so the outbox retries. */
    async send(message: PushMessage): Promise<PushResult> {
      const answer = await fetch(
        `https://fcm.googleapis.com/v1/projects/${account.project_id}/messages:send`,
        {
          method: "POST",
          headers: {
            authorization: `Bearer ${await accessToken.get()}`,
            "content-type": "application/json",
          },
          body: JSON.stringify({
            message: {
              token: message.token,
              notification: { title: message.title, body: message.body },
              data: message.data,
              android: { priority: "high" },
            },
          }),
          signal: AbortSignal.timeout(TIMEOUT_MS),
        }
      )
      if (answer.ok) return "sent"
      // 401: the cached access token was refused, so the next try fetches a new one.
      if (answer.status === 401) accessToken.forget()
      const failure = failureSchema.safeParse(
        await answer.json().catch(() => 0)
      )
      if (failure.success && isDeadToken(failure.data.error)) return "dead"
      throw new Error(`fcm_send_${answer.status}`)
    },
  }
}

function accessTokenOf(account: Account) {
  let key: Promise<CryptoKey> | undefined
  let cached: { token: string; endsAt: number } | undefined
  return {
    forget: () => {
      cached = undefined
    },
    async get() {
      const now = clock.now().getTime()
      if (cached && cached.endsAt - REFRESH_MARGIN_MS > now) return cached.token
      key ??= importKey(account.private_key)
      const assertion = await signJwt(await key, account, now)
      const answer = await fetch(account.token_uri, {
        method: "POST",
        body: new URLSearchParams({ grant_type: JWT_GRANT, assertion }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      })
      if (!answer.ok) throw new Error(`fcm_token_${answer.status}`)
      const token = tokenSchema.parse(await answer.json())
      const endsAt = now + token.expires_in * 1000
      cached = { token: token.access_token, endsAt }
      return token.access_token
    },
  }
}

// A18 deletes the device on UNREGISTERED and INVALID_ARGUMENT. Checked against the real
// service (2026-11-01): an unknown token is 404 UNREGISTERED; a malformed one is 400
// INVALID_ARGUMENT with a field violation on `message.token`. INVALID_ARGUMENT about any
// other field is our own payload's fault, so it must not wipe a user's devices.
function isDeadToken(error: z.infer<typeof failureSchema>["error"]) {
  return error.details.some(
    (detail) =>
      detail.errorCode === "UNREGISTERED" ||
      detail.fieldViolations?.some((v) => v.field === "message.token")
  )
}

async function importKey(pem: string) {
  const der = Buffer.from(
    pem.replace(/-----[A-Z ]+-----/g, "").replace(/\s/g, ""),
    "base64"
  )
  return crypto.subtle.importKey(
    "pkcs8",
    der,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  )
}

const base64Url = (data: string | ArrayBuffer) =>
  Buffer.from(typeof data === "string" ? data : new Uint8Array(data)).toString(
    "base64url"
  )

async function signJwt(key: CryptoKey, account: Account, nowMs: number) {
  const issuedAt = Math.floor(nowMs / 1000)
  const unsigned = [
    base64Url(JSON.stringify({ alg: "RS256", typ: "JWT" })),
    base64Url(
      JSON.stringify({
        iss: account.client_email,
        scope: SCOPE,
        aud: account.token_uri,
        iat: issuedAt,
        exp: issuedAt + JWT_LIFETIME_S,
      })
    ),
  ].join(".")
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(unsigned)
  )
  return `${unsigned}.${base64Url(signature)}`
}
