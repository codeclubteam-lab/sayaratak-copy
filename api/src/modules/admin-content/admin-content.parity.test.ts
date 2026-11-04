import { afterAll, beforeAll, describe, test } from "bun:test"

import { bothSessions, resetDb } from "../../../tests/helpers"
import { expectParity } from "../../../tests/parity"

// One admin sign-in for the whole file: the emailed code is capped per address.
let headers: Record<string, string> = {}

beforeAll(async () => {
  await resetDb()
  headers = {
    ...(await bothSessions("admin")),
    origin: "http://localhost:3000",
    "content-type": "application/json",
  }
})

// The mock's rows live for the whole run, so what the writes below change is put back.
afterAll(async () => {
  const { handleMock } = await import("../../../../web/src/mocks/router")
  await handleMock(
    new Request("http://localhost/api/mock/reset", { method: "POST" })
  )
  await resetDb()
})

const read = (path: string) => expectParity(path, { init: { headers } })
const write = (method: string, path: string, body: unknown) =>
  expectParity(path, {
    init: { method, headers, body: JSON.stringify(body) },
  })

describe("the pages match the mock", () => {
  test("read each page and an unknown one", async () => {
    for (const slug of ["about", "contact", "privacy", "terms", "nope"])
      await read(`/api/v1/admin/pages/${slug}`)
  })

  test("edit: a title, both parts, nothing, a half part and an unknown page", async () => {
    const path = (slug: string) => `/api/v1/admin/pages/${slug}`
    await write("PATCH", path("about"), {
      title: { ar: "عنا", en: "About us" },
    })
    await write("PATCH", path("about"), {
      title: { ar: "ا", en: "A" },
      body: { ar: "ب", en: "B" },
    })
    await write("PATCH", path("terms"), {})
    await write("PATCH", path("privacy"), { body: { ar: "x" } })
    await write("PATCH", path("nope"), {})
    await read(path("about"))
  })
})

describe("the settings match the mock", () => {
  test("read, edit and read again", async () => {
    const path = "/api/v1/admin/settings"
    await read(path)
    await write("PATCH", path, { listingExpiryDays: 45 })
    await write("PATCH", path, {
      autoApproveVerifiedDealers: false,
      bankakAccount: { name: "Sayaratak Co", number: "1234567" },
    })
    await write("PATCH", path, { backupSchedule: "weekly", locales: ["ar"] })
    await write("PATCH", path, { freeListingLimit: 6 })
    await write("PATCH", path, {})
    await write("PATCH", path, { listingExpiryDays: 0 })
    await write("PATCH", path, { backupSchedule: "hourly" })
    await read(path)
    await read("/api/v1/admin/plans")
  })
})
