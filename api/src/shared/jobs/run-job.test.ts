import { describe, expect, spyOn, test } from "bun:test"

import { takeJobLock } from "./job-lock"
import { runJob } from "./run-job"

function captureLogs() {
  const write = spyOn(process.stdout, "write").mockImplementation(() => true)
  return {
    lines: () =>
      write.mock.calls.map(
        ([line]) => JSON.parse(String(line)) as Record<string, unknown>
      ),
    restore: () => write.mockRestore(),
  }
}

describe("runJob", () => {
  test("runs the job and logs how many rows it handled", async () => {
    const logs = captureLogs()
    try {
      expect(await runJob({ name: "t-done", run: async () => 3 })).toBe("done")
      expect(logs.lines()).toContainEqual(
        expect.objectContaining({ msg: "job_done", job: "t-done", handled: 3 })
      )
    } finally {
      logs.restore()
    }
  })

  test("a failing job is logged at error level with its name and does not throw", async () => {
    const logs = captureLogs()
    try {
      const outcome = await runJob({
        name: "t-fail",
        run: async () => {
          throw new Error("smtp down")
        },
      })
      expect(outcome).toBe("failed")
      expect(logs.lines()).toContainEqual(
        expect.objectContaining({
          level: "error",
          msg: "job_failed",
          job: "t-fail",
        })
      )
    } finally {
      logs.restore()
    }
  })

  test("the lock is free again after a failure, so the next tick runs", async () => {
    const failing = await runJob({
      name: "t-retry",
      run: async () => {
        throw new Error("once")
      },
    })
    const next = await runJob({ name: "t-retry", run: async () => 1 })
    expect([failing, next]).toEqual(["failed", "done"])
  })

  test("skips while another run holds the lock, and runs after it lets go", async () => {
    const release = await takeJobLock("t-held")
    if (!release) throw new Error("lock was taken before the test")
    let ran = 0
    const job = {
      name: "t-held",
      run: async () => {
        ran += 1
        return 1
      },
    }
    expect(await runJob(job)).toBe("skipped")
    expect(ran).toBe(0)
    await release()
    expect(await runJob(job)).toBe("done")
    expect(ran).toBe(1)
  })

  test("two runs at once do the work once", async () => {
    let ran = 0
    const job = {
      name: "t-parallel",
      run: async () => {
        ran += 1
        await Bun.sleep(100)
        return 1
      },
    }
    const outcomes = await Promise.all([runJob(job), runJob(job)])
    expect(outcomes.toSorted()).toEqual(["done", "skipped"])
    expect(ran).toBe(1)
  })

  test("different jobs do not block each other", async () => {
    const release = await takeJobLock("t-a")
    try {
      expect(await runJob({ name: "t-b", run: async () => 0 })).toBe("done")
    } finally {
      await release?.()
    }
  })
})
