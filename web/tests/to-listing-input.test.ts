// @vitest-environment node
import { describe, expect, it } from "vitest"

import { listingInputSchema } from "@sayaratak/shared/listings/schemas"
import {
  listingToValues,
  toFlatInput,
  toListingInput,
} from "@/features/listings/wizard/to-listing-input"
import { wizardDefaults } from "@/features/listings/wizard/wizard-defaults"
import { db, resetDb } from "@/mocks/db"
import { listingSchema } from "@sayaratak/shared/schemas/listing"

const photo = (id: string) => ({
  id,
  type: "image" as const,
  url: `/mock/${id}-{w}.webp`,
  width: 1280,
  height: 853,
  placeholderColor: "#b8c4c0",
  posterUrl: null,
})
const car = {
  ...wizardDefaults,
  kind: "vehicle",
  vehicleType: "car",
  title: "Toyota Corolla 2018",
  description: "  Clean car, one owner, full service history.  ",
  price: 12_000_000,
  makeId: "toyota",
  modelId: "toyota-corolla",
  year: 2018,
  fuel: "petrol",
  transmission: "automatic",
  mileageKm: 90_000,
  media: [..."abc"].map(photo),
  cityId: "khartoum",
  districtId: "khartoum-riyadh",
  phone: "+249912345678",
  methods: ["call", "chat"],
}

describe("toListingInput", () => {
  it("sends every field of the wizard, in the shape the mock validates", () => {
    const flat = toFlatInput(car)
    expect(Object.keys(flat).sort()).toEqual(
      Object.keys(listingInputSchema.shape).sort()
    )
    expect(Object.keys(flat).sort()).toEqual(Object.keys(wizardDefaults).sort())
    const body = toListingInput(car)
    expect(body.submit).toBe(true)
    expect(body.contact).toEqual({
      phone: "+249912345678",
      whatsapp: null,
      showPhone: true,
      methods: ["call", "chat"],
    })
    expect(toListingInput(car, false).submit).toBe(false)
  })

  it("trims text, sends empty text as null and empty lists as []", () => {
    const body = toListingInput({ ...car, trim: "  ", partNumber: "" })
    expect(body.description).toBe("Clean car, one owner, full service history.")
    expect(body.trim).toBeNull()
    expect(body.partNumber).toBeNull()
    expect(body.features).toEqual([])
    expect(body.compatibleMakeIds).toEqual([])
  })

  it("sends null for a field that does not apply to the type, intent or condition", () => {
    const body = toListingInput({
      ...car,
      strokes: 4, // motorcycle only
      partBrand: "Bosch", // spare parts only
      deposit: 500_000, // rent only
      condition: "new",
      mileageKm: 10, // used only
      warranty: "none",
      warrantyMonths: 12,
    })
    expect(body.strokes).toBeNull()
    expect(body.partBrand).toBeNull()
    expect(body.deposit).toBeNull()
    expect(body.mileageKm).toBeNull()
    expect(body.warrantyMonths).toBeNull()
    expect(body.rentPeriod).toBeNull()
  })

  it("keeps a rent listing's terms and a part's own fields", () => {
    const rent = toListingInput({
      ...car,
      intent: "rent",
      rentPeriod: "day",
      deposit: 500_000,
    })
    expect(rent.rentPeriod).toBe("day")
    expect(rent.deposit).toBe(500_000)
    const part = toListingInput({
      ...car,
      kind: "part",
      vehicleType: null,
      partCategoryId: "brakes",
      compatibleTypes: ["car"],
      partNumber: " 04465-02220 ",
      partBrand: "Toyota",
      year: 2018,
    })
    expect(part.partNumber).toBe("04465-02220")
    expect(part.partBrand).toBe("Toyota")
    expect(part.year).toBeNull()
    expect(part.vehicleType).toBeNull()
  })
})

describe("listingToValues", () => {
  it("fills every field of the wizard from a listing, in the reader's language", () => {
    resetDb()
    const listing = listingSchema.parse(
      db.listings.find((l) => l.kind === "vehicle")
    )
    const values = listingToValues(listing, "ar")
    expect(Object.keys(values).sort()).toEqual(
      Object.keys(wizardDefaults).sort()
    )
    expect(values.title).toBe(listing.title)
    expect(values.description).toBe(listing.description.ar)
    expect(values.phone).toBe(listing.contact.phone)
    expect(values.methods).toEqual(listing.contact.methods)
    expect(values.districtId).toBe(listing.districtId ?? "")
    expect(values.partNumber).toBe("")
  })
})
