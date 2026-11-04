import type { FacebookProfile } from "better-auth/social-providers"

import { env } from "~/env"
import { clock } from "~/shared/time/clock"

import { placeholderEmail } from "./auth.mapper"

// Apple takes a client secret of at most 6 months (A18).
// ponytail: signed once at startup; a server up longer than 180 days without
// a deploy loses Apple web sign-in. Sign it per request if that ever happens.
const SECRET_SECONDS = 180 * 24 * 3600
const APPLE_ISSUER = "https://appleid.apple.com"

export type AppleKeys = {
  teamId: string
  keyId: string
  clientId: string
  // The .p8 file from Apple, as PEM; `\n` written out in .env is accepted.
  privateKey: string
}

/**
 * The client secret Apple wants for the web redirect: an ES256 JWT signed
 * with the Sign in with Apple key (Apple's "Creating a client secret").
 * App ID-token sign-in does not use it.
 */
export async function appleClientSecret(keys: AppleKeys) {
  const der = keys.privateKey
    .replaceAll("\\n", "\n")
    .replace(/-----[^-]+-----|\s/g, "")
  const key = await crypto.subtle.importKey(
    "pkcs8",
    Buffer.from(der, "base64"),
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"]
  )
  const iat = Math.floor(clock.now().getTime() / 1000)
  const unsigned = `${part({ alg: "ES256", kid: keys.keyId })}.${part({
    iss: keys.teamId,
    iat,
    exp: iat + SECRET_SECONDS,
    aud: APPLE_ISSUER,
    sub: keys.clientId,
  })}`
  // Web Crypto signs ECDSA as raw r||s, the form a JWT uses.
  const signature = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    key,
    new TextEncoder().encode(unsigned)
  )
  return `${unsigned}.${Buffer.from(signature).toString("base64url")}`
}

function part(value: object) {
  return Buffer.from(JSON.stringify(value)).toString("base64url")
}

// A provider is on once the owner has filled both values in .env (T2).
const google = {
  enabled: Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET),
  clientId: env.GOOGLE_CLIENT_ID ?? "",
  clientSecret: env.GOOGLE_CLIENT_SECRET ?? "",
  prompt: "select_account" as const,
}
const facebook = {
  enabled: Boolean(env.FACEBOOK_CLIENT_ID && env.FACEBOOK_CLIENT_SECRET),
  clientId: env.FACEBOOK_CLIENT_ID ?? "",
  clientSecret: env.FACEBOOK_CLIENT_SECRET ?? "",
  // Facebook accounts made with a phone give no email: the account gets a
  // placeholder that is never mailed and /me leaves out (owner, 3.4).
  mapProfileToUser: (profile: FacebookProfile) =>
    profile.email
      ? {}
      : {
          email: placeholderEmail("sub" in profile ? profile.sub : profile.id),
        },
}

// Apple (3.8): on once all five values are in .env (T10). The web redirect
// uses the Services ID; apps send an ID token whose audience is the bundle id.
const appleKeys = {
  clientId: env.APPLE_CLIENT_ID ?? "",
  teamId: env.APPLE_TEAM_ID ?? "",
  keyId: env.APPLE_KEY_ID ?? "",
  privateKey: env.APPLE_PRIVATE_KEY ?? "",
  bundleId: env.APPLE_APP_BUNDLE_ID ?? "",
}
export const hasApple = Object.values(appleKeys).every(Boolean)
const apple = {
  enabled: hasApple,
  clientId: appleKeys.clientId,
  clientSecret: hasApple ? await appleClientSecret(appleKeys) : "",
  appBundleIdentifier: appleKeys.bundleId,
  audience: [appleKeys.clientId, appleKeys.bundleId],
}

/** Better-Auth `socialProviders` (A6, A18). */
export const socialProviders = { google, facebook, apple }
