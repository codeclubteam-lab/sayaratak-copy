import { SQL } from "bun"

import { env } from "~/env"

const KEY_PREFIX = "sayaratak:job:"

/**
 * Takes the named job's lock (A10) on a connection of its own and answers a `release`, or `null`
 * when another run holds it. A session lock belongs to one connection, so the pool would lose
 * it; a connection per run also keeps two runs in the same process from sharing one lock.
 * Closing the connection drops the lock, which frees it even when a run crashes.
 */
export async function takeJobLock(name: string, url = env.DATABASE_URL) {
  const client = new SQL({ url, max: 1 })
  try {
    const [row] =
      await client`select pg_try_advisory_lock(hashtext(${KEY_PREFIX + name})) as taken`
    if (row.taken) return () => client.close()
  } catch (error) {
    await client.close()
    throw error
  }
  await client.close()
  return null
}
