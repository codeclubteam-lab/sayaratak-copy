import {
  emailSchema,
  nameSchema,
  passwordSchema,
} from "@sayaratak/shared/schemas/fields"
import { hashPassword } from "better-auth/crypto"
import { z } from "zod"

import { ALL_PREFS } from "~/shared/db/defaults"
import type { Executor } from "~/shared/db/tx"
import { fail } from "~/shared/http/errors"
import { newId } from "~/shared/text/ids"
import { clock } from "~/shared/time/clock"
import { recordSystemAudit } from "~/modules/audit/audit.service"

import * as q from "./auth.platform.queries"
import { deleteUser, getUserByEmail } from "./auth.queries"

// The platform has one admin (owner rule, 8.12): the unique index `user_one_admin` is the backstop.
// The admin account is made, changed and removed here, by the `create-admin` command and by the
// platform admin endpoint; nobody signed in for either, so the audit rows have no admin id.
export const adminInputSchema = z.object({
  email: emailSchema.transform((email) => email.toLowerCase()),
  name: nameSchema,
  password: passwordSchema,
})
export const adminPatchSchema = adminInputSchema
  .partial()
  .refine((patch) => Object.keys(patch).length > 0, "validation.required")

export type AdminInput = z.output<typeof adminInputSchema>
export type AdminPatch = z.output<typeof adminPatchSchema>
export type AdminChange =
  | { op: "create"; input: AdminInput }
  | { op: "update"; input: AdminPatch }
  | { op: "delete" }
/** Where a change came from, for the audit row. */
export type Via = { reason: string; ip?: string }

/**
 * Whether the change may run now, else 409 `exists` (the email belongs to another account),
 * 409 `conflict` (create while an admin exists) or 404 (update or delete with none). Returns the
 * current admin, locked until the transaction ends. The endpoint asks before it mails a code.
 */
export async function assertAdminChange(ex: Executor, change: AdminChange) {
  const admin = await q.getAdmin(ex)
  const email = change.op === "delete" ? undefined : change.input.email
  const taken = email ? await getUserByEmail(ex, email) : undefined
  if (taken && (change.op === "create" || taken.id !== admin?.id))
    fail.conflict("exists")
  if (change.op === "create" && admin) fail.conflict()
  if (change.op !== "create" && !admin) fail.notFound()
  return admin
}

/** Creates the verified admin with a password and two-factor on (the email code step, A6). */
export async function createPlatformAdmin(
  ex: Executor,
  input: AdminInput,
  via: Via
) {
  await assertAdminChange(ex, { op: "create", input })
  const now = clock.now()
  const id = newId("u")
  await q.insertAdmin(ex, {
    id,
    name: input.name,
    email: input.email,
    emailVerified: true,
    twoFactorEnabled: true,
    role: "admin",
    onboardingDone: true,
    prefs: ALL_PREFS,
    createdAt: now,
    updatedAt: now,
  })
  await q.insertCredential(ex, {
    id: newId("acc"),
    accountId: id,
    providerId: "credential",
    userId: id,
    password: await hashPassword(input.password),
    createdAt: now,
    updatedAt: now,
  })
  await recordSystemAudit(ex, {
    action: "admin.create",
    targetType: "user",
    targetId: id,
    after: { email: input.email, name: input.name, role: "admin" },
    ...via,
  })
  return { id, email: input.email, name: input.name }
}

/** Changes the name, email or password sent. A new email or password signs the admin out everywhere. */
export async function updatePlatformAdmin(
  ex: Executor,
  patch: AdminPatch,
  via: Via
) {
  const admin = await assertAdminChange(ex, { op: "update", input: patch })
  if (!admin) fail.notFound()
  const now = clock.now()
  await q.updateAdmin(ex, admin.id, {
    name: patch.name,
    email: patch.email,
    updatedAt: now,
  })
  if (patch.password)
    await q.updateCredentialPassword(ex, admin.id, {
      password: await hashPassword(patch.password),
      updatedAt: now,
    })
  if (patch.password || (patch.email && patch.email !== admin.email))
    await q.deleteSessionsOf(ex, admin.id)
  const after = {
    email: patch.email ?? admin.email,
    name: patch.name ?? admin.name,
  }
  await recordSystemAudit(ex, {
    action: "admin.update",
    targetType: "user",
    targetId: admin.id,
    before: { email: admin.email, name: admin.name },
    after: { ...after, passwordChanged: !!patch.password },
    ...via,
  })
  return { id: admin.id, ...after }
}

/** Removes the admin account and its sessions; the platform has none until a create. */
export async function deletePlatformAdmin(ex: Executor, via: Via) {
  const admin = await assertAdminChange(ex, { op: "delete" })
  if (!admin) fail.notFound()
  await recordSystemAudit(ex, {
    action: "admin.delete",
    targetType: "user",
    targetId: admin.id,
    before: { email: admin.email, name: admin.name },
    ...via,
  })
  await deleteUser(ex, admin.id)
}
