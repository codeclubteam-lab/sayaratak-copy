import { z } from "zod"

import { rangeSchema } from "@sayaratak/shared/schemas/api"

// The period lives in the URL; an unknown value falls back to 30 days.
export const analyticsSearchSchema = z.object({ range: rangeSchema })
export type AnalyticsSearch = z.infer<typeof analyticsSearchSchema>
export const analyticsSearchDefaults = { range: "30d" } as const
