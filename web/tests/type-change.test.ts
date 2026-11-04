import { describe, expect, it } from "vitest"

import type { Taxonomy } from "@sayaratak/shared/schemas/taxonomy"
import { typeStepSchema } from "@sayaratak/shared/listings/schemas"
import {
  applyTile,
  detailsTouched,
  tileOf,
} from "@/features/listings/wizard/type-change"
import {
  detailsDefaults,
  typeDefaults,
  wizardDefaults,
} from "@/features/listings/wizard/wizard-defaults"

const makes: Taxonomy["makes"] = [
  {
    id: "toyota",
    slug: "toyota",
    name: { en: "Toyota", ar: "تويوتا" },
    vehicleTypes: ["car", "truck"],
  },
  {
    id: "honda",
    slug: "honda",
    name: { en: "Honda", ar: "هوندا" },
    vehicleTypes: ["car", "motorcycle"],
  },
]
const filled = {
  ...wizardDefaults,
  vehicleType: "car",
  title: "Toyota Corolla 2018",
  description: "Clean car, one owner, full service history.",
  price: 12_000_000,
  negotiable: true,
  media: [{ id: "m1" }],
  makeId: "toyota",
  modelId: "corolla",
  year: 2018,
  mileageKm: 90_000,
  fuel: "petrol",
  transmission: "automatic",
  color: "white",
}

describe("typeStepSchema", () => {
  const parse = (v: object) =>
    typeStepSchema.safeParse({ ...typeDefaults, ...v })
  const paths = (v: object) =>
    parse(v).error?.issues.map((i) => `${i.path.join(".")}:${i.message}`)
  it("a vehicle needs a type", () => {
    expect(paths({})).toEqual(["vehicleType:validation.required"])
    expect(parse({ vehicleType: "truck", intent: "rent" }).success).toBe(true)
  })
  it("a part needs a category and a compatible type", () => {
    expect(paths({ kind: "part", intent: "sale" })).toEqual([
      "partCategoryId:validation.required",
      "compatibleTypes:validation.select_min",
    ])
    expect(
      parse({
        kind: "part",
        partCategoryId: "brakes",
        compatibleTypes: ["car"],
      }).success
    ).toBe(true)
  })
})

describe("applyTile", () => {
  it("keeps title, description, price and photos and clears fields that do not apply", () => {
    const next = applyTile(filled, "motorcycle", makes)
    expect(next).toMatchObject({
      kind: "vehicle",
      vehicleType: "motorcycle",
      title: filled.title,
      description: filled.description,
      price: filled.price,
      negotiable: true,
      media: filled.media,
      year: 2018,
      mileageKm: 90_000,
      fuel: "petrol",
      transmission: null,
    })
    // Toyota does not come as a motorcycle, so make and model go.
    expect(next).toMatchObject({ makeId: null, modelId: null })
  })
  it("keeps make and model when the make comes in the new type", () => {
    const next = applyTile(filled, "truck", makes)
    expect(next).toMatchObject({
      makeId: "toyota",
      modelId: "corolla",
      transmission: "automatic",
    })
  })
  it("a part is for sale, has no vehicle type and loses the vehicle-only fields", () => {
    const rent = { ...filled, intent: "rent", rentPeriod: "day" }
    const next = applyTile(rent, "part", makes)
    expect(next).toMatchObject({
      kind: "part",
      vehicleType: null,
      intent: "sale",
      rentPeriod: null,
      year: null,
      mileageKm: null,
      fuel: null,
      color: null,
      transmission: null,
      makeId: "toyota",
      title: filled.title,
      price: filled.price,
    })
  })
  it("clears the part fields when a vehicle tile follows a part", () => {
    const part = {
      ...wizardDefaults,
      kind: "part",
      partCategoryId: "brakes",
      compatibleTypes: ["car"],
      partNumber: "X-1",
    }
    const next = applyTile(part, "car", makes)
    expect(next).toMatchObject({
      kind: "vehicle",
      partCategoryId: null,
      compatibleTypes: [],
      partNumber: "",
    })
  })
  it("tileOf reads the tile back", () => {
    expect(tileOf(typeDefaults)).toBeNull()
    expect(tileOf({ kind: "part", vehicleType: null })).toBe("part")
    expect(tileOf({ kind: "vehicle", vehicleType: "truck" })).toBe("truck")
  })
})

describe("detailsTouched", () => {
  it("is false for defaults, empty strings and nulls, true for any real value", () => {
    expect(detailsTouched(wizardDefaults)).toBe(false)
    expect(
      detailsTouched({
        ...wizardDefaults,
        partNumber: undefined,
        rentPeriod: undefined,
      })
    ).toBe(false)
    expect(detailsTouched({ ...wizardDefaults, title: "x" })).toBe(true)
    expect(detailsTouched({ ...wizardDefaults, condition: "new" })).toBe(true)
    expect(detailsTouched({ ...typeDefaults, ...detailsDefaults })).toBe(false)
  })
})
