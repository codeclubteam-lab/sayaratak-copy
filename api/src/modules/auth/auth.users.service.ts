import type { banInputSchema } from "@sayaratak/shared/schemas/inputs"
import type { User } from "@sayaratak/shared/schemas/user"
import type { z } from "zod"

import { db } from "~/shared/db/client"
import { fail } from "~/shared/http/errors"
import { pageParams } from "~/shared/http/page"
import { clock } from "~/shared/time/clock"
import { recordAudit } from "~/modules/audit/audit.service"
import type { Actor } from "~/modules/audit/audit.types"
import * as uploads from "~/modules/uploads/uploads.service"

import { auth } from "./auth.config"
import { toUser } from "./auth.mapper"
import * as q from "./auth.queries"
import { isBannedNow } from "./auth.service"
import * as users from "./auth.users.queries"
import type { SessionUser } from "./auth.types"

const PAGE_SIZE = { default: 20, max: 100 }
const SECONDS_PER_DAY = 86_400
const BAN_SECONDS = { "7d": 7 * SECONDS_PER_DAY, "30d": 30 * SECONDS_PER_DAY }

/** Raw query values of `GET /admin/users`, read as the mock reads them. */
export type UsersQuery = Partial<
  Record<"id" | "role" | "status" | "q" | "page" | "pageSize" | "limit", string>
>

type BanInput = z.output<typeof banInputSchema>

/**
 * `GET /admin/users`: accounts newest first, filtered by `id`, `role`,
 * `status` (active or banned now) and `q` (name, phone or email).
 */
export async function listAdminUsers(query: UsersQuery) {
  const { page, pageSize: size } = pageParams(query, PAGE_SIZE)
  const found = await users.listForAdmin(db, {
    id: query.id,
    role: query.role,
    status: statusOf(query.status),
    q: query.q?.trim().toLowerCase() || undefined,
    now: clock.now(),
    page: { offset: (page - 1) * size, size },
  })
  const holders = new Set(
    await users.listPasswordHolderIds(
      db,
      found.rows.map((row) => row.id)
    )
  )
  const items = await Promise.all(
    found.rows.map((row) => viewOf(row, holders.has(row.id)))
  )
  return { items, total: found.total, page, pageSize: size }
}

/**
 * Bans an account for 7 days, 30 days or for good, through Better-Auth's
 * admin plugin, which also ends every session of the account. 404 for an
 * unknown account, 403 `forbidden` for an admin. Banning again changes the
 * reason and the end. The audit row follows the ban, not in its transaction:
 * the plugin writes on its own connection.
 */
export async function banUser(
  actor: Actor,
  change: { userId: string; input: BanInput; headers: Headers }
) {
  const target = await ownedTarget(change.userId)
  await auth.api.banUser({
    headers: change.headers,
    body: {
      userId: target.id,
      banReason: change.input.reason,
      banExpiresIn:
        change.input.duration === "permanent"
          ? undefined
          : BAN_SECONDS[change.input.duration],
    },
  })
  const saved = await currentUser(target.id)
  await recordAudit(db, actor, {
    action: "user.ban",
    targetType: "user",
    targetId: target.id,
    before: banOf(target),
    after: banOf(saved),
    reason: change.input.reason,
  })
  return viewOne(saved)
}

/** Lifts a ban. An account that is not banned is returned as it is, with no audit row. */
export async function unbanUser(
  actor: Actor,
  change: { userId: string; headers: Headers }
) {
  const target = await ownedTarget(change.userId)
  if (!target.banned) return viewOne(target)
  await auth.api.unbanUser({
    headers: change.headers,
    body: { userId: target.id },
  })
  const saved = await currentUser(target.id)
  await recordAudit(db, actor, {
    action: "user.unban",
    targetType: "user",
    targetId: target.id,
    before: banOf(target),
    after: banOf(saved),
  })
  return viewOne(saved)
}

async function ownedTarget(id: string) {
  const row = await q.getUser(db, id)
  if (!row) fail.notFound()
  // Handoff "Moderation": admins cannot be banned.
  if (row.role === "admin") fail.forbidden()
  return row
}

async function currentUser(id: string) {
  const row = await q.getUser(db, id)
  if (!row) throw new Error("banned account vanished")
  return row
}

function banOf(row: SessionUser) {
  return {
    banned: row.banned,
    banReason: row.banReason,
    banExpires: row.banExpires,
  }
}

function statusOf(status: string | undefined) {
  return status === "banned" || status === "active" ? status : undefined
}

async function viewOne(row: SessionUser) {
  return viewOf(row, await q.hasPassword(db, row.id))
}

// A timed ban that has ended reads as lifted even before the ban job clears the flag.
async function viewOf(row: SessionUser, hasPassword: boolean): Promise<User> {
  const lifted =
    row.banned && !isBannedNow(row)
      ? { ...row, banned: false, banReason: null, banExpires: null }
      : row
  return toUser(lifted, {
    hasPassword,
    avatarUrl: await uploads.uploadUrl(db, row.avatarUploadId),
  })
}
