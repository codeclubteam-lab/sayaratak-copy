import { afterAll, beforeAll, describe, test } from "bun:test"

import { fileOf } from "../../../tests/files"
import { bothSessions, type DemoAccount, resetDb } from "../../../tests/helpers"
import { expectParity } from "../../../tests/parity"

beforeAll(resetDb)
afterAll(resetDb)

const read = async (as: DemoAccount | null) =>
  expectParity("/api/v1/me/verification", {
    init: { headers: as ? await bothSessions(as) : {} },
  })

// The mock reads the multipart body itself; the same bytes go to both sides.
const send = async (
  as: DemoAccount | null,
  documents: { label: string; file: File }[],
  note?: string
) => {
  const form = new FormData()
  for (const { label, file } of documents) {
    form.append("label", label)
    form.append("file", file)
  }
  if (note !== undefined) form.set("note", note)
  return expectParity("/api/v1/me/verification", {
    init: {
      method: "POST",
      headers: {
        ...(as ? await bothSessions(as) : {}),
        origin: "http://localhost:3000",
      },
      body: form,
    },
  })
}
const doc = (label = "workshop_license") => ({ label, file: fileOf("jpeg") })

describe("GET /me/verification matches the mock", () => {
  test("every account (none has asked yet) and signed out", async () => {
    for (const as of [
      "user",
      "dealership",
      "workshop",
      "mechanic",
      "admin",
    ] as const)
      await read(as)
    await read(null)
  })
})

describe("POST /me/verification answers as the mock does when it fails", () => {
  test("signed out, no business role, already verified, bad documents or note", async () => {
    await send(null, [doc()])
    await send("user", [doc()])
    await send("dealership", [doc()])
    await send("workshop", [])
    await send(
      "workshop",
      Array.from({ length: 6 }, () => doc())
    )
    await send("workshop", [doc("selfie")])
    await send("workshop", [doc()], "x".repeat(301))
  })
})
