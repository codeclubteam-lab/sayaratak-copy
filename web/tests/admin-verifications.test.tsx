import { fireEvent, screen, waitFor, within } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { VerificationsPage } from "@/features/admin-verifications/components/verifications-page"
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

const open = (path = "/en/admin/verifications") =>
  renderShell(
    <NowProvider serverNow={Date.now()}>
      <VerificationsPage />
    </NowProvider>,
    { role: "admin", path }
  )
const request = (id: string) => db.verifications.find((v) => v.id === id)!
const sheet = () =>
  screen.findByRole("dialog", { name: "Verification request" })

describe("VerificationsPage", () => {
  it("opens on Pending and lists every pending request", async () => {
    await open()
    const table = await screen.findByRole("table", {
      name: "Verification requests",
    })
    const pending = db.verifications.filter((v) => v.status === "pending")
    expect(pending.length).toBeGreaterThan(0)
    await waitFor(() =>
      expect(within(table).getAllByRole("row")).toHaveLength(pending.length + 1)
    )
    const name = findBusiness(pending[0]!.targetId)!.name.en
    fireEvent.click(within(table).getByRole("button", { name }))
    expect(await sheet()).toBeTruthy()
  })

  it("Approve asks first, verifies the business and its listings, and tells the owner", async () => {
    const add = vi.spyOn(toast, "add")
    const vr = request("vr-1")
    expect(vr.targetType).toBe("dealership")
    const biz = findBusiness(vr.targetId)!
    expect(biz.verified).toBe(false)
    await open("/en/admin/verifications?id=vr-1")
    const panel = await sheet()
    fireEvent.click(
      await within(panel).findByRole("button", { name: "Approve" })
    )
    const confirm = await screen.findByRole("alertdialog")
    fireEvent.click(within(confirm).getByRole("button", { name: "Approve" }))
    await waitFor(() => expect(vr.status).toBe("approved"))
    expect(biz.verified).toBe(true)
    const listings = db.listings.filter((l) => l.ownerUserId === vr.ownerId)
    expect(listings.every((l) => l.owner.verified)).toBe(true)
    expect(
      db.notifications.some(
        (n) => n.userId === vr.ownerId && n.type === "verification_result"
      )
    ).toBe(true)
    await waitFor(() =>
      expect(add).toHaveBeenCalledWith({ title: "Business verified" })
    )
  })

  it("Reject needs a reason, stores it and tells the owner", async () => {
    const vr = request("vr-2")
    await open("/en/admin/verifications?id=vr-2")
    const panel = await sheet()
    fireEvent.click(
      await within(panel).findByRole("button", { name: "Reject" })
    )
    const dialog = await screen.findByRole("dialog", {
      name: "Reject this request?",
    })
    fireEvent.click(within(dialog).getByRole("button", { name: "Reject" }))
    expect(
      await within(dialog).findByText("This field is required")
    ).toBeTruthy()
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Documents are not readable" })
    )
    fireEvent.click(within(dialog).getByRole("button", { name: "Reject" }))
    await waitFor(() => expect(vr.status).toBe("rejected"))
    expect(vr.rejectionReason).toBe("Documents are not readable")
    expect(findBusiness(vr.targetId)!.verified).toBe(false)
    expect(
      db.notifications.some(
        (n) => n.userId === vr.ownerId && n.type === "verification_result"
      )
    ).toBe(true)
  })

  it("a decided request is read only and its document opens in a zoomable viewer", async () => {
    await open("/en/admin/verifications?tab=rejected&id=vr-6")
    const panel = await sheet()
    expect(await within(panel).findByText("المستند غير واضح")).toBeTruthy()
    expect(within(panel).queryByRole("button", { name: "Approve" })).toBeNull()
    fireEvent.click(within(panel).getAllByRole("button", { name: /1 of/ })[0]!)
    const zoom = await screen.findByRole("button", { name: "Zoom" })
    expect(zoom.getAttribute("aria-pressed")).toBe("false")
    fireEvent.click(zoom)
    expect(zoom.getAttribute("aria-pressed")).toBe("true")
  })

  it("closes the loop from 8.7: a request the demo workshop sent shows here and approval verifies it", async () => {
    const workshop = db.workshops.find((w) => w.id === "w-1")!
    expect(workshop.verified).toBe(false)
    db.verifications.push({
      id: "vr-new",
      targetType: "workshop",
      targetId: workshop.id,
      ownerId: workshop.ownerId,
      documents: [
        { id: "d1", label: "workshop_license", url: "/mock/doc-01.svg" },
      ],
      status: "pending",
      createdAt: new Date().toISOString(),
    })
    await open()
    const table = await screen.findByRole("table", {
      name: "Verification requests",
    })
    fireEvent.click(
      await within(table).findByRole("button", { name: workshop.name.en })
    )
    const panel = await sheet()
    fireEvent.click(
      await within(panel).findByRole("button", { name: "Approve" })
    )
    fireEvent.click(
      within(await screen.findByRole("alertdialog")).getByRole("button", {
        name: "Approve",
      })
    )
    await waitFor(() => expect(workshop.verified).toBe(true))
  })
})
