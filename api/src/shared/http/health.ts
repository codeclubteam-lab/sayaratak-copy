import { Hono } from "hono"

import { databaseAnswers, databaseIsMigrated } from "~/shared/db/health"
import { failingJobs } from "~/shared/jobs/job-health"
import { smtpStatus } from "~/shared/mail/transport"

export type Probes = {
  database: () => Promise<boolean>
  migrations: () => Promise<boolean>
  smtp: () => Promise<"ok" | "failed" | "off">
  jobs: () => string[]
  draining: () => boolean
}

let draining = false

/** Called once when shutdown starts: readiness turns 503 so the proxy sends no new traffic (10.4). */
export function startDraining() {
  draining = true
}

const defaultProbes: Probes = {
  database: databaseAnswers,
  migrations: databaseIsMigrated,
  smtp: smtpStatus,
  jobs: failingJobs,
  draining: () => draining,
}

const word = (up: boolean) => (up ? "ok" : "failed")

/**
 * `/live`: the process is up, nothing else is asked (Render's health check).
 * `/ready`: the database answers, its migrations are current, SMTP verified
 * (`off` when no host is set) and no job failed three passes in a row; 503
 * with each check named otherwise, or while shutting down. A probe that
 * throws counts as failed.
 */
export function healthRoutes(probes: Probes = defaultProbes) {
  return new Hono()
    .get("/live", (c) => c.json({ ok: true }))
    .get("/ready", async (c) => {
      if (probes.draining()) {
        return c.json({ ok: false, draining: true }, 503)
      }
      const [database, migrations, smtp] = await Promise.all([
        probes.database().catch(() => false),
        probes.migrations().catch(() => false),
        probes.smtp().catch(() => "failed" as const),
      ])
      const failing = probes.jobs()
      const checks = {
        database: word(database),
        migrations: word(migrations),
        smtp,
        jobs: word(failing.length === 0),
      }
      const ok = Object.values(checks).every((check) => check !== "failed")
      return c.json(
        { ok, checks, ...(failing.length > 0 && { failingJobs: failing }) },
        ok ? 200 : 503
      )
    })
}
