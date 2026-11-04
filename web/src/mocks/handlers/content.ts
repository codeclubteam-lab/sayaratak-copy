import { okSchema } from "@sayaratak/shared/schemas/api"
import { bannerSchema, sitePageSchema } from "@sayaratak/shared/schemas/admin"
import { contactInputSchema } from "@sayaratak/shared/schemas/inputs"
import {
  siteSchema,
  sitemapEntrySchema,
} from "@sayaratak/shared/schemas/responses"
import { z } from "zod"

import { db, insert, newId, resetDb } from "../db"
import { fail, route, withSession } from "../http"
import { nowIso } from "../lib"
import { sitemapEntries } from "../sitemap"

// Public: contact details and locales only, never banking or moderation settings.
route("GET", "/site", () =>
  siteSchema.parse({
    contact: db.settings.contact,
    locales: db.settings.locales,
  })
)

route("GET", "/pages/:slug", (c) => {
  const row = db.pages.find((p) => p.slug === c.params.slug)
  if (!row) throw fail(404, "not_found")
  return sitePageSchema.parse(row)
})

route("GET", "/banners", (c) => {
  const placement = c.query.get("placement")
  const now = Date.now()
  const rows = db.banners
    .filter(
      (b) =>
        b.active &&
        Date.parse(b.startsAt) <= now &&
        Date.parse(b.endsAt) >= now &&
        (!placement || b.placement === placement)
    )
    .sort((a, b) => a.sortOrder - b.sortOrder)
  return z.array(bannerSchema).parse(rows)
})

// The sitemap entries the web's sitemap.xml builds; the real API serves the same list.
route("GET", "/sitemap", () =>
  z.array(sitemapEntrySchema).parse(sitemapEntries())
)

route("POST", "/contact", async (c) => {
  const input = await c.body(contactInputSchema)
  insert(db.contacts, { id: newId("ct"), ...input, createdAt: nowIso() })
  return okSchema.parse({ ok: true })
})

// Reseeds (MOCK_EMPTY decides the data set) and signs everyone out.
route("POST", "/mock/reset", () => {
  resetDb()
  return withSession(null, { ok: true })
})
// Dev panel triggers for the session edge cases (5.15): drop the cookie while the page still shows a user, or ban the signed-in account.
route("POST", "/mock/expire-session", () => withSession(null, { ok: true }))
route("POST", "/mock/ban-me", (c) => {
  if (c.user) c.user.banned = true
  return { ok: true }
})
