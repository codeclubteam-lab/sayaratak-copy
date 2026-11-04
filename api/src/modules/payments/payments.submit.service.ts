import type { PaymentForm } from "@sayaratak/shared/schemas/inputs"

import { db } from "~/shared/db/client"
import { transaction } from "~/shared/db/tx"
import { fail } from "~/shared/http/errors"
import { newId } from "~/shared/text/ids"
import { clock } from "~/shared/time/clock"
import * as ads from "~/modules/ads/ads.service"
import * as auth from "~/modules/auth/auth.service"
import type { SessionUser } from "~/modules/auth/auth.types"
import { storePrivateFile } from "~/modules/uploads/uploads.store.service"

import { getPayable, paymentReference } from "./payments.item.service"
import { toPayment } from "./payments.mapper"
import * as q from "./payments.queries"

const ID_PREFIX = "pay"

/**
 * `POST /payments`: a Bankak receipt for a plan, promotion or campaign goes
 * into the admin queue. The price is the item's, never the client's. 409
 * `payment_pending` while a receipt for the item waits. Sending a plan's
 * receipt drops the plan picked in onboarding; a campaign moves to review.
 */
export async function submitReceipt(user: SessionUser, form: PaymentForm) {
  const item = { type: form.itemType, id: form.itemId }
  const payable = await getPayable(db, user, item)
  const key = { userId: user.id, itemType: item.type, itemId: item.id }
  if (await q.getPendingId(db, key)) fail.conflict("payment_pending")
  return transaction(async (tx) => {
    // One payer's sends queue on the account row, so the file is stored only if the item is still free.
    await auth.lockUser(tx, user.id)
    if (await q.getPendingId(tx, key)) fail.conflict("payment_pending")
    // The slots are taken only now, so check again that the pages still have room.
    if (item.type === "campaign") await ads.assertCampaignRoom(tx, item.id)
    const receipt = await storePrivateFile(tx, {
      user,
      file: form.receipt,
      kind: "receipt",
    })
    const saved = await q.insertIfNone(tx, {
      id: newId(ID_PREFIX),
      userId: user.id,
      itemType: item.type,
      itemId: item.id,
      itemLabel: payable.label,
      amount: payable.amount,
      reference: paymentReference(user.id, item.id),
      payerName: form.payerName,
      transactionRef: form.transactionRef,
      receiptUploadId: receipt.id,
      createdAt: clock.now(),
    })
    if (!saved) fail.conflict("payment_pending")
    if (item.type === "plan") await auth.clearChosenPlan(tx, user.id)
    if (item.type === "campaign") await ads.markCampaignUnderReview(tx, item.id)
    return toPayment(saved, receipt.url)
  })
}
