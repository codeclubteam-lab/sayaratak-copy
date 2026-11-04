import { beforeEach, describe, expect, test } from "bun:test"
import { adminSearchSchema } from "@sayaratak/shared/schemas/responses"

import {
  buildSeed,
  expectSchema,
  req,
  resetDb,
  signIn,
} from "../../../tests/helpers"

const seeded = buildSeed()

beforeEach(resetDb)

async function asAdmin(path: string) {
  const { cookie } = await signIn("admin")
  return req(path, { headers: { cookie } })
}

describe("GET /admin/search", () => {
  const search = async (q: string) =>
    expectSchema(
      await asAdmin(`/admin/search?q=${encodeURIComponent(q)}`),
      adminSearchSchema
    )
  const none = { listings: [], users: [], businesses: [], payments: [] }

  test("finds nothing for a blank or missing q", async () => {
    expect(await search("   ")).toEqual(none)
    expect(
      await expectSchema(await asAdmin("/admin/search"), adminSearchSchema)
    ).toEqual(none)
  })

  test("finds a listing by title in any case, or by id, with its state and screen", async () => {
    const row = seeded.listings.find((l) => l.title.includes("Peugeot"))
    const byTitle = await search("peUGEOT")
    expect(byTitle.listings.length).toBeGreaterThan(0)
    expect(byTitle.listings.length).toBeLessThanOrEqual(5)
    const byId = await search(row?.id ?? "")
    expect(byId.listings).toEqual([
      {
        id: row?.id ?? "",
        label: { ar: row?.title ?? "", en: row?.title ?? "" },
        detail: row?.moderation ?? "",
        href: `/admin/listings?id=${row?.id}`,
      },
    ])
  })

  test("finds an account by name, email or phone", async () => {
    const found = await search("omar")
    expect(found.users.map((u) => u.id)).toContain("u-omar")
    const hit = found.users.find((u) => u.id === "u-omar")
    expect(hit?.href).toBe("/admin/users?id=u-omar")
    expect((await search("dealer@demo.sy")).users.map((u) => u.id)).toEqual([
      "u-dealer",
    ])
  })

  test("finds a business by its name in either language, naming its kind", async () => {
    const dealership = seeded.dealerships[0]
    const hit = (await search(dealership?.name.en ?? "")).businesses
    expect(hit[0]).toMatchObject({
      id: dealership?.id,
      label: dealership?.name,
      detail: "dealership",
      href: `/admin/dealerships?id=${dealership?.id}`,
    })
    expect((await search(dealership?.name.ar ?? "")).businesses[0]?.id).toBe(
      dealership?.id
    )
  })

  test("finds a payment by reference or payer name", async () => {
    const payment = seeded.payments[0]
    const found = await search(payment?.reference ?? "")
    expect(found.payments[0]).toEqual({
      id: payment?.id ?? "",
      label: { ar: payment?.reference ?? "", en: payment?.reference ?? "" },
      detail: payment?.payerName ?? "",
      href: `/admin/payments?id=${payment?.id}`,
    })
    expect(
      (await search(payment?.payerName ?? "")).payments.map((p) => p.id)
    ).toContain(payment?.id ?? "")
  })

  test("takes % and _ as plain characters and returns at most five hits per kind", async () => {
    expect(await search("%")).toEqual(none)
    expect(await search("_")).toEqual(none)
    const broad = await search("a")
    for (const hits of Object.values(broad))
      expect(hits.length).toBeLessThanOrEqual(5)
  })
})
