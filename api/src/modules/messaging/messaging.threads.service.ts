import type { Thread } from "@sayaratak/shared/schemas/messaging"

import { db } from "~/shared/db/client"
import { transaction } from "~/shared/db/tx"
import { fail } from "~/shared/http/errors"
import { newId } from "~/shared/text/ids"
import { clock } from "~/shared/time/clock"
import * as auth from "~/modules/auth/auth.service"
import type { SessionUser } from "~/modules/auth/auth.types"
import * as businesses from "~/modules/businesses/businesses.subject.service"
import * as listings from "~/modules/listings/listings.subject.service"

import { toThread } from "./messaging.mapper"
import * as messages from "./messaging.messages.queries"
import { participantIdsOf, postMessage } from "./messaging.messages.service"
import * as threads from "./messaging.threads.queries"

const ID_PREFIX = "t"

type Start = {
  subjectType: Thread["subjectType"]
  subjectId: string
  body: string
}

/** `GET /threads`: the user's threads, the one with the newest message first. */
export async function listThreads(user: SessionUser) {
  const rows = await threads.listOf(db, user.id)
  return (await toThreads(user, rows)).sort((a, b) =>
    b.lastMessage.createdAt.localeCompare(a.lastMessage.createdAt)
  )
}

/**
 * `POST /threads`: writes the first message to a listing's or a business's
 * owner. Asking again about the same subject reuses the thread, also when two
 * presses arrive together (the pair key is unique). 404 for an unknown
 * subject, 422 for one's own listing or business.
 */
export async function startThread(user: SessionUser, start: Start) {
  const id = await transaction(async (tx) => {
    const subject = await getSubject(start)
    if (!subject) fail.notFound()
    if (subject.ownerUserId === user.id)
      fail.validation({ body: "validation.required" })
    const pair = {
      subjectType: subject.type,
      subjectId: start.subjectId,
      pairKey: [user.id, subject.ownerUserId].sort().join(":"),
    }
    const made = await threads.insertIfNew(tx, {
      id: newId(ID_PREFIX),
      ...pair,
      subjectTitle: subject.title,
      subjectImage: subject.image,
      createdAt: clock.now(),
    })
    if (made)
      await threads.insertParticipants(tx, made.id, [
        user.id,
        subject.ownerUserId,
      ])
    const thread = made ?? (await threads.getByPair(tx, pair))
    if (!thread) throw new Error("the thread exists after the insert")
    await postMessage(tx, {
      thread,
      participantIds: await participantIdsOf(tx, thread.id),
      sender: user,
      body: start.body,
    })
    return thread.id
  })
  const row = await threads.getThread(db, id)
  if (!row) throw new Error("the thread was just saved")
  const [thread] = await toThreads(user, [row])
  if (!thread) throw new Error("the thread was just saved")
  return thread
}

// The listing or business a thread is about, with the owner to write to.
async function getSubject(start: Start) {
  if (start.subjectType === "listing") {
    const [found] = [
      ...(await listings.listSubjects(db, [start.subjectId])).values(),
    ]
    if (!found?.ownerUserId) return undefined
    return {
      type: start.subjectType,
      ownerUserId: found.ownerUserId,
      title: { ar: found.title, en: found.title },
      image: found.imageUrl,
    }
  }
  const [found] = [
    ...(await businesses.listSubjects(db, [start.subjectId])).values(),
  ]
  if (!found) return undefined
  return {
    type: found.kind,
    ownerUserId: found.ownerUserId,
    title: found.name,
    image: undefined,
  }
}

async function toThreads(user: SessionUser, rows: threads.ThreadRow[]) {
  const ids = rows.map((row) => row.id)
  const listingIds = rows
    .filter((r) => r.subjectType === "listing")
    .map((r) => r.subjectId)
  const businessIds = rows
    .filter((r) => r.subjectType !== "listing")
    .map((r) => r.subjectId)
  const [participants, last, unread, listingSubjects, businessSubjects] =
    await Promise.all([
      threads.listParticipants(db, ids),
      messages.listLast(db, ids),
      messages.listUnreadCounts(db, { userId: user.id, threadIds: ids }),
      listings.listSubjects(db, listingIds),
      businesses.listSubjects(db, businessIds),
    ])
  const people = await auth.listPeople(db, [
    ...new Set(participants.map((p) => p.userId)),
  ])
  const lastOf = new Map(last.map((m) => [m.threadId, m]))
  const unreadOf = new Map(unread.map((u) => [u.threadId, u.count]))
  return rows.map((row) =>
    toThread({
      row,
      participantIds: participants
        .filter((p) => p.threadId === row.id)
        .map((p) => p.userId),
      people,
      last: lastOf.get(row.id),
      unreadCount: unreadOf.get(row.id) ?? 0,
      subjectSlug: (row.subjectType === "listing"
        ? listingSubjects
        : businessSubjects
      ).get(row.subjectId)?.slug,
      viewerId: user.id,
    })
  )
}
