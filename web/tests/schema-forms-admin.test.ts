import { expect, it } from "vitest"

import { restoreConfirmSchema } from "@/features/admin-backups/schemas"
import {
  broadcastFormDefaults,
  broadcastFormSchema,
  toBroadcastInput,
} from "@/features/admin-broadcasts/schemas"
import { categoryFormSchema } from "@/features/admin-categories/schemas"
import {
  citySchema,
  countrySchema,
  districtSchema,
} from "@/features/admin-locations/schemas"
import { makeSchema, modelSchema } from "@/features/admin-makes/schemas"
import {
  individualSettingsSchema,
  planFormSchema,
} from "@/features/admin-plans/schemas"
import { promotionPriceFormSchema } from "@/features/admin-promotions/schemas"
import {
  contactSettingsSchema,
  listingSettingsSchema,
  paymentSettingsSchema,
} from "@/features/admin-settings/schemas"
import { broadcastInputSchema } from "@sayaratak/shared/schemas/inputs"
import { runCases } from "./schema-case"

const names = { nameAr: "سيارات", nameEn: "Cars" }
const plan = {
  audience: "dealership",
  ...names,
  price: 0,
  durationDays: 30,
  listingLimit: 20,
  featuredCredits: 0,
  serviceLimit: null,
  photoLimit: null,
  portfolioLimit: null,
  features: [],
  enabled: true,
  sortOrder: 0,
}
const broadcast = {
  ...broadcastFormDefaults,
  titleAr: "تحديث",
  titleEn: "Update",
  bodyAr: "نص",
  bodyEn: "Text",
}
const phone = "+249912345678"

