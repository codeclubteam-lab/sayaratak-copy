import { beforeEach, describe, expect, test } from "bun:test"
import { adminVerificationSchema } from "@sayaratak/shared/schemas/admin"
import { pageOf } from "@sayaratak/shared/schemas/fields"

import { adminCaller } from "../../../tests/admin"
import { fileOf, postVerification } from "../../../tests/files"
import { expectSchema, req, resetDb, signIn } from "../../../tests/helpers"

// Seed: vr-1 to vr-4 pending (d-9, w-11, m-12, d-10), vr-5 approved (d-2), vr-6 rejected (m-13).
let call = adminCaller()
beforeEach(async () => {
  await resetDb()
  call = adminCaller()
})

const table = async (query = "") => {
  const res = await call("GET", `/admin/verifications${query}`)
  expect(res.status).toBe(200)
  return expectSchema(res, pageOf(adminVerificationSchema))
}
const idsOf = async (query: string) =>
  (await table(query)).items.map((item) => item.id)

describe("admin verification routes", () => {
  test("answer 401 signed out and 403 `forbidden` to a seller", async () => {
    const { cookie, origin } = await signIn("dealership")
    for (const [method, path] of [
      ["GET", "/admin/verifications"],
      ["POST", "/admin/verifications/vr-1/approve"],
      ["POST", "/admin/verifications/vr-1/reject"],
    ] as const) {
      expect((await req(path, { method })).status).toBe(401)
      const seller = await req(path, {
        method,
        headers: { cookie, origin, "content-type": "application/json" },
        body: method === "GET" ? undefined : "{}",
      })
      expect(seller.status).toBe(403)
    }
  })
})

describe("GET /admin/verifications", () => {
  test("is every request newest first with its business and owner", async () => {
    const page = await table()
    expect(page).toMatchObject({ total: 6, page: 1, pageSize: 20 })
    const times = page.items.map((item) => item.createdAt)
    expect(times).toEqual([...times].sort().reverse())
    const [first] = (await table("?id=vr-1")).items
    expect(first).toMatchObject({
      targetType: "dealership",
      targetId: "d-9",
      ownerId: "ud-8",
      status: "pending",
      target: { slug: expect.any(String), cityId: "atbara" },
    })
    expect(first?.owner?.email).toBeTruthy()
    expect(first?.target?.name.en).toBeTruthy()
  })

  test("filters by status, id and text", async () => {
    expect((await idsOf("?status=pending")).sort()).toEqual([
      "vr-1",
      "vr-2",
      "vr-3",
      "vr-4",
    ])
    expect(await idsOf("?status=approved")).toEqual(["vr-5"])
    expect(await idsOf("?status=nope")).toEqual([])
    expect(await idsOf("?id=vr-3")).toEqual(["vr-3"])
    const [row] = (await table("?id=vr-2")).items
    for (const text of [row?.target?.name.ar, row?.target?.name.en]) {
      expect(await idsOf(`?q=${encodeURIComponent(text ?? "")}`)).toContain(
        "vr-2"
      )
    }
    const owner = encodeURIComponent((row?.owner?.name ?? "").toUpperCase())
    expect(await idsOf(`?q=${owner}`)).toContain("vr-2")
    expect(await idsOf("?q=zzzz")).toEqual([])
  })

  test("the admin opens a document picture; nobody signed out can", async () => {
    const shop = await signIn("workshop")
    const sent = await postVerification(shop, [
      { label: "shop_photo", file: fileOf("jpeg") },
    ])
    expect(sent.status).toBe(200)
    const found = (await table("?status=pending")).items.find(
      (item) => item.targetId === "w-1"
    )
    const url = found?.documents[0]?.url ?? ""
    expect(url).toContain("/uploads/up-")
    const path = new URL(url).pathname.replace(/^\/api\/v1/, "")
    expect((await call("GET", path)).status).toBe(200)
    expect((await req(path)).status).not.toBe(200)
  })
})
