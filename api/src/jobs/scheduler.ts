import { runJob } from "~/shared/jobs/run-job"
import { log } from "~/shared/log/logger"

/** The schedules in A10 read in this zone, not the server's. */
export const JOBS_TIME_ZONE = "Africa/Khartoum"

export type Job = {
  name: string
  /** Five-field cron expression (no seconds), read in the Africa/Khartoum time zone. */
  schedule: string
  /** Does one pass and answers how many rows or items it handled. */
  run: () => Promise<number>
}

/** Declares a scheduled job. A job file names its schedule and calls one service function (A17.3). */
export function defineJob(job: Job) {
  return job
}

/**
 * Starts every job on its schedule inside this process and answers a function that stops them
 * all (A10). An invalid schedule throws here, so a bad one stops the boot instead of never firing.
 */
export function startJobs(jobs: Job[]) {
  const crons = jobs.map((job) =>
    // `Bun.cron` waits for the returned promise before it plans the next tick, so a slow run never overlaps itself.
    Bun.cron(job.schedule, () => runJob(job), { tz: JOBS_TIME_ZONE })
  )
  log.info("jobs_started", { jobs: jobs.map((job) => job.name) })
  return () => {
    for (const cron of crons) cron.stop()
  }
}
