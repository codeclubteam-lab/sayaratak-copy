import { fireEvent, screen, waitFor, within } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { ModerationPage } from "@/features/admin-moderation/components/moderation-page"
import { toast } from "@/components/ui/toast"
import { NowProvider } from "@/lib/now"
import { db, resetDb } from "@/mocks/db"
import { renderShell } from "./shell-render"

Element.prototype.scrollIntoView = () => {}
window.scrollTo = () => {}

beforeEach(() => {
  resetDb()
  localStorage.clear()
  vi.stubGlobal("matchMedia", () => ({
    matches: false,
    addEventListener: () => {},
    removeEventListener: () => {},
  }))
})

const pending = () =>
  db.listings
    .filter((l) => l.moderation === "pending")
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
const open = (path = "/en/admin/moderation") =>
  renderShell(
    <NowProvider serverNow={Date.now()}>
      <ModerationPage />
    </NowProvider>,
    { role: "admin", path }
  )
const queue = () =>
  screen.findByRole("list", { name: "Listings waiting for review" })
const notified = (userId: string, type: string) =>
  db.notifications.some((n) => n.userId === userId && n.type === type)

// Every approve asks first (owner, 2026-10-16).
const confirmApprove = async () =>
  fireEvent.click(
    within(await screen.findByRole("alertdialog")).getByRole("button", {
      name: "Approve",
    })
  )

describe("ModerationPage", () => {
  it("lists every pending listing and opens the newest", async () => {
    await open()
    const rows = within(await queue()).getAllByRole("listitem")
    expect(rows).toHaveLength(pending().length)
    const first = pending()[0]!
    const current = within(await queue()).getByRole("button", { current: true })
    expect(current.dataset.queueRow).toBe(first.id)
  })

  it("approves: the row leaves at once, the next opens, the seller is notified", async () => {
    const add = vi.spyOn(toast, "add")
    const [first, second] = pending()
    await open()
    await queue()
    fireEvent.click(screen.getByRole("button", { name: /^Approve/ }))
    expect(db.listings.find((l) => l.id === first!.id)?.moderation).toBe(
      "pending"
    )
    await confirmApprove()
    await waitFor(() =>
      expect(
        within(
          screen.getByRole("list", { name: "Listings waiting for review" })
        ).getByRole("button", { current: true }).dataset.queueRow
      ).toBe(second!.id)
    )
    await waitFor(() =>
      expect(db.listings.find((l) => l.id === first!.id)?.moderation).toBe(
        "approved"
      )
    )
    expect(notified(first!.ownerUserId, "listing_approved")).toBe(true)
    await waitFor(() =>
      expect(add).toHaveBeenCalledWith({ title: "Listing approved" })
    )
  })

  it("rejects with a quick reason the seller sees", async () => {
    const first = pending()[0]!
    await open()
    await queue()
    fireEvent.click(screen.getByRole("button", { name: /^Reject/ }))
    const dialog = await screen.findByRole("dialog", {
      name: "Reject this listing?",
    })
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Unclear photos" })
    )
    fireEvent.click(within(dialog).getByRole("button", { name: "Reject" }))
    await waitFor(() => {
      const row = db.listings.find((l) => l.id === first.id)!
      expect(row.moderation).toBe("rejected")
      expect(row.rejectionReason).toBe("Unclear photos")
    })
    expect(notified(first.ownerUserId, "listing_rejected")).toBe(true)
  })

  it("asks before removing", async () => {
    const first = pending()[0]!
    await open()
    await queue()
    fireEvent.click(screen.getByRole("button", { name: "Remove" }))
    const dialog = await screen.findByRole("alertdialog")
    expect(db.listings.find((l) => l.id === first.id)?.moderation).toBe(
      "pending"
    )
    fireEvent.click(within(dialog).getByRole("button", { name: "Remove" }))
    await waitFor(() =>
      expect(db.listings.find((l) => l.id === first.id)?.moderation).toBe(
        "removed"
      )
    )
  })

  it("J moves down and A approves while focus is in the queue; off means off", async () => {
    const [first, second] = pending()
    await open()
    const list = await queue()
    const row = within(list).getByRole("button", { current: true })
    row.focus()
    fireEvent.keyDown(row, { code: "KeyJ" })
    await waitFor(() =>
      expect(
        within(list).getByRole("button", { current: true }).dataset.queueRow
      ).toBe(second!.id)
    )
    fireEvent.keyDown(document.activeElement!, { code: "KeyA" })
    await confirmApprove()
    await waitFor(() =>
      expect(db.listings.find((l) => l.id === second!.id)?.moderation).toBe(
        "approved"
      )
    )
    expect(db.listings.find((l) => l.id === first!.id)?.moderation).toBe(
      "pending"
    )

    fireEvent.click(screen.getByRole("button", { name: "Keyboard shortcuts" }))
    fireEvent.click(
      await screen.findByRole("switch", { name: "Use keyboard shortcuts" })
    )
    expect(localStorage.getItem("sy_review_shortcuts")).toBe("off")
    fireEvent.keyDown(within(list).getAllByRole("button")[0]!, { code: "KeyA" })
    await new Promise((r) => setTimeout(r, 50))
    expect(db.listings.find((l) => l.id === first!.id)?.moderation).toBe(
      "pending"
    )
  })

  it("approves the checked rows in one go", async () => {
    const add = vi.spyOn(toast, "add")
    const [a, b] = pending()
    await open()
    const list = await queue()
    const boxes = within(list).getAllByRole("checkbox")
    fireEvent.click(boxes[0]!)
    fireEvent.click(boxes[1]!)
    fireEvent.click(screen.getByRole("button", { name: "Approve selected" }))
    await confirmApprove()
    await waitFor(() =>
      expect(
        [a!, b!].map((l) => db.listings.find((r) => r.id === l.id)?.moderation)
      ).toEqual(["approved", "approved"])
    )
    await waitFor(() =>
      expect(add).toHaveBeenCalledWith({ title: "2 listings approved" })
    )
  })

  it("filters by seller kind in the mock", async () => {
    await open("/en/admin/moderation?sellerKind=dealership")
    const dealers = pending().filter((l) => l.owner.type === "dealership")
    expect(dealers.length).toBeGreaterThan(0)
    const list = await queue()
    await waitFor(() =>
      expect(within(list).getAllByRole("listitem")).toHaveLength(dealers.length)
    )
    expect(within(list).getAllByRole("listitem")).toHaveLength(dealers.length)
  })

  it("says so when the linked listing is no longer waiting", async () => {
    const approved = db.listings.find((l) => l.moderation === "approved")!
    await open(`/en/admin/moderation?listing=${approved.id}`)
    expect(
      await screen.findByText("This listing is no longer waiting")
    ).toBeTruthy()
  })
})
