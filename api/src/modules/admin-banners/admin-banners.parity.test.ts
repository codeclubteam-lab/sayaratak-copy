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

const write = (method: string, path: string, body?: unknown) =>
  expectParity(path, {
    init: {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    },
  })

// Adding a banner is left out: the mock keeps any address, the api wants the admin's own uploads (a deviation).
describe("the banner admin matches the mock", () => {
  test("read, edit (with the pictures sent again), refuse and delete", async () => {
    const same = { ar: "/mock/banner-1.webp", en: "/mock/banner-1.webp" }
    await write("GET", "/api/v1/admin/banners")
    await write("PATCH", "/api/v1/admin/banners/bn-1", {
      title: "New title",
      focus: 80,
      sponsored: true,
      imageUrl: same,
    })
    await write("PATCH", "/api/v1/admin/banners/bn-2", {
      active: false,
      sortOrder: 20,
      href: "/search",
      placement: "search_top",
    })
    await write("PATCH", "/api/v1/admin/banners/bn-3", {})
    await write("PATCH", "/api/v1/admin/banners/bn-3", { focus: 101 })
    await write("PATCH", "/api/v1/admin/banners/nope", { focus: 1 })
    await write("POST", "/api/v1/admin/banners", {})
    await write("DELETE", "/api/v1/admin/banners/bn-4")
    await write("DELETE", "/api/v1/admin/banners/bn-4")
    await write("GET", "/api/v1/admin/banners")
  })
})
