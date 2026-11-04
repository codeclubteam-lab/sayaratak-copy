import { beforeEach, describe, expect, test } from "bun:test"
import { workshopSchema } from "@sayaratak/shared/schemas/profile"

import { db } from "~/shared/db/client"
import { plans } from "~/modules/plans/plans.tables"
import { uploads } from "~/modules/uploads/uploads.tables"

import { mineOf } from "../../../tests/business"
import {
  expectSchema,
  req,
  resetDb,
  signIn,
  type SignedIn,
} from "../../../tests/helpers"
import { send, uploadPhotos } from "../../../tests/listings"

beforeEach(resetDb)

const put = (as: SignedIn, ids: string[]) =>
  send(as, "/me/business/images", { method: "PUT", body: { ids } })
const post = (as: SignedIn, url: string) =>
  send(as, "/me/business/images", { method: "POST", body: { url } })

const idsOf = async (as: SignedIn) =>
  ((await mineOf(as)).images ?? []).map((image) => image.id)

const rowsExist = (ids: string[]) =>
  db
    .select({ id: uploads.id })
    .from(uploads)
    .then((rows) => ids.map((id) => rows.some((row) => row.id === id)))

describe("PUT /me/business/images", () => {
  test("reorders the photos and answers the workshop", async () => {
    const shop = await signIn("workshop")
    const ids = await idsOf(shop)
    expect(ids.length).toBeGreaterThan(1)
    const reversed = [...ids].reverse()
    const res = await put(shop, reversed)
    expect(res.status).toBe(200)
    const saved = await expectSchema(res, workshopSchema)
    expect(saved.images.map((image) => image.id)).toEqual(reversed)
  })

  test("adds a new upload, and deletes a photo left out with its file", async () => {
    const shop = await signIn("workshop")
    const [first, ...rest] = await idsOf(shop)
    const [photo] = await uploadPhotos(shop, 1)
    const res = await put(shop, [photo?.id ?? "", first ?? ""])
    expect(res.status).toBe(200)
    expect(await idsOf(shop)).toEqual([photo?.id ?? "", first ?? ""])
    expect(await rowsExist(rest)).toEqual(rest.map(() => false))
    expect(await rowsExist([photo?.id ?? ""])).toEqual([true])
  })

  test("removes every photo when the list is empty", async () => {
    const shop = await signIn("workshop")
    const res = await put(shop, [])
    expect(res.status).toBe(200)
    expect((await expectSchema(res, workshopSchema)).images).toEqual([])
    expect(await idsOf(shop)).toEqual([])
  })

  test("returns 422 on ids for another account's upload, a repeat of a missing id and more than 20", async () => {
    const shop = await signIn("workshop")
    const before = await idsOf(shop)
    const dealer = await signIn("dealership")
    const [theirs] = await uploadPhotos(dealer, 1)
    const foreign = await put(shop, [...before, theirs?.id ?? ""])
    expect(foreign.status).toBe(422)
    expect(await foreign.json()).toMatchObject({
      fields: { ids: "validation.required" },
    })
    const unknown = await put(shop, [...before, "up-missing"])
    expect(unknown.status).toBe(422)
    const many = await put(
      shop,
      Array.from({ length: 21 }, (_, i) => `x${i}`)
    )
    expect(await many.json()).toMatchObject({
      fields: { ids: "validation.media_max" },
    })
    expect(await idsOf(shop)).toEqual(before)
  })

  test("returns 401 signed out and 403 forbidden for a dealership", async () => {
    const out = await req("/me/business/images", {
      method: "PUT",
      headers: {
        origin: "http://localhost:3000",
        "content-type": "application/json",
      },
      body: JSON.stringify({ ids: [] }),
    })
    expect(out.status).toBe(401)
    const refused = await put(await signIn("dealership"), [])
    expect(refused.status).toBe(403)
    expect(await refused.json()).toMatchObject({ code: "forbidden" })
  })
})

describe("the plan's photo limit", () => {
  const limitTo = (photoLimit: number) => db.update(plans).set({ photoLimit })

  test("returns 403 limit_reached for one more photo than the plan allows", async () => {
    const shop = await signIn("workshop")
    const ids = await idsOf(shop)
    await limitTo(ids.length)
    const [photo] = await uploadPhotos(shop, 1)
    const res = await put(shop, [...ids, photo?.id ?? ""])
    expect(res.status).toBe(403)
    expect(await res.json()).toMatchObject({ code: "limit_reached" })
    const added = await post(shop, photo?.url ?? "")
    expect(added.status).toBe(403)
    expect(await idsOf(shop)).toEqual(ids)
  })

  test("lets a workshop over its limit reorder and remove but not add", async () => {
    const shop = await signIn("workshop")
    const [extra, more] = await uploadPhotos(shop, 2)
    await put(shop, [...(await idsOf(shop)), extra?.id ?? ""])
    const ids = await idsOf(shop)
    expect(ids).toHaveLength(3)
    await limitTo(1)
    expect((await put(shop, [...ids].reverse())).status).toBe(200)
    expect((await put(shop, ids.slice(0, 2))).status).toBe(200)
    expect(await idsOf(shop)).toHaveLength(2)
    const added = await put(shop, [...ids.slice(0, 2), more?.id ?? ""])
    expect(added.status).toBe(403)
  })

  test("two adds at once past the last free place let only one through", async () => {
    const shop = await signIn("workshop")
    const ids = await idsOf(shop)
    await limitTo(ids.length + 1)
    const photos = await uploadPhotos(shop, 2)
    const results = await Promise.all(
      photos.map((photo) => post(shop, photo.url))
    )
    expect(results.map((res) => res.status).sort()).toEqual([200, 403])
    expect(await idsOf(shop)).toHaveLength(ids.length + 1)
  })
})

describe("POST /me/business/images", () => {
  test("adds an uploaded photo at the end and ignores a repeat", async () => {
    const shop = await signIn("workshop")
    const ids = await idsOf(shop)
    const [photo] = await uploadPhotos(shop, 1)
    const res = await post(shop, photo?.url ?? "")
    expect(res.status).toBe(200)
    expect(await idsOf(shop)).toEqual([...ids, photo?.id ?? ""])
    await post(shop, photo?.url ?? "")
    expect(await idsOf(shop)).toEqual([...ids, photo?.id ?? ""])
  })

  test("returns 422 on url for an address that is not the owner's own photo", async () => {
    const shop = await signIn("workshop")
    const res = await post(shop, "https://elsewhere.example/p.jpg")
    expect(res.status).toBe(422)
    expect(await res.json()).toMatchObject({
      fields: { url: "validation.url" },
    })
  })
})
