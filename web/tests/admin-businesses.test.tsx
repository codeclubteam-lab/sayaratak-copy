import { fireEvent, screen, waitFor, within } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { BusinessesPage } from "@/features/admin-businesses/components/businesses-page"
import { BillingPage } from "@/features/billing/components/billing-page"
import { SuspendedNotice } from "@/features/dashboard/components/suspended-notice"
import { toast } from "@/components/ui/toast"
import { NowProvider } from "@/lib/now"
import { db, resetDb } from "@/mocks/db"
import { handleMock } from "@/mocks/router"
import type { AdminBusiness } from "@sayaratak/shared/schemas/admin"
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

const open = (type: AdminBusiness["type"], query = "") =>
  renderShell(
    <NowProvider serverNow={Date.now()}>
      <BusinessesPage type={type} />
    </NowProvider>,
    { role: "admin", path: `/en/admin/${type}s${query}` }
  )
const call = async (path: string, as?: string) => {
  const res = await handleMock(
    new Request(`http://localhost/api${path}`, {
      headers: as ? { cookie: `sy_session=${as}` } : {},
    })
  )
  return { status: res.status, body: await res.json() }
}
const shop = () => db.dealerships.find((d) => d.ownerId === "u-dealer")!
const sheet = () => screen.findByRole("dialog", { name: "Dealership" })

