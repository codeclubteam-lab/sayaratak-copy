import { z } from "zod"

import { bilingualSchema, geoSchema } from "./fields"
import { vehicleTypeSchema } from "./listing"

// What an admin sends to add or change a row of each managed list. A slug (and the id that
// carries it) is made once on create from the English name, so no create schema takes one.
const name = bilingualSchema

export const taxonomyCreateSchemas = {
  cities: z.object({
    countryId: z.string().min(1),
    name,
    center: geoSchema,
  }),
  districts: z.object({ cityId: z.string().min(1), name }),
  makes: z.object({
    name,
    logoUrl: z.string().nullable().optional(),
    vehicleTypes: z.array(vehicleTypeSchema).min(1, "validation.select_min"),
  }),
  models: z.object({ makeId: z.string().min(1), name }),
  "part-categories": z.object({ name }),
  // The id is the lowercase two-letter code, given once on create.
  countries: z.object({
    code: z
      .string()
      .regex(/^[a-zA-Z]{2}$/, "validation.country_code")
      .transform((value) => value.toLowerCase()),
    name,
    dialCode: z.string().regex(/^\+\d{1,4}$/, "validation.dial_code"),
    enabled: z.boolean(),
  }),
} as const

// An edit sends any of the fields a row has, except what was fixed on create: the slug, the
// country code. Fields left out stay. The five vehicle types are fixed: admin renames and
// hides them, never adds or deletes.
export const taxonomyPatchSchemas = {
  cities: taxonomyCreateSchemas.cities.partial(),
  districts: taxonomyCreateSchemas.districts.partial(),
  makes: taxonomyCreateSchemas.makes.partial(),
  models: taxonomyCreateSchemas.models.partial(),
  "part-categories": taxonomyCreateSchemas["part-categories"].partial(),
  countries: taxonomyCreateSchemas.countries.omit({ code: true }).partial(),
  "vehicle-types": z.object({ name, enabled: z.boolean() }).partial(),
} as const
