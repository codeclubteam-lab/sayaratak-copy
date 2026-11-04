import { beforeEach, describe, expect, test } from "bun:test"
import { okSchema } from "@sayaratak/shared/schemas/api"
import {
  messageSchema,
  threadSchema,
} from "@sayaratak/shared/schemas/messaging"

import {
  call,
  DEMO_IDS,
  expectSchema,
  req,
  resetDb,
  type SignedIn,
  signIn,
} from "../../../tests/helpers"
import {
  counts,
  listing,
  readMessages,
  start,
  write,
} from "../../../tests/messaging"

beforeEach(resetDb)

describe("messages", () => {
  test("a message reaches the other person, who reads it", async () => {
    const buyer = await signIn("user")
    const dealer = await signIn("dealership")
    const thread = await expectSchema(await start(buyer, listing), threadSchema)
    const sent = await expectSchema(
      await write(dealer, thread.id, "Yes"),
      messageSchema
    )
    expect(sent).toMatchObject({
      threadId: thread.id,
      senderId: DEMO_IDS.dealership,
    })
    const before = await counts(buyer)
    expect(before.unreadMessages).toBeGreaterThan(0)
    const read = await call(buyer, `/threads/${thread.id}/read`, {
      method: "POST",
    })
    await expectSchema(read, okSchema)
    expect((await counts(buyer)).unreadMessages).toBe(before.unreadMessages - 1)
    const page = await readMessages(buyer, thread.id)
    expect(page.items.map((m) => m.body)).toEqual(["Is it free?", "Yes"])
    expect(page.items[1]?.readAt).toBeDefined()
    expect(page.items[0]?.readAt).toBeUndefined()
  })

  test("pages back from a message with `before`", async () => {
    const buyer = await signIn("user")
    const thread = await expectSchema(await start(buyer, listing), threadSchema)
    for (const text of ["two", "three", "four"])
      await write(buyer, thread.id, text)
    const all = await readMessages(buyer, thread.id)
    const newest = all.items.at(-1)
    const older = await readMessages(
      buyer,
      thread.id,
      `?before=${newest?.id}&limit=2`
    )
    expect(older.items.map((m) => m.body)).toEqual(["two", "three"])
    expect(older.total).toBe(3)
    const none = await readMessages(buyer, thread.id, "?before=msg-nope")
    expect(none.items).toEqual([])
  })

  test("are 403 for someone outside the thread and 404 for an unknown one", async () => {
    const buyer = await signIn("user")
    const outsider = await signIn("workshop")
    const thread = await expectSchema(await start(buyer, listing), threadSchema)
    const messagesOf = (as: SignedIn, id: string) =>
      req(`/threads/${id}/messages`, { headers: { cookie: as.cookie } })
    expect((await messagesOf(outsider, thread.id)).status).toBe(403)
    expect((await write(outsider, thread.id, "hi")).status).toBe(403)
    expect(
      (await call(outsider, `/threads/${thread.id}/read`, { method: "POST" }))
        .status
    ).toBe(403)
    expect((await messagesOf(buyer, "t-nope")).status).toBe(404)
    expect((await write(buyer, "t-nope", "hi")).status).toBe(404)
  })
})
