import { describe, expect, test } from "bun:test"

import { DEFAULT_HOURS, isOpenNow } from "./hours"

// Khartoum is UTC+2, so 07:30 UTC is 09:30 there. 2026-11-01 is a Sunday (day 0).
const at = (instant: string) => new Date(instant)

describe("isOpenNow", () => {
  test("is open inside the hours and closed at closing time sharp", () => {
    expect(isOpenNow(DEFAULT_HOURS, at("2026-11-01T07:30:00Z"))).toBe(true)
    expect(isOpenNow(DEFAULT_HOURS, at("2026-11-01T06:00:00Z"))).toBe(true)
    expect(isOpenNow(DEFAULT_HOURS, at("2026-11-01T15:59:00Z"))).toBe(true)
    expect(isOpenNow(DEFAULT_HOURS, at("2026-11-01T16:00:00Z"))).toBe(false)
    expect(isOpenNow(DEFAULT_HOURS, at("2026-11-01T05:59:00Z"))).toBe(false)
  })

  test("reads the Khartoum day, not the UTC day", () => {
    // 22:30 UTC on Saturday is 00:30 on Sunday in Khartoum: closed at night, but Sunday's row applies.
    const sundayOnly = DEFAULT_HOURS.map((row) => ({
      ...row,
      closed: row.day !== 0,
      open: "00:00",
      close: "23:59",
    }))
    expect(isOpenNow(sundayOnly, at("2026-10-31T22:30:00Z"))).toBe(true)
    expect(isOpenNow(sundayOnly, at("2026-10-31T21:30:00Z"))).toBe(false)
  })

  test("is closed on a closed day, and on the default Friday", () => {
    expect(isOpenNow(DEFAULT_HOURS, at("2026-11-06T07:30:00Z"))).toBe(false)
    expect(DEFAULT_HOURS.filter((row) => row.closed)).toEqual([
      { day: 5, closed: true, open: "08:00", close: "18:00" },
    ])
  })
})
