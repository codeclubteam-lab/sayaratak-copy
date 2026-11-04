import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test"

import { clock } from "~/shared/time/clock"

import { call, req, resetDb, signIn } from "../../../tests/helpers"

// One row per limited route: the first `max` calls pass, the next is 429.
// The bodies are empty on purpose: validation (422) runs after the limit and
// still counts, so no route needs real data.
const WEB = "http://localhost:3000"
const post = (path: string, headers: Record<string, string> = {}) =>
  req(path, { method: "POST", headers: { origin: WEB, ...headers } })

const PUBLIC = [
  { name: "contact", path: "/contact", max: 10 },
  { name: "events", path: "/events", max: 120 },
]
const SIGNED_IN = [
  { name: "reports", path: "/reports", max: 10 },
  { name: "reviews", path: "/reviews", max: 10 },
  { name: "threads", path: "/threads", max: 20 },
  { name: "messages", path: "/threads/th-1/messages", max: 30 },
  { name: "uploads", path: "/uploads", max: 60 },
  { name: "payments", path: "/payments", max: 5 },
]

async function expectBlocked(res: Response) {
  expect(res.status).toBe(429)
  const body = (await res.json()) as { code: string; retryAfter: number }
  expect(body.code).toBe("too_many_attempts")
  expect(body.retryAfter).toBeGreaterThan(0)
  expect(res.headers.get("retry-after")).toBe(String(body.retryAfter))
  return body.retryAfter
}

beforeEach(resetDb)
afterEach(() => spyOn(clock, "now").mockRestore())

describe("public routes: per IP", () => {
  for (const { name, path, max } of PUBLIC) {
    test(`${name}: call ${max + 1} is 429 with retryAfter`, async () => {
      for (let i = 0; i < max; i++) {
        expect((await post(path)).status).toBe(422)
      }
      await expectBlocked(await post(path))
    })
  }
})

describe("signed-in routes: per account", () => {
  for (const { name, path, max } of SIGNED_IN) {
    test(`${name}: call ${max + 1} is 429 with retryAfter`, async () => {
      const as = await signIn("user")
      const headers = { cookie: as.cookie }
      for (let i = 0; i < max; i++) {
        expect((await post(path, headers)).status).not.toBe(429)
      }
      await expectBlocked(await post(path, headers))
    })
  }

  test("one account at its limit does not block another", async () => {
    const [buyer, dealer] = [await signIn("user"), await signIn("dealership")]
    for (let i = 0; i < 10; i++)
      await post("/reports", { cookie: buyer.cookie })
    await expectBlocked(await post("/reports", { cookie: buyer.cookie }))
    expect((await post("/reports", { cookie: dealer.cookie })).status).toBe(422)
  })

  test("a blocked account does not use up the shared IP ceiling", async () => {
    const buyer = await signIn("user")
    for (let i = 0; i < 20; i++)
      await post("/threads", { cookie: buyer.cookie })
    // The ceiling is 100 an hour. 20 passed; if the 90 refused calls counted
    // too, the address would be at 110 and block the next person.
    for (let i = 0; i < 90; i++)
      await post("/threads", { cookie: buyer.cookie })
    const dealer = await signIn("dealership")
    expect((await post("/threads", { cookie: dealer.cookie })).status).toBe(422)
  })

  test("an idempotent replay is not counted", async () => {
    const as = await signIn("user")
    const send = () =>
      req("/reports", {
        method: "POST",
        headers: {
          cookie: as.cookie,
          origin: WEB,
          "content-type": "application/json",
          "idempotency-key": "same-click",
        },
        body: JSON.stringify({ listingId: "l00001", reason: "scam" }),
      })
    for (let i = 0; i < 15; i++) expect((await send()).status).toBe(200)
  })
})

describe("the window", () => {
  test("opens again after the window, and retryAfter counts down to it", async () => {
    const start = new Date("2026-11-03T10:00:00Z")
    const now = spyOn(clock, "now").mockReturnValue(start)
    for (let i = 0; i < 10; i++) await post("/contact")
    now.mockReturnValue(new Date(start.getTime() + 600_000))
    expect(await expectBlocked(await post("/contact"))).toBe(3000)

    now.mockReturnValue(new Date(start.getTime() + 3_600_000 - 1))
    await expectBlocked(await post("/contact"))
    now.mockReturnValue(new Date(start.getTime() + 3_600_000))
    expect((await post("/contact")).status).toBe(422)
  })

  test("a limit of one route does not touch another route", async () => {
    for (let i = 0; i < 11; i++) await post("/contact")
    expect((await post("/events")).status).toBe(422)
  })
})

test("call helper stays usable with a signed-in JSON body", async () => {
  const as = await signIn("user")
  const res = await call(as, "/reports", { method: "POST", body: {} })
  expect(res.status).toBe(422)
})
