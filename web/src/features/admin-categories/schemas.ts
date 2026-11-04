import { z } from "zod"

import { requiredText } from "@sayaratak/shared/schemas/fields"

// Both lists edit the two names; the enabled switch of a vehicle type sits on its row and asks first.
export const categoryFormSchema = z.object({
  nameAr: requiredText(40),
  nameEn: requiredText(40),
})
export type CategoryForm = z.infer<typeof categoryFormSchema>
