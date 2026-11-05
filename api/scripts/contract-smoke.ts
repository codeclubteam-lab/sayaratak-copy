import assert from "node:assert/strict"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { fixture } from "./contract-fixture"

// Runs with the CI-installed oasdiff binary, without a database or service keys.
const CHECKER = `${import.meta.dir}/check-api-contract.ts`
const CONTRACT = `${import.meta.dir}/../openapi.json`
const directory = await mkdtemp(join(tmpdir(), "sayaratak-contract-"))
const baseFile = join(directory, "base.json")
const revisionFile = join(directory, "revision.json")

function compare(base: string, revision: string) {
  const result = Bun.spawnSync(["bun", CHECKER, base, revision])
  return {
    exitCode: result.exitCode,
    output: result.stdout.toString() + result.stderr.toString(),
  }
}

async function check(
  label: string,
  edit: (probe: ReturnType<typeof fixture>) => void,
  expected: {
    exitCode: number
    checkId?: string
    prepare?: (probe: ReturnType<typeof fixture>) => void
  }
) {
  const base = fixture()
  expected.prepare?.(base)
  await Bun.write(baseFile, JSON.stringify(base.document))
  const probe = structuredClone(base)
  edit(probe)
  await Bun.write(revisionFile, JSON.stringify(probe.document))
  const result = compare(baseFile, revisionFile)
  assert.equal(result.exitCode, expected.exitCode, `${label}: ${result.output}`)
  if (expected.checkId) {
    assert.ok(result.output.includes(expected.checkId), result.output)
  }
  await Bun.write(Bun.stdout, `PASS ${label}\n`)
}

try {
  const actual = compare(CONTRACT, CONTRACT)
  assert.equal(actual.exitCode, 0, actual.output)
  await check("unchanged contract", () => {}, { exitCode: 0 })
  await check(
    "additive fields",
    ({ request, response }) => {
      request.properties.extra = { type: "string" }
      response.properties.extra = { type: "string" }
    },
    { exitCode: 0 }
  )
  await check(
    "removed required response field",
    ({ response }) => {
      delete response.properties.id
      response.required = ["state"]
    },
    { exitCode: 1, checkId: "response-required-property-removed" }
  )
  await check(
    "removed optional response field",
    ({ response }) => {
      delete response.properties.note
    },
    { exitCode: 1, checkId: "response-optional-property-removed" }
  )
  await check(
    "removed response enum value",
    ({ response }) => {
      response.properties.state = { type: "string", enum: ["active"] }
    },
    { exitCode: 1, checkId: "response-property-enum-value-removed" }
  )
  await check(
    "new required input",
    ({ request }) => {
      request.required = ["name"]
    },
    { exitCode: 1, checkId: "request-property-became-required" }
  )
  await check(
    "changed response type",
    ({ response }) => {
      response.properties.id = { type: "integer" }
    },
    { exitCode: 1, checkId: "response-property-type-changed" }
  )
  await check(
    "removed v1 route",
    ({ document }) => {
      delete document.paths["/api/v1/probe"]
    },
    { exitCode: 1, checkId: "api-path-removed-without-deprecation" }
  )
  await check(
    "widened request type",
    ({ request }) => {
      request.properties.name = { type: "number" }
    },
    {
      exitCode: 1,
      checkId: "request-property-type-generalized",
      prepare: ({ request }) => {
        request.properties.name = { type: "integer" }
      },
    }
  )
  await check(
    "narrowed response type",
    ({ response }) => {
      response.properties.id = { type: "integer" }
    },
    {
      exitCode: 1,
      checkId: "response-property-type-specialized",
      prepare: ({ response }) => {
        response.properties.id = { type: "number" }
      },
    }
  )
  await check(
    "deprecated response field removal after sunset",
    ({ response }) => {
      delete response.properties.id
      response.required = ["state"]
    },
    {
      exitCode: 1,
      checkId: "response-required-property-removed",
      prepare: ({ response }) => {
        response.properties.id = {
          type: "string",
          deprecated: true,
          "x-sunset": "2000-01-01",
        }
      },
    }
  )
  await check(
    "deprecated v1 route removal after sunset",
    ({ document }) => {
      delete document.paths["/api/v1/probe"]
    },
    {
      exitCode: 1,
      checkId: "api-path-removed-without-deprecation",
      prepare: ({ document }) => {
        const route = document.paths["/api/v1/probe"]
        assert.ok(route)
        Object.assign(route.post, {
          deprecated: true,
          "x-sunset": "2000-01-01",
        })
      },
    }
  )
  await check(
    "new v1 route",
    ({ document }) => {
      const route = fixture().document.paths["/api/v1/probe"]
      assert.ok(route)
      document.paths["/api/v1/new-probe"] = route
    },
    { exitCode: 0 }
  )
  await check(
    "new v2 route keeps v1",
    ({ document }) => {
      const route = fixture().document.paths["/api/v1/probe"]
      assert.ok(route)
      document.paths["/api/v2/probe"] = route
    },
    { exitCode: 0 }
  )
} finally {
  await rm(directory, { recursive: true, force: true })
}
