import { z } from "zod"

import { requiredText } from "@sayaratak/shared/schemas/fields"
import { broadcastAudienceSchema } from "@sayaratak/shared/schemas/api"
import {
  pathSchema,
  type broadcastInputSchema,
} from "@sayaratak/shared/schemas/inputs"

// The form keeps both languages flat; `toBroadcastInput` nests them for the wire.
export const broadcastFormSchema = broadcastAudienceSchema.extend({
  titleAr: requiredText(80),
  titleEn: requiredText(80),
  bodyAr: requiredText(300),
  bodyEn: requiredText(300),
  cityId: z.string(),
  href: pathSchema.or(z.literal("")),
})
export type BroadcastForm = z.infer<typeof broadcastFormSchema>

export const broadcastFormDefaults: BroadcastForm = {
  titleAr: "",
  titleEn: "",
  bodyAr: "",
  bodyEn: "",
  roles: ["user", "dealership", "workshop", "mechanic"],
  cityId: "",
  verifiedOnly: false,
  href: "",
}

export const toBroadcastInput = (
  v: BroadcastForm
): z.input<typeof broadcastInputSchema> => ({
  title: { ar: v.titleAr, en: v.titleEn },
  body: { ar: v.bodyAr, en: v.bodyEn },
  roles: v.roles,
  cityId: v.cityId || undefined,
  verifiedOnly: v.verifiedOnly,
  href: v.href || undefined,
})
