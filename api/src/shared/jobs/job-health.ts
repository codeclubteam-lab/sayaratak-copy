import type { JobOutcome } from "./run-job"

/** `/api/health/ready` answers 503 once a job has failed this many passes in a row (10.4). */
export const FAILURES_BEFORE_UNREADY = 3

const failures = new Map<string, number>()
const inFlight = new Set<Promise<unknown>>()

/** A pass that is done clears the streak, a failed one extends it, a skipped one (another instance has the lock) changes nothing. */
export function recordOutcome(name: string, outcome: JobOutcome) {
  if (outcome === "done") failures.delete(name)
  if (outcome === "failed") failures.set(name, (failures.get(name) ?? 0) + 1)
}

/** The jobs whose last passes all failed, as far as this process has seen. */
export function failingJobs() {
  return [...failures]
    .filter(([, count]) => count >= FAILURES_BEFORE_UNREADY)
    .map(([name]) => name)
}

/** Remembers a running pass so shutdown can wait for it. */
export function trackRun(run: Promise<unknown>) {
  const settled = run
    .then(
      () => undefined,
      () => undefined
    )
    .finally(() => inFlight.delete(settled))
  inFlight.add(settled)
}

/** Resolves when no pass is running, including ones that start while waiting. */
export async function jobsIdle() {
  while (inFlight.size > 0) await Promise.all(inFlight)
}

/** For tests: forgets every streak. */
export function resetJobHealth() {
  failures.clear()
}
