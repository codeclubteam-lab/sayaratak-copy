import { sql } from "drizzle-orm"

import { deleteBatch } from "~/shared/db/delete-batch"
import type { Executor } from "~/shared/db/tx"

import { notifications } from "./notifications.tables"

/** Deletes up to `size` notifications already read and written before `before`; unread ones stay. */
export function deleteReadBatch(
  ex: Executor,
  batch: { before: Date; size: number }
) {
  const target = {
    table: notifications,
    where: sql`${notifications.readAt} is not null and ${notifications.createdAt} < ${batch.before}`,
  }
  return deleteBatch(ex, target, batch.size)
}
