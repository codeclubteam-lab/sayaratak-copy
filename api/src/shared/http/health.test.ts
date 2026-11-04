import { describe, expect, test } from "bun:test"
import { z } from "zod"

import { app } from "~/app"
import { migrationsCurrent } from "~/shared/db/health"

import { healthRoutes, type Probes } from "./health"

const healthy: Probes = {
  database: async () => true,
  migrations: async () => true,
  smtp: async () => "ok",
  jobs: () => [],
  draining: () => false,
}

const readySchema = z.object({
  ok: z.boolean(),
  checks: z.record(z.string(), z.string()).default({}),
  failingJobs: z.array(z.string()).optional(),
  draining: z.boolean().optional(),
})

async function ready(probes: Partial<Probes>) {
  const res = await healthRoutes({ ...healthy, ...probes }).request("/ready")
  return { status: res.status, body: readySchema.parse(await res.json()) }
}

describe("GET /api/health/live", () => {
  test("says the process is up and asks nothing else", async () => {
    const res = await app.request("/api/health/live")
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })
  })
})

describe("GET /api/health/ready", () => {
  test("200 with every check named when all pass", async () => {
    expect(await ready({})).toEqual({
      status: 200,
      body: {
        ok: true,
        checks: { database: "ok", migrations: "ok", smtp: "ok", jobs: "ok" },
      },
    })
  })

  test("SMTP off (no host in development) is ready", async () => {
    const { status, body } = await ready({ smtp: async () => "off" })
    expect(status).toBe(200)
    expect(body.checks.smtp).toBe("off")
  })

  test.each([
    [
      "the database does not answer",
      { database: async () => false },
      "database",
    ],
    ["a migration is missing", { migrations: async () => false }, "migrations"],
    ["SMTP did not verify", { smtp: async () => "failed" as const }, "smtp"],
    ["a job failed three times in a row", { jobs: () => ["outbox"] }, "jobs"],
  ])("503 when %s, naming the check", async (_name, probe, check) => {
    const { status, body } = await ready(probe)
    expect(status).toBe(503)
    expect(body.ok).toBe(false)
    expect(body.checks[check]).toBe("failed")
  })

  test("the failing jobs are named", async () => {
    const { body } = await ready({ jobs: () => ["outbox", "prune"] })
    expect(body.failingJobs).toEqual(["outbox", "prune"])
  })

  test("a probe that throws counts as failed instead of a 500", async () => {
    const { status, body } = await ready({
      database: () => Promise.reject(new Error("connection refused")),
      smtp: () => Promise.reject(new Error("timeout")),
    })
    expect(status).toBe(503)
    expect(body.checks).toMatchObject({ database: "failed", smtp: "failed" })
    expect(JSON.stringify(body)).not.toContain("refused")
  })

  test("503 while shutting down, so the proxy stops sending traffic", async () => {
    const { status, body } = await ready({ draining: () => true })
    expect(status).toBe(503)
    expect(body).toMatchObject({ ok: false, draining: true })
  })

  test("answers no-store and carries the A12 headers", async () => {
    const res = await app.request("/api/health/ready")
    expect(res.headers.get("cache-control")).toBe("no-store")
    expect(res.headers.get("x-content-type-options")).toBe("nosniff")
  })
})

describe("the real checks, against the test database", () => {
  test("the app answers ready: database up, migrations current, SMTP off, no job failing", async () => {
    const res = await app.request("/api/health/ready")
    expect(await res.json()).toEqual({
      ok: true,
      checks: { database: "ok", migrations: "ok", smtp: "off", jobs: "ok" },
    })
    expect(res.status).toBe(200)
  })
})

describe("migrationsCurrent", () => {
  test("current when the database has the newest shipped migration or a newer one", () => {
    expect(migrationsCurrent(100, 100)).toBe(true)
    expect(migrationsCurrent(200, 100)).toBe(true)
  })

  test("not current when it is behind, or has none", () => {
    expect(migrationsCurrent(99, 100)).toBe(false)
    expect(migrationsCurrent(null, 100)).toBe(false)
  })
})
