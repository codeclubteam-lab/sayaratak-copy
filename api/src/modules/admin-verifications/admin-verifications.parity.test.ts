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

// The seeded documents are served from `/demo` here and from `/mock` by the mock: the same files.
const sameDocuments = (body: unknown) =>
  JSON.parse(JSON.stringify(body).replaceAll("/demo/doc-", "/mock/doc-"))

const read = (path: string) =>
  expectParity(path, { init: { headers }, ignore: sameDocuments })
const write = (path: string, body?: unknown) =>
  expectParity(path, {
    ignore: sameDocuments,
    init: {
      method: "POST",
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    },
  })

describe("GET /admin/verifications matches the mock", () => {
  test("the queue with each filter", async () => {
    for (const query of [
      "",
      "?page=2",
      "?pageSize=2&page=2",
      "?status=pending",
      "?status=approved",
      "?status=rejected",
      "?status=nope",
      "?id=vr-1",
      "?id=vr-6",
      "?id=nope",
      "?q=zzzz",
      "?q=kassala",
      "?q=%D9%83%D8%B3%D9%84%D8%A7",
    ])
      await read(`/api/v1/admin/verifications${query}`)
  })
})

describe("the decisions match the mock", () => {
  test("approve, reject and the refusals", async () => {
    await write("/api/v1/admin/verifications/vr-1/approve")
    await write("/api/v1/admin/verifications/vr-1/approve")
    await write("/api/v1/admin/verifications/vr-2/reject", {
      reason: "Blurry photos",
    })
    await write("/api/v1/admin/verifications/vr-2/reject", { reason: "Again" })
    await write("/api/v1/admin/verifications/vr-3/reject", {})
    await write("/api/v1/admin/verifications/vr-5/approve")
    await write("/api/v1/admin/verifications/vr-6/reject", { reason: "x" })
    await write("/api/v1/admin/verifications/nope/approve")
    await write("/api/v1/admin/verifications/nope/reject", { reason: "x" })
    await read("/api/v1/admin/verifications")
  })
})
