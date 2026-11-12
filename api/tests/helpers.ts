import { sql } from "drizzle-orm"
import type { z } from "zod"

import { app } from "~/app"
import { rateLimit } from "~/modules/auth/auth.tables"
import { db } from "~/shared/db/client"
import { resetRateLimits } from "~/shared/http/rate-limit"
import { flushFanOut } from "~/modules/notifications/notifications.fanout.service"
import { flushMail, testInbox } from "~/shared/mail/send"

import { seed } from "../scripts/seed"

/** The mock's seed builder, re-exported so module tests never reach into `web/` by a deep relative path. */
export { buildSeed } from "../../web/src/mocks/seed"

/** A request to the api under `/api/v1`, through `app.request()` (no network). */
export function req(path: string, init?: RequestInit) {
  return app.request(`/api/v1${path}`, init)
}

export const DEMO_ACCOUNTS = [
  "user",
  "dealership",
  "workshop",
  "mechanic",
  "admin",
  "new",
] as const
export type DemoAccount = (typeof DEMO_ACCOUNTS)[number]
const DEMO_EMAILS: Record<DemoAccount, string> = {
  user: "user@demo.sy",
  dealership: "dealer@demo.sy",
  workshop: "workshop@demo.sy",
  mechanic: "mechanic@demo.sy",
  admin: "admin@demo.sy",
  new: "new@demo.sy",
}
/** Each demo account's seeded id, which the mock reads from its `sy_session` cookie. */
export const DEMO_IDS: Record<DemoAccount, string> = {
  user: "u-omar",
  dealership: "u-dealer",
  workshop: "u-workshop",
  mechanic: "u-mechanic",
  admin: "u-admin",
  new: "u-new",
}

/** Signs in and returns the headers both the api and the mock read (A13 parity). */
export async function bothSessions(as: DemoAccount) {
  const { cookie } = await signIn(as)
  return { cookie: `${cookie}; sy_session=${DEMO_IDS[as]}` }
}
// web/src/mocks/seed/people.ts DEMO_PASSWORD, shared by every demo account.
const DEMO_PASSWORD = "Demo1234"
const WEB_ORIGIN = "http://localhost:3000"

export type SignedIn = { cookie: string; origin: string; token: string }

let signInQueue: Promise<unknown> = Promise.resolve()

/**
 * Signs in a seeded demo account through Better-Auth (A13) and returns the
 * headers a browser would send next: the session cookie and the web origin.
 * `token` is the same session as a bearer token (A18). The admin also passes
 * the emailed code step (3.7), as the web does.
 */
export function signIn(as: DemoAccount): Promise<SignedIn> {
  // Concurrent sign-ins clear rateLimit globally and overwrite admin OTPs in testInbox.
  const run = signInQueue.then(() => signInNow(as))
  signInQueue = run.catch(() => {})
  return run
}

async function signInNow(as: DemoAccount): Promise<SignedIn> {
  const email = DEMO_EMAILS[as]
  // Tests sign in far more often than a person, all from 127.0.0.1; the
  // limits themselves are tested where they are set (3.6).
  await db.delete(rateLimit)
  const res = await authPost("/sign-in/email", {
    email,
    password: DEMO_PASSWORD,
  })
  const done = as === "admin" ? await passAdminCode(res, email) : res
  const cookie = cookieOf(done, "session_token=")
  const token = done.headers.get("set-auth-token")
  if (done.status !== 200 || !cookie || !token) {
    throw new Error(`sign-in as ${as} failed: ${done.status}`)
  }
  return { cookie, origin: WEB_ORIGIN, token }
}

/** A JSON POST to Better-Auth from the web origin, with an optional cookie. */
export function authPost(path: string, body: object, cookie = "") {
  return req(`/auth${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: WEB_ORIGIN, cookie },
    body: JSON.stringify(body),
  })
}

/** The `name=value` pair of the cookie a response sets whose name contains `name`. */
export function cookieOf(res: Response, name: string) {
  return res.headers
    .getSetCookie()
    .map((line) => line.split(";")[0] ?? "")
    .find((pair) => pair.includes(name))
}

/** The last admin code mailed to `email` (test inbox, A13). */
export async function lastAdminCode(email: string) {
  await flushMail()
  return testInbox.findLast(
    (mail) => mail.to === email && mail.template === "admin-code"
  )?.code
}

// After the admin's password: ask for the code, then enter it (3.7).
async function passAdminCode(signedIn: Response, email: string) {
  const challenge = cookieOf(signedIn, "two_factor=") ?? ""
  await authPost("/two-factor/send-otp", {}, challenge)
  const code = await lastAdminCode(email)
  return authPost("/two-factor/verify-otp", { code }, challenge)
}

/** A JSON request as the signed-in web app sends it: cookie, Origin, body. */
export function call(
  as: SignedIn,
  path: string,
  init: { method: string; body?: object }
) {
  return req(path, {
    method: init.method,
    headers: {
      cookie: as.cookie,
      origin: as.origin,
      "content-type": "application/json",
    },
    body: init.body && JSON.stringify(init.body),
  })
}

/** Parses the response body with a shared web schema; a mismatch fails the test with Zod's issues. */
export async function expectSchema<S extends z.ZodType>(
  res: Response,
  schema: S
): Promise<z.output<S>> {
  return schema.parse(await res.json())
}

/** Empties every table and seeds it again, so each test starts from the mock's data. */
export async function resetDb() {
  await emptyDb()
  await seed(db)
  // The mock writes its seed times relative to when it was built. Once a
  // parity test has loaded it, build it again now, so both sides' times stay
  // within the parity tolerance however long the run has been going.
  if ("__sayaratakDb" in globalThis) {
    const mock = await import("../../web/src/mocks/db")
    mock.resetDb()
  }
}

/** Empties every table, for tests that start from a new site (bootstrap, create-admin). */
export async function emptyDb() {
  // Tests share one process and one address, so counters from the last test would block this one.
  resetRateLimits()
  // A broadcast kicked by the last test must not write into the tables being emptied.
  await flushFanOut()
  const rows = await db.execute<{ name: string }>(
    sql`select tablename as name from pg_tables where schemaname = 'public'`
  )
  // Table names come from the catalog, quoted as identifiers, never from input.
  const tables = sql.join(
    rows.map((row) => sql.identifier(row.name)),
    sql`, `
  )
  await db.execute(sql`truncate ${tables} restart identity cascade`)
}
