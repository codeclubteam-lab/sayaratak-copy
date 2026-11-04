import type { Role } from "@sayaratak/shared/schemas/fields"

import { type Transaction, transaction } from "~/shared/db/tx"
import { BATCH_SIZE } from "~/shared/jobs/batches"
import { runJob } from "~/shared/jobs/run-job"
import { newId } from "~/shared/text/ids"
import { clock } from "~/shared/time/clock"
import { listAnnouncementTargets } from "~/modules/auth/auth.overview.service"
import { getOwnerProfiles } from "~/modules/businesses/businesses.overview.service"
import { queuePushMany } from "~/modules/devices/devices.push.service"

import { isInAudience } from "./notifications.broadcast.service"
import * as q from "./notifications.fanout.queries"
import { toNotificationHref } from "./notifications.mapper"

const ID_PREFIX = "n"
/** The job's name: the schedule and the kick below share it, so they share one lock. */
export const FANOUT_JOB = "broadcast-fanout"
const running = new Set<Promise<unknown>>()

/**
 * One pass of the `broadcast-fanout` job (A10): rings the bells of every queued or sending
 * broadcast, oldest first, a chunk of accounts at a time. Answers how many accounts it reached.
 *
 * A chunk is one transaction: the bells, the push rows, the cursor and the count move together,
 * so a crash repeats the whole chunk and nobody is told twice. The audience is frozen at Send:
 * only accounts created before the broadcast row are reached, whoever signs up later is not.
 */
export async function fanOut(size = BATCH_SIZE) {
  let reached = 0
  for (;;) {
    const chunk = await transaction((tx) => fanOutChunk(tx, size))
    if (chunk === null) return reached
    reached += chunk
  }
}

/**
 * Starts a pass of the job right after a Send, without waiting for it, so the admin does not
 * wait for the next minute. It runs as the job does (same name, so same lock and same log line):
 * when a pass is already going it skips, and that pass finds the new broadcast or the next tick
 * does. The third fire-and-forget of the API (A17.5, with mail and push); `runJob` never throws.
 */
export function kickFanOut() {
  const started = runJob({ name: FANOUT_JOB, run: () => fanOut() })
  running.add(started)
  void started.finally(() => running.delete(started))
}

/** Waits for every kick started so far. Tests call it before reading the bells. */
export async function flushFanOut() {
  await Promise.all(running)
}

/** Takes the next chunk of the oldest unfinished broadcast; null when none is left. */
async function fanOutChunk(tx: Transaction, size: number) {
  const broadcast = await q.lockUnfinished(tx)
  if (!broadcast) return null
  const now = clock.now()
  const people = await listAnnouncementTargets(tx, broadcast.roles, {
    after: broadcast.cursor ?? undefined,
    createdBy: broadcast.createdAt,
    size,
  })
  const profiles = await getOwnerProfiles(
    tx,
    people.map((person) => person.id)
  )
  const bells = people
    .filter((person) =>
      isInAudience(person, profiles.get(person.id), broadcast)
    )
    .map((person) => bellFor(person, broadcast, now))
  await q.insertMany(tx, bells)
  await queuePushMany(
    tx,
    bells.map((bell) => pushFor(bell))
  )
  await q.updateProgress(tx, {
    id: broadcast.id,
    cursor: people.at(-1)?.id ?? broadcast.cursor,
    reached: bells.length,
    // A short chunk is the last one; an exact multiple finds an empty one next and finishes there.
    finishedAt: people.length < size ? now : null,
  })
  return bells.length
}

function bellFor(
  person: { id: string; role: Role },
  broadcast: q.BroadcastRow,
  now: Date
) {
  return {
    id: newId(ID_PREFIX),
    userId: person.id,
    type: "broadcast" as const,
    title: broadcast.title,
    body: broadcast.body,
    href: broadcast.href && toNotificationHref(person.role, broadcast.href),
    createdAt: now,
  }
}

function pushFor(bell: ReturnType<typeof bellFor>) {
  return {
    userId: bell.userId,
    type: bell.type,
    notificationId: bell.id,
    href: bell.href ?? undefined,
    title: bell.title,
    body: bell.body,
  }
}
