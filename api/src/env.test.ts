import { expect, test } from "bun:test"

const valid = {
  NODE_ENV: "development",
  APP_ENV: "development",
  DATABASE_URL: "postgres://u:p@localhost:5432/db",
  WEB_ORIGIN: "http://localhost:3000",
  BETTER_AUTH_SECRET: "x".repeat(32),
  BETTER_AUTH_URL: "http://localhost:4000",
}

const prodRequired = {
  ...valid,
  NODE_ENV: "production",
  APP_ENV: "production",
  COOKIE_DOMAIN: "example.sd",
  GOOGLE_CLIENT_ID: "google-id",
  GOOGLE_CLIENT_SECRET: "google-secret",
  CLOUDINARY_URL: "cloudinary://key:secret@cloud",
  SMTP_HOST: "smtp.example.sd",
  SMTP_PORT: "587",
  SMTP_SECURE: "false",
  SMTP_USER: "mailer",
  SMTP_PASS: "secret",
  MAIL_FROM: "noreply@example.sd",
  R2_ACCOUNT_ID: "r2-account",
  R2_ACCESS_KEY_ID: "r2-key",
  R2_SECRET_ACCESS_KEY: "r2-secret",
  R2_BUCKET: "sayaratak-backups",
  FCM_SERVICE_ACCOUNT: '{"project_id":"test"}',
}

function boot(env: Record<string, string>) {
  const run = Bun.spawnSync(
    ["bun", "--no-env-file", "-e", "await import('~/env')"],
    { cwd: `${import.meta.dir}/..`, env: { PATH: process.env.PATH, ...env } }
  )
  return { code: run.exitCode, stderr: run.stderr.toString() }
}

test("boots in development without service keys", () => {
  expect(boot(valid)).toEqual({ code: 0, stderr: "" })
})

test("lists every missing core variable", () => {
  const { code, stderr } = boot({ NODE_ENV: "development" })
  expect(code).toBe(1)
  for (const name of [
    "APP_ENV",
    "DATABASE_URL",
    "WEB_ORIGIN",
    "BETTER_AUTH_SECRET",
    "BETTER_AUTH_URL",
  ]) {
    expect(stderr).toContain(`- ${name}:`)
  }
})

test("blank values count as missing", () => {
  const { code, stderr } = boot({ ...valid, DATABASE_URL: "" })
  expect(code).toBe(1)
  expect(stderr).toContain("- DATABASE_URL:")
})

test("production requires core service keys", () => {
  const { code, stderr } = boot({ ...valid, APP_ENV: "production" })
  expect(code).toBe(1)
  expect(stderr).toContain("- SMTP_HOST:")
  expect(stderr).toContain("- CLOUDINARY_URL:")
  expect(stderr).toContain("- FCM_SERVICE_ACCOUNT:")
  expect(stderr).not.toContain("- DATABASE_URL:")
})

test("production boots without optional Facebook and Apple groups", () => {
  expect(boot(prodRequired)).toEqual({ code: 0, stderr: "" })
})

test("production boots with complete Facebook keys while Apple stays unset", () => {
  expect(
    boot({
      ...prodRequired,
      FACEBOOK_CLIENT_ID: "fb-id",
      FACEBOOK_CLIENT_SECRET: "fb-secret",
    })
  ).toEqual({ code: 0, stderr: "" })
})

test("production rejects partial Facebook or Apple groups", () => {
  const fb = boot({ ...prodRequired, FACEBOOK_CLIENT_ID: "fb-id" })
  expect(fb.code).toBe(1)
  expect(fb.stderr).toContain("- FACEBOOK_CLIENT_SECRET:")

  const apple = boot({ ...prodRequired, APPLE_CLIENT_ID: "apple.id" })
  expect(apple.code).toBe(1)
  for (const key of [
    "APPLE_TEAM_ID",
    "APPLE_KEY_ID",
    "APPLE_PRIVATE_KEY",
    "APPLE_APP_BUNDLE_ID",
  ]) {
    expect(apple.stderr).toContain(`- ${key}:`)
  }
})
