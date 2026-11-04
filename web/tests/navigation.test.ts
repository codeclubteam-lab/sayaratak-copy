import { describe, expect, it } from "vitest"

import {
  bannerHref,
  dashboardPath,
  isProtectedPath,
  localeHref,
  messagesPath,
  postPath,
  safeRedirect,
} from "@/lib/navigation"

it("changes only the locale segment and preserves the raw search and hash", () => {
  expect(
    localeHref("/ar/listing/hilux-abc123?city=x&city=y&q=%D8%B9#photos", "en")
  ).toBe("/en/listing/hilux-abc123?city=x&city=y&q=%D8%B9#photos")
  expect(localeHref("/en?view=row", "ar")).toBe("/ar?view=row")
  expect(localeHref("/enquiry", "ar")).toBe("/ar/enquiry")
  expect(localeHref("/", "en")).toBe("/en")
})

it("routes posting by role and hides it for service providers and admins", () => {
  expect(postPath()).toBe("/post")
  expect(postPath("user")).toBe("/post")
  expect(postPath("dealership")).toBe("/dealer/inventory/new")
  for (const role of ["workshop", "mechanic", "admin"] as const)
    expect(postPath(role)).toBeNull()
  expect(dashboardPath("dealership")).toBe("/dealer")
  expect(messagesPath("user")).toBe("/account/messages")
  expect(messagesPath("dealership")).toBe("/dealer/messages")
  expect(messagesPath("workshop")).toBe("/workshop/inquiries")
  expect(messagesPath("mechanic")).toBe("/mechanic/inquiries")
  expect(messagesPath("admin")).toBe("/account/messages")
})

it("localizes internal banner links and rejects executable or invalid destinations", () => {
  expect(bannerHref("/search?type=cars", "ar")).toBe("/ar/search?type=cars")
  expect(bannerHref("https://example.com/offers", "en")).toBe(
    "https://example.com/offers"
  )
  for (const href of [
    "javascript:alert(1)",
    "data:text/html,hello",
    "//example.com",
    "broken",
  ])
    expect(bannerHref(href, "en")).toBeNull()
})

describe("safeRedirect", () => {
  it("keeps same-site paths and drops everything else", () => {
    expect(safeRedirect("/en/account?tab=x")).toBe("/en/account?tab=x")
    for (const bad of [
      "//evil.com",
      "/\\evil.com",
      "https://evil.com",
      "/\t/evil.com",
      "evil",
      "",
    ])
      expect(safeRedirect(bad)).toBeUndefined()
    expect(safeRedirect()).toBeUndefined()
  })
})

describe("isProtectedPath", () => {
  it("flags dashboards, post and onboarding only", () => {
    for (const p of [
      "/en/account",
      "/ar/dealer/inventory",
      "/en/post",
      "/en/onboarding/role",
    ])
      expect(isProtectedPath(p)).toBe(true)
    for (const p of [
      "/en",
      "/en/vehicles/cars/sale",
      "/en/accounts",
      "/en/auth",
    ])
      expect(isProtectedPath(p)).toBe(false)
  })
})
