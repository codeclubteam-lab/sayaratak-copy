import { beforeEach, describe, expect, test } from "bun:test"

import {
  bellsOf,
  broadcastRow,
  queueBroadcast,
} from "../../../tests/broadcasts"
import { resetDb } from "../../../tests/helpers"
import { failOnCall } from "../../../tests/jobs"
import * as queries from "./notifications.fanout.queries"
import { fanOut } from "./notifications.fanout.service"

// Seed: 61 individuals (2 banned, so 59 read announcements), 12 dealerships, 14 workshops, 18 mechanics.
beforeEach(resetDb)

describe("fanOut (broadcast-fanout job)", () => {
  test("rings every bell of the audience in chunks and finishes the broadcast", async () => {
    const sent = await queueBroadcast()

    expect(await fanOut(20)).toBe(59)

    const bells = await bellsOf(sent.title)
    expect(new Set(bells.map((bell) => bell.userId)).size).toBe(59)
    expect(await broadcastRow(sent.id)).toMatchObject({
      status: "sent",
      recipients: 59,
    })
    expect((await broadcastRow(sent.id))?.finishedAt).toBeInstanceOf(Date)
  })

  test("finishes on the empty chunk after a full one", async () => {
    const sent = await queueBroadcast({ roles: ["dealership"] })
    expect(await fanOut(12)).toBe(12)
    expect(await broadcastRow(sent.id)).toMatchObject({
      status: "sent",
      recipients: 12,
    })
  })

  test("an audience of nobody finishes with zero recipients", async () => {
    // Individuals have no verified badge, so "verified only" leaves them all out.
    const sent = await queueBroadcast({ roles: ["user"], verifiedOnly: true })
    expect(await fanOut()).toBe(0)
    expect(await broadcastRow(sent.id)).toMatchObject({
      status: "sent",
      recipients: 0,
    })
  })

  test("running it twice rings each bell once", async () => {
    const sent = await queueBroadcast({ roles: ["mechanic"] })
    expect(await fanOut()).toBe(18)
    expect(await fanOut()).toBe(0)
    expect(await bellsOf(sent.title)).toHaveLength(18)
  })

  test("a crash in the second chunk drops that chunk whole, and the next run finishes without telling anyone twice", async () => {
    const sent = await queueBroadcast()
    const crash = failOnCall(queries, "updateProgress", 2)

    await expect(fanOut(20)).rejects.toThrow("crashed")
    // The first chunk is committed with its cursor; the second chunk's bells rolled back with it.
    expect(await bellsOf(sent.title)).toHaveLength(20)
    expect(await broadcastRow(sent.id)).toMatchObject({
      status: "sending",
      recipients: 20,
    })

    crash.mockRestore()
    expect(await fanOut(20)).toBe(39)
    const bells = await bellsOf(sent.title)
    expect(bells).toHaveLength(59)
    expect(new Set(bells.map((bell) => bell.userId)).size).toBe(59)
    expect(await broadcastRow(sent.id)).toMatchObject({
      status: "sent",
      recipients: 59,
    })
  })

  test("takes the oldest broadcast first and finishes every one in a run", async () => {
    const later = await queueBroadcast({
      roles: ["mechanic"],
      createdAt: new Date(),
    })
    const earlier = await queueBroadcast({
      roles: ["workshop"],
      createdAt: new Date(Date.now() - 60_000),
    })
    expect(await fanOut(5)).toBe(32)
    expect(
      (await broadcastRow(earlier.id))?.finishedAt?.getTime()
    ).toBeLessThan((await broadcastRow(later.id))?.finishedAt?.getTime() ?? 0)
  })

  test("does nothing when no broadcast is waiting", async () => {
    expect(await fanOut()).toBe(0)
  })
})
