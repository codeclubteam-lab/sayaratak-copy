import { beforeAll, describe, expect, test } from "bun:test"

import { complete } from "../tests/onboarding"
import { resetDb, signIn, type SignedIn } from "../tests/helpers"
import * as portfolio from "../tests/portfolio"
import * as services from "../tests/services"
import { send } from "../tests/listings"

// 10.3, part 3: the routes under /me that take an id from the caller's own
// profile. A stranger of the same role (a second mechanic or workshop, made
// through onboarding) cannot reach A's items, and a draft key is per account.
const here = { cityId: "khartoum", phone: "+249912345678" }

describe("a second mechanic with A's portfolio ids", () => {
  let a: SignedIn
  let b: SignedIn
  let ids: string[]
  let before: string

  beforeAll(async () => {
    await resetDb()
    a = await signIn("mechanic")
    b = await signIn("new")
    const made = await complete(b, "mechanic", { name: "Second", ...here })
    expect(made.status).toBe(200)
    ids = (await portfolio.list(a)).map((item) => item.id)
    before = JSON.stringify(await portfolio.list(a))
  })

  test("A has pictures to lose", () => {
    expect(ids.length).toBeGreaterThan(0)
  })

  test("PATCH /me/portfolio/:id is 404, DELETE is a quiet 200 or 404, and A keeps every picture", async () => {
    for (const id of ids) {
      expect(
        (await portfolio.patch(b, id, { caption: "Mine now" })).status
      ).toBe(404)
      expect([200, 404]).toContain((await portfolio.remove(b, id)).status)
    }
    expect(JSON.stringify(await portfolio.list(a))).toBe(before)
  })
})

describe("a second workshop with A's service ids", () => {
  let a: SignedIn
  let b: SignedIn
  let ids: string[]
  let before: string

  beforeAll(async () => {
    await resetDb()
    a = await signIn("workshop")
    b = await signIn("new")
    const made = await complete(b, "workshop", {
      name: "Second Garage",
      ...here,
      services: [{ name: "Wash" }],
    })
    expect(made.status).toBe(200)
    ids = (await services.list(a)).map((item) => item.id)
    before = JSON.stringify(await services.list(a))
  })

  test("A has services to lose", () => {
    expect(ids.length).toBeGreaterThan(0)
  })

  test("PATCH /me/services/:id is 404, DELETE is a quiet 200 or 404, and A keeps every service", async () => {
    for (const id of ids) {
      expect((await services.patch(b, id, { name: "Mine now" })).status).toBe(
        404
      )
      expect([200, 404]).toContain((await services.remove(b, id)).status)
    }
    expect(JSON.stringify(await services.list(a))).toBe(before)
  })
})

describe("drafts", () => {
  beforeAll(resetDb)

  test("a draft key belongs to the account: B neither reads nor overwrites A's", async () => {
    const a = await signIn("user")
    const b = await signIn("dealership")
    const saved = await send(a, "/drafts/post", {
      method: "PATCH",
      body: { data: { title: "My Corolla" } },
    })
    expect(saved.status).toBe(200)
    const theirs = await send(b, "/drafts/post", { method: "GET" })
    expect(await theirs.text()).not.toContain("My Corolla")
    await send(b, "/drafts/post", {
      method: "PATCH",
      body: { data: { title: "Overwritten" } },
    })
    const mine = await send(a, "/drafts/post", { method: "GET" })
    expect(await mine.text()).toContain("My Corolla")
  })
})
