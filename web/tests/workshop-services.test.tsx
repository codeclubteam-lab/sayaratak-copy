import { fireEvent, screen, waitFor, within } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { ServicesPage } from "@/features/workshop-services/components/services-page"
import { db, resetDb } from "@/mocks/db"
import type { Workshop } from "@sayaratak/shared/schemas/profile"
import { renderShell } from "./shell-render"

type Service = Workshop["services"][number]

Element.prototype.scrollIntoView = () => {}
window.scrollTo = () => {}
document.elementFromPoint = () => null

beforeEach(() => {
  resetDb()
  vi.stubGlobal("matchMedia", () => ({
    matches: false,
    addEventListener: () => {},
    removeEventListener: () => {},
  }))
})

const workshop = () => {
  const owner = db.users.find((u) => u.role === "workshop" && u.onboardingDone)!
  return db.workshops.find((w) => w.ownerId === owner.id)!
}
const open = () =>
  renderShell(<ServicesPage />, {
    role: "workshop",
    path: "/en/workshop/services",
  })

describe("ServicesPage", () => {
  it("adds a service with a price, then edits it to clear the price", async () => {
    await open()
    fireEvent.click(await screen.findByRole("button", { name: "Add service" }))
    const dialog = await screen.findByRole("dialog")
    fireEvent.change(within(dialog).getByLabelText(/Service name/), {
      target: { value: "Tyre fitting" },
    })
    fireEvent.change(within(dialog).getByLabelText(/Price from/), {
      target: { value: "15000" },
    })
    fireEvent.click(within(dialog).getByRole("button", { name: "Save" }))
    await waitFor(() =>
      expect(workshop().services.at(-1)).toMatchObject({
        name: "Tyre fitting",
        priceFrom: 15000,
        templateId: null,
      })
    )
    fireEvent.click(
      await screen.findByRole("button", { name: "Actions for Tyre fitting" })
    )
    fireEvent.click(await screen.findByRole("menuitem", { name: "Edit" }))
    const edit = await screen.findByRole("dialog")
    fireEvent.change(within(edit).getByLabelText(/Price from/), {
      target: { value: "" },
    })
    fireEvent.click(within(edit).getByRole("button", { name: "Save" }))
    await waitFor(() =>
      expect(workshop().services.at(-1)?.priceFrom).toBeUndefined()
    )
  })

  it("adds from a template and keeps its templateId", async () => {
    const used = new Set(workshop().services.map((s) => s.templateId))
    const template = db.taxonomy.serviceTemplates.find((s) => !used.has(s.id))!
    await open()
    fireEvent.click(
      await screen.findByRole("button", { name: "Add from templates" })
    )
    fireEvent.click(
      await screen.findByRole("menuitem", { name: template.name.en })
    )
    const dialog = await screen.findByRole("dialog")
    fireEvent.click(within(dialog).getByRole("button", { name: "Save" }))
    await waitFor(() =>
      expect(workshop().services.at(-1)).toMatchObject({
        name: template.name.en,
        templateId: template.id,
      })
    )
  })

  it("moves a service down at once and keeps focus on its arrow", async () => {
    const [a, b] = workshop().services as [Service, Service]
    await open()
    const down = await screen.findByRole("button", {
      name: `Move ${a.name} down`,
    })
    down.focus()
    fireEvent.click(down)
    await waitFor(() =>
      expect(
        workshop()
          .services.slice(0, 2)
          .map((s) => s.id)
      ).toEqual([b.id, a.id])
    )
    expect(document.activeElement?.getAttribute("aria-label")).toBe(
      `Move ${a.name} down`
    )
    expect(
      screen.getByRole("button", { name: `Move ${a.name} up` })
    ).toHaveProperty("disabled", false)
  })

  it("deletes only after the confirm", async () => {
    const [a] = workshop().services as [Service]
    await open()
    fireEvent.click(
      await screen.findByRole("button", { name: `Actions for ${a.name}` })
    )
    fireEvent.click(await screen.findByRole("menuitem", { name: "Delete" }))
    const confirm = await screen.findByRole("alertdialog")
    expect(workshop().services.some((s) => s.id === a.id)).toBe(true)
    fireEvent.click(within(confirm).getByRole("button", { name: "Delete" }))
    await waitFor(() =>
      expect(workshop().services.some((s) => s.id === a.id)).toBe(false)
    )
  })

  it("on Basic, a full list hides Add and offers the plans", async () => {
    const w = workshop()
    db.subscriptions.find(
      (s) => s.userId === w.ownerId && s.status === "active"
    )!.planId = "plan-workshop-basic"
    w.services = w.services.concat(w.services).slice(0, 10)
    await open()
    expect(
      await screen.findByText("You reached the limit of your plan")
    ).toBeTruthy()
    expect(
      screen.getByRole("link", { name: "See plans" }).getAttribute("href")
    ).toBe("/en/workshop/billing")
    expect(screen.queryByRole("button", { name: "Add service" })).toBeNull()
  })
})
