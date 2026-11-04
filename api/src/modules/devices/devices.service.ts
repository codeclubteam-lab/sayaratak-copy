import type { deviceInputSchema } from "@sayaratak/shared/schemas/inputs"
import type { z } from "zod"

import { db } from "~/shared/db/client"
import { BATCH_SIZE, drain } from "~/shared/jobs/batches"
import { newId } from "~/shared/text/ids"
import { clock } from "~/shared/time/clock"
import type { SessionUser } from "~/modules/auth/auth.types"

import * as q from "./devices.queries"

const ID_PREFIX = "dev"
const STALE_DAYS = 90
const DAY_MS = 86_400_000

/** `POST /me/devices`: registers the app's push address, or moves it to this account and refreshes it. */
export async function registerDevice(
  user: SessionUser,
  input: z.infer<typeof deviceInputSchema>
) {
  const now = clock.now()
  await q.upsert(db, {
    ...input,
    id: newId(ID_PREFIX),
    userId: user.id,
    lastSeenAt: now,
    createdAt: now,
  })
}

/** `DELETE /me/devices/:fcmToken`, on sign-out: forgets the account's own device; any other token changes nothing. */
export async function removeDevice(user: SessionUser, fcmToken: string) {
  await q.removeOf(db, { userId: user.id, fcmToken })
}

/**
 * Deletes the devices the app has not opened for 90 days (A10, `prune`): a phone that was sold or
 * wiped never signs out, and FCM only says so when a push is sent. Answers how many it deleted.
 */
export function pruneStale(size = BATCH_SIZE) {
  const before = new Date(clock.now().getTime() - STALE_DAYS * DAY_MS)
  return drain((limit) => q.deleteStaleBatch(db, { before, size: limit }), size)
}
