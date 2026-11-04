import type { Bilingual } from "@sayaratak/shared/schemas/fields"

import { db } from "~/shared/db/client"
import { type Executor, afterCommitOrNow } from "~/shared/db/tx"
import { log } from "~/shared/log/logger"
import { retryAt } from "~/shared/mail/backoff"
import * as outbox from "~/shared/mail/outbox.queries"
import { startPush, transmit } from "~/shared/push/send"
import { newId } from "~/shared/text/ids"
import { clock } from "~/shared/time/clock"

import * as q from "./devices.queries"

const ID_PREFIX = "out"

type Push = {
  userId: string
  /** The notification's type, id and path: what the app needs to open the right screen (A18). */
  type: string
  notificationId: string
  href?: string
  title: Bilingual
  body: Bilingual
}

/**
 * One push for each of the person's devices, in the device's own language.
 * Written as outbox rows inside the caller's transaction; the sending starts
 * after the commit, without making the answer wait (A18).
 */
export async function queuePush(ex: Executor, push: Push) {
  const list = await q.listOf(ex, push.userId)
  if (list.length === 0) return
  const now = clock.now()
  const rows = await Promise.all(
    list.map((device) => outbox.insertOutbox(ex, pushRow(device, push, now)))
  )
  await afterCommitOrNow(ex, () => {
    for (const row of rows) if (row) startPush(() => deliverPush(row))
  })
}

/**
 * The same, for a chunk of people at once (a broadcast): one read of their devices and one insert.
 * Nothing starts sending here; the outbox job (A10) takes the rows, which keeps a broadcast to
 * thousands of phones from opening thousands of requests at the same moment.
 */
export async function queuePushMany(ex: Executor, pushes: Push[]) {
  const devices = await q.listOfUsers(
    ex,
    pushes.map((push) => push.userId)
  )
  const byUser = new Map(pushes.map((push) => [push.userId, push]))
  const now = clock.now()
  const rows = devices.flatMap((device) => {
    const push = byUser.get(device.userId)
    return push ? [pushRow(device, push, now)] : []
  })
  await outbox.insertOutboxMany(ex, rows)
}

/** One outbox row for one device: the text in the device's own language and what the app needs to open the screen. */
function pushRow(device: q.DeviceRow, push: Push, now: Date) {
  const data = {
    type: push.type,
    id: push.notificationId,
    ...(push.href && { href: push.href }),
  }
  return {
    id: newId(ID_PREFIX),
    channel: "push" as const,
    to: device.id,
    template: push.type,
    locale: device.locale,
    payload: {
      push: {
        userId: push.userId,
        title: push.title[device.locale as keyof Bilingual],
        body: push.body[device.locale as keyof Bilingual],
        data,
      },
    },
    sendAfter: now,
    createdAt: now,
  }
}

/**
 * Sends one push row; the outbox job (A10) calls it again for failed rows.
 * FCM reporting the token dead deletes the device (A18).
 */
export async function deliverPush(row: outbox.OutboxRow) {
  const push = row.payload.push
  const device = await q.getById(db, row.to)
  // The phone signed out, or moved to another account, since the row was written:
  // nothing is sent, and the row is closed.
  if (!push || device?.userId !== push.userId) {
    await outbox.updateOutboxSent(db, row.id, clock.now())
    return
  }
  try {
    const result = await transmit({
      token: device.fcmToken,
      title: push.title,
      body: push.body,
      data: push.data,
    })
    if (result === "dead") await q.removeById(db, device.id)
    await outbox.updateOutboxSent(db, row.id, clock.now())
  } catch (error) {
    log.error("push_failed", { id: row.id, attempt: row.attempts + 1, error })
    await outbox.updateOutboxFailed(db, row.id, {
      error: String(error),
      sendAfter: retryAt(row.attempts, clock.now()),
    })
  }
}
