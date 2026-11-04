import type { PgTable } from "drizzle-orm/pg-core"

import { favorites } from "~/modules/favorites/favorites.tables"
import * as messaging from "~/modules/messaging/messaging.tables"
import { notifications } from "~/modules/notifications/notifications.tables"
import { reports } from "~/modules/reports/reports.tables"
import { reviews } from "~/modules/reviews/reviews.tables"
import { savedSearches } from "~/modules/saved-searches/saved-searches.tables"
import { uploads } from "~/modules/uploads/uploads.tables"
import * as verification from "~/modules/verification/verification.tables"
import type { Executor } from "~/shared/db/tx"
import { demoUrl } from "~/shared/files/demo"

import type { buildSeed } from "../../web/src/mocks/seed"

type Seed = ReturnType<typeof buildSeed>

const date = (iso: string | undefined) => (iso ? new Date(iso) : null)

/** Reviews, favorites, saved searches, threads and messages, notifications, reports and verification requests. */
export async function seedSocial(ex: Executor, data: Seed) {
  // Typed by the table, so a row with a wrong column fails typecheck.
  const insert = async <T extends PgTable>(
    table: T,
    rows: T["$inferInsert"][]
  ) => {
    if (rows.length) await ex.insert(table).values(rows).onConflictDoNothing()
  }
  await insert(reviews, data.reviews.map(reviewRow))
  await insert(
    favorites,
    data.favorites.map((f) => ({ ...f, createdAt: new Date(f.createdAt) }))
  )
  await insert(
    savedSearches,
    data.savedSearches.map((s) => ({ ...s, createdAt: new Date(s.createdAt) }))
  )
  await seedThreads(ex, data)
  await insert(
    notifications,
    data.notifications.map((n) => ({
      ...n,
      createdAt: new Date(n.createdAt),
      readAt: date(n.readAt),
    }))
  )
  await insert(
    reports,
    data.reports.map((r) => ({ ...r, createdAt: new Date(r.createdAt) }))
  )
  await seedVerifications(ex, data)
}

function reviewRow(r: Seed["reviews"][number]) {
  return {
    ...r,
    replyBody: r.reply?.body,
    replyAt: date(r.reply?.createdAt),
    createdAt: new Date(r.createdAt),
  }
}

// A thread starts with its first message.
async function seedThreads(ex: Executor, data: Seed) {
  if (!data.threads.length) return
  const first = new Map<string, string>()
  for (const m of data.messages)
    if ((first.get(m.threadId) ?? m.createdAt) >= m.createdAt)
      first.set(m.threadId, m.createdAt)
  await ex
    .insert(messaging.threads)
    .values(
      data.threads.map(({ participantIds, ...t }) => ({
        ...t,
        pairKey: participantIds.toSorted().join(":"),
        createdAt: new Date(first.get(t.id) ?? 0),
      }))
    )
    .onConflictDoNothing()
  await ex
    .insert(messaging.threadParticipants)
    .values(
      data.threads.flatMap((t) =>
        t.participantIds.map((userId, position) => ({
          threadId: t.id,
          userId,
          position,
        }))
      )
    )
    .onConflictDoNothing()
  await ex
    .insert(messaging.messages)
    .values(
      data.messages.map((m) => ({
        ...m,
        createdAt: new Date(m.createdAt),
        readAt: date(m.readAt),
      }))
    )
    .onConflictDoNothing()
}

// Seeded documents are web's `public/mock` SVGs, copied into the demo folder by `writeDemoFiles`
// and kept as private `url` uploads there.
async function seedVerifications(ex: Executor, data: Seed) {
  if (!data.verifications.length) return
  const docs = data.verifications.flatMap((v) =>
    v.documents.map((doc, position) => ({ v, doc, position }))
  )
  await ex
    .insert(uploads)
    .values(
      docs.map(({ v, doc }) => ({
        id: `up-${doc.id}`,
        ownerUserId: v.ownerId,
        kind: "document" as const,
        delivery: "private" as const,
        url: demoUrl(doc.url),
        attachedAt: new Date(v.createdAt),
        createdAt: new Date(v.createdAt),
      }))
    )
    .onConflictDoNothing()
  await ex
    .insert(verification.verificationRequests)
    .values(
      data.verifications.map(({ documents: _, ...v }) => ({
        ...v,
        createdAt: new Date(v.createdAt),
      }))
    )
    .onConflictDoNothing()
  await ex
    .insert(verification.verificationDocuments)
    .values(
      docs.map(({ v, doc, position }) => ({
        id: doc.id,
        requestId: v.id,
        label: doc.label,
        uploadId: `up-${doc.id}`,
        position,
      }))
    )
    .onConflictDoNothing()
}
