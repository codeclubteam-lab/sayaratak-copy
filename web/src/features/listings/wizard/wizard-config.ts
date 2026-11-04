import type { ComponentType } from "react"
import type { FieldValues } from "react-hook-form"
import { z } from "zod"

import { optional } from "@sayaratak/shared/search/schemas"

export const wizardStepIds = [
  "type",
  "details",
  "photos",
  "contact",
  "review",
  "done",
] as const

// Search params of every wizard route.
export const wizardSearchSchema = z.object({
  step: z.enum(wizardStepIds).default("type").catch("type"),
  // /post only; the dealer edit route takes the id from the path.
  edit: optional(z.string()),
  // Set on the done step: the id of the listing just created or saved.
  listing: optional(z.string()),
})

export type WizardStep = {
  id: string
  labelKey: string
  titleKey: string
  helperKey?: string
  Component: ComponentType<{ editing: boolean }>
  // Built from all values, because the details rules depend on the type chosen earlier. A step without rules (review) always passes.
  schema?: (values: FieldValues) => z.ZodType<FieldValues, FieldValues>
}

export const wizardDraftKey = (editId?: string) =>
  editId ? `listing:edit:${editId}` : "listing:new"

const passes = (step: WizardStep, values: FieldValues) =>
  !step.schema || step.schema(values).safeParse(values).success

// The furthest step that may open: the first one whose rules fail, or the last when all pass.
export function firstInvalidIndex(steps: WizardStep[], values: FieldValues) {
  const index = steps.findIndex((s) => !passes(s, values))
  return index === -1 ? steps.length - 1 : index
}
