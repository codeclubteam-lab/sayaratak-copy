import { db } from "~/shared/db/client"
import { clock } from "~/shared/time/clock"
import type { SessionUser } from "~/modules/auth/auth.types"

import * as q from "./account.queries"

/** A form saved half way under `key` (the post wizard, onboarding); empty when none. */
export async function getDraft(user: SessionUser, key: string) {
  const row = await q.getDraft(db, { userId: user.id, key })
  return { data: row?.data ?? {} }
}

/** Replaces the saved draft under `key`. */
export async function saveDraft(
  user: SessionUser,
  draft: { key: string; data: Record<string, unknown> }
) {
  await q.upsertDraft(db, { userId: user.id, ...draft, at: clock.now() })
  return { data: draft.data }
}
