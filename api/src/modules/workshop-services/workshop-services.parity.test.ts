import { afterAll, beforeAll, describe, test } from "bun:test"

import { app } from "~/app"

import { bothSessions, type DemoAccount, resetDb } from "../../../tests/helpers"
import { expectParity } from "../../../tests/parity"

beforeAll(resetDb)
// The mock keeps the changes below for the whole run; start the next suite clean.
afterAll(resetDb)

const sent = async (
  as: DemoAccount,
  request: { method: string; path: string; body?: object }
) =>
  expectParity(`/api/v1${request.path}`, {
    init: {
      method: request.method,
      headers: {
        ...(await bothSessions(as)),
        origin: "http://localhost:3000",
        "content-type": "application/json",
      },
      body: request.body && JSON.stringify(request.body),
    },
  })

async function services() {
  const res = await app.request("/api/v1/me/services", {
    headers: await bothSessions("workshop"),
  })
  return (await res.json()) as { id: string; templateId: string | null }[]
}

describe("/me/services matches the mock", () => {
  test("the list, and who may read it", async () => {
    await sent("workshop", { method: "GET", path: "/me/services" })
    await sent("dealership", { method: "GET", path: "/me/services" })
    await sent("user", { method: "GET", path: "/me/services" })
  })

  test("a full reorder, a change, a price cleared and an unknown id", async () => {
    const rows = await services()
    const ids = rows.map((row) => row.id)
    const [first = ""] = ids
    // The web sends the whole form, template link included. Without it the mock
    // clears the link and the api keeps it (a Deviation row in progress.md).
    const templateId = rows[0]?.templateId ?? null
    await sent("workshop", {
      method: "POST",
      path: "/me/services/reorder",
      body: { ids: [...ids].reverse() },
    })
    await sent("workshop", {
      method: "POST",
      path: "/me/services/reorder",
      body: { ids },
    })
    await sent("workshop", {
      method: "PATCH",
      path: `/me/services/${first}`,
      body: {
        name: "Renamed",
        description: "Now with a note",
        priceFrom: 12000,
        templateId,
      },
    })
    await sent("workshop", {
      method: "PATCH",
      path: `/me/services/${first}`,
      body: { priceFrom: null, templateId },
    })
    await sent("workshop", {
      method: "PATCH",
      path: "/me/services/svc-missing",
      body: { name: "x" },
    })
    await sent("workshop", {
      method: "DELETE",
      path: "/me/services/svc-missing",
    })
  })
})
