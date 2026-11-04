import { expect, test } from "bun:test"

import { OPENAPI_FILE, renderOpenApi } from "../scripts/openapi"
import { req } from "./helpers"

test("the committed openapi.json is current (run `bun run openapi`)", async () => {
  expect(await Bun.file(OPENAPI_FILE).text()).toBe(renderOpenApi())
})

test("GET /api/v1/openapi.json serves the same contract", async () => {
  const res = await req("/openapi.json")
  expect(res.status).toBe(200)
  expect(`${JSON.stringify(await res.json(), null, 2)}\n`).toBe(renderOpenApi())
})
