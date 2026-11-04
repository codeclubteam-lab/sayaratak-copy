import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test"
import { eq } from "drizzle-orm"

import { db } from "~/shared/db/client"
import { clock } from "~/shared/time/clock"
import { DEFAULT_HOURS } from "~/shared/time/hours"
import { workshops } from "~/modules/businesses/businesses.tables"

import { req, resetDb } from "../../../tests/helpers"

beforeEach(resetDb)
afterEach(() => spyOn(clock, "now").mockRestore())

const slugs = async (path: string) => {
  const page = (await (await req(path)).json()) as {
    items: { slug: string }[]
  }
  return page.items.map((item) => item.slug)
}

describe("workshops open now", () => {
  const setHours = (id: string, open: string, close: string) =>
    db
      .update(workshops)
      .set({
        hours: DEFAULT_HOURS.map((row) => ({
          ...row,
          closed: false,
          open,
          close,
        })),
      })
      .where(eq(workshops.id, id))

  test("uses the Khartoum clock and treats closing time as closed", async () => {
    const [shop] = await db.select().from(workshops).limit(1)
    await setHours(shop?.id ?? "", "09:00", "17:00")
    const open = async (instant: string) => {
      spyOn(clock, "now").mockReturnValue(new Date(instant))
      return (await slugs("/workshops?openNow=true&pageSize=100")).includes(
        shop?.slug ?? ""
      )
    }
    // 07:00 UTC is 09:00 in Khartoum: open at opening time, closed at 17:00 sharp.
    expect(await open("2026-11-01T07:00:00Z")).toBe(true)
    expect(await open("2026-11-01T14:59:00Z")).toBe(true)
    expect(await open("2026-11-01T15:00:00Z")).toBe(false)
    expect(await open("2026-11-01T06:59:00Z")).toBe(false)
  })

  test("leaves every workshop in the list when the flag is not true", async () => {
    spyOn(clock, "now").mockReturnValue(new Date("2026-11-01T01:00:00Z"))
    const all = await slugs("/workshops?pageSize=100")
    expect(await slugs("/workshops?openNow=false&pageSize=100")).toEqual(all)
    expect(await slugs("/workshops?openNow=true&pageSize=100")).toEqual([])
  })
})

describe("workshops nearest", () => {
  test("sorts by distance and puts a workshop with no pin last", async () => {
    const rows = await db
      .select()
      .from(workshops)
      .orderBy(workshops.id)
      .limit(3)
    const [a, b, c] = rows
    const pin = (
      id: string | undefined,
      lat: number | null,
      lng: number | null
    ) =>
      db
        .update(workshops)
        .set({ lat, lng })
        .where(eq(workshops.id, id ?? ""))
    await pin(a?.id, 15.6, 32.6)
    await pin(b?.id, null, null)
    await pin(c?.id, 15.5, 32.5)
    const order = (
      await slugs("/workshops?sort=nearest&lat=15.5&lng=32.5&pageSize=100")
    ).filter((slug) => [a, b, c].some((row) => row?.slug === slug))
    expect(order).toEqual([c, a, b].map((row) => row?.slug ?? ""))
  })
})
