import { mapResponseSchema } from "@sayaratak/shared/schemas/responses"
import { arrayKeys, searchParamsSchema } from "@sayaratak/shared/search/schemas"
import { Hono } from "hono"

import { validate } from "~/shared/http/validate"
import { spec } from "~/shared/openapi/registry"

import { getMap } from "./map.service"

export const mapRoutes = new Hono()

mapRoutes.get(
  "/map",
  spec({
    summary:
      "Map points inside `bbox` (west,south,east,north) for the asked `layers` (vehicles, dealerships, workshops, mechanics); vehicles take the search filters; 300 at most",
    access: "public",
    responses: { 200: mapResponseSchema },
  }),
  validate.query(searchParamsSchema, arrayKeys),
  async (c) => {
    const map = await getMap({
      viewer: c.get("viewer"),
      params: c.req.valid("query"),
      layers: c.req.queries("layers") ?? [],
      bbox: c.req.query("bbox"),
    })
    return c.json(map)
  }
)
