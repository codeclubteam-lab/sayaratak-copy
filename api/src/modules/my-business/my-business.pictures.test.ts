import { beforeEach, describe, expect, test } from "bun:test"
import { eq } from "drizzle-orm"

import { db } from "~/shared/db/client"
import { dealerships, mechanics } from "~/modules/businesses/businesses.tables"
import { uploads } from "~/modules/uploads/uploads.tables"

import { mineOf, patchBusiness } from "../../../tests/business"
import { resetDb, signIn } from "../../../tests/helpers"
import { uploadPhotos } from "../../../tests/listings"

beforeEach(resetDb)

const logoRow = () =>
  db
    .select({ id: dealerships.logoUploadId, cover: dealerships.coverUploadId })
    .from(dealerships)
    .where(eq(dealerships.ownerUserId, "u-dealer"))
    .then(([row]) => row)

const uploadExists = (id: string | null | undefined) =>
  db
    .select({ id: uploads.id })
    .from(uploads)
    .where(eq(uploads.id, id ?? ""))
    .then((rows) => rows.length > 0)

describe("PATCH /me/business pictures", () => {
  test("takes a new logo, attaches it and deletes the old one", async () => {
    const dealer = await signIn("dealership")
    const before = await logoRow()
    const [photo] = await uploadPhotos(dealer, 1)
    const res = await patchBusiness(dealer, { logoUrl: photo?.url })
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ logoUrl: photo?.url })
    const after = await logoRow()
    expect(after?.id).toBe(photo?.id ?? "")
    expect(after?.cover).toBe(before?.cover ?? null)
    const [row] = await db
      .select()
      .from(uploads)
      .where(eq(uploads.id, photo?.id ?? ""))
    expect(row?.attachedAt).not.toBeNull()
    expect(await uploadExists(before?.id)).toBe(false)
  })

  test("keeps both pictures when their current addresses come back, as the branding section sends them", async () => {
    const dealer = await signIn("dealership")
    const before = await logoRow()
    const mine = await mineOf(dealer)
    const res = await patchBusiness(dealer, {
      logoUrl: mine.logoUrl,
      coverUrl: mine.coverUrl,
    })
    expect(res.status).toBe(200)
    expect(await logoRow()).toEqual(before)
    expect(await uploadExists(before?.id)).toBe(true)
  })

  test("clears a picture with an empty address and deletes its file", async () => {
    const dealer = await signIn("dealership")
    const before = await logoRow()
    const res = await patchBusiness(dealer, { coverUrl: "" })
    expect(await res.json()).toMatchObject({ coverUrl: "" })
    expect((await logoRow())?.cover).toBeNull()
    expect(await uploadExists(before?.cover)).toBe(false)
    expect(await uploadExists(before?.id)).toBe(true)
  })

  test("lets the logo and the cover trade places without deleting either", async () => {
    const dealer = await signIn("dealership")
    const before = await logoRow()
    const mine = await mineOf(dealer)
    const res = await patchBusiness(dealer, {
      logoUrl: mine.coverUrl,
      coverUrl: mine.logoUrl,
    })
    expect(res.status).toBe(200)
    expect(await logoRow()).toEqual({
      id: before?.cover ?? null,
      cover: before?.id ?? null,
    })
    expect(await uploadExists(before?.id)).toBe(true)
    expect(await uploadExists(before?.cover)).toBe(true)
  })

  test("returns 422 for an address that is not the owner's own photo", async () => {
    const dealer = await signIn("dealership")
    const before = await logoRow()
    const other = await signIn("workshop")
    const [theirs] = await uploadPhotos(other, 1)
    for (const logoUrl of [theirs?.url, "https://elsewhere.example/p.jpg"]) {
      const res = await patchBusiness(dealer, { logoUrl })
      expect(res.status).toBe(422)
      expect(await res.json()).toMatchObject({
        fields: { logoUrl: "validation.url" },
      })
    }
    expect(await logoRow()).toEqual(before)
  })

  test("returns 422 when one new photo is both logo and cover", async () => {
    const dealer = await signIn("dealership")
    const before = await logoRow()
    const [photo] = await uploadPhotos(dealer, 1)
    const res = await patchBusiness(dealer, {
      logoUrl: photo?.url,
      coverUrl: photo?.url,
    })
    expect(res.status).toBe(422)
    expect(await logoRow()).toEqual(before)
    expect(await uploadExists(photo?.id)).toBe(true)
  })

  test("takes a mechanic's photo the same way", async () => {
    const person = await signIn("mechanic")
    const [photo] = await uploadPhotos(person, 1)
    const res = await patchBusiness(person, { photoUrl: photo?.url })
    expect(await res.json()).toMatchObject({ photoUrl: photo?.url })
    const [row] = await db
      .select({ id: mechanics.photoUploadId })
      .from(mechanics)
      .where(eq(mechanics.ownerUserId, "u-mechanic"))
    expect(row?.id).toBe(photo?.id ?? "")
  })
})
