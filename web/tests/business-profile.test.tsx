import { act, fireEvent, screen, waitFor, within } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { BusinessProfilePage } from "@/features/business-profile/components/business-profile-page"
import { db, resetDb } from "@/mocks/db"
import { renderShell } from "./shell-render"

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

const dealership = () => {
  const owner = db.users.find(
    (u) => u.role === "dealership" && u.onboardingDone
  )!
  return db.dealerships.find((d) => d.ownerId === owner.id)!
}
const open = () =>
  renderShell(<BusinessProfilePage variant="dealership" />, {
    role: "dealership",
    path: "/en/dealer/profile",
  })
const section = async (title: string) =>
  within(
    (await screen.findByRole("heading", { name: title })).closest("section")!
  )

describe("BusinessProfilePage, dealership", () => {
  it("saves one section without touching the others", async () => {
    const before = structuredClone(dealership())
    await open()
    const details = await section("Details")
    fireEvent.change(details.getByLabelText("Name in English"), {
      target: { value: "Nile Motors Plus" },
    })
    expect(details.getByText("Unsaved changes")).toBeTruthy()
    fireEvent.click(details.getByRole("button", { name: "Save" }))
    await waitFor(() =>
      expect(dealership().name).toEqual({
        ar: before.name.ar,
        en: "Nile Motors Plus",
      })
    )
    await waitFor(() =>
      expect(details.queryByText("Unsaved changes")).toBeNull()
    )
    expect(dealership().phones).toEqual(before.phones)
    expect(dealership().hours).toEqual(before.hours)
  })

  it("saves the opening hours from a preset", async () => {
    await open()
    const hours = await section("Opening hours")
    fireEvent.click(
      hours.getByRole("button", { name: "Sat to Thu, 8:00 to 17:00" })
    )
    fireEvent.click(hours.getByRole("button", { name: "Save" }))
    await waitFor(() =>
      expect(dealership().hours.every((h) => h.open === "08:00")).toBe(true)
    )
  })

  it("asks before leaving with unsaved changes", async () => {
    const { router } = await open()
    const details = await section("Details")
    fireEvent.change(details.getByLabelText("Name in Arabic"), {
      target: { value: "معرض جديد" },
    })
    await act(() => void router.navigate({ href: "/en/dealer" }))
    const dialog = await screen.findByRole("alertdialog")
    expect(within(dialog).getByText("Leave without saving?")).toBeTruthy()
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }))
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull())
    expect(router.state.location.pathname).toBe("/en/dealer/profile")
  })
})

const workshop = () => {
  const owner = db.users.find((u) => u.role === "workshop" && u.onboardingDone)!
  return db.workshops.find((w) => w.ownerId === owner.id)!
}

describe("BusinessProfilePage, workshop", () => {
  it("saves the one phone and links to the public workshop page", async () => {
    const before = structuredClone(workshop())
    await renderShell(<BusinessProfilePage variant="workshop" />, {
      role: "workshop",
      path: "/en/workshop/profile",
    })
    expect(
      (
        await screen.findByRole("link", { name: /View public profile/ })
      ).getAttribute("href")
    ).toBe(`/en/workshops/${before.slug}`)
    const contact = await section("Contact")
    const phone = contact.getByLabelText("Phone number")
    fireEvent.change(phone, { target: { value: "0912345678" } })
    fireEvent.click(contact.getByRole("button", { name: "Save" }))
    await waitFor(() => expect(workshop().phone).not.toBe(before.phone))
    expect(workshop().name).toEqual(before.name)
    expect(workshop().services).toEqual(before.services)
  })
})
