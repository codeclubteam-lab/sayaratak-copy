import { z } from "zod"

// The page keeps the tab and the page number in the URL.
export const notificationsSearchSchema = z.object({
  tab: z.enum(["all", "unread"]).default("all").catch("all"),
  page: z.coerce.number().int().min(1).default(1).catch(1),
})
export type NotificationsSearch = z.infer<typeof notificationsSearchSchema>
export const notificationsSearchDefaults = { tab: "all", page: 1 } as const

// Only what differs from the defaults goes into the address.
export const pruneNotificationsSearch = ({
  tab,
  page,
}: NotificationsSearch) => ({
  ...(tab !== "all" && { tab }),
  ...(page > 1 && { page }),
})
