import { beforeEach, describe, expect, test } from "bun:test"
import { and, eq } from "drizzle-orm"
import { threadSchema } from "@sayaratak/shared/schemas/messaging"

import { user } from "~/modules/auth/auth.tables"
import { notifications } from "~/modules/notifications/notifications.tables"
import { db } from "~/shared/db/client"

import {
  DEMO_IDS,
  expectSchema,
  req,
  resetDb,
  signIn,
} from "../../../tests/helpers"
import {
  counts,
  listing,
  listSchema,
  readMessages,
  start,
} from "../../../tests/messaging"
import { messages, threads } from "./messaging.tables"

beforeEach(resetDb)

describe("POST /threads", () => {
  test("opens a conversation about a listing and tells its owner", async () => {
    const buyer = await signIn("user")
    const thread = await expectSchema(await start(buyer, listing), threadSchema)
    expect(thread).toMatchObject({
      subjectType: "listing",
      subjectId: "l0007b",
      unreadCount: 0,
      lastMessage: { body: "Is it free?", senderId: DEMO_IDS.user },
    })
    expect(thread.participants.map((p) => p.id)).toEqual([
      DEMO_IDS.user,
      DEMO_IDS.dealership,
    ])
    expect(thread.subjectSlug).toContain("l0007b")
    expect(thread.subjectImage).toContain("/mock/")
    const dealer = await signIn("dealership")
    const [note] = await db
      .select()
      .from(notifications)
      .where(eq(notifications.userId, DEMO_IDS.dealership))
      .orderBy(notifications.createdAt)
      .then((rows) => rows.slice(-1))
    expect(note).toMatchObject({
      type: "message",
      href: `/dealer/messages?thread=${thread.id}`,
    })
    expect((await counts(dealer)).unreadMessages).toBeGreaterThan(0)
  })

  test("reuses the thread when the same person asks again", async () => {
    const buyer = await signIn("user")
    const first = await expectSchema(await start(buyer, listing), threadSchema)
    const second = await expectSchema(
      await start(buyer, { ...listing, body: "Hello?" }),
      threadSchema
    )
    expect(second.id).toBe(first.id)
    expect((await readMessages(buyer, first.id)).total).toBe(2)
  })

  test("makes one thread when two presses arrive together", async () => {
    const buyer = await signIn("user")
    const answers = await Promise.all([
      start(buyer, listing),
      start(buyer, listing),
    ])
    const ids = await Promise.all(
      answers.map(async (res) => (await expectSchema(res, threadSchema)).id)
    )
    expect(ids[0]).toBe(ids[1])
    const pair = [DEMO_IDS.user, DEMO_IDS.dealership].sort().join(":")
    expect(
      await db.$count(
        threads,
        and(eq(threads.subjectId, "l0007b"), eq(threads.pairKey, pair))
      )
    ).toBe(1)
    expect(await db.$count(messages, eq(messages.threadId, ids[0] ?? ""))).toBe(
      2
    )
  })

  test("opens a conversation with a business and writes to its owner's inbox", async () => {
    const buyer = await signIn("user")
    const thread = await expectSchema(
      await start(buyer, {
        subjectType: "workshop",
        subjectId: "w-1",
        body: "Brakes?",
      }),
      threadSchema
    )
    expect(thread.participants.map((p) => p.id)).toEqual([
      DEMO_IDS.user,
      DEMO_IDS.workshop,
    ])
    expect(thread.subjectTitle.en).toBe("Al Amal Auto Care")
    const [note] = await db
      .select({ href: notifications.href })
      .from(notifications)
      .where(eq(notifications.userId, DEMO_IDS.workshop))
      .orderBy(notifications.createdAt)
      .then((rows) => rows.slice(-1))
    expect(note?.href).toBe(`/workshop/inquiries?thread=${thread.id}`)
  })

  test("is 401 signed out, 404 for an unknown subject and 422 for your own", async () => {
    expect((await req("/threads", { method: "POST" })).status).toBe(401)
    const buyer = await signIn("user")
    const missing = await start(buyer, { ...listing, subjectId: "l-nope" })
    expect(missing.status).toBe(404)
    const own = await start(await signIn("dealership"), listing)
    expect(own.status).toBe(422)
    expect(await own.json()).toMatchObject({
      code: "validation",
      fields: { body: "validation.required" },
    })
    const empty = await start(buyer, { ...listing, body: " " })
    expect(empty.status).toBe(422)
  })

  test("writes no notification when the owner turned messages off", async () => {
    await db
      .update(user)
      .set({ prefs: { messages: false } as never })
      .where(eq(user.id, DEMO_IDS.dealership))
    const before = await db.$count(notifications)
    await start(await signIn("user"), listing)
    expect(await db.$count(notifications)).toBe(before)
  })
})

describe("GET /threads", () => {
  test("lists the account's own conversations, the newest message first", async () => {
    const buyer = await signIn("user")
    const rows = await expectSchema(
      await req("/threads", { headers: { cookie: buyer.cookie } }),
      listSchema
    )
    expect(rows.length).toBeGreaterThan(0)
    expect(
      rows.every((t) => t.participants.some((p) => p.id === DEMO_IDS.user))
    ).toBe(true)
    const times = rows.map((t) => t.lastMessage.createdAt)
    expect(times).toEqual([...times].sort().reverse())
    expect((await req("/threads")).status).toBe(401)
  })
})
