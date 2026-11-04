import { and, eq } from "drizzle-orm"

import type { Executor } from "~/shared/db/tx"

import { drafts } from "./account.tables"

type DraftKey = { userId: string; key: string }

export function getDraft(ex: Executor, id: DraftKey) {
  return ex
    .select({ data: drafts.data })
    .from(drafts)
    .where(and(eq(drafts.userId, id.userId), eq(drafts.key, id.key)))
    .then(([row]) => row)
}

export function upsertDraft(
  ex: Executor,
  draft: DraftKey & { data: Record<string, unknown>; at: Date }
) {
  const row = {
    userId: draft.userId,
    key: draft.key,
    data: draft.data,
    updatedAt: draft.at,
  }
  return ex
    .insert(drafts)
    .values(row)
    .onConflictDoUpdate({
      target: [drafts.userId, drafts.key],
      set: { data: row.data, updatedAt: row.updatedAt },
    })
}
