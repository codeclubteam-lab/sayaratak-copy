import { expect, test } from "bun:test"

import { app } from "~/app"

const API_DIR = `${import.meta.dir}/..`

const TEST_SCRIPT = `
import { app } from "~/app"

const reset = await app.request("/api/_test/reset", { method: "POST" })
const admin = await app.request("/api/v1/auth/sign-in/email", {
  method: "POST",
  headers: {
    "content-type": "application/json",
    origin: "http://app.localtest.me:3000",
  },
  body: JSON.stringify({ email: "user@demo.sy", password: "Demo1234" }),
})
const cookie = admin.headers.get("set-cookie") ?? ""
const signup = await app.request("/api/v1/auth/sign-up/email", {
  method: "POST",
  headers: {
    "content-type": "application/json",
    origin: "http://app.localtest.me:3000",
  },
  body: JSON.stringify({
    name: "Probe",
    email: "probe@example.sy",
    password: "Password1",
  }),
})
const otp = await app.request("/api/_test/otp?email=probe@example.sy")
const empty = await app.request("/api/_test/empty", { method: "POST" })
const listings = await app.request("/api/v1/listings")
process.stdout.write(JSON.stringify({
  reset: reset.status,
  cookie,
  signup: signup.status,
  otpStatus: otp.status,
  otp: await otp.json(),
  empty: empty.status,
  emptyTotal: (await listings.json()).total,
}))
`

test("/api/_test/* returns 404 when APP_ENV is not test", async () => {
  for (const [method, path] of [
    ["POST", "/api/_test/reset"],
    ["POST", "/api/_test/empty"],
    ["POST", "/api/_test/reset-limits"],
    ["GET", "/api/_test/otp?email=user@demo.sy"],
  ] as const) {
    const res = await app.request(path, { method })
    expect(res.status).toBe(404)
  }
})

test("/api/_test/* works only with NODE_ENV=test APP_ENV=test and COOKIE_DOMAIN sets cookie Domain", () => {
  const run = Bun.spawnSync(["bun", "--no-env-file", "-e", TEST_SCRIPT], {
    cwd: API_DIR,
    env: {
      ...process.env,
      NODE_ENV: "test",
      APP_ENV: "test",
      COOKIE_DOMAIN: "localtest.me",
      WEB_ORIGIN: "http://app.localtest.me:3000",
      BETTER_AUTH_URL: "http://api.localtest.me:4000",
    },
  })
  expect(run.exitCode, run.stderr.toString()).toBe(0)
  const out = JSON.parse(run.stdout.toString()) as {
    reset: number
    cookie: string
    signup: number
    otpStatus: number
    otp: { code: string }
    empty: number
    emptyTotal: number
  }
  expect(out.reset).toBe(200)
  expect(out.cookie).toMatch(/Domain=\.?localtest\.me/i)
  expect(out.signup).toBe(200)
  expect(out.otpStatus).toBe(200)
  expect(out.otp.code).toMatch(/^\d{6}$/)
  expect(out.empty).toBe(200)
  expect(out.emptyTotal).toBe(0)
})
