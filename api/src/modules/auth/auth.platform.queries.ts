import { eq } from "drizzle-orm"

import type { Executor } from "~/shared/db/tx"

import { account, session, user } from "./auth.tables"

export type NewAdminRow = typeof user.$inferInsert
export type NewCredentialRow = typeof account.$inferInsert

/** The platform's one admin, or undefined when it has none. */
export function getAdmin(ex: Executor) {
  return ex
    .select({ id: user.id, email: user.email, name: user.name })
    .from(user)
    .where(eq(user.role, "admin"))
    .for("update")
    .then(([row]) => row)
}

export function insertAdmin(ex: Executor, row: NewAdminRow) {
  return ex.insert(user).values(row)
}

export function insertCredential(ex: Executor, row: NewCredentialRow) {
  return ex.insert(account).values(row)
}

/** Name and email of the admin; fields left `undefined` stay as they are. */
export function updateAdmin(
  ex: Executor,
  id: string,
  set: { name?: string; email?: string; updatedAt: Date }
) {
  return ex.update(user).set(set).where(eq(user.id, id))
}

export function updateCredentialPassword(
  ex: Executor,
  userId: string,
  set: { password: string; updatedAt: Date }
) {
  return ex.update(account).set(set).where(eq(account.userId, userId))
}

/** Signs the account out everywhere. */
export function deleteSessionsOf(ex: Executor, userId: string) {
  return ex.delete(session).where(eq(session.userId, userId))
}
