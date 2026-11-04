import type { BroadcastAudience } from "@sayaratak/shared/schemas/api"
import type { broadcastInputSchema } from "@sayaratak/shared/schemas/inputs"
import type { z } from "zod"

import { db } from "~/shared/db/client"
import { afterCommit, transaction } from "~/shared/db/tx"
import type { Actor } from "~/modules/audit/audit.types"
import * as broadcasts from "~/modules/notifications/notifications.broadcast.service"
import { kickFanOut } from "~/modules/notifications/notifications.fanout.service"

/** `GET /admin/broadcasts`: the announcements sent so far, newest first. */
export function getBroadcasts(query: broadcasts.BroadcastsQuery) {
  return broadcasts.listBroadcasts(db, query)
}

/** `GET /admin/broadcasts/estimate`: how many accounts an announcement to this audience would reach. */
export async function getEstimate(audience: BroadcastAudience) {
  return { count: await broadcasts.countAudience(db, audience) }
}

/**
 * `POST /admin/broadcasts`: queues the announcement and answers its history row. The job rings
 * the bells; a pass is started right after the commit, and the one-minute schedule is the backstop.
 */
export function sendBroadcast(
  actor: Actor,
  input: z.output<typeof broadcastInputSchema>
) {
  return transaction(async (tx) => {
    const queued = await broadcasts.sendBroadcast(tx, actor, input)
    afterCommit(tx, kickFanOut)
    return queued
  })
}
