import type { Executor } from "~/shared/db/tx"
import * as auth from "~/modules/auth/auth.service"

import * as q from "./businesses.directory.queries"

type Narrow = Omit<q.Narrow, "hiddenOwnerIds">

/**
 * The dealerships the directory may list: active, owner not banned, in the
 * city and verified as asked, in the mock's array order. The directory
 * module sorts and pages them.
 */
export async function listDealershipCandidates(ex: Executor, narrow: Narrow) {
  return q.listDealershipCandidates(ex, await withHidden(ex, narrow))
}

/** Listed workshops; `service` is a service template id. */
export async function listWorkshopCandidates(
  ex: Executor,
  narrow: Narrow & { service?: string }
) {
  return q.listWorkshopCandidates(ex, await withHidden(ex, narrow))
}

/** Listed mechanics; `city` is any city they serve. */
export async function listMechanicCandidates(
  ex: Executor,
  narrow: Narrow & {
    specialization?: string
    minYears: number
    available: boolean
  }
) {
  return q.listMechanicCandidates(ex, await withHidden(ex, narrow))
}

/**
 * The id and owner of the active business with the slug. A suspended one is
 * not found; a banned owner's still is (its page shows a notice).
 */
export function findActiveBySlug(
  ex: Executor,
  find: { kind: "dealership" | "workshop" | "mechanic"; slug: string }
) {
  return q.getActiveBySlug(ex, find)
}

// A banned owner's business leaves the directories (handoff "Visibility").
async function withHidden<T extends Narrow>(ex: Executor, narrow: T) {
  return { ...narrow, hiddenOwnerIds: await auth.listBannedIds(ex) }
}
