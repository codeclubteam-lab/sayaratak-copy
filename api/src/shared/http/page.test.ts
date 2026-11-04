import { describe, expect, test } from "bun:test"

import { pageParams } from "./page"

const SIZE = { default: 12, max: 100 }

describe("pageParams", () => {
  test("defaults to page 1 and the default size", () => {
    expect(pageParams({}, SIZE)).toEqual({ page: 1, pageSize: 12 })
  })

  test("reads page and pageSize, and caps the size at the maximum", () => {
    expect(pageParams({ page: "3", pageSize: "5" }, SIZE)).toEqual({
      page: 3,
      pageSize: 5,
    })
    expect(pageParams({ pageSize: "1000" }, SIZE).pageSize).toBe(100)
  })

  test("lets limit win and keeps it between 1 and 24", () => {
    expect(pageParams({ limit: "3", pageSize: "50" }, SIZE).pageSize).toBe(3)
    expect(pageParams({ limit: "90" }, SIZE).pageSize).toBe(24)
  })

  test("reads nonsense as the defaults, and keeps the size at 1 or more", () => {
    expect(pageParams({ page: "abc", pageSize: "x" }, SIZE)).toEqual({
      page: 1,
      pageSize: 12,
    })
    expect(pageParams({ page: "-4", pageSize: "-5" }, SIZE)).toEqual({
      page: 1,
      pageSize: 1,
    })
    expect(pageParams({ page: "2.9" }, SIZE).page).toBe(2)
  })
})
