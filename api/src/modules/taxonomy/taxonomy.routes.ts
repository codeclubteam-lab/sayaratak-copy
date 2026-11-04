import { taxonomySchema } from "@sayaratak/shared/schemas/taxonomy"
import { Hono } from "hono"

import { publicCache } from "~/shared/http/cache"
import { spec } from "~/shared/openapi/registry"

import { getTaxonomy } from "./taxonomy.service"

export const taxonomyRoutes = new Hono()

taxonomyRoutes.get(
  "/taxonomy",
  spec({
    summary:
      "Cities, districts, makes, models, vehicle types, part categories, mechanic skills and service names",
    access: "public",
    responses: { 200: taxonomySchema },
  }),
  publicCache,
  async (c) => {
    const taxonomy = await getTaxonomy()
    return c.json(taxonomy)
  }
)
