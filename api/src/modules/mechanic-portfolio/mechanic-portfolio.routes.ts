import { okSchema } from "@sayaratak/shared/schemas/api"
import {
  idsInputSchema,
  portfolioInputSchema,
  portfolioUpdateSchema,
} from "@sayaratak/shared/schemas/inputs"
import { mechanicSchema } from "@sayaratak/shared/schemas/profile"
import { Hono } from "hono"

import { validate } from "~/shared/http/validate"
import { spec } from "~/shared/openapi/registry"
import { requireRole } from "~/modules/auth/auth.middleware"

import {
  addMyPortfolioItem,
  deleteMyPortfolioItem,
  getMyPortfolio,
  reorderMyPortfolio,
  updateMyPortfolioItem,
} from "./mechanic-portfolio.service"

export const mechanicPortfolioRoutes = new Hono()

const itemSchema = mechanicSchema.shape.portfolio.element
const listSchema = mechanicSchema.shape.portfolio
const OWNER_ERRORS = [
  "unauthenticated",
  "banned",
  "forbidden",
  "not_found",
] as const

mechanicPortfolioRoutes.get(
  "/me/portfolio",
  spec({
    summary: "The signed-in mechanic's portfolio in its order",
    access: "user",
    responses: { 200: listSchema },
    errors: [...OWNER_ERRORS],
  }),
  requireRole("mechanic"),
  async (c) => c.json(await getMyPortfolio(c.get("user")))
)

mechanicPortfolioRoutes.post(
  "/me/portfolio",
  spec({
    summary:
      "Add an uploaded picture with a caption at the end; past the plan's portfolio limit it is 403 limit_reached",
    access: "user",
    responses: { 200: itemSchema },
    errors: [...OWNER_ERRORS, "validation", "limit_reached"],
    idempotent: true,
  }),
  requireRole("mechanic"),
  validate.json(portfolioInputSchema),
  async (c) =>
    c.json(await addMyPortfolioItem(c.get("user"), c.req.valid("json")))
)

// Registered before `/:id` so the word "reorder" is never read as an id.
mechanicPortfolioRoutes.post(
  "/me/portfolio/reorder",
  spec({
    summary:
      "Put the named pictures first in this order; the others follow, none is deleted",
    access: "user",
    responses: { 200: listSchema },
    errors: [...OWNER_ERRORS, "validation"],
  }),
  requireRole("mechanic"),
  validate.json(idsInputSchema),
  async (c) =>
    c.json(await reorderMyPortfolio(c.get("user"), c.req.valid("json").ids))
)

mechanicPortfolioRoutes.patch(
  "/me/portfolio/:id",
  spec({
    summary: "Change the caption and optionally the picture of one item",
    access: "user",
    responses: { 200: itemSchema },
    errors: [...OWNER_ERRORS, "validation"],
  }),
  requireRole("mechanic"),
  validate.json(portfolioUpdateSchema),
  async (c) =>
    c.json(
      await updateMyPortfolioItem(c.get("user"), {
        id: c.req.param("id"),
        ...c.req.valid("json"),
      })
    )
)

mechanicPortfolioRoutes.delete(
  "/me/portfolio/:id",
  spec({
    summary: "Remove one picture and its file",
    access: "user",
    responses: { 200: okSchema },
    errors: [...OWNER_ERRORS],
  }),
  requireRole("mechanic"),
  async (c) => {
    await deleteMyPortfolioItem(c.get("user"), c.req.param("id"))
    return c.json({ ok: true })
  }
)
