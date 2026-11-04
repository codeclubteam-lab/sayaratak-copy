/** How many rows a job takes in one pass (A10), so a big backlog never holds one long lock. */
export const BATCH_SIZE = 500

/**
 * Calls `batch` until a call handles fewer rows than `size`, and answers the total. Each call is
 * its own transaction (or one statement), so a crash halfway leaves the finished batches done and
 * the next run takes the rest. A batch must leave its rows out of its own filter, or this never ends.
 */
export async function drain(
  batch: (size: number) => Promise<number>,
  size = BATCH_SIZE
) {
  let total = 0
  for (;;) {
    const handled = await batch(size)
    total += handled
    if (handled < size) return total
  }
}
