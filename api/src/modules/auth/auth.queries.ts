import type { NotificationPrefs } from "@sayaratak/shared/schemas/api"
import { and, eq, gt, isNotNull, ne, type SQL } from "drizzle-orm"

import type { Executor } from "~/shared/db/tx"

import {
  account,
  loginFailures,
  type NewUserRow,
  session,
  user,
} from "./auth.tables"

export function getUserLocale(ex: Executor, email: string) {
  return ex
    .select({ locale: user.locale })
    .from(user)
    .where(eq(user.email, email))
    .then(([row]) => row?.locale)
}

export function getUser(ex: Executor, id: string) {
  return ex
    .select()
    .from(user)
    .where(eq(user.id, id))
    .then(([row]) => row)
}

/** A password sign-in exists: false for Google or Facebook only accounts. */
export function hasPassword(ex: Executor, userId: string) {
  return ex
    .select({ id: account.id })
    .from(account)
    .where(and(eq(account.userId, userId), isNotNull(account.password)))
    .limit(1)
    .then((rows) => rows.length > 0)
}

/** A timed ban that ended: the account is free again (A6). */
export function updateBanLifted(ex: Executor, id: string) {
  return ex
    .update(user)
    .set({ banned: false, banReason: null, banExpires: null })
    .where(eq(user.id, id))
    .returning()
    .then(([row]) => row)
}

export function updateProfile(
  ex: Executor,
  id: string,
  fields: Partial<NewUserRow>
) {
  return ex
    .update(user)
    .set(fields)
    .where(eq(user.id, id))
    .returning()
    .then(([row]) => row)
}

export function updatePrefs(
  ex: Executor,
  id: string,
  prefs: NotificationPrefs
) {
  return ex.update(user).set({ prefs }).where(eq(user.id, id))
}

export function hasOtherWithEmail(
  ex: Executor,
  match: { email: string; userId: string }
) {
  return hasOther(ex, eq(user.email, match.email), match.userId)
}

export function hasOtherWithPhone(
  ex: Executor,
  match: { phone: string; userId: string }
) {
  return hasOther(ex, eq(user.phone, match.phone), match.userId)
}

export function deleteUser(ex: Executor, id: string) {
  return ex.delete(user).where(eq(user.id, id))
}

function hasOther(ex: Executor, where: SQL, userId: string) {
  return ex
    .select({ id: user.id })
    .from(user)
    .where(and(where, ne(user.id, userId)))
    .limit(1)
    .then((rows) => rows.length > 0)
}

/** Failed sign-ins for the email since `since`, from every IP. */
export function listLoginFailures(ex: Executor, email: string, since: Date) {
  return ex
    .select({ ip: loginFailures.ip, failedAt: loginFailures.failedAt })
    .from(loginFailures)
    .where(
      and(eq(loginFailures.email, email), gt(loginFailures.failedAt, since))
    )
}

export function insertLoginFailure(
  ex: Executor,
  failure: { email: string; ip: string; failedAt: Date }
) {
  return ex.insert(loginFailures).values(failure)
}

export function deleteLoginFailures(ex: Executor, email: string) {
  return ex.delete(loginFailures).where(eq(loginFailures.email, email))
}

export function getUserByEmail(ex: Executor, email: string) {
  return ex
    .select()
    .from(user)
    .where(eq(user.email, email))
    .then(([row]) => row)
}

/** Sign-in methods of an account: `credential`, `google`, `facebook`. */
export function listProviders(ex: Executor, userId: string) {
  return ex
    .select({ providerId: account.providerId })
    .from(account)
    .where(eq(account.userId, userId))
    .then((rows) => rows.map((row) => row.providerId))
}

/** Marks a session as having passed the admin's emailed code (3.7). */
export function updateSecondStep(ex: Executor, sessionId: string) {
  return ex
    .update(session)
    .set({ secondStep: true })
    .where(eq(session.id, sessionId))
}

export function hasSecondStep(ex: Executor, sessionId: string) {
  return ex
    .select({ secondStep: session.secondStep })
    .from(session)
    .where(eq(session.id, sessionId))
    .then(([row]) => row?.secondStep === true)
}

export function getUserEmail(ex: Executor, id: string) {
  return ex
    .select({ email: user.email })
    .from(user)
    .where(eq(user.id, id))
    .then(([row]) => row?.email)
}
