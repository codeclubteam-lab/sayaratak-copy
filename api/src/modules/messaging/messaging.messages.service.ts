import type { Bilingual } from "@sayaratak/shared/schemas/fields"

import { db } from "~/shared/db/client"
import { type Executor, type Transaction, transaction } from "~/shared/db/tx"
import { fail } from "~/shared/http/errors"
import { newId } from "~/shared/text/ids"
import { clock } from "~/shared/time/clock"
import type { SessionUser } from "~/modules/auth/auth.types"
import { notify } from "~/modules/notifications/notifications.service"

import { toMessage } from "./messaging.mapper"
import * as messages from "./messaging.messages.queries"
import * as threads from "./messaging.threads.queries"

const ID_PREFIX = "msg"
const NEW_MESSAGE: Bilingual = { ar: "رسالة جديدة", en: "New message" }

/**
 * Writes a message and tells the other people in the thread. Part of the
 * caller's transaction, so a thread and its first message appear together.
 */
export async function postMessage(
  tx: Transaction,
  post: {
    thread: threads.ThreadRow
    participantIds: string[]
    sender: SessionUser
    body: string
  }
) {
  const { thread, sender } = post
  const saved = await messages.insert(tx, {
    id: newId(ID_PREFIX),
    threadId: thread.id,
    senderId: sender.id,
    body: post.body,
    createdAt: clock.now(),
  })
  for (const userId of post.participantIds.filter((id) => id !== sender.id))
    await notify(tx, {
      userId,
      type: "message",
      title: NEW_MESSAGE,
      body: {
        ar: `رسالة من ${sender.name}`,
        en: `Message from ${sender.name}`,
      },
      href: `/messages?thread=${thread.id}`,
    })
  return toMessage(saved)
}

/**
 * `GET /threads/:id/messages`: a page of the thread's messages, oldest first.
 * `before` (a message id) pages back from that message instead, for an app
 * that opens at the end of the conversation.
 */
export async function listMessages(
  user: SessionUser,
  find: {
    threadId: string
    before?: string
    page: { page: number; pageSize: number }
  }
) {
  await getMemberThread(user, find.threadId)
  const cursor = find.before
    ? await messages.getCursor(db, { id: find.before, threadId: find.threadId })
    : undefined
  const { page, pageSize } = find.page
  const { rows, total } =
    find.before && !cursor
      ? { rows: [], total: 0 }
      : await messages.listOf(db, {
          threadId: find.threadId,
          before: cursor,
          page: { offset: (page - 1) * pageSize, size: pageSize },
        })
  return { items: rows.map(toMessage), total, page, pageSize }
}

/** `POST /threads/:id/messages`: 404 for an unknown thread, 403 when the user is not in it. */
export async function sendMessage(
  user: SessionUser,
  send: { threadId: string; body: string }
) {
  return transaction(async (tx) => {
    const thread = await getMemberThread(user, send.threadId, tx)
    const participantIds = await participantIdsOf(tx, thread.id)
    return postMessage(tx, {
      thread,
      participantIds,
      sender: user,
      body: send.body,
    })
  })
}

/** `POST /threads/:id/read`: the other side's messages in the thread are read now. */
export async function markThreadRead(user: SessionUser, threadId: string) {
  await getMemberThread(user, threadId)
  await messages.updateRead(db, {
    threadId,
    userId: user.id,
    at: clock.now(),
  })
}

/** The people in a thread, in the order they joined it. */
export async function participantIdsOf(ex: Executor, threadId: string) {
  const rows = await threads.listParticipants(ex, [threadId])
  return rows.map((row) => row.userId)
}

// 404 for an unknown thread, 403 for a thread of other people (as the mock answers).
async function getMemberThread(
  user: SessionUser,
  threadId: string,
  ex: Executor = db
) {
  const thread = await threads.getThread(ex, threadId)
  if (!thread) fail.notFound()
  const members = await participantIdsOf(ex, threadId)
  if (!members.includes(user.id)) fail.forbidden()
  return thread
}
