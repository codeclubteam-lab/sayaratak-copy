import type { NotificationPrefs } from "@sayaratak/shared/schemas/api"
import type { Bilingual } from "@sayaratak/shared/schemas/fields"
import type { Notification } from "@sayaratak/shared/schemas/messaging"

import { db } from "~/shared/db/client"
import type { Executor } from "~/shared/db/tx"
import { newId } from "~/shared/text/ids"
import { clock } from "~/shared/time/clock"
import type { SessionUser } from "~/modules/auth/auth.types"
import * as auth from "~/modules/auth/auth.service"
import { queuePush } from "~/modules/devices/devices.push.service"

import { toNotification, toNotificationHref } from "./notifications.mapper"
import * as q from "./notifications.queries"

const ID_PREFIX = "n"

// The switch of the recipient's settings that silences each type (mock `prefOf`).
const PREF_OF: Record<Notification["type"], keyof NotificationPrefs> = {
  message: "messages",
  listing_approved: "updates",
  listing_rejected: "updates",
  listing_expired: "updates",
  verification_result: "updates",
  business_status: "updates",
  saved_search_match: "savedSearchMatches",
  review_new: "reviews",
  payment_approved: "billing",
  payment_rejected: "billing",
  subscription_expiring: "billing",
  broadcast: "announcements",
}

type Message = {
  userId: string
  type: Notification["type"]
  title: Bilingual
  body: Bilingual
  /** A path with no language; the recipient's dashboard base is added. */
  href?: string
}

/**
 * Tells one person something in the bell. Nothing is written when the person
 * is gone or switched that kind off. Both languages are stored, so the
 * reader sees the right one after switching. Every domain event that
 * notifies calls this inside its own transaction. The same switch decides the
 * push to the person's devices (A18).
 */
export async function notify(ex: Executor, message: Message) {
  const [recipient] = await auth.listUsers(ex, [message.userId])
  if (!recipient?.prefs[PREF_OF[message.type]]) return
  const id = newId(ID_PREFIX)
  const href = message.href && toNotificationHref(recipient.role, message.href)
  await q.insert(ex, {
    id,
    userId: recipient.id,
    type: message.type,
    title: message.title,
    body: message.body,
    href,
    createdAt: clock.now(),
  })
  await queuePush(ex, {
    userId: recipient.id,
    type: message.type,
    notificationId: id,
    href,
    title: message.title,
    body: message.body,
  })
}

/**
 * `GET /notifications`: the user's notifications, newest first. `before` (a
 * notification id) lists the ones older than it, for an app that scrolls; an
 * id the user does not have lists nothing.
 */
export async function listNotifications(
  user: SessionUser,
  find: {
    unreadOnly: boolean
    before?: string
    page: { page: number; pageSize: number }
  }
) {
  const cursor = find.before
    ? await q.getCursor(db, { id: find.before, userId: user.id })
    : undefined
  const { page, pageSize } = find.page
  const { rows, total } =
    find.before && !cursor
      ? { rows: [], total: 0 }
      : await q.listOf(db, {
          userId: user.id,
          unreadOnly: find.unreadOnly,
          before: cursor,
          page: { offset: (page - 1) * pageSize, size: pageSize },
        })
  return { items: rows.map(toNotification), total, page, pageSize }
}

/** `POST /notifications/read`: marks the ones named read, or all when no ids are sent. */
export async function markNotificationsRead(user: SessionUser, ids?: string[]) {
  await q.updateRead(db, { userId: user.id, ids, at: clock.now() })
}
