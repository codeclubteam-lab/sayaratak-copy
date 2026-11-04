import { expect, it } from "vitest"

import { overviewSearchSchema } from "@/features/account-overview/schemas"
import { checkoutSearchSchema } from "@/features/billing/schemas"
import {
  brandingSchema,
  contactBody,
  contactSchema,
  expertiseBody,
  expertiseSchema,
  hoursSchema,
  locationSchema,
  mechanicAboutSectionSchema,
  workshopContactBody,
  workshopContactSchema,
} from "@/features/business-profile/schemas"
import {
  detailsBaseSchema,
  promotionChoiceSchema,
  reviewProfileSchema,
} from "@sayaratak/shared/listings/schemas"
import { mapFilterSchema } from "@/features/map/schemas"
import { portfolioFormSchema } from "@/features/mechanic-portfolio/schemas"
import {
  onboardingDraftKey,
  planStepSchema,
  roleChoiceSchema,
  serviceRowSchema,
  workshopBusinessSchema,
} from "@/features/onboarding/schemas"
import { partsRouteSchema } from "@sayaratak/shared/search/schemas"
import { serviceFormSchema } from "@/features/workshop-services/schemas"
import { extraDefaults } from "@sayaratak/shared/schemas/listing-fields"
import { runCases } from "./schema-case"

const phone = "+249912345678"
const bi = (s: string) => ({ ar: s, en: s })
const bio = "Twenty years on diesel engines."
const week = Array.from({ length: 7 }, (_, day) => ({
  day,
  closed: false,
  open: "08:00",
  close: "18:00",
}))
const place = {
  cityId: "khartoum",
  districtId: "khartoum-riyadh",
  address: "Street 15",
  location: null,
}
const about = {
  photoUrl: "",
  name: bi("Omar Hassan"),
  yearsOfExperience: 20,
  bio: bi(bio),
}
const details = {
  ...extraDefaults,
  title: "Toyota Hilux 2019 clean",
  description: "One owner, full service history.",
  price: 4_500_000,
  negotiable: false,
  rentPeriod: null,
  condition: "used",
  makeId: "toyota",
  modelId: "toyota-hilux",
  makeOther: null,
  modelOther: null,
  year: 2019,
  mileageKm: 90_000,
  fuel: "diesel",
  transmission: "manual",
  color: null,
  engineCc: null,
  payloadTons: null,
}

