import { log } from "~/shared/log/logger"

export type ShutdownSteps = {
  /** Readiness turns 503 here. */
  onDrain?: () => void
  /** Stops every cron job from starting a new pass. */
  stopJobs: () => void
  /** Refuses new requests and resolves once the running ones have answered. */
  stopServer: () => Promise<void>
  /** Cuts the connections still open when the grace time is over. */
  forceStopServer: () => Promise<void>
  /** Resolves when no job pass is running. */
  jobsIdle: () => Promise<void>
  /** Run in order after the drain: the advisory lock, the pool, the SMTP pool. One failing does not skip the rest. */
  close: [name: string, close: () => Promise<unknown> | unknown][]
}

/** 10.4: requests and jobs get this long to finish after SIGTERM. */
export const GRACE_MS = 20_000

/**
 * Answers the shutdown function for SIGTERM: stop taking requests, stop the cron jobs, wait for
 * running requests and jobs up to `graceMs`, cut what is left, then close what the process
 * holds. Calling it again returns the same run. Resolves true when everything finished in time.
 */
export function createShutdown(steps: ShutdownSteps, graceMs = GRACE_MS) {
  let run: Promise<boolean> | undefined
  return () => {
    run ??= shutDown(steps, graceMs)
    return run
  }
}

async function shutDown(steps: ShutdownSteps, graceMs: number) {
  const startedAt = performance.now()
  log.info("shutdown_started", { graceMs })
  steps.onDrain?.()
  steps.stopJobs()
  const clean = await drainedWithin(
    Promise.all([steps.stopServer(), steps.jobsIdle()]),
    graceMs
  )
  if (!clean) {
    log.warn("shutdown_timeout", { graceMs })
    await steps.forceStopServer()
  }
  for (const [name, close] of steps.close) {
    try {
      await close()
    } catch (error) {
      log.error("shutdown_close_failed", { name, error })
    }
  }
  log.info("shutdown_done", {
    clean,
    ms: Math.round(performance.now() - startedAt),
  })
  return clean
}

async function drainedWithin(drain: Promise<unknown>, graceMs: number) {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      drain.then(() => true),
      new Promise<false>((resolve) => {
        timer = setTimeout(() => resolve(false), graceMs)
      }),
    ])
  } finally {
    clearTimeout(timer)
  }
}
