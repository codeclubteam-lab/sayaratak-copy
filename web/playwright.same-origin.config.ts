import { readFileSync } from "node:fs"
import process from "node:process"
import { defineConfig } from "@playwright/test"

// Validate before a server, migration or reset-capable fixture can be loaded.
const databaseUrl =
  process.env.DATABASE_URL ??
  "postgres://sayaratak:sayaratak@localhost:5434/sayaratak"
if (!URL.canParse(databaseUrl))
  throw new Error("same-origin tests require a valid local postgres-test URL")
const database = new URL(databaseUrl)
if (
  !["postgres:", "postgresql:"].includes(database.protocol) ||
  !["localhost", "127.0.0.1", "[::1]"].includes(database.hostname) ||
  database.port !== "5434" ||
  database.pathname !== "/sayaratak" ||
  database.search ||
  database.hash
)
  throw new Error(
    "same-origin tests require the local postgres-test database on port 5434"
  )

const https = process.env.SAME_ORIGIN_HTTPS === "1"
const origin = `${https ? "https" : "http"}://localhost:3103`
const upstream = "http://127.0.0.1:4000"
const secret = "same-origin-local-proxy-key-0123456789abcdef"
const observations = "/tmp/opencode/render-repair-task5/observations.jsonl"
process.env.API_BASE_URL = upstream
process.env.DATABASE_URL = databaseUrl
process.env.SAME_ORIGIN_OBSERVATIONS = observations

// Only the provider is faked. The application, auth, file store and DB remain real test-mode code.
const apiEntry = String.raw`
import { appendFileSync, writeFileSync } from "node:fs";
const realFetch = globalThis.fetch;
globalThis.fetch = Object.assign(async (input, init) => {
  const url = new URL(input instanceof Request ? input.url : String(input));
  if (url.host !== "oauth2.googleapis.com") return realFetch(input, init);
  const part = value => Buffer.from(JSON.stringify(value)).toString("base64url");
  return Response.json({ access_token: "local-provider-token", token_type: "Bearer", expires_in: 3600,
    id_token: part({alg:"none"}) + "." + part({sub:"local-google",name:"Local Google",email:"oauth@same-origin.test",email_verified:true}) + "." });
}, { preconnect: realFetch.preconnect });
const { app } = await import("./src/app");
const { verifyClientIp } = await import("@sayaratak/shared/lib/proxy-client-ip");
writeFileSync(process.env.SAME_ORIGIN_OBSERVATIONS, "");
Bun.serve({ hostname: "127.0.0.1", port: 4000, idleTimeout: 120, async fetch(request) {
  const response = await app.fetch(request);
  if (new URL(request.url).pathname === "/api/v1/me" && response.ok) {
    const viewer = await response.clone().json();
    const ip = verifyClientIp(request, {secret:process.env.PROXY_CLIENT_IP_SECRET, origin:process.env.API_PUBLIC_ORIGIN, now:Date.now()});
    appendFileSync(process.env.SAME_ORIGIN_OBSERVATIONS, JSON.stringify({ip, userId:viewer?.id ?? null, ssr:!request.headers.has("sec-fetch-mode")}) + "\n");
  }
  return response;
}});
`

const apiEnv = {
  NODE_ENV: "test",
  APP_ENV: "test",
  LOG_REQUESTS: "false",
  DATABASE_URL: databaseUrl,
  TEST_DATABASE_URL: databaseUrl,
  MIGRATE_DATABASE_URL: "",
  BETTER_AUTH_SECRET: "same-origin-local-auth-secret-0123456789abcdef",
  BETTER_AUTH_URL: origin,
  WEB_ORIGIN: origin,
  COOKIE_DOMAIN: "",
  CLIENT_IP_MODE: "render",
  PROXY_CLIENT_IP_SECRET: secret,
  API_PUBLIC_ORIGIN: upstream,
  GOOGLE_CLIENT_ID: "local-google-id",
  GOOGLE_CLIENT_SECRET: "local-google-secret",
  SMTP_HOST: "",
  SMTP_USER: "",
  SMTP_PASS: "",
  CLOUDINARY_URL: "",
  FCM_SERVICE_ACCOUNT: "",
  R2_ACCOUNT_ID: "",
  R2_ACCESS_KEY_ID: "",
  R2_SECRET_ACCESS_KEY: "",
  SAME_ORIGIN_OBSERVATIONS: observations,
}

export default defineConfig({
  testDir: "e2e/same-origin",
  workers: 1,
  fullyParallel: false,
  timeout: 120_000,
  expect: { timeout: 15_000 },
  reporter: [["list"]],
  use: {
    baseURL: origin,
    channel: "chrome",
    ignoreHTTPSErrors: false,
    trace: "off",
    extraHTTPHeaders: { "cf-connecting-ip": "192.0.2.31" },
    launchOptions: { args: ["--test-third-party-cookie-phaseout"] },
  },
  projects: [390, 1280].map((width) => ({
    name: `${https ? "https" : "http"}-${width}`,
    use: { viewport: { width, height: 900 } },
  })),
  webServer: [
    {
      command: `bun --no-env-file --cwd ../api scripts/migrate.ts && bun --no-env-file --cwd ../api -e '${apiEntry.replaceAll("'", "'\\''")}'`,
      url: `${upstream}/api/health/ready`,
      reuseExistingServer: false,
      timeout: 120_000,
      env: apiEnv,
    },
    {
      command: "bun run build && bun --no-env-file run start",
      url: `${origin}/favicon.ico`,
      reuseExistingServer: false,
      timeout: 600_000,
      env: {
        PORT: "3103",
        NITRO_HOST: "localhost",
        APP_ORIGIN: origin,
        API_BASE_URL: upstream,
        VITE_API_BASE_URL:
          process.env.SAME_ORIGIN_RELATIVE === "1" ? "/" : origin,
        VITE_DEMO: "false",
        VITE_FEATURE_OTP: "false",
        VITE_FEATURE_FACEBOOK: "false",
        CLIENT_IP_MODE: "render",
        PROXY_CLIENT_IP_SECRET: secret,
        NITRO_SSL_CERT: https
          ? readFileSync(
              process.env.SAME_ORIGIN_CERT ??
                "/tmp/opencode/render-repair-task5/localhost.pem",
              "utf8"
            )
          : "",
        NITRO_SSL_KEY: https
          ? readFileSync(
              process.env.SAME_ORIGIN_KEY ??
                "/tmp/opencode/render-repair-task5/localhost-key.pem",
              "utf8"
            )
          : "",
      },
    },
  ],
})
