import type { FieldValues } from "react-hook-form"

import { extraDefaults } from "@sayaratak/shared/schemas/listing-fields"

// What the form holds before anyone typed. The details values are compared with these to tell whether that step was touched.
export const typeDefaults = {
  kind: "vehicle",
  vehicleType: null,
  intent: "sale",
  partCategoryId: null,
  compatibleTypes: [],
} satisfies FieldValues

export const detailsDefaults = {
  title: "",
  description: "",
  price: null,
  negotiable: false,
  rentPeriod: null,
  condition: "used",
  makeId: null,
  modelId: null,
  makeOther: null,
  modelOther: null,
  year: null,
  mileageKm: null,
  fuel: null,
  transmission: null,
  color: null,
  engineCc: null,
  payloadTons: null,
  partNumber: "",
  ...extraDefaults,
} satisfies FieldValues

export const photosDefaults = { media: [] } satisfies FieldValues

export const contactDefaults = {
  cityId: "",
  districtId: "",
  location: null,
  phone: "",
  whatsapp: null,
  showPhone: true,
  methods: ["call", "whatsapp", "chat"],
} satisfies FieldValues

export const wizardDefaults: FieldValues = {
  ...typeDefaults,
  ...detailsDefaults,
  ...photosDefaults,
  ...contactDefaults,
}
