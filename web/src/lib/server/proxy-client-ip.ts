import {
  readRenderIp,
  signClientIp,
} from "@sayaratak/shared/lib/proxy-client-ip"

export type ProxyIpConfig =
  { mode: "socket" } | { mode: "render"; secret: string }

export function readProxyIpConfig(
  source: Record<string, string | undefined>
): ProxyIpConfig {
  const mode = source.CLIENT_IP_MODE || "socket"
  if (mode === "socket") return { mode }
  if (mode !== "render") throw new Error("Invalid CLIENT_IP_MODE")
  const secret = source.PROXY_CLIENT_IP_SECRET
  if (!secret || secret.length < 32)
    throw new Error("CLIENT_IP_MODE=render requires PROXY_CLIENT_IP_SECRET")
  if ([source.BETTER_AUTH_SECRET, source.ADMIN_SECRET_KEY].includes(secret))
    throw new Error("PROXY_CLIENT_IP_SECRET must be a dedicated key")
  return { mode, secret }
}

export function proxyClientIpHeaders(
  target: Request,
  incoming: Headers,
  config: ProxyIpConfig
) {
  if (config.mode === "socket") return new Headers()
  const ip = readRenderIp(incoming)
  if (!ip) throw new Error("Missing verified Render client IP")
  return signClientIp(target, { ip, secret: config.secret, now: Date.now() })
}
