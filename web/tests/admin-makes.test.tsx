import { beforeEach, describe, expect, it } from "vitest"

import { db, resetDb } from "@/mocks/db"
import { handleMock } from "@/mocks/router"
import { taxonomySchema } from "@sayaratak/shared/schemas/taxonomy"

beforeEach(resetDb)

const call = (path: string, method = "GET", body?: unknown) =>
  handleMock(
    new Request(`http://localhost/api${path}`, {
      method,
      headers: {
        cookie: "sy_session=u-admin",
        "content-type": "application/json",
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  )
const publicTaxonomy = async () =>
  taxonomySchema.parse(await (await call("/taxonomy")).json())

describe("makes and models", () => {
  it("a new make and model reach the public taxonomy, slug from the English name", async () => {
    const make = await (
      await call("/admin/taxonomy/makes", "POST", {
        name: { ar: "ماركة", en: "Zed Motors" },
        vehicleTypes: ["car"],
      })
    ).json()
    expect(make.id).toBe("zed-motors")
    const model = await (
      await call("/admin/taxonomy/models", "POST", {
        makeId: make.id,
        name: { ar: "زد", en: "Z1" },
      })
    ).json()
    const tax = await publicTaxonomy()
    expect(tax.makes.some((m) => m.id === "zed-motors")).toBe(true)
    expect(tax.models.some((m) => m.id === model.id)).toBe(true)
  })

  it("refuses a make with no vehicle type, and removing a make with models or listings", async () => {
    expect(
      (
        await call("/admin/taxonomy/makes", "POST", {
          name: { ar: "ا", en: "A" },
          vehicleTypes: [],
        })
      ).status
    ).toBe(422)
    const inUse = db.taxonomy.models[0]!.makeId
    expect(
      (await call(`/admin/taxonomy/makes/${inUse}`, "DELETE")).status
    ).toBe(409)
  })
})
