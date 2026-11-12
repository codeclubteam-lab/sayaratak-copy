import { createHmac, timingSafeEqual } from "node:crypto"
import { isIP } from "node:net"

export const PROXY_IP_HEADERS = [
  "x-sy-proxy-ip",
  "x-sy-proxy-time",
  "x-sy-proxy-signature",
] as const
const MAX_AGE_MS = 180_000
const FUTURE_SKEW_MS = 30_000
const MIN_SECRET_LENGTH = 32
const MAX_IP_LENGTH = 45
const ASSERTION_VERSION = 1

type SignOptions = { ip: string; secret: string; now: number }
type VerifyOptions = { secret: string; origin: string; now: number }

/** Render overwrites this single-IP header at public ingress; opt in only on that platform. */
export function readRenderIp(headers: Headers) {
  const value = headers.get("cf-connecting-ip")
  return value && value.length <= MAX_IP_LENGTH && isIP(value) ? value : null
}

/** An IP assertion is not user authentication. It authenticates only the web-to-API metadata. */
export function signClientIp(request: Request, options: SignOptions) {
  if (!isIP(options.ip) || options.secret.length < MIN_SECRET_LENGTH)
    throw new Error("Invalid proxy IP configuration")
  const url = new URL(request.url)
  const time = String(options.now)
  const signature = digest(request, {
    ip: options.ip,
    time,
    origin: url.origin,
    secret: options.secret,
  })
  return new Headers({
    "x-sy-proxy-ip": options.ip,
    "x-sy-proxy-time": time,
    "x-sy-proxy-signature": signature,
  })
}

/** Verify against configured origin, never Host/Forwarded, because Render terminates HTTPS. */
export function verifyClientIp(request: Request, options: VerifyOptions) {
  const ip = request.headers.get("x-sy-proxy-ip") ?? ""
  const time = request.headers.get("x-sy-proxy-time") ?? ""
  const signature = request.headers.get("x-sy-proxy-signature") ?? ""
  if (!validAssertion({ ip, time, signature }, options)) return null
  const expected = digest(request, { ...options, ip, time })
  return timingSafeEqual(
    Buffer.from(signature, "hex"),
    Buffer.from(expected, "hex")
  )
    ? ip
    : null
}

function validAssertion(
  values: { ip: string; time: string; signature: string },
  options: VerifyOptions
) {
  const age = options.now - Number(values.time)
  return (
    options.secret.length >= MIN_SECRET_LENGTH &&
    values.ip.length <= MAX_IP_LENGTH &&
    isIP(values.ip) !== 0 &&
    /^\d{13}$/.test(values.time) &&
    /^[a-f0-9]{64}$/.test(values.signature) &&
    age >= -FUTURE_SKEW_MS &&
    age <= MAX_AGE_MS
  )
}

function digest(
  request: Request,
  values: { ip: string; time: string; origin: string; secret: string }
) {
  const url = new URL(request.url)
  const message = JSON.stringify([
    ASSERTION_VERSION,
    values.ip,
    values.time,
    request.method.toUpperCase(),
    values.origin,
    url.pathname + url.search,
  ])
  return createHmac("sha256", values.secret).update(message).digest("hex")
}
