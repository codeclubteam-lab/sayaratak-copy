import { beforeEach, describe, expect, test } from "bun:test"
import { verifyPassword } from "better-auth/crypto"
import { eq } from "drizzle-orm"

import { auditLog } from "~/modules/audit/audit.tables"
import { account, user } from "~/modules/auth/auth.tables"
import { db } from "~/shared/db/client"

import { bootstrap } from "../scripts/bootstrap"
import { createAdmin } from "../scripts/create-admin"
import { emptyDb } from "./helpers"

const input = {
  email: "Owner@Example.SD",
  name: "Site owner",
  password: "strong pass 42",
}

beforeEach(async () => {
  await emptyDb()
  await bootstrap(db)
})

describe("create-admin", () => {
  test("creates a verified admin with two-factor on and a working password", async () => {
    const id = await createAdmin(db, input)
    const [row] = await db.select().from(user).where(eq(user.id, id))
    expect(row).toMatchObject({
      email: "owner@example.sd",
      name: "Site owner",
      role: "admin",
      emailVerified: true,
      twoFactorEnabled: true,
      banned: false,
    })
    const [credential] = await db
      .select()
      .from(account)
      .where(eq(account.userId, id))
    expect(credential?.providerId).toBe("credential")
    expect(
      await verifyPassword({
        hash: credential?.password ?? "",
        password: input.password,
      })
    ).toBe(true)
  })

  test("writes one audit row naming the new admin", async () => {
    const id = await createAdmin(db, input)
    const rows = await db.select().from(auditLog)
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      action: "admin.create",
      targetType: "user",
      targetId: id,
      adminId: null,
    })
  })

  test("refuses a password that breaks the shared rules", async () => {
    expect(createAdmin(db, { ...input, password: "short" })).rejects.toThrow(
      "validation.password_min"
    )
    expect(await db.$count(user)).toBe(0)
  })

  test("refuses an email that already has an account, in any case", async () => {
    await createAdmin(db, input)
    expect(
      createAdmin(db, { ...input, email: "owner@example.sd" })
    ).rejects.toThrow("an account with owner@example.sd exists")
  })

  test("refuses a second admin, with another email too", async () => {
    await createAdmin(db, input)
    expect(
      createAdmin(db, { ...input, email: "second@example.sd" })
    ).rejects.toThrow("an admin already exists")
    expect(await db.$count(user, eq(user.role, "admin"))).toBe(1)
  })

  test("the database refuses a second admin even without the command", async () => {
    await createAdmin(db, input)
    const promote = (async () =>
      db.insert(user).values({
        id: "u-raw-admin",
        name: "Raw",
        email: "raw@example.sd",
        role: "admin",
        createdAt: new Date(),
        prefs: {
          messages: true,
          updates: true,
          savedSearchMatches: true,
          reviews: true,
          billing: true,
          announcements: true,
        },
      }))()
    expect(promote).rejects.toThrow()
    expect(await db.$count(user, eq(user.role, "admin"))).toBe(1)
  })

  test("runs as a terminal command and reads the name and password", async () => {
    const run = Bun.spawn(
      ["bun", "scripts/create-admin.ts", "cli@example.sd"],
      {
        // `process.env` as setup.ts left it: the test database, not the one in `.env`.
        env: { ...process.env },
        stdin: new Blob(["CLI admin\nstrong pass 42\nstrong pass 42\n"]),
        stdout: "pipe",
        stderr: "pipe",
      }
    )
    expect(await run.exited).toBe(0)
    expect(await new Response(run.stdout).text()).toContain(
      "created for cli@example.sd"
    )
    expect(await db.$count(user, eq(user.email, "cli@example.sd"))).toBe(1)
  })
})
