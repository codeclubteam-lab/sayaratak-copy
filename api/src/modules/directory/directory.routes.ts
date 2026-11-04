import { pageOf } from "@sayaratak/shared/schemas/fields"
import {
  dealershipSchema,
  mechanicSchema,
  workshopSchema,
} from "@sayaratak/shared/schemas/profile"
import { Hono } from "hono"

import { spec } from "~/shared/openapi/registry"

import {
  getDealership,
  getMechanic,
  getWorkshop,
  listDealerships,
  listMechanics,
  listWorkshops,
} from "./directory.service"

export const directoryRoutes = new Hono()

directoryRoutes.get(
  "/dealerships",
  spec({
    summary:
      "Dealerships: `q`, `city`, `verified`, `sort` (rating, listings, newest), `page`, `pageSize` or `limit`",
    access: "public",
    responses: { 200: pageOf(dealershipSchema) },
  }),
  async (c) => c.json(await listDealerships(c.req.query()))
)

directoryRoutes.get(
  "/dealerships/:slug",
  spec({
    summary:
      "One dealership by slug; `unavailable` while its owner is banned, 404 when suspended",
    access: "public",
    responses: { 200: dealershipSchema },
    errors: ["not_found"],
  }),
  async (c) => c.json(await getDealership(c.req.param("slug")))
)

directoryRoutes.get(
  "/workshops",
  spec({
    summary:
      "Workshops: `q`, `city`, `service` (template id), `verified`, `openNow`, `lat` and `lng` with `sort=nearest`, `sort` (rating, newest, nearest), `page`, `pageSize` or `limit`",
    access: "public",
    responses: { 200: pageOf(workshopSchema) },
  }),
  async (c) => c.json(await listWorkshops(c.req.query()))
)

directoryRoutes.get(
  "/workshops/:slug",
  spec({
    summary:
      "One workshop by slug; `unavailable` while its owner is banned, 404 when suspended",
    access: "public",
    responses: { 200: workshopSchema },
    errors: ["not_found"],
  }),
  async (c) => c.json(await getWorkshop(c.req.param("slug")))
)

directoryRoutes.get(
  "/mechanics",
  spec({
    summary:
      "Mechanics, paid plans first: `q`, `city` (served), `specialization`, `minYears`, `verified`, `available`, `sort` (rating, experience, newest), `page`, `pageSize` or `limit`",
    access: "public",
    responses: { 200: pageOf(mechanicSchema) },
  }),
  async (c) => c.json(await listMechanics(c.req.query()))
)

directoryRoutes.get(
  "/mechanics/:slug",
  spec({
    summary:
      "One mechanic by slug; `unavailable` while its owner is banned, 404 when suspended",
    access: "public",
    responses: { 200: mechanicSchema },
    errors: ["not_found"],
  }),
  async (c) => c.json(await getMechanic(c.req.param("slug")))
)
