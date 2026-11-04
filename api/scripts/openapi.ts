import { app } from "~/app"
import { buildOpenApi } from "~/shared/openapi/build"

// `bun run openapi`: writes the contract the apps build against (A18). The
// file is committed; tests/openapi.test.ts fails when it is stale.
export const OPENAPI_FILE = `${import.meta.dir}/../openapi.json`

export function renderOpenApi() {
  return `${JSON.stringify(buildOpenApi(app), null, 2)}\n`
}

if (import.meta.main) await Bun.write(OPENAPI_FILE, renderOpenApi())
