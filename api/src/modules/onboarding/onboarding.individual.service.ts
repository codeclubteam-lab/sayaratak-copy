import { interestSchema } from "@sayaratak/shared/schemas/user"
import { z } from "zod"

import { fail } from "~/shared/http/errors"
import { toFields } from "~/shared/http/validate"

const NAME_MAX = 80

const individualPayload = z.object({
  fullName: z
    .string()
    .trim()
    .min(1, "validation.required")
    .max(NAME_MAX, "validation.too_long")
    .optional(),
  cityId: z.string().min(1, "validation.required").optional(),
  // The mock drops a list it cannot read instead of failing.
  interests: interestSchema.array().catch([]),
})

/**
 * The individual's onboarding payload: name, home city, interests. A missing
 * name or city stays as the account has it; one that is present and empty is
 * 422 `validation`.
 */
export function readIndividual(payload: Record<string, unknown>) {
  const parsed = individualPayload.safeParse(payload)
  if (!parsed.success) fail.validation(toFields(parsed.error))
  return parsed.data
}
