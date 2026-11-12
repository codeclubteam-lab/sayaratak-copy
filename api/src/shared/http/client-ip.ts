import { BlockList, isIP } from "node:net"
import {
  PROXY_IP_HEADERS,
  readRenderIp,
  verifyClientIp,
} from "@sayaratak/shared/lib/proxy-client-ip"
import type { Context, MiddlewareHandler } from "hono"

import { clock } from "~/shared/time/clock"

import { fail } from "./errors"

declare module "hono" {
  interface ContextVariableMap {
    clientIp: string
  }
}

// `app.request()` in tests runs in process with no Bun server behind it.
const NO_SOCKET = "127.0.0.1"

type SocketServer = {
  requestIP(request: Request): { address: string } | null
}

type IpPolicy =
  | { mode: "socket" }
  | { mode: "render"; secret: string; origin: string }

/** Sets `clientIp`, the address every rate limit and audit row uses (A3). */
export function clientIp(
  trustedProxies: string[],
  policy: IpPolicy = { mode: "socket" }
): MiddlewareHandler {
  const trusted = proxyList(trustedProxies)
  return async (c, next) => {
    const peer = socketIp(c) ?? NO_SOCKET
    const forwarded = c.req.header("x-forwarded-for")
    c.set(
      "clientIp",
      policy.mode === "render"
        ? renderIp(c, policy, peer)
        : realIp(peer, forwarded, trusted)
    )
    await next()
  }
}

function renderIp(
  c: Context,
  policy: Extract<IpPolicy, { mode: "render" }>,
  peer: string
) {
  if (["/api/health/live", "/api/health/ready"].includes(c.req.path))
    return peer
  const request = c.req.raw
  if (PROXY_IP_HEADERS.some((key) => request.headers.has(key))) {
    const ip = verifyClientIp(request, {
      ...policy,
      now: clock.now().getTime(),
    })
    if (!ip) fail.forbidden()
    return ip
  }
  const ip = readRenderIp(request.headers)
  if (!ip) fail.forbidden()
  return ip
}

// A3: X-Forwarded-For counts only when the socket peer is one of our proxies.
// Walk it from the right, skipping our proxies; the first other hop is the
// client. Everything left of it was written by the client and can be forged.
//   peer 10.0.0.2 (proxy), header "6.6.6.6, 41.1.1.1, 10.0.0.1" gives 41.1.1.1
function realIp(peer: string, header: string | undefined, trusted: BlockList) {
  if (!header || !isTrusted(peer, trusted)) return peer
  const hops = header
    .split(",")
    .map((hop) => hop.trim())
    .filter((hop) => isIP(hop))
  let ip = peer
  for (let i = hops.length - 1; i >= 0; i--) {
    ip = hops[i] ?? peer
    if (!isTrusted(ip, trusted)) return ip
  }
  return ip
}

// Entries are single IPs or CIDRs; a malformed entry throws at boot.
function proxyList(entries: string[]) {
  const list = new BlockList()
  for (const entry of entries) {
    const [address = "", prefix] = entry.split("/")
    const type = isIP(address) === 6 ? "ipv6" : "ipv4"
    if (prefix === undefined) list.addAddress(address, type)
    else list.addSubnet(address, Number(prefix), type)
  }
  return list
}

// BlockList also matches IPv4-mapped IPv6 (::ffff:10.0.0.1) against IPv4 rules.
function isTrusted(ip: string, trusted: BlockList) {
  return trusted.check(ip, isIP(ip) === 6 ? "ipv6" : "ipv4")
}

// Bun passes its server as the second `fetch` argument, which Hono calls env.
function socketIp(c: Context) {
  const server: unknown = c.env
  if (!isSocketServer(server)) return undefined
  return server.requestIP(c.req.raw)?.address
}

function isSocketServer(value: unknown): value is SocketServer {
  return (
    typeof value === "object" &&
    value !== null &&
    "requestIP" in value &&
    typeof value.requestIP === "function"
  )
}
