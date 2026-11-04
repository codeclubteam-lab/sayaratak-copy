import type { BroadcastAudience } from "@sayaratak/shared/schemas/api"
import type { broadcastInputSchema } from "@sayaratak/shared/schemas/inputs"
import type { z } from "zod"

import type { Executor, Transaction } from "~/shared/db/tx"
import { fail } from "~/shared/http/errors"
import { pageParams } from "~/shared/http/page"
import { newId } from "~/shared/text/ids"
import { containing } from "~/shared/text/like"
import { clock } from "~/shared/time/clock"
import { recordAudit } from "~/modules/audit/audit.service"
import type { Actor } from "~/modules/audit/audit.types"
import { listAnnouncementTargets } from "~/modules/auth/auth.overview.service"
import { getOwnerProfiles } from "~/modules/businesses/businesses.overview.service"
import { isCity } from "~/modules/taxonomy/taxonomy.service"

import { toBroadcast } from "./notifications.mapper"
import * as q from "./notifications.broadcast.queries"

const ID_PREFIX = "bc"
const PAGE_SIZE = { default: 20, max: 100 }

type BroadcastInput = z.output<typeof broadcastInputSchema>
/** Raw query values of `GET /admin/broadcasts`. */
export type BroadcastsQuery = Partial<
  Record<"q" | "page" | "pageSize" | "limit", string>
>

/** One page of sent announcements, newest first; `q` keeps those whose title holds it in either language. */
export async function listBroadcasts(ex: Executor, query: BroadcastsQuery) {
  const { page, pageSize: size } = pageParams(query, PAGE_SIZE)
  const term = query.q?.trim().toLowerCase()
  const found = await q.listBroadcasts(ex, {
    pattern: term ? containing(term) : undefined,
    page: { offset: (page - 1) * size, size },
  })
  return {
    items: found.rows.map(toBroadcast),
    total: found.total,
    page,
    pageSize: size,
  }
}

/** How many accounts an announcement to this audience reaches: the bells that will ring. */
export async function countAudience(ex: Executor, audience: BroadcastAudience) {
  return (await listAudience(ex, audience)).length
}

/**
 * Queues an announcement: the history row is saved as `queued` with the audit row, and the answer
 * comes at once. The job `broadcast-fanout` (A10) rings the bells in chunks afterwards (see
 * `notifications.fanout.service`), because one transaction over every account is too slow and
 * holds its locks too long once the audience is thousands. 422 on `cityId` for a city that does
 * not exist.
 */
export async function sendBroadcast(
  tx: Transaction,
  actor: Actor,
  input: BroadcastInput
) {
  if (input.cityId && !(await isCity(tx, input.cityId)))
    fail.validation({ cityId: "validation.required" })
  const saved = await q.insertBroadcast(tx, {
    id: newId(ID_PREFIX),
    title: input.title,
    body: input.body,
    href: input.href,
    roles: input.roles,
    cityId: input.cityId || null,
    verifiedOnly: input.verifiedOnly,
    status: "queued",
    recipients: 0,
    sentBy: actor.admin.id,
    createdAt: clock.now(),
  })
  if (!saved) throw new Error("broadcast vanished after insert")
  const queued = toBroadcast(saved)
  await recordAudit(tx, actor, {
    action: "broadcast.send",
    targetType: "broadcast",
    targetId: saved.id,
    after: queued,
  })
  return queued
}

/**
 * The ids of the accounts an audience reaches: those in the roles who read announcements, then
 * narrowed by city and the verified badge.
 */
async function listAudience(ex: Executor, audience: BroadcastAudience) {
  // Two independent reads.
  const [people, profiles] = await Promise.all([
    listAnnouncementTargets(ex, audience.roles),
    getOwnerProfiles(ex),
  ])
  return people
    .filter((person) => isInAudience(person, profiles.get(person.id), audience))
    .map((person) => person.id)
}

/**
 * Whether one account is in the audience once city and the verified badge are applied. An
 * individual has no business, so the city is their own and "verified only" leaves individuals
 * out; a business uses its profile's city.
 */
export function isInAudience(
  person: { cityId: string | null },
  profile: { cityId: string; verified: boolean } | undefined,
  audience: { cityId?: string | null; verifiedOnly: boolean }
) {
  if (audience.verifiedOnly && !profile?.verified) return false
  return (
    !audience.cityId || (profile?.cityId ?? person.cityId) === audience.cityId
  )
}
