import { describe, expect, test } from "bun:test"

import { expectParity, normalizeTimes } from "./parity"

const at = "2026-10-31T10:00:00.000Z"

describe("parity harness", () => {
  test("GET /api/health/live matches a stub mock", async () => {
    await expectParity("/api/health/live", {
      mock: async () => Response.json({ ok: true }),
    })
  })

  test("a different body fails the comparison", async () => {
    const run = expectParity("/api/health/live", {
      mock: async () => Response.json({ ok: false }),
    })
    expect(await run.catch((error) => error)).toBeInstanceOf(Error)
  })

  test("a different status fails the comparison", async () => {
    const run = expectParity("/api/health/live", {
      mock: async () => Response.json({ ok: true }, { status: 201 }),
    })
    expect(await run.catch((error) => error)).toBeInstanceOf(Error)
  })

  test("times a few seconds apart read as equal, at any depth", () => {
    const actual = { rows: [{ at: "2026-10-31T10:00:03.200Z", n: 1 }] }
    const expected = { rows: [{ at, n: 1 }] }
    expect(normalizeTimes(actual, expected)).toEqual(expected)
  })

  test("times further apart stay different", () => {
    const actual = { at: "2026-10-31T10:00:06.000Z" }
    expect(normalizeTimes(actual, { at })).toEqual(actual)
  })
})
