import { log } from "~/shared/log/logger"

import { recordOutcome, trackRun } from "./job-health"
import { takeJobLock } from "./job-lock"

export type RunnableJob = {
  name: string
  /** Does one pass and answers how many rows or items it handled. */
  run: () => Promise<number>
}
export type JobOutcome = "done" | "skipped" | "failed"

/**
 * Runs one pass of a job under its lock and logs the result (A10). Another instance holding the
 * lock makes this a skip. It never throws: `Bun.cron` ends the process on an unhandled rejection,
 * so a failure is logged at error level with the job name and the next tick tries again.
 */
export async function runJob(job: RunnableJob): Promise<JobOutcome> {
  const pass = onePass(job)
  // Shutdown waits for it; readiness counts its failures in a row (10.4).
  trackRun(pass)
  const outcome = await pass
  recordOutcome(job.name, outcome)
  return outcome
}

async function onePass(job: RunnableJob): Promise<JobOutcome> {
  const startedAt = performance.now()
  try {
    const release = await takeJobLock(job.name)
    if (!release) {
      log.debug("job_skipped", { job: job.name })
      return "skipped"
    }
    try {
      const handled = await job.run()
      // A pass that found nothing is the usual minute; keep it out of the info logs.
      const write = handled === 0 ? log.debug : log.info
      write("job_done", { job: job.name, handled, ms: elapsed(startedAt) })
      return "done"
    } finally {
      await release()
    }
  } catch (error) {
    log.error("job_failed", { job: job.name, ms: elapsed(startedAt), error })
    return "failed"
  }
}

function elapsed(startedAt: number) {
  return Math.round(performance.now() - startedAt)
}
