import { fireEvent, screen, waitFor, within } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { ReviewsPage } from "@/features/admin-reviews/components/reviews-page"
import { toast } from "@/components/ui/toast"
import { NowProvider } from "@/lib/now"
import { db, resetDb } from "@/mocks/db"
import { findBusiness } from "@/mocks/lib"
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

const open = (path = "/en/admin/reviews") =>
  renderShell(
    <NowProvider serverNow={Date.now()}>
      <ReviewsPage />
    </NowProvider>,
    { role: "admin", path }
  )
const table = () => screen.findByRole("table", { name: "Reviews" })
const rowCount = async (n: number) => {
  const t = await table()
  await waitFor(() => expect(within(t).getAllByRole("row")).toHaveLength(n + 1))
}
// Picks a row action of the first row, then confirms it.
const act = async (action: string) => {
  const t = await table()
  const [menu] = await within(t).findAllByRole("button", {
    name: /^Actions for /,
  })
  fireEvent.click(menu!)
  fireEvent.click(await screen.findByRole("menuitem", { name: action }))
  const confirm = await screen.findByRole("alertdialog")
  fireEvent.click(within(confirm).getByRole("button", { name: action }))
}
const newest = (status: string) =>
  db.reviews
    .filter((r) => r.status === status)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]!

describe("ReviewsPage", () => {
  it("opens on the flagged tab and lists every flagged review", async () => {
    await open()
    expect(
      screen.getByRole("tab", { name: "Flagged", selected: true })
    ).toBeTruthy()
    await rowCount(db.reviews.filter((r) => r.status === "flagged").length)
  })

  it("Hide asks first, hides the review and drops it from the rating", async () => {
    const add = vi.spyOn(toast, "add")
    const review = newest("flagged")
    const target = findBusiness(review.targetId)!
    const count = target.rating.count
    await open()
    await act("Hide")
    await waitFor(() => expect(review.status).toBe("hidden"))
    expect(target.rating.count).toBe(count - 1)
    await waitFor(() =>
      expect(add).toHaveBeenCalledWith({ title: "Review hidden" })
    )
  })

  it("Keep visible clears the flag", async () => {
    const review = newest("flagged")
    await open()
    await act("Keep visible")
    await waitFor(() => expect(review.status).toBe("visible"))
  })

  it("Show brings a hidden review back into the rating", async () => {
    const review = newest("hidden")
    const target = findBusiness(review.targetId)!
    const count = target.rating.count
    await open("/en/admin/reviews?tab=hidden")
    await act("Show")
    await waitFor(() => expect(review.status).toBe("visible"))
    expect(target.rating.count).toBe(count + 1)
  })

  it("filters by business type and rating", async () => {
    await open("/en/admin/reviews?tab=visible&targetType=workshop&rating=5")
    const rows = db.reviews.filter(
      (r) =>
        r.status === "visible" && r.targetType === "workshop" && r.rating === 5
    )
    expect(rows.length).toBeGreaterThan(0)
    await rowCount(Math.min(rows.length, 20))
  })
})
