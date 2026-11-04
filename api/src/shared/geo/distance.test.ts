import { describe, expect, test } from "bun:test"

import { haversineKm } from "./distance"

describe("haversineKm", () => {
  test("is 0 between a point and itself", () => {
    expect(
      haversineKm({ lat: 15.5, lng: 32.5 }, { lat: 15.5, lng: 32.5 })
    ).toBe(0)
  })

  test("is about 111 km for one degree of latitude", () => {
    const km = haversineKm({ lat: 15, lng: 32 }, { lat: 16, lng: 32 })
    expect(km).toBeGreaterThan(110.5)
    expect(km).toBeLessThan(111.8)
  })

  test("is the same both ways", () => {
    const a = { lat: 15.55, lng: 32.53 }
    const b = { lat: 13.18, lng: 30.22 }
    expect(haversineKm(a, b)).toBe(haversineKm(b, a))
  })
})
