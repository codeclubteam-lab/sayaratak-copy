import {
  queryOptions,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query"
import { z } from "zod"

import type { ApiError } from "@/lib/api/client"
import { apiFetch } from "@/lib/api/client"
import {
  patchRows,
  restore,
  snapshot,
  useApiMutation,
} from "@/lib/api/mutation"
import { keys } from "@/lib/api/query-keys"
import { okSchema, type Counts } from "@sayaratak/shared/schemas/api"
import { pageOf } from "@sayaratak/shared/schemas/fields"
import type {
  messageInputSchema,
  threadInputSchema,
} from "@sayaratak/shared/schemas/inputs"
import {
  messageSchema,
  threadSchema,
  type Message,
} from "@sayaratak/shared/schemas/messaging"

const messagePageSchema = pageOf(messageSchema)
type MessagePage = z.infer<typeof messagePageSchema>

// Clients poll, and only while the tab is visible: the inbox every 15 seconds, the open thread every 5.
export const messagingQueries = {
  threads: queryOptions({
    queryKey: keys.threads.all,
    queryFn: ({ signal }) =>
      apiFetch("/threads", { schema: z.array(threadSchema), signal }),
    staleTime: 10_000,
    refetchInterval: 15_000,
    refetchOnWindowFocus: true,
  }),
  messages: (id: string) =>
    queryOptions({
      queryKey: keys.threads.messages(id),
      queryFn: ({ signal }) =>
        apiFetch(`/threads/${id}/messages`, {
          query: { pageSize: 100 },
          schema: messagePageSchema,
          signal,
        }),
      refetchInterval: 5_000,
      refetchOnWindowFocus: true,
    }),
}

const touched = [keys.threads.all, keys.counts] as const
export const useStartThread = () =>
  useApiMutation(
    (body: z.input<typeof threadInputSchema>) =>
      apiFetch("/threads", { method: "POST", body, schema: threadSchema }),
    touched
  )
// The sent message joins the open thread at once; the refetch after it confirms read marks and order.
export function useSendMessage(threadId: string) {
  const qc = useQueryClient()
  return useMutation<Message, ApiError, z.input<typeof messageInputSchema>>({
    mutationFn: (body) =>
      apiFetch(`/threads/${threadId}/messages`, {
        method: "POST",
        body,
        schema: messageSchema,
      }),
    onSuccess: (message) => {
      qc.setQueryData<MessagePage>(keys.threads.messages(threadId), (page) =>
        page && !page.items.some((m) => m.id === message.id)
          ? {
              ...page,
              items: [...page.items, message],
              total: page.total + 1,
            }
          : page
      )
      for (const queryKey of touched) void qc.invalidateQueries({ queryKey })
    },
  })
}

// Optimistic: the unread badge clears at once.
export function useMarkThreadRead() {
  const qc = useQueryClient()
  return useMutation<
    unknown,
    ApiError,
    { id: string; unread: number },
    Awaited<ReturnType<typeof snapshot>>
  >({
    mutationFn: ({ id }) =>
      apiFetch(`/threads/${id}/read`, { method: "POST", schema: okSchema }),
    onMutate: async ({ id, unread }) => {
      const snap = await snapshot(qc, keys.threads.all)
      patchRows(qc, keys.threads.all, (rowId) => rowId === id, {
        unreadCount: 0,
      })
      qc.setQueryData<Counts>(keys.counts, (c) =>
        c ? { ...c, unreadMessages: Math.max(0, c.unreadMessages - unread) } : c
      )
      return snap
    },
    onError: (_error, _vars, snap) => restore(qc, snap),
    onSettled: () =>
      Promise.all(
        touched.map((queryKey) => qc.invalidateQueries({ queryKey }))
      ),
  })
}
