import { beforeAll, describe, test } from "bun:test"

import { bothSessions, resetDb } from "../../../tests/helpers"
import { expectParity } from "../../../tests/parity"

let headers: Record<string, string> = {}

beforeAll(async () => {
  await resetDb()
  headers = {
    ...(await bothSessions("admin")),
    origin: "http://localhost:3000",
  }
})

// Taking a backup is left out: the mock answers `running` with a made-up size, the api answers `ready` (a deviation).
describe("the backup list matches the mock", () => {
  test("seeded rows, newest first", async () => {
    await expectParity("/api/v1/admin/backups", { init: { headers } })
  })
})
