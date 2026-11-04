import { defineConfig } from "@playwright/test"

// End-to-end tests run against the production build on port 3100 (3000 is the dev server).
const port = 3100
// The states sweep (14.6) is slow, so it runs only with `bun run test:states`, and it also needs a second server with empty mock data. The script builds first, so the two servers do not build at once.
const states = process.env.STATES === "1"
const emptyPort = 3101
const server = (p: number, env = "") => ({
  command: `${states ? "" : "bun run build && "}${env}PORT=${p} API_BASE_URL=http://localhost:${p} bun run start`,
  url: `http://localhost:${p}/ar`,
  reuseExistingServer: true,
  timeout: 600_000,
})

export default defineConfig({
  testDir: "e2e",
  fullyParallel: true,
  workers: 4,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: `http://localhost:${port}`,
    channel: "chrome",
    trace: "retain-on-failure",
  },
  projects: [{ name: "chrome" }],
  // The journeys (14.8) have their own config: they reset the shared mock DB, so they cannot run beside these.
  testIgnore: states ? [/journeys/] : [/states/, /journeys/],
  webServer: [
    server(port),
    ...(states ? [server(emptyPort, "MOCK_EMPTY=true ")] : []),
  ],
})