runCases([
  {
    name: "brandingSchema",
    schema: brandingSchema,
    valid: [{ logoUrl: "", coverUrl: "/c.webp" }],
    bad: [["no cover key", { logoUrl: "" }]],
  },
  {
    name: "contactSchema",
    schema: contactSchema,
    valid: [{ phones: [{ value: phone }], whatsapp: "" }],
    bad: [
      ["no phone", { phones: [], whatsapp: "" }, "validation.phone_min"],
      [
        "four phones",
        { phones: Array(4).fill({ value: phone }), whatsapp: "" },
      ],
      [
        "bad whatsapp",
        { phones: [{ value: phone }], whatsapp: "0912" },
        "validation.phone",
      ],
    ],
  },
  {
    name: "workshopContactSchema",
    schema: workshopContactSchema,
    valid: [{ phone, whatsapp: phone }],
    bad: [["bad phone", { phone: "1", whatsapp: "" }, "validation.phone"]],
  },
  {
    name: "locationSchema",
    schema: locationSchema,
    valid: [place, { ...place, location: { lat: 15.5, lng: 32.5 } }],
    bad: [
      ["no district", { ...place, districtId: "" }, "validation.required"],
      ["no address", { ...place, address: " " }, "validation.required"],
    ],
  },
  {
    name: "hoursSchema",
    schema: hoursSchema,
    valid: [{ hours: week }],
    bad: [
      [
        "reversed",
        { hours: [{ ...week[0], open: "19:00" }, ...week.slice(1)] },
        "validation.hours_order",
      ],
    ],
  },
  {
    name: "mechanicAboutSectionSchema",
    schema: mechanicAboutSectionSchema,
    valid: [about],
    bad: [
      [
        "short name",
        { ...about, name: { ar: "ع", en: "Omar" } },
        "validation.name_min",
      ],
      [
        "over 60 years",
        { ...about, yearsOfExperience: 61 },
        "validation.too_large",
      ],
      ["short bio", { ...about, bio: bi("Short") }, "validation.desc_min"],
    ],
  },
  {
    name: "expertiseSchema",
    schema: expertiseSchema,
    valid: [
      { specializationIds: ["engine"], cityId: "khartoum", servedCityIds: [] },
    ],
    bad: [
      [
        "no skill",
        { specializationIds: [], cityId: "khartoum", servedCityIds: [] },
        "validation.select_min",
      ],
      [
        "no city",
        { specializationIds: ["engine"], cityId: "", servedCityIds: [] },
        "validation.required",
      ],
      [
        "six cities",
        {
          specializationIds: ["engine"],
          cityId: "k",
          servedCityIds: Array(6).fill("c"),
        },
      ],
    ],
  },
  {
    name: "detailsBaseSchema",
    schema: detailsBaseSchema,
    valid: [details],
    bad: [
      ["short title", { ...details, title: "Hilux" }, "validation.title_min"],
      [
        "long title",
        { ...details, title: "a".repeat(91) },
        "validation.too_long",
      ],
      [
        "short description",
        { ...details, description: "Nice car" },
        "validation.desc_min",
      ],
      ["no price", { ...details, price: null }, "validation.required"],
      [
        "long make name",
        { ...details, makeOther: "a".repeat(41) },
        "validation.too_long",
      ],
      ["tiny engine", { ...details, engineCc: 10 }, "validation.number"],
      [
        "heavy payload",
        { ...details, payloadTons: 101 },
        "validation.too_large",
      ],
    ],
  },
  {
    name: "reviewProfileSchema",
    schema: reviewProfileSchema,
    valid: [{ profileName: "Omar", profileCityId: "khartoum" }],
    bad: [
      [
        "no city",
        { profileName: "Omar", profileCityId: "" },
        "validation.required",
      ],
    ],
  },
  {
    name: "promotionChoiceSchema",
    schema: promotionChoiceSchema,
    valid: [{ promotion: "featured-7" }],
    bad: [["nothing chosen", {}, "post.promo_required"]],
  },
  {
    name: "portfolioFormSchema",
    schema: portfolioFormSchema,
    valid: [{ imageId: "up-1", caption: "Gearbox" }],
    bad: [
      ["no photo", { imageId: "", caption: "Gearbox" }, "validation.required"],
      [
        "long caption",
        { imageId: "up-1", caption: "a".repeat(121) },
        "validation.too_long",
      ],
    ],
  },
  {
    name: "serviceFormSchema",
    schema: serviceFormSchema,
    valid: [
      {
        name: "Oil change",
        description: "",
        priceFrom: null,
        templateId: null,
      },
    ],
    bad: [
      [
        "long name",
        { name: "a".repeat(61), priceFrom: null, templateId: null },
        "validation.too_long",
      ],
      [
        "zero price",
        { name: "Oil", priceFrom: 0, templateId: null },
        "validation.price_min",
      ],
    ],
  },
  {
    name: "roleChoiceSchema",
    schema: roleChoiceSchema,
    valid: [{ role: "mechanic" }],
    bad: [["admin", { role: "admin" }]],
  },
  {
    name: "workshopBusinessSchema",
    schema: workshopBusinessSchema,
    valid: [
      { name: "Nile Garage", description: "Full service garage in Riyadh." },
    ],
    bad: [
      [
        "no name",
        { name: "", description: "Full service garage in Riyadh." },
        "validation.required",
      ],
      [
        "long description",
        { name: "N", description: "a".repeat(1001) },
        "validation.too_long",
      ],
    ],
  },
  {
    name: "serviceRowSchema",
    schema: serviceRowSchema,
    valid: [{ name: "Brakes", priceFrom: 5000, templateId: "brakes" }],
    bad: [
      [
        "no name",
        { name: "", priceFrom: null, templateId: null },
        "validation.required",
      ],
    ],
  },
  {
    name: "planStepSchema",
    schema: planStepSchema,
    valid: [{ planId: "p1" }],
    bad: [["no plan", { planId: "" }, "validation.required"]],
  },
])

it("section bodies turn form values into the PATCH /me/business shape", () => {
  expect(contactBody({ phones: [{ value: phone }], whatsapp: "" })).toEqual({
    phones: [phone],
    whatsapp: null,
  })
  expect(workshopContactBody({ phone, whatsapp: phone })).toEqual({
    phone,
    whatsapp: phone,
  })
  expect(
    expertiseBody({
      specializationIds: ["e"],
      cityId: "k",
      servedCityIds: ["o"],
    }).servedCityIds
  ).toEqual(["k", "o"])
})

it("URL schemas drop bad values", () => {
  expect(overviewSearchSchema.parse({ welcome: "1" })).toEqual({ welcome: 1 })
  expect(overviewSearchSchema.parse({ welcome: "x" })).toEqual({
    welcome: undefined,
  })
  expect(checkoutSearchSchema.parse({})).toEqual({ item: "" })
  expect(checkoutSearchSchema.parse({ item: "a".repeat(81) })).toEqual({
    item: "",
  })
  expect(mapFilterSchema.parse({ layers: ["dealerships"], lat: "15" })).toEqual(
    { layers: ["dealerships"] }
  )
  expect(mapFilterSchema.parse({ layers: ["boats"] }).layers).toBeUndefined()
  expect(partsRouteSchema.parse({ kind: "part", page: "2" })).toEqual({
    page: 2,
  })
})

it("onboarding drafts are kept per role", () => {
  expect(onboardingDraftKey("workshop")).toBe("onboarding:workshop")
})
