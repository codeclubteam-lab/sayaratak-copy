import { z } from "zod"

import { requiredInt } from "@sayaratak/shared/schemas/fields"

// What one promotion costs and how long it runs (A9). A price of 0 is allowed.
export const promotionPriceFormSchema = z.object({
  durationDays: requiredInt(1, 90),
  price: requiredInt(0, 9_999_999_999),
})
export type PromotionPriceForm = z.infer<typeof promotionPriceFormSchema>