describe("BusinessesPage", () => {
  it("each type lists its own table; every filter matches the DB", async () => {
    const tables = {
      dealership: db.dealerships,
      workshop: db.workshops,
      mechanic: db.mechanics,
    }
    for (const [type, rows] of Object.entries(tables)) {
      const all = await call(
        `/admin/businesses?type=${type}&pageSize=500`,
        "u-admin"
      )
      expect(all.body.total, type).toBe(rows.length)
      const cityId = rows[0]!.cityId
      const cases: [string, (b: (typeof rows)[number]) => boolean][] = [
        ["verified=yes", (b) => b.verified],
        ["verified=no", (b) => !b.verified],
        ["status=suspended", (b) => b.status === "suspended"],
        [`cityId=${cityId}`, (b) => b.cityId === cityId],
      ]
      for (const [query, match] of cases) {
        const { body } = await call(
          `/admin/businesses?type=${type}&pageSize=500&${query}`,
          "u-admin"
        )
        expect(body.total, `${type} ${query}`).toBe(rows.filter(match).length)
      }
    }
    const growth = await call(
      "/admin/businesses?type=dealership&planId=plan-dealer-growth",
      "u-admin"
    )
    expect(growth.body.items.map((b: AdminBusiness) => b.id)).toContain(
      shop().id
    )
    expect(
      growth.body.items.every(
        (b: AdminBusiness) => b.plan.id === "plan-dealer-growth"
      )
    ).toBe(true)

    await open("dealership")
    const table = await screen.findByRole("table", { name: "Dealerships" })
    expect(
      within(table).getByRole("columnheader", { name: "Listings" })
    ).toBeTruthy()
  })

  it("workshops have no listings column", async () => {
    await open("workshop")
    const table = await screen.findByRole("table", { name: "Workshops" })
    await waitFor(() =>
      expect(within(table).getAllByRole("row").length).toBeGreaterThan(1)
    )
    expect(
      within(table).queryByRole("columnheader", { name: "Listings" })
    ).toBeNull()
  })

  it("the Active switch asks for a reason; suspension hides the page and listings and shows the owner a notice; reactivate confirms", async () => {
    const add = vi.spyOn(toast, "add")
    const row = shop()
    const listing = db.listings.find(
      (l) => l.ownerUserId === "u-dealer" && l.moderation === "approved"
    )!
    await open("dealership", `?q=${encodeURIComponent(row.name.en)}`)
    const table = await screen.findByRole("table", { name: "Dealerships" })
    fireEvent.click(
      await within(table).findByRole("switch", {
        name: `Active, ${row.name.en}`,
      })
    )
    const dialog = await screen.findByRole("dialog", {
      name: `Suspend ${row.name.en}?`,
    })
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Unpaid subscription" })
    )
    fireEvent.click(within(dialog).getByRole("button", { name: "Suspend" }))
    await waitFor(() =>
      expect(add).toHaveBeenCalledWith({ title: "Business suspended" })
    )
    expect(row.status).toBe("suspended")
    expect(row.suspendedReason).toBe("Unpaid subscription")
    expect((await call(`/dealerships/${row.slug}`)).status).toBe(404)
    expect((await call(`/listings/${listing.slug}`)).status).toBe(404)
    expect(
      db.notifications.find((n) => n.userId === "u-dealer")?.title.en
    ).toBe("Your page is suspended")

    // Reactivate from the sheet.
    fireEvent.click(within(table).getByRole("button", { name: row.name.en }))
    const panel = await sheet()
    expect(
      await within(panel).findByText("Suspension reason: Unpaid subscription")
    ).toBeTruthy()
    fireEvent.click(within(panel).getByRole("button", { name: "Reactivate" }))
    const confirm = await screen.findByRole("alertdialog")
    expect(row.status).toBe("suspended")
    fireEvent.click(within(confirm).getByRole("button", { name: "Reactivate" }))
    await waitFor(() => expect(row.status).toBe("active"))
    expect(row.suspendedReason).toBeUndefined()
    expect((await call(`/dealerships/${row.slug}`)).status).toBe(200)
  })

  it("the owner's dashboard shows the suspension and its reason", async () => {
    const row = shop()
    row.status = "suspended"
    row.suspendedReason = "Fake details"
    await renderShell(<SuspendedNotice />, { role: "dealership" })
    expect(
      await screen.findByRole("heading", { name: "Your page is suspended" })
    ).toBeTruthy()
    expect(screen.getByText("Reason: Fake details")).toBeTruthy()
  })

  it("Unverify confirms and takes the badge off the dealership's listings", async () => {
    const row = shop()
    row.verified = true
    await open("dealership", `?q=${encodeURIComponent(row.name.en)}`)
    const table = await screen.findByRole("table", { name: "Dealerships" })
    fireEvent.click(
      await within(table).findByRole("switch", {
        name: `Verified, ${row.name.en}`,
      })
    )
    const confirm = await screen.findByRole("alertdialog")
    fireEvent.click(within(confirm).getByRole("button", { name: "Unverify" }))
    await waitFor(() => expect(row.verified).toBe(false))
    const own = db.listings.filter(
      (l) => l.ownerUserId === "u-dealer" && l.owner.type === "dealership"
    )
    expect(own.length).toBeGreaterThan(0)
    expect(own.every((l) => !l.owner.verified)).toBe(true)
  })

  it("an assigned custom plan shows its own price, limit and end date on the owner's billing page", async () => {
    const add = vi.spyOn(toast, "add")
    const row = shop()
    await open("dealership", `?id=${row.id}`)
    const panel = await sheet()
    fireEvent.click(
      await within(panel).findByRole("button", { name: "Assign plan" })
    )
    const dialog = await screen.findByRole("dialog", {
      name: `Assign a plan to ${row.name.en}`,
    })
    const field = (name: RegExp) =>
      within(dialog).getByRole("textbox", { name })
    fireEvent.change(field(/Custom price/), { target: { value: "12345" } })
    fireEvent.change(field(/Length in days/), { target: { value: "45" } })
    fireEvent.change(field(/Listing limit/), { target: { value: "70" } })
    fireEvent.input(field(/Note/), { target: { value: "Launch deal" } })
    fireEvent.click(within(dialog).getByRole("button", { name: "Assign plan" }))
    await waitFor(() =>
      expect(add).toHaveBeenCalledWith({ title: "Plan assigned" })
    )
    const sub = db.subscriptions.find(
      (s) => s.userId === "u-dealer" && s.status === "active"
    )!
    expect(sub.price).toBe(12345)
    expect(sub.usage.limit).toBe(70)
    expect(sub.note).toBe("Launch deal")
    expect(Math.round((Date.parse(sub.endsAt) - Date.now()) / 86_400_000)).toBe(
      45
    )
  })
})

describe("BillingPage after an assigned plan", () => {
  it("shows the custom price, limit and end date", async () => {
    const res = await handleMock(
      new Request(
        `http://localhost/api/admin/businesses/${shop().id}/assign-plan`,
        {
          method: "POST",
          headers: {
            cookie: "sy_session=u-admin",
            "content-type": "application/json",
          },
          body: JSON.stringify({
            planId: "plan-dealer-pro",
            price: 12345,
            limit: 70,
            durationDays: 45,
          }),
        }
      )
    )
    expect(res.status).toBe(200)
    await renderShell(
      <NowProvider serverNow={Date.now()}>
        <BillingPage audience="dealership" />
      </NowProvider>,
      { role: "dealership", path: "/en/dealer/billing" }
    )
    expect(await screen.findByText("12,345")).toBeTruthy()
    expect(screen.getByText(/Ends .+ · in 45 days/)).toBeTruthy()
    expect(screen.getByText(/of 70/)).toBeTruthy()
  })
})
