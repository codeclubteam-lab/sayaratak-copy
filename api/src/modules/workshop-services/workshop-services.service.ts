import { db } from "~/shared/db/client"
import { type Executor, type Transaction, transaction } from "~/shared/db/tx"
import { fail } from "~/shared/http/errors"
import type { SessionUser } from "~/modules/auth/auth.types"
import * as refs from "~/modules/businesses/businesses.update.service"
import * as services from "~/modules/businesses/businesses.services.service"
import * as plans from "~/modules/plans/plans.service"

type Input = services.ServiceInput

/** The signed-in workshop's services in its order. */
export async function getMyServices(user: SessionUser) {
  return services.listServices(db, await workshopIdOf(db, user.id))
}

/**
 * `POST /me/services`: adds a service at the end. 403 `limit_reached` once
 * the plan's `serviceLimit` is used up. Adds queue on the workshop's row
 * lock, so two at once cannot both take the last place.
 */
export async function addMyService(user: SessionUser, input: Input) {
  return transaction(async (tx) => {
    const workshopId = await lockOwnWorkshop(tx, user.id)
    const cap = (await plans.getActivePlan(tx, user.id))?.serviceLimit
    if (cap != null && (await services.countServices(tx, workshopId)) >= cap)
      fail.limit("limit_reached")
    return services.addService(tx, { workshopId, input })
  })
}

/** `PATCH /me/services/:id`: changes the fields sent; 404 for a service the workshop does not have. */
export async function updateMyService(
  user: SessionUser,
  edit: { id: string; change: Partial<Input> }
) {
  return transaction(async (tx) => {
    const workshopId = await lockOwnWorkshop(tx, user.id)
    const saved = await services.updateService(tx, { workshopId, ...edit })
    if (!saved) fail.notFound()
    return saved
  })
}

/** `DELETE /me/services/:id`: removes one; an id the workshop does not have changes nothing. */
export async function deleteMyService(user: SessionUser, id: string) {
  await transaction(async (tx) => {
    const workshopId = await lockOwnWorkshop(tx, user.id)
    await services.deleteService(tx, { workshopId, id })
  })
}

/** `POST /me/services/reorder`: the named services come first, in that order; none is ever deleted. */
export async function reorderMyServices(user: SessionUser, ids: string[]) {
  return transaction(async (tx) => {
    const workshopId = await lockOwnWorkshop(tx, user.id)
    return services.reorderServices(tx, { workshopId, ids })
  })
}

async function workshopIdOf(ex: Executor, userId: string) {
  const ref = await refs.getBusinessRefOf(ex, userId)
  if (ref?.kind !== "workshop") fail.notFound()
  return ref.id
}

async function lockOwnWorkshop(tx: Transaction, userId: string) {
  const ref = await refs.getBusinessRefOf(tx, userId)
  if (ref?.kind !== "workshop") fail.notFound()
  await refs.lockBusiness(tx, ref)
  return ref.id
}
