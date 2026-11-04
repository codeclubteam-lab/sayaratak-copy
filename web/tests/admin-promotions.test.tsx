import { fireEvent, screen, waitFor, within } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { AdminPromotionsPage } from "@/features/admin-promotions/components/promotions-page"
import { NowProvider } from "@/lib/now"
import { db, resetDb } from "@/mocks/db"
import { handleMock } from "@/mocks/router"
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

const open = () =>
  renderShell(
    <NowProvider serverNow={Date.now()}>
      <AdminPromotionsPage />
    </NowProvider>,
    { role: "admin", path: "/en/admin/promotions" }
  )
const publicPrice = async (id: string) =>
  (
    (await (
      await handleMock(new Request("http://localhost/api/promotion-prices"))
    ).json()) as { id: string; price: number; durationDays: number }[]
  ).find((p) => p.id === id)!

describe("AdminPromotionsPage", () => {
  it("editing a price shows in the public prices", async () => {
    await open()
    fireEvent.click(
      await screen.findByRole("button", {
        name: "Edit price: Featured, 7 days",
      })
    )
    const dialog = await screen.findByRole("dialog", {
      name: "Edit price: Featured, 7 days",
    })
    const price = within(dialog).getByRole("textbox", { name: /Price/ })
    fireEvent.change(price, { target: { value: "65000" } })
    fireEvent.click(within(dialog).getByRole("button", { name: "Save" }))
    await waitFor(async () =>
      expect((await publicPrice("featured-7")).price).toBe(65000)
    )
  })

  it("grants a promotion to a picked listing, then ends it after a confirm", async () => {
    await open()
    fireEvent.click(
      await screen.findByRole("button", { name: "Grant promotion" })
    )
    const picker = await screen.findByRole("dialog", {
      name: "Choose a listing to promote",
    })
    const listing = db.listings.find((l) => l.moderation === "approved")!
    fireEvent.change(within(picker).getByRole("searchbox"), {
      target: { value: listing.title },
    })
    // The search is debounced, so under a loaded full run the default 1 s wait is too short.
    const first = await within(picker).findByRole(
      "button",
      {
        name: new RegExp(listing.title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
      },
      { timeout: 5000 }
    )
    const before = listing.promotions.length
    fireEvent.click(first)
    const grant = await screen.findByRole("dialog", {
      name: "Grant a promotion",
    })
    fireEvent.click(
      within(grant).getByRole("button", { name: "Grant promotion" })
    )
    await waitFor(() => expect(listing.promotions.length).toBe(before + 1))
    const [end] = await screen.findAllByRole("button", {
      name: `End now: ${listing.title}`,
    })
    fireEvent.click(end!)
    expect(listing.promotions.length).toBe(before + 1)
    fireEvent.click(
      within(await screen.findByRole("alertdialog")).getByRole("button", {
        name: "End now",
      })
    )
    await waitFor(() => expect(listing.promotions.length).toBe(before))
  })
})
