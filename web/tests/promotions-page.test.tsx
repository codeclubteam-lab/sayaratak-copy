import { fireEvent, screen, waitFor, within } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { PromotionsPage } from "@/features/billing/components/promotions-page"
import { promotionsSearchSchema } from "@/features/billing/schemas"
import { NowProvider } from "@/lib/now"
import { db, newId, resetDb } from "@/mocks/db"
import { activatePromotion } from "@/mocks/lib"
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

const dealer = () =>
  db.users.find((u) => u.role === "dealership" && u.onboardingDone)!
const waiting = () =>
  db.promotions.find(
    (p) =>
      p.status === "pending_payment" &&
      db.listings.find((l) => l.id === p.listingId)?.ownerUserId === dealer().id
  )!
const open = (search = "") =>
  renderShell(
    <NowProvider serverNow={Date.now()}>
      <PromotionsPage />
    </NowProvider>,
    { role: "dealership", path: `/en/dealer/promotions${search}` }
  )

describe("PromotionsPage", () => {
  it("falls back to the Active tab", () => {
    expect(promotionsSearchSchema.parse({ tab: "x" })).toEqual({
      tab: "active",
    })
  })

  it("shows the four prices and a Pay now link for an unpaid promotion", async () => {
    const promo = waiting()
    db.payments = db.payments.filter(
      (p) => !(p.itemType === "promotion" && p.itemId === promo.id)
    )
    await open("?tab=waiting")
    const prices = await screen.findByRole("list", {
      name: "Promotion prices",
    })
    await waitFor(() =>
      expect(within(prices).getAllByRole("listitem")).toHaveLength(4)
    )
    const [pay] = await screen.findAllByRole("link", { name: "Pay now" })
    expect(pay!.getAttribute("href")).toBe(
      `/en/dealer/billing/checkout?item=promotion%3A${promo.id}`
    )
  })

  it("a promotion whose receipt is in review shows a badge, not a link", async () => {
    const promo = waiting()
    db.payments.unshift({
      id: newId("pay"),
      userId: dealer().id,
      itemType: "promotion",
      itemId: promo.id,
      itemLabel: { en: "Pin", ar: "تثبيت" },
      amount: 50_000,
      method: "bankak_transfer",
      reference: "SY-222222",
      payerName: "Dealer",
      transactionRef: "TX123456",
      receiptUrl: "/mock/r.webp",
      status: "pending_review",
      createdAt: new Date().toISOString(),
    })
    db.payments = db.payments.filter(
      (p) =>
        !(
          p.itemType === "promotion" &&
          p.itemId === promo.id &&
          p.reference !== "SY-222222"
        )
    )
    await open("?tab=waiting")
    expect(await screen.findAllByText("Payment in review")).not.toHaveLength(0)
    expect(screen.queryByRole("link", { name: "Pay now" })).toBeNull()
  })

  it("an approved promotion moves to the Active tab", async () => {
    const promo = waiting()
    activatePromotion(promo)
    const title = db.listings.find((l) => l.id === promo.listingId)!.title
    await open()
    const table = await screen.findByRole("table", { name: "Active" })
    expect(await within(table).findByText(title)).toBeTruthy()
  })

  it("Promote a listing picks a listing, then a type, then opens its checkout", async () => {
    const { router } = await open()
    fireEvent.click(screen.getByRole("button", { name: "Promote a listing" }))
    const picker = await screen.findByRole("dialog", {
      name: "Choose a listing to promote",
    })
    const [row] = await within(picker).findAllByRole("listitem")
    fireEvent.click(within(row!).getByRole("button"))
    await screen.findByRole("radiogroup", { name: "Promote this listing" })
    fireEvent.click(screen.getByRole("radio", { name: /Bump up/ }))
    fireEvent.click(screen.getByRole("button", { name: "Continue to payment" }))
    await waitFor(() =>
      expect(router.state.location.href).toMatch(
        /\/en\/dealer\/billing\/checkout\?item=promotion%3Apromo-/
      )
    )
  })
})
