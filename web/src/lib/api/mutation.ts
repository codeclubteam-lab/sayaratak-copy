import {
  useMutation,
  useQueryClient,
  type QueryClient,
  type QueryKey,
} from "@tanstack/react-query"
import { z } from "zod"

import type { ApiError } from "./client"

// Runs the request, then invalidates every key prefix in `invalidate`.
export function useApiMutation<TVars, TData>(
  fn: (vars: TVars) => Promise<TData>,
  invalidate: readonly QueryKey[] = []
) {
  const qc = useQueryClient()
  return useMutation<TData, ApiError, TVars>({
    mutationFn: fn,
    onSuccess: async () => {
      await Promise.all(
        invalidate.map((queryKey) => qc.invalidateQueries({ queryKey }))
      )
    },
  })
}

type Snapshot = [QueryKey, unknown][]
export async function snapshot(
  qc: QueryClient,
  key: QueryKey
): Promise<Snapshot> {
  await qc.cancelQueries({ queryKey: key })
  return qc.getQueriesData({ queryKey: key })
}
export function restore(qc: QueryClient, snap: Snapshot | undefined) {
  for (const [key, data] of snap ?? []) qc.setQueryData(key, data)
}

const pageShape = z.looseObject({
  items: z.array(z.looseObject({ id: z.string() })),
})
const rowShape = z.looseObject({ id: z.string() })
// Optimistic edit of one row wherever it is cached: inside list pages, arrays and detail objects.
export function patchRows(
  qc: QueryClient,
  key: QueryKey,
  match: (id: string) => boolean,
  patch: Record<string, unknown>
) {
  for (const [k, data] of qc.getQueriesData({ queryKey: key })) {
    const page = pageShape.safeParse(data)
    if (page.success) {
      qc.setQueryData(k, {
        ...page.data,
        items: page.data.items.map((r) =>
          match(r.id) ? { ...r, ...patch } : r
        ),
      })
      continue
    }
    const list = z.array(rowShape).safeParse(data)
    if (list.success) {
      qc.setQueryData(
        k,
        list.data.map((r) => (match(r.id) ? { ...r, ...patch } : r))
      )
      continue
    }
    const row = rowShape.safeParse(data)
    if (row.success && match(row.data.id))
      qc.setQueryData(k, { ...row.data, ...patch })
  }
}
