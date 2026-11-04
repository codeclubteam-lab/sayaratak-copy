import { beforeEach, describe, expect, test } from "bun:test"
import { verifyPassword } from "better-auth/crypto"
import { eq } from "drizzle-orm"
import { z } from "zod"

import { db } from "~/shared/db/client"
import { auditLog } from "~/modules/audit/audit.tables"
import { account, session, user } from "~/modules/auth/auth.tables"

import { errorOf } from "../../../tests/admin"
import { resetDb, signIn } from "../../../tests/helpers"
import { ask, newAdmin, platform } from "../../../tests/platform"

const answer = z.object({ id: z.string(), email: z.string(), name: z.string() })
// Seed: u-admin is the one admin (admin@demo.sy).
const adminRow = () =>
  db
    .select()
    .from(user)
    .where(eq(user.role, "admin"))
    .then(([row]) => row)
const auditOf = (action: string) =>
  db.select().from(auditLog).where(eq(auditLog.action, action))

// Asks for the code of a change, then sends it.
async function change(method: string, op: string, input?: unknown) {
  const { code, at } = await ask(input === undefined ? { op } : { op, input })
  return platform(method, "", { code, at, body: input })
}
const create = () => change("POST", "create", newAdmin)

beforeEach(resetDb)

describe("DELETE /platform/admin", () => {
  test("deletes the admin, signs them out and leaves an audit row with no admin id", async () => {
    await signIn("admin")
    expect(await db.$count(session, eq(session.userId, "u-admin"))).toBe(1)
    const res = await change("DELETE", "delete")
    expect(res.status).toBe(200)
    expect(await adminRow()).toBeUndefined()
    expect(await db.$count(session, eq(session.userId, "u-admin"))).toBe(0)
    const [audit] = await auditOf("admin.delete")
    expect(audit).toMatchObject({
      adminId: null,
      targetId: "u-admin",
      reason: "platform endpoint",
      before: { email: "admin@demo.sy" },
    })
  })

  test("a repeat of the same code finds no admin (404)", async () => {
    const { code, at } = await ask({ op: "delete" })
    expect((await platform("DELETE", "", { code, at })).status).toBe(200)
    expect((await platform("DELETE", "", { code, at })).status).toBe(404)
  })
})

describe("POST /platform/admin", () => {
  test("refuses while an admin exists (409 `conflict`)", async () => {
    const { res } = await ask({ op: "create", input: newAdmin })
    expect((await errorOf(res)).code).toBe("conflict")
  })

  test("creates the one admin after a delete: verified, two-factor on, working password", async () => {
    await change("DELETE", "delete")
    const res = await create()
    expect(res.status).toBe(200)
    const body = answer.parse(await res.json())
    expect(body).toMatchObject({
      email: "new.owner@example.sd",
      name: newAdmin.name,
    })
    expect(await adminRow()).toMatchObject({
      id: body.id,
      emailVerified: true,
      twoFactorEnabled: true,
      onboardingDone: true,
    })
    const [credential] = await db
      .select()
      .from(account)
      .where(eq(account.userId, body.id))
    expect(
      await verifyPassword({
        hash: credential?.password ?? "",
        password: newAdmin.password,
      })
    ).toBe(true)
    expect((await auditOf("admin.create"))[0]).toMatchObject({
      adminId: null,
      targetId: body.id,
      reason: "platform endpoint",
    })
  })

  test("refuses an email that belongs to another account, and a weak password", async () => {
    await change("DELETE", "delete")
    const taken = await ask({
      op: "create",
      input: { ...newAdmin, email: "user@demo.sy" },
    })
    expect((await errorOf(taken.res)).code).toBe("exists")
    const weak = await ask({
      op: "create",
      input: { ...newAdmin, password: "short" },
    })
    expect(weak.res.status).toBe(422)
  })
})

describe("PATCH /platform/admin", () => {
  test("changes the name and keeps the sessions", async () => {
    await signIn("admin")
    const res = await change("PATCH", "update", { name: "Renamed" })
    expect(res.status).toBe(200)
    expect(answer.parse(await res.json())).toMatchObject({
      id: "u-admin",
      name: "Renamed",
      email: "admin@demo.sy",
    })
    expect(await db.$count(session, eq(session.userId, "u-admin"))).toBe(1)
  })

  test("a new email or password signs the admin out everywhere", async () => {
    await signIn("admin")
    const res = await change("PATCH", "update", { email: "Moved@Example.SD" })
    expect(answer.parse(await res.json()).email).toBe("moved@example.sd")
    expect(await db.$count(session, eq(session.userId, "u-admin"))).toBe(0)
    const password = "another pass 77"
    expect((await change("PATCH", "update", { password })).status).toBe(200)
    const [credential] = await db
      .select()
      .from(account)
      .where(eq(account.userId, "u-admin"))
    expect(
      await verifyPassword({ hash: credential?.password ?? "", password })
    ).toBe(true)
    const [audit] = await auditOf("admin.update")
    expect(audit?.adminId).toBeNull()
    expect(JSON.stringify(await auditOf("admin.update"))).not.toContain(
      password
    )
  })

  test("refuses another account's email (409 `exists`) and an empty change (422)", async () => {
    const taken = await ask({ op: "update", input: { email: "user@demo.sy" } })
    expect((await errorOf(taken.res)).code).toBe("exists")
    expect((await ask({ op: "update", input: {} })).res.status).toBe(422)
  })

  test("answers 404 when the platform has no admin", async () => {
    await change("DELETE", "delete")
    const { res } = await ask({ op: "update", input: { name: "Ghost" } })
    expect(res.status).toBe(404)
  })
})
