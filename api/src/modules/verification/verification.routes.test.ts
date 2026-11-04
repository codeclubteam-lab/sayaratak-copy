import { beforeEach, describe, expect, test } from "bun:test"
import { verificationRequestSchema } from "@sayaratak/shared/schemas/admin"
import { eq } from "drizzle-orm"

import { uploads } from "~/modules/uploads/uploads.tables"
import { db } from "~/shared/db/client"

import { fileOf, postVerification } from "../../../tests/files"
import {
  DEMO_IDS,
  expectSchema,
  req,
  resetDb,
  type SignedIn,
  signIn,
} from "../../../tests/helpers"
import { verificationRequests } from "./verification.tables"

// Seed: d-1 (u-dealer) is verified; w-1 (u-workshop) and m-1 (u-mechanic) are not and have no request.
const doc = (label = "workshop_license") => ({ label, file: fileOf("jpeg") })
const mine = (as: SignedIn) =>
  req("/me/verification", { headers: { cookie: as.cookie } })

beforeEach(resetDb)

describe("POST /me/verification", () => {
  test("saves a pending request with its documents as the owner's private files", async () => {
    const shop = await signIn("workshop")
    const request = await expectSchema(
      await postVerification(
        shop,
        [doc(), doc("shop_photo")],
        "  Please check  "
      ),
      verificationRequestSchema
    )
    expect(request).toMatchObject({
      targetType: "workshop",
      targetId: "w-1",
      ownerId: DEMO_IDS.workshop,
      status: "pending",
      note: "Please check",
    })
    expect(request.documents.map((d) => d.label)).toEqual([
      "workshop_license",
      "shop_photo",
    ])
    expect(request.documents.every((d) => d.url.includes("/uploads/up-"))).toBe(
      true
    )
    const stored = await db
      .select({
        delivery: uploads.delivery,
        kind: uploads.kind,
        attachedAt: uploads.attachedAt,
      })
      .from(uploads)
      .where(eq(uploads.id, request.documents[0]?.url.split("/").at(-1) ?? ""))
    expect(stored[0]).toMatchObject({ delivery: "private", kind: "document" })
    expect(stored[0]?.attachedAt).not.toBeNull()
  })

  test("the owner reads the files back and the admin queue grows", async () => {
    const shop = await signIn("workshop")
    const request = await expectSchema(
      await postVerification(shop, [doc()]),
      verificationRequestSchema
    )
    const file = await req(
      new URL(request.documents[0]?.url ?? "").pathname.replace("/api/v1", ""),
      {
        headers: { cookie: shop.cookie },
      }
    )
    expect(file.status).toBe(200)
    const other = await signIn("mechanic")
    const hidden = await req(
      new URL(request.documents[0]?.url ?? "").pathname.replace("/api/v1", ""),
      {
        headers: { cookie: other.cookie },
      }
    )
    expect(hidden.status).toBe(404)
  })

  test("is 409 when a request already waits or the business is verified", async () => {
    const shop = await signIn("workshop")
    expect((await postVerification(shop, [doc()])).status).toBe(200)
    expect((await postVerification(shop, [doc()])).status).toBe(409)
    expect(
      (await postVerification(await signIn("dealership"), [doc()])).status
    ).toBe(409)
  })

  test("lets only one of two requests sent together in", async () => {
    const shop = await signIn("mechanic")
    const answers = await Promise.all([
      postVerification(shop, [doc("national_id")]),
      postVerification(shop, [doc("national_id")]),
    ])
    expect(answers.map((r) => r.status).sort()).toEqual([200, 409])
    expect(
      await db.$count(
        verificationRequests,
        eq(verificationRequests.ownerId, DEMO_IDS.mechanic)
      )
    ).toBe(1)
  })

  test("is 401 signed out and 403 for an account with no business role", async () => {
    expect((await req("/me/verification", { method: "POST" })).status).toBe(401)
    expect((await postVerification(await signIn("user"), [doc()])).status).toBe(
      403
    )
  })

  test("is 422 for a bad count, label, note or file", async () => {
    const shop = await signIn("workshop")
    const documents = (n: number) => Array.from({ length: n }, () => doc())
    for (const bad of [documents(0), documents(6), [doc("selfie")]]) {
      const res = await postVerification(shop, bad)
      expect(res.status).toBe(422)
      expect(await res.json()).toMatchObject({
        fields: { documents: "validation.select_min" },
      })
    }
    const note = await postVerification(shop, [doc()], "x".repeat(301))
    expect(await note.json()).toMatchObject({
      fields: { note: "validation.too_long" },
    })
    const video = await postVerification(shop, [
      { label: "other", file: fileOf("mp4") },
    ])
    expect(await video.json()).toMatchObject({
      fields: { file: "validation.image_type" },
    })
    const big = await postVerification(shop, [
      { label: "other", file: fileOf("png", { size: 5 * 1024 * 1024 + 1 }) },
    ])
    expect(await big.json()).toMatchObject({
      fields: { file: "validation.file_size_5mb" },
    })
    expect(
      await db.$count(
        verificationRequests,
        eq(verificationRequests.ownerId, DEMO_IDS.workshop)
      )
    ).toBe(0)
  })
})

describe("GET /me/verification", () => {
  test("is the newest request, or null when the account never asked", async () => {
    const shop = await signIn("workshop")
    expect(await (await mine(shop)).json()).toBeNull()
    const sent = await expectSchema(
      await postVerification(shop, [doc()]),
      verificationRequestSchema
    )
    expect(
      await expectSchema(await mine(shop), verificationRequestSchema)
    ).toEqual(sent)
    expect(await (await mine(await signIn("user"))).json()).toBeNull()
    expect((await req("/me/verification")).status).toBe(401)
  })
})
