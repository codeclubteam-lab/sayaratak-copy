import { sitePageSchema } from "@sayaratak/shared/schemas/admin"
import { okSchema } from "@sayaratak/shared/schemas/api"
import { contactInputSchema } from "@sayaratak/shared/schemas/inputs"
import {
  siteSchema,
  sitemapEntrySchema,
} from "@sayaratak/shared/schemas/responses"
import { Hono } from "hono"
import { z } from "zod"

import { publicCache } from "~/shared/http/cache"
import { rateLimit } from "~/shared/http/rate-limit"
import { validate } from "~/shared/http/validate"
import { spec } from "~/shared/openapi/registry"

import { getPage, getSite, sendContact } from "./content.service"
import { getSitemap } from "./content.sitemap.service"

export const contentRoutes = new Hono()

contentRoutes.get(
  "/site",
  spec({
    summary: "Public site details: contact and languages",
    access: "public",
    responses: { 200: siteSchema },
    errors: ["not_found"],
  }),
  publicCache,
  async (c) => {
    const site = await getSite()
    return c.json(site)
  }
)

contentRoutes.get(
  "/pages/:slug",
  spec({
    summary: "One of the four site pages: about, contact, privacy or terms",
    access: "public",
    responses: { 200: sitePageSchema },
    errors: ["not_found"],
  }),
  publicCache,
  async (c) => c.json(await getPage(c.req.param("slug")))
)

contentRoutes.post(
  "/contact",
  spec({
    summary: "Send a message from the contact form",
    access: "public",
    responses: { 200: okSchema },
    errors: ["validation", "too_many_attempts"],
  }),
  rateLimit("contact"),
  validate.json(contactInputSchema),
  async (c) => c.json(await sendContact(c.req.valid("json")))
)

contentRoutes.get(
  "/sitemap",
  spec({
    summary:
      "Every public page to index, without the locale prefix: static pages, landing pages, listings and profiles",
    access: "public",
    responses: { 200: z.array(sitemapEntrySchema) },
  }),
  publicCache,
  async (c) => c.json(await getSitemap())
)
