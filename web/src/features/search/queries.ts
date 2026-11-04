import {
  queryOptions,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query"
import { z } from "zod"

import { apiFetch, type ApiError } from "@/lib/api/client"
import {
  patchRows,
  restore,
  snapshot,
  useApiMutation,
} from "@/lib/api/mutation"
import { keys } from "@/lib/api/query-keys"
import { okSchema } from "@sayaratak/shared/schemas/api"
import type {
  savedSearchInputSchema,
  savedSearchPatchSchema,
} from "@sayaratak/shared/schemas/inputs"
import { savedSearchSchema } from "@sayaratak/shared/schemas/saved-search"

export const savedSearchQueries = {
  list: queryOptions({
    queryKey: keys.savedSearches,
    queryFn: ({ signal }) =>
      apiFetch("/saved-searches", {
        schema: z.array(savedSearchSchema),
        signal,
      }),
    staleTime: 30_000,
  }),
}
export const useCreateSavedSearch = () =>
  useApiMutation(
    (body: z.input<typeof savedSearchInputSchema>) =>
      apiFetch("/saved-searches", {
        method: "POST",
        body,
        schema: savedSearchSchema,
      }),
    [keys.savedSearches]
  )
// Rename, the alerts switch and "seen" change the cached row first and put it back when the call fails.
export function useUpdateSavedSearch() {
  const qc = useQueryClient()
  return useMutation<
    z.infer<typeof savedSearchSchema>,
    ApiError,
    { id: string } & z.input<typeof savedSearchPatchSchema>,
    Awaited<ReturnType<typeof snapshot>>
  >({
    mutationFn: ({ id, ...body }) =>
      apiFetch(`/saved-searches/${id}`, {
        method: "PATCH",
        body,
        schema: savedSearchSchema,
      }),
    onMutate: async ({ id, markSeen, ...patch }) => {
      const snap = await snapshot(qc, keys.savedSearches)
      patchRows(qc, keys.savedSearches, (rowId) => rowId === id, {
        ...patch,
        ...(markSeen && { newCount: 0 }),
      })
      return snap
    },
    onError: (_error, _vars, snap) => restore(qc, snap),
    onSettled: () => qc.invalidateQueries({ queryKey: keys.savedSearches }),
  })
}
export const useDeleteSavedSearch = () =>
  useApiMutation(
    (id: string) =>
      apiFetch(`/saved-searches/${id}`, { method: "DELETE", schema: okSchema }),
    [keys.savedSearches]
  )
