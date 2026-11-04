import { beforeEach, describe, expect, test } from "bun:test"
import { mediaSchema } from "@sayaratak/shared/schemas/listing"
import { and, eq, isNotNull } from "drizzle-orm"

import { db } from "~/shared/db/client"
import { FAKE_COLOR, FAKE_SIZE } from "~/shared/files/fake"
import { user } from "~/modules/auth/auth.tables"

import { fileOf, postUpload, textFile } from "../../../tests/files"
import {
  DEMO_IDS,
  expectSchema,
  req,
  resetDb,
  signIn,
} from "../../../tests/helpers"
import { uploads } from "./uploads.tables"

const MB = 1024 * 1024

beforeEach(resetDb)

// Seeded demo files have a `url`; only files this test stored have a Cloudinary id.
function storedBy(ownerUserId: string) {
  return db.$count(
    uploads,
    and(eq(uploads.ownerUserId, ownerUserId), isNotNull(uploads.cloudinaryId))
  )
}

async function rowOf(id: string) {
  const [row] = await db.select().from(uploads).where(eq(uploads.id, id))
  return row
}

describe("POST /uploads", () => {
  test("returns 401 unauthenticated when signed out (owner, 2026-11-01)", async () => {
    const form = new FormData()
    form.set("file", fileOf("jpeg"))
    const res = await req("/uploads", {
      method: "POST",
      headers: { origin: "http://localhost:3000" },
      body: form,
    })
    expect(res.status).toBe(401)
    expect(await res.json()).toMatchObject({ code: "unauthenticated" })
  })

  test("returns 403 banned for a banned account", async () => {
    const omar = await signIn("user")
    await db
      .update(user)
      .set({ banned: true })
      .where(eq(user.id, DEMO_IDS.user))
    const res = await postUpload(omar, { file: fileOf("jpeg") })
    expect(res.status).toBe(403)
    expect(await res.json()).toMatchObject({ code: "banned" })
  })

  test("stores a photo with the size and color of the stored file, not the client's", async () => {
    const res = await postUpload(await signIn("user"), {
      file: fileOf("jpeg"),
      width: "9",
      height: "9",
      placeholderColor: "#000000",
    })
    expect(res.status).toBe(201)
    const media = await expectSchema(res, mediaSchema)
    expect(media).toMatchObject({
      type: "image",
      ...FAKE_SIZE,
      placeholderColor: FAKE_COLOR,
      posterUrl: null,
    })
    expect(media.url).toMatch(
      /^https:\/\/res\.cloudinary\.com\/fake-cloud\/image\/upload\/c_limit,f_webp,q_auto,w_\{w\}\/sayaratak\/test\/images\/f\d+$/
    )
    expect(await rowOf(media.id)).toMatchObject({
      ownerUserId: DEMO_IDS.user,
      kind: "image",
      delivery: "public",
      mime: "image/jpeg",
      bytes: 64,
      attachedAt: null,
    })
  })

  test("reads the type from the bytes: a PNG sent as a GIF is stored as PNG", async () => {
    const res = await postUpload(await signIn("user"), {
      file: fileOf("png", { declared: "image/gif" }),
    })
    const media = await expectSchema(res, mediaSchema)
    expect((await rowOf(media.id))?.mime).toBe("image/png")
  })

  test("returns 422 image_type for an SVG or a text file sent as JPEG", async () => {
    const omar = await signIn("user")
    for (const file of [
      textFile("<svg xmlns='http://www.w3.org/2000/svg'/>", "image/svg+xml"),
      textFile("not a photo", "image/jpeg"),
    ]) {
      const res = await postUpload(omar, { file })
      expect(res.status).toBe(422)
      expect(await res.json()).toMatchObject({
        fields: { file: "validation.image_type" },
      })
    }
    expect(await storedBy(DEMO_IDS.user)).toBe(0)
  })

  test("returns 422 validation.required without a file", async () => {
    const res = await postUpload(await signIn("user"), { width: "1" })
    expect(await res.json()).toMatchObject({
      code: "validation",
      fields: { file: "validation.required" },
    })
  })

  test("returns 422 file_size_5mb for a photo over 5 MB", async () => {
    const res = await postUpload(await signIn("user"), {
      file: fileOf("webp", { size: 5 * MB + 1 }),
    })
    expect(await res.json()).toMatchObject({
      fields: { file: "validation.file_size_5mb" },
    })
  })

  test("a retry with the same Idempotency-Key answers the first upload again", async () => {
    const omar = await signIn("user")
    const file = fileOf("jpeg")
    const key = { "idempotency-key": "photo-1" }
    const first = await expectSchema(
      await postUpload(omar, { file }, key),
      mediaSchema
    )
    const again = await expectSchema(
      await postUpload(omar, { file }, key),
      mediaSchema
    )
    expect(again.id).toBe(first.id)
    expect(await storedBy(DEMO_IDS.user)).toBe(1)
  })

  test("an uploaded photo can become the account's avatar", async () => {
    const omar = await signIn("user")
    const media = await expectSchema(
      await postUpload(omar, { file: fileOf("jpeg") }),
      mediaSchema
    )
    const res = await req("/me", {
      method: "PATCH",
      headers: {
        cookie: omar.cookie,
        origin: omar.origin,
        "content-type": "application/json",
      },
      body: JSON.stringify({ avatarUrl: media.url }),
    })
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ avatarUrl: media.url })
  })
})