runCases([
  {
    name: "restoreConfirmSchema",
    schema: restoreConfirmSchema("RESTORE"),
    valid: [{ phrase: " RESTORE " }],
    bad: [["wrong word", { phrase: "restore" }, "validation.restore_phrase"]],
  },
  {
    name: "categoryFormSchema",
    schema: categoryFormSchema,
    valid: [names],
    bad: [
      ["no Arabic name", { ...names, nameAr: "" }, "validation.required"],
      [
        "long English name",
        { ...names, nameEn: "a".repeat(41) },
        "validation.too_long",
      ],
    ],
  },
  {
    name: "promotionPriceFormSchema",
    schema: promotionPriceFormSchema,
    valid: [{ durationDays: 7, price: 0 }],
    bad: [
      ["no days", { durationDays: null, price: 0 }, "validation.required"],
      ["over 90 days", { durationDays: 91, price: 0 }, "validation.too_large"],
      ["negative price", { durationDays: 7, price: -1 }, "validation.number"],
    ],
  },
  {
    name: "makeSchema",
    schema: makeSchema,
    valid: [{ ...names, logoUrl: "", vehicleTypes: ["car"] }],
    bad: [
      [
        "no vehicle type",
        { ...names, logoUrl: "", vehicleTypes: [] },
        "validation.select_min",
      ],
      [
        "no name",
        { ...names, nameEn: " ", logoUrl: "", vehicleTypes: ["car"] },
        "validation.required",
      ],
    ],
  },
  {
    name: "modelSchema",
    schema: modelSchema,
    valid: [names],
    bad: [["no name", { ...names, nameAr: "" }, "validation.required"]],
  },
  {
    name: "countrySchema",
    schema: countrySchema,
    valid: [{ code: "sd", ...names, dialCode: "+249", enabled: true }],
    bad: [
      [
        "three letters",
        { code: "SDN", ...names, dialCode: "+249", enabled: true },
        "validation.country_code",
      ],
      [
        "no plus",
        { code: "SD", ...names, dialCode: "249", enabled: true },
        "validation.dial_code",
      ],
    ],
  },
  {
    name: "citySchema",
    schema: citySchema,
    valid: [{ countryId: "sd", ...names, lat: 15.5, lng: 32.5 }],
    bad: [
      [
        "no country",
        { countryId: "", ...names, lat: 15.5, lng: 32.5 },
        "validation.required",
      ],
      [
        "no center",
        { countryId: "sd", ...names, lat: null, lng: 32.5 },
        "validation.required",
      ],
      [
        "lat out of range",
        { countryId: "sd", ...names, lat: 95, lng: 32.5 },
        "validation.number",
      ],
    ],
  },
  {
    name: "districtSchema",
    schema: districtSchema,
    valid: [{ cityId: "khartoum", ...names }],
    bad: [["no city", { cityId: "", ...names }, "validation.required"]],
  },
  {
    name: "listingSettingsSchema",
    schema: listingSettingsSchema,
    valid: [{ autoApproveVerifiedDealers: true, listingExpiryDays: 60 }],
    bad: [
      [
        "six days",
        { autoApproveVerifiedDealers: true, listingExpiryDays: 6 },
        "validation.number",
      ],
      [
        "over 180",
        { autoApproveVerifiedDealers: true, listingExpiryDays: 181 },
        "validation.too_large",
      ],
    ],
  },
  {
    name: "paymentSettingsSchema",
    schema: paymentSettingsSchema,
    valid: [{ bankakAccountName: "Sayaratak", bankakAccountNumber: "123456" }],
    bad: [
      [
        "no name",
        { bankakAccountName: "", bankakAccountNumber: "123456" },
        "validation.required",
      ],
      [
        "letters",
        { bankakAccountName: "S", bankakAccountNumber: "12ab56" },
        "validation.account_number",
      ],
      [
        "five digits",
        { bankakAccountName: "S", bankakAccountNumber: "12345" },
        "validation.account_number",
      ],
    ],
  },
  {
    name: "contactSettingsSchema",
    schema: contactSettingsSchema,
    valid: [{ phone, whatsapp: "", email: "a@b.co", address: "" }],
    bad: [
      [
        "bad phone",
        { phone: "0912", whatsapp: "", email: "a@b.co" },
        "validation.phone",
      ],
      ["bad email", { phone, whatsapp: phone, email: "a" }, "validation.email"],
      [
        "long address",
        { phone, whatsapp: "", email: "a@b.co", address: "a".repeat(201) },
        "validation.too_long",
      ],
    ],
  },
  {
    name: "individualSettingsSchema",
    schema: individualSettingsSchema,
    valid: [{ individualSubscriptionsEnabled: false, freeListingLimit: 0 }],
    bad: [
      [
        "over 100",
        { individualSubscriptionsEnabled: false, freeListingLimit: 101 },
        "validation.too_large",
      ],
    ],
  },
  {
    name: "planFormSchema",
    schema: planFormSchema,
    valid: [plan, { ...plan, audience: "workshop", listingLimit: null }],
    bad: [
      ["no price", { ...plan, price: null }, "validation.required"],
      [
        "dealer with no listing limit",
        { ...plan, listingLimit: null },
        "validation.required",
      ],
      [
        "over two years",
        { ...plan, durationDays: 731 },
        "validation.too_large",
      ],
      [
        "blank feature",
        { ...plan, features: [{ ar: "", en: "x" }] },
        "validation.required",
      ],
      [
        "nine features",
        { ...plan, features: Array(9).fill({ ar: "x", en: "x" }) },
      ],
    ],
  },
  {
    name: "broadcastFormSchema",
    schema: broadcastFormSchema,
    valid: [broadcast],
    bad: [
      ["no roles", { ...broadcast, roles: [] }, "validation.select_min"],
      ["no title", { ...broadcast, titleEn: "" }, "validation.required"],
      [
        "outside link",
        { ...broadcast, href: "https://x.co" },
        "validation.path",
      ],
    ],
  },
])

it("toBroadcastInput nests the languages and drops empty optionals", () => {
  const input = toBroadcastInput(broadcast)
  expect(input).toMatchObject({
    title: { ar: "تحديث", en: "Update" },
    cityId: undefined,
    href: undefined,
  })
  expect(broadcastInputSchema.safeParse(input).success).toBe(true)
  expect(
    toBroadcastInput({ ...broadcast, cityId: "khartoum", href: "/ar" })
  ).toMatchObject({ cityId: "khartoum", href: "/ar" })
})
it("countrySchema upper-cases the code", () => {
  expect(
    countrySchema.parse({
      code: "sd",
      ...names,
      dialCode: "+249",
      enabled: true,
    }).code
  ).toBe("SD")
})
