// A9 backoff for the outbox job, shared by mail and push: 1, 2, 4, 8 minutes, then it gives up.
const RETRY_MINUTES = [1, 2, 4, 8]
const MINUTE_MS = 60_000

/** The first try plus one per backoff step; a row that failed this many times is left alone. */
export const MAX_ATTEMPTS = RETRY_MINUTES.length + 1

/** When a row that has failed `attempts` times may be tried again. */
export function retryAt(attempts: number, now: Date) {
  const minutes = RETRY_MINUTES[attempts] ?? 0
  return new Date(now.getTime() + minutes * MINUTE_MS)
}
