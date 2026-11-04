import { db } from "~/shared/db/client"
import type { Executor } from "~/shared/db/tx"
import { drain } from "~/shared/jobs/batches"

import { clock } from "~/shared/time/clock"
import * as uploads from "~/modules/uploads/uploads.service"

import { auth } from "./auth.config"
import { toUser } from "./auth.mapper"

export { toOwnerContact } from "./auth.mapper"
import * as accounts from "./auth.accounts.queries"
import * as q from "./auth.queries"
import type { NewUserRow, SessionUser } from "./auth.types"

/**
 * The account behind a request's session cookie or bearer token, or null.
 * A timed ban that has ended is lifted here, on the person's next request
 * (the ban job does the same for everyone, A6). `headers` carries Better-Auth's
 * refreshed cookie when the session was extended (once a day, A6).
 */
export async function loadViewer(requestHeaders: Headers) {
  const { headers, response } = await auth.api.getSession({
    headers: requestHeaders,
    returnHeaders: true,
  })
  const id = response?.user.id
  const sessionId = response?.session.id
  const row = id ? await q.getUser(db, id) : undefined
  if (!row) return { viewer: null, headers, sessionId }
  if (!isBanOver(row)) return { viewer: row, headers, sessionId }
  const lifted = await q.updateBanLifted(db, row.id)
  return { viewer: lifted ?? row, headers, sessionId }
}

/** `GET /me`: the signed-in account in `userSchema`, or null when signed out. */
export async function getMe(viewer: SessionUser | null) {
  if (!viewer) return null
  return getMeOf(db, viewer)
}

/**
 * Locks the account row until the transaction ends, so two parallel requests
 * that count something the account owns (plan limit) run one after the other.
 * Answers the row as it is after the wait, which a session may not know yet.
 */
export function lockUser(ex: Executor, id: string) {
  return accounts.lockUser(ex, id)
}

/**
 * Saves what finishing onboarding decides: the role, the home city, the
 * chosen paid plan and, for an individual, the name, photo and interests.
 * Answers the account as `GET /me` does.
 */
export async function finishOnboarding(
  ex: Executor,
  change: { id: string } & Partial<NewUserRow>
) {
  const { id, ...fields } = change
  const row = await q.updateProfile(ex, id, { ...fields, onboardingDone: true })
  // The row was locked a moment ago by the same transaction.
  if (!row) throw new Error("onboarding finished for a missing account")
  return getMeOf(ex, row)
}

/** Forgets the paid plan picked in onboarding ("keep the free plan"). Answers the account as `GET /me` does. */
export async function clearChosenPlan(ex: Executor, id: string) {
  const row = await q.updateProfile(ex, id, { chosenPlanId: null })
  // The session just proved the account exists.
  if (!row) throw new Error("chosen plan cleared for a missing account")
  return getMeOf(ex, row)
}

/** Puts a paid plan back as the one the account still has to pay for (a refused receipt). Does nothing for an unknown account. */
export async function setChosenPlan(
  ex: Executor,
  change: { id: string; planId: string }
) {
  await q.updateProfile(ex, change.id, { chosenPlanId: change.planId })
}

/** The accounts with these ids, as the session middleware loads them. */
export function listUsers(ex: Executor, ids: string[]) {
  return accounts.listUsers(ex, ids)
}

/** The name and picture address of each account with these ids, keyed by id. Unknown ids are left out. */
export async function listPeople(ex: Executor, ids: string[]) {
  const rows = await accounts.listUsers(ex, ids)
  const people = await Promise.all(
    rows.map(async (row) => ({
      id: row.id,
      name: row.name,
      avatarUrl: (await uploads.uploadUrl(ex, row.avatarUploadId)) ?? null,
    }))
  )
  return new Map(people.map((person) => [person.id, person]))
}

/** Banned now: a permanent ban, or a timed one that has not ended (A6). */
export function isBannedNow(user: SessionUser) {
  return user.banned && !isBanOver(user)
}

function isBanOver(user: SessionUser) {
  return (
    user.banned && user.banExpires !== null && user.banExpires <= clock.now()
  )
}

/**
 * Clears the timed bans that are over (A10). A banned person's next request lifts it too and
 * `isBannedNow` already ignores it; this makes the stored state catch up for everyone else.
 * Answers how many accounts it freed.
 */
export function liftExpiredBans(size?: number) {
  return drain(
    (limit) => accounts.updateBansLifted(db, { now: clock.now(), size: limit }),
    size
  )
}

/** Ids of the accounts banned now; their listings and profiles leave the public site. */
export function listBannedIds(ex: Executor) {
  return accounts.listBannedIds(ex, clock.now())
}

/** Ids of the accounts whose name holds `term` (lower case), for admin text search. */
export function listIdsNamed(ex: Executor, term: string) {
  return accounts.listIdsNamed(ex, term)
}

/** Ids of accounts with a verified phone: a person's listings show them as verified. */
export function listPhoneVerifiedIds(ex: Executor) {
  return accounts.listPhoneVerifiedIds(ex)
}

async function getMeOf(ex: Executor, row: SessionUser) {
  const [hasPassword, avatarUrl] = await Promise.all([
    q.hasPassword(ex, row.id),
    uploads.uploadUrl(ex, row.avatarUploadId),
  ])
  return toUser(row, { hasPassword, avatarUrl })
}
