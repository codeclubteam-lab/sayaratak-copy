import { fireEvent, screen, waitFor, within } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { ReportsPage } from "@/features/admin-reports/components/reports-page"
import { toast } from "@/components/ui/toast"
import { NowProvider } from "@/lib/now"
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

const open = (path = "/en/admin/reports") =>
  renderShell(
    <NowProvider serverNow={Date.now()}>
      <ReportsPage />
    </NowProvider>,
    { role: "admin", path }
  )
const report = (id: string) => db.reports.find((r) => r.id === id)!
const listingOf = (id: string) =>
  db.listings.find((l) => l.id === report(id).listingId)!
const sheet = () => screen.findByRole("dialog", { name: "Report details" })

describe("ReportsPage", () => {
  it("lists open reports with how many each listing has", async () => {
    await open()
    const table = await screen.findByRole("table", { name: "Reports" })
    const openRows = db.reports.filter((r) => r.status === "open")
    await waitFor(() =>
      expect(within(table).getAllByRole("row")).toHaveLength(
        openRows.length + 1
      )
    )
    // rp-1 and rp-2 share a listing (seed).
    expect(within(table).getAllByRole("cell", { name: "2" })).toHaveLength(2)
  })

  it("opens a report from the table", async () => {
    await open()
    const table = await screen.findByRole("table", { name: "Reports" })
    const title = listingOf("rp-1").title
    const button = await within(table).findAllByRole("button", {
      name: new RegExp(title.slice(0, 10)),
    })
    fireEvent.click(button[0]!)
    expect(await sheet()).toBeTruthy()
  })

  it("Remove listing asks first, then removes it and closes every open report on it", async () => {
    const add = vi.spyOn(toast, "add")
    const listing = listingOf("rp-1")
    await open("/en/admin/reports?id=rp-1")
    const panel = await sheet()
    fireEvent.click(
      await within(panel).findByRole("button", { name: "Remove listing" })
    )
    const confirm = await screen.findByRole("alertdialog")
    fireEvent.click(within(confirm).getByRole("button", { name: "Remove" }))
    await waitFor(() => expect(listing.moderation).toBe("removed"))
    expect(report("rp-1").status).toBe("actioned")
    expect(report("rp-2").status).toBe("actioned")
    expect(
      db.notifications.some(
        (n) => n.userId === listing.ownerUserId && n.type === "listing_rejected"
      )
    ).toBe(true)
    await waitFor(() =>
      expect(add).toHaveBeenCalledWith({ title: "Listing removed" })
    )
  })

  it("Ban seller bans the owner, tells nobody and closes the reports", async () => {
    const listing = listingOf("rp-1")
    const notes = db.notifications.length
    await open("/en/admin/reports?id=rp-1")
    const panel = await sheet()
    fireEvent.click(
      await within(panel).findByRole("button", { name: "Ban seller" })
    )
    const dialog = await screen.findByRole("dialog", { name: /^Ban / })
    fireEvent.change(within(dialog).getByLabelText("Reason"), {
      target: { value: "Scam listings" },
    })
    fireEvent.click(within(dialog).getByRole("button", { name: "Ban" }))
    const seller = db.users.find((u) => u.id === listing.ownerUserId)!
    await waitFor(() => expect(seller.banned).toBe(true))
    expect(seller.bannedReason).toBe("Scam listings")
    expect(listing.moderation).toBe("approved")
    expect(report("rp-1").status).toBe("actioned")
    expect(report("rp-2").status).toBe("actioned")
    expect(db.notifications.length).toBe(notes)
  })

  it("Dismiss needs a note and closes only this report", async () => {
    await open("/en/admin/reports?id=rp-1")
    const panel = await sheet()
    fireEvent.click(
      await within(panel).findByRole("button", { name: "Dismiss" })
    )
    const dialog = await screen.findByRole("dialog", {
      name: "Dismiss this report?",
    })
    fireEvent.click(within(dialog).getByRole("button", { name: "Dismiss" }))
    expect(
      await within(dialog).findByText("This field is required")
    ).toBeTruthy()
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Not a violation" })
    )
    fireEvent.click(within(dialog).getByRole("button", { name: "Dismiss" }))
    await waitFor(() => expect(report("rp-1").status).toBe("dismissed"))
    expect(report("rp-1").resolutionNote).toBe("Not a violation")
    expect(report("rp-2").status).toBe("open")
  })

  it("a resolved report opened by link is read only", async () => {
    const resolved = db.reports.find((r) => r.status === "actioned")!
    await open(`/en/admin/reports?id=${resolved.id}`)
    const panel = await sheet()
    expect(await within(panel).findByText("Action taken")).toBeTruthy()
    expect(within(panel).queryByRole("button", { name: "Dismiss" })).toBeNull()
  })

  it("an unknown id says the report is gone", async () => {
    await open("/en/admin/reports?id=rp-nope")
    expect(
      await within(await sheet()).findByText("This report no longer exists.")
    ).toBeTruthy()
  })
})
