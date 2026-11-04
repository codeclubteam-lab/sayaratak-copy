import { beforeEach, describe, expect, test } from "bun:test"
import { mediaSchema } from "@sayaratak/shared/schemas/listing"
import { and, eq, inArray, isNotNull } from "drizzle-orm"

import { env } from "~/env"
import { db } from "~/shared/db/client"
import { user } from "~/modules/auth/auth.tables"

import { fileOf, postUpload } from "../../../tests/files"
import {
  DEMO_IDS,
  type DemoAccount,
  expectSchema,
  req,
  resetDb,
  signIn,
} from "../../../tests/helpers"
import { storePrivateFile } from "./uploads.store.service"
import { uploads } from "./uploads.tables"

beforeEach(resetDb)

const ACCOUNT_OF = Object.fromEntries(
  Object.entries(DEMO_IDS).map(([account, id]) => [id, account])
) as Record<string, DemoAccount>

function getAs(path: string, cookie = "") {
  return req(path, { headers: { cookie }, redirect: "manual" })
}

// A seeded receipt whose payer is a demo account, so the test can sign in as them.
async function demoReceipt() {
  const [row] = await db
    .select()
    .from(uploads)
    .where(
      and(
        eq(uploads.kind, "receipt"),
        inArray(uploads.ownerUserId, Object.values(DEMO_IDS))
      )
    )
    .limit(1)
  if (!row?.ownerUserId) throw new Error("the seed has no demo receipt")
  return { row, owner: ACCOUNT_OF[row.ownerUserId] ?? "user" }
}

describe("GET /uploads/:id, public files", () => {
  test("redirects a photo to its CDN address at the asked width", async () => {
    const media = await expectSchema(
      await postUpload(await signIn("user"), { file: fileOf("jpeg") }),
      mediaSchema
    )
    const res = await getAs(`/uploads/${media.id}?w=640`)
    expect(res.status).toBe(302)
    expect(res.headers.get("location")).toBe(media.url.replace("{w}", "640"))
  })

  test("serves 1280 for a width that has no derivative", async () => {
    const media = await expectSchema(
      await postUpload(await signIn("user"), { file: fileOf("jpeg") }),
      mediaSchema
    )
    const res = await getAs(`/uploads/${media.id}?w=500`)
    expect(res.headers.get("location")).toContain(",w_1280/")
  })

  test("redirects a seeded demo photo to the web server", async () => {
    const [row] = await db
      .select()
      .from(uploads)
      .where(and(eq(uploads.kind, "image"), isNotNull(uploads.url)))
      .limit(1)
    const res = await getAs(`/uploads/${row?.id}?w=320`)
    expect(res.status).toBe(302)
    const location = res.headers.get("location") ?? ""
    expect(location.startsWith(new URL(env.WEB_ORIGIN).origin)).toBe(true)
    expect(location).not.toContain("{w}")
  })

  test("returns 404 not_found for an unknown id", async () => {
    const res = await getAs("/uploads/up-nothere")
    expect(res.status).toBe(404)
    expect(await res.json()).toMatchObject({ code: "not_found" })
  })
})

describe("GET /uploads/:id, private files", () => {
  test("streams a receipt to its payer with private, no-store and no script", async () => {
    const { row, owner } = await demoReceipt()
    const res = await getAs(`/uploads/${row.id}`, (await signIn(owner)).cookie)
    expect(res.status).toBe(200)
    expect(res.headers.get("content-type")).toContain("image/svg+xml")
    expect(res.headers.get("cache-control")).toBe("private, no-store")
    expect(res.headers.get("x-content-type-options")).toBe("nosniff")
    expect(res.headers.get("content-security-policy")).toContain("sandbox")
    expect(await res.text()).toContain("<svg")
  })

  test("streams it to an admin", async () => {
    const { row } = await demoReceipt()
    const res = await getAs(
      `/uploads/${row.id}`,
      (await signIn("admin")).cookie
    )
    expect(res.status).toBe(200)
  })

  test("returns 404 signed out and to another user, so the id tells nothing", async () => {
    const { row, owner } = await demoReceipt()
    const other: DemoAccount = owner === "user" ? "workshop" : "user"
    for (const cookie of ["", (await signIn(other)).cookie]) {
      const res = await getAs(`/uploads/${row.id}`, cookie)
      expect(res.status).toBe(404)
    }
  })

  test("streams a stored private file's bytes from the file host", async () => {
    const [omar] = await db
      .select()
      .from(user)
      .where(eq(user.id, DEMO_IDS.user))
    if (!omar) throw new Error("no demo user")
    const file = fileOf("png", { size: 100 })
    const upload = await storePrivateFile(db, {
      user: omar,
      file,
      kind: "receipt",
    })
    expect(upload.url).toBe(
      new URL(`/api/v1/uploads/${upload.id}`, env.BETTER_AUTH_URL).href
    )
    expect(upload).toMatchObject({ type: "file", name: file.name, size: 100 })
    const res = await getAs(
      `/uploads/${upload.id}`,
      (await signIn("user")).cookie
    )
    expect(res.headers.get("content-type")).toBe("image/png")
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(await file.bytes())
  })

  test("refuses a private file that is not JPEG, PNG or WebP", async () => {
    const [omar] = await db
      .select()
      .from(user)
      .where(eq(user.id, DEMO_IDS.user))
    if (!omar) throw new Error("no demo user")
    const error = await storePrivateFile(db, {
      user: omar,
      file: fileOf("mp4"),
      kind: "document",
    }).catch((caught: unknown) => caught)
    expect(error).toMatchObject({
      code: "validation",
      fields: { file: "validation.image_type" },
    })
  })
})
