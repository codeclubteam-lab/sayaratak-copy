import { fireEvent, screen, waitFor, within } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { BusinessProfilePage } from "@/features/business-profile/components/business-profile-page"
import { db, resetDb } from "@/mocks/db"
import { handleMock } from "@/mocks/router"
import { mechanicSchema } from "@sayaratak/shared/schemas/profile"
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

const owner = () =>
  db.users.find((u) => u.role === "mechanic" && u.onboardingDone)!
const mechanic = () => db.mechanics.find((m) => m.ownerId === owner().id)!
const open = () =>
  renderShell(<BusinessProfilePage variant="mechanic" />, {
    role: "mechanic",
    path: "/en/mechanic/profile",
  })
const section = async (title: string) =>
  within(
    (await screen.findByRole("heading", { name: title })).closest("section")!
  )
const publicProfile = async () =>
  mechanicSchema.parse(
    await (
      await handleMock(new Request(`http://x/api/mechanics/${mechanic().slug}`))
    ).json()
  )

describe("BusinessProfilePage, mechanic", () => {
  it("saves the bio in one language and keeps the other", async () => {
    const before = structuredClone(mechanic())
    await open()
    expect(
      (
        await screen.findByRole("link", { name: /View public profile/ })
      ).getAttribute("href")
    ).toBe(`/en/mechanics/${before.slug}`)
    const about = await section("About")
    const bio = "Twenty years on diesel engines and gearboxes."
    fireEvent.change(about.getByLabelText("Bio in English"), {
      target: { value: bio },
    })
    fireEvent.click(about.getByRole("button", { name: "Save" }))
    await waitFor(() =>
      expect(mechanic().bio).toEqual({ ar: before.bio.ar, en: bio })
    )
    expect((await publicProfile()).bio.en).toBe(bio)
    expect(mechanic().phone).toBe(before.phone)
  })

  it("keeps the home city in the served cities it saves", async () => {
    await open()
    const skills = await section("Skills and cities")
    const home = mechanic().cityId
    const cities = await skills.findByRole("group", { name: /Other cities/ })
    const city = db.taxonomy.cities.find(
      (c) => !mechanic().servedCityIds.includes(c.id)
    )!
    fireEvent.click(
      within(cities).getByRole("checkbox", { name: city.name.en })
    )
    fireEvent.click(skills.getByRole("button", { name: "Save" }))
    await waitFor(() => expect(mechanic().servedCityIds).toContain(city.id))
    await waitFor(() =>
      expect(skills.queryByText("Unsaved changes")).toBeNull()
    )
    const served = (await publicProfile()).servedCityIds
    expect(served[0]).toBe(home)
    expect(served.filter((id) => id === home)).toHaveLength(1)
  })

  it("the availability switch saves at once", async () => {
    mechanic().available = true
    await open()
    const availability = await section("Availability")
    fireEvent.click(
      availability.getByRole("switch", { name: "Available for new work" })
    )
    await waitFor(() => expect(mechanic().available).toBe(false))
  })
})
