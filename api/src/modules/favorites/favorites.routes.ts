import { okSchema } from "@sayaratak/shared/schemas/api"
import {
  favoriteInputSchema,
  favoriteSortSchema,
} from "@sayaratak/shared/schemas/inputs"
import {
  favoritePageSchema,
  typeFilterSchema,
} from "@sayaratak/shared/schemas/listing"
import { Hono } from "hono"
import { z } from "zod"

import { pageParams } from "~/shared/http/page"
import { validate } from "~/shared/http/validate"
import { spec } from "~/shared/openapi/registry"
import { requireUser } from "~/modules/auth/auth.middleware"

import {
  addFavorite,
  getFavoriteIds,
  listFavorites,
  removeFavorites,
} from "./favorites.service"

export const favoritesRoutes = new Hono()

const idsSchema = z.object({ ids: z.array(z.string()) })
// A bad `type` or `sort` is not an error: no filter, newest saved first.
const listQuerySchema = z.object({
  type: typeFilterSchema.optional().catch(undefined),
  sort: favoriteSortSchema.catch("recent"),
})
const PAGE_SIZE = { default: 24, max: 100 }
const USER_ERRORS = ["unauthenticated", "banned"] as const

favoritesRoutes.get(
  "/me/favorite-ids",
  spec({
    summary:
      "The ids of the saved listings, so every card can draw its heart; empty when signed out",
    access: "public",
    responses: { 200: idsSchema },
  }),
  async (c) => c.json({ ids: await getFavoriteIds(c.get("viewer")) })
)

favoritesRoutes.get(
  "/favorites",
  spec({
    summary:
      "The saved listings (`sort` recent, price_asc, price_desc; `type` a vehicle type or part; `page`, `pageSize`). One nobody can open any more comes back with `unavailable`",
    access: "user",
    responses: { 200: favoritePageSchema },
    errors: [...USER_ERRORS],
  }),
  requireUser,
  validate.query(listQuerySchema),
  async (c) =>
    c.json(
      await listFavorites(c.get("user"), {
        ...c.req.valid("query"),
        ...pageParams(c.req.query(), PAGE_SIZE),
      })
    )
)

favoritesRoutes.post(
  "/favorites",
  spec({
    summary:
      "Save a listing; saving twice changes nothing, an unknown id is 404",
    access: "user",
    responses: { 200: okSchema },
    errors: [...USER_ERRORS, "validation", "not_found"],
  }),
  requireUser,
  validate.json(favoriteInputSchema),
  async (c) => {
    await addFavorite(c.get("user"), c.req.valid("json").listingId)
    return c.json({ ok: true })
  }
)

favoritesRoutes.delete(
  "/favorites/:listingId",
  spec({
    summary: "Un-save one listing; one that was not saved changes nothing",
    access: "user",
    responses: { 200: okSchema },
    errors: [...USER_ERRORS],
  }),
  requireUser,
  async (c) => {
    await removeFavorites(c.get("user"), c.req.param("listingId"))
    return c.json({ ok: true })
  }
)

favoritesRoutes.delete(
  "/favorites",
  spec({
    summary: "Un-save every listing of the signed-in account",
    access: "user",
    responses: { 200: okSchema },
    errors: [...USER_ERRORS],
  }),
  requireUser,
  async (c) => {
    await removeFavorites(c.get("user"))
    return c.json({ ok: true })
  }
)
