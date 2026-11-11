import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import process from "node:process"
import type { FullConfig } from "@playwright/test"

import { resetDb, seedSessionFile } from "./auth"

// Seeds postgres-test and writes one cached cookie jar per demo role so
// smoke/a11y/states never exceed admin's 5 codes/hour cap across workers.
export default async function globalSetup(config: FullConfig) {
  const mode = process.env.STATES_EMPTY === "1" ? "empty" : "reset"
  await resetDb(mode)
  const origin = config.projects[0]?.use.baseURL ?? "http://localhost:3100"
  const dir = mkdtempSync(join(tmpdir(), "sayaratak-e2e-"))
  process.env.SY_E2E_SESSIONS = await seedSessionFile(dir, origin)
  return () => {
    rmSync(dir, { recursive: true, force: true })
  }
}
