import { afterAll, beforeAll, describe, test } from "bun:test"
import { adPageIdSchema } from "@sayaratak/shared/schemas/ads"

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

// Seed: camp-1 is u-dealer's, approved, on search_car, search_truck and home_middle; camp-2 is
// u-workshop's, under review. Every page has 3 slots.
const seeded = buildSeed()
const dealerSlug =
  seeded.dealerships.find((d) => d.ownerId === "u-dealer")?.slug ?? ""
const today = new Date().toISOString().slice(0, 10)

describe("GET /ad-pages matches the mock", () => {
  test("every account and signed out, with no dates", async () => {
    for (const who of DEMO_ACCOUNTS)
      await expectParity("/api/v1/ad-pages", {
        init: { headers: await headers(who) },
      })
    await expectParity("/api/v1/ad-pages")
  })

  test("with dates, so the running and waiting campaigns take slots", async () => {
    const init = { headers: await headers("dealership") }
    for (const query of [
      `startDate=${today}&weeks=2`,
      `startDate=${today}&weeks=1`,
      "startDate=2030-01-07&weeks=4",
      `startDate=${today}`,
      `startDate=${today}&weeks=5`,
      "weeks=2",
    ])
      await expectParity(`/api/v1/ad-pages?${query}`, { init })
  })
})

describe("GET /me/ad-targets and /me/campaigns match the mock", () => {
  test("every account and signed out", async () => {
    for (const who of DEMO_ACCOUNTS) {
      await expectParity("/api/v1/me/ad-targets", {
        init: { headers: await headers(who) },
      })
      await expectParity("/api/v1/me/campaigns", {
        init: { headers: await headers(who) },
      })
    }
    await expectParity("/api/v1/me/ad-targets")
    await expectParity("/api/v1/me/campaigns")
  })
})

describe("GET /ads matches the mock", () => {
  test("every page, an unknown page and none", async () => {
    for (const page of adPageIdSchema.options)
      await expectParity(`/api/v1/ads?page=${page}`)
    await expectParity("/api/v1/ads?page=nope")
    await expectParity("/api/v1/ads")
  })
})

const creative = {
  imageUrl: "/mock/banner-2.webp",
  copy: {
    ar: { heading: "عنوان", body: "نص", cta: "زر" },
    en: { heading: "Heading", body: "Text", cta: "Go" },
  },
}
const send = async (who: DemoAccount | null, body: unknown, loose = false) =>
  expectParity("/api/v1/campaigns", {
    init: {
      method: "POST",
      headers: {
        ...(await headers(who)),
        origin: "http://localhost:3000",
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
    },
    // The mock answers a bare `validation` for a page off sale or past dates; the api names the field too.
    ignore: (answer) =>
      loose && typeof answer === "object" && answer !== null
        ? { ...answer, fields: undefined }
        : answer,
  })

describe("POST /campaigns answers as the mock does when it fails", () => {
  test("signed out, wrong role, bad body", async () => {
    const valid = {
      creative,
      href: `/dealerships/${dealerSlug}`,
      pages: ["home_top"],
      startDate: "2030-01-07",
      weeks: 1,
    }
    await send(null, valid)
    await send("user", valid)
    await send("admin", valid)
    await send("dealership", {})
    await send("dealership", { ...valid, weeks: 5 })
    await send("dealership", { ...valid, pages: [] })
    await send("dealership", { ...valid, startDate: "7 Jan" })
  })

  test("a link that is not the advertiser's, a page off sale, dates in the past", async () => {
    const valid = {
      creative,
      href: `/dealerships/${dealerSlug}`,
      pages: ["home_top"],
      startDate: "2030-01-07",
      weeks: 1,
    }
    await send("dealership", { ...valid, href: "/dealerships/someone-else" })
    await send("workshop", valid)
    await send("dealership", { ...valid, startDate: "2020-01-06" }, true)
    await send("dealership", { ...valid, pages: ["home_top", "nope"] })
  })
})
