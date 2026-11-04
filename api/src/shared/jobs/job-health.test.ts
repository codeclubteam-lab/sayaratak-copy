import { afterEach, describe, expect, test } from "bun:test"

import {
  failingJobs,
  FAILURES_BEFORE_UNREADY,
  jobsIdle,
  recordOutcome,
  resetJobHealth,
  trackRun,
} from "./job-health"
import { runJob } from "./run-job"

afterEach(resetJobHealth)

const fails = () =>
  runJob({ name: "t-streak", run: () => Promise.reject(new Error("no")) })

describe("failing jobs", () => {
  test("a job is failing after three failed passes in a row, not before", () => {
    for (let i = 1; i < FAILURES_BEFORE_UNREADY; i++) {
      recordOutcome("a", "failed")
      expect(failingJobs()).toEqual([])
    }
    recordOutcome("a", "failed")
    expect(failingJobs()).toEqual(["a"])
  })

  test("one good pass clears the streak; a skipped pass changes nothing", () => {
    recordOutcome("a", "failed")
    recordOutcome("a", "failed")
    recordOutcome("a", "skipped")
    recordOutcome("a", "failed")
    expect(failingJobs()).toEqual(["a"])
    recordOutcome("a", "skipped")
    expect(failingJobs()).toEqual(["a"])
    recordOutcome("a", "done")
    expect(failingJobs()).toEqual([])
    recordOutcome("a", "failed")
    expect(failingJobs()).toEqual([])
  })

  test("jobs are counted apart", () => {
    for (let i = 0; i < 3; i++) recordOutcome("a", "failed")
    recordOutcome("b", "failed")
    expect(failingJobs()).toEqual(["a"])
  })

  test("runJob feeds the streak: three crashes make the job failing", async () => {
    for (let i = 0; i < 3; i++) expect(await fails()).toBe("failed")
    expect(failingJobs()).toEqual(["t-streak"])
    expect(await runJob({ name: "t-streak", run: async () => 1 })).toBe("done")
    expect(failingJobs()).toEqual([])
  })
})

describe("jobsIdle", () => {
  test("resolves at once with nothing running", async () => {
    await jobsIdle()
  })

  test("waits for a running pass, also one that fails, and one that starts meanwhile", async () => {
    let finished = 0
    trackRun(Bun.sleep(30).then(() => finished++))
    trackRun(Bun.sleep(10).then(() => Promise.reject(new Error("x"))))
    const idle = jobsIdle()
    trackRun(Bun.sleep(60).then(() => finished++))
    await idle
    expect(finished).toBe(2)
  })

  test("runJob is tracked, so shutdown waits for a slow job", async () => {
    let done = false
    const pass = runJob({
      name: "t-slow",
      run: async () => {
        await Bun.sleep(50)
        done = true
        return 1
      },
    })
    await jobsIdle()
    expect(done).toBe(true)
    await pass
  })
})
