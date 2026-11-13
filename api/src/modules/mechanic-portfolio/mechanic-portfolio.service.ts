import { db } from "~/shared/db/client"
import { type Executor, type Transaction, transaction } from "~/shared/db/tx"
import { fail } from "~/shared/http/errors"
import type { SessionUser } from "~/modules/auth/auth.types"
import * as refs from "~/modules/businesses/businesses.update.service"
import * as portfolio from "~/modules/businesses/businesses.portfolio.service"
import * as plans from "~/modules/plans/plans.service"

/** The signed-in mechanic's portfolio in its order. */
export async function getMyPortfolio(user: SessionUser) {
  return portfolio.listPortfolio(db, await mechanicIdOf(db, user.id))
}

/**
 * `POST /me/portfolio`: adds a picture at the end. 403 `limit_reached` once
 * the plan's `portfolioLimit` is used up; 422 on `imageId` unless it is the
 * mechanic's own unused image. Adds queue on the mechanic's row lock, so two
 * at once cannot both take the last place.
 */
export async function addMyPortfolioItem(
  user: SessionUser,
  input: { imageId: string; caption: string }
) {
  return transaction(async (tx) => {
    const mechanicId = await lockOwnMechanic(tx, user.id)
    const cap = (await plans.getActivePlan(tx, user.id))?.portfolioLimit
    if (cap != null && (await portfolio.countPortfolio(tx, mechanicId)) >= cap)
      fail.limit("limit_reached")
    const item = await portfolio.addPortfolioItem(tx, {
      mechanicId,
      ownerUserId: user.id,
      ...input,
    })
    if (!item) fail.notFound()
    return item
  })
}

/** `PATCH /me/portfolio/:id`: changes the caption and optionally the picture; 404 for an item the mechanic does not have. */
export async function updateMyPortfolioItem(
  user: SessionUser,
  edit: { id: string; caption: string; imageId?: string }
) {
  return transaction(async (tx) => {
    const mechanicId = await lockOwnMechanic(tx, user.id)
    const saved = await portfolio.updatePortfolioItem(tx, {
      mechanicId,
      ownerUserId: user.id,
      ...edit,
    })
    if (!saved) fail.notFound()
    return saved
  })
}

/** `DELETE /me/portfolio/:id`: removes one with its file; an id the mechanic does not have changes nothing. */
export async function deleteMyPortfolioItem(user: SessionUser, id: string) {
  await transaction(async (tx) => {
    const mechanicId = await lockOwnMechanic(tx, user.id)
    await portfolio.deletePortfolioItem(tx, { mechanicId, id })
  })
}

/** `POST /me/portfolio/reorder`: the named pictures come first, in that order; none is ever deleted. */
export async function reorderMyPortfolio(user: SessionUser, ids: string[]) {
  return transaction(async (tx) => {
    const mechanicId = await lockOwnMechanic(tx, user.id)
    return portfolio.reorderPortfolio(tx, { mechanicId, ids })
  })
}

async function mechanicIdOf(ex: Executor, userId: string) {
  const ref = await refs.getBusinessRefOf(ex, userId)
  if (ref?.kind !== "mechanic") fail.notFound()
  return ref.id
}

async function lockOwnMechanic(tx: Transaction, userId: string) {
  const ref = await refs.getBusinessRefOf(tx, userId)
  if (ref?.kind !== "mechanic") fail.notFound()
  await refs.lockBusiness(tx, ref)
  return ref.id
}
