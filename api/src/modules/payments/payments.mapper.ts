import type { Payment } from "@sayaratak/shared/schemas/billing"

import type { PaymentRow } from "./payments.tables"

export function toPayment(row: PaymentRow, receiptUrl: string): Payment {
  return {
    id: row.id,
    // A payment outlives its payer's account (userId null); the lists a payer reads never hold one.
    userId: row.userId ?? "",
    itemType: row.itemType,
    itemId: row.itemId,
    itemLabel: row.itemLabel,
    amount: row.amount,
    method: "bankak_transfer",
    reference: row.reference,
    payerName: row.payerName,
    transactionRef: row.transactionRef,
    receiptUrl,
    status: row.status,
    rejectionReason: row.rejectionReason ?? undefined,
    createdAt: row.createdAt.toISOString(),
    reviewedAt: row.reviewedAt?.toISOString(),
  }
}
