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
  testIgnore: states ? [/journeys/] : [/states/, /journeys/],
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
        BETTER_AUTH_SECRET: authSecret,
        BETTER_AUTH_URL: `http://localhost:${apiPort}`,
        WEB_ORIGIN: `http://localhost:${port}`,
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
      command: `${states ? "" : "bun run build && "}bun run start`,
      url: `http://localhost:${port}/ar`,
      reuseExistingServer: false,
      timeout: 600_000,
      env: {
        PORT: String(port),
        APP_ORIGIN: `http://localhost:${port}`,
        API_BASE_URL: `http://localhost:${states ? proxyPort : apiPort}`,
        VITE_API_BASE_URL: `http://localhost:${apiPort}`,
      },
    },
  ],
})
