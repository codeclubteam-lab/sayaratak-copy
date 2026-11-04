import type { Message, Thread } from "@sayaratak/shared/schemas/messaging"

import type { messages, threads } from "./messaging.tables"

type MessageRow = typeof messages.$inferSelect
type ThreadRow = typeof threads.$inferSelect

type Person = { id: string; name: string; avatarUrl: string | null }

export function toMessage(row: MessageRow): Message {
  return {
    id: row.id,
    threadId: row.threadId,
    senderId: row.senderId,
    body: row.body,
    createdAt: row.createdAt.toISOString(),
    readAt: row.readAt?.toISOString(),
  }
}

/**
 * A thread as the user sees it. A person who is gone shows with no name, and
 * a thread with no message yet previews as the thread itself.
 */
export function toThread(parts: {
  row: ThreadRow
  participantIds: string[]
  people: Map<string, Person>
  last: MessageRow | undefined
  unreadCount: number
  subjectSlug: string | undefined
  viewerId: string
}): Thread {
  const { row, last } = parts
  return {
    id: row.id,
    subjectType: row.subjectType,
    subjectId: row.subjectId,
    subjectTitle: row.subjectTitle,
    subjectImage: row.subjectImage ?? undefined,
    subjectSlug: parts.subjectSlug,
    participants: parts.participantIds.map(
      (id) => parts.people.get(id) ?? { id, name: "", avatarUrl: null }
    ),
    lastMessage: {
      body: last?.body ?? "",
      createdAt: (last?.createdAt ?? row.createdAt).toISOString(),
      senderId: last?.senderId ?? parts.viewerId,
    },
    unreadCount: parts.unreadCount,
  }
}
