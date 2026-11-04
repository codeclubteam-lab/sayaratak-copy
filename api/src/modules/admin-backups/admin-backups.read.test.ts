import { beforeEach, describe, expect, test } from "bun:test"
import { backupSchema } from "@sayaratak/shared/schemas/admin"
import { z } from "zod"

import { callAs } from "../../../tests/banners"
import { expectSchema, req, resetDb, signIn } from "../../../tests/helpers"

// Seed: the mock's backups bk-1 to bk-5, sizes in whole megabytes.
beforeEach(resetDb)

describe("admin backup routes", () => {
  test("answer 401 signed out and 403 `forbidden` to a seller", async () => {
    const { cookie, origin } = await signIn("dealership")
    for (const [method, path] of [
      ["GET", "/admin/backups"],
      ["POST", "/admin/backups"],
      ["POST", "/admin/backups/bk-1/restore"],
    ] as const) {
      expect((await req(path, { method })).status).toBe(401)
      const seller = await req(path, {
        method,
        headers: { cookie, origin, "content-type": "application/json" },
      })
      expect(seller.status).toBe(403)
    }
  })
})

describe("GET /admin/backups", () => {
  test("is every backup newest first, the size in megabytes", async () => {
    const call = callAs(await signIn("admin"))
    const rows = await expectSchema(
      await call("GET", "/admin/backups"),
      z.array(backupSchema)
    )
    expect(rows.length).toBe(5)
    const times = rows.map((row) => row.createdAt)
    expect(times).toEqual([...times].sort().reverse())
    expect(rows.find((row) => row.id === "bk-1")?.sizeMb).toBe(40)
  })
})

describe("POST /admin/backups/:id/restore", () => {
  test("is 403 `forbidden` with a message that names the command", async () => {
    const call = callAs(await signIn("admin"))
    const res = await call("POST", "/admin/backups/bk-1/restore")
    expect(res.status).toBe(403)
    const body = await expectSchema(
      res,
      z.object({ code: z.string(), message: z.string() })
    )
    expect(body.code).toBe("forbidden")
    expect(body.message).toContain("db-restore")
  })
})
