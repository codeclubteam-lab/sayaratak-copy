import { describe, expect, spyOn, test } from "bun:test"

import { jobs } from "./index"
import { defineJob, JOBS_TIME_ZONE, startJobs } from "./scheduler"

describe("startJobs", () => {
  test("schedules each job in the Khartoum time zone and stops them all", () => {
    const started: string[] = []
    const stopped: string[] = []
    const cron = spyOn(Bun, "cron").mockImplementation(((
      schedule: string,
      _handler: unknown,
      options?: { tz?: string }
    ) => {
      const label = `${schedule} ${options?.tz}`
      started.push(label)
      return {
        stop() {
          stopped.push(label)
          return this
        },
      }
    }) as unknown as typeof Bun.cron)
    const expected = [
      "*/5 * * * * Africa/Khartoum",
      "0 9 * * * Africa/Khartoum",
    ]
    try {
      const stop = startJobs([
        defineJob({ name: "a", schedule: "*/5 * * * *", run: async () => 0 }),
        defineJob({ name: "b", schedule: "0 9 * * *", run: async () => 0 }),
      ])
      expect(started).toEqual(expected)
      expect(stopped).toEqual([])
      stop()
      expect(stopped).toEqual(expected)
    } finally {
      cron.mockRestore()
    }
  })

  test("a bad schedule stops the boot instead of never firing", () => {
    const bad = defineJob({
      name: "bad",
      schedule: "not a cron",
      run: async () => 0,
    })
    expect(() => startJobs([bad])).toThrow()
  })
})

describe("the job registry", () => {
  test("names are unique and every schedule has a next run in Khartoum", () => {
    const names = jobs.map((job) => job.name)
    expect(new Set(names).size).toBe(names.length)
    for (const job of jobs) {
      const next = Bun.cron.parse(job.schedule, Date.now(), {
        tz: JOBS_TIME_ZONE,
      })
      expect(next, job.name).toBeInstanceOf(Date)
    }
  })
})
