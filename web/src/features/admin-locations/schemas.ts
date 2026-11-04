import { z } from "zod"

import {
  latSchema,
  lngSchema,
  requiredText,
} from "@sayaratak/shared/schemas/fields"

// The code is given once, on create; Edit shows it read-only because cities point to it.
export const countrySchema = z.object({
  code: z
    .string()
    .trim()
    .regex(/^[a-zA-Z]{2}$/, "validation.country_code")
    .toUpperCase(),
  nameAr: requiredText(60),
  nameEn: requiredText(60),
  dialCode: z
    .string()
    .trim()
    .regex(/^\+\d{1,4}$/, "validation.dial_code"),
  enabled: z.boolean(),
})
export type CountryForm = z.infer<typeof countrySchema>

export const citySchema = z.object({
  countryId: z.string().min(1, "validation.required"),
  nameAr: requiredText(60),
  nameEn: requiredText(60),
  lat: latSchema,
  lng: lngSchema,
})
export type CityForm = z.infer<typeof citySchema>

export const districtSchema = z.object({
  cityId: z.string().min(1, "validation.required"),
  nameAr: requiredText(60),
  nameEn: requiredText(60),
})
export type DistrictForm = z.infer<typeof districtSchema>
