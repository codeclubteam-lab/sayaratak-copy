import { defineConfig } from "@playwright/test"

import type { Options } from "./e2e/journeys/fixtures"

// End-to-end journeys (14.8). The mock DB is one per server and every journey resets it, so they run one at a time
// on their own server (3102), apart from the smoke suite. `bun run test:journeys` builds first.
const port = 3102
const run = (lang: "ar" | "en", width: number) => ({
  name: `${lang}-${width}`,
  use: { lang, viewport: { width, height: 900 } },
  // Only J1 and J4 run in English.
  grep: lang === "en" ? /@en/ : undefined,
})

export default defineConfig<Options>({
  testDir: "e2e/journeys",
  workers: 1,
  timeout: 120_000,
  expect: { timeout: 10_000 },
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: `http://localhost:${port}`,
    channel: "chrome",
    trace: "retain-on-failure",
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
  },
  projects: [run("ar", 390), run("ar", 1280), run("en", 390), run("en", 1280)],
  webServer: {
    command: `PORT=${port} API_BASE_URL=http://localhost:${port} bun run start`,
    url: `http://localhost:${port}/ar`,
    reuseExistingServer: true,
    timeout: 120_000,
  },
})
