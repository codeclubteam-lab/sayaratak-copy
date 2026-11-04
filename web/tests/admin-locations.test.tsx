import { fireEvent, screen, waitFor, within } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { LocationsPage } from "@/features/admin-locations/components/locations-page"
import { db, resetDb } from "@/mocks/db"
import { handleMock } from "@/mocks/router"
import { taxonomySchema } from "@sayaratak/shared/schemas/taxonomy"
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

const call = (path: string, method = "GET", body?: unknown) =>
  handleMock(
    new Request(`http://localhost/api${path}`, {
      method,
      headers: {
        cookie: "sy_session=u-admin",
        "content-type": "application/json",
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  )
const publicTaxonomy = async () =>
  taxonomySchema.parse(await (await call("/taxonomy")).json())

describe("LocationsPage", () => {
  it("keeps the last country on and shows another only after a confirm", async () => {
    await renderShell(<LocationsPage />, {
      role: "admin",
      path: "/en/admin/locations",
    })
    expect(await screen.findByText("Only country shown, stays on")).toBeTruthy()
    expect(
      (await call("/admin/taxonomy/countries/sd", "PATCH", { enabled: false }))
        .status
    ).toBe(409)

    fireEvent.click(
      await screen.findByRole("switch", { name: "On the site, Egypt" })
    )
    const dialog = await screen.findByRole("alertdialog")
    fireEvent.click(within(dialog).getByRole("button", { name: "Show" }))
    await waitFor(() =>
      expect(db.countries.find((c) => c.id === "eg")?.enabled).toBe(true)
    )
    expect(
      await screen.findByRole("switch", { name: "On the site, Sudan" })
    ).toBeTruthy()
  })

  it("adds a district to a city from the Districts tab", async () => {
    await renderShell(<LocationsPage />, {
      role: "admin",
      path: "/en/admin/locations?tab=districts&cityId=kassala",
    })
    fireEvent.click(await screen.findByRole("button", { name: "Add district" }))
    const dialog = await screen.findByRole("dialog", { name: "Add district" })
    fireEvent.change(within(dialog).getByLabelText("Name in Arabic"), {
      target: { value: "الحلنقة" },
    })
    fireEvent.change(within(dialog).getByLabelText("Name in English"), {
      target: { value: "Halanga" },
    })
    fireEvent.click(within(dialog).getByRole("button", { name: "Save" }))
    await waitFor(() =>
      expect(db.taxonomy.districts.at(-1)).toMatchObject({
        cityId: "kassala",
        name: { en: "Halanga" },
      })
    )
  })
})

describe("locations mock", () => {
  it("gives a new city a slug and lists it publicly only while its country is on", async () => {
    const city = {
      name: { ar: "كريمة", en: "Karima" },
      center: { lat: 17.7, lng: 34 },
    }
    await call("/admin/taxonomy/cities", "POST", { ...city, countryId: "sd" })
    const again = await (
      await call("/admin/taxonomy/cities", "POST", { ...city, countryId: "eg" })
    ).json()
    expect(again.id).toBe("karima-2")
    await call("/admin/taxonomy/districts", "POST", {
      cityId: "karima-2",
      name: { ar: "السوق", en: "Market" },
    })

    let pub = await publicTaxonomy()
    expect(pub.cities.some((c) => c.id === "karima")).toBe(true)
    expect(pub.cities.some((c) => c.id === "karima-2")).toBe(false)
    expect(pub.districts.some((d) => d.cityId === "karima-2")).toBe(false)

    await call("/admin/taxonomy/countries/eg", "PATCH", { enabled: true })
    pub = await publicTaxonomy()
    expect(pub.districts.some((d) => d.cityId === "karima-2")).toBe(true)

    // A city keeps its slug when renamed.
    await call("/admin/taxonomy/cities/karima", "PATCH", {
      name: { ar: "كريمة", en: "Karima town" },
    })
    expect(db.taxonomy.cities.find((c) => c.id === "karima")?.slug).toBe(
      "karima"
    )
  })

  it("refuses to remove a place in use with 409 in_use", async () => {
    for (const path of [
      "/admin/taxonomy/countries/sd",
      "/admin/taxonomy/cities/khartoum",
      `/admin/taxonomy/districts/${db.listings.find((l) => l.districtId)!.districtId}`,
    ]) {
      const res = await call(path, "DELETE")
      expect(res.status).toBe(409)
      expect(await res.json()).toMatchObject({ code: "in_use" })
    }
    expect((await call("/admin/taxonomy/countries/eg", "DELETE")).status).toBe(
      200
    )
  })
})
