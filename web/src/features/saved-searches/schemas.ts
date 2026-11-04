import { z } from "zod"

import { requiredText } from "@sayaratak/shared/schemas/fields"

export const renameSearchSchema = z.object({ name: requiredText(60) })
export type RenameSearchForm = z.infer<typeof renameSearchSchema>
