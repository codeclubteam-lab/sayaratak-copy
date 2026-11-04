import { SQL } from "bun"

import { env } from "~/env"

const KEY = "sayaratak:api-running"

/**
 * Every API process takes this lock, shared, and keeps its connection for its whole life. The
 * restore command (8.11) wants it exclusive, so it cannot run while an API process is up.
 * Keep the answer alive: closing the connection drops the lock.
 */
export async function holdRunningLock(url = env.DATABASE_URL) {
  const client = new SQL({ url, max: 1 })
  await client`select pg_advisory_lock_shared(hashtext(${KEY}))`
  return client
}

/** True while an API process holds the lock: the exclusive lock is then not free. */
export async function apiIsRunning(url = env.DATABASE_URL) {
  const client = new SQL({ url, max: 1 })
  try {
    const [row] =
      await client`select pg_try_advisory_lock(hashtext(${KEY})) as free`
    return !row.free
  } finally {
    await client.close()
  }
}
