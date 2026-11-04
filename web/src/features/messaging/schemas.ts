import { z } from "zod"

import { optional } from "@sayaratak/shared/search/schemas"

export const messageSchema = z.object({
  body: z
    .string()
    .trim()
    .min(1, "validation.required")
    .max(1000, "validation.too_long"),
})
export type MessageForm = z.infer<typeof messageSchema>

// The inbox keeps the open thread, the search text and the unread switch in the URL.
export const messagesSearchSchema = z.object({
  thread: optional(z.string().min(1).max(40)),
  q: optional(z.string().trim().max(60)),
  filter: z.enum(["all", "unread"]).default("all").catch("all"),
})
export type MessagesSearch = z.infer<typeof messagesSearchSchema>
export const messagesSearchDefaults = { filter: "all" } as const

// Only what differs from the defaults goes into the address.
export const pruneMessagesSearch = ({ thread, q, filter }: MessagesSearch) => ({
  ...(thread && { thread }),
  ...(q && { q }),
  ...(filter !== "all" && { filter }),
})
export type PrunedMessagesSearch = ReturnType<typeof pruneMessagesSearch>
