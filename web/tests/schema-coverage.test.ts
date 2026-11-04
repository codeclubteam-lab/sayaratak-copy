// @vitest-environment node
import { readFileSync, readdirSync } from "node:fs"
import { join } from "node:path"
import { expect, it } from "vitest"
import { z } from "zod"

// Every schema in packages/shared and the feature folders is named in a test (enums are checked one by one in schema-responses), and every message key a schema can return is asserted somewhere.
const modules = import.meta.glob<Record<string, unknown>>(
  [
    "../../packages/shared/src/schemas/*.ts",
    "../../packages/shared/src/*/schemas.ts",
    "../src/features/*/schemas.ts",
  ],
  { eager: true }
)
const sources = import.meta.glob<string>(
  [
    "../../packages/shared/src/schemas/*.ts",
    "../../packages/shared/src/*/schemas.ts",
    "../src/features/*/schemas.ts",
  ],
  { eager: true, query: "?raw", import: "default" }
)
const testsDir = join(process.cwd(), "tests")
const tests = readdirSync(testsDir)
  .filter((f) => /\.tsx?$/.test(f))
  .map((f) => readFileSync(join(testsDir, f), "utf8"))
  .join("\n")
const named = (name: string) => new RegExp(`\\b${name}\\b`).test(tests)

it("every exported schema is named in a test", () => {
  const missing = Object.entries(modules).flatMap(([file, m]) =>
    Object.entries(m)
      .filter(
        ([name, value]) =>
          (value instanceof z.ZodType && !(value instanceof z.ZodEnum)) ||
          (typeof value === "function" && name.endsWith("Schema"))
      )
      .filter(([name]) => !named(name))
      .map(([name]) => `${file} ${name}`)
  )
  expect(missing).toEqual([])
})

it("every message key a schema returns is asserted in a test", () => {
  const keys = new Set(
    Object.values(sources).flatMap((s) => s.match(/validation\.\w+/g) ?? [])
  )
  expect([...keys].filter((k) => !tests.includes(`"${k}"`))).toEqual([])
})

// Every function exported from src/lib is named in a test. Server functions run only inside a TanStack Start request; the e2e smoke suite covers them (locale from path, cookie and header).
const lib = import.meta.glob<Record<string, unknown>>(
  [
    "../src/lib/**/*.ts",
    "../src/lib/**/*.tsx",
    "!../src/lib/api/forwarded-cookie.ts",
    "!../src/lib/i18n/server.ts",
  ],
  { eager: true }
)
it("every lib function is named in a test", () => {
  const missing = Object.entries(lib).flatMap(([file, m]) =>
    Object.entries(m)
      .filter(([, value]) => typeof value === "function")
      .filter(([name]) => !named(name))
      .map(([name]) => `${file} ${name}`)
  )
  expect(missing).toEqual([])
})
