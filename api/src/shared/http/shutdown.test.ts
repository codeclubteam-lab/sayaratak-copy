import { describe, expect, test } from "bun:test"

import { createShutdown, type ShutdownSteps } from "./shutdown"

function steps(over: Partial<ShutdownSteps> = {}) {
  const calls: string[] = []
  const all: ShutdownSteps = {
    onDrain: () => calls.push("drain"),
    stopJobs: () => calls.push("stop-jobs"),
    stopServer: async () => {
      calls.push("stop-server")
    },
    forceStopServer: async () => {
      calls.push("force")
    },
    jobsIdle: async () => {
      calls.push("jobs-idle")
    },
    close: [
      ["lock", () => calls.push("close-lock")],
      ["database", () => calls.push("close-database")],
    ],
    ...over,
  }
  return { calls, shutdown: createShutdown(all, 200) }
}

describe("createShutdown", () => {
  test("drains, stops the jobs and the server, then closes in order", async () => {
    const { calls, shutdown } = steps()
    expect(await shutdown()).toBe(true)
    expect(calls).toEqual([
      "drain",
      "stop-jobs",
      "stop-server",
      "jobs-idle",
      "close-lock",
      "close-database",
    ])
  })

  test("waits for a running request and a running job before closing the pool", async () => {
    const order: string[] = []
    const { shutdown } = steps({
      stopServer: async () => {
        await Bun.sleep(40)
        order.push("request-done")
      },
      jobsIdle: async () => {
        await Bun.sleep(70)
        order.push("job-done")
      },
      close: [["database", () => order.push("closed")]],
    })
    expect(await shutdown()).toBe(true)
    expect(order).toEqual(["request-done", "job-done", "closed"])
  })

  test("past the grace time it cuts the connections and still closes everything", async () => {
    const { calls, shutdown } = steps({
      jobsIdle: () => new Promise(() => undefined),
    })
    expect(await shutdown()).toBe(false)
    expect(calls).toContain("force")
    expect(calls.slice(-2)).toEqual(["close-lock", "close-database"])
  })

  test("one close step failing does not skip the next", async () => {
    const { calls, shutdown } = steps({
      close: [
        ["lock", () => Promise.reject(new Error("gone"))],
        ["database", () => calls.push("close-database")],
      ],
    })
    expect(await shutdown()).toBe(true)
    expect(calls).toContain("close-database")
  })

  test("a second signal gets the same run, nothing runs twice", async () => {
    const { calls, shutdown } = steps()
    const [first, second] = [shutdown(), shutdown()]
    expect(first).toBe(second)
    await first
    expect(calls.filter((call) => call === "stop-jobs")).toHaveLength(1)
  })
})
