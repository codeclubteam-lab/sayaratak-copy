import { beforeEach, describe, expect, test } from "bun:test"
import { mechanicSchema } from "@sayaratak/shared/schemas/profile"
import { eq } from "drizzle-orm"

import { db } from "~/shared/db/client"
import { user } from "~/modules/auth/auth.tables"
import { uploads } from "~/modules/uploads/uploads.tables"

import { read } from "../../../tests/business"
import { fileOf, postUpload } from "../../../tests/files"
import { expectSchema, req, resetDb, signIn } from "../../../tests/helpers"
import { uploadPhotos } from "../../../tests/listings"
import {
  add,
  itemSchema,
  limitTo,
  list,
  patch,
  remove,
} from "../../../tests/portfolio"

beforeEach(resetDb)

describe("GET /me/portfolio", () => {
  test("answers the mechanic's pictures in the shared schema, as its profile shows them", async () => {
    const person = await signIn("mechanic")
    const rows = await list(person)
    expect(rows.length).toBeGreaterThan(0)
    const profile = await expectSchema(
      await read(person, "/me/business"),
      mechanicSchema
    )
    expect(rows).toEqual(profile.portfolio)
  })

  test("returns 401 signed out, 403 for a workshop, 403 banned and 404 without a mechanic profile", async () => {
    expect((await req("/me/portfolio")).status).toBe(401)
    const refused = await read(await signIn("workshop"), "/me/portfolio")
    expect(refused.status).toBe(403)
    expect(await refused.json()).toMatchObject({ code: "forbidden" })
    const person = await signIn("mechanic")
    await db.update(user).set({ banned: true }).where(eq(user.id, "u-mechanic"))
    expect(await (await read(person, "/me/portfolio")).json()).toMatchObject({
      code: "banned",
    })
    const visitor = await signIn("new")
    await db.update(user).set({ role: "mechanic" }).where(eq(user.id, "u-new"))
    expect((await read(visitor, "/me/portfolio")).status).toBe(404)
  })
})

describe("POST /me/portfolio", () => {
  test("adds an uploaded picture with its caption at the end and attaches the file", async () => {
    const person = await signIn("mechanic")
    const before = await list(person)
    const [photo] = await uploadPhotos(person, 1)
    const res = await add(person, {
      imageId: photo?.id,
      caption: "  Engine rebuild  ",
    })
    expect(res.status).toBe(200)
    const saved = await expectSchema(res, itemSchema)
    expect(saved).toMatchObject({ caption: "Engine rebuild", url: photo?.url })
    expect((await list(person)).map((row) => row.id)).toEqual([
      ...before.map((row) => row.id),
      saved.id,
    ])
    const [row] = await db
      .select()
      .from(uploads)
      .where(eq(uploads.id, photo?.id ?? ""))
    expect(row?.attachedAt).not.toBeNull()
  })

  test("returns 422 on imageId for another account's photo, a used photo, a video and an unknown id", async () => {
    const person = await signIn("mechanic")
    await limitTo(100)
    const before = await list(person)
    const [theirs] = await uploadPhotos(await signIn("workshop"), 1)
    const [mine] = await uploadPhotos(person, 1)
    const video = await postUpload(person, { file: fileOf("mp4") })
    const videoId = ((await video.json()) as { id: string }).id
    expect(
      (await add(person, { imageId: mine?.id, caption: "First" })).status
    ).toBe(200)
    for (const imageId of [theirs?.id, mine?.id, videoId, "up-missing"]) {
      const res = await add(person, { imageId, caption: "Again" })
      expect(res.status).toBe(422)
      expect(await res.json()).toMatchObject({
        fields: { imageId: "validation.required" },
      })
    }
    expect(await list(person)).toHaveLength(before.length + 1)
  })

  test("returns 422 with field keys for a missing or too long caption", async () => {
    const person = await signIn("mechanic")
    const [photo] = await uploadPhotos(person, 1)
    const empty = await add(person, { imageId: photo?.id, caption: " " })
    expect(await empty.json()).toMatchObject({
      code: "validation",
      fields: { caption: "validation.required" },
    })
    const long = await add(person, {
      imageId: photo?.id,
      caption: "x".repeat(121),
    })
    expect(await long.json()).toMatchObject({
      fields: { caption: "validation.too_long" },
    })
    const [row] = await db
      .select()
      .from(uploads)
      .where(eq(uploads.id, photo?.id ?? ""))
    expect(row?.attachedAt).toBeNull()
  })

  test("returns 403 limit_reached at the plan's limit and lets a change through", async () => {
    const person = await signIn("mechanic")
    const rows = await list(person)
    await limitTo(rows.length)
    const [photo] = await uploadPhotos(person, 1)
    const full = await add(person, { imageId: photo?.id, caption: "One more" })
    expect(full.status).toBe(403)
    expect(await full.json()).toMatchObject({ code: "limit_reached" })
    expect(
      (await patch(person, rows[0]?.id ?? "", { caption: "Renamed" })).status
    ).toBe(200)
    expect((await remove(person, rows[0]?.id ?? "")).status).toBe(200)
    expect(
      (await add(person, { imageId: photo?.id, caption: "Fits now" })).status
    ).toBe(200)
  })

  test("two adds at once past the last free place let only one through", async () => {
    const person = await signIn("mechanic")
    const rows = await list(person)
    await limitTo(rows.length + 1)
    const photos = await uploadPhotos(person, 2)
    const results = await Promise.all(
      photos.map((photo) =>
        add(person, { imageId: photo.id, caption: "Racing" })
      )
    )
    expect(results.map((res) => res.status).sort()).toEqual([200, 403])
    expect(await list(person)).toHaveLength(rows.length + 1)
  })
})
