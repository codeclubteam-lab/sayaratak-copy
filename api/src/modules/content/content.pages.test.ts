import {
  afterEach,
  beforeEach,
  describe,
  expect,
  mock,
  spyOn,
  test,
} from "bun:test"
import { sitePageSchema } from "@sayaratak/shared/schemas/admin"
import { okSchema } from "@sayaratak/shared/schemas/api"
import { z } from "zod"

import { db } from "~/shared/db/client"
import { clock } from "~/shared/time/clock"

import { buildSeed, expectSchema, req, resetDb } from "../../../tests/helpers"
import { contacts } from "./content.tables"

const PAGES = buildSeed().pages
const errorBody = z.object({
  code: z.string(),
  fields: z.record(z.string(), z.string()),
})
const CONTACT = {
  name: "Omar",
  contact: "omar@example.com",
  subject: "general",
  message: "My listing is not showing yet.",
}

beforeEach(resetDb)
// The clock spy of one test must not reach the next test or file.
afterEach(() => mock.restore())

function sendContact(body: unknown) {
  return req("/contact", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  })
}

describe("GET /pages/:slug", () => {
  test("answers each of the four pages with both languages", async () => {
    for (const page of PAGES) {
      const res = await req(`/pages/${page.slug}`)
      expect(res.status).toBe(200)
      const body = await expectSchema(res, sitePageSchema)
      expect(body.slug).toBe(page.slug)
      expect(body.title).toEqual(page.title)
      expect(body.body).toEqual(page.body)
    }
  })

  test("is cached for a minute, errors are not", async () => {
    const ok = await req("/pages/about")
    expect(ok.headers.get("cache-control")).toBe("public, max-age=60")
    const missing = await req("/pages/pricing")
    expect(missing.headers.get("cache-control")).toBe("no-store")
  })

  test("answers 404 not_found for a slug that is not one of the four", async () => {
    const res = await req("/pages/pricing")
    expect(res.status).toBe(404)
    expect(await res.json()).toMatchObject({ code: "not_found" })
  })
})

describe("POST /contact", () => {
  test("keeps the message and answers ok, with no sign-in", async () => {
    const at = new Date("2026-11-01T10:00:00Z")
    spyOn(clock, "now").mockReturnValue(at)
    const res = await sendContact(CONTACT)
    expect(res.status).toBe(200)
    await expectSchema(res, okSchema)
    const rows = await db.select().from(contacts)
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ ...CONTACT, createdAt: at })
    expect(rows[0]?.id).toMatch(/^ct-[0-9a-z]{8}$/)
  })

  test("answers 422 validation with i18n keys and keeps nothing", async () => {
    const res = await sendContact({
      ...CONTACT,
      subject: "spam",
      message: "hi",
    })
    expect(res.status).toBe(422)
    const body = errorBody.parse(await res.json())
    expect(body.code).toBe("validation")
    expect(body.fields.message).toBe("validation.message_min")
    expect(Object.keys(body.fields)).toContain("subject")
    expect(await db.$count(contacts)).toBe(0)
  })
})
