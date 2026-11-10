import { QueryClient } from "@tanstack/react-query"
import type { TFunction } from "i18next"
import { afterEach, describe, expect, it, vi } from "vitest"

import { ApiError, buildUrl, errorFrom } from "@/lib/api/client"
import { errorText } from "@/lib/api/error-text"
import { patchRows } from "@/lib/api/mutation"
import { setCookie } from "@/lib/cookie"
import { buildCsp } from "@/lib/csp"
import {
  formatMonthYear,
  formatShortDate,
  formatTime,
  formatWeekday,
  initials,
} from "@/lib/format"
import { khartoumDay } from "@/lib/hours"
import { averageColor } from "@/lib/image-process"
import { mediaSrc } from "@/lib/media"
import { personalHref } from "@/lib/navigation"
import { markSignIn, takeSignIn } from "@/lib/sign-in-flag"
import { safeBackground } from "@/lib/slide"
import { db } from "@/mocks/db"
import { publicUser } from "@/mocks/lib"

const iso = "2026-10-04T10:05:00.000Z" // 12:05 in Khartoum

describe("format", () => {
  it("formatTime reads the Khartoum clock with Latin digits", () => {
    expect(formatTime(iso, "en")).toMatch(/12:05/)
    expect(formatTime(iso, "ar")).toMatch(/12:05/)
  })
  it("formatMonthYear names the month", () => {
    expect(formatMonthYear(iso, "en")).toBe("October 2026")
    expect(formatMonthYear(iso, "ar")).toMatch(/2026/)
  })
  it("formatWeekday counts from Sunday", () => {
    expect(formatWeekday(0, "en")).toBe("Sunday")
    expect(formatWeekday(6, "en")).toBe("Saturday")
    expect(formatWeekday(5, "ar")).toBe("الجمعة")
  })
  it("formatShortDate gives day and month", () => {
    expect(formatShortDate(iso, "en")).toBe("Oct 4")
  })
  it("initials takes the first letter of the first two words", () => {
    expect(initials("Omar Hassan Ali")).toBe("OH")
    expect(initials("عمر حسن")).toBe("عح")
  })
})

it("khartoumDay moves to the next day at 22:00 UTC", () => {
  expect(khartoumDay(Date.parse("2026-10-03T21:59:00Z"))).toBe(6) // Saturday
  expect(khartoumDay(Date.parse("2026-10-03T22:00:00Z"))).toBe(0) // Sunday
})

it("mediaSrc fills the width into a template and leaves a plain url alone", () => {
  expect(mediaSrc("/mock/a-{w}.webp", 640)).toBe("/mock/a-640.webp")
  expect(mediaSrc("/a.webp", 640)).toBe("/a.webp")
})

it("personalHref sends a visitor to sign in with a return path", () => {
  const me = publicUser(db.users.find((u) => u.id === "u-omar")!)
  expect(personalHref("/account/favorites", "en", me)).toBe(
    "/en/account/favorites"
  )
  expect(personalHref("/account/favorites", "ar", null)).toBe(
    "/ar/auth/login?redirect=%2Far%2Faccount%2Ffavorites"
  )
})

it("safeBackground keeps dark colors and drops ones too light for white text", () => {
  const slide = {
    id: "s",
    kind: "house" as const,
    title: "T",
    cta: { label: "L", href: "/" },
  }
  vi.spyOn(console, "warn").mockImplementation(() => {})
  expect(safeBackground({ ...slide, background: "#0b3d2e" })).toBe("#0b3d2e")
  expect(safeBackground({ ...slide, background: "#ffff00" })).toBeUndefined()
  expect(safeBackground({ ...slide, background: "var(--x)" })).toBe("var(--x)")
  expect(safeBackground(slide)).toBeUndefined()
})

it("averageColor falls back to a neutral when no canvas is available", () => {
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null)
  expect(averageColor(document.createElement("canvas"))).toBe("#c9d3cf")
})

describe("sign in flag", () => {
  it("is taken once", () => {
    markSignIn()
    expect(takeSignIn()).toBe(true)
    expect(takeSignIn()).toBe(false)
  })
  it("reads false when storage is blocked", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked")
    })
    expect(takeSignIn()).toBe(false)
  })
})

