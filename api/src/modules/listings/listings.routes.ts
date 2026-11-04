import { okSchema } from "@sayaratak/shared/schemas/api"
import { pageOf } from "@sayaratak/shared/schemas/fields"
import {
  listingCreateSchema,
  listingPatchSchema,
  listingStatusInputSchema,
} from "@sayaratak/shared/schemas/inputs"
import {
  listingPageSchema,
  listingSchema,
} from "@sayaratak/shared/schemas/listing"
import { arrayKeys, searchParamsSchema } from "@sayaratak/shared/search/schemas"
import { Hono } from "hono"
import { z } from "zod"

import { validate } from "~/shared/http/validate"
import { spec } from "~/shared/openapi/registry"
import { requireRole, requireUser } from "~/modules/auth/auth.middleware"

import {
  deleteListing,
  duplicateListing,
  renewListing,
  setListingStatus,
} from "./listings.actions.service"
import { listMyListings } from "./listings.mine.service"
import { getListingBySlug, listSimilar } from "./listings.read.service"
import { searchListings } from "./listings.search.service"
import { createListing, patchListing } from "./listings.write.service"

const OWNER_ERRORS = [
  "unauthenticated",
  "banned",
  "forbidden",
  "not_found",
] as const

// The owner actions that answer the changed listing.
const ownerAction = (summary: string, idempotent = false) =>
  spec({
    summary,
    access: "user",
    responses: { 200: listingSchema },
    errors: [...OWNER_ERRORS],
    idempotent,
  })

export const listingsRoutes = new Hono()

listingsRoutes.get(
  "/listings",
  spec({
    summary:
      "Search public listings: filters, sort, 24 a page, facet counts; `limit` (1 to 24) and `exclude` serve the rails",
    access: "public",
    responses: { 200: listingPageSchema },
  }),
  validate.query(searchParamsSchema, arrayKeys),
  async (c) => {
    const page = await searchListings({
      viewer: c.get("viewer"),
      params: c.req.valid("query"),
      limit: c.req.query("limit"),
      exclude: c.req.query("exclude"),
    })
    return c.json(page)
  }
)

listingsRoutes.get(
  "/listings/:slug",
  spec({
    summary:
      "One listing by slug (its trailing id counts); drafts and hidden ones only for the owner and admins",
    access: "public",
    responses: { 200: listingSchema },
    errors: ["not_found"],
  }),
  async (c) => {
    const listing = await getListingBySlug(c.get("viewer"), c.req.param("slug"))
    return c.json(listing)
  }
)

listingsRoutes.get(
  "/listings/:id/similar",
  spec({
    summary: "Up to 8 public listings like this one, nearest in price first",
    access: "public",
    responses: { 200: z.array(listingSchema) },
    errors: ["not_found"],
  }),
  async (c) => {
    const listings = await listSimilar(c.get("viewer"), c.req.param("id"))
    return c.json(listings)
  }
)

listingsRoutes.post(
  "/listings",
  spec({
    summary:
      "Create a listing: a draft, or sent to review with `submit` (counts against the plan limit)",
    access: "user",
    responses: { 200: listingSchema },
    errors: ["unauthenticated", "banned", "forbidden", "limit_reached"],
    idempotent: true,
  }),
  requireUser,
  validate.json(listingCreateSchema),
  async (c) => {
    const listing = await createListing(c.get("user"), c.req.valid("json"))
    return c.json(listing)
  }
)

listingsRoutes.patch(
  "/listings/:id",
  spec({
    summary:
      "Change a listing (owner or admin); `submit` sends a draft or rejected one to review",
    access: "user",
    responses: { 200: listingSchema },
    errors: [...OWNER_ERRORS, "limit_reached"],
  }),
  requireUser,
  validate.json(listingPatchSchema),
  async (c) => {
    const listing = await patchListing(c.get("user"), {
      id: c.req.param("id"),
      body: c.req.valid("json"),
    })
    return c.json(listing)
  }
)

listingsRoutes.delete(
  "/listings/:id",
  spec({
    summary: "Delete a listing and its photos for good",
    access: "user",
    responses: { 200: okSchema },
    errors: [...OWNER_ERRORS],
  }),
  requireUser,
  async (c) => {
    await deleteListing(c.get("user"), c.req.param("id"))
    return c.json({ ok: true as const })
  }
)

listingsRoutes.post(
  "/listings/:id/status",
  ownerAction("Mark a listing available, reserved, sold or rented"),
  requireUser,
  validate.json(listingStatusInputSchema),
  async (c) => {
    const listing = await setListingStatus(c.get("user"), {
      id: c.req.param("id"),
      status: c.req.valid("json").status,
    })
    return c.json(listing)
  }
)

listingsRoutes.post(
  "/listings/:id/renew",
  ownerAction("Extend a listing by the expiry setting's days"),
  requireUser,
  async (c) => {
    const listing = await renewListing(c.get("user"), c.req.param("id"))
    return c.json(listing)
  }
)

listingsRoutes.post(
  "/listings/:id/duplicate",
  ownerAction("Copy a listing, photos included, as a new draft", true),
  requireUser,
  async (c) => {
    const listing = await duplicateListing(c.get("user"), c.req.param("id"))
    return c.json(listing)
  }
)

listingsRoutes.get(
  "/me/listings",
  spec({
    summary:
      "The owner's listings by `tab`, filters `q`, `type`, `intent`, `moderation`, `status`, `needsAttention`, `sort` (price, views, expires) and `dir`; `pageSize` up to 500 for the CSV",
    access: "user",
    responses: { 200: pageOf(listingSchema) },
    errors: ["unauthenticated", "banned", "forbidden"],
  }),
  requireRole("user", "dealership"),
  async (c) => {
    const page = await listMyListings(c.get("user"), c.req.query())
    return c.json(page)
  }
)
