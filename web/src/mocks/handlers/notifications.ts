import { countsSchema, okSchema } from "@sayaratak/shared/schemas/api"
import { readInputSchema } from "@sayaratak/shared/schemas/inputs"
import { notificationSchema } from "@sayaratak/shared/schemas/messaging"
import { pageOf } from "@sayaratak/shared/schemas/fields"

import { db, paginate } from "../db"
import { needUser, pageParams, route } from "../http"
import { byNewest, nowIso } from "../lib"

route("GET", "/notifications", (c) => {
  const user = needUser(c)
  const unread = c.query.get("unread") === "true"
  const rows = db.notifications
    .filter((n) => n.userId === user.id && (!unread || !n.readAt))
    .sort(byNewest)
  const { page, pageSize } = pageParams(c.query, 20)
  return pageOf(notificationSchema).parse(paginate(rows, page, pageSize))
})

route("POST", "/notifications/read", async (c) => {
  const user = needUser(c)
  const { ids } = await c.body(readInputSchema)
  const now = nowIso()
  for (const n of db.notifications)
    if (n.userId === user.id && !n.readAt && (!ids || ids.includes(n.id)))
      n.readAt = now
  return okSchema.parse({ ok: true })
})

route("GET", "/me/counts", (c) => {
  const user = needUser(c)
  const unreadMessages = db.messages.filter(
    (m) =>
      m.senderId !== user.id &&
      !m.readAt &&
      db.threads.some(
        (t) => t.id === m.threadId && t.participantIds.includes(user.id)
      )
  ).length
  const base = {
    unreadMessages,
    unreadNotifications: db.notifications.filter(
      (n) => n.userId === user.id && !n.readAt
    ).length,
  }
  if (user.role !== "admin") return countsSchema.parse(base)
  return countsSchema.parse({
    ...base,
    pendingListings: db.listings.filter((l) => l.moderation === "pending")
      .length,
    pendingPayments: db.payments.filter((p) => p.status === "pending_review")
      .length,
    pendingVerifications: db.verifications.filter((v) => v.status === "pending")
      .length,
    openReports: db.reports.filter((r) => r.status === "open").length,
    flaggedReviews: db.reviews.filter((r) => r.status === "flagged").length,
  })
})
