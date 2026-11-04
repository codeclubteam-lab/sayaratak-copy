import { z } from "zod"

import { adPageIdSchema, creativeSchema } from "@sayaratak/shared/schemas/ads"
import { mediaSchema } from "@sayaratak/shared/schemas/listing"

// The campaign wizard's form. The photo is the uploaded media; it becomes `creative.imageUrl` on submit.
export const campaignFormSchema = z.object({
  cover: mediaSchema
    .nullable()
    .refine((v) => v !== null, "validation.ad_photo"),
  copy: creativeSchema.shape.copy,
  href: z.string().min(1, "validation.ad_target"),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "validation.required"),
  weeks: z.number().int().min(1).max(4),
  pages: z.array(adPageIdSchema).min(1, "validation.ad_pages"),
})
export type CampaignForm = z.input<typeof campaignFormSchema>

// Fields each step checks before Next.
export const stepFields = [
  ["cover", "copy", "href"],
  ["startDate", "weeks"],
  ["pages"],
  [],
] as const satisfies readonly (readonly (keyof CampaignForm)[])[]
