import { beforeEach, describe, expect, test } from "bun:test"
import { asc, eq } from "drizzle-orm"

import { user } from "~/modules/auth/auth.tables"
import { db } from "~/shared/db/client"

import { buildSeed, resetDb } from "../../../tests/helpers"
import { messages, threadParticipants, threads } from "./messaging.tables"

const seeded = buildSeed()
const first = seeded.threads[0]
if (!first) throw new Error("the mock seeds threads")

beforeEach(resetDb)

describe("messaging tables", () => {
  test("hold every mock thread and message, participants in the mock's order", async () => {
    expect(await db.$count(threads)).toBe(seeded.threads.length)
    expect(await db.$count(messages)).toBe(seeded.messages.length)
    const people = await db
      .select({ id: threadParticipants.userId })
      .from(threadParticipants)
      .where(eq(threadParticipants.threadId, first.id ?? ""))
      .orderBy(asc(threadParticipants.position))
    expect(people.map((p) => p.id)).toEqual(first.participantIds)
  })

  test("keep one thread per pair of people and subject", async () => {
    const [row] = await db
      .select()
      .from(threads)
      .where(eq(threads.id, first.id))
    if (!row) throw new Error("the thread is seeded")
    const twice = await db
      .insert(threads)
      .values({ ...row, id: "t-x" })
      .onConflictDoNothing()
      .returning()
    expect(twice).toEqual([])
  })

  test("drop a participant's messages with their account", async () => {
    const other = first.participantIds[0] ?? ""
    await db.delete(user).where(eq(user.id, other))
    expect(await db.$count(messages, eq(messages.senderId, other))).toBe(0)
  })
})
