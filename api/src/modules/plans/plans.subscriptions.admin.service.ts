import type { Executor } from "~/shared/db/tx"
import { pageParams } from "~/shared/http/page"

import * as q from "./plans.admin.queries"
import type { SubscriptionRow } from "./plans.admin.queries"
import { toSubscription } from "./plans.mapper"

const PAGE_SIZE = { default: 20, max: 100 }

/** Raw query values of `GET /admin/subscriptions`, read as the mock reads them. */
export type SubscriptionsQuery = Partial<
  Record<
    "audience" | "planId" | "status" | "q" | "page" | "pageSize" | "limit",
    string
  >
>

/**
 * One page of subscriptions newest first, each with its plan's name and
 * audience; `audience`, `planId` and `status` filter it. `holderIds` is the
 * accounts a text search found, when the query has one.
 */
export async function listAdminSubscriptions(
  ex: Executor,
  query: SubscriptionsQuery,
  holderIds?: string[]
) {
  const { page, pageSize: size } = pageParams(query, PAGE_SIZE)
  const found = await q.listSubscriptionsForAdmin(ex, {
    audience: query.audience || undefined,
    planId: query.planId || undefined,
    status: query.status || undefined,
    holderIds,
    page: { offset: (page - 1) * size, size },
  })
  return { ...found, page, pageSize: size }
}

/** The subscription as the table shows it; `used` is the holder's live listings on an active one, else 0. */
export function toAdminSubscription(row: SubscriptionRow, used: number) {
  return toSubscription(row, used)
}
