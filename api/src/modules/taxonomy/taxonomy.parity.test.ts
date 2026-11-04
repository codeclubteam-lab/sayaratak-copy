import { beforeAll, test } from "bun:test"

import { resetDb } from "../../../tests/helpers"
import { expectParity } from "../../../tests/parity"

beforeAll(resetDb)

test("GET /taxonomy matches the mock", async () => {
  await expectParity("/api/v1/taxonomy")
})
