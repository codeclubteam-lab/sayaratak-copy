import { threadSchema } from "@sayaratak/shared/schemas/messaging"
import {
  check,
  index,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
} from "drizzle-orm/pg-core"

import { user } from "~/modules/auth/auth.tables"
import { bilingual, bilingualText, createdAt } from "~/shared/db/columns"

export const threadSubject = pgEnum(
  "thread_subject",
  threadSchema.shape.subjectType.enum
)

// One thread per pair of people and subject. `pairKey` is the two user ids sorted and joined
// with ":", so two parallel "Message seller" presses insert one row (on conflict do nothing).
// `subjectId` names a listing or a business by `subjectType`: no foreign key (A5).
export const threads = pgTable(
  "threads",
  {
    id: text().primaryKey(),
    subjectType: threadSubject().notNull(),
    subjectId: text().notNull(),
    subjectTitle: bilingualText(),
    subjectImage: text(),
    pairKey: text().notNull(),
    createdAt: createdAt(),
  },
  (table) => [
    unique().on(table.subjectType, table.subjectId, table.pairKey),
    check("threads_subject_title", bilingual(table.subjectTitle)),
  ]
)

// `position` keeps the participants in the mock's order (the one who wrote first is not always first).
export const threadParticipants = pgTable(
  "thread_participants",
  {
    threadId: text()
      .notNull()
      .references(() => threads.id, { onDelete: "cascade" }),
    userId: text()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    position: integer().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.threadId, table.userId] }),
    index().on(table.userId),
  ]
)

// `readAt` is per message, as in the mock: opening a thread marks the other side's unread messages.
export const messages = pgTable(
  "messages",
  {
    id: text().primaryKey(),
    threadId: text()
      .notNull()
      .references(() => threads.id, { onDelete: "cascade" }),
    senderId: text()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    body: text().notNull(),
    createdAt: createdAt(),
    readAt: timestamp({ withTimezone: true }),
  },
  (table) => [index().on(table.threadId, table.createdAt)]
)
