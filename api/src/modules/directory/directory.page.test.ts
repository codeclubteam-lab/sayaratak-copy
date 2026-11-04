import { beforeEach, describe, expect, test } from "bun:test"
import { pageOf } from "@sayaratak/shared/schemas/fields"
import {
  dealershipSchema,
  mechanicSchema,
} from "@sayaratak/shared/schemas/profile"

import { expectSchema, req, resetDb, signIn } from "../../../tests/helpers"
import { complete, dealerPayload, NEW_ID } from "../../../tests/onboarding"

beforeEach(resetDb)

type Page = { items: { id: string; slug: string }[]; total: number }
const list = async (path: string) => (await (await req(path)).json()) as Page

describe("paging", () => {
  test("cuts pages, caps the size at 100, and answers no items past the end", async () => {
    const all = await list("/workshops?pageSize=100")
    const first = await list("/workshops?pageSize=5")
    const second = await list("/workshops?pageSize=5&page=2")
    expect(first.items).toHaveLength(5)
    expect(second.items.map((i) => i.id)).toEqual(
      all.items.slice(5, 10).map((i) => i.id)
    )
    const rail = await list("/workshops?limit=3")
    expect(rail.items).toHaveLength(3)
    const past = await list("/workshops?page=99")
    expect(past.items).toEqual([])
    expect(past.total).toBe(all.total)
    expect((await list("/workshops?pageSize=1000")).items.length).toBe(
      all.total
    )
  })
})

describe("a business made in onboarding", () => {
  test("shows in the list and on its page with no reviews, no listings and a slug from its name", async () => {
    const visitor = await signIn("new")
    expect((await complete(visitor, "dealership", dealerPayload)).status).toBe(
      200
    )
    const page = await expectSchema(
      await req("/dealerships?q=al+nour&pageSize=100"),
      (await import("@sayaratak/shared/schemas/fields")).pageOf(
        dealershipSchema
      )
    )
    const made = page.items.find((item) => item.ownerId === NEW_ID)
    expect(made).toMatchObject({
      verified: false,
      status: "active",
      inventoryCount: 0,
      logoUrl: "",
      coverUrl: "",
      rating: { avg: 0, count: 0, distribution: [0, 0, 0, 0, 0] },
    })
    const detail = await expectSchema(
      await req(`/dealerships/${made?.slug}`),
      dealershipSchema
    )
    expect(detail.id).toBe(made?.id ?? "")
    expect(detail.ownerId).toBe(NEW_ID)
    await expectSchema(await req("/mechanics"), pageOf(mechanicSchema))
  })
})
