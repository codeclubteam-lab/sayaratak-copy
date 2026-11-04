import { afterAll, beforeAll, describe, test } from "bun:test"

import { flushFanOut } from "~/modules/notifications/notifications.fanout.service"

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

// A broadcast made here gets a random id on each side.
const sameIds = (body: unknown) =>
  JSON.parse(JSON.stringify(body).replace(/"bc-[A-Za-z0-9_-]{8}"/g, '"bc-new"'))

// While a broadcast is going, each side is at its own point (the api waits for its job, the mock for
// a timer), so the progress is left out until both are done.
const withoutProgress = (body: unknown) =>
  JSON.parse(
    JSON.stringify(sameIds(body), (key, value) =>
      key === "status" || key === "recipients" ? "-" : value
    )
  )
const read = (path: string, ignore = sameIds) =>
  expectParity(path, { init: { headers }, ignore })
const send = (body: unknown) =>
  expectParity("/api/v1/admin/broadcasts", {
    ignore: sameIds,
    init: { method: "POST", headers, body: JSON.stringify(body) },
  })

describe("the broadcast admin matches the mock", () => {
  test("estimates for each audience", async () => {
    for (const query of [
      "roles=user",
      "roles=dealership&roles=workshop",
      "roles=mechanic&verifiedOnly=true",
      "roles=dealership&verifiedOnly=true",
      "roles=user&verifiedOnly=true",
      "roles=dealership&cityId=khartoum",
      "roles=dealership&roles=workshop&roles=mechanic&cityId=omdurman&verifiedOnly=true",
      "roles=dealership&cityId=",
      "roles=dealership&cityId=nowhere",
      "",
      "roles=admin",
    ])
      await read(`/api/v1/admin/broadcasts/estimate?${query}`)
  })

  test("sends, then reads the history with and without a search", async () => {
    const message = {
      title: { ar: "أهلا", en: "Hello" },
      body: { ar: "رسالة", en: "A message" },
    }
    await read("/api/v1/admin/broadcasts")
    await send({ ...message, roles: ["dealership"], verifiedOnly: false })
    await send({
      ...message,
      title: { ar: "عرض", en: "Offer" },
      roles: ["mechanic", "workshop"],
      cityId: "khartoum",
      verifiedOnly: true,
      href: "/search",
    })
    await send({ ...message, roles: [], verifiedOnly: false })
    await send({ ...message, roles: ["user"] })
    await send({ ...message, roles: ["user"], verifiedOnly: false, href: "x" })
    await read("/api/v1/admin/broadcasts", withoutProgress)

    // The api's pass (started after each Send) ends, and the mock's timer (1.5 s) rings its bells.
    await flushFanOut()
    await Bun.sleep(2000)
    await read("/api/v1/admin/broadcasts")
    await read("/api/v1/admin/broadcasts?q=offer")
    await read("/api/v1/admin/broadcasts?pageSize=1&page=2")
  })
})
