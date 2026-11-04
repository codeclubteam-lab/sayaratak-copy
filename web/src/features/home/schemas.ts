import { z } from "zod"

import { optionalInt } from "@sayaratak/shared/schemas/fields"
import { intentSchema } from "@sayaratak/shared/schemas/listing"

export const heroSearchSchema = z.object({
  kind: z.enum(["vehicle", "part"]),
  intent: intentSchema.optional(),
  city: z.string().optional(),
  make: z.string().optional(),
  model: z.string().optional(),
  maxPrice: optionalInt(0, 9_999_999_999), // null is dropped when the form builds the search URL
})
export type HeroSearch = z.infer<typeof heroSearchSchema>
