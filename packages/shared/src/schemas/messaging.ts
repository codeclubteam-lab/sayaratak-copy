import { z } from "zod"

import { bilingualSchema, idSchema } from "./fields"

export const threadSchema = z.object({
  id: idSchema,
  subjectType: z.enum(["listing", "dealership", "workshop", "mechanic"]),
  subjectId: idSchema,
  subjectTitle: bilingualSchema,
  subjectImage: z.string().optional(),
  // Public page of the subject (a listing or a business); absent when it was deleted.
  subjectSlug: z.string().optional(),
  participants: z.array(
    z.object({
      id: idSchema,
      name: z.string(),
      avatarUrl: z.string().nullable(),
    })
  ),
  lastMessage: z.object({
    body: z.string(),
    createdAt: z.string(),
    senderId: idSchema,
  }),
  unreadCount: z.number().int(),
})
export type Thread = z.infer<typeof threadSchema>

export const messageSchema = z.object({
  id: idSchema,
  threadId: idSchema,
  senderId: idSchema,
  body: z.string(),
  createdAt: z.string(),
  readAt: z.string().optional(),
})
export type Message = z.infer<typeof messageSchema>

export const notificationSchema = z.object({
  id: idSchema,
  type: z.enum([
    "message",
    "listing_approved",
    "listing_rejected",
    "listing_expired",
    "saved_search_match",
    "review_new",
    "payment_approved",
    "payment_rejected",
    "subscription_expiring",
    "verification_result",
    "business_status",
    "broadcast",
  ]),
  // Both languages are stored; the UI shows the active locale.
  title: bilingualSchema,
  body: bilingualSchema,
  href: z.string().optional(),
  createdAt: z.string(),
  readAt: z.string().optional(),
})
export type Notification = z.infer<typeof notificationSchema>
