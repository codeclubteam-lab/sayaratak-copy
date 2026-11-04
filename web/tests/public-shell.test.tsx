import { fireEvent, screen, waitFor, within } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { usePrefs } from "@/lib/prefs"
import { setFailMode } from "@/lib/api/dev-flags"
import { Header } from "@/components/app/header"
import { MobileTabBar } from "@/components/app/mobile-tab-bar"
import { Footer } from "@/components/app/footer"
import { DataSaverToggle } from "@/components/app/data-saver-toggle"
import { LanguageSwitcher } from "@/components/app/language-switcher"
import { BrandLogo } from "@/components/app/brand-logo"
import { PublicLayout } from "@/components/app/public-layout"
import { db, resetDb } from "@/mocks/db"
import { renderShell } from "./shell-render"

beforeEach(() => {
  resetDb()
  setFailMode("none")
  document.cookie = "data_saver=; Path=/; Max-Age=0"
})
afterEach(() => {
  setFailMode("none")
  vi.unstubAllGlobals()
})

function PreferenceProbe() {
  const { dataSaver } = usePrefs()
  return <output>{dataSaver ? "saving data" : "default preference"}</output>
}

describe("public shell", () => {
  it("provides landmarks and moves skip-link focus to the main content", async () => {
    await renderShell(<PublicLayout />)
    expect(screen.getByRole("banner")).toBeTruthy()
    expect(screen.getByRole("contentinfo")).toBeTruthy()
    fireEvent.click(screen.getByRole("link", { name: "Skip to content" }))
    expect(document.activeElement).toBe(screen.getByRole("main"))
  })
  it("keeps the wordmark visible until a logo loads, including an early image failure", async () => {
    await renderShell(<BrandLogo />)
    const home = screen.getByRole("link", { name: /Home/ })
    const image = home.querySelector("img")
    const wordmark = screen.getByText("Sayaratak")
    if (!image) throw new Error("Expected logo element")
    expect(wordmark.classList.contains("invisible")).toBe(false)
    expect(image.classList.contains("invisible")).toBe(true)
    fireEvent.load(image)
    expect(wordmark.classList.contains("invisible")).toBe(true)
    fireEvent.error(image)
    expect(wordmark.classList.contains("invisible")).toBe(false)
  })
  it("stops preloading the home link when data saver is enabled", async () => {
    const { router } = await renderShell(
      <>
        <BrandLogo />
        <DataSaverToggle />
      </>,
      { path: "/en/search" }
    )
    const preload = vi.spyOn(router, "preloadRoute")
    const home = screen.getByRole("link", { name: /Home/ })
    fireEvent.mouseEnter(home)
    await waitFor(() => expect(preload).toHaveBeenCalledOnce())
    fireEvent.mouseLeave(home)
    fireEvent.click(screen.getByRole("button", { name: "Data saver" }))
    fireEvent.mouseEnter(home)
    await new Promise((resolve) => window.setTimeout(resolve, 100))
    expect(preload).toHaveBeenCalledOnce()
  })
  it("preserves path, repeated search params and hash in the language link", async () => {
    await renderShell(<LanguageSwitcher />, {
      locale: "ar",
      path: "/ar/search?city=x&city=y#results",
    })
    expect(
      screen.getByRole("link", { name: "English" }).getAttribute("href")
    ).toBe("/en/search?city=x&city=y#results")
  })
  it("persists data saver, updates rendering and disables intent preloading", async () => {
    const { router, unmount } = await renderShell(
      <>
        <DataSaverToggle />
        <PreferenceProbe />
      </>
    )
    fireEvent.click(screen.getByRole("button", { name: "Data saver" }))
    expect(document.cookie).toContain("data_saver=1")
    expect(screen.getByText("saving data")).toBeTruthy()
    expect(
      screen
        .getByRole("button", { name: "Data saver" })
        .getAttribute("aria-pressed")
    ).toBe("true")
    await waitFor(() => expect(router.options.defaultPreload).toBe(false))
    unmount()
    await renderShell(
      <>
        <DataSaverToggle />
        <PreferenceProbe />
      </>,
      {
        prefs: {
          dataSaver: document.cookie.includes("data_saver=1"),
          listingView: "grid",
        },
      }
    )
    expect(screen.getByText("saving data")).toBeTruthy()
    fireEvent.click(screen.getByRole("button", { name: "Data saver" }))
    expect(document.cookie).toContain("data_saver=0")
    expect(screen.getByText("default preference")).toBeTruthy()
  })
  it("shows public posting and preserves a visitor's personal destination", async () => {
    await renderShell(<Header />)
    expect(
      screen.getByRole("link", { name: "Post a listing" }).getAttribute("href")
    ).toBe("/en/post")
    expect(
      screen.getByRole("link", { name: "Favorites" }).getAttribute("href")
    ).toBe("/en/auth/login?redirect=%2Fen%2Faccount%2Ffavorites")
  })
  it("uses the dealer wizard and real unread notification count", async () => {
    await renderShell(<Header />, { role: "dealership" })
    expect(
      screen.getByRole("link", { name: "Post a listing" }).getAttribute("href")
    ).toBe("/en/dealer/inventory/new")
    fireEvent.click(
      await screen.findByRole("button", { name: /Notifications, \d+ unread/ })
    )
    expect(
      (await screen.findByRole("link", { name: "See all" })).getAttribute(
        "href"
      )
    ).toBe("/en/dealer/notifications")
  })
  it.each(["workshop", "mechanic", "admin"] as const)(
    "hides posting for %s",
    async (role) => {
      await renderShell(
        <>
          <Header />
          <MobileTabBar />
        </>,
        { role }
      )
      expect(screen.queryByRole("link", { name: "Post a listing" })).toBeNull()
      expect(screen.queryByRole("link", { name: "Post" })).toBeNull()
    }
  )
  it("opens the translated sheet and closes it with Escape", async () => {
    await renderShell(<Header />, { locale: "ar" })
    fireEvent.click(screen.getByRole("button", { name: "القائمة" }))
    const dialog = await screen.findByRole("dialog")
    expect(
      within(dialog).getByRole("link", { name: "سيارات" }).getAttribute("href")
    ).toBe("/ar/vehicles/cars/sale")
    expect(within(dialog).getByRole("button", { name: "إغلاق" })).toBeTruthy()
    fireEvent.keyDown(dialog, { key: "Escape" })
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull())
  })
  it("signs out through the mock API and clears the account view", async () => {
    const { client } = await renderShell(<Header />, { role: "user" })
    fireEvent.click(screen.getByRole("button", { name: "Account" }))
    fireEvent.click(await screen.findByRole("menuitem", { name: "Sign out" }))
    await waitFor(() =>
      expect(screen.getByRole("link", { name: "Sign in" })).toBeTruthy()
    )
    expect(client.getQueryData(["me"])).toBeNull()
  })
  it.each(["/en/account", "/en/dealer/inventory/new", "/en/post"])(
    "hides mobile tabs on %s",
    async (path) => {
      await renderShell(<MobileTabBar />, { path })
      expect(screen.queryByRole("navigation")).toBeNull()
    }
  )
  it("loads contact details and locales from the site endpoint without exposing admin settings", async () => {
    db.settings.contact.email = "test@example.com"
    await renderShell(<Footer />)
    expect(
      (
        await screen.findByRole("link", { name: "test@example.com" })
      ).getAttribute("href")
    ).toBe("mailto:test@example.com")
    const data: unknown = await (await fetch("/api/site")).json()
    expect(data).toEqual({
      contact: db.settings.contact,
      locales: db.settings.locales,
    })
  })
  it("keeps footer links usable after a contact failure and recovers on retry", async () => {
    setFailMode("500")
    await renderShell(<Footer />)
    expect(
      await screen.findByText("Could not load contact details. Try again.")
    ).toBeTruthy()
    expect(
      screen.getByRole("link", { name: "Cars" }).getAttribute("href")
    ).toBe("/en/vehicles/cars/sale")
    setFailMode("none")
    fireEvent.click(screen.getByRole("button", { name: "Try again" }))
    expect(
      await screen.findByRole("link", { name: db.settings.contact.email })
    ).toBeTruthy()
  })
})
