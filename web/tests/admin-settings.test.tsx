import { fireEvent, screen, waitFor, within } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { SiteSettingsPage } from "@/features/admin-settings/components/site-settings-page"
import { db, resetDb } from "@/mocks/db"
import { renderShell } from "./shell-render"

Element.prototype.scrollIntoView = () => {}
window.scrollTo = () => {}

beforeEach(() => {
  resetDb()
  vi.stubGlobal("matchMedia", () => ({
    matches: false,
    addEventListener: () => {},
    removeEventListener: () => {},
  }))
})

const section = async (name: string) =>
  within(await screen.findByRole("region", { name }))

describe("SiteSettingsPage", () => {
  it("each section saves alone; a bad account number is refused", async () => {
    await renderShell(<SiteSettingsPage />, {
      role: "admin",
      path: "/en/admin/settings",
    })
    const pay = await section("Payments")
    const number = await pay.findByRole("textbox", { name: /Account number/ })
    fireEvent.change(number, { target: { value: "12ab" } })
    fireEvent.click(pay.getByRole("button", { name: "Save" }))
    expect(await pay.findByText("Enter 6 to 20 digits")).toBeTruthy()
    expect(db.settings.bankakAccount.number).toBe("1234567")
    fireEvent.change(number, { target: { value: "9988776655" } })
    fireEvent.click(pay.getByRole("button", { name: "Save" }))
    await waitFor(() =>
      expect(db.settings.bankakAccount.number).toBe("9988776655")
    )
    expect(db.settings.listingExpiryDays).toBe(30)
    const listings = await section("Listings")
    fireEvent.change(
      listings.getByRole("textbox", { name: /Listing expiry/ }),
      { target: { value: "45" } }
    )
    fireEvent.click(listings.getByRole("button", { name: "Save" }))
    await waitFor(() => expect(db.settings.listingExpiryDays).toBe(45))
  })
})
