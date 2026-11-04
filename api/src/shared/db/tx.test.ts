import { describe, expect, spyOn, test } from "bun:test"

import { afterCommit, transaction } from "~/shared/db/tx"

describe("transaction and afterCommit", () => {
  test("queued work runs once the transaction committed", async () => {
    const order: string[] = []
    await transaction(async (tx) => {
      afterCommit(tx, () => {
        order.push("after commit")
      })
      order.push("in transaction")
    })
    expect(order).toEqual(["in transaction", "after commit"])
  })

  test("a rollback drops the queued work", async () => {
    let ran = false
    const failed = await transaction(async (tx) => {
      afterCommit(tx, () => {
        ran = true
      })
      throw new Error("rolled back")
    }).catch((error) => error)
    expect(failed).toBeInstanceOf(Error)
    expect(ran).toBe(false)
  })

  test("a failing callback is logged and the result still returns", async () => {
    const write = spyOn(process.stdout, "write").mockImplementation(() => true)
    try {
      const result = await transaction(async (tx) => {
        afterCommit(tx, () => {
          throw new Error("cloudinary down")
        })
        return "saved"
      })
      expect(result).toBe("saved")
      const lines = write.mock.calls.map(([line]) => String(line))
      expect(lines.some((line) => line.includes("after_commit_failed"))).toBe(
        true
      )
    } finally {
      write.mockRestore()
    }
  })
})
