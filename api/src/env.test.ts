import { expect, test } from "bun:test"

const valid = {
  NODE_ENV: "development",
  APP_ENV: "development",
  DATABASE_URL: "postgres://u:p@localhost:5432/db",
  WEB_ORIGIN: "http://localhost:3000",
  BETTER_AUTH_SECRET: "x".repeat(32),
  BETTER_AUTH_URL: "http://localhost:4000",
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

test("production requires service keys", () => {
  const { code, stderr } = boot({ ...valid, APP_ENV: "production" })
  expect(code).toBe(1)
  expect(stderr).toContain("- SMTP_HOST:")
  expect(stderr).toContain("- CLOUDINARY_URL:")
  expect(stderr).not.toContain("- DATABASE_URL:")
})
