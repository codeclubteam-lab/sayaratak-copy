import { beforeEach, describe, expect, test } from "bun:test"
import { mediaSchema } from "@sayaratak/shared/schemas/listing"
import { eq } from "drizzle-orm"

import { db } from "~/shared/db/client"
import { FAKE_COLOR } from "~/shared/files/fake"

import { fileOf, postUpload } from "../../../tests/files"
import { expectSchema, resetDb, signIn } from "../../../tests/helpers"
import { uploads } from "./uploads.tables"

const MB = 1024 * 1024

beforeEach(resetDb)

async function rowOf(id: string) {
  const [row] = await db.select().from(uploads).where(eq(uploads.id, id))
  return row
}

describe("POST /uploads, video", () => {
  test("stores a video with its poster; the poster gives the color", async () => {
    const res = await postUpload(await signIn("user"), {
      file: fileOf("mp4"),
      poster: fileOf("webp", { name: "poster.webp" }),
    })
    const media = await expectSchema(res, mediaSchema)
    expect(media.type).toBe("video")
    expect(media.url).toMatch(
      /\/video\/upload\/sayaratak\/test\/videos\/f\d+\.mp4$/
    )
    expect(media.posterUrl).toContain(
      "/image/upload/c_limit,f_webp,q_auto,w_{w}/"
    )
    expect(media.placeholderColor).toBe(FAKE_COLOR)
    const row = await rowOf(media.id)
    expect(row?.posterId).not.toBeNull()
    expect((await rowOf(row?.posterId ?? ""))?.kind).toBe("image")
  })

  test("returns 422 for a poster over 1 MB and for a video poster", async () => {
    const omar = await signIn("user")
    const big = await postUpload(omar, {
      file: fileOf("mp4"),
      poster: fileOf("webp", { size: MB + 1 }),
    })
    expect(await big.json()).toMatchObject({
      fields: { file: "validation.file_size_5mb" },
    })
    const video = await postUpload(omar, {
      file: fileOf("mp4"),
      poster: fileOf("mp4"),
    })
    expect(await video.json()).toMatchObject({
      fields: { file: "validation.image_type" },
    })
  })

  test("returns 422 video_size for a video over 30 MB", async () => {
    const res = await postUpload(await signIn("user"), {
      file: fileOf("mp4", { size: 30 * MB + 1 }),
    })
    expect(await res.json()).toMatchObject({
      fields: { file: "validation.video_size" },
    })
  })

  test("refuses a body over 32 MB before reading it", async () => {
    const res = await postUpload(await signIn("user"), {
      file: fileOf("mp4", { size: 33 * MB }),
    })
    expect(res.status).toBe(422)
    expect(await res.json()).toMatchObject({
      fields: { file: "validation.video_size" },
    })
  })
})
