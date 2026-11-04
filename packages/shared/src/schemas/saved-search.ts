import { z } from "zod"

import { searchParamsSchema } from "../search/schemas"
import { idSchema } from "./fields"

export const savedSearchSchema = z.object({
  id: idSchema,
  name: z.string(),
  params: searchParamsSchema,
  alerts: z.boolean(),
  newCount: z.number().int(),
  createdAt: z.string(),
})
export type SavedSearch = z.infer<typeof savedSearchSchema>
