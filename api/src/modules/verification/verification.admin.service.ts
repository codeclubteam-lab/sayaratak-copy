import type { Executor, Transaction } from "~/shared/db/tx"
import { fail } from "~/shared/http/errors"
import { pageParams } from "~/shared/http/page"
import { both } from "~/shared/text/bilingual"
import { recordAudit } from "~/modules/audit/audit.service"
import type { Actor } from "~/modules/audit/audit.types"
import { markVerified } from "~/modules/businesses/businesses.review.service"
import { notify } from "~/modules/notifications/notifications.service"

import * as q from "./verification.queries"
import { toRequests } from "./verification.service"

const PAGE_SIZE = { default: 20, max: 100 }

/** Raw query values of `GET /admin/verifications`, read as the mock reads them. */
export type VerificationsQuery = Partial<
  Record<"status" | "id" | "q" | "page" | "pageSize" | "limit", string>
>

/** The ids a text search matches, found by the modules that own businesses and accounts. */
export type VerificationSearch = { targetIds: string[]; ownerIds: string[] }

/** One page of verification requests, newest first, each with its documents. */
export async function listAdminRequests(
  ex: Executor,
  query: VerificationsQuery,
  search?: VerificationSearch
) {
  const { page, pageSize: size } = pageParams(query, PAGE_SIZE)
  const found = await q.listForAdmin(ex, {
    status: query.status || undefined,
    id: query.id || undefined,
    search,
    page: { offset: (page - 1) * size, size },
  })
  return {
    requests: await toRequests(ex, found.rows),
    total: found.total,
    page,
    pageSize: size,
  }
}

/**
 * Accepts a request: the business gets the badge (its dealership listings
 * read it from there) and the owner is told. Only a pending request can be
 * decided: 404 for an unknown one, 409 `conflict` for one already decided.
 */
export async function approveRequest(
  tx: Transaction,
  actor: Actor,
  id: string
) {
  const row = await lockPending(tx, id)
  await q.updateDecision(tx, { id, status: "approved", rejectionReason: null })
  await markVerified(tx, { kind: row.targetType, id: row.targetId })
  await recordAudit(tx, actor, {
    action: "verification.approve",
    targetType: "verification",
    targetId: id,
    before: { status: row.status },
    after: { status: "approved" },
  })
  await notify(tx, {
    userId: row.ownerId,
    type: "verification_result",
    title: { ar: "تم توثيق حسابك", en: "You are verified" },
    body: {
      ar: "ظهرت الشارة على صفحتك.",
      en: "The badge now shows on your page.",
    },
    href: "/verification",
  })
}

/** Declines a request with a reason and tells the owner. 404 and 409 as for an approval. */
export async function rejectRequest(
  tx: Transaction,
  actor: Actor,
  change: { id: string; reason: string }
) {
  const row = await lockPending(tx, change.id)
  await q.updateDecision(tx, {
    id: change.id,
    status: "rejected",
    rejectionReason: change.reason,
  })
  await recordAudit(tx, actor, {
    action: "verification.reject",
    targetType: "verification",
    targetId: change.id,
    before: { status: row.status },
    after: { status: "rejected" },
    reason: change.reason,
  })
  await notify(tx, {
    userId: row.ownerId,
    type: "verification_result",
    title: { ar: "تعذر توثيق حسابك", en: "Verification was declined" },
    body: both(change.reason),
    href: "/verification",
  })
}

async function lockPending(tx: Transaction, id: string) {
  const row = await q.lockRequest(tx, id)
  if (!row) fail.notFound()
  if (row.status !== "pending") fail.conflict()
  return row
}
