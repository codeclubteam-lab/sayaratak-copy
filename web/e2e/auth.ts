import { existsSync, readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import process from "node:process"

import type { Role } from "./routes"

export type DemoRole = Exclude<Role, "anon">
export type BrowserCookie = { name: string; value: string; url: string }

export const apiBase = (
  process.env.API_BASE_URL ?? "http://localhost:4000"
).replace(/\/$/, "")

export const DEMO_PASSWORD = "Demo1234"

export const accounts: Record<DemoRole, string> = {
  user: "user@demo.sy",
  dealer: "dealer@demo.sy",
  workshop: "workshop@demo.sy",
  mechanic: "mechanic@demo.sy",
  admin: "admin@demo.sy",
}

const cache = new Map<string, BrowserCookie[]>()

function mergeSetCookies(jar: Map<string, string>, headers: string[]) {
  for (const header of headers) {
    const pair = header.split(";")[0] ?? ""
    const eq = pair.indexOf("=")
    if (eq <= 0) continue
    const name = pair.slice(0, eq).trim()
    const value = pair.slice(eq + 1).trim()
    if (!value || /;\s*Max-Age=0\b/i.test(header)) jar.delete(name)
    else jar.set(name, value)
  }
}

export function clearSessionCache() {
  cache.clear()
  process.env.SY_E2E_SESSIONS = ""
}

export async function resetDb(mode: "reset" | "empty" = "reset") {
  clearSessionCache()
  const res = await fetch(`${apiBase}/api/_test/${mode}`, { method: "POST" })
  if (!res.ok) throw new Error(`POST /api/_test/${mode} failed: ${res.status}`)
}

export async function resetLimits() {
  const res = await fetch(`${apiBase}/api/_test/reset-limits`, {
    method: "POST",
  })
  if (!res.ok)
    throw new Error(`POST /api/_test/reset-limits failed: ${res.status}`)
}

export async function fetchOtp(email: string, template?: string) {
  const qs = new URLSearchParams({ email })
  if (template) qs.set("template", template)
  for (let i = 0; i < 15; i++) {
    const res = await fetch(`${apiBase}/api/_test/otp?${qs}`)
    if (res.ok) {
      const { code } = (await res.json()) as { code: string }
      return code
    }
    if (res.status !== 404) throw new Error(`GET /api/_test/otp: ${res.status}`)
    await new Promise((resolve) => setTimeout(resolve, 40))
  }
  throw new Error(`Timed out waiting for OTP for ${email}`)
}

async function postAuth(
  path: string,
  body: unknown,
  origin: string,
  jar: Map<string, string>
) {
  const headers: Record<string, string> = {
    "content-type": "application/json",
    origin,
  }
  if (jar.size > 0) headers.cookie = jarToHeader(jar)
  const res = await fetch(`${apiBase}/api/v1/auth${path}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  })
  mergeSetCookies(jar, res.headers.getSetCookie())
  if (!res.ok)
    throw new Error(
      `POST /api/v1/auth${path} failed (${res.status}): ${await res.text()}`
    )
  return res.json() as Promise<Record<string, unknown>>
}

function jarToHeader(jar: Map<string, string>) {
  return [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ")
}

export async function signInCookies(
  role: DemoRole,
  origin: string
): Promise<BrowserCookie[]> {
  const email = accounts[role]
  const jar = new Map<string, string>()
  const signed = await postAuth(
    "/sign-in/email",
    { email, password: DEMO_PASSWORD },
    origin,
    jar
  )
  if (signed.twoFactorRedirect === true) {
    await postAuth("/two-factor/send-otp", { trustDevice: false }, origin, jar)
    const code = await fetchOtp(email, "admin-code")
    await postAuth(
      "/two-factor/verify-otp",
      { code, trustDevice: false },
      origin,
      jar
    )
  }
  return [...jar.entries()].map(([name, value]) => ({
    name,
    value,
    url: origin,
  }))
}

export async function roleCookies(
  role: DemoRole,
  origin: string
): Promise<BrowserCookie[]> {
  const key = `${role}@${origin}`
  const hit = cache.get(key)
  if (hit) return hit
  const file = process.env.SY_E2E_SESSIONS
  if (file && existsSync(file)) {
    const saved = JSON.parse(readFileSync(file, "utf8")) as Partial<
      Record<DemoRole, BrowserCookie[]>
    >
    const list = saved[role]
    if (list) {
      const normalized = list.map((c) => ({ ...c, url: origin }))
      cache.set(key, normalized)
      return normalized
    }
  }
  const fresh = await signInCookies(role, origin)
  cache.set(key, fresh)
  return fresh
}

export async function signInHeader(role: DemoRole, origin: string) {
  const cookies = await roleCookies(role, origin)
  return cookies.map((c) => `${c.name}=${c.value}`).join("; ")
}

export async function seedSessionFile(dir: string, origin: string) {
  const roles: DemoRole[] = ["user", "dealer", "workshop", "mechanic", "admin"]
  const entries = await Promise.all(
    roles.map(
      async (role) => [role, await signInCookies(role, origin)] as const
    )
  )
  const path = join(dir, "sessions.json")
  writeFileSync(path, JSON.stringify(Object.fromEntries(entries)))
  return path
}
