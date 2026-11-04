import { fireEvent, screen, waitFor, within } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { AdminListingsPage } from "@/features/admin-listings/components/admin-listings-page"
import { toast } from "@/components/ui/toast"
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

const open = (path = "/en/admin/listings") =>
  renderShell(
    <NowProvider serverNow={Date.now()}>
      <AdminListingsPage />
    </NowProvider>,
    { role: "admin", path }
  )
const get = async (path: string, as?: string) => {
  const res = await handleMock(
    new Request(`http://localhost/api${path}`, {
      headers: as ? { cookie: `sy_session=${as}` } : {},
    })
  )
  return { status: res.status, body: await res.json() }
}
const sheet = () => screen.findByRole("dialog", { name: "Listing" })
const live = (l: (typeof db.listings)[number]) =>
  l.promotions.some(
    (p) =>
      Date.parse(p.startsAt) <= Date.now() && Date.now() < Date.parse(p.endsAt)
  )

describe("AdminListingsPage", () => {
  it("All lists every listing but drafts, with report counts", async () => {
    const { body } = await get("/admin/listings?pageSize=500", "u-admin")
    const shown = db.listings.filter((l) => l.moderation !== "draft")
    expect(body.total).toBe(shown.length)
    expect(
      body.items.some((l: { moderation: string }) => l.moderation === "draft")
    ).toBe(false)
    const reported = db.reports[0]!.listingId
    const one = await get(`/admin/listings?id=${reported}`, "u-admin")
    expect(one.body.items[0].reports).toBe(
      db.reports.filter((r) => r.listingId === reported).length
    )
    await open()
    const table = await screen.findByRole("table", { name: "All listings" })
    await waitFor(() =>
      expect(within(table).getAllByRole("row")).toHaveLength(
        Math.min(20, shown.length) + 1
      )
    )
  })

  it("every filter matches the DB", async () => {
    const city = db.listings.find((l) => l.moderation === "approved")!.cityId
    const cases: [string, (l: (typeof db.listings)[number]) => boolean][] = [
      ["moderation=approved", (l) => l.moderation === "approved"],
      [`cityId=${city}`, (l) => l.cityId === city],
      ["type=vehicle", (l) => l.kind === "vehicle"],
      ["type=truck", (l) => l.vehicleType === "truck"],
      ["type=part", (l) => l.kind === "part"],
      ["sellerKind=dealership", (l) => l.owner.type === "dealership"],
      ["sellerKind=individual", (l) => l.owner.type === "user"],
      ["sellerKind=verified", (l) => l.owner.verified],
      ["promoted=yes", live],
      ["promoted=no", (l) => !live(l)],
    ]
    for (const [query, match] of cases) {
      const { body } = await get(
        `/admin/listings?pageSize=500&${query}`,
        "u-admin"
      )
      const expected = db.listings.filter(
        (l) =>
          match(l) &&
          (query.startsWith("moderation") || l.moderation !== "draft")
      )
      expect(body.total, query).toBe(expected.length)
    }
  })

  it("bulk Remove asks first, removes the picked rows and hides them from the public site", async () => {
    const add = vi.spyOn(toast, "add")
    await open()
    const table = await screen.findByRole("table", { name: "All listings" })
    const boxes = await within(table).findAllByRole("checkbox", {
      name: "Select row",
    })
    fireEvent.click(boxes[0]!)
    fireEvent.click(boxes[1]!)
    const bar = await screen.findByRole("region", {
      name: "Actions for selected rows",
    })
    fireEvent.click(within(bar).getByRole("button", { name: "Remove" }))
    const confirm = await screen.findByRole("alertdialog")
    fireEvent.click(within(confirm).getByRole("button", { name: "Remove" }))
    await waitFor(() =>
      expect(add).toHaveBeenCalledWith({ title: "2 listings removed" })
    )
    const removed = db.listings.filter((l) => l.moderation === "removed")
    expect(removed.length).toBeGreaterThanOrEqual(2)
    for (const l of removed)
      expect((await get(`/listings/${l.slug}`)).status).toBe(404)
  })

  it("bulk Approve asks first", async () => {
    const waiting = () =>
      db.listings.filter((l) => l.moderation === "pending").length
    const before = waiting()
    await open("/en/admin/listings?tab=pending")
    const table = await screen.findByRole("table", { name: "All listings" })
    const boxes = await within(table).findAllByRole("checkbox", {
      name: "Select row",
    })
    fireEvent.click(boxes[0]!)
    fireEvent.click(boxes[1]!)
    const bar = await screen.findByRole("region", {
      name: "Actions for selected rows",
    })
    fireEvent.click(within(bar).getByRole("button", { name: "Approve" }))
    const confirm = await screen.findByRole("alertdialog", {
      name: "Approve 2 listings?",
    })
    expect(waiting()).toBe(before)
    fireEvent.click(within(confirm).getByRole("button", { name: "Approve" }))
    await waitFor(() => expect(waiting()).toBe(before - 2))
  })

  it("bulk Restore only touches removed rows", async () => {
    const [a, b] = db.listings.filter((l) => l.moderation === "approved")
    a!.moderation = "removed"
    const res = await handleMock(
      new Request("http://localhost/api/admin/listings/bulk", {
        method: "POST",
        headers: {
          cookie: "sy_session=u-admin",
          "content-type": "application/json",
        },
        body: JSON.stringify({ ids: [a!.id, b!.id], action: "restore" }),
      })
    )
    expect((await res.json()).count).toBe(1)
    expect(a!.moderation).toBe("approved")
  })

  it("the sheet restores a removed listing, rejects with a reason and grants a promotion", async () => {
    const add = vi.spyOn(toast, "add")
    const row = db.listings.find(
      (l) => l.moderation === "approved" && !live(l)
    )!
    row.moderation = "removed"
    await open(`/en/admin/listings?id=${row.id}`)
    let panel = await sheet()
    fireEvent.click(
      await within(panel).findByRole("button", { name: "Restore" })
    )
    expect(row.moderation).toBe("removed")
    fireEvent.click(
      within(await screen.findByRole("alertdialog")).getByRole("button", {
        name: "Restore",
      })
    )
    await waitFor(() => expect(row.moderation).toBe("approved"))

    panel = await sheet()
    fireEvent.click(
      await within(panel).findByRole("button", { name: "Grant promotion" })
    )
    const grant = await screen.findByRole("dialog", {
      name: "Grant a promotion",
    })
    fireEvent.click(
      within(grant).getByRole("button", { name: "Grant promotion" })
    )
    await waitFor(() => expect(live(row)).toBe(true))
    expect(row.promotions.at(-1)!.type).toBe("featured")
    await waitFor(() =>
      expect(add).toHaveBeenCalledWith({ title: "Promotion granted" })
    )

    fireEvent.click(
      await within(panel).findByRole("button", { name: "Reject" })
    )
    const reject = await screen.findByRole("dialog", {
      name: "Reject this listing?",
    })
    fireEvent.click(within(reject).getByRole("button", { name: "Duplicate" }))
    fireEvent.click(within(reject).getByRole("button", { name: "Reject" }))
    await waitFor(() => expect(row.moderation).toBe("rejected"))
    expect(row.rejectionReason).toBe("Duplicate")
    expect(
      db.notifications.some(
        (n) => n.userId === row.ownerUserId && n.type === "listing_rejected"
      )
    ).toBe(true)
  })

  it("ownerId narrows to one person's listings and its chip clears it", async () => {
    const own = db.listings.filter(
      (l) => l.ownerUserId === "u-omar" && l.moderation !== "draft"
    )
    const { router } = await open("/en/admin/listings?ownerId=u-omar")
    const chip = await screen.findByRole("button", {
      name: "Remove Seller: Omar Hassan",
    })
    const table = await screen.findByRole("table", { name: "All listings" })
    await waitFor(() =>
      expect(within(table).getAllByRole("row")).toHaveLength(
        Math.min(20, own.length) + 1
      )
    )
    fireEvent.click(chip)
    await waitFor(() =>
      expect(router.history.location.search).not.toContain("ownerId")
    )
  })

  it("an unknown id says the listing is gone", async () => {
    await open("/en/admin/listings?id=nope")
    const panel = await sheet()
    expect(
      await within(panel).findByText("This listing no longer exists.")
    ).toBeTruthy()
  })
})
