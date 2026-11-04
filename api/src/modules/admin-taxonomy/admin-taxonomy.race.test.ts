import { beforeEach, describe, expect, test } from "bun:test"

import { adminCaller } from "../../../tests/admin"
import { resetDb } from "../../../tests/helpers"
import { dongola } from "../../../tests/taxonomy"

let call = adminCaller()
beforeEach(async () => {
  await resetDb()
  call = adminCaller()
})

const idOf = async (res: Response) => ((await res.json()) as { id: string }).id

describe("two admins at once", () => {
  test("adding the same name twice gives two slugs, not a failure", async () => {
    const [first, second] = await Promise.all([
      call("POST", "/admin/taxonomy/cities", dongola),
      call("POST", "/admin/taxonomy/cities", dongola),
    ])
    expect([first.status, second.status]).toEqual([200, 200])
    expect([await idOf(first), await idOf(second)].sort()).toEqual([
      "dongola",
      "dongola-2",
    ])
  })

  test("hiding the last two vehicle types together hides one and answers 409 `last_shown` to the other", async () => {
    for (const id of ["car", "truck", "motorcycle"])
      await call("PATCH", `/admin/taxonomy/vehicle-types/${id}`, {
        enabled: false,
      })
    const results = await Promise.all(
      ["tuk_tuk", "rickshaw"].map((id) =>
        call("PATCH", `/admin/taxonomy/vehicle-types/${id}`, { enabled: false })
      )
    )
    expect(results.map((res) => res.status).sort()).toEqual([200, 409])
    const list = (await (
      await call("GET", "/admin/taxonomy/vehicle-types")
    ).json()) as { enabled: boolean }[]
    expect(list.filter((row) => row.enabled)).toHaveLength(1)
  })

  test("deleting a city while a district is added under it ends one way or the other, never in a 500", async () => {
    for (let round = 0; round < 3; round++) {
      const city = await idOf(
        await call("POST", "/admin/taxonomy/cities", {
          ...dongola,
          name: { ar: `م${round}`, en: `Round ${round}` },
        })
      )
      const [removed, added] = await Promise.all([
        call("DELETE", `/admin/taxonomy/cities/${city}`),
        call("POST", "/admin/taxonomy/districts", {
          cityId: city,
          name: { ar: "ح", en: "H" },
        }),
      ])
      // Delete first: the district has no city (422). District first: the city is in use (409).
      const outcome = [removed.status, added.status]
      expect([
        [200, 422],
        [409, 200],
      ]).toContainEqual(outcome)
    }
  })
})
