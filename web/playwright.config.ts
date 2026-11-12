import process from "node:process"
import { defineConfig } from "@playwright/test"

// End-to-end tests run against the production build on port 3100 (3000 is the dev server)
// backed by the real API in test mode on port 4000 (`postgres-test`).
const port = 3100
const apiPort = 4000
const proxyPort = 4099
const states = process.env.STATES === "1"
const databaseUrl =
  process.env.DATABASE_URL ??
  "postgres://sayaratak:sayaratak@localhost:5434/sayaratak"
if (!URL.canParse(databaseUrl))
  throw new Error("E2E requires local postgres-test")
const database = new URL(databaseUrl)
if (
  !["postgres:", "postgresql:"].includes(database.protocol) ||
  !["localhost", "127.0.0.1", "[::1]"].includes(database.hostname) ||
  database.port !== "5434" ||
  database.pathname !== "/sayaratak" ||
  database.search ||
  database.hash
)
  throw new Error("E2E requires local postgres-test on port 5434")
process.env.API_BASE_URL = `http://localhost:${apiPort}`
const authSecret =
  process.env.BETTER_AUTH_SECRET ?? "e2e-test-auth-secret-0123456789abcdef"

export default defineConfig({
  testDir: "e2e",
  globalSetup: "./e2e/global-setup.ts",
  fullyParallel: true,
  workers: 2,
  timeout: 60_000,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: `http://localhost:${port}`,
    channel: "chrome",
    trace: "retain-on-failure",
  },
  projects: [{ name: "chrome" }],
  testIgnore: states
    ? [/journeys/, /same-origin/]
    : [/states/, /journeys/, /same-origin/],
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
    ...(states
      ? [
          {
            command: "bun e2e/states-proxy.ts",
            url: `http://localhost:${proxyPort}/api/health/ready`,
            reuseExistingServer: false,
            timeout: 30_000,
            env: {
              STATES_PROXY_PORT: String(proxyPort),
              STATES_API_TARGET: `http://localhost:${apiPort}`,
            },
          },
        ]
      : []),
    {
      command: "bun run build && bun run start",
      url: `http://localhost:${port}/ar`,
      reuseExistingServer: false,
      timeout: 600_000,
      env: {
        PORT: String(port),
        APP_ORIGIN: `http://localhost:${port}`,
        API_BASE_URL: `http://localhost:${states ? proxyPort : apiPort}`,
        VITE_API_BASE_URL: `http://localhost:${port}`,
        CLIENT_IP_MODE: "socket",
      },
    },
  ],
})
