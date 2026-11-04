import { z } from "zod"

import { requiredText } from "@sayaratak/shared/schemas/fields"
import { vehicleTypeSchema } from "@sayaratak/shared/schemas/listing"

export const makeSchema = z.object({
  nameAr: requiredText(40),
  nameEn: requiredText(40),
  logoUrl: z.string(),
  vehicleTypes: z.array(vehicleTypeSchema).min(1, "validation.select_min"),
})
export type MakeForm = z.infer<typeof makeSchema>

export const modelSchema = z.object({
  nameAr: requiredText(40),
  nameEn: requiredText(40),
})
export type ModelForm = z.infer<typeof modelSchema>
