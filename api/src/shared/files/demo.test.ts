import { beforeAll, describe, expect, test } from "bun:test"
import { eq } from "drizzle-orm"

import { uploads } from "~/modules/uploads/uploads.tables"
import { db } from "~/shared/db/client"

import { resetDb } from "../../../tests/helpers"
import { demoFile, demoUrl } from "./demo"

beforeAll(resetDb)

describe("demo files", () => {
  test("every seeded private upload has its file in the demo folder", async () => {
    const rows = await db
      .select({ url: uploads.url })
      .from(uploads)
      .where(eq(uploads.delivery, "private"))
    expect(rows.length).toBeGreaterThan(0)
    for (const { url } of rows) {
      const file = demoFile(url ?? "")
      expect(await file?.exists()).toBe(true)
      expect(await file?.text()).toStartWith("<svg")
    }
  })

  test("a receipt shows its payment's transaction number", async () => {
    const text = await demoFile("/demo/receipt-1.svg")?.text()
    expect(text).toContain("Transaction No.")
  })

  test("refuses a url outside the folder or with a sub-folder", () => {
    expect(demoFile("/demo/../.env")).toBeNull()
    expect(demoFile("/demo/a/b.svg")).toBeNull()
    expect(demoFile("/mock/doc-01.svg")).toBeNull()
    expect(demoFile("/demo/")).toBeNull()
  })

  test("names a web mock file by its own name", () => {
    expect(demoUrl("/mock/doc-02.svg")).toBe("/demo/doc-02.svg")
  })
})
