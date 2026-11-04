import { useQueryClient } from "@tanstack/react-query"
import type { z } from "zod"

import { apiFetch } from "@/lib/api/client"
import { useApiMutation } from "@/lib/api/mutation"
import { keys } from "@/lib/api/query-keys"
import type { onboardingInputSchema } from "@sayaratak/shared/schemas/inputs"
import { userSchema } from "@sayaratak/shared/schemas/user"

// Creates the dealership, workshop or mechanic record and ends onboarding.
export function useCompleteOnboarding() {
  const qc = useQueryClient()
  return useApiMutation(
    (body: z.input<typeof onboardingInputSchema>) =>
      apiFetch("/onboarding/complete", {
        method: "POST",
        body,
        schema: userSchema,
      }).then((u) => {
        qc.setQueryData(keys.me, u)
        return u
      }),
    [keys.business.all, keys.billing.all]
  )
}
