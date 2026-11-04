import {
  okSchema,
  taxonomyRowSchema,
  taxonomyTypeSchema,
} from "@sayaratak/shared/schemas/api"
import {
  taxonomyCreateSchemas,
  taxonomyPatchSchemas,
} from "@sayaratak/shared/schemas/taxonomy-inputs"
import { Hono } from "hono"
import { z } from "zod"

import { validate } from "~/shared/http/validate"
import { spec } from "~/shared/openapi/registry"
import { requireAdmin } from "~/modules/auth/auth.middleware"

import { addRow, changeRow, getRows, removeRow } from "./admin-taxonomy.service"

const ADMIN_ERRORS = ["unauthenticated", "banned", "forbidden"] as const

// The five vehicle types cannot be added: the route exists to answer 403 (the mock does too), so its body is not read.
const addSchemas = { ...taxonomyCreateSchemas, "vehicle-types": z.object({}) }

export const adminTaxonomyRoutes = new Hono()

adminTaxonomyRoutes.get(
  "/admin/taxonomy/:type",
  spec({
    summary:
      "Every entry of one list in list order, the ones of a turned-off country included. `type` is cities, districts, makes, models, vehicle-types, part-categories or countries; another is 404",
    access: "user",
    responses: { 200: z.array(taxonomyRowSchema) },
    errors: [...ADMIN_ERRORS, "not_found"],
  }),
  requireAdmin,
  async (c) => c.json(await getRows(c.req.param("type")))
)

adminTaxonomyRoutes.delete(
  "/admin/taxonomy/:type/:id",
  spec({
    summary:
      "Delete an entry nothing uses; 409 `in_use` while a listing, profile, account or child entry names it, 403 for a vehicle type",
    access: "user",
    responses: { 200: okSchema },
    errors: [...ADMIN_ERRORS, "not_found", "in_use"],
  }),
  requireAdmin,
  async (c) => {
    await removeRow(c.get("actor"), {
      type: c.req.param("type"),
      id: c.req.param("id"),
    })
    return c.json({ ok: true as const })
  }
)

// One add and one edit route per list, because each list takes its own body.
for (const type of taxonomyTypeSchema.options) {
  adminTaxonomyRoutes.post(
    `/admin/taxonomy/${type}`,
    spec({
      summary: `Add an entry to ${type}. A city, make or part category gets its slug, and its id, from the English name; a country takes its id from \`code\` (409 \`exists\` when taken). Vehicle types are fixed: 403`,
      access: "user",
      responses: { 200: taxonomyRowSchema },
      errors: [...ADMIN_ERRORS, "exists", "validation"],
    }),
    requireAdmin,
    validate.json(addSchemas[type]),
    async (c) =>
      c.json(await addRow(c.get("actor"), { type, input: c.req.valid("json") }))
  )

  adminTaxonomyRoutes.patch(
    `/admin/taxonomy/${type}/:id`,
    spec({
      summary: `Change the fields sent of an entry of ${type}; the slug and a country's code never change. Turning off the last shown vehicle type or country is 409 \`last_shown\``,
      access: "user",
      responses: { 200: taxonomyRowSchema },
      errors: [...ADMIN_ERRORS, "not_found", "last_shown", "validation"],
    }),
    requireAdmin,
    validate.json(taxonomyPatchSchemas[type]),
    async (c) =>
      c.json(
        await changeRow(c.get("actor"), {
          type,
          id: c.req.param("id"),
          input: c.req.valid("json"),
        })
      )
  )
}
