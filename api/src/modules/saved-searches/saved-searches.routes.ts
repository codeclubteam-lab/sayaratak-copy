import { okSchema } from "@sayaratak/shared/schemas/api"
import {
  savedSearchInputSchema,
  savedSearchPatchSchema,
} from "@sayaratak/shared/schemas/inputs"
import { savedSearchSchema } from "@sayaratak/shared/schemas/saved-search"
import { Hono } from "hono"
import { z } from "zod"

import { validate } from "~/shared/http/validate"
import { spec } from "~/shared/openapi/registry"
import { requireUser } from "~/modules/auth/auth.middleware"

import {
  createSavedSearch,
  deleteSavedSearch,
  editSavedSearch,
  listSavedSearches,
} from "./saved-searches.service"

export const savedSearchesRoutes = new Hono()

const USER_ERRORS = ["unauthenticated", "banned"] as const

savedSearchesRoutes.get(
  "/saved-searches",
  spec({
    summary: "The signed-in account's saved searches, oldest first",
    access: "user",
    responses: { 200: z.array(savedSearchSchema) },
    errors: [...USER_ERRORS],
  }),
  requireUser,
  async (c) => c.json(await listSavedSearches(c.get("user")))
)

savedSearchesRoutes.post(
  "/saved-searches",
  spec({
    summary: "Save a search with its filters; alerts default on",
    access: "user",
    responses: { 200: savedSearchSchema },
    errors: [...USER_ERRORS, "validation"],
  }),
  requireUser,
  validate.json(savedSearchInputSchema),
  async (c) =>
    c.json(await createSavedSearch(c.get("user"), c.req.valid("json")))
)

savedSearchesRoutes.patch(
  "/saved-searches/:id",
  spec({
    summary:
      "Rename, switch alerts, or `markSeen` to zero the new-match count; 404 for another account's search",
    access: "user",
    responses: { 200: savedSearchSchema },
    errors: [...USER_ERRORS, "validation", "not_found"],
  }),
  requireUser,
  validate.json(savedSearchPatchSchema),
  async (c) =>
    c.json(
      await editSavedSearch(c.get("user"), {
        id: c.req.param("id"),
        change: c.req.valid("json"),
      })
    )
)

savedSearchesRoutes.delete(
  "/saved-searches/:id",
  spec({
    summary: "Delete a saved search; 404 for another account's",
    access: "user",
    responses: { 200: okSchema },
    errors: [...USER_ERRORS, "not_found"],
  }),
  requireUser,
  async (c) => {
    await deleteSavedSearch(c.get("user"), c.req.param("id"))
    return c.json({ ok: true })
  }
)
