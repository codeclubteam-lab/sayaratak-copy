import { afterAll, beforeAll, describe, expect, test } from "bun:test"
import { mediaSchema } from "@sayaratak/shared/schemas/listing"
import { eq } from "drizzle-orm"

import { env } from "~/env"
import { db } from "~/shared/db/client"
import { IMAGE_WIDTHS } from "~/shared/files/delivery"
import { files } from "~/shared/files/store"
import { user } from "~/modules/auth/auth.tables"

import { postUpload } from "../../../tests/files"
import {
  DEMO_IDS,
  expectSchema,
  req,
  resetDb,
  signIn,
} from "../../../tests/helpers"
import { storePrivateFile } from "./uploads.store.service"
import { uploads } from "./uploads.tables"

// The 4.2 check against the owner's real Cloudinary account (A8). Runs only with
// `CLOUDINARY_LIVE=1` and `CLOUDINARY_URL` set, and needs a phone photo with
// GPS in its EXIF at `CLOUDINARY_LIVE_PHOTO`. Everything it uploads is deleted
// at the end.
const LIVE = Bun.env.CLOUDINARY_LIVE === "1" && Boolean(env.CLOUDINARY_URL)
const PHOTO = Bun.env.CLOUDINARY_LIVE_PHOTO ?? ""
// "Exif" in the APP1 header and "GPS" in the tag names.
const EXIF_MARKERS = ["Exif", "GPS"]

const stored: {
  publicId: string
  mime: string
  delivery: "public" | "private"
}[] = []

describe.skipIf(!LIVE)("Cloudinary, live", () => {
  beforeAll(resetDb)
  afterAll(async () => {
    for (const file of stored) await files.remove(file)
  })

  test("the photo has GPS in its EXIF before upload", async () => {
    const text = new TextDecoder("latin1").decode(await Bun.file(PHOTO).bytes())
    for (const marker of EXIF_MARKERS) expect(text).toContain(marker)
  })

  test("the four widths load, w_500 is 404, the bare original has no EXIF", async () => {
    const photo = new File([await Bun.file(PHOTO).bytes()], "phone.jpg", {
      type: "image/jpeg",
    })
    const media = await expectSchema(
      await postUpload(await signIn("user"), { file: photo }),
      mediaSchema
    )
    const [row] = await db
      .select()
      .from(uploads)
      .where(eq(uploads.id, media.id))
    stored.push({
      publicId: row?.cloudinaryId ?? "",
      mime: "image/jpeg",
      delivery: "public",
    })
    expect(media.width).toBeGreaterThan(0)
    expect(media.placeholderColor).toMatch(/^#[0-9a-f]{6}$/)
    for (const width of IMAGE_WIDTHS) {
      const res = await fetch(media.url.replace("{w}", String(width)))
      expect(res.status).toBe(200)
      expect(res.headers.get("content-type")).toBe("image/webp")
    }
    expect((await fetch(media.url.replace("{w}", "500"))).status).toBe(404)
    const original = `https://res.cloudinary.com/${files.cloudName}/image/upload/${row?.cloudinaryId}`
    const bare = await fetch(original)
    expect(bare.status).toBe(200)
    const text = new TextDecoder("latin1").decode(await bare.arrayBuffer())
    for (const marker of EXIF_MARKERS) expect(text).not.toContain(marker)
  })

  test("a private receipt is 404 signed out and to another user, 200 to its payer", async () => {
    const [omar] = await db
      .select()
      .from(user)
      .where(eq(user.id, DEMO_IDS.user))
    if (!omar) throw new Error("no demo user")
    const bytes = await Bun.file(PHOTO).bytes()
    const receipt = await storePrivateFile(db, {
      user: omar,
      file: new File([bytes], "receipt.jpg", { type: "image/jpeg" }),
      kind: "receipt",
    })
    const [row] = await db
      .select()
      .from(uploads)
      .where(eq(uploads.id, receipt.id))
    stored.push({
      publicId: row?.cloudinaryId ?? "",
      mime: "image/jpeg",
      delivery: "private",
    })
    const path = `/uploads/${receipt.id}`
    expect((await req(path)).status).toBe(404)
    const other = await signIn("workshop")
    expect(
      (await req(path, { headers: { cookie: other.cookie } })).status
    ).toBe(404)
    const own = await req(path, {
      headers: { cookie: (await signIn("user")).cookie },
    })
    expect(own.status).toBe(200)
    expect((await own.arrayBuffer()).byteLength).toBeGreaterThan(0)
    // No Cloudinary address for it exists that works without signing.
    const guess = `https://res.cloudinary.com/${files.cloudName}/image/private/${row?.cloudinaryId}`
    expect((await fetch(guess)).status).not.toBe(200)
  })
})
