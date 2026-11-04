import { and, eq, inArray, lt } from "drizzle-orm"

import type { Executor } from "~/shared/db/tx"

import { promotions } from "./promotions.tables"

/** Marks up to `size` running promotions that are past their end as ended; answers how many. */
export function updateEndedBatch(
  ex: Executor,
  batch: { now: Date; size: number }
) {
  const due = ex
    .select({ id: promotions.id })
    .from(promotions)
    .where(
      and(eq(promotions.status, "active"), lt(promotions.endsAt, batch.now))
    )
    .limit(batch.size)
    .for("update", { skipLocked: true })
  return ex
    .update(promotions)
    .set({ status: "ended" })
    .where(inArray(promotions.id, due))
    .returning({ id: promotions.id })
    .then((rows) => rows.length)
}
