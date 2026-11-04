import { beforeEach, describe, expect, test } from "bun:test"
import { taxonomyRowSchema } from "@sayaratak/shared/schemas/api"

import { adminCaller, errorOf } from "../../../tests/admin"
import { expectSchema, resetDb } from "../../../tests/helpers"
import { auditOf, dongola, eritrea } from "../../../tests/taxonomy"

let call = adminCaller()
beforeEach(async () => {
  await resetDb()
  call = adminCaller()
})

const add = (type: string, body: unknown) =>
  call("POST", `/admin/taxonomy/${type}`, body)

describe("POST /admin/taxonomy/:type", () => {
  test("adds a city with its slug as id and writes the audit row", async () => {
    const res = await add("cities", dongola)
    expect(res.status).toBe(200)
    expect(await expectSchema(res, taxonomyRowSchema)).toEqual({
      id: "dongola",
      slug: "dongola",
      ...dongola,
    })
    const list = (await (
      await call("GET", "/admin/taxonomy/cities")
    ).json()) as {
      id: string
    }[]
    expect(list.at(-1)?.id).toBe("dongola")
    expect(await auditOf("dongola")).toMatchObject([
      {
        action: "city.create",
        targetType: "city",
        adminId: "u-admin",
        after: { id: "dongola", name: dongola.name },
      },
    ])
  })

  test("numbers a slug that is taken, and falls back to a word for an Arabic-only name", async () => {
    await add("cities", dongola)
    const second = await (await add("cities", dongola)).json()
    expect(second).toMatchObject({ id: "dongola-2", slug: "dongola-2" })
    const arabic = { ...dongola, name: { ar: "مدينة", en: "مدينة" } }
    expect(await (await add("cities", arabic)).json()).toMatchObject({
      id: "city",
    })
    expect(await (await add("cities", arabic)).json()).toMatchObject({
      id: "city-2",
    })
  })

  test("makes a make and a part category from the English name, and ignores a slug sent", async () => {
    const make = await add("makes", {
      name: { ar: "شيري", en: "Chery" },
      vehicleTypes: ["car"],
      slug: "ignored",
    })
    expect(await make.json()).toMatchObject({ id: "chery", slug: "chery" })
    const part = await add("part-categories", {
      name: { ar: "زجاج", en: "Glass" },
      slug: "ignored",
    })
    expect(await part.json()).toEqual({
      id: "glass",
      slug: "glass",
      name: { ar: "زجاج", en: "Glass" },
    })
  })

  test("gives a district and a model a random id under their parent", async () => {
    const district = await (
      await add("districts", { cityId: "khartoum", name: { ar: "ح", en: "H" } })
    ).json()
    expect(district).toMatchObject({ id: expect.stringMatching(/^dis-/) })
    const model = await (
      await add("models", { makeId: "toyota", name: { ar: "م", en: "M" } })
    ).json()
    expect(model).toMatchObject({ id: expect.stringMatching(/^mod-/) })
  })

  test("takes a country's id from its code, in lower case, and refuses one that is taken", async () => {
    const res = await add("countries", eritrea)
    expect(await res.json()).toEqual({
      id: "er",
      name: eritrea.name,
      dialCode: "+291",
      enabled: false,
    })
    const again = await add("countries", { ...eritrea, code: "sd" })
    expect(again.status).toBe(409)
    expect((await errorOf(again)).code).toBe("exists")
  })

  test("answers 422 for a bad body and for a parent that does not exist", async () => {
    const bad = await add("cities", { name: dongola.name })
    expect(bad.status).toBe(422)
    expect((await errorOf(bad)).fields).toMatchObject({
      countryId: "validation.required",
      center: "validation.required",
    })
    for (const [type, body, field] of [
      ["cities", { ...dongola, countryId: "zz" }, "countryId"],
      ["districts", { cityId: "zz", name: dongola.name }, "cityId"],
      ["models", { makeId: "zz", name: dongola.name }, "makeId"],
    ] as const) {
      const res = await add(type, body)
      expect(res.status).toBe(422)
      expect((await errorOf(res)).fields).toEqual({
        [field]: "validation.required",
      })
    }
    const country = await add("countries", { ...eritrea, dialCode: "291" })
    expect((await errorOf(country)).fields).toEqual({
      dialCode: "validation.dial_code",
    })
    const make = await add("makes", { name: dongola.name, vehicleTypes: [] })
    expect((await errorOf(make)).fields).toEqual({
      vehicleTypes: "validation.select_min",
    })
  })

  test("refuses to add a vehicle type (403 `forbidden`) whatever is sent", async () => {
    for (const body of [{}, { name: dongola.name, enabled: true }]) {
      const res = await add("vehicle-types", body)
      expect(res.status).toBe(403)
      expect((await errorOf(res)).code).toBe("forbidden")
    }
  })

  test("answers 404 for a list that is not managed here", async () => {
    expect((await add("nope", dongola)).status).toBe(404)
  })
})
