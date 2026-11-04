import { afterAll, beforeAll, describe, test } from "bun:test"

import {
  bothSessions,
  buildSeed,
  DEMO_ACCOUNTS,
  type DemoAccount,
  resetDb,
} from "../../../tests/helpers"
import { expectParity } from "../../../tests/parity"

beforeAll(resetDb)
afterAll(resetDb)

const headers = async (who: DemoAccount | null) =>
  who ? await bothSessions(who) : {}

// Seed: u-omar's promo-53 is a bump waiting for payment, u-dealer's promo-54 a 7-day Featured.
const seeded = buildSeed()
const listingOf = (promotionId: string) =>
  seeded.promotions.find((p) => p.id === promotionId)?.listingId ?? ""

describe("GET /promotion-prices and /me/promotions match the mock", () => {
  test("the price list, signed in or not", async () => {
    await expectParity("/api/v1/promotion-prices")
    await expectParity("/api/v1/promotion-prices", {
      init: { headers: await headers("user") },
    })
  })

  test("every account's promotions, and signed out", async () => {
    for (const who of DEMO_ACCOUNTS)
      await expectParity("/api/v1/me/promotions", {
        init: { headers: await headers(who) },
      })
    await expectParity("/api/v1/me/promotions")
  })
})

const send = async (who: DemoAccount | null, body: unknown) =>
  expectParity("/api/v1/promotions", {
    init: {
      method: "POST",
      headers: {
        ...(await headers(who)),
        origin: "http://localhost:3000",
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
    },
  })

describe("POST /promotions answers as the mock does", () => {
  test("when it fails", async () => {
    const bump = { listingId: listingOf("promo-53"), priceId: "bump" }
    await send(null, bump)
    await send("user", {})
    await send("user", { listingId: bump.listingId })
    await send("user", { priceId: "bump" })
    await send("user", { ...bump, listingId: "nope" })
    await send("user", { ...bump, priceId: "nope" })
    await send("dealership", bump)
    await send("dealership", { listingId: bump.listingId, useCredit: true })
    await send("workshop", bump)
  })

  test("when an unpaid order of that listing and price is asked for again", async () => {
    await send("user", { listingId: listingOf("promo-53"), priceId: "bump" })
    await send("dealership", {
      listingId: listingOf("promo-54"),
      priceId: "featured-7",
    })
  })
})
