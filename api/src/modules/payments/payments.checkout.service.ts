import { db } from "~/shared/db/client"
import { fail } from "~/shared/http/errors"
import type { SessionUser } from "~/modules/auth/auth.types"
import * as content from "~/modules/content/content.service"

import {
  getPayable,
  type ItemType,
  paymentReference,
} from "./payments.item.service"
import * as q from "./payments.queries"

const TYPES: readonly ItemType[] = ["plan", "promotion", "campaign"]

/**
 * `GET /checkout?item=plan:<id>` (or `promotion:`, `campaign:`): what to pay,
 * the reference to write in the transfer note, the Bankak account, and the
 * receipt already waiting for review, if any. Anything but those three item
 * types reads as a missing page.
 */
export async function getCheckout(user: SessionUser, item = "") {
  const [type, id = ""] = item.split(":")
  const itemType = TYPES.find((t) => t === type)
  if (!itemType) fail.notFound()
  const payable = await getPayable(db, user, { type: itemType, id })
  const [bankak, pendingId] = await Promise.all([
    content.getBankak(db),
    q.getPendingId(db, { userId: user.id, itemType, itemId: id }),
  ])
  return {
    itemType,
    itemId: id,
    itemLabel: payable.label,
    amount: payable.amount,
    durationDays: payable.durationDays,
    reference: paymentReference(user.id, id),
    bankak,
    pendingPaymentId: pendingId ?? null,
  }
}
