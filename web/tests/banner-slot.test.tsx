import { act, fireEvent, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, expect, it, vi } from "vitest"

import { BannerSlot } from "@/components/app/banner-slot"
import { setFailMode, setLatency } from "@/lib/api/dev-flags"
import { db, resetDb } from "@/mocks/db"
import { renderShell } from "./shell-render"

const observers: Array<(entries: { isIntersecting: boolean }[]) => void> = []
beforeEach(() => {
  resetDb()
  setFailMode("none")
  setLatency(null)
  observers.length = 0
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      constructor(callback: (entries: { isIntersecting: boolean }[]) => void) {
        observers.push(callback)
      }
      observe() {}
      disconnect() {}
    }
  )
})
afterEach(() => {
  setFailMode("none")
  setLatency(null)
  vi.unstubAllGlobals()
})

it("logs one visible impression and a separate click through the real event handler", async () => {
  const banner = db.banners.find((row) => row.placement === "home_top")
  if (!banner) throw new Error("Expected seeded home banner")
  const views = banner.impressions
  const clicks = banner.clicks
  await renderShell(<BannerSlot placement="home_top" />)
  const requests = vi.spyOn(globalThis, "fetch")
  const link = await screen.findByRole("link", {
    name: /Summer offers on cars/,
  })
  expect(link.getAttribute("href")).toBe("/en/search?type=car")
  expect(banner.impressions).toBe(views)
  act(() => {
    for (const observer of observers) observer([{ isIntersecting: false }])
  })
  expect(banner.impressions).toBe(views)
  act(() => {
    for (const observer of observers) observer([{ isIntersecting: true }])
  })
  await waitFor(() => expect(banner.impressions).toBe(views + 1))
  act(() => {
    for (const observer of observers) observer([{ isIntersecting: true }])
  })
  expect(banner.impressions).toBe(views + 1)
  fireEvent.click(link)
  await waitFor(() => expect(banner.clicks).toBe(clicks + 1))
  expect(requests).toHaveBeenCalledWith(
    expect.any(String),
    expect.objectContaining({ keepalive: true })
  )
})

it("renders nothing for an empty placement", async () => {
  db.banners.length = 0
  const { client } = await renderShell(<BannerSlot placement="search_top" />)
  await waitFor(() => expect(client.isFetching()).toBe(0))
  expect(screen.queryByRole("complementary")).toBeNull()
})

it("delays the loading skeleton and replaces it with the banner", async () => {
  setLatency(350)
  await renderShell(<BannerSlot placement="home_top" />)
  expect(screen.queryByLabelText("Loading advertisement")).toBeNull()
  expect(await screen.findByLabelText("Loading advertisement")).toBeTruthy()
  expect(
    await screen.findByRole("link", { name: /Summer offers on cars/ })
  ).toBeTruthy()
})

it("shows real text in the page language and an Ad chip only on a paid banner", async () => {
  await renderShell(<BannerSlot placement="home_middle" />)
  const link = await screen.findByRole("link", {
    name: /Move more with the right truck/,
  })
  expect(link.textContent).toContain("See trucks")
  expect(screen.getByText("Ad")).toBeTruthy()
  expect(link.querySelector("img")?.getAttribute("alt")).toBe("")
})

it("shows the Arabic text and no Ad chip on a house banner", async () => {
  await renderShell(<BannerSlot placement="directory_top" />, { locale: "ar" })
  const link = await screen.findByRole("link", {
    name: /سجّل معرضك أو ورشتك مجانًا/,
  })
  expect(link.getAttribute("href")).toBe("/ar/onboarding")
  expect(screen.queryByText("إعلان")).toBeNull()
})

it("keeps a translated fallback and destination for an image-only banner when the file is absent", async () => {
  const banner = db.banners.find((row) => row.placement === "home_top")
  if (!banner) throw new Error("Expected seeded home banner")
  banner.copy = undefined
  banner.imageUrl = { ar: "/mock/old-ar.webp", en: "/mock/old-en.webp" }
  await renderShell(<BannerSlot placement="home_top" />, { locale: "ar" })
  const link = await screen.findByRole("link", { name: "عرض الإعلان المدفوع" })
  const image = link.querySelector("img")
  if (!image) throw new Error("Expected banner image")
  expect(image.getAttribute("src")).toContain("-ar.webp")
  fireEvent.error(image)
  expect(screen.getByText("إعلان مدفوع")).toBeTruthy()
  expect(link.getAttribute("href")).toBe("/ar/search?type=car")
})

it("offers retry after a failed banner request and recovers", async () => {
  setFailMode("500")
  await renderShell(<BannerSlot placement="home_top" />)
  expect(
    await screen.findByText("Could not load advertisements. Try again.")
  ).toBeTruthy()
  setFailMode("none")
  fireEvent.click(screen.getByRole("button", { name: "Try again" }))
  expect(
    await screen.findByRole("link", { name: /Summer offers on cars/ })
  ).toBeTruthy()
})

it("shows every home banner as one carousel slide and counts a view after a second and a click", async () => {
  const banner = db.banners.find((row) => row.placement === "home_top")
  if (!banner) throw new Error("Expected seeded home banner")
  const views = banner.impressions
  const clicks = banner.clicks
  await renderShell(<BannerSlot placement="home_top" variant="hero" />)
  const link = await screen.findByRole("link", { name: /Browse cars/ })
  expect(document.querySelectorAll("[data-dot]")).toHaveLength(
    db.banners.filter((row) => row.placement === "home_top").length
  )
  expect(banner.impressions).toBe(views)
  await waitFor(() => expect(banner.impressions).toBe(views + 1), {
    timeout: 3000,
  })
  fireEvent.click(link)
  await waitFor(() => expect(banner.clicks).toBe(clicks + 1))
})
