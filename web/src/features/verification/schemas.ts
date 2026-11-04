import { z } from "zod"

import { imageFileSchema } from "@sayaratak/shared/schemas/fields"
import { verificationLabels } from "@sayaratak/shared/schemas/admin"
import type { TargetType } from "@sayaratak/shared/schemas/review"

export const MAX_DOCUMENTS = 5

export const verificationFormSchema = z.object({
  documents: z
    .array(
      z.object({ label: z.enum(verificationLabels), file: imageFileSchema })
    )
    .min(1, "validation.select_min")
    .max(MAX_DOCUMENTS),
  note: z.string().trim().max(300, "validation.too_long").optional(),
})
export type VerificationForm = z.input<typeof verificationFormSchema>

// What each kind of business sends (A9 8.7). The form's label list is these plus "other".
export const requiredDocuments = {
  dealership: ["commercial_registration", "shop_photo"],
  workshop: ["workshop_license", "shop_photo"],
  mechanic: ["national_id", "certificate"],
} as const satisfies Record<
  TargetType,
  readonly (typeof verificationLabels)[number][]
>
