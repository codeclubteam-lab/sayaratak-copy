import { z } from "zod"

import {
  optionalInt,
  requiredInt,
  requiredText,
} from "@sayaratak/shared/schemas/fields"

export const individualSettingsSchema = z.object({
  individualSubscriptionsEnabled: z.boolean(),
  freeListingLimit: requiredInt(0, 100),
})
export type IndividualSettingsForm = z.infer<typeof individualSettingsSchema>

// A9 plan fields plus the caps and credits each audience uses: listings and featured credits for individuals and dealerships (a dealership's listing limit is its vehicle limit), services and photos for workshops, portfolio photos for mechanics. An empty cap means no cap.
export const planFormSchema = z
  .object({
    audience: z.enum(["user", "dealership", "workshop", "mechanic"]),
    nameAr: requiredText(40),
    nameEn: requiredText(40),
    // Starts empty on a new plan, so the admin sets it on purpose; 0 is a valid price.
    price: optionalInt(0, 9_999_999_999),
    durationDays: requiredInt(1, 730),
    listingLimit: optionalInt(0, 10000),
    featuredCredits: requiredInt(0, 99),
    serviceLimit: optionalInt(0, 1000),
    photoLimit: optionalInt(0, 100),
    portfolioLimit: optionalInt(0, 1000),
    features: z
      .array(z.object({ ar: requiredText(80), en: requiredText(80) }))
      .max(8),
    enabled: z.boolean(),
    sortOrder: requiredInt(0, 999),
  })
  .refine((v) => v.price !== null, {
    path: ["price"],
    message: "validation.required",
  })
  .refine(
    (v) =>
      !["user", "dealership"].includes(v.audience) || v.listingLimit !== null,
    { path: ["listingLimit"], message: "validation.required" }
  )
export type PlanForm = z.infer<typeof planFormSchema>
