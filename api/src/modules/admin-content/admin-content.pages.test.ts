import { beforeEach, describe, expect, test } from "bun:test"
import { sitePageSchema } from "@sayaratak/shared/schemas/admin"
import { eq } from "drizzle-orm"

import { db } from "~/shared/db/client"
import { auditLog } from "~/modules/audit/audit.tables"
import { sitePages } from "~/modules/content/content.tables"

import { adminCaller, errorOf } from "../../../tests/admin"
import { expectSchema, req, resetDb, signIn } from "../../../tests/helpers"

let call = adminCaller()
beforeEach(async () => {
  await resetDb()
  call = adminCaller()
})

const auditOf = (id: string) =>
  db.select().from(auditLog).where(eq(auditLog.targetId, id))

describe("admin content routes", () => {
  test("answer 401 signed out and 403 `forbidden` to a seller", async () => {
    const { cookie, origin } = await signIn("dealership")
    for (const [method, path] of [
      ["GET", "/admin/pages/about"],
      ["PATCH", "/admin/pages/about"],
      ["GET", "/admin/settings"],
      ["PATCH", "/admin/settings"],
    ] as const) {
      expect((await req(path, { method })).status).toBe(401)
      const seller = await req(path, {
        method,
        headers: { cookie, origin, "content-type": "application/json" },
        body: method === "GET" ? undefined : "{}",
      })
      expect(seller.status).toBe(403)
    }
  })
})

describe("GET /admin/pages/:slug", () => {
  test("is each of the four pages, and 404 for any other", async () => {
    for (const slug of ["about", "contact", "privacy", "terms"] as const) {
      const res = await call("GET", `/admin/pages/${slug}`)
      expect(res.status).toBe(200)
      expect((await expectSchema(res, sitePageSchema)).slug).toBe(slug)
    }
    const res = await call("GET", "/admin/pages/nope")
    expect(res.status).toBe(404)
    expect((await errorOf(res)).code).toBe("not_found")
  })
})

describe("PATCH /admin/pages/:slug", () => {
  const title = { ar: "من نحن", en: "Who we are" }

  test("changes the part sent, keeps the other, stamps the time and writes the audit row", async () => {
    const before = await expectSchema(
      await call("GET", "/admin/pages/about"),
      sitePageSchema
    )
    const res = await call("PATCH", "/admin/pages/about", { title })
    expect(res.status).toBe(200)
    const page = await expectSchema(res, sitePageSchema)
    expect(page.title).toEqual(title)
    expect(page.body).toEqual(before.body)
    expect(Date.parse(page.updatedAt)).toBeGreaterThan(
      Date.parse(before.updatedAt)
    )
    const [saved] = await db
      .select()
      .from(sitePages)
      .where(eq(sitePages.slug, "about"))
    expect(saved?.title).toEqual(title)
    expect(await auditOf("about")).toMatchObject([
      {
        action: "page.update",
        targetType: "page",
        adminId: "u-admin",
        before: { title: before.title },
        after: { title },
      },
    ])
  })

  test("an empty edit changes nothing but the time", async () => {
    const before = await expectSchema(
      await call("GET", "/admin/pages/terms"),
      sitePageSchema
    )
    const page = await expectSchema(
      await call("PATCH", "/admin/pages/terms", {}),
      sitePageSchema
    )
    expect({ ...page, updatedAt: "" }).toEqual({ ...before, updatedAt: "" })
  })

  test("answers 404 for an unknown page and 422 for a half-written part", async () => {
    expect((await call("PATCH", "/admin/pages/nope", {})).status).toBe(404)
    const res = await call("PATCH", "/admin/pages/about", {
      body: { ar: "x" },
    })
    expect(res.status).toBe(422)
    expect(Object.keys((await errorOf(res)).fields ?? {})).toContain("body.en")
  })
})
