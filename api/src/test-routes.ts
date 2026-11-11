import { sql } from "drizzle-orm"
import { Hono } from "hono"

import { env } from "~/env"
import { db } from "~/shared/db/client"
import { fail } from "~/shared/http/errors"
import { resetRateLimits } from "~/shared/http/rate-limit"
import { flushMail, testInbox } from "~/shared/mail/send"
import { flushFanOut } from "~/modules/notifications/notifications.fanout.service"

/**
 * E2E test-only routes, mounted outside `/api/v1` only when both `NODE_ENV`
 * and `APP_ENV` are `test` (Step 11.5). Never reachable in development or
 * production, and kept out of `openapi.json`.
 */
export function testRoutes() {
  if (env.NODE_ENV !== "test" || env.APP_ENV !== "test") {
    throw new Error("testRoutes requires NODE_ENV=test and APP_ENV=test")
  }
  return new Hono()
    .post("/reset", async (c) => {
      await resetDatabase(false)
      return c.json({ ok: true })
    })
    .post("/empty", async (c) => {
      await resetDatabase(true)
      return c.json({ ok: true })
    })
    .post("/reset-limits", (c) => {
      resetRateLimits()
      return c.json({ ok: true })
    })
    .get("/otp", async (c) => {
      const email = c.req.query("email")?.trim().toLowerCase()
      const template = c.req.query("template")?.trim()
      if (!email) fail.notFound()
      await flushMail()
      const mail = testInbox.findLast(
        (m) =>
          m.to.toLowerCase() === email && (!template || m.template === template)
      )
      if (!mail) fail.notFound()
      return c.json({ code: mail.code })
    })
}

async function resetDatabase(empty: boolean) {
  resetRateLimits()
  await flushFanOut()
  await flushMail()
  testInbox.length = 0
  const rows = await db.execute<{ name: string }>(
    sql`select tablename as name from pg_tables where schemaname = 'public'`
  )
  if (rows.length) {
    const tables = sql.join(
      rows.map((row) => sql.identifier(row.name)),
      sql`, `
    )
    await db.execute(sql`truncate ${tables} restart identity cascade`)
  }
  const { seed } = await import("../scripts/seed")
  await seed(db, { empty })
}
