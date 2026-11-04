import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test"
import { eq } from "drizzle-orm"

import { db } from "~/shared/db/client"
import { files } from "~/shared/files/store"
import { clock } from "~/shared/time/clock"

import { resetDb } from "../../../tests/helpers"
import { failOnCall } from "../../../tests/jobs"
import { cleanUp } from "./uploads.cleanup.service"
import * as queries from "./uploads.queries"
import { fileDeletions, uploads } from "./uploads.tables"

const NOW = new Date("2026-11-03T10:00:00Z")
const HOUR_MS = 3_600_000
let counter = 0

beforeEach(async () => {
  await resetDb()
  spyOn(clock, "now").mockReturnValue(NOW)
})
afterEach(() => {
  spyOn(clock, "now").mockRestore()
})

/** An upload with a real (fake-store) file; `hoursOld` and `attached` set the case. */
async function upload(options: {
  hoursOld: number
  attached?: boolean
  sharing?: string
}) {
  counter += 1
  const stored = options.sharing
    ? { publicId: options.sharing }
    : await files.put({
        bytes: new Uint8Array([0xff, 0xd8, 0xff, 0xe0]),
        mime: "image/jpeg",
        delivery: "public",
        folder: "images",
      })
  const createdAt = new Date(NOW.getTime() - options.hoursOld * HOUR_MS)
  const id = `up-t${counter}`
  await db.insert(uploads).values({
    id,
    kind: "image",
    cloudinaryId: stored.publicId,
    delivery: "public",
    mime: "image/jpeg",
    attachedAt: options.attached ? createdAt : null,
    createdAt,
  })
  return { id, publicId: stored.publicId }
}
const rowExists = async (id: string) =>
  (await db.select().from(uploads).where(eq(uploads.id, id))).length === 1
const onHost = (publicId: string) =>
  files
    .read({ publicId, mime: "image/jpeg" })
    .then(() => true)
    .catch(() => false)

describe("cleanUp (orphan-uploads job)", () => {
  test("deletes uploads nobody attached within a day, from the table and the host", async () => {
    const stale = await upload({ hoursOld: 25 })
    const fresh = await upload({ hoursOld: 23 })
    const kept = await upload({ hoursOld: 48, attached: true })

    expect(await cleanUp()).toBe(1)

    expect(await rowExists(stale.id)).toBe(false)
    expect(await onHost(stale.publicId)).toBe(false)
    expect(await rowExists(fresh.id)).toBe(true)
    expect(await rowExists(kept.id)).toBe(true)
    expect(await onHost(kept.publicId)).toBe(true)
    expect(await db.select().from(fileDeletions)).toEqual([])
  })

  test("leaves a host file that another upload still uses", async () => {
    const original = await upload({ hoursOld: 48, attached: true })
    const copy = await upload({ hoursOld: 30, sharing: original.publicId })

    await cleanUp()

    expect(await rowExists(copy.id)).toBe(false)
    expect(await onHost(original.publicId)).toBe(true)
    expect(await db.select().from(fileDeletions)).toEqual([])
  })

  test("a host delete that fails is kept and tried again by the next pass", async () => {
    const stale = await upload({ hoursOld: 30 })
    const remove = spyOn(files, "remove").mockRejectedValueOnce(
      new Error("host down")
    )
    try {
      await cleanUp()
    } finally {
      remove.mockRestore()
    }
    // The row is gone; the note of the file that is still on the host stays.
    expect(await rowExists(stale.id)).toBe(false)
    expect(await onHost(stale.publicId)).toBe(true)
    const [note] = await db.select().from(fileDeletions)
    expect(note).toMatchObject({ publicId: stale.publicId, attempts: 1 })

    expect(await cleanUp()).toBe(1)
    expect(await onHost(stale.publicId)).toBe(false)
    expect(await db.select().from(fileDeletions)).toEqual([])
  })

  test("stops trying a file after twenty failures and leaves its note", async () => {
    await db.insert(fileDeletions).values({
      id: "fd-t1",
      publicId: "sayaratak/test/images/stuck",
      mime: "image/jpeg",
      delivery: "public",
      attempts: 20,
      createdAt: NOW,
    })
    expect(await cleanUp()).toBe(0)
    expect(await db.select().from(fileDeletions)).toHaveLength(1)
  })

  test("running it twice gives the same result", async () => {
    await upload({ hoursOld: 30 })
    await upload({ hoursOld: 40 })
    expect(await cleanUp()).toBe(2)
    expect(await cleanUp()).toBe(0)
  })

  test("a crash after the first batch is finished by the next run", async () => {
    const all = [
      await upload({ hoursOld: 30 }),
      await upload({ hoursOld: 31 }),
      await upload({ hoursOld: 32 }),
    ]
    const crash = failOnCall(queries, "lockOrphans", 2)

    await expect(cleanUp(2)).rejects.toThrow("crashed")
    const left = (
      await Promise.all(all.map((one) => rowExists(one.id)))
    ).filter(Boolean)
    expect(left).toHaveLength(1)

    crash.mockRestore()
    expect(await cleanUp(2)).toBe(1)
    expect(await Promise.all(all.map((one) => onHost(one.publicId)))).toEqual([
      false,
      false,
      false,
    ])
  })
})
