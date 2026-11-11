import { beforeEach, describe, expect, test } from "bun:test"
import { bannerSchema } from "@sayaratak/shared/schemas/admin"
import { eq } from "drizzle-orm"

import { db } from "~/shared/db/client"
import { banners } from "~/modules/ads/ads.tables"

import { errorOf } from "../../../tests/admin"
import {
  auditOf,
  bannerBody,
  callAs,
  uploadPicture,
  uploadRows,
} from "../../../tests/banners"
import {
  expectSchema,
  resetDb,
  type SignedIn,
  signIn,
} from "../../../tests/helpers"

let admin: SignedIn
let call: ReturnType<typeof callAs>
beforeEach(async () => {
  await resetDb()
  admin = await signIn("admin")
  call = callAs(admin)
})

const newBanner = async () =>
  bannerBody({ ar: await uploadPicture(admin), en: await uploadPicture(admin) })
const bannerRow = (id: string) =>
  db
    .select()
    .from(banners)
    .where(eq(banners.id, id))
    .then(([row]) => row)

describe("POST /admin/banners", () => {
  test("adds a banner at the end of the pictures the admin uploaded, with no views yet, and writes the audit row", async () => {
    const body = await newBanner()
    const res = await call("POST", "/admin/banners", body)
    expect(res.status).toBe(200)
    const made = await expectSchema(res, bannerSchema)
    expect(made).toMatchObject({
      ...body,
      impressions: 0,
      clicks: 0,
      endsAt: "2026-12-01T23:59:59.000Z",
    })
    expect(
      (await call("GET", "/admin/banners").then((r) => r.json())) as {
        id: string
      }[]
    ).toHaveLength(8)
    expect(await auditOf(made.id)).toMatchObject([
      { action: "banner.create", targetType: "banner", adminId: "u-admin" },
    ])
    const [row] = await db.select().from(banners).where(eq(banners.id, made.id))
    expect(row?.imageArUploadId).not.toBe(row?.imageEnUploadId)
  })

  test("accepts an uploaded picture with {w} replaced by 1280 and keeps it on patch", async () => {
    const template = await uploadPicture(admin)
    const sized = template.replace("{w}", "1280")
    const made = await expectSchema(
      await call(
        "POST",
        "/admin/banners",
        bannerBody({ ar: sized, en: sized })
      ),
      bannerSchema
    )
    expect(made.imageUrl).toEqual({ ar: template, en: template })
    const patched = await expectSchema(
      await call("PATCH", `/admin/banners/${made.id}`, {
        title: "Updated offers",
        imageUrl: { ar: sized, en: sized },
      }),
      bannerSchema
    )
    expect(patched.title).toBe("Updated offers")
    expect(patched.imageUrl).toEqual({ ar: template, en: template })
  })

  test("answers 422 for a picture that is not the admin's upload, and for bad dates", async () => {
    const body = await newBanner()
    const alien = await call("POST", "/admin/banners", {
      ...body,
      imageUrl: { ...body.imageUrl, en: "/mock/banner-1.webp" },
    })
    expect(alien.status).toBe(422)
    expect((await errorOf(alien)).fields).toEqual({
      "imageUrl.en": "validation.url",
    })
    for (const [dates, field, key] of [
      [{ startsAt: "soon" }, "startsAt", "validation.date"],
      [
        { endsAt: "2026-10-01T00:00:00.000Z" },
        "endsAt",
        "validation.date_order",
      ],
    ] as const) {
      const res = await call("POST", "/admin/banners", { ...body, ...dates })
      expect(res.status).toBe(422)
      expect((await errorOf(res)).fields).toEqual({ [field]: key })
    }
    expect((await call("POST", "/admin/banners", {})).status).toBe(422)
    expect(await db.select().from(banners)).toHaveLength(7)
  })
})

describe("PATCH /admin/banners/:id", () => {
  test("changes the fields sent, keeps the pictures sent again and writes before and after", async () => {
    const res = await call("PATCH", "/admin/banners/bn-1", {
      title: "New title",
      imageUrl: { ar: "/mock/banner-1.webp", en: "/mock/banner-1.webp" },
      focus: 80,
    })
    expect(res.status).toBe(200)
    expect(await expectSchema(res, bannerSchema)).toMatchObject({
      id: "bn-1",
      title: "New title",
      focus: 80,
      placement: "home_top",
      imageUrl: { ar: "/mock/banner-1.webp", en: "/mock/banner-1.webp" },
    })
    expect(await auditOf("bn-1")).toMatchObject([
      {
        action: "banner.update",
        before: { title: "عروض الصيف", focus: 50 },
        after: { title: "New title", focus: 80 },
      },
    ])
  })

  test("swaps a picture for a new upload and deletes the old one", async () => {
    const before = await bannerRow("bn-2")
    const fresh = await uploadPicture(admin)
    const res = await call("PATCH", "/admin/banners/bn-2", {
      imageUrl: { ar: fresh, en: "/mock/banner-2.webp" },
    })
    expect(res.status).toBe(200)
    expect((await expectSchema(res, bannerSchema)).imageUrl).toEqual({
      ar: fresh,
      en: "/mock/banner-2.webp",
    })
    const ids = (await uploadRows()).map((row) => row.id)
    expect(ids).not.toContain(before?.imageArUploadId ?? "")
    expect(ids).toContain(before?.imageEnUploadId ?? "")
  })

  test("answers 404 for an unknown banner and 422 for a bad picture or dates, changing nothing", async () => {
    expect((await call("PATCH", "/admin/banners/nope", {})).status).toBe(404)
    const alien = await call("PATCH", "/admin/banners/bn-1", {
      imageUrl: { ar: "/elsewhere.webp", en: "/mock/banner-1.webp" },
    })
    expect(alien.status).toBe(422)
    const dates = await call("PATCH", "/admin/banners/bn-1", {
      endsAt: "2020-01-01T00:00:00.000Z",
    })
    expect((await errorOf(dates)).fields).toEqual({
      endsAt: "validation.date_order",
    })
    expect(await auditOf("bn-1")).toEqual([])
  })
})

describe("DELETE /admin/banners/:id", () => {
  test("deletes the banner and its pictures and writes the audit row", async () => {
    const before = await bannerRow("bn-3")
    const res = await call("DELETE", "/admin/banners/bn-3")
    expect(res.status).toBe(200)
    expect(await bannerRow("bn-3")).toBeUndefined()
    const ids = (await uploadRows()).map((row) => row.id)
    expect(ids).not.toContain(before?.imageArUploadId ?? "")
    expect(ids).not.toContain(before?.imageEnUploadId ?? "")
    expect(await auditOf("bn-3")).toMatchObject([
      { action: "banner.delete", before: { id: "bn-3" } },
    ])
    expect((await call("DELETE", "/admin/banners/bn-3")).status).toBe(404)
  })
})
