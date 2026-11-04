import { beforeEach, describe, expect, test } from "bun:test"
import { siteSchema } from "@sayaratak/shared/schemas/responses"
import { sql } from "drizzle-orm"
import { z } from "zod"

import { db } from "~/shared/db/client"

import { buildSeed, expectSchema, req, resetDb } from "../../../tests/helpers"
import { contacts, settings, sitePages } from "./content.tables"

const seeded = buildSeed().settings
const CONTACT_KEYS = ["address", "email", "phone", "whatsapp"]

beforeEach(resetDb)

describe("GET /site", () => {
  test("answers the contact details and locales from the settings", async () => {
    const res = await req("/site")
    expect(res.status).toBe(200)
    const site = await expectSchema(res, siteSchema)
    expect(site).toEqual({ contact: seeded.contact, locales: seeded.locales })
    expect(res.headers.get("cache-control")).toBe("public, max-age=60")
  })

  test("never shows banking or moderation settings", async () => {
    const body = await (await req("/site")).json()
    const site = z.record(z.string(), z.unknown()).parse(body)
    const contact = z.record(z.string(), z.unknown()).parse(site.contact)
    expect(Object.keys(site).sort()).toEqual(["contact", "locales"])
    expect(Object.keys(contact).sort()).toEqual(CONTACT_KEYS)
  })

  test("answers 404 not_found when the settings row is missing", async () => {
    await db.delete(settings)
    const res = await req("/site")
    expect(res.status).toBe(404)
    expect(await res.json()).toMatchObject({ code: "not_found" })
    expect(res.headers.get("cache-control")).toBe("no-store")
  })
})

describe("content tables", () => {
  test("hold the four mock site pages and no contact message", async () => {
    const pages = await db.select({ slug: sitePages.slug }).from(sitePages)
    expect(pages.map((p) => p.slug).sort()).toEqual(
      buildSeed()
        .pages.map((p) => p.slug)
        .sort()
    )
    expect(await db.$count(contacts)).toBe(0)
  })

  test("refuse a page body missing a language", async () => {
    // Raw SQL: the column type would not let a one-language value through.
    const error = await db
      .execute(sql`update site_pages set body = '{"ar": "x"}'`)
      .catch((error) => error)
    expect(error.cause.constraint).toBe("site_pages_body_bilingual")
  })
})
