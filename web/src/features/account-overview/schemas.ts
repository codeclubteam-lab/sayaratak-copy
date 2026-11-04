import { z } from "zod"

// `?welcome=1` shows the welcome notice once, after onboarding. Anything else is ignored.
export const overviewSearchSchema = z.object({
  welcome: z.coerce.number().optional().catch(undefined),
})
