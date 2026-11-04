import { z } from "zod"

import { imageFileSchema, nameSchema } from "@sayaratak/shared/schemas/fields"

// The amount, reference and Bankak account come from GET /checkout, never from this form.
export const paymentFormSchema = z.object({
  payerName: nameSchema,
  transactionRef: z
    .string()
    .trim()
    .min(4, "validation.txn_min")
    .max(40, "validation.too_long"),
  receipt: imageFileSchema,
})
export type PaymentForm = z.input<typeof paymentFormSchema>

// The billing page keeps its tab and the history page in the URL.
export const billingSearchSchema = z.object({
  tab: z.enum(["plan", "history"]).default("plan").catch("plan"),
  page: z.coerce.number().int().min(1).default(1).catch(1),
})
export type BillingSearch = z.infer<typeof billingSearchSchema>
export const billingSearchDefaults = { tab: "plan", page: 1 } as const

export const pruneBillingSearch = ({ tab, page }: BillingSearch) => ({
  ...(tab !== "plan" && { tab }),
  ...(page > 1 && { page }),
})

// `item` is `plan:<planId>` or `promotion:<promotionId>`.
export const checkoutSearchSchema = z.object({
  item: z.string().max(80).default("").catch(""),
})

// The dealer's promotions page keeps its tab in the URL.
export const promotionTabs = ["active", "ended", "waiting"] as const
export const promotionsSearchSchema = z.object({
  tab: z.enum(promotionTabs).default("active").catch("active"),
})
export type PromotionsSearch = z.infer<typeof promotionsSearchSchema>
