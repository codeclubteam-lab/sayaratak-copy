import { beforeAll, describe, expect, test } from "bun:test"

import { resetDb, signIn } from "../tests/helpers"
import {
  FILES,
  OWN_ROWS_ONLY,
  OWNED,
  PROFILE_SWEPT,
  PUBLIC_BY_DESIGN,
} from "../tests/owned-calls"
import { hit, hitWithBearer, keyOf, type Route, v1Routes } from "../tests/sweep"

// 10.3, part 1: who may call what, read from the router so a new route is
// swept without anyone remembering it (A12 "Authorization").
const routes = v1Routes()
const admin = routes.filter((r) => r.path.startsWith("/admin/"))
// The platform admin endpoint has its own key and code (8.12).
const withoutPlatform = (r: Route) => !r.path.startsWith("/platform/")

beforeAll(resetDb)

/** Every route that did not answer `expected`, as `METHOD /path -> status`. */
async function misses(
  list: Route[],
  expected: number[],
  call: (r: Route) => Response | Promise<Response>
) {
  const out: string[] = []
  for (const r of list) {
    const status = (await call(r)).status
    if (!expected.includes(status)) out.push(`${keyOf(r)} -> ${status}`)
  }
  return out
}

test("the router lists the whole contract", () => {
  expect(routes.length).toBeGreaterThan(150)
  expect(admin.length).toBeGreaterThan(60)
})

describe("a visitor", () => {
  test("every route marked user answers 401", async () => {
    const list = routes.filter((r) => r.access === "user")
    expect(await misses(list, [401], (r) => hit(r))).toEqual([])
  })

  test("no route marked public asks for a login", async () => {
    const list = routes.filter((r) => r.access === "public")
    const refused = await misses(
      list.filter(withoutPlatform),
      [200, 201, 400, 404, 422, 429],
      (r) => hit(r)
    )
    expect(refused).toEqual([])
  })
})

describe("an account that is not the admin", () => {
  test.each(["user", "dealership", "workshop", "mechanic", "new"] as const)(
    "%s gets 403 on every /admin route",
    async (account) => {
      const as = await signIn(account)
      expect(await misses(admin, [403], (r) => hit(r, { as }))).toEqual([])
    }
  )

  test("a role claim in the body changes nothing", async () => {
    const as = await signIn("user")
    const body = { role: "admin", moderation: "approved" }
    expect(await misses(admin, [403], (r) => hit(r, { as, body }))).toEqual([])
  })
})

describe("the admin's bearer token", () => {
  test("is refused on every /admin route: the console is web only", async () => {
    const { token } = await signIn("admin")
    expect(await misses(admin, [403], (r) => hitWithBearer(r, token))).toEqual(
      []
    )
  })

  test("still works on a personal route, so the refusal is not a dead token", async () => {
    const { token } = await signIn("admin")
    const me = await hitWithBearer(
      { method: "GET", path: "/me", access: "public" },
      token
    )
    expect(me.status).toBe(200)
    expect(await me.json()).toMatchObject({ role: "admin" })
  })
})

describe("the owner sweep", () => {
  test("every non-admin route with a parameter is swept or public on purpose", () => {
    const listed = new Set([
      ...OWNED.map((o) => o.route),
      ...OWN_ROWS_ONLY,
      ...PROFILE_SWEPT,
      ...FILES,
      ...PUBLIC_BY_DESIGN,
    ])
    const loose = routes
      .filter((r) => r.path.includes(":") && !r.path.startsWith("/admin/"))
      .map(keyOf)
      .filter((key) => !listed.has(key))
    expect(loose).toEqual([])
  })

  test("the lists name routes that exist", () => {
    const known = new Set(routes.map(keyOf))
    const named = [
      ...OWNED.map((o) => o.route),
      ...OWN_ROWS_ONLY,
      ...PROFILE_SWEPT,
      ...FILES,
      ...PUBLIC_BY_DESIGN,
    ]
    expect(named.filter((key) => !known.has(key))).toEqual([])
  })
})
