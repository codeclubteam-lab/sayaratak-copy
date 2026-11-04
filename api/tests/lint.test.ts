import { afterAll, beforeAll, describe, expect, test } from "bun:test"
import { mkdir, rm } from "node:fs/promises"
import { z } from "zod"

// A17 lint rules (gate B9): each fixture breaks one rule and Biome must
// report exactly that rule. The fixtures are written into a scratch module
// under src/modules, because the rules are scoped by file path.
const API_ROOT = `${import.meta.dir}/..`
const FIXTURE_DIR = "src/modules/lint-fixture"
const FUNCTION_LINES = 45

const FIXTURES: Record<string, { file: string; source: string }> = {
  "lint/style/noRestrictedImports": {
    file: "lint-fixture.routes.ts",
    source: `import { getRow } from "./lint-fixture.queries"\nexport const row = getRow\n`,
  },
  "lint/complexity/noExcessiveLinesPerFunction": {
    file: "lint-fixture.service.ts",
    source: `export function long() {\n${"  void 0\n".repeat(FUNCTION_LINES)}}\n`,
  },
  "lint/nursery/noFloatingPromises": {
    file: "lint-fixture.mapper.ts",
    source: `async function load() {\n  return 1\n}\nexport function run() {\n  load()\n}\n`,
  },
}

const reportSchema = z.object({
  diagnostics: z.array(
    z.object({
      category: z.string(),
      location: z.object({ path: z.string() }),
    })
  ),
})

beforeAll(async () => {
  await mkdir(`${API_ROOT}/${FIXTURE_DIR}`, { recursive: true })
  for (const { file, source } of Object.values(FIXTURES)) {
    await Bun.write(`${API_ROOT}/${FIXTURE_DIR}/${file}`, source)
  }
})

afterAll(async () => {
  await rm(`${API_ROOT}/${FIXTURE_DIR}`, { recursive: true, force: true })
})

describe("A17 lint rules", () => {
  test("each fixture fails on its own rule", async () => {
    const run = Bun.spawn(
      ["bunx", "biome", "lint", FIXTURE_DIR, "--reporter=json"],
      { cwd: API_ROOT, stdout: "pipe", stderr: "ignore" }
    )
    const report = reportSchema.parse(await new Response(run.stdout).json())
    const found = report.diagnostics.map(
      (item) => `${item.category} ${item.location.path.split("/").pop()}`
    )
    const expected = Object.entries(FIXTURES).map(
      ([rule, { file }]) => `${rule} ${file}`
    )
    expect(found.sort()).toEqual(expected.sort())
  })

  test("no file switches a rule off with a suppression comment", async () => {
    const glob = new Bun.Glob("{src,scripts,tests}/**/*.ts")
    const marker = ["biome", "ignore"].join("-")
    for await (const path of glob.scan(API_ROOT)) {
      const text = await Bun.file(`${API_ROOT}/${path}`).text()
      expect(text.includes(marker) ? path : null).toBeNull()
    }
  })
})
