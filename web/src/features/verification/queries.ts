import { queryOptions } from "@tanstack/react-query"
import type { z } from "zod"

import { apiFetch } from "@/lib/api/client"
import { useApiMutation } from "@/lib/api/mutation"
import { keys } from "@/lib/api/query-keys"
import {
  reportSchema,
  verificationRequestSchema,
} from "@sayaratak/shared/schemas/admin"
import type { reportInputSchema } from "@sayaratak/shared/schemas/inputs"
import type { VerificationForm } from "./schemas"

export const verificationQuery = queryOptions({
  queryKey: keys.verification,
  queryFn: ({ signal }) =>
    apiFetch("/me/verification", {
      schema: verificationRequestSchema.nullable(),
      signal,
    }),
})

export const useReportListing = () =>
  useApiMutation((body: z.input<typeof reportInputSchema>) =>
    apiFetch("/reports", { method: "POST", body, schema: reportSchema })
  )
// multipart, like a payment: `label` and `file` once per document, in order.
export const useRequestVerification = () =>
  useApiMutation(
    ({ documents, note }: VerificationForm) => {
      const form = new FormData()
      for (const d of documents) {
        form.append("label", d.label)
        form.append("file", d.file)
      }
      if (note) form.set("note", note)
      return apiFetch("/me/verification", {
        method: "POST",
        form,
        schema: verificationRequestSchema,
      })
    },
    [keys.verification]
  )
