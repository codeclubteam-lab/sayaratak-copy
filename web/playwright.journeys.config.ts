import process from "node:process"
import { defineConfig } from "@playwright/test"

import type { Options } from "./e2e/journeys/fixtures"

// End-to-end journeys (14.8, 11.5): each journey resets postgres-test, so they run one at a time
// on their own server (3102) backed by the test-mode API (4000), building with that suite's origins.
const port = 3102
const apiPort = 4000
const databaseUrl =
  process.env.DATABASE_URL ??
  "postgres://sayaratak:sayaratak@localhost:5434/sayaratak"
if (!URL.canParse(databaseUrl))
  throw new Error("journeys require local postgres-test")
const database = new URL(databaseUrl)
if (
  !["postgres:", "postgresql:"].includes(database.protocol) ||
  !["localhost", "127.0.0.1", "[::1]"].includes(database.hostname) ||
  database.port !== "5434" ||
  database.pathname !== "/sayaratak" ||
  database.search ||
  database.hash
)
  throw new Error("journeys require local postgres-test on port 5434")
process.env.API_BASE_URL = `http://localhost:${apiPort}`
const authSecret =
  process.env.BETTER_AUTH_SECRET ?? "e2e-test-auth-secret-0123456789abcdef"

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
  webServer: [
    {
      command:
        "bun --no-env-file --cwd ../api scripts/migrate.ts && bun --no-env-file --cwd ../api src/index.ts",
      url: `http://localhost:${apiPort}/api/health/ready`,
      reuseExistingServer: false,
      timeout: 120_000,
      env: {
        NODE_ENV: "test",
        APP_ENV: "test",
        LOG_REQUESTS: "false",
        PORT: String(apiPort),
        DATABASE_URL: databaseUrl,
        TEST_DATABASE_URL: databaseUrl,
        MIGRATE_DATABASE_URL: "",
        BETTER_AUTH_SECRET: authSecret,
        BETTER_AUTH_URL: `http://localhost:${port}`,
        WEB_ORIGIN: `http://localhost:${port}`,
        COOKIE_DOMAIN: "",
        CLIENT_IP_MODE: "socket",
        SMTP_HOST: "",
      },
    },
    {
      command: "bun run build && bun run start",
      url: `http://localhost:${port}/ar`,
      reuseExistingServer: false,
      timeout: 600_000,
      env: {
        PORT: String(port),
        APP_ORIGIN: `http://localhost:${port}`,
        API_BASE_URL: `http://localhost:${apiPort}`,
        VITE_API_BASE_URL: `http://localhost:${port}`,
        CLIENT_IP_MODE: "socket",
      },
    },
  ],
})
