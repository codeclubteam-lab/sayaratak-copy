import { app } from "~/app"
import { env } from "~/env"
import { jobs } from "~/jobs"
import { startJobs } from "~/jobs/scheduler"
import { closeDb } from "~/shared/db/health"
import { holdRunningLock } from "~/shared/db/running-lock"
import { startDraining } from "~/shared/http/health"
import { createShutdown } from "~/shared/http/shutdown"
import { jobsIdle } from "~/shared/jobs/job-health"
import { closeTransport, verifyTransport } from "~/shared/mail/transport"

const server = Bun.serve({
  port: env.PORT,
  fetch: app.fetch,
})

await verifyTransport()

// Kept for the life of the process; a dropped connection loses the lock without a word (ponytail: re-take it on a timer if that ever matters).
const runningLock = await holdRunningLock()

const shutdown = createShutdown({
  onDrain: startDraining,
  stopJobs: startJobs(jobs),
  stopServer: () => server.stop(),
  forceStopServer: () => server.stop(true),
  jobsIdle,
  close: [
    ["running-lock", () => runningLock.close()],
    ["database", closeDb],
    ["smtp", closeTransport],
  ],
})

// SIGTERM is Render's stop; SIGINT is Ctrl-C in development. A second signal while draining waits for the first run.
for (const signal of ["SIGTERM", "SIGINT"] as const) {
  process.on(signal, () => {
    void shutdown().then((clean) => process.exit(clean ? 0 : 1))
  })
}
