import { z } from "zod"

import { bilingualSchema, idSchema } from "./fields"
import { promotionTypeSchema } from "./listing"

export const planSchema = z.object({
  id: idSchema,
  audience: z.enum(["user", "dealership", "workshop", "mechanic"]),
  name: bilingualSchema,
  price: z.number().int(),
  durationDays: z.number().int(),
  // How many live listings a subscriber may hold; a dealership's are its vehicles. None means no cap.
  listingLimit: z.number().int().optional(),
  // Workshop and mechanic caps; none means no cap.
  serviceLimit: z.number().int().optional(),
  photoLimit: z.number().int().optional(),
  portfolioLimit: z.number().int().optional(),
  features: z.array(bilingualSchema),
  // Free 7-day pins per period; they do not carry over.
  featuredCredits: z.number().int().min(0).default(0),
  enabled: z.boolean(),
  sortOrder: z.number().int(),
})
export type Plan = z.infer<typeof planSchema>

// `price` and `usage.limit` are copied from the plan when the subscription is created (an admin can set custom ones). `limit` is null when there is no cap.
export const subscriptionSchema = z.object({
  id: idSchema,
  userId: idSchema,
  planId: idSchema,
  status: z.enum(["active", "pending", "expired", "canceled"]),
  startsAt: z.string(),
  endsAt: z.string(),
  price: z.number().int(),
  usage: z.object({
    used: z.number().int(),
    limit: z.number().int().nullable(),
  }),
  // The admin's note when they assigned the plan.
  note: z.string().optional(),
})
export type Subscription = z.infer<typeof subscriptionSchema>

export const paymentSchema = z.object({
  id: idSchema,
  userId: idSchema,
  itemType: z.enum(["plan", "promotion", "campaign"]),
  itemId: idSchema,
  itemLabel: bilingualSchema,
  amount: z.number().int(),
  method: z.literal("bankak_transfer"),
  reference: z.string(),
  payerName: z.string(),
  transactionRef: z.string(),
  receiptUrl: z.string(),
  status: z.enum(["pending_review", "approved", "rejected"]),
  rejectionReason: z.string().optional(),
  createdAt: z.string(),
  reviewedAt: z.string().optional(),
})
export type Payment = z.infer<typeof paymentSchema>

// `startsAt` and `endsAt` are set when the promotion becomes active; the `promotions` array on a listing holds active ones only.
export const promotionSchema = z.object({
  id: idSchema,
  listingId: idSchema,
  type: promotionTypeSchema,
  status: z.enum(["pending_payment", "active", "ended"]),
  durationDays: z.number().int(),
  startsAt: z.string().optional(),
  endsAt: z.string().optional(),
  source: z.enum(["paid", "admin_grant", "credit"]),
  paymentId: z.string().optional(),
})
export type Promotion = z.infer<typeof promotionSchema>

// Featured has one row per length (3, 7 and 14 days); a bump has one row with 0 days.
export const promotionPriceSchema = z.object({
  id: z.string(),
  type: promotionTypeSchema,
  durationDays: z.number().int(),
  price: z.number().int(),
})
export type PromotionPrice = z.infer<typeof promotionPriceSchema>
