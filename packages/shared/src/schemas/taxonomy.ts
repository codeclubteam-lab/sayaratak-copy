import { z } from "zod"

import { bilingualSchema, geoSchema, idSchema } from "./fields"
import { vehicleTypeSchema } from "./listing"

// Admin can rename, disable and reorder the five vehicle types, so each row carries its name and an enabled flag.
export const taxonomySchema = z.object({
  cities: z.array(
    z.object({
      id: idSchema,
      slug: z.string(),
      countryId: idSchema,
      name: bilingualSchema,
      center: geoSchema,
    })
  ),
  districts: z.array(
    z.object({ id: idSchema, cityId: idSchema, name: bilingualSchema })
  ),
  makes: z.array(
    z.object({
      id: idSchema,
      slug: z.string(),
      name: bilingualSchema,
      // An uploaded brand mark; makes without one use the file in public/images/makes, then the initial.
      logoUrl: z.string().nullish(),
      vehicleTypes: z.array(vehicleTypeSchema),
    })
  ),
  models: z.array(
    z.object({ id: idSchema, makeId: idSchema, name: bilingualSchema })
  ),
  vehicleTypes: z.array(
    z.object({
      id: vehicleTypeSchema,
      name: bilingualSchema,
      enabled: z.boolean(),
    })
  ),
  partCategories: z.array(
    z.object({ id: idSchema, slug: z.string(), name: bilingualSchema })
  ),
  specializations: z.array(z.object({ id: idSchema, name: bilingualSchema })),
  serviceTemplates: z.array(z.object({ id: idSchema, name: bilingualSchema })),
})
export type Taxonomy = z.infer<typeof taxonomySchema>
