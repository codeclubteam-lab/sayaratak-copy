import { fireEvent, screen, waitFor, within } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { PaymentsPage } from "@/features/admin-payments/components/payments-page"
import { toast } from "@/components/ui/toast"
import { NowProvider } from "@/lib/now"
import { db, find, resetDb } from "@/mocks/db"
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

const open = (path = "/en/admin/payments") =>
  renderShell(
    <NowProvider serverNow={Date.now()}>
      <PaymentsPage />
    </NowProvider>,
    { role: "admin", path }
  )
const sheet = () => screen.findByRole("dialog", { name: "Payment" })
const pending = () => db.payments.filter((p) => p.status === "pending_review")
const firstPending = (type: "plan" | "promotion") =>
  pending().find((p) => p.itemType === type)!
const summaryCard = async (label: string) => {
  const strip = await screen.findByRole("region", { name: "Payments summary" })
  return within(strip).getByText(label).parentElement!
}

describe("PaymentsPage", () => {
  it("opens on Pending with every waiting payment and a summary that matches the DB", async () => {
    await open()
    const table = await screen.findByRole("table", { name: "Payments" })
    expect(pending().length).toBeGreaterThan(0)
    await waitFor(() =>
      expect(within(table).getAllByRole("row")).toHaveLength(
        pending().length + 1
      )
    )
    const count = await summaryCard("Waiting for review")
    await waitFor(() =>
      expect(count.textContent).toContain(String(pending().length))
    )
    const amount = pending()
      .reduce((sum, p) => sum + p.amount, 0)
      .toLocaleString("en")
    expect((await summaryCard("Amount waiting")).textContent).toContain(amount)
    fireEvent.click(
      within(table).getByRole("button", { name: pending()[0]!.reference })
    )
    const panel = await sheet()
    expect(within(panel).getByText("Check on the receipt")).toBeTruthy()
    expect(within(panel).getByText(pending()[0]!.transactionRef)).toBeTruthy()
  })

  it("approving a plan asks first, starts the plan, tells the payer and updates the summary", async () => {
    const add = vi.spyOn(toast, "add")
    const pay = firstPending("plan")
    const before = pending().length
    await open(`/en/admin/payments?id=${pay.id}`)
    const panel = await sheet()
    fireEvent.click(
      await within(panel).findByRole("button", { name: "Approve" })
    )
    const confirm = await screen.findByRole("alertdialog")
    expect(confirm.textContent).toContain(`Activate ${pay.itemLabel.en} plan`)
    fireEvent.click(within(confirm).getByRole("button", { name: "Approve" }))
    await waitFor(() => expect(pay.status).toBe("approved"))
    const sub = db.subscriptions.find(
      (s) => s.userId === pay.userId && s.status === "active"
    )
    expect(sub?.planId).toBe(pay.itemId)
    expect(
      db.notifications.some(
        (n) => n.userId === pay.userId && n.type === "payment_approved"
      )
    ).toBe(true)
    await waitFor(() =>
      expect(add).toHaveBeenCalledWith({ title: "Payment approved" })
    )
    const count = await summaryCard("Waiting for review")
    await waitFor(() => expect(count.textContent).toContain(String(before - 1)))
  })

  it("approving a bump puts the listing back on top of the newest", async () => {
    const pay = firstPending("promotion")
    const promo = find(db.promotions, pay.itemId)!
    expect(promo).toMatchObject({ type: "bump", status: "pending_payment" })
    await open(`/en/admin/payments?id=${pay.id}`)
    const panel = await sheet()
    expect(
      await within(panel).findByRole("link", { name: "Open listing" })
    ).toBeTruthy()
    fireEvent.click(within(panel).getByRole("button", { name: "Approve" }))
    fireEvent.click(
      within(await screen.findByRole("alertdialog")).getByRole("button", {
        name: "Approve",
      })
    )
    await waitFor(() => expect(promo.status).toBe("ended"))
    const listing = find(db.listings, promo.listingId)!
    expect(listing.bumpedAt).toBe(promo.startsAt)
  })

  it("Reject needs a reason, stores it and tells the payer; the promotion stays unpaid", async () => {
    const pay = firstPending("promotion")
    await open(`/en/admin/payments?id=${pay.id}`)
    const panel = await sheet()
    fireEvent.click(
      await within(panel).findByRole("button", { name: "Reject" })
    )
    const dialog = await screen.findByRole("dialog", {
      name: "Reject this payment?",
    })
    fireEvent.click(within(dialog).getByRole("button", { name: "Reject" }))
    expect(
      await within(dialog).findByText("This field is required")
    ).toBeTruthy()
    fireEvent.click(
      within(dialog).getByRole("button", {
        name: "Transaction number not found",
      })
    )
    fireEvent.click(within(dialog).getByRole("button", { name: "Reject" }))
    await waitFor(() => expect(pay.status).toBe("rejected"))
    expect(pay.rejectionReason).toBe("Transaction number not found")
    expect(find(db.promotions, pay.itemId)!.status).toBe("pending_payment")
    expect(
      db.notifications.some(
        (n) => n.userId === pay.userId && n.type === "payment_rejected"
      )
    ).toBe(true)
  })

  it("a rejected payment is read only, shows its reason, and its receipt opens zoomable", async () => {
    const pay = db.payments.find((p) => p.status === "rejected")!
    expect(db.uploads.get(pay.receiptUrl.split("/").pop()!)?.type).toBe(
      "image/svg+xml"
    )
    await open(`/en/admin/payments?tab=rejected&id=${pay.id}`)
    const panel = await sheet()
    expect(await within(panel).findByText(pay.rejectionReason!)).toBeTruthy()
    expect(within(panel).queryByRole("button", { name: "Approve" })).toBeNull()
    fireEvent.click(
      within(panel).getByRole("button", {
        name: "Open the receipt full screen",
      })
    )
    const zoom = await screen.findByRole("button", { name: "Zoom" })
    fireEvent.click(zoom)
    expect(zoom.getAttribute("aria-pressed")).toBe("true")
  })

  it("an unknown id says the payment is gone", async () => {
    await open("/en/admin/payments?id=pay-none")
    const panel = await sheet()
    expect(
      await within(panel).findByText("This payment no longer exists.")
    ).toBeTruthy()
  })
})
