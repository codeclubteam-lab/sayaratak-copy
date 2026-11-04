import { afterAll, beforeAll, describe, test } from "bun:test"

import { bothSessions, type DemoAccount, resetDb } from "../../../tests/helpers"
import { expectParity } from "../../../tests/parity"

beforeAll(resetDb)
// The mock keeps the changes below for the whole run; start the next suite clean.
afterAll(resetDb)

const ORIGIN = "http://localhost:3000"

const sent = async (
  as: DemoAccount,
  request: { method: string; path: string; body?: object }
) =>
  expectParity(`/api/v1${request.path}`, {
    init: {
      method: request.method,
      headers: {
        ...(await bothSessions(as)),
        origin: ORIGIN,
        "content-type": "application/json",
      },
      body: request.body && JSON.stringify(request.body),
    },
  })
const get = (as: DemoAccount) =>
  sent(as, { method: "GET", path: "/me/business" })
const patch = (as: DemoAccount, body: object) =>
  sent(as, { method: "PATCH", path: "/me/business", body })
const putImages = (as: DemoAccount, ids: string[]) =>
  sent(as, { method: "PUT", path: "/me/business/images", body: { ids } })

describe("GET /me/business matches the mock", () => {
  test("every business role", async () => {
    for (const as of ["dealership", "workshop", "mechanic"] as const)
      await get(as)
  })

  test("a private seller and an account with no business", async () => {
    await get("user")
    await get("new")
  })
})

describe("PATCH /me/business matches the mock", () => {
  test("a dealership's sections, then back", async () => {
    await patch("dealership", {
      name: { ar: "الأمين", en: "Al Amin" },
      description: "A new description.",
    })
    await patch("dealership", {
      phones: ["+249912345678"],
      whatsapp: null,
    })
    await patch("dealership", {
      address: "New street 5",
      location: null,
    })
    await patch("dealership", { verified: true })
  })

  test("a workshop's phone and a mechanic's availability and years", async () => {
    await patch("workshop", { phone: "+249900000001" })
    await patch("mechanic", {
      available: false,
      yearsOfExperience: 9,
      bio: "Nine years of repairs.",
    })
    await patch("mechanic", {
      servedCityIds: ["khartoum", "omdurman"],
    })
  })
})

describe("PUT /me/business/images matches the mock", () => {
  test("a reorder, an empty list and too many ids", async () => {
    const { ids } = await mineImages()
    await putImages("workshop", [...ids].reverse())
    await putImages("workshop", ids)
    await putImages(
      "workshop",
      Array.from({ length: 21 }, (_, i) => `x${i}`)
    )
  })

  test("a dealership is refused", async () => {
    await putImages("dealership", [])
  })
})

async function mineImages() {
  const { app } = await import("~/app")
  const res = await app.request("/api/v1/me/business", {
    headers: await bothSessions("workshop"),
  })
  const body = (await res.json()) as { images: { id: string }[] }
  return { ids: body.images.map((image) => image.id) }
}
