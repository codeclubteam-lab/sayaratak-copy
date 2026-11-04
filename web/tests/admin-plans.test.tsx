import { fireEvent, screen, waitFor, within } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { PlansPage } from "@/features/admin-plans/components/plans-page"
import { toast } from "@/components/ui/toast"
import { NowProvider } from "@/lib/now"
import { db, find, resetDb } from "@/mocks/db"
import { handleMock } from "@/mocks/router"
import { confirmRemove } from "./confirm"
import { pick } from "./pick"
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

const open = (query = "") =>
  renderShell(
    <NowProvider serverNow={Date.now()}>
      <PlansPage />
    </NowProvider>,
    { role: "admin", path: `/en/admin/plans${query}` }
  )
async function api(path: string, as?: string) {
  const res = await handleMock(
    new Request(`http://localhost/api${path}`, {
      headers: as ? { cookie: `sy_session=${as}` } : {},
    })
  )
  return res.json()
}
const offered = async (audience: string) =>
  ((await api(`/plans?audience=${audience}`)) as { id: string }[]).map(
    (p) => p.id
  )
const textbox = (scope: HTMLElement, name: RegExp) =>
  within(scope).getByRole("textbox", { name })
const confirmIn = async (title: string, button: string) =>
  fireEvent.click(
    within(await screen.findByRole("alertdialog", { name: title })).getByRole(
      "button",
      { name: button }
    )
  )

