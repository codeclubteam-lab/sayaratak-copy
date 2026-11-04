import { okSchema } from "@sayaratak/shared/schemas/api"
import {
  messageInputSchema,
  threadInputSchema,
} from "@sayaratak/shared/schemas/inputs"
import {
  messageSchema,
  threadSchema,
  type Thread,
} from "@sayaratak/shared/schemas/messaging"
import { pageOf } from "@sayaratak/shared/schemas/fields"
import { both } from "@/mocks/seed/util"

import { db, find, insert, newId, paginate } from "../db"
import { fail, needUser, pageParams, readCookie, route } from "../http"
import { findBusiness, nowIso, notify } from "../lib"
import type { ThreadRow, UserRow } from "../types"

const messagesOf = (id: string) =>
  db.messages
    .filter((m) => m.threadId === id)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))

export function toThread(row: ThreadRow, me: string): Thread {
  const all = messagesOf(row.id)
  const last = all.at(-1)
  const subject =
    row.subjectType === "listing"
      ? find(db.listings, row.subjectId)
      : findBusiness(row.subjectId)
  return threadSchema.parse({
    ...row,
    subjectSlug: subject?.slug,
    participants: row.participantIds.map((id) => {
      const u = find(db.users, id)
      return { id, name: u?.fullName ?? "", avatarUrl: u?.avatarUrl ?? null }
    }),
    lastMessage: {
      body: last?.body ?? "",
      createdAt: last?.createdAt ?? nowIso(),
      senderId: last?.senderId ?? me,
    },
    unreadCount: all.filter((m) => m.senderId !== me && !m.readAt).length,
  })
}
const threadFor = (user: UserRow, id: string) => {
  const row = find(db.threads, id)
  if (!row) throw fail(404, "not_found")
  if (!row.participantIds.includes(user.id)) throw fail(403, "forbidden")
  return row
}
function post(row: ThreadRow, sender: UserRow, body: string) {
  const message = insert(db.messages, {
    id: newId("msg"),
    threadId: row.id,
    senderId: sender.id,
    body,
    createdAt: nowIso(),
  })
  for (const id of row.participantIds.filter((p) => p !== sender.id)) {
    notify(
      id,
      "message",
      { ar: "رسالة جديدة", en: "New message" },
      {
        ar: `رسالة من ${sender.fullName}`,
        en: `Message from ${sender.fullName}`,
      },
      `/messages?thread=${row.id}`
    )
  }
  return messageSchema.parse(message)
}

// Demo only: when nobody but the sender has written in a thread, the other person answers once, 8 seconds later, so the flow can be seen without a second browser.
const replies = {
  ar: ["وعليكم السلام، نعم متاحة. متى يناسبك الحضور؟", "تفضل في أي وقت."],
  en: ["Hello, yes it is available. When can you come by?", "Come any time."],
}
function autoReply(row: ThreadRow, sender: UserRow, locale: "ar" | "en") {
  // Tests opt in with MOCK_REPLY_MS, so a stray timer never touches another test's database.
  const delay = Number(
    process.env.MOCK_REPLY_MS ?? (process.env.VITEST ? Number.NaN : 8000)
  )
  if (import.meta.env.VITE_DEMO !== "true" || !Number.isFinite(delay)) return
  const answered = () =>
    db.messages.some((m) => m.threadId === row.id && m.senderId !== sender.id)
  if (answered()) return
  const other = row.participantIds.find((p) => p !== sender.id)
  const replier = other ? find(db.users, other) : undefined
  if (!replier) return
  setTimeout(() => {
    // The thread may be gone (a reset) or already answered by a test or a second tab.
    if (!db.threads.includes(row) || answered()) return
    post(
      row,
      replier,
      replies[locale][row.subjectType === "listing" ? 0 : 1] ?? ""
    )
  }, delay)
}
const localeOf = (req: Request) =>
  readCookie(req, "locale") === "en" ? "en" : "ar"

route("GET", "/threads", (c) => {
  const user = needUser(c)
  const rows = db.threads
    .filter((t) => t.participantIds.includes(user.id))
    .map((t) => toThread(t, user.id))
  return rows.sort((a, b) =>
    b.lastMessage.createdAt.localeCompare(a.lastMessage.createdAt)
  )
})

// One thread per pair of people and subject: asking again reuses it.
route("POST", "/threads", async (c) => {
  const user = needUser(c)
  const input = await c.body(threadInputSchema)
  const listing =
    input.subjectType === "listing"
      ? find(db.listings, input.subjectId)
      : undefined
  const business =
    input.subjectType === "listing" ? undefined : findBusiness(input.subjectId)
  const ownerId = listing?.ownerUserId ?? business?.ownerId
  if (!ownerId) throw fail(404, "not_found")
  if (ownerId === user.id)
    throw fail(422, "validation", { body: "validation.required" })
  let row = db.threads.find(
    (t) =>
      t.subjectType === input.subjectType &&
      t.subjectId === input.subjectId &&
      t.participantIds.includes(user.id) &&
      t.participantIds.includes(ownerId)
  )
  if (!row) {
    row = insert(db.threads, {
      id: newId("t"),
      subjectType: input.subjectType,
      subjectId: input.subjectId,
      subjectTitle: listing
        ? both(listing.title)
        : (business?.name ?? both("")),
      subjectImage: listing?.media[0]?.url,
      participantIds: [user.id, ownerId],
    })
  }
  post(row, user, input.body)
  autoReply(row, user, localeOf(c.req))
  return toThread(row, user.id)
})

route("GET", "/threads/:id/messages", (c) => {
  const row = threadFor(needUser(c), c.params.id ?? "")
  const { page, pageSize } = pageParams(c.query, 50)
  return pageOf(messageSchema).parse(
    paginate(messagesOf(row.id), page, pageSize)
  )
})
route("POST", "/threads/:id/messages", async (c) => {
  const user = needUser(c)
  const row = threadFor(user, c.params.id ?? "")
  const message = post(row, user, (await c.body(messageInputSchema)).body)
  autoReply(row, user, localeOf(c.req))
  return message
})
route("POST", "/threads/:id/read", (c) => {
  const user = needUser(c)
  const row = threadFor(user, c.params.id ?? "")
  const now = nowIso()
  for (const m of messagesOf(row.id))
    if (m.senderId !== user.id && !m.readAt) m.readAt = now
  return okSchema.parse({ ok: true })
})