it("setCookie writes a lax cookie for the whole site", () => {
  setCookie("listing_view", "row", 60)
  expect(document.cookie).toContain("listing_view=row")
})

describe("api client", () => {
  it("buildUrl skips empty values and repeats arrays", () => {
    expect(
      buildUrl("/listings", {
        q: "",
        page: 2,
        fuel: ["diesel", "petrol"],
        city: null,
      })
    ).toBe("/api/v1/listings?page=2&fuel=diesel&fuel=petrol")
    expect(buildUrl("/me")).toBe("/api/v1/me")
    vi.stubEnv("VITE_API_BASE_URL", "https://api.example.sd/")
    expect(buildUrl("/me")).toBe("https://api.example.sd/api/v1/me")
    vi.unstubAllEnvs()
  })
  it("buildCsp includes Cloudinary and the API origin in img, media and connect sources", () => {
    const policy = buildCsp("test-nonce", {
      apiBaseUrl: "https://api.example.sd/v1",
      imageOrigins: "https://res.cloudinary.com https://cdn.example.sd",
    })
    expect(policy).toContain("script-src 'self' 'nonce-test-nonce'")
    expect(policy).toContain(
      "img-src 'self' data: blob: https://tile.openstreetmap.org https://res.cloudinary.com https://api.example.sd https://cdn.example.sd;"
    )
    expect(policy).toContain(
      "media-src 'self' blob: https://res.cloudinary.com https://api.example.sd;"
    )
    expect(policy).toContain("connect-src 'self' https://api.example.sd;")
  })
  it("errorFrom reads the error body, or calls it a server error", () => {
    const e = errorFrom(422, {
      code: "validation",
      fields: { email: "validation.email" },
      retryAfter: 5,
    })
    expect(e).toMatchObject({
      status: 422,
      code: "validation",
      fields: { email: "validation.email" },
      retryAfter: 5,
    })
    expect(errorFrom(502, "<html>")).toMatchObject({
      status: 502,
      code: "server_error",
    })
  })
  it("errorText gives the actionable codes their own message", () => {
    const t = ((key: string) => key) as TFunction
    expect(errorText(t, new ApiError(409, "already_reviewed"))).toBe(
      "reviews.already_reviewed"
    )
    expect(errorText(t, new ApiError(403, "forbidden"))).toBe("error.forbidden")
    expect(errorText(t, new ApiError(409, "in_use"))).toBe("admin.in_use")
    expect(errorText(t, new ApiError(503, "offline"))).toBe("error.offline")
    expect(errorText(t, new ApiError(409, "bump_wait"))).toBe(
      "billing.bump_wait"
    )
    expect(errorText(t, new ApiError(409, "payment_pending"))).toBe(
      "billing.payment_pending"
    )
    expect(errorText(t, new ApiError(500, "server_error"))).toBe(
      "toast.error_save"
    )
    expect(errorText(t, new Error("x"))).toBe("toast.error_save")
  })
  it("patchRows edits a row in pages, lists and detail caches", () => {
    const qc = new QueryClient()
    qc.setQueryData(["l", "page"], {
      items: [
        { id: "a", n: 1 },
        { id: "b", n: 1 },
      ],
      total: 2,
    })
    qc.setQueryData(["l", "list"], [{ id: "a", n: 1 }])
    qc.setQueryData(["l", "a"], { id: "a", n: 1 })
    qc.setQueryData(["l", "b"], { id: "b", n: 1 })
    patchRows(qc, ["l"], (id) => id === "a", { n: 2 })
    expect(qc.getQueryData(["l", "page"])).toEqual({
      items: [
        { id: "a", n: 2 },
        { id: "b", n: 1 },
      ],
      total: 2,
    })
    expect(qc.getQueryData(["l", "list"])).toEqual([{ id: "a", n: 2 }])
    expect(qc.getQueryData(["l", "a"])).toEqual({ id: "a", n: 2 })
    expect(qc.getQueryData(["l", "b"])).toEqual({ id: "b", n: 1 })
  })
})

afterEach(() => vi.restoreAllMocks())