describe("PlansPage", () => {
  it("opens on Individuals with the settings and every individual plan; the free plan is locked", async () => {
    await open()
    const settings = await screen.findByRole("region", {
      name: "Individual sellers",
    })
    const toggle = await within(settings).findByRole("switch", {
      name: "Individual subscriptions",
    })
    expect(toggle.getAttribute("aria-checked")).toBe("true")
    expect(
      within(settings).getByRole("textbox", { name: /Free listings per user/ })
    ).toHaveProperty("value", "3")
    const table = await screen.findByRole("table", { name: "Individual plans" })
    const rows = db.plans.filter((p) => p.audience === "user")
    await waitFor(() =>
      expect(within(table).getAllByRole("row")).toHaveLength(rows.length + 1)
    )
    expect(within(table).getByText("Free plan, always on")).toBeTruthy()
    expect(
      within(table).queryByRole("button", { name: "Remove Free" })
    ).toBeNull()
    // The Subscribers column counts each plan's active subscriptions.
    const col = within(table)
      .getAllByRole("columnheader")
      .findIndex((h) => h.textContent === "Subscribers")
    const plus = within(table).getByRole("row", { name: /Plus/ })
    expect(within(plus).getAllByRole("cell")[col]?.textContent).toBe(
      String(
        db.subscriptions.filter(
          (x) => x.planId === "plan-user-plus" && x.status === "active"
        ).length
      )
    )
    const locked = within(table).getByRole("switch", { name: /Free on/ })
    expect(locked.getAttribute("aria-disabled")).toBe("true")
  })

  it("a new dealership plan with a feature shows in onboarding and billing; turning it off hides it", async () => {
    const add = vi.spyOn(toast, "add")
    await open("?tab=dealership")
    fireEvent.click(await screen.findByRole("button", { name: "Add plan" }))
    const dialog = await screen.findByRole("dialog", {
      name: "Add a dealership plan",
    })
    fireEvent.click(within(dialog).getByRole("button", { name: "Save plan" }))
    await waitFor(() =>
      expect(within(dialog).getAllByText("This field is required").length).toBe(
        4
      )
    )
    fireEvent.input(textbox(dialog, /Name in Arabic/), {
      target: { value: "النخبة" },
    })
    fireEvent.input(textbox(dialog, /Name in English/), {
      target: { value: "Elite" },
    })
    fireEvent.change(textbox(dialog, /Price/), { target: { value: "900000" } })
    fireEvent.change(textbox(dialog, /Vehicles/), { target: { value: "500" } })
    fireEvent.click(within(dialog).getByRole("button", { name: "Add feature" }))
    fireEvent.input(
      await within(dialog).findByRole("textbox", {
        name: /Feature 1 in Arabic/,
      }),
      {
        target: { value: "دعم مخصص" },
      }
    )
    fireEvent.input(textbox(dialog, /Feature 1 in English/), {
      target: { value: "Dedicated support" },
    })
    fireEvent.click(within(dialog).getByRole("button", { name: "Save plan" }))
    await waitFor(() =>
      expect(add).toHaveBeenCalledWith({ title: "Plan saved" })
    )
    const plan = db.plans.find((p) => p.name.en === "Elite")!
    expect(plan).toMatchObject({
      audience: "dealership",
      price: 900_000,
      listingLimit: 500,
      features: [{ ar: "دعم مخصص", en: "Dedicated support" }],
      enabled: true,
    })
    expect(plan.serviceLimit).toBeUndefined()
    expect(await offered("dealership")).toContain(plan.id)
    const table = await screen.findByRole("table", { name: "Dealership plans" })
    fireEvent.click(
      await within(table).findByRole("switch", { name: "Elite on" })
    )
    await confirmIn("Turn off Elite?", "Turn off")
    await waitFor(() => expect(plan.enabled).toBe(false))
    expect(await offered("dealership")).not.toContain(plan.id)
  })

  it("edits workshop caps; an empty cap means no cap", async () => {
    await open("?tab=workshop")
    const table = await screen.findByRole("table", { name: "Workshop plans" })
    fireEvent.click(
      await within(table).findByRole("button", { name: "Edit Basic" })
    )
    const dialog = await screen.findByRole("dialog", { name: "Edit Basic" })
    expect(textbox(dialog, /Services/)).toHaveProperty("value", "10")
    expect(textbox(dialog, /Price/)).toHaveProperty("readOnly", true)
    fireEvent.change(textbox(dialog, /Services/), { target: { value: "" } })
    fireEvent.change(textbox(dialog, /Photos/), { target: { value: "4" } })
    fireEvent.click(within(dialog).getByRole("button", { name: "Save plan" }))
    const plan = find(db.plans, "plan-workshop-basic")!
    await waitFor(() => expect(plan.photoLimit).toBe(4))
    expect(plan.serviceLimit).toBeUndefined()
    expect(plan.price).toBe(0)
  })

  it("Remove asks first for an unused plan; a used one explains and turns off instead", async () => {
    db.plans.push({
      id: "plan-spare",
      audience: "mechanic",
      name: { ar: "احتياطية", en: "Spare" },
      price: 10_000,
      durationDays: 30,
      features: [],
      featuredCredits: 0,
      enabled: true,
      sortOrder: 9,
    })
    await open("?tab=mechanic")
    const table = await screen.findByRole("table", { name: "Mechanic plans" })
    fireEvent.click(
      await within(table).findByRole("button", { name: "Remove Spare" })
    )
    await confirmRemove("Remove the Spare plan?")
    await waitFor(() => expect(find(db.plans, "plan-spare")).toBeUndefined())
    fireEvent.click(within(table).getByRole("button", { name: "Remove Plus" }))
    await confirmIn(
      "This item is in use and cannot be deleted",
      "Turn off instead"
    )
    await waitFor(() =>
      expect(find(db.plans, "plan-mechanic-plus")?.enabled).toBe(false)
    )
  })

  it("the individual switch and free limit drive the account limit and the Free plan", async () => {
    const person = db.users.find(
      (u) =>
        u.role === "user" &&
        u.onboardingDone &&
        !db.subscriptions.some((s) => s.userId === u.id)
    )!
    expect((await api("/me/subscription", person.id)).usage.limit).toBe(3)
    await open()
    const settings = await screen.findByRole("region", {
      name: "Individual sellers",
    })
    const limit = await within(settings).findByRole("textbox", {
      name: /Free listings per user/,
    })
    fireEvent.change(limit, { target: { value: "500" } })
    expect(await within(settings).findByText("Unsaved changes")).toBeTruthy()
    fireEvent.click(within(settings).getByRole("button", { name: "Save" }))
    expect(
      await within(settings).findByText("This number is too large")
    ).toBeTruthy()
    expect(limit.getAttribute("aria-invalid")).toBe("true")
    expect(db.settings.freeListingLimit).toBe(3)
    fireEvent.change(limit, { target: { value: "5" } })
    fireEvent.click(
      within(settings).getByRole("switch", { name: "Individual subscriptions" })
    )
    fireEvent.click(within(settings).getByRole("button", { name: "Save" }))
    await waitFor(() =>
      expect(db.settings.individualSubscriptionsEnabled).toBe(false)
    )
    expect(find(db.plans, "plan-user-free")?.listingLimit).toBe(5)
    expect((await api("/me/subscription", person.id)).usage.limit).toBeNull()
    expect(await offered("user")).toEqual([])
    db.settings.individualSubscriptionsEnabled = true
    expect((await api("/me/subscription", person.id)).usage.limit).toBe(5)
  })

  it("Subscribers lists every subscription and filters by status and audience", async () => {
    await open("?tab=subscribers")
    const table = await screen.findByRole("table", { name: "Subscriptions" })
    await waitFor(() =>
      expect(within(table).getAllByRole("row")).toHaveLength(
        Math.min(20, db.subscriptions.length) + 1
      )
    )
    const dealer = await within(table).findByRole("link", {
      name: db.dealerships.find((d) => d.ownerId === "u-dealer")!.name.en,
    })
    expect(dealer.getAttribute("href")).toMatch(/\/en\/admin\/dealerships\?id=/)
    await pick(screen.getByRole("combobox", { name: "Audience" }), "Workshops")
    const workshops = db.subscriptions.filter(
      (s) => find(db.plans, s.planId)?.audience === "workshop"
    )
    await waitFor(() =>
      expect(within(table).getAllByRole("row")).toHaveLength(
        workshops.length + 1
      )
    )
  })
})
