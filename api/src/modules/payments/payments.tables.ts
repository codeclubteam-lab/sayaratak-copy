import { paymentSchema } from "@sayaratak/shared/schemas/billing"
import { sql } from "drizzle-orm"
import {
  bigint,
  check,
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core"

import { user } from "~/modules/auth/auth.tables"
import { uploads } from "~/modules/uploads/uploads.tables"
import { bilingual, bilingualText, createdAt } from "~/shared/db/columns"

export const paymentItem = pgEnum(
  "payment_item",
  paymentSchema.shape.itemType.enum
)
export const paymentStatus = pgEnum(
  "payment_status",
  paymentSchema.shape.status.enum
)

const at = () => timestamp({ withTimezone: true })

// A manual Bankak transfer with its receipt (a private upload). Payments stay as financial records
// when the payer's account goes (A2). `itemId` names a plan, promotion or campaign by `itemType`:
// no foreign key. `reference` is the same for every payment of one payer and item, so not unique.
export const payments = pgTable(
  "payments",
  {
    id: text().primaryKey(),
    userId: text().references(() => user.id, { onDelete: "set null" }),
    itemType: paymentItem().notNull(),
    itemId: text().notNull(),
    itemLabel: bilingualText(),
    amount: bigint({ mode: "number" }).notNull(),
    reference: text().notNull(),
    payerName: text().notNull(),
    transactionRef: text().notNull(),
    receiptUploadId: text()
      .notNull()
      .references(() => uploads.id),
    status: paymentStatus().default("pending_review").notNull(),
    rejectionReason: text(),
    createdAt: createdAt(),
    reviewedAt: at(),
    reviewedBy: text().references(() => user.id, { onDelete: "set null" }),
  },
  (table) => [
    // One receipt under review per payer and item; a rejected one can be followed by a new row.
    uniqueIndex("payments_one_pending")
      .on(table.userId, table.itemType, table.itemId)
      .where(sql`${table.status} = 'pending_review'`),
    index().on(table.userId, table.createdAt),
    index().on(table.status, table.createdAt),
    index().on(table.itemType, table.itemId),
    check("payments_item_label", bilingual(table.itemLabel)),
    check("payments_amount", sql`${table.amount} >= 0`),
    check("payments_reference", sql`${table.reference} ~ '^SY-[0-9]{6}$'`),
  ]
)

export type PaymentRow = typeof payments.$inferSelect
export type NewPaymentRow = typeof payments.$inferInsert
