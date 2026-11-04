import { db } from "~/shared/db/client"
import { log } from "~/shared/log/logger"

export type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0]
/** `db` or an open transaction. Every query function takes one first (A17.4). */
export type Executor = typeof db | Transaction

type Callback = () => Promise<void> | void

const pending = new WeakMap<Transaction, Callback[]>()

/**
 * Runs `work` in one database transaction, then the callbacks `afterCommit`
 * queued, only once the commit succeeded. Services start every transaction
 * here (A17.5).
 */
export async function transaction<T>(work: (tx: Transaction) => Promise<T>) {
  const callbacks: Callback[] = []
  const result = await db.transaction((tx) => {
    pending.set(tx, callbacks)
    return work(tx)
  })
  await runAll(callbacks)
  return result
}

/**
 * Queues work that must wait for the commit, such as deleting a Cloudinary
 * file or kicking the mail sender. A rollback drops it.
 */
export function afterCommit(tx: Transaction, callback: Callback) {
  const callbacks = pending.get(tx)
  // A savepoint (`tx.transaction`) is a different object; queue on the outer one.
  if (!callbacks) throw new Error("afterCommit needs a tx from transaction()")
  callbacks.push(callback)
}

/** `afterCommit` for code that may run on `db` itself, where there is nothing to wait for. */
export async function afterCommitOrNow(ex: Executor, callback: Callback) {
  // Only a transaction has `rollback`; `db` is already committed, so run at once.
  if ("rollback" in ex) afterCommit(ex, callback)
  else await callback()
}

// The data is already committed, so a failing callback must not turn the
// answer into a 500. It is logged, and the rest still run.
async function runAll(callbacks: Callback[]) {
  for (const callback of callbacks) {
    try {
      await callback()
    } catch (error) {
      log.error("after_commit_failed", { error })
    }
  }
}
