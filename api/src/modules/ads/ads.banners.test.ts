import {
  afterEach,
  beforeEach,
  describe,
  expect,
  mock,
  spyOn,
  test,
} from "bun:test"
import { bannerSchema } from "@sayaratak/shared/schemas/admin"
import { eq } from "drizzle-orm"
import { z } from "zod"

import { db } from "~/shared/db/client"
import { clock } from "~/shared/time/clock"

import { buildSeed, expectSchema, req, resetDb } from "../../../tests/helpers"
import { banners } from "./ads.tables"

const seeded = buildSeed().banners
const DAY_MS = 24 * 3600 * 1000

beforeEach(resetDb)
// The clock spy of one test must not reach the next test or file.
afterEach(() => mock.restore())

async function getBanners(query = "") {
  const res = await req(`/banners${query}`)
  expect(res.status).toBe(200)
  return expectSchema(res, z.array(bannerSchema))
}

describe("GET /banners", () => {
  test("answers every live banner in sort order, with one picture per language", async () => {
    const list = await getBanners()
    expect(list.map((b) => b.id)).toEqual(
      seeded.toSorted((a, b) => a.sortOrder - b.sortOrder).map((b) => b.id)
    )
    expect(list[0]?.imageUrl.ar).toBeTruthy()
    expect(list[0]?.imageUrl.en).toBeTruthy()
  })

  test("narrows to one placement, and an unknown placement gives none", async () => {
    const wanted = seeded[0]?.placement ?? "home_top"
    const list = await getBanners(`?placement=${wanted}`)
    expect(list.length).toBeGreaterThan(0)
    expect(list.every((b) => b.placement === wanted)).toBe(true)
    expect(await getBanners("?placement=nowhere")).toEqual([])
  })

  test("leaves out a banner that is switched off", async () => {
    const id = seeded[0]?.id ?? ""
    await db.update(banners).set({ active: false }).where(eq(banners.id, id))
    expect((await getBanners()).map((b) => b.id)).not.toContain(id)
  })

  test("leaves out a banner before its start and after its end", async () => {
    const first = seeded[0]
    const before = new Date(Date.parse(first?.startsAt ?? "") - DAY_MS)
    const after = new Date(Date.parse(first?.endsAt ?? "") + DAY_MS)
    const clockSpy = spyOn(clock, "now")
    clockSpy.mockReturnValue(before)
    expect(await getBanners()).toEqual([])
    clockSpy.mockReturnValue(after)
    expect(await getBanners()).toEqual([])
  })

  test("is not cached, since what is live depends on the time", async () => {
    const res = await req("/banners")
    expect(res.headers.get("cache-control")).toBe("no-store")
  })
})
