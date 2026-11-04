import { z } from "zod"

import { requiredText } from "@sayaratak/shared/schemas/fields"

export const portfolioFormSchema = z.object({
  imageId: z.string().min(1, "validation.required"),
  caption: requiredText(120),
})
export type PortfolioForm = z.infer<typeof portfolioFormSchema>
