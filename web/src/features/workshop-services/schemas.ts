import { z } from "zod"

import {
  optionalInt,
  optionalText,
  requiredText,
} from "@sayaratak/shared/schemas/fields"

export const serviceFormSchema = z.object({
  name: requiredText(60),
  description: optionalText(300),
  priceFrom: optionalInt(1, 9_999_999_999, "validation.price_min"),
  templateId: z.string().nullable(), // kept from the template, never edited by hand
})
export type ServiceForm = z.infer<typeof serviceFormSchema>
