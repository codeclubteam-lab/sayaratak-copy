import {
  keepPreviousData,
  queryOptions,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query"

import type { ApiError } from "@/lib/api/client"
import { apiFetch } from "@/lib/api/client"
import { patchRows, restore, snapshot } from "@/lib/api/mutation"
import { keys } from "@/lib/api/query-keys"
import { okSchema, type Counts } from "@sayaratak/shared/schemas/api"
import { pageOf } from "@sayaratak/shared/schemas/fields"
import { notificationSchema } from "@sayaratak/shared/schemas/messaging"
import { countsQuery } from "./counts-query"

export const notificationQueries = {
  list: (filters: Record<string, unknown> = {}) =>
    queryOptions({
      queryKey: keys.notifications.list(filters),
      queryFn: ({ signal }) =>
        apiFetch("/notifications", {
          query: filters,
          schema: pageOf(notificationSchema),
          signal,
        }),
      staleTime: 10_000,
      refetchOnWindowFocus: true,
      placeholderData: keepPreviousData,
    }),
  counts: countsQuery,
}

// Optimistic: rows and the bell badge update at once. No ids marks everything read.
export function useMarkNotificationsRead() {
  const qc = useQueryClient()
  return useMutation<
    unknown,
    ApiError,
    string[] | undefined,
    Awaited<ReturnType<typeof snapshot>>
  >({
    mutationFn: (ids) =>
      apiFetch("/notifications/read", {
        method: "POST",
        body: { ids },
        schema: okSchema,
      }),
    onMutate: async (ids) => {
      const snap = await snapshot(qc, keys.notifications.all)
      const readAt = new Date().toISOString()
      patchRows(qc, keys.notifications.all, (id) => !ids || ids.includes(id), {
        readAt,
      })
      qc.setQueryData<Counts>(keys.counts, (c) =>
        c
          ? {
              ...c,
              unreadNotifications: ids
                ? Math.max(0, c.unreadNotifications - ids.length)
                : 0,
            }
          : c
      )
      return snap
    },
    onError: (_error, _ids, snap) => restore(qc, snap),
    onSettled: () =>
      Promise.all([
        qc.invalidateQueries({ queryKey: keys.notifications.all }),
        qc.invalidateQueries({ queryKey: keys.counts }),
      ]),
  })
}
