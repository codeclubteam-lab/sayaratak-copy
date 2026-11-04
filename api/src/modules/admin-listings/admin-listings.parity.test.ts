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
const write = (path: string, body: unknown, method = "POST") =>
  expectParity(path, {
    init: { method, headers, body: JSON.stringify(body) },
  })

describe("GET /admin/moderation matches the mock", () => {
  test("the queue with each filter", async () => {
    for (const query of [
      "",
      "?type=truck",
      "?type=car",
      "?type=part",
      "?sellerKind=individual",
      "?sellerKind=dealership",
      "?sellerKind=verified",
      "?q=l0008",
      "?q=toyota",
      "?q=كرولا",
      "?pageSize=3&page=2",
    ])
      await read(`/api/v1/admin/moderation${query}`)
  })
})

describe("GET /admin/listings matches the mock", () => {
  test("the table with each filter", async () => {
    for (const query of [
      "",
      "?page=2",
      "?pageSize=7&page=3",
      "?moderation=pending",
      "?moderation=rejected",
      "?moderation=draft",
      "?status=sold",
      "?ownerId=u-dealer",
      "?promoted=yes",
      "?promoted=no&pageSize=50",
      "?sellerKind=verified",
      "?sellerKind=individual&type=motorcycle",
      "?type=part",
      "?id=l00001",
      "?cityId=khartoum",
      "?q=l0000",
      "?q=zzzz",
    ])
      await read(`/api/v1/admin/listings${query}`)
  })
})

describe("the moderation writes match the mock", () => {
  test("approve, remove, restore, reject, bulk and a status change", async () => {
    await write("/api/v1/admin/listings/l0008d/approve", {})
    await write("/api/v1/admin/listings/l0008d/remove", {})
    await write("/api/v1/admin/listings/l0008d/restore", {})
    await write("/api/v1/admin/listings/l0008e/reject", { reason: "Blurry" })
    await write("/api/v1/admin/listings/bulk", {
      ids: ["l0008f", "l0008g", "l0008l"],
      action: "approve",
    })
    await write("/api/v1/admin/listings/l00002", { status: "sold" }, "PATCH")
  })

  test("a missing reason, an unknown listing and no ids", async () => {
    await write("/api/v1/admin/listings/l0008h/reject", {})
    await write("/api/v1/admin/listings/l0008h/reject", { reason: " " })
    await write("/api/v1/admin/listings/nope/approve", {})
    await write("/api/v1/admin/listings/bulk", { ids: [], action: "approve" })
    await write("/api/v1/admin/listings/bulk", {
      ids: ["l0008h"],
      action: "reject",
    })
  })
})
